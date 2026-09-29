import { setupOf } from './actions';
import type { GameAction } from './actions';
import { LONG_JUDGE } from './analysis';
import type { Verdict } from './analysis';
import type { Note } from './analysisWorker';
import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* The coach at the table. Behind the beginner's aid, at a home table   */
/* only and never before a move: once the reader has played, the judge  */
/* reads the move they made against the roads that were open, and the   */
/* board says what it cost. Nothing is shown of a move still to be made.*/
/* ------------------------------------------------------------------ */

export interface Coached {
  /** the move's index in the log */
  at: number;
  seat: number;
  verdict: Verdict;
}

let worker: Worker | null = null;
let asked = 0;

const spawn = (): Worker | null => {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  return worker;
};

/** judge the move just played from `before`; `tell` gets the verdict when it
    lands, unless a later move was asked about meanwhile */
export function coachMove(before: GameState, seat: number, played: GameAction, tell: (c: Coached | null) => void): void {
  const w = spawn();
  if (!w) return;
  const key = `${++asked}`;
  w.onmessage = (e: MessageEvent<Note>) => {
    const n = e.data;
    if (n.kind !== 'one' || n.key !== key) return;
    tell(n.verdict ? { at: before.actions.length, seat, verdict: n.verdict } : null);
  };
  w.postMessage({ setup: setupOf(before), seed: before.seed, actions: before.actions, me: seat, played, judge: LONG_JUDGE, key });
}

/** the coach leaves the table */
export function dismissCoach(): void {
  worker?.terminate();
  worker = null;
}
