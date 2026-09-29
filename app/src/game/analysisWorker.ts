/* ------------------------------------------------------------------ */
/* The analysis's own thread. The long judge plays the machine on at    */
/* every position and along every road of the reader's turns, which is  */
/* a minute of thinking for a full game — so it thinks here, and posts  */
/* each figure as it lands: the curve first, then the turns in order.   */
/* ------------------------------------------------------------------ */

import { applyAction } from './actions';
import type { GameAction } from './actions';
import { LONG_JUDGE, PASSES, blendChances, blendVerdicts, costOf, deepChances, judgeTurn, weighRoads } from './analysis';
import type { Cost, Judge, Pass, Reading, Verdict, Weighed } from './analysis';
import { newGame } from './engine';
import type { GameState, SetupPayload } from './types';

export interface Ask {
  setup: SetupPayload;
  seed: number;
  actions: GameAction[];
  /** the seat read */
  me: number;
  judge?: Judge;
  /** the continuations the positions are read by, one pass each */
  passes?: readonly Pass[];
  /** moves already read by a kept reading: the pass picks up after them */
  from?: number;
  /** the positions are read for every seat already: judge the turns only */
  turnsOnly?: boolean;
  /** judge every seat's turns, the seat `me` first: a change of seat then costs nothing */
  all?: boolean;
}

/** one turn's roads, read longer than the pass: the panel asks when a
    turn is being explored */
export interface AskRoads {
  setup: SetupPayload;
  seed: number;
  /** the moves up to the position in question */
  actions: GameAction[];
  me: number;
  roads: GameAction[];
  judge?: Judge;
  passes?: readonly Pass[];
  /** echoed in the answer: the line of moves the roads start from */
  key: string;
}

/** what a miss cost: the played and the better road, from the position
    after the moves given */
export interface AskCost {
  setup: SetupPayload;
  seed: number;
  actions: GameAction[];
  me: number;
  played: GameAction;
  better: GameAction;
  judge?: Judge;
  key: string;
}

export type Note =
  | { kind: 'position'; k: number; seats: Reading[]; done: number; total: number }
  | { kind: 'cost'; key: string; cost: Cost | null }
  | { kind: 'roads'; key: string; roads: Weighed[] }
  | { kind: 'turn'; seat: number; verdict: Verdict; done: number; total: number }
  | { kind: 'done' }
  | { kind: 'failed'; why: string };

/** every position of the game, then every turn of the reader's — and the
    whole round again for each further pass, the machine a shade weaker, so
    the panel has a figure early and a steadier one after */
export function* analyse(ask: Ask): Generator<Note, void, unknown> {
  const judge = ask.judge ?? LONG_JUDGE;
  const passes = ask.passes ?? PASSES;
  let positions: GameState[];
  try {
    let s = newGame(ask.setup, ask.seed);
    positions = [s];
    for (const a of ask.actions) {
      const r = applyAction(s, s.current, a);
      const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
      if (!next) break;
      s = next;
      positions.push(s);
    }
  } catch (e) {
    yield { kind: 'failed', why: e instanceof Error ? e.message : String(e) };
    return;
  }
  /* a kept reading of the first `from` moves stands: this pass reads on from
     there — a position is read forward, never from what came after it */
  const from = Math.max(0, Math.min(ask.from ?? 0, positions.length - 1));
  /* the turns to judge: the seat asked for first, then, when every seat is
     wanted, the others in order */
  const turnsOf = (seat: number) => positions.map((_, k) => k).filter((k) => k >= from && k < ask.actions.length && positions[k].phase === 'action' && positions[k].current === seat && ask.actions[k].kind !== 'concede');
  const turns = turnsOf(ask.me).map((k) => ({ seat: ask.me, k }));
  /* the other seats, when every seat is wanted: read once, by the first
     pass, over fewer roads — enough to grade them, a third of the thinking */
  const others = ask.all ? positions[0].players.map((_, i) => i).filter((i) => i !== ask.me).flatMap((seat) => turnsOf(seat).map((k) => ({ seat, k }))) : [];
  const first = ask.turnsOnly ? positions.length : from === 0 ? 0 : from + 1;
  const total = passes.length * (positions.length - first + turns.length) + others.length;
  /* what the passes have said so far: every seat's chance at every position,
     and the turns of the seat being read */
  const chances = positions.map<number[][]>(() => []);
  const verdicts = new Map<string, Verdict[]>();
  let done = 0;
  for (const pass of passes) {
    for (let k = first; k < positions.length; k++) {
      done += 1;
      chances[k].push(deepChances(positions[k], judge, pass));
      const seats = positions[k].players.map((_, i) => blendChances(chances[k].map((one) => one[i])));
      yield { kind: 'position', k, seats, done, total };
    }
    for (const { seat, k } of turns) {
      done += 1;
      const verdict = judgeTurn(positions[k], seat, ask.actions[k], judge, pass);
      if (!verdict) continue;
      const id = `${seat}:${k}`;
      const seen = [...(verdicts.get(id) ?? []), verdict];
      verdicts.set(id, seen);
      yield { kind: 'turn', seat, verdict: blendVerdicts(seen), done, total };
    }
    if (pass === passes[0]) {
      for (const { seat, k } of others) {
        done += 1;
        const verdict = judgeTurn(positions[k], seat, ask.actions[k], judge, pass, 4);
        if (verdict) yield { kind: 'turn', seat, verdict, done, total };
      }
    }
  }
  yield { kind: 'done' };
}

/** the position after the moves given, then the roads weighed long */
export function readRoads(ask: AskRoads): Note {
  let s = newGame(ask.setup, ask.seed);
  for (const a of ask.actions) {
    const r = applyAction(s, s.current, a);
    const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
    if (!next) return { kind: 'failed', why: 'a move refused on the way' };
    s = next;
  }
  return { kind: 'roads', key: ask.key, roads: weighRoads(s, ask.me, ask.roads, ask.judge ?? LONG_JUDGE, ask.passes ?? PASSES) };
}

/** the position after the moves given, then what the better road was worth */
export function readCost(ask: AskCost): Note {
  let s = newGame(ask.setup, ask.seed);
  for (const a of ask.actions) {
    const r = applyAction(s, s.current, a);
    const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
    if (!next) return { kind: 'failed', why: 'a move refused on the way' };
    s = next;
  }
  return { kind: 'cost', key: ask.key, cost: costOf(s, ask.me, ask.played, ask.better, ask.judge ?? LONG_JUDGE) };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask | AskRoads | AskCost>) => {
    if ('better' in e.data) self.postMessage(readCost(e.data));
    else if ('roads' in e.data) self.postMessage(readRoads(e.data));
    else for (const note of analyse(e.data)) self.postMessage(note);
  };
}
