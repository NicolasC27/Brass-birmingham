/* ------------------------------------------------------------------ */
/* What a line of play is still worth, and what it still costs.        */
/*                                                                     */
/* The machines read a position and play the move that reads best. It  */
/* serves them well while a move pays on its own, and badly when the   */
/* points sit three actions away: strong players clear five level-one  */
/* tiles off a mat before laying a single one that scores, and every   */
/* one of those five actions reads as a loss. So the mats end our      */
/* games barely started — cotton's next tile at level 1.3 of four —    */
/* and the tiles worth having are never reached. The gap to a strong   */
/* human grows by thirteen points for every four extra actions a game  */
/* affords, which is the same fact said another way: the machines do   */
/* not know what to do with room.                                      */
/*                                                                     */
/* A line here is a set of tiles, never an order and never a promise.  */
/* Asked of a position, it answers one number: what the tiles still    */
/* missing would pay, less the actions still standing between the seat */
/* and their sale, charged at what an action is worth. Nothing is      */
/* stored between turns, nothing is forbidden, and a line the board or */
/* the hand has closed is worth zero at the very next reading — which  */
/* is the whole difference from an opening book, which struck moves    */
/* off the list and cost fifteen points for it.                        */
/* ------------------------------------------------------------------ */

import { INDUSTRIES, TOWNS } from './data';
import { merchantDemand, merchantOpen, networkTowns, reachable } from './engine';
import type { GameState, IndustryType } from './types';

/** one leg of a line: a tile of this industry at this level */
export interface Leg {
  industry: IndustryType;
  level: number;
}

export interface Chain {
  name: string;
  legs: Leg[];
  /** the seats this line is meant for; every table when absent */
  seats?: number[];
}

/* The lines two independent strategy sources name. Each is a set of tiles
   that pay together; the order is the search's business, not ours. */
export const CHAINS: Chain[] = [
  {
    name: 'manufactures',
    seats: [3, 4],
    legs: [
      { industry: 'manufacturer', level: 2 },
      { industry: 'manufacturer', level: 2 },
      { industry: 'brewery', level: 2 },
      { industry: 'brewery', level: 2 },
    ],
  },
  {
    name: 'big cotton',
    seats: [2, 3],
    legs: [
      { industry: 'cotton', level: 3 },
      { industry: 'cotton', level: 3 },
      { industry: 'cotton', level: 3 },
    ],
  },
  {
    name: 'small cotton',
    legs: [
      { industry: 'cotton', level: 2 },
      { industry: 'cotton', level: 2 },
      { industry: 'brewery', level: 2 },
    ],
  },
  {
    name: 'pottery',
    legs: [
      { industry: 'pottery', level: 3 },
      { industry: 'brewery', level: 2 },
    ],
  },
];

/** tiles that must come off a mat before the named level can be built */
function toClear(s: GameState, seat: number, industry: IndustryType, level: number): number {
  const stack = s.players[seat].stacks[industry];
  let k = 0;
  while (k < stack.length && stack[k] < level) k += 1;
  return k;
}

/** empty slots on the board that would take this industry */
function roomFor(s: GameState, industry: IndustryType): number {
  let free = 0;
  for (const town of TOWNS) {
    for (const [k, slot] of town.slots.entries()) {
      if (!slot.allows.includes(industry)) continue;
      if (!s.tiles[`${town.id}:${k}`]) free += 1;
    }
  }
  return free;
}

/** a buyer this seat can reach who wants this industry */
function hasBuyer(s: GameState, seat: number, industry: IndustryType): boolean {
  for (const town of networkTowns(s, seat)) {
    for (const n of reachable(s, town, s.era, null)) {
      if (merchantOpen(s, n) && merchantDemand(s, n).includes(industry)) return true;
    }
  }
  return false;
}

/** how much of the hand speaks to this line: a location card naming a town
 *  with room for one of its industries, or any wild. Never zero, since a
 *  card drawn next turn may open it. */
function cardOk(s: GameState, seat: number, legs: Leg[]): number {
  const wanted = new Set(legs.map((l) => l.industry));
  let speak = 0;
  for (const c of s.players[seat].hand) {
    if (c.kind === 'wild-location' || c.kind === 'wild-industry') {
      speak += 1;
      continue;
    }
    if (c.industry && wanted.has(c.industry)) {
      speak += 1;
      continue;
    }
    if (!c.town) continue;
    const town = TOWNS.find((t) => t.id === c.town);
    if (!town) continue;
    for (const [k, slot] of town.slots.entries()) {
      if (s.tiles[`${town.id}:${k}`]) continue;
      if (slot.allows.some((x) => wanted.has(x))) {
        speak += 1;
        break;
      }
    }
  }
  const hand = Math.max(1, s.players[seat].hand.length);
  return 0.25 + 0.75 * Math.min(1, speak / Math.min(3, hand));
}

/** how many of a line's legs already stand for this seat, flipped or not */
function legsStanding(s: GameState, seat: number, legs: Leg[]): number {
  const want = new Map<string, number>();
  for (const l of legs) want.set(`${l.industry}:${l.level}`, (want.get(`${l.industry}:${l.level}`) ?? 0) + 1);
  let have = 0;
  for (const t of Object.values(s.tiles)) {
    if (t.owner !== seat) continue;
    const key = `${t.industry}:${t.level}`;
    const left = want.get(key);
    if (!left) continue;
    want.set(key, left - 1);
    have += 1;
  }
  return have;
}

/** what a line still pays this seat, less the actions it still costs.
 *  Zero when the board, the mats, the purse or the clock have closed it. */
export function chainSurplus(s: GameState, seat: number, actionRate: number, actionsLeft: number): { best: number; name: string } {
  let best = 0;
  let name = '';
  for (const chain of CHAINS) {
    if (chain.seats && !chain.seats.includes(s.players.length)) continue;
    const standing = legsStanding(s, seat, chain.legs);
    const missing = chain.legs.length - standing;
    if (missing <= 0) continue;
    let pay = 0;
    let actions = 0;
    let shut = false;
    const cleared = new Set<IndustryType>();
    for (const [k, leg] of chain.legs.entries()) {
      if (k < standing) continue;
      const lv = INDUSTRIES[leg.industry][leg.level - 1];
      if (!lv || !lv.eras.includes(s.era)) {
        shut = true;
        break;
      }
      if (roomFor(s, leg.industry) < 1) {
        shut = true;
        break;
      }
      /* the tile pays its points, twice over when the canals still stand and
         it will survive the sweep, and a sold tile needs a buyer to sell to */
      const twice = s.era === 'canal' && s.eraLength === 'standard' && lv.eras.includes('rail') ? 2 : 1;
      pay += lv.vp * twice;
      /* the mat has to be walked down to it, two tiles an action */
      if (!cleared.has(leg.industry)) {
        cleared.add(leg.industry);
        actions += Math.ceil(toClear(s, seat, leg.industry, leg.level) / 2);
      }
      actions += 1;
      if (lv.beerToSell > 0 && !hasBuyer(s, seat, leg.industry)) actions += 1;
    }
    if (shut) continue;
    /* the sale that turns them over, once for the lot */
    actions += 1;
    if (actions > actionsLeft) continue;
    const surplus = (pay - actions * actionRate) * cardOk(s, seat, chain.legs);
    if (surplus > best) {
      best = surplus;
      name = chain.name;
    }
  }
  return { best, name };
}
