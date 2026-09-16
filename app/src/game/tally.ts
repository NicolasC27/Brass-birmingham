import { applyAction, actorOf } from './actions';
import type { GameAction } from './actions';
import { newGame } from './engine';
import type { GameState, IndustryType, SetupPayload } from './types';

/* ------------------------------------------------------------------ */
/* The tally — what each seat did over a whole game, counted from the  */
/* ledger as the log is replayed (the state keeps only its last two    */
/* hundred lines, so the count is made action by action).             */
/* ------------------------------------------------------------------ */

export interface Tally {
  /** industry tiles laid, links laid, tiles sold, tiles developed away */
  built: number;
  links: number;
  sold: number;
  developed: number;
  loans: number;
  scouts: number;
  /** tiles flipped for their points, by whatever means */
  flipped: number;
  /** tiles laid, by industry */
  industries: Partial<Record<IndustryType, number>>;
  /** tiles laid, by town */
  towns: Record<string, number>;
  /** the purse and the income level as the game ended */
  money: number;
  income: number;
}

export const emptyTally = (): Tally => ({ built: 0, links: 0, sold: 0, developed: 0, loans: 0, scouts: 0, flipped: 0, industries: {}, towns: {}, money: 0, income: 0 });

/** the new lines of a ledger since `seen`, counted into the tallies */
function count(s: GameState, seen: number, tallies: Tally[]): number {
  let last = seen;
  for (const e of s.ledger) {
    if (e.id <= seen) continue;
    last = Math.max(last, e.id);
    if (e.player === undefined || !tallies[e.player]) continue;
    const tl = tallies[e.player];
    switch (e.verb) {
      case 'build': {
        tl.built += 1;
        const ind = e.vars?.industry as IndustryType | undefined;
        if (ind) tl.industries[ind] = (tl.industries[ind] ?? 0) + 1;
        if (e.region) tl.towns[e.region] = (tl.towns[e.region] ?? 0) + 1;
        break;
      }
      case 'network':
        tl.links += e.vars?.a2 ? 2 : 1;
        break;
      case 'sell':
        tl.sold += 1;
        break;
      case 'develop':
        tl.developed += 1;
        break;
      case 'loan':
        tl.loans += 1;
        break;
      case 'scout':
        tl.scouts += 1;
        break;
      case 'score':
        if (e.key === 'flip') tl.flipped += 1;
        break;
      default:
        break;
    }
  }
  return last;
}

/** every seat's tally over the game the log describes */
export function tallyGame(setup: SetupPayload, seed: number, actions: GameAction[]): Tally[] {
  let s = newGame(setup, seed);
  const tallies = s.players.map(() => emptyTally());
  let seen = count(s, -1, tallies);
  for (const a of actions) {
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) break;
    s = r.state;
    seen = count(s, seen, tallies);
  }
  s.players.forEach((p, i) => {
    tallies[i].money = p.money;
    tallies[i].income = p.income;
  });
  return tallies;
}
