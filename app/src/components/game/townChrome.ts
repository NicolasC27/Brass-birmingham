import { TOWNS, TOWN_BY_ID } from '@/game/data';
import type { IndustryType, Town } from '@/game/types';
import { WORLD_H, WORLD_W } from './boardView';

/* ------------------------------------------------------------------ */
/* townChrome — shared geometry/art constants for the map-v5 towns     */
/* (kept component-free so react-refresh fast refresh stays happy).    */
/*                                                                     */
/* Each town is ONE compact physical unit (official Steam reference):  */
/* slot tiles in a tight grid (5px gap) centred on the town anchor,    */
/* the name ribbon flush directly below the tile block, and a small    */
/* painted village grounding the unit. A deterministic collision pass  */
/* nudges whole clusters (≤64px, ribbon + tiles glued together) until  */
/* every pair of cluster boxes clears by ≥18px (v13: maximum air —     */
/* 56px tiles in a 3200×1800 world, ribbon wider than the block,       */
/* brassforge-style small islands with generous spacing).              */
/* ------------------------------------------------------------------ */

/** industry identity colours (v8: edge stripes + corner glyphs on slots) */
export const INDUSTRY_COLOR: Record<IndustryType, string> = {
  coal: '#232323',
  iron: '#E07020',
  cotton: '#C23B3B',
  manufacturer: '#7A5BA6',
  pottery: '#D9B25F',
  brewery: '#4E7A4E',
};

export const TILE = 68;
export const TILE_HALF = TILE / 2;
/** gap between adjacent slot tiles inside a cluster (v13: 6 → 5) */
export const TILE_GAP = 5;
export const RIBBON_H = 22;
/** flush gap between tile block bottom and ribbon top */
export const RIBBON_GAP = 4;

const PITCH = TILE + TILE_GAP;
/** swallowtail ribbon ends stick out this far past the bar */
const RIBBON_TAIL = 11;
/** bbox slack: absorbs the ±1.5° cluster rotation + hover rings */
const BOX_PAD = 5;
/** collision pass: whole-cluster nudges never exceed this magnitude
 *  (v12: raised 40 → 64 so dense networks — Birmingham/Redditch/Tamworth —
 *  can reach the solid-box clearance (v13: 18px) without moving authentic anchors) */
const MAX_NUDGE = 64;
/** target clearance between two towns' solid boxes (tiles + ribbon + tails)
 *  after the collision pass (v13: 14px → 18px — the air is the point) */
const CLEARANCE = 18;

/**
 * Tight slot-grid offsets per town slot-count (relative to the tile
 * block centre): 1 tile single · 2 side-by-side · 3 = row of 2 over 1
 * centred · 4 = 2×2. Slot indices keep board order (L→R, top→bottom),
 * so `tileKey(town, si)` addressing is unchanged.
 */
const GRID: Record<number, readonly [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-PITCH / 2, 0],
    [PITCH / 2, 0],
  ],
  3: [
    [-PITCH / 2, -PITCH / 2],
    [PITCH / 2, -PITCH / 2],
    [0, PITCH / 2],
  ],
  4: [
    [-PITCH / 2, -PITCH / 2],
    [PITCH / 2, -PITCH / 2],
    [-PITCH / 2, PITCH / 2],
    [PITCH / 2, PITCH / 2],
  ],
};

function blockSize(n: number): { bw: number; bh: number } {
  const cols = n <= 1 ? 1 : 2;
  const rows = n <= 2 ? 1 : 2;
  return { bw: cols * TILE + (cols - 1) * TILE_GAP, bh: rows * TILE + (rows - 1) * TILE_GAP };
}

function townLabel(town: Town): string {
  return (town.farm ? `${town.name} (${town.id === 'farm-n' ? 'N' : 'S'})` : town.name).toUpperCase();
}

/* IM Fell English SC caps average advance, as a fraction of font size */
const CHAR_W = 0.68;
/** letter-spacing baked into the width estimate (matches RibbonShape) */
const RIBBON_LS = 1;
const RIBBON_PAD = 24;

