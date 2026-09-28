/* ------------------------------------------------------------------ */
/* The analysis's own thread. The long judge plays the machine on at    */
/* every position and along every road of the reader's turns, which is  */
/* a minute of thinking for a full game — so it thinks here, and posts  */
/* each figure as it lands: the curve first, then the turns in order.   */
/* ------------------------------------------------------------------ */

import { applyAction } from './actions';
import type { GameAction } from './actions';
import { DEEP_JUDGE, LONG_JUDGE, PASSES, blendChances, blendVerdicts, deepChance, judgeTurn, weighRoads } from './analysis';
import type { Judge, Pass, Verdict, Weighed } from './analysis';
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
  /** echoed in the answer: the line of moves the roads start from */
  key: string;
}

export type Note =
  | { kind: 'position'; k: number; chance: number; low: number; high: number; passes: number; done: number; total: number }
  | { kind: 'roads'; key: string; roads: Weighed[] }
  | { kind: 'turn'; verdict: Verdict; done: number; total: number }
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
  const turns = positions.map((_, k) => k).filter((k) => k >= from && k < ask.actions.length && positions[k].phase === 'action' && positions[k].current === ask.me && ask.actions[k].kind !== 'concede');
  const first = from === 0 ? 0 : from + 1;
  const total = passes.length * (positions.length - first + turns.length);
  /* what the passes have said so far, position by position and turn by turn */
  const chances = positions.map<number[]>(() => []);
  const verdicts = new Map<number, Verdict[]>();
  let done = 0;
  for (const pass of passes) {
    for (let k = first; k < positions.length; k++) {
      done += 1;
      chances[k].push(deepChance(positions[k], ask.me, judge, pass));
      const read = blendChances(chances[k]);
      yield { kind: 'position', k, chance: read.chance, low: read.low, high: read.high, passes: read.passes, done, total };
    }
    for (const k of turns) {
      done += 1;
      const verdict = judgeTurn(positions[k], ask.me, ask.actions[k], judge, pass);
      if (!verdict) continue;
      const seen = [...(verdicts.get(k) ?? []), verdict];
      verdicts.set(k, seen);
      yield { kind: 'turn', verdict: blendVerdicts(seen), done, total };
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
  return { kind: 'roads', key: ask.key, roads: weighRoads(s, ask.me, ask.roads, ask.judge ?? DEEP_JUDGE) };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask | AskRoads>) => {
    if ('roads' in e.data) self.postMessage(readRoads(e.data));
    else for (const note of analyse(e.data)) self.postMessage(note);
  };
}
