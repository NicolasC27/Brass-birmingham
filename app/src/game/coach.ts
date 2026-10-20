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
/* the asks still out, oldest first: the worker answers each with one note,
   in the order they went, so a note that carries no key — a game it could
   not play through — still says which ask it closes */
let out: string[] = [];
/* the ask the table still waits on, and who to tell */
let waiting: { key: string; at: number; seat: number; tell: (c: Coached | null) => void } | null = null;

/** the coach's worker gave up — it never loaded, it threw, or a note came in
 *  garbled: it goes, the move waiting on it hears nothing, and the next move
 *  played starts a fresh one rather than talking to a dead line */
function drop(): void {
  worker?.terminate();
  worker = null;
  out = [];
  const w = waiting;
  waiting = null;
  w?.tell(null);
}

const spawn = (): Worker | null => {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  worker.onmessage = (e: MessageEvent<Note>) => {
    const n = e.data;
    if (n.kind !== 'one' && n.kind !== 'failed') return;
    const key = n.kind === 'one' ? n.key : out[0];
    out = out.filter((k) => k !== key);
    if (!waiting || waiting.key !== key) return;
    const { at, seat, tell } = waiting;
    waiting = null;
    tell(n.kind === 'one' && n.verdict ? { at, seat, verdict: n.verdict } : null);
  };
  worker.onerror = drop;
  worker.onmessageerror = drop;
  return worker;
};

/** judge the move just played from `before`; `tell` gets the verdict when it
    lands, unless a later move was asked about meanwhile */
export function coachMove(before: GameState, seat: number, played: GameAction, tell: (c: Coached | null) => void): void {
  const w = spawn();
  if (!w) return;
  const key = `${++asked}`;
  out.push(key);
  waiting = { key, at: before.actions.length, seat, tell };
  w.postMessage({ setup: setupOf(before), seed: before.seed, actions: before.actions, me: seat, played, judge: LONG_JUDGE, key });
}

/** the move waiting on the coach is to be told nothing: its note, when it
 *  comes, is read by nobody. The worker stays for the next move */
export function hushCoach(): void {
  waiting = null;
}

/** the coach leaves the table */
export function dismissCoach(): void {
  waiting = null;
  out = [];
  worker?.terminate();
  worker = null;
}

/* a tab closed or a page left: the worker goes with it, mid-thought or not.
   A page kept whole in the browser's back-forward memory keeps its coach */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) dismissCoach();
  });
}
