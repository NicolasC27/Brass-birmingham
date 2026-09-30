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
import { LINKS, onBoardChange, TOWNS } from './data';
import { forwardAll, pack, unpack } from './net';
import type { Net } from './net';
import { POLICY_B64 } from './policy-weights';
import type { IndustryType } from './types';

/** the industries in the order the names count them. Kept here rather than
 *  borrowed from the reading network: once a policy is trained these names
 *  must never shift, and a change to the features must not rename a move. */
export const INDUSTRY_ORDER: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];

let TOWN_AT: Record<string, number> = Object.fromEntries(TOWNS.map((t, k) => [t.id, k]));
let LINK_AT: Record<string, number> = Object.fromEntries(LINKS.map((l, k) => [l.id, k]));
/* another board names other towns in another order: the tables follow it.
   The offsets below do not, and need not while every board carries the same
   count of towns and links — `nameable` says so out loud if one ever does not */
onBoardChange(() => {
  TOWN_AT = Object.fromEntries(TOWNS.map((t, k) => [t.id, k]));
  LINK_AT = Object.fromEntries(LINKS.map((l, k) => [l.id, k]));
});
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

/** does the board in play fit the vector the policies were trained on? A
 *  board of another size would silently rename every move. */
export const nameable = (): boolean => TOWNS.length === TOWNS_N && LINKS.length === LINKS_N;

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

/* =========================== ranking them ========================== */

/* A second network reads the same table as the one that scores it, but
 * answers with one number per name: how much a good player would want
 * to play that move. Trained first to say what the search says — the
 * cheap way to find out whether the naming holds — it later learns
 * from a search that thinks in trees rather than in pairs.
 *
 * Where several moves share a name, the name's share is split between
 * them: the network ranks ideas, the search picks the wording. */

/** how much a network trusts a move it has never been shown */
const FLOOR = 1e-6;

/** the ranking a policy gives the moves on offer, summing to one */
export function priors(policy: Net, x: Float32Array, legal: GameAction[]): Float32Array {
  const out = new Float32Array(legal.length);
  if (!legal.length) return out;
  const logits = forwardAll(policy, x);
  const at = legal.map(actionIndex);
  /* how many moves carry each name, to share the name's worth between them */
  const sharing = new Map<number, number>();
  for (const k of at) if (k >= 0) sharing.set(k, (sharing.get(k) ?? 0) + 1);
  let top = -Infinity;
  for (const k of at) if (k >= 0 && logits[k] > top) top = logits[k];
  if (top === -Infinity) {
    out.fill(1 / legal.length);
    return out;
  }
  let sum = 0;
  for (let m = 0; m < legal.length; m++) {
    const k = at[m];
    const p = k < 0 ? FLOOR : Math.exp(logits[k] - top) / (sharing.get(k) ?? 1);
    out[m] = p;
    sum += p;
  }
  for (let m = 0; m < legal.length; m++) out[m] /= sum;
  return out;
}

/** a policy is only as good as the features and the names it was trained
 *  on. One trained on fewer features is widened to ignore the newcomers —
 *  a weight of nought for each, which leaves its ranking exactly as it
 *  was — so that adding a feature costs no ranking while a fresh record
 *  is written. That holds only while features are appended and never
 *  inserted. One that names a different set of moves is left aside: a
 *  name is the thing being learned and cannot be guessed at. */
function widen(policy: Net, want: number): Net {
  const had = policy.sizes[0];
  const units = policy.sizes[1];
  const weights = new Float32Array(want * units);
  for (let o = 0; o < units; o++) weights.set(policy.weights[0].subarray(o * had, (o + 1) * had), o * want);
  const mean = new Float32Array(want);
  const scale = new Float32Array(want).fill(1);
  mean.set(policy.mean.subarray(0, had));
  scale.set(policy.scale.subarray(0, had));
  return { ...policy, sizes: [want, ...policy.sizes.slice(1)], weights: [weights, ...policy.weights.slice(1)], mean, scale };
}

function fitting(policy: Net | null, featureCount: number): Net | null {
  if (!policy) return null;
  const wide = policy.sizes[0] < featureCount ? widen(policy, featureCount) : policy;
  if (wide.sizes[0] !== featureCount || wide.sizes[wide.sizes.length - 1] !== ACTIONS) {
    console.warn(`a policy of ${policy.sizes[0]}→${policy.sizes[policy.sizes.length - 1]} cannot rank ${featureCount}→${ACTIONS} moves: ranking by hand`);
    return null;
  }
  return wide;
}

let active: Net | null = null;
let wanted = 0;

/** the policy in force, once told how many features the board offers */
export function activePolicy(featureCount: number): Net | null {
  if (wanted !== featureCount) {
    wanted = featureCount;
    active = fitting(POLICY_B64 ? unpack(POLICY_B64) : null, featureCount);
  }
  return active;
}

/** a freshly trained policy takes over (the learner, the arena) */
export function setPolicy(policy: Net | null, featureCount: number): void {
  wanted = featureCount;
  active = fitting(policy, featureCount);
}

export const packPolicy = (policy: Net): string => pack(policy);
export const unpackPolicy = (text: string): Net => unpack(text);

/** the moves worth a search's time: those whose name the policy puts among
 *  its `names` best. A name kept brings every move that carries it, since
 *  the policy cannot tell them apart and the search can. */
export function keepBest(policy: Net, x: Float32Array, legal: GameAction[], names: number): GameAction[] {
  if (names <= 0 || legal.length <= names) return legal;
  const at = legal.map(actionIndex);
  const distinct = [...new Set(at.filter((k) => k >= 0))];
  if (distinct.length <= names) return legal;
  const logits = forwardAll(policy, x);
  distinct.sort((a, b) => logits[b] - logits[a]);
  const kept = new Set(distinct.slice(0, names));
  const out = legal.filter((_, m) => at[m] < 0 || kept.has(at[m]));
  return out.length ? out : legal;
}
