/* ------------------------------------------------------------------ */
/* The counter: what the guineas earned at the tables can buy. Only    */
/* looks — a merchant's painted sign, a painting under the rails, a    */
/* portrait, a set of tiles. The office keeps the purse; this list is  */
/* the same on both sides of the wire.                                 */
/* ------------------------------------------------------------------ */

export type CounterKind = 'sign' | 'painting' | 'portrait' | 'tiles';

export interface CounterItem {
  id: string;
  kind: CounterKind;
  /** in guineas; 0 is everyone's from the start */
  price: number;
}

export const COUNTER: CounterItem[] = [
  { id: 'sign-shrewsbury', kind: 'sign', price: 0 },
  { id: 'sign-oxford', kind: 'sign', price: 120 },
  { id: 'sign-gloucester', kind: 'sign', price: 120 },
  { id: 'sign-nottingham', kind: 'sign', price: 120 },
  { id: 'sign-warrington', kind: 'sign', price: 120 },
  { id: 'painting-rail-2', kind: 'painting', price: 0 },
  { id: 'painting-rail-1', kind: 'painting', price: 200 },
  { id: 'painting-rail-3', kind: 'painting', price: 200 },
  { id: 'portrait-1', kind: 'portrait', price: 0 },
  { id: 'portrait-2', kind: 'portrait', price: 80 },
  { id: 'portrait-3', kind: 'portrait', price: 80 },
  { id: 'portrait-4', kind: 'portrait', price: 80 },
  { id: 'tiles-engraved', kind: 'tiles', price: 0 },
  { id: 'tiles-mono', kind: 'tiles', price: 60 },
];

export const COUNTER_BY_ID: Record<string, CounterItem> = Object.fromEntries(COUNTER.map((i) => [i.id, i]));

/** what a finished game pays: a sitting, more for the winner, twice for a ranked table */
export const GUINEAS = { sitting: 10, win: 25, rankedTimes: 2 } as const;

/** the items everyone owns without paying */
export const FREE_ITEMS = COUNTER.filter((i) => i.price === 0).map((i) => i.id);
