/* ------------------------------------------------------------------ */
/* The analysis's own thread. The long judge plays the machine on at    */
/* every position and along every road of the reader's turns, which is  */
/* a minute of thinking for a full game — so it thinks here, and posts  */
/* each figure as it lands: the curve first, then the turns in order.   */
/* ------------------------------------------------------------------ */

import { applyAction } from './actions';
import type { GameAction } from './actions';
import { DEEP_JUDGE, LONG_JUDGE, deepChance, judgeTurn, weighRoads } from './analysis';
import type { Judge, Verdict, Weighed } from './analysis';
import { newGame } from './engine';
import type { GameState, SetupPayload } from './types';

export interface Ask {
  setup: SetupPayload;
  seed: number;
  actions: GameAction[];
  /** the seat read */
  me: number;
  judge?: Judge;
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
}

export type Note =
  | { kind: 'position'; k: number; chance: number; done: number; total: number }
  | { kind: 'roads'; at: number; roads: Weighed[] }
  | { kind: 'turn'; verdict: Verdict; done: number; total: number }
  | { kind: 'done' }
  | { kind: 'failed'; why: string };

/** every position of the game, then every turn of the reader's */
export function* analyse(ask: Ask): Generator<Note, void, unknown> {
  const judge = ask.judge ?? LONG_JUDGE;
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
  const turns = positions.map((_, k) => k).filter((k) => k < ask.actions.length && positions[k].phase === 'action' && positions[k].current === ask.me && ask.actions[k].kind !== 'concede');
  const total = positions.length + turns.length;
  let done = 0;
  for (let k = 0; k < positions.length; k++) {
    done += 1;
    yield { kind: 'position', k, chance: deepChance(positions[k], ask.me, judge), done, total };
  }
  for (const k of turns) {
    done += 1;
    const verdict = judgeTurn(positions[k], ask.me, ask.actions[k], judge);
    if (verdict) yield { kind: 'turn', verdict, done, total };
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
  return { kind: 'roads', at: ask.actions.length, roads: weighRoads(s, ask.me, ask.roads, ask.judge ?? DEEP_JUDGE) };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask | AskRoads>) => {
    if ('roads' in e.data) self.postMessage(readRoads(e.data));
    else for (const note of analyse(e.data)) self.postMessage(note);
  };
}
