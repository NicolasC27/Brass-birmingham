/* ------------------------------------------------------------------ */
/* The second reading: what the machine would have played in your seat. */
/*                                                                     */
/* A judge is slow, so it is given a thread of its own: the page asks,  */
/* this replays the log, and at each of the reader's moves it weighs    */
/* every road open there and says what the one taken cost.              */
/*                                                                     */
/* The cost is in chance of winning, not in the judge's own units. Its  */
/* units drift as a game runs on — a pound reads as 0.43 in the first   */
/* canal round and 0.05 in the last rail one — so the same figure means */
/* different things at different tables. The chance does not: it is a   */
/* logistic fitted on 98 000 positions whose deciles land within five   */
/* points of the observed win rate, and it is read against the best     */
/* rival, so a move that denies one counts for what it is worth. The    */
/* panel in the game weighs its own roads the same way, on the same     */
/* grades, so the two surfaces never contradict each other.             */
/*                                                                     */
/* It stays an opinion, and the page says so.                           */
/* ------------------------------------------------------------------ */

import { actorOf, applyAction } from './actions';
import type { GameAction } from './actions';
import { BEST, LOSS, judgeOf, judgeTurn, sameRoad } from './analysis';
import type { JudgeId } from './analysis';
import type { Grade } from './review';
import { newGame } from './engine';
import type { GameState, SetupPayload } from './types';

export interface Ask {
  setup: SetupPayload;
  seed: number;
  actions: GameAction[];
  /** the seat whose moves are read */
  seat: number;
  /** which judge reads them: the quick one weighs the table as it stands,
   *  the longer ones play the replies out first */
  judge?: JudgeId;
}

/** one move of the reader's, beside the roads open beside it.
 *
 *  What a move cost is read in chance of winning, which means the same
 *  thing at every table of every game. The judge's own units do not: they
 *  run high while rounds remain and low at the close, so a figure in them
 *  cannot be graded against a fixed bar. */
export interface Second {
  /** the index of the move in the log */
  at: number;
  era: 'canal' | 'rail';
  round: number;
  yours: GameAction;
  /** the best road open there, when it is not the one taken */
  theirs: GameAction | null;
  /** the chance of winning after the move played, and after the best road */
  mine: number;
  best: number;
  /** what the move cost, in chance: never below nought */
  loss: number;
  grade: Grade;
  /** how many roads the judge weighed there */
  choices: number;
  /** nothing worth naming was given up */
  top: boolean;
}

export type Note = { kind: 'progress'; done: number; total: number } | { kind: 'done'; moves: Second[] } | { kind: 'failed'; why: string };

/** a move of the given seat's that is worth a second reading */
export const readable = (s: GameState, a: GameAction, seat: number): boolean =>
  actorOf(s, a) === seat && s.phase === 'action' && a.kind !== 'begin-rail' && a.kind !== 'concede' && a.kind !== 'resign';

/** how many moves the reading will look at — counted before it starts, so
 *  the caller's bar knows where it is going */
function countReadable(ask: Ask): number {
  let s: GameState;
  try {
    s = newGame(ask.setup, ask.seed);
  } catch {
    return 0;
  }
  let n = 0;
  for (const a of ask.actions) {
    if (readable(s, a, ask.seat)) n += 1;
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) break;
    s = r.state;
  }
  return n;
}

/** one move of the reader's, weighed against every road open beside it.
 *
 *  The whole of the weighing is the panel's own `judgeTurn`, so a move
 *  graded here and the same move graded in the game carry the same grade. */
export function readMove(before: GameState, seat: number, at: number, played: GameAction, id: JudgeId): Second | null {
  const { judge } = judgeOf(id);
  const v = judgeTurn(before, seat, played, judge, BEST);
  if (!v) return null;
  const first = v.roads[0];
  const same = !!first && sameRoad(first.action) === sameRoad(played);
  return {
    at,
    era: before.era,
    round: before.round,
    yours: played,
    theirs: same ? null : (first?.action ?? null),
    mine: v.mine,
    best: v.best,
    loss: v.loss,
    grade: v.grade,
    choices: v.roads.length,
    top: v.loss <= LOSS.top,
  };
}

/** the reading, step by step, so a caller may show it moving */
export function* readGame(ask: Ask): Generator<Note, void, unknown> {
  const { setup, seed, actions, seat } = ask;
  const id = ask.judge ?? 'quick';
  let s: GameState;
  try {
    s = newGame(setup, seed);
  } catch (e) {
    yield { kind: 'failed', why: String(e) };
    return;
  }
  const mine = countReadable(ask);
  const moves: Second[] = [];
  let done = 0;
  yield { kind: 'progress', done: 0, total: mine };
  for (let at = 0; at < actions.length; at += 1) {
    const a = actions[at];
    const who = actorOf(s, a);
    if (readable(s, a, seat)) {
      const read = readMove(s, seat, at, a, id);
      if (read) moves.push(read);
      done += 1;
      yield { kind: 'progress', done, total: mine };
    }
    const r = applyAction(s, who, a);
    if (!r.state) {
      yield { kind: 'failed', why: `move ${at} (${a.kind}) refused — ${r.error ?? 'no reason'}` };
      return;
    }
    s = r.state;
  }
  /* in the order they were played: the page sorts them as it needs */
  yield { kind: 'done', moves };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask>) => {
    for (const note of readGame(e.data)) self.postMessage(note);
  };
}
