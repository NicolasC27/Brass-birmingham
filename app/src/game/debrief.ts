import { applyAction, humanActionIndices, replay, setupOf } from './actions';
import type { GameAction } from './actions';
import { chooseBotAction, evaluate } from './search';
import type { Era, GameState } from './types';

/* ------------------------------------------------------------------ */
/* The debrief — the game read again once it is over.                  */
/*                                                                     */
/* For each turn the reader played, the table is replayed to the       */
/* moment before their move, the machine is asked what it would have   */
/* played there, and both moves are weighed by the machine's own judge */
/* on the table they leave. The widest gaps make the debrief: three    */
/* moments where another move scored more, each shown on the board.    */
/* Nothing here is projection during play: the game is over.           */
/* ------------------------------------------------------------------ */

export interface Moment {
  /** the action's index in the log */
  at: number;
  round: number;
  era: Era;
  /** the table before the move, to show on the board */
  before: GameState;
  mine: GameAction;
  better: GameAction;
  /** how much more the machine's move was worth, by its own judge */
  gap: number;
}

export interface DebriefOptions {
  /** how long the machine may think at each of the reader's turns */
  budgetMs?: number;
  /** how many moments the debrief keeps */
  take?: number;
}

/** the reader's turns to read again: the indices of their actions in the log */
export function turnsOf(g: GameState, me: number): number[] {
  const setup = setupOf(g);
  return humanActionIndices(setup, g.seed, g.actions)
    .filter((m) => m.by === me)
    .map((m) => m.at)
    .filter((at) => {
      const a = g.actions[at];
      return a.kind !== 'concede' && a.kind !== 'begin-rail';
    });
}

/** one turn read again: null when the machine would have played the same, or nothing better */
export function readTurn(g: GameState, me: number, at: number, o: DebriefOptions = {}): Moment | null {
  const setup = setupOf(g);
  const before = replay(setup, g.seed, g.actions.slice(0, at));
  const mine = g.actions[at];
  if (before.current !== me || before.phase !== 'action') return null;
  const afterMine = applyAction(before, me, mine).state;
  if (!afterMine) return null;
  const better = chooseBotAction(before, me, { budgetMs: o.budgetMs ?? 120, strength: 1 });
  if (!better || JSON.stringify(better) === JSON.stringify(mine)) return null;
  const afterBetter = applyAction(before, me, better).state;
  if (!afterBetter) return null;
  const gap = evaluate(afterBetter, me) - evaluate(afterMine, me);
  if (gap <= 0.5) return null;
  return { at, round: before.round, era: before.era, before, mine, better, gap: Math.round(gap * 10) / 10 };
}

/** the whole debrief at once (a test's way; the panel reads turn by turn) */
export function debrief(g: GameState, me: number, o: DebriefOptions = {}): Moment[] {
  const moments = turnsOf(g, me)
    .map((at) => readTurn(g, me, at, o))
    .filter((m): m is Moment => m !== null);
  return moments.sort((a, b) => b.gap - a.gap).slice(0, o.take ?? 3);
}
