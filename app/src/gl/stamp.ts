/* The printer's stamp: a tile or a link laid on the table comes down like
   a block on the platen. A breath above the paper, then pressed a hair too
   far, then back to its own size, while a little ink squeezed out at the
   edges dries away. The whole gesture keeps under a third of a second, so
   the machines' pace is never waited on. Pure measures here; the ticker
   (PixiBoard) applies them. */

import type { GameState } from '@/game/types';

/** the whole gesture, in seconds */
export const STAMP_S = 0.3;
/** the moment the block meets the paper */
export const STAMP_IMPACT_S = 0.11;
/** more than this many new pieces at once is a table being set (a game
 *  opened, a replay jumped): the press stays still */
export const STAMP_MAX = 4;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** the card's scale and opacity `t` seconds into the gesture: it falls from
 *  a little above (larger, half seen), presses in a touch under its size,
 *  springs a hair over, and settles */
export function stampPose(t: number): { scale: number; alpha: number } {
  if (t >= STAMP_S) return { scale: 1, alpha: 1 };
  if (t <= STAMP_IMPACT_S) {
    const p = clamp01(t / STAMP_IMPACT_S);
    /* falling: the approach quickens */
    return { scale: lerp(1.1, 0.965, p * p), alpha: lerp(0.35, 1, p) };
  }
  const rebound = 0.2;
  if (t <= rebound) {
    const p = clamp01((t - STAMP_IMPACT_S) / (rebound - STAMP_IMPACT_S));
    /* the paper gives the block back: fast, then easing */
    return { scale: lerp(0.965, 1.012, 1 - (1 - p) * (1 - p)), alpha: 1 };
  }
  const p = clamp01((t - rebound) / (STAMP_S - rebound));
  return { scale: lerp(1.012, 1, p), alpha: 1 };
}

/** how far the ink squeezed out at the edges has run (0 → 1) and how much
 *  of it is still wet (1 → 0), `t` seconds into the gesture; nothing
 *  before the block meets the paper */
export function inkBloom(t: number): { spread: number; wet: number } {
  if (t < STAMP_IMPACT_S || t >= STAMP_S) return { spread: t >= STAMP_S ? 1 : 0, wet: 0 };
  const p = clamp01((t - STAMP_IMPACT_S) / (STAMP_S - STAMP_IMPACT_S));
  return { spread: 1 - (1 - p) * (1 - p) * (1 - p), wet: 1 - p };
}

/** what was laid on the table between two states: the slots struck
 *  (a new tile, or one built over) and the links laid. Nothing when there
 *  is no earlier table, when the table went back in time, or when too much
 *  arrived at once to be one move. */
export function freshPieces(prev: GameState | null, next: GameState): { tiles: string[]; links: string[] } {
  const none = { tiles: [], links: [] };
  if (!prev || prev === next) return none;
  /* the book read backwards (an undo, a replay stepped back): what comes
     back onto the table was struck long ago */
  if (next.actions.length < prev.actions.length) return none;
  const tiles: string[] = [];
  for (const [key, t] of Object.entries(next.tiles)) {
    const was = prev.tiles[key];
    if (!was || was.owner !== t.owner || was.industry !== t.industry || was.level !== t.level) tiles.push(key);
  }
  const links = Object.keys(next.links).filter((id) => !prev.links[id]);
  return tiles.length + links.length > STAMP_MAX ? none : { tiles, links };
}
