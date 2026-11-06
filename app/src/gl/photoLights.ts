/* The photo mode's lights: where the table is read — a town's cards and
   its name, a merchant's row and its name — so a look that dims or washes
   the country can leave them legible: the night lights them as by a lamp,
   the watercolour draws them with the pen. Pure measures here, read by
   photo.ts — nothing in this file touches the GPU. */

import { MERCHANTS, TOWNS } from '@/game/data';
import { RIBBON_GAP, RIBBON_H, ribbonWidth, townChrome } from '@/components/game/townChrome';
import { MT, ROW_SCALE, rowLift, rowWidth } from './merchantRow';

/** the most places a look can light (the shader's array) */
export const MAX_LIGHTS = 48;

/** the swallowtails of a name stand this far past its bar */
const TAILS = 14;
/** the roofs behind a town's cards stand this far over them */
const ROOFS = 22;

/** a place that is read, in world units: its centre and its half sizes */
export interface LitBox {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

const box = (x0: number, y0: number, x1: number, y1: number): LitBox => ({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2 });

/** every place read on the table: the towns' blocks and the merchants'
 *  rows, each with the name under it. The names are counter-scaled with
 *  the zoom (`ribbonScale`), about their own centre */
export function litBoxes(ribbonScale = 1): LitBox[] {
  const out: LitBox[] = [];
  const rh = (RIBBON_H / 2) * ribbonScale;
  for (const town of TOWNS) {
    const c = townChrome(town);
    const hw = Math.max(c.blockW / 2, (c.ribbonW / 2 + TAILS) * ribbonScale);
    const top = c.ribbonCy - RIBBON_H / 2 - RIBBON_GAP - c.blockH - ROOFS;
    out.push(box(c.ax - hw, top, c.ax + hw, c.ribbonCy + rh));
  }
  for (const m of MERCHANTS) {
    const py = m.y - rowLift(m);
    const hw = Math.max((rowWidth(m.slots) * ROW_SCALE) / 2, (ribbonWidth(m.name.toUpperCase()) / 2 + TAILS) * ribbonScale);
    const ribbonCy = py + (MT / 2 + RIBBON_GAP + RIBBON_H / 2 + 2) * ROW_SCALE;
    out.push(box(m.x - hw, py - (MT / 2) * ROW_SCALE - ROOFS, m.x + hw, ribbonCy + rh));
  }
  return out.slice(0, MAX_LIGHTS);
}
