/* A merchant's row on the table: its tiles, a gap and the medallion, set
   on the node at 1.45 and lifted clear of the hand for the southern ones.
   One measure for the press (paint.ts), the pointer (PixiBoard) and the
   supply threads that start at a barrel (provenance.ts). */

import type { MERCHANTS } from '@/game/data';

type Merchant = (typeof MERCHANTS)[number];

/** a merchant tile's side, in the row's own units */
export const MT = 46;
/** the gap between two merchant tiles */
export const MT_GAP = 10;
/** the medallion's radius */
export const MEDAL_R = 21;
/** the row is printed at this scale on the table */
export const ROW_SCALE = 1.45;

/** the southern merchants sit on the map's bottom edge: their row rides
 *  this far above the node, so the hand never hides it */
export const rowLift = (m: Pick<Merchant, 'y'>): number => (m.y > 1500 ? 34 : 0);

/** the row's width, tiles, gap and medallion, in its own units */
export const rowWidth = (slots: number): number => slots * MT + (slots - 1) * MT_GAP + 14 + MEDAL_R * 2;

/** the centre of tile `i` along the row, in its own units */
export const rowSlotX = (slots: number, i: number): number => -rowWidth(slots) / 2 + MT / 2 + i * (MT + MT_GAP);

/** where the barrel of tile `i` stands, in the row's own units: at the
 *  tile's foot, a little in from its right edge */
export const barrelLocal = (slots: number, i: number): [number, number] => [rowSlotX(slots, i) + MT / 2 - 6, MT / 2 + 2];

/** the barrel of tile `i`, in world units */
export function barrelAt(m: Pick<Merchant, 'x' | 'y' | 'slots'>, i: number): [number, number] {
  const [bx, by] = barrelLocal(m.slots, i);
  return [m.x + bx * ROW_SCALE, m.y - rowLift(m) + by * ROW_SCALE];
}
