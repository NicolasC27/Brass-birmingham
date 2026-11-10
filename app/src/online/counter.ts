/* ------------------------------------------------------------------ */
/* The counter: what the guineas earned at the tables can buy. Only    */
/* the table's looks — a set of tiles, the hand's cards, the ground    */
/* under the board. The office keeps the purse; this list is the same  */
/* on both sides of the wire. An id no longer on it (the rail          */
/* paintings, then the signs, portraits, avatars, frames and titles,   */
/* all withdrawn) may linger in an old purse or outfit; both sides     */
/* pass over it when they read.                                        */
/* ------------------------------------------------------------------ */

export type CounterKind = 'tiles' | 'cards' | 'ground';

export interface CounterItem {
  id: string;
  kind: CounterKind;
  /** in guineas; 0 is everyone's from the start */
  price: number;
}

export const COUNTER: CounterItem[] = [
  { id: 'tiles-engraved', kind: 'tiles', price: 0 },
  { id: 'tiles-mono', kind: 'tiles', price: 60 },
  /* the painted subjects with a light touch of winter */
  { id: 'tiles-frost', kind: 'tiles', price: 120 },
  /* the hand's location cards: the engravings as they are, or under snow */
  { id: 'cards-plain', kind: 'cards', price: 0 },
  { id: 'cards-frost', kind: 'cards', price: 90 },
  /* the ground under the board: the English model for everyone, and the
     frozen city — the Midlands under the ice, with its own weather */
  { id: 'ground-midlands', kind: 'ground', price: 0 },
  { id: 'ground-frost', kind: 'ground', price: 200 },
];

export const COUNTER_BY_ID: Record<string, CounterItem> = Object.fromEntries(COUNTER.map((i) => [i.id, i]));

/** what a finished game pays: a sitting, more for the winner, twice for a ranked table */
export const GUINEAS = { sitting: 10, win: 25, rankedTimes: 2, challengeRule: 5, challengeAll: 15 } as const;

/** the items everyone owns without paying */
export const FREE_ITEMS = COUNTER.filter((i) => i.price === 0).map((i) => i.id);
