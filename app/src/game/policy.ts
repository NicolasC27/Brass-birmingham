/* ------------------------------------------------------------------ */
/* BLACKRAIL — naming the moves.                                       */
/*                                                                     */
/* The search knows how to list what a seat may do; it has no idea     */
/* which of those hundred moves is worth a second thought. To learn    */
/* that, a move must first have a name the same in every game — an     */
/* index in a fixed vector — so that a network can be asked how much   */
/* each one is worth looking at, and told afterwards how wrong it was. */
/*                                                                     */
/* The naming is deliberately coarser than the move itself. Two builds */
/* of the same industry in the same town, paid with different cards,   */
/* are the same idea; so are a development with the market's iron and  */
/* one with a cube from one's own works. They share a name, and the    */
/* search tells them apart afterwards by reading the table. What the   */
/* name keeps is what a player would say out loud: cotton in Bolton,   */
/* the link to Stoke, sell the pottery, take a loan.                   */
/* ------------------------------------------------------------------ */

import type { GameAction } from './actions';
import { LINKS, TOWNS } from './data';
import type { IndustryType } from './types';

/** the industries in the order the features and the policy count them */
export const INDUSTRY_ORDER: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];

const TOWN_AT: Record<string, number> = Object.fromEntries(TOWNS.map((t, k) => [t.id, k]));
const LINK_AT: Record<string, number> = Object.fromEntries(LINKS.map((l, k) => [l.id, k]));
const INDUSTRY_AT: Record<string, number> = Object.fromEntries(INDUSTRY_ORDER.map((ind, k) => [ind, k]));

const TOWNS_N = TOWNS.length;
const LINKS_N = LINKS.length;
const INDUSTRIES_N = INDUSTRY_ORDER.length;

/* where each family of moves begins in the vector */
export const BUILD_AT = 0;
export const LINK_ONE_AT = BUILD_AT + TOWNS_N * INDUSTRIES_N;
export const LINK_TWO_AT = LINK_ONE_AT + LINKS_N;
export const SELL_ALL_AT = LINK_TWO_AT + LINKS_N;
export const SELL_ONE_AT = SELL_ALL_AT + 1;
export const DEVELOP_ONE_AT = SELL_ONE_AT + TOWNS_N;
export const DEVELOP_TWO_AT = DEVELOP_ONE_AT + INDUSTRIES_N;
export const LOAN_AT = DEVELOP_TWO_AT + INDUSTRIES_N;
export const SCOUT_AT = LOAN_AT + 1;
export const PASS_AT = SCOUT_AT + 1;

/** how many names there are */
export const ACTIONS = PASS_AT + 1;

/** the index of a move, or -1 for one the policy does not name (the
 *  engine's own book-keeping moves: beginning the rails, conceding) */
export function actionIndex(a: GameAction): number {
  switch (a.kind) {
    case 'build': {
      const town = TOWN_AT[a.town];
      const ind = INDUSTRY_AT[a.industry];
      return town === undefined || ind === undefined ? -1 : BUILD_AT + town * INDUSTRIES_N + ind;
    }
    case 'network': {
      const link = LINK_AT[a.link];
      if (link === undefined) return -1;
      return (a.second ? LINK_TWO_AT : LINK_ONE_AT) + link;
    }
    case 'sell': {
      if (a.sales.length !== 1) return SELL_ALL_AT;
      const town = TOWN_AT[a.sales[0].town];
      return town === undefined ? SELL_ALL_AT : SELL_ONE_AT + town;
    }
    case 'develop': {
      const ind = INDUSTRY_AT[a.industries[0]];
      if (ind === undefined) return -1;
      return (a.industries.length > 1 ? DEVELOP_TWO_AT : DEVELOP_ONE_AT) + ind;
    }
    case 'loan':
      return LOAN_AT;
    case 'scout':
      return SCOUT_AT;
    case 'pass':
      return PASS_AT;
    default:
      return -1;
  }
}

/** a move's name in words, for the logs and the learner's reports */
export function actionName(at: number): string {
  if (at < 0 || at >= ACTIONS) return '?';
  if (at < LINK_ONE_AT) {
    const k = at - BUILD_AT;
    return `build ${INDUSTRY_ORDER[k % INDUSTRIES_N]} in ${TOWNS[Math.floor(k / INDUSTRIES_N)].id}`;
  }
  if (at < LINK_TWO_AT) return `link ${LINKS[at - LINK_ONE_AT].id}`;
  if (at < SELL_ALL_AT) return `double link ${LINKS[at - LINK_TWO_AT].id}`;
  if (at === SELL_ALL_AT) return 'sell everything';
  if (at < DEVELOP_ONE_AT) return `sell in ${TOWNS[at - SELL_ONE_AT].id}`;
  if (at < DEVELOP_TWO_AT) return `develop ${INDUSTRY_ORDER[at - DEVELOP_ONE_AT]}`;
  if (at < LOAN_AT) return `develop ${INDUSTRY_ORDER[at - DEVELOP_TWO_AT]} twice`;
  if (at === LOAN_AT) return 'loan';
  if (at === SCOUT_AT) return 'scout';
  return 'pass';
}
