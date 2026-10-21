/* The board lives with the moves: what the works breathe, how much runs
   on the lines laid, and how the light goes as an era draws to its close.
   Pure measures here, read by the ambiance (ambiance.ts, plumes.ts) —
   nothing in this file touches the GPU. */

import type { Era, GameState, IndustryType } from '@/game/types';

/** how much traffic runs on built links: none, a light trickle (one vehicle
 *  per link, moored most of the time) or the busy two-per-link parade */
export type TrafficLevel = 'none' | 'light' | 'busy';

/* ------------------------------ plumes ------------------------------ */

/** what a works gives off: a pit's and a furnace's soot, a brewery's steam,
 *  a mill's pale haze, a bottle kiln's haze over a glowing mouth */
export type PlumeKind = 'soot' | 'steam' | 'haze' | 'kiln';

export interface Plume {
  kind: PlumeKind;
  /** the smoke's colour (normal blend over the plaster) */
  tint: number;
  /** the densest a puff gets, before the zoom and the era's light */
  alpha: number;
  /** puffs in the column at once */
  count: number;
  /** seconds a puff takes from the chimney to nothing */
  life: number;
  /** how high the column climbs, world units */
  rise: number;
  /** a puff's size leaving the chimney, and at the end of its life */
  size0: number;
  size1: number;
  /** a glow at the chimney (a furnace's mouth, a kiln's crown), or none */
  glow: number | null;
  glowAlpha: number;
}

const PLUMES: Record<PlumeKind, Plume> = {
  /* coal smoke: brown-black, heavy, slow to rise and slow to thin */
  soot: { kind: 'soot', tint: 0x2b2622, alpha: 0.72, count: 10, life: 8, rise: 96, size0: 14, size1: 76, glow: null, glowAlpha: 0 },
  /* a copper's steam: white, quick to rise, gone in a breath */
  steam: { kind: 'steam', tint: 0xffffff, alpha: 0.85, count: 6, life: 3.8, rise: 56, size0: 10, size1: 44, glow: null, glowAlpha: 0 },
  /* a mill's engine house: a pale grey haze */
  haze: { kind: 'haze', tint: 0xf1ede5, alpha: 0.8, count: 8, life: 7, rise: 84, size0: 12, size1: 64, glow: null, glowAlpha: 0 },
  /* a bottle kiln: the haze of a firing over a warm crown */
  kiln: { kind: 'kiln', tint: 0xf3e7d3, alpha: 0.8, count: 8, life: 7, rise: 80, size0: 12, size1: 64, glow: 0xffa24c, glowAlpha: 0.32 },
};

/** the plume an industry gives off. Every works built breathes; one flipped
 *  (its goods sold, its seam or its stock worked out) keeps a calmer
 *  thread: fewer puffs, thinner. An ironworks' soot rises over the glow of
 *  its furnace. */
export function plumeFor(industry: IndustryType, flipped: boolean): Plume {
  const kind: PlumeKind = industry === 'coal' || industry === 'iron' ? 'soot' : industry === 'brewery' ? 'steam' : industry === 'pottery' ? 'kiln' : 'haze';
  const base = PLUMES[kind];
  const glow = industry === 'iron' ? 0xff7a2a : base.glow;
  const glowAlpha = industry === 'iron' ? 0.26 : base.glowAlpha;
  if (!flipped) return { ...base, glow, glowAlpha };
  return { ...base, glow, glowAlpha: glowAlpha * 0.6, count: Math.max(3, Math.round(base.count * 0.6)), alpha: base.alpha * 0.7, rise: base.rise * 0.85 };
}

/* ------------------------------ traffic ----------------------------- */

/** the links that carry traffic: the lines laid in the era the table is in
 *  (the canal era's boats leave with its links at the era change) */
export function trafficLinks(game: Pick<GameState, 'era' | 'links'>): string[] {
  const out: string[] = [];
  for (const id in game.links) if (game.links[id].era === game.era) out.push(id);
  return out;
}

/** how many vehicles may be under way at once, the maiden voyages of links
 *  just laid aside: a trickle that grows with the network up to a few at a
 *  time, or the busy parade kept to a dozen */
export function trafficCap(level: TrafficLevel, links: number): number {
  if (level === 'none' || links <= 0) return 0;
  if (level === 'light') return Math.min(4, 1 + Math.floor(links / 3));
  return Math.min(12, 2 * links);
}

/** the vehicle is let go on a new crossing when there is room on the lines,
 *  and always on the maiden voyage of the link it runs on */
export const admitCrossing = (underWay: number, cap: number, maiden: boolean): boolean => maiden || underWay < cap;

/** the vehicle a link carries: a barge in the canal era, a train in the rail */
export const vehicleFor = (era: Era): 'barge' | 'train' => (era === 'rail' ? 'train' : 'barge');

/* ------------------------------- dusk ------------------------------- */

/** rounds before the end of an era that the light starts to go */
export const DUSK_ROUNDS = 2;
/** the deepest the dusk gets while cards are still played */
export const DUSK_PLAYING = 0.75;
/** the dusk over the canal era's scoring */
export const DUSK_SCORING = 0.85;

/** rounds of play left in the era, counted in cards still to be played (the
 *  deck and every hand), two a seat a round; the round being played counts
 *  for what is left of it */
export function roundsLeft(game: Pick<GameState, 'deck' | 'players'>): number {
  let cards = game.deck.length;
  for (const p of game.players) cards += p.hand.length;
  return cards / (2 * Math.max(1, game.players.length));
}

/** how far the light has gone, 0 (full day) to 1 (night): nothing until the
 *  era's last two rounds, then deepening card by card to the last one; a
 *  deeper dusk over the canal's scoring; night once the game is over. The
 *  rail era opens on a new day. */
export function duskLevel(game: Pick<GameState, 'phase' | 'deck' | 'players'>): number {
  if (game.phase === 'game-over') return 1;
  if (game.phase === 'scoring-canal') return DUSK_SCORING;
  const left = roundsLeft(game);
  const p = Math.min(1, Math.max(0, (DUSK_ROUNDS - left) / DUSK_ROUNDS));
  /* the evening comes on quickly, then deepens slowly */
  return DUSK_PLAYING * Math.pow(p, 0.75);
}

/** the ground's colour at full night: a cool evening over the plaster */
export const EVENING = 0x858cad;

/** the tint laid over the ground at dusk `d` (white by day): the ground
 *  alone is tinted, so the links, the cards and the names keep their ink */
export function duskTint(d: number): number {
  const k = Math.min(1, Math.max(0, d));
  const ch = (shift: number) => Math.round(255 + (((EVENING >> shift) & 255) - 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/* --------------------------- tiles flipped -------------------------- */

/** more flips than this at once is a table being set, not one move */
export const FLIP_MAX = 8;

/** the tiles turned over between two states (a sale, a seam or a stock
 *  worked out). Nothing on the first sight of a table, going back in time,
 *  or when too many turn at once to be one move. */
export function freshFlips(prev: Pick<GameState, 'tiles' | 'actions'> | null, next: Pick<GameState, 'tiles' | 'actions'>): string[] {
  if (!prev || prev === next || next.actions.length < prev.actions.length) return [];
  const out: string[] = [];
  for (const key in next.tiles) {
    const t = next.tiles[key];
    const was = prev.tiles[key];
    if (t.flipped && was && !was.flipped && was.owner === t.owner && was.industry === t.industry && was.level === t.level) out.push(key);
  }
  return out.length > FLIP_MAX ? [] : out;
}