/**
 * v8 polish: ONE fixed type size for EVERY name plate on the map —
 * towns, farm breweries and merchants all share the same family, size,
 * weight, caps and letter-spacing. The ribbon WIDENS to fit its text
 * (overflowing the tile block symmetrically, like the Steam game); the
 * text never shrinks or stretches to fit the block.
 */
export const RIBBON_FONT = 12;
export function ribbonWidth(label: string): number {
  return Math.ceil(label.length * (CHAR_W * RIBBON_FONT + RIBBON_LS) + RIBBON_PAD);
}

/** tiny deterministic whole-cluster rotation (±1.5°) for organic feel */
function clusterRot(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.5;
}

/* ----------------------- cluster collision pass --------------------- */

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** tiles + ribbon (incl. tails) box centred on the AUTHENTIC anchor */
function baseBox(t: Town): Box {
  const { bw, bh } = blockSize(t.slots.length);
  const w = ribbonWidth(townLabel(t));
  const halfW = Math.max(bw, w) / 2 + RIBBON_TAIL + BOX_PAD;
  const halfH = (bh + RIBBON_GAP + RIBBON_H) / 2 + BOX_PAD;
  return { x0: t.x - halfW, y0: t.y - halfH, x1: t.x + halfW, y1: t.y + halfH };
}

function clampNudge(t: Town, n: { dx: number; dy: number }): { dx: number; dy: number } {
  const b = baseBox(t);
  // never push a cluster off the world surface
  n.dx = Math.min(Math.max(n.dx, -b.x0), WORLD_W - b.x1);
  n.dy = Math.min(Math.max(n.dy, -b.y0), WORLD_H - b.y1);
  const m = Math.hypot(n.dx, n.dy);
  if (m > MAX_NUDGE) {
    n.dx *= MAX_NUDGE / m;
    n.dy *= MAX_NUDGE / m;
  }
  return n;
}

/**
 * Deterministic greedy separation: fixed town order, split each push
 * evenly between the pair along the axis of least penetration. The
 * nudge moves the WHOLE cluster (anchor, tiles, ribbon, village), so
 * a ribbon can never separate from its tiles.
 */
function computeNudges(): Record<string, { dx: number; dy: number }> {
  const nud: Record<string, { dx: number; dy: number }> = {};
  const boxOf = (t: Town): Box => {
    const b = baseBox(t);
    const n = nud[t.id] ?? { dx: 0, dy: 0 };
    return { x0: b.x0 + n.dx, y0: b.y0 + n.dy, x1: b.x1 + n.dx, y1: b.y1 + n.dy };
  };
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 0; i < TOWNS.length; i++) {
      for (let j = i + 1; j < TOWNS.length; j++) {
        const a = boxOf(TOWNS[i]);
        const b = boxOf(TOWNS[j]);
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0); // >0: x overlap
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); // >0: y overlap
        // v12: act on QUASI-CONTACTS too — skip only when the true
        // (diagonal) gap between the two solid boxes already ≥ CLEARANCE
        const sep = Math.hypot(Math.max(-ox, 0), Math.max(-oy, 0));
        if (sep >= CLEARANCE) continue;
        const na = { ...(nud[TOWNS[i].id] ?? { dx: 0, dy: 0 }) };
        const nb = { ...(nud[TOWNS[j].id] ?? { dx: 0, dy: 0 }) };
        if (ox < oy) {
          // x is the axis of least penetration: push until x-sep = CLEARANCE
          const push = (ox + CLEARANCE) / 2;
          const d = (a.x0 + a.x1) / 2 < (b.x0 + b.x1) / 2 ? 1 : -1;
          na.dx -= d * push;
          nb.dx += d * push;
        } else {
          const push = (oy + CLEARANCE) / 2;
          const d = (a.y0 + a.y1) / 2 < (b.y0 + b.y1) / 2 ? 1 : -1;
          na.dy -= d * push;
          nb.dy += d * push;
        }
        nud[TOWNS[i].id] = clampNudge(TOWNS[i], na);
        nud[TOWNS[j].id] = clampNudge(TOWNS[j], nb);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return nud;
}

