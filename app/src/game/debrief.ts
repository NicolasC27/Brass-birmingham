import { actorOf, applyAction, setupOf } from './actions';
import type { GameAction } from './actions';
import { newGame } from './engine';
import { GIVE, gradeOf } from './review';
import type { Grade } from './review';
import { readMove, readable } from './reviewWorker';
import type { Era, GameState } from './types';

/* ------------------------------------------------------------------ */
/* The debrief — the game read again once it is over.                  */
/*                                                                     */
/* The reading is the one the review page uses, move for move: at each  */
/* of the reader's turns every move open at that table is read one move */
/* on, and the move played is weighed against the best of them in       */
/* widths of the gap to the middling one. A width means the same thing  */
/* in the first canal round and the last rail one, which a figure in    */
/* the machine's own units does not — its scale runs high early and low */
/* late, so a fixed bar would only ever find canal-era moments.         */
/*                                                                      */
/* The moments worse than a good move make the debrief, the three       */
/* widest kept, each shown on the board under the grade the review page */
/* would give it. Nothing here is projection during play: the game is   */
/* over. The log is walked once, not once per turn.                     */
/* ------------------------------------------------------------------ */

export interface Moment {
  /** the action's index in the log */
  at: number;
  round: number;
  era: Era;
  /** the table before the move, to show on the board */
  before: GameState;
  mine: GameAction;
  /** the best-reading move open at that table */
  better: GameAction;
  /** what the move gave up, in middling-move widths */
  give: number;
  grade: Grade;
  /** how many moves were open at that table */
  choices: number;
}

export interface DebriefOptions {
  /** how long the machine may think at each of the reader's turns */
  budgetMs?: number;
  /** how many moments the debrief keeps */
  take?: number;
}

/** what a turn has to have given up to make the debrief: anything the
 *  review page would call worse than a good move */
const KEEP = GIVE.good;

/** how far the reading has come, and what it holds so far */
export interface Reading {
  done: number;
  total: number;
  /** the widest moments so far, worst first */
  moments: Moment[];
}

/** the reader's turns to read again: the indices of their actions in the
 *  log, counted in one pass and by the same rule the reading uses */
export function turnsOf(g: GameState, me: number): number[] {
  const out: number[] = [];
  let s: GameState;
  try {
    s = newGame(setupOf(g), g.seed);
  } catch {
    return out;
  }
  for (let at = 0; at < g.actions.length; at += 1) {
    const a = g.actions[at];
    if (readable(s, a, me)) out.push(at);
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) break;
    s = r.state;
  }
  return out;
}

/** the game read through once, a turn at a time, so the panel keeps
 *  breathing while the machine thinks: each step yields where the reading
 *  stands and the moments it holds. */
export function* readDebrief(g: GameState, me: number, o: DebriefOptions = {}): Generator<Reading, Reading, unknown> {
  const budgetMs = o.budgetMs ?? 120;
  const take = o.take ?? 3;
  const total = turnsOf(g, me).length;
  const kept: Moment[] = [];
  let done = 0;
  const now = (): Reading => ({ done, total, moments: kept.slice(0, take) });
  let s: GameState;
  try {
    s = newGame(setupOf(g), g.seed);
  } catch {
    return now();
  }
  yield now();
  for (let at = 0; at < g.actions.length; at += 1) {
    const a = g.actions[at];
    const who = actorOf(s, a);
    /* the table before the move: applyAction never touches what it is
       given, so this reference stays the board as it stood here */
    const before = s;
    if (readable(before, a, me)) {
      const read = readMove(before, me, at, a, budgetMs);
      if (read.better && read.give > KEEP) {
        kept.push({ at, round: before.round, era: before.era, before, mine: a, better: read.better, give: read.give, grade: gradeOf(read.give), choices: read.choices });
        kept.sort((x, y) => y.give - x.give);
        /* only the moments kept hold on to a table of their own */
        if (kept.length > take) kept.length = take;
      }
      done += 1;
      yield now();
    }
    const r = applyAction(before, who, a);
    if (!r.state) break;
    s = r.state;
  }
  return now();
}

/** the whole debrief at once (a test's way; the panel reads turn by turn) */
export function debrief(g: GameState, me: number, o: DebriefOptions = {}): Moment[] {
  const reading = readDebrief(g, me, o);
  let step = reading.next();
  while (!step.done) step = reading.next();
  return step.value.moments;
}
