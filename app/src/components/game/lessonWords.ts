import { incomeLevel } from '@/game/data';
import type { GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The words a lesson is said in. The guided game is a short one — the */
/* canal era alone, closed on a bonus — and some lessons read otherwise */
/* there: the purse and the income level count at the close, and no     */
/* sweep ever comes. A lesson keeps its id; its entry in the dictionary */
/* changes. Pure: the guide and the evening course both read it.        */
/* ------------------------------------------------------------------ */

/** the lessons a short game tells in words of its own */
const SHORT: Readonly<Record<string, string>> = {
  goal: 'goalShort',
  loan: 'loanShort',
  eraEnd: 'eraEndShort',
};

/** a lesson's entry in a short game — the guided game is one */
export const shortKeyOf = (id: string): string => SHORT[id] ?? id;

/** the lesson's entry in the dictionary: some lessons read otherwise in
 *  debt, or in a short game */
export function stepKeyOf(id: string, g: GameState, me: number): string {
  if (id === 'payday') return incomeLevel(g.players[me].income) < 0 ? 'paydayOwed' : 'payday';
  return g.eraLength === 'short' ? shortKeyOf(id) : id;
}