const CLUSTER_NUDGE = computeNudges();

/* --------------------------- public geometry ------------------------ */

export interface TownChromeGeo {
  /** display anchor (authentic anchor + collision nudge), pre-rotation */
  ax: number;
  ay: number;
  /** whole-cluster rotation (deg) around (ax, ay) */
  rot: number;
  /** display slot centres, aligned with town.slots indices */
  slots: { x: number; y: number }[];
  blockW: number;
  blockH: number;
  /** padded cluster bbox (tiles + ribbon + tails), pre-rotation */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ribbonCx: number;
  ribbonCy: number;
  ribbonW: number;
  ribbonFont: number;
  label: string;
  villageCx: number;
  villageH: number;
  villageBottom: number;
}

const CHROME_CACHE = new Map<string, TownChromeGeo>();

/** shared town chrome geometry (compact cluster: slots, ribbon, village) */
export function townChrome(town: Town): TownChromeGeo {
  const cached = CHROME_CACHE.get(town.id);
  if (cached) return cached;

  const n = CLUSTER_NUDGE[town.id] ?? { dx: 0, dy: 0 };
  const ax = town.x + n.dx;
  const ay = town.y + n.dy;
  const { bw, bh } = blockSize(town.slots.length);
  const grid = GRID[town.slots.length] ?? GRID[1];
  const totalH = bh + RIBBON_GAP + RIBBON_H;
  const top = ay - totalH / 2;
  const blockCy = top + bh / 2;
  const slots = town.slots.map((_, i) => ({ x: ax + grid[i][0], y: blockCy + grid[i][1] }));

  const label = townLabel(town);
  const ribbonW = ribbonWidth(label);
  const ribbonCx = ax;
  const ribbonCy = top + bh + RIBBON_GAP + RIBBON_H / 2;

  const clusterW = Math.max(bw, ribbonW);
  const halfW = clusterW / 2 + RIBBON_TAIL + BOX_PAD;
  const halfH = totalH / 2 + BOX_PAD;

  // village grounds the unit: wider than the cards it sits behind, so the
  // place reads as a place rather than as a smudge showing between tiles
  const villageH = Math.max(bw * 1.35, clusterW + 46);

  const geo: TownChromeGeo = {
    ax,
    ay,
    rot: clusterRot(town.id),
    slots,
    blockW: bw,
    blockH: bh,
    minX: ax - halfW,
    minY: ay - halfH,
    maxX: ax + halfW,
    maxY: ay + halfH,
    ribbonCx,
    ribbonCy,
    ribbonW,
    ribbonFont: RIBBON_FONT,
    label,
    villageCx: ax,
    villageH,
    villageBottom: ribbonCy + RIBBON_H / 2 + 2,
  };
  CHROME_CACHE.set(town.id, geo);
  return geo;
}

/* --------------------- authentic → display remap -------------------- */
/* Game logic (ghost supply lines, FX, smoke) still speaks in AUTHENTIC */
/* slot coordinates from data.ts; these helpers re-anchor those points  */
/* to the compact display cluster so lines/sparks/smoke stay glued to   */
/* the rendered tiles.                                                  */

const SLOT_REMAP = new Map<string, [number, number]>();
for (const t of TOWNS) {
  const c = townChrome(t);
  t.slots.forEach((sp, si) => {
    SLOT_REMAP.set(`${Math.round(sp.x)},${Math.round(sp.y)}`, [c.slots[si].x, c.slots[si].y]);
  });
}

/** map an authentic slot coordinate to its display position (identity for non-slot points) */
export function displayPosFor(x: number, y: number): [number, number] {
  return SLOT_REMAP.get(`${Math.round(x)},${Math.round(y)}`) ?? [x, y];
}

/** per-slot translation from the authentic socket to the display tile (ChimneySmoke re-anchor) */
export function slotDelta(townId: string, si: number): { dx: number; dy: number } | null {
  const sp = TOWN_BY_ID[townId]?.slots[si];
  if (!sp) return null;
  const d = displayPosFor(sp.x, sp.y);
  return { dx: d[0] - sp.x, dy: d[1] - sp.y };
}
