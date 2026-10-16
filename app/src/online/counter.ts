/* ------------------------------------------------------------------ */
/* The counter: what the guineas earned at the tables can buy. Only    */
/* looks — a merchant's painted sign, a portrait, a set of tiles. The  */
/* office keeps the purse; this list is the same on both sides of the  */
/* wire. An id no longer on it (the rail paintings, withdrawn: the     */
/* board is the English model for everyone) may linger in an old       */
/* purse or outfit; both sides pass over it when they read.            */
/* ------------------------------------------------------------------ */

export type CounterKind = 'sign' | 'portrait' | 'tiles' | 'avatar' | 'frame' | 'title';

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
  { id: 'portrait-1', kind: 'portrait', price: 0 },
  { id: 'portrait-2', kind: 'portrait', price: 80 },
  { id: 'portrait-3', kind: 'portrait', price: 80 },
  { id: 'portrait-4', kind: 'portrait', price: 80 },
  { id: 'tiles-engraved', kind: 'tiles', price: 0 },
  { id: 'tiles-mono', kind: 'tiles', price: 60 },
  /* the member's card: an engraved avatar, a frame around it, a title under the name */
  { id: 'avatar-iron', kind: 'avatar', price: 0 },
  { id: 'avatar-brass', kind: 'avatar', price: 40 },
  { id: 'avatar-copper', kind: 'avatar', price: 40 },
  { id: 'avatar-enamel', kind: 'avatar', price: 90 },
  { id: 'avatar-gold', kind: 'avatar', price: 160 },
  { id: 'frame-none', kind: 'frame', price: 0 },
  { id: 'frame-fillet', kind: 'frame', price: 50 },
  { id: 'frame-rivets', kind: 'frame', price: 90 },
  { id: 'frame-gear', kind: 'frame', price: 150 },
  { id: 'frame-laurel', kind: 'frame', price: 220 },
  { id: 'title-none', kind: 'title', price: 0 },
  { id: 'title-founder', kind: 'title', price: 30 },
  { id: 'title-accountant', kind: 'title', price: 60 },
  { id: 'title-forgemaster', kind: 'title', price: 90 },
  { id: 'title-canalbaron', kind: 'title', price: 90 },
  { id: 'title-railmagnate', kind: 'title', price: 130 },
  { id: 'title-legend', kind: 'title', price: 260 },
];

export const COUNTER_BY_ID: Record<string, CounterItem> = Object.fromEntries(COUNTER.map((i) => [i.id, i]));

/** what a finished game pays: a sitting, more for the winner, twice for a ranked table */
export const GUINEAS = { sitting: 10, win: 25, rankedTimes: 2, challengeRule: 5, challengeAll: 15 } as const;

/** the items everyone owns without paying */
export const FREE_ITEMS = COUNTER.filter((i) => i.price === 0).map((i) => i.id);
