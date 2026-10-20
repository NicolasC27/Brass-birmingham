import { eraRounds, incomeLevel } from '@/game/data';
import type { GameState, IndustryType } from '@/game/types';

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

/** below this a purse builds little: a loan taken with less was for want of money */
export const LOW_PURSE = 15;

/** the words for a machine's loan, told by the purse it was taken from:
 *  its last card of a short game borrows for the close, a thin purse for
 *  want of money, a full one to build dear without waiting for payday */
export function loanWords(g: GameState, seat: number, purse: number): 'loanClose' | 'loanLow' | 'loanAhead' {
  if (g.eraLength === 'short' && g.deck.length === 0 && g.players[seat].hand.length === 0) return 'loanClose';
  return purse < LOW_PURSE ? 'loanLow' : 'loanAhead';
}

/** a tile of the reader's, named by the era's last words */
export interface Named {
  industry: IndustryType;
  town: string;
}

/** what the guide says as the canal era draws to its close, from the round
 *  before its last: a full game warns of the sweep of the level-1 tiles, a
 *  short one of what its close counts, since no sweep comes. The reader's
 *  tiles concerned are named when there are any — the level-1 ones the
 *  sweep will take, or, in a short game, every tile still unflipped,
 *  whatever its level: it will score nothing */
export function closingWords(g: GameState, me: number): { era: string; mine: { key: string; tiles: Named[]; unflipped: number } | null } | null {
  if (g.era !== 'canal' || g.round < eraRounds(g.players.length) - 1) return null;
  const mine = Object.entries(g.tiles).filter(([, x]) => x.owner === me);
  const named = (list: typeof mine): Named[] => list.map(([key, x]) => ({ industry: x.industry, town: key.split(':')[0] }));
  if (g.eraLength === 'short') {
    const open = mine.filter(([, x]) => !x.flipped);
    return { era: 'eraEndShort', mine: open.length ? { key: 'eraEndMineShort', tiles: named(open), unflipped: open.length } : null };
  }
  const doomed = mine.filter(([, x]) => x.level === 1);
  const unflipped = doomed.filter(([, x]) => !x.flipped).length;
  return { era: 'eraEnd', mine: doomed.length ? { key: unflipped ? 'eraEndMine' : 'eraEndMineFlipped', tiles: named(doomed), unflipped } : null };
}
