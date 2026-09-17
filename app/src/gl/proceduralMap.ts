import { Texture } from 'pixi.js';
import { LINKS, TOWNS } from '@/game/data';
import { BLEED_X, BLEED_Y, WORLD_H, WORLD_W } from '@/components/game/boardView';
import { routeFor } from '@/components/game/routePaths';
import { townChrome } from '@/components/game/townChrome';
import { clamp, clamp01, createSimplex2D, fbm2, lerp, mulberry32, smoothstep } from './noise';

/* ------------------------------------------------------------------ */
/* proceduralMap — the two era board grounds, GENERATED once from      */
/* TOWNS + LINKS, then HYBRIDIZED with the historical painted maps.    */
/*                                                                     */
/* One offscreen 2048×1152 canvas per era covers the whole extended    */
/* world (world + bleed, 4160×2340 logical); Pixi scales the sprite    */
/* up. The relief is a seeded simplex/fBm heightfield, flattened       */
/* around the town clusters and carved into valleys along the canal    */
/* routes (routeFor). V3 art direction — geographic signal over        */
/* chromatic noise: low mottle, a sage/grey-beige ramp with softened   */
/* vales, a subtle NW hillshade (±15 % max), calm warm glades under    */
/* the clusters with a small seating shadow (~7 %), FAINT sand/sage    */
/* ground verges edging every route, small organic field parcels with  */
/* irregular hedgerows, readable bottle-green wood massifs (flat       */
/* ellipse passes), fine two-tone rivers and a seeded patina.          */
/*                                                                     */
/* HYBRID PASS (V5): when the historical paintings (public/map-era-*.  */
/* webp, exactly LOGICAL_W × LOGICAL_H) are preloaded via              */
/* prepareProceduralBoardMaps(), their luminance structure — broad     */
/* mist/vale light AND fine brush grain — plus a touch of their chroma */
/* is transferred onto the procedural ground, per pixel, masked away   */
/* from the town clusters and routes so the painting's own map marks   */
/* never fight the live tiles and links. The procedural overlays       */
/* (fields, verges, contours, rivers, groves, patina, smoke) are drawn */
/* AFTER the fusion, so the aligned geographic signal stays crisp. If  */
/* a webp is missing the era simply keeps the pure procedural ground.  */
/* All of it sits in a module-level cache: no regeneration on zoom,    */
/* pan, state change or React remount. Nothing runs at import time.    */
/* ------------------------------------------------------------------ */

export interface ProceduralBoardTextures {
  canal: Texture;
  rail: Texture;
}

/* logical surface = world + bleed; rendered at half-ish resolution */
const LOGICAL_W = WORLD_W + 2 * BLEED_X; // 4160
const LOGICAL_H = WORLD_H + 2 * BLEED_Y; // 2340
const RENDER_W = 2048;
const RENDER_H = 1152;
const SCALE = RENDER_W / LOGICAL_W; // ≈ 0.4923 (same on both axes)

/* coarse height lattice (bilinear-upsampled at render time) */
const CELL = 20;
const GW = LOGICAL_W / CELL; // 208
const GH = LOGICAL_H / CELL; // 117
const LATTICE_W = GW + 1;
const LATTICE_H = GH + 1;

/* fixed seeds — the terrain must be bit-stable between reloads */
const SEED_RELIEF = 0xb2475;
const SEED_MOTTLE = 0x5eed1;
const SEED_DETAIL = 0xd37a1;
const SEED_RIVERS = 0xca1a1;
const SEED_GROVES = 0xb05c;
const SEED_SMOKE = 0x5a0ce;
const SEED_PATINA = 0x9a71e;
const SEED_FIELDS = 0xf1e1d5;
const SEED_HEDGES = 0x8ed9e5;

/* hillshade V2: SUBTLE — a ±10-logical-unit elevation difference, so the
 *  relief whispers instead of shouting (lambertian exaggeration is gone) */
const SHADE_ELEV = 10; // height-units → logical-units elevation scale
const SHADE_GAIN = 2.2; // slope → shade factor gain
const LIGHT_X = 0.6; // unnormalized light direction (from the NW)
const LIGHT_Y = 0.7;

/* engraved contour lines (very discreet), marching squares on the lattice */
const CONTOUR_LEVELS = 14;
const CONTOUR_ALPHA = 0.1; // dark engraved stroke — alpha ceiling 0.10
const CONTOUR_RIDGE_ALPHA = 0.065; // faint light ridge offset toward SE

/* small clearing shadow seating the town clusters (~7 %, was a heavy 12 %) */
const CLEARING_SHADOW = 0.07;

/* fields: jittered lattice of small organic rural parcels (logical units) */
const FCELL = 88;

/* ------------------------------------------------------------------ */
/* geometry masks (logical/world coordinates)                          */
/* ------------------------------------------------------------------ */

/** distance from (x,y) to the town's displayed cluster box (0 inside) */
function townDistance(x: number, y: number): number {
  let best = Infinity;
  for (const t of TOWNS) {
    const c = townChrome(t);
    const dx = Math.max(c.minX - x, x - c.maxX, 0);
    const dy = Math.max(c.minY - y, y - c.maxY, 0);
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

const distToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** min distance from (x,y) to any canal route (the visible polylines) */
function canalDistance(x: number, y: number): number {
  let best = Infinity;
  for (const def of LINKS) {
    if (!def.canal) continue;
    const pts = routeFor(def).pts;
    for (let i = 2; i < pts.length; i += 2) {
      const d = distToSeg(x, y, pts[i - 2][0], pts[i - 2][1], pts[i][0], pts[i][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

/** distance-to-canal lattice, in LOGICAL units: route points stamped on the
 *  coarse grid, then a two-pass chamfer distance transform — far cheaper
 *  than per-cell segment scans and smooth enough for the valley mask */
function buildCanalGrid(): Float32Array {
  const grid = new Float32Array(LATTICE_W * LATTICE_H).fill(Infinity);
  for (const def of LINKS) {
    if (!def.canal) continue;
    for (const [x, y] of routeFor(def).pts) {
      const gx = Math.round((x + BLEED_X) / CELL);
      const gy = Math.round((y + BLEED_Y) / CELL);
      if (gx < 0 || gx >= LATTICE_W || gy < 0 || gy >= LATTICE_H) continue;
      const i = gy * LATTICE_W + gx;
      const d = Math.hypot(gx * CELL - BLEED_X - x, gy * CELL - BLEED_Y - y);
      if (d < grid[i]) grid[i] = d;
    }
  }
  const D = Math.SQRT2;
  for (let gy = 0; gy < LATTICE_H; gy++) {
    for (let gx = 0; gx < LATTICE_W; gx++) {
      const i = gy * LATTICE_W + gx;
      let d = grid[i];
      if (gx > 0) d = Math.min(d, grid[i - 1] + 1);
      if (gy > 0) d = Math.min(d, grid[i - LATTICE_W] + 1);
      if (gx > 0 && gy > 0) d = Math.min(d, grid[i - LATTICE_W - 1] + D);
      if (gx < LATTICE_W - 1 && gy > 0) d = Math.min(d, grid[i - LATTICE_W + 1] + D);
      grid[i] = d;
    }
  }
  for (let gy = LATTICE_H - 1; gy >= 0; gy--) {
    for (let gx = LATTICE_W - 1; gx >= 0; gx--) {
      const i = gy * LATTICE_W + gx;
      let d = grid[i];
      if (gx < LATTICE_W - 1) d = Math.min(d, grid[i + 1] + 1);
      if (gy < LATTICE_H - 1) d = Math.min(d, grid[i + LATTICE_W] + 1);
      if (gx < LATTICE_W - 1 && gy < LATTICE_H - 1) d = Math.min(d, grid[i + LATTICE_W + 1] + D);
      if (gx > 0 && gy < LATTICE_H - 1) d = Math.min(d, grid[i + LATTICE_W - 1] + D);
      grid[i] = d;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] *= CELL;
  return grid;
}

/** engraved contour segments via marching squares on the height lattice;
 *  segments falling near a town cluster or a canal route are dropped, so
 *  the lines never disturb the clusters nor the valleys (world coords) */
function buildContours(height: Float32Array, townGrid: Float32Array, canalGrid: Float32Array): number[][] {
  const segs: number[][] = [];
  for (let k = 1; k < CONTOUR_LEVELS; k++) {
    const L = k / CONTOUR_LEVELS;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const i = gy * LATTICE_W + gx;
        const h00 = height[i];
        const h10 = height[i + 1];
        const h01 = height[i + LATTICE_W];
        const h11 = height[i + LATTICE_W + 1];
        let idx = 0;
        if (h00 > L) idx |= 1; // bottom-left
        if (h10 > L) idx |= 2; // bottom-right
        if (h11 > L) idx |= 4; // top-right
        if (h01 > L) idx |= 8; // top-left
        if (idx === 0 || idx === 15) continue;
        if (townGrid[i] < 90 || canalGrid[i] < 42) continue;
        const t = (a: number, b: number): number => clamp01((L - a) / (b - a));
        /* crossing points on the bottom/right/top/left edges, world coords */
        const B = [(gx + t(h00, h10)) * CELL - BLEED_X, gy * CELL - BLEED_Y];
        const R = [(gx + 1) * CELL - BLEED_X, (gy + t(h10, h11)) * CELL - BLEED_Y];
        const T = [(gx + t(h01, h11)) * CELL - BLEED_X, (gy + 1) * CELL - BLEED_Y];
        const F = [gx * CELL - BLEED_X, (gy + t(h00, h01)) * CELL - BLEED_Y];
        const seg = (a: number[], b: number[]) => segs.push([a[0], a[1], b[0], b[1]]);
        switch (idx) {
          case 1: case 14: seg(F, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(F, R); break;
          case 4: case 11: seg(R, T); break;
          case 6: case 9: seg(B, T); break;
          case 7: case 8: seg(F, T); break;
          case 5: seg(F, B); seg(R, T); break;
          case 10: seg(B, R); seg(F, T); break;
        }
      }
    }
  }
  return segs;
}

interface Terrain {
  /** heightfield lattice, LATTICE_W × LATTICE_H, values in [0,1] */
  height: Float32Array;
  /** painted-map fusion weight lattice, [0,1]: 0 on the town clusters and
   *  canal routes (the painting must never smother the live board), rising
   *  to 1 in open country */
  paintMask: Float32Array;
  /** per-pixel terrain value in [0,1] (height + detail + mottle), RENDER_W × RENDER_H */
  value: Float32Array;
  /** per-pixel vignette factor in [0,1] (1 = play area, darker in the bleed) */
  vignette: Float32Array;
  /** per-pixel hillshade multiplier (subtle NW light), [0.85,1.15] */
  shade: Float32Array;
  /** per-pixel extra multiply (cluster clearing shadow), ≤1 */
  mul: Float32Array;
  /** per-pixel warm glade lift under the clusters (sage-pasture tint), [0,1] */
  warm: Float32Array;
  /** engraved contour segments [x1,y1,x2,y2] in world coords, pre-masked */
  contours: number[][];
  /** deterministic rivers, world-coords polylines */
  rivers: [number, number][][];
  /** deterministic woods: flat organic ellipses, world coords */
  groves: { x: number; y: number; rx: number; ry: number; rot: number; shade: number }[];
  /** wood-group centres + radii, used to keep fields out of the forests */
  woods: { x: number; y: number; r: number }[];
  /** deterministic fields: organic convex parcel outlines (world coords) */
  fields: { pts: [number, number][]; fam: number; j: number }[];
  /** deterministic hedgerow point runs [x1,y1,x2,y2,…] in world coords,
     pre-masked, with gaps — drawn as consecutive segments */
  hedges: number[][];
}

let terrain: Terrain | null = null;

function bilinear(grid: Float32Array, u: number, v: number): number {
  const gx = clamp(Math.floor(u), 0, GW - 1);
  const gy = clamp(Math.floor(v), 0, GH - 1);
  const fx = clamp01(u - gx);
  const fy = clamp01(v - gy);
  const i00 = gy * LATTICE_W + gx;
  const a = lerp(grid[i00], grid[i00 + 1], fx);
  const b = lerp(grid[i00 + LATTICE_W], grid[i00 + LATTICE_W + 1], fx);
  return lerp(a, b, fy);
}

/** terrain height (0..1) at a world point, from the coarse lattice */
function heightAt(x: number, y: number): number {
  if (!terrain) return 0.5;
  return bilinear(terrain.height, (x + BLEED_X) / CELL, (y + BLEED_Y) / CELL);
}

function buildTerrain(): Terrain {
  const relief = createSimplex2D(SEED_RELIEF);
  const mottleN = createSimplex2D(SEED_MOTTLE);
  const detailN = createSimplex2D(SEED_DETAIL);

  /* lattice: fBm relief, flattened to calm clearings near the towns and
     carved into valleys along the canal routes; a town-distance lattice
     is kept alongside for the bake-time masks (contours, clearing shade) */
  const canalGrid = buildCanalGrid();
  const townGrid = new Float32Array(LATTICE_W * LATTICE_H);
  const height = new Float32Array(LATTICE_W * LATTICE_H);
  const paintMask = new Float32Array(LATTICE_W * LATTICE_H);
  for (let gy = 0; gy < LATTICE_H; gy++) {
    const wy = gy * CELL - BLEED_Y;
    for (let gx = 0; gx < LATTICE_W; gx++) {
      const wx = gx * CELL - BLEED_X;
      const i = gy * LATTICE_W + gx;
      const town = townDistance(wx, wy);
      townGrid[i] = town;
      /* V3: compress the fBm toward the mids and carve a touch shallower,
         so the big blue-black masses read as soft vales/mist, not ink halos
         (the depth stays) */
      const base = 0.5 + 0.42 * fbm2(relief, wx * 0.0016, wy * 0.0016, 5);
      const flat = smoothstep(30, 140, town); // 0 inside the cluster
      const valley = 1 - smoothstep(0, 150, canalGrid[i]); // 1 on a canal route
      height[i] = clamp01(lerp(0.5, base, flat) - valley * 0.25);
      /* hybrid fusion weight: the painting speaks in open country, fades to
         silence around the town clusters and along the canal routes so its
         baked-in marks (glow dots, painted rivers) never sit on the live
         tiles, links or ribbons — TIGHT ramps: a wide halo would read as a
         flat hub-and-spoke blob against the grainy fused country */
      paintMask[i] = smoothstep(48, 130, town) * smoothstep(18, 64, canalGrid[i]);
    }
  }

  /* lattice gradients (central differences, height-units per logical unit):
     baked once so the per-pixel hillshade only bilinear-samples these
     instead of re-deriving the gradient four times per pixel */
  const gradX = new Float32Array(LATTICE_W * LATTICE_H);
  const gradY = new Float32Array(LATTICE_W * LATTICE_H);
  for (let gy = 0; gy < LATTICE_H; gy++) {
    for (let gx = 0; gx < LATTICE_W; gx++) {
      const i = gy * LATTICE_W + gx;
      const xm = gy * LATTICE_W + Math.max(gx - 1, 0);
      const xp = gy * LATTICE_W + Math.min(gx + 1, LATTICE_W - 1);
      const ym = Math.max(gy - 1, 0) * LATTICE_W + gx;
      const yp = Math.min(gy + 1, LATTICE_H - 1) * LATTICE_W + gx;
      gradX[i] = (height[xp] - height[xm]) / ((xp - xm) * CELL);
      gradY[i] = (height[yp] - height[ym]) / ((yp - ym) * CELL);
    }
  }

  /* deterministic rivers: seeded springs on high ground, walking downhill,
     truncated before they enter a cluster or a canal valley */
  const partial: Terrain = {
    height,
    paintMask,
    value: new Float32Array(0),
    vignette: new Float32Array(0),
    shade: new Float32Array(0),
    mul: new Float32Array(0),
    warm: new Float32Array(0),
    contours: buildContours(height, townGrid, canalGrid),
    rivers: [],
    groves: [],
    woods: [],
    fields: [],
    hedges: [],
  };
  terrain = partial;
  const randRiver = mulberry32(SEED_RIVERS);
  const rivers: [number, number][][] = [];
  for (let tries = 0; tries < 500 && rivers.length < 14; tries++) {
    let x = randRiver() * LOGICAL_W - BLEED_X;
    let y = randRiver() * LOGICAL_H - BLEED_Y;
    if (heightAt(x, y) < 0.52 || townDistance(x, y) < 170 || canalDistance(x, y) < 90) continue;
    const path: [number, number][] = [[x, y]];
    /* river direction persists between steps: on flat ground the stream
       keeps its course with a gentle seeded wobble instead of curling
       into bright knots of overlapping strokes */
    let dx = randRiver() * 2 - 1;
    let dy = randRiver() * 2 - 1;
    for (let step = 0; step < 170; step++) {
      /* numerical gradient of the carved heightfield + a seeded meander */
      const gx = (heightAt(x + 9, y) - heightAt(x - 9, y)) / 18;
      const gy = (heightAt(x, y + 9) - heightAt(x, y - 9)) / 18;
      const gl = Math.hypot(gx, gy);
      if (gl > 3e-4) {
        dx = -gx / gl;
        dy = -gy / gl;
      }
      const wob = (randRiver() - 0.5) * 0.5;
      const cw = Math.cos(wob);
      const sw = Math.sin(wob);
      [dx, dy] = [dx * cw - dy * sw, dx * sw + dy * cw];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      x += dx * 16;
      y += dy * 16;
      if (x < -BLEED_X + 12 || x > WORLD_W + BLEED_X - 12 || y < -BLEED_Y + 12 || y > WORLD_H + BLEED_Y - 12) break;
      if (townDistance(x, y) < 55 || canalDistance(x, y) < 16) break;
      path.push([x, y]);
    }
    if (path.length >= 26) rivers.push(path);
  }

  /* deterministic woods (V2): fewer, larger, READABLE groves — each one a
     small group of organic ellipses (radius ~7–16 logical, sometimes more),
     rejected out of the clusters and routes; no scattered confetti dots */
  const randGrove = mulberry32(SEED_GROVES);
  const groves: Terrain['groves'] = [];
  const woods: Terrain['woods'] = [];
  for (let tries = 0; tries < 700 && woods.length < 46; tries++) {
    const cx = randGrove() * LOGICAL_W - BLEED_X;
    const cy = randGrove() * LOGICAL_H - BLEED_Y;
    const h = heightAt(cx, cy);
    if (h < 0.34 || h > 0.82 || townDistance(cx, cy) < 165 || canalDistance(cx, cy) < 60) continue;
    const blobs = 4 + Math.floor(randGrove() * 5); // 4–8 crowns per wood
    const made: Terrain['groves'] = [];
    for (let i = 0; i < blobs; i++) {
      const a = randGrove() * Math.PI * 2;
      const rr = Math.sqrt(randGrove()) * (12 + randGrove() * 26);
      const x = cx + Math.cos(a) * rr * 1.4;
      const y = cy + Math.sin(a) * rr;
      if (townDistance(x, y) < 125 || canalDistance(x, y) < 42) continue;
      let rx = 11 + randGrove() * 10;
      if (randGrove() < 0.12) rx = Math.min(23, rx + 3 + randGrove() * 4); // the odd big canopy
      made.push({ x, y, rx, ry: rx * (0.55 + randGrove() * 0.3), rot: randGrove() * Math.PI, shade: randGrove() });
    }
    if (made.length < 4) continue; // no isolated micro-dots: real massifs only
    groves.push(...made);
    woods.push({ x: cx, y: cy, r: 56 });
  }

  /* deterministic fields (V3): a jittered FCELL lattice of small ORGANIC
     parcels — convex quads (sometimes pentagons) with jittered corners,
     varied sizes and orientations, sober rural tints (plough brown / sage
     pasture / beige stubble) — suggesting countryside, never a UI grid;
     hedgerows seam some shared borders. Masked out of clusters/routes/woods */
  const randField = mulberry32(SEED_FIELDS);
  const randHedge = mulberry32(SEED_HEDGES);
  const FW = Math.ceil(LOGICAL_W / FCELL);
  const FH = Math.ceil(LOGICAL_H / FCELL);
  const cellFam = new Int8Array(FW * FH).fill(-1); // -1: no field
  const cellJit = new Float32Array(FW * FH);
  const fields: Terrain['fields'] = [];
  for (let fy = 0; fy < FH; fy++) {
    for (let fx = 0; fx < FW; fx++) {
      const i = fy * FW + fx;
      const jx = (randField() - 0.5) * FCELL * 0.5;
      const jy = (randField() - 0.5) * FCELL * 0.5;
      const cx = (fx + 0.5) * FCELL + jx - BLEED_X;
      const cy = (fy + 0.5) * FCELL + jy - BLEED_Y;
      cellJit[i] = randField();
      if (randField() < 0.4) continue; // some land stays open country
      if (townDistance(cx, cy) < 130 || canalDistance(cx, cy) < 40) continue;
      let inWood = false;
      for (const w of woods) {
        if (Math.hypot(cx - w.x, cy - w.y) < w.r + FCELL * 0.4) {
          inWood = true;
          break;
        }
      }
      if (inWood) continue;
      const fam = Math.floor(randField() * 3); // 0 plough, 1 pasture, 2 stubble
      cellFam[i] = fam;
      /* organic parcel: 4 (sometimes 5) corners in angular order, each with
         its own radius jitter, slightly stretched and randomly rotated */
      const sides = randField() < 0.3 ? 5 : 4;
      const rot = randField() * Math.PI * 2;
      const baseR = FCELL * (0.33 + randField() * 0.14); // +~10 % coverage (V4)
      const pts: [number, number][] = [];
      for (let k = 0; k < sides; k++) {
        const a = rot + (k * Math.PI * 2) / sides + (randField() - 0.5) * 0.5;
        const r = baseR * (0.75 + randField() * 0.5);
        pts.push([cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 0.84]);
      }
      fields.push({ pts, fam, j: cellJit[i] });
    }
  }
  /* hedgerows: hairline dark seams on SOME shared borders between plots of
     different families — irregular (jittered midpoints, gaps), never across
     towns, routes or open country */
  const hedges: number[][] = [];
  for (let fy = 0; fy < FH; fy++) {
    for (let fx = 0; fx < FW; fx++) {
      const i = fy * FW + fx;
      if (cellFam[i] < 0) continue;
      const neighbours: [number, number, number][] = [
        [fx + 1, fy, 0], // vertical seam on the east border
        [fx, fy + 1, 1], // horizontal seam on the south border
      ];
      for (const [nx, ny, horiz] of neighbours) {
        if (nx >= FW || ny >= FH) continue;
        const ni = ny * FW + nx;
        if (cellFam[ni] < 0 || cellFam[ni] === cellFam[i] || randHedge() < 0.45) continue;
        const pad = 8 + randHedge() * 12;
        const seam = horiz ? ny * FCELL - BLEED_Y : nx * FCELL - BLEED_X;
        const a = horiz ? fx * FCELL + pad - BLEED_X : fy * FCELL + pad - BLEED_Y;
        const b = horiz ? (fx + 1) * FCELL - pad - BLEED_X : (fy + 1) * FCELL - pad - BLEED_Y;
        const mx = horiz ? (a + b) / 2 : seam;
        const my = horiz ? seam : (a + b) / 2;
        if (townDistance(mx, my) < 75 || canalDistance(mx, my) < 24) continue;
        /* two dashes with a gap, each bowed a touch off the straight seam */
        const j1 = (randHedge() - 0.5) * 7;
        const j2 = (randHedge() - 0.5) * 7;
        const m1 = a + (b - a) * (0.28 + randHedge() * 0.1);
        const m2 = a + (b - a) * (0.62 + randHedge() * 0.1);
        if (horiz) {
          hedges.push([a, seam + j1 * 0.4, m1, seam + j1]);
          hedges.push([m2, seam + j2, b, seam + j2 * 0.4]);
        } else {
          hedges.push([seam + j1 * 0.4, a, seam + j1, m1]);
          hedges.push([seam + j2, m2, seam + j2 * 0.4, b]);
        }
      }
    }
  }

  /* per-pixel bake (shared by both eras): terrain value, subtle NW
     hillshade from the lattice gradient, calm warm glades under the
     clusters with a small seating shadow, vignette */
  const value = new Float32Array(RENDER_W * RENDER_H);
  const vignette = new Float32Array(RENDER_W * RENDER_H);
  const shade = new Float32Array(RENDER_W * RENDER_H);
  const mul = new Float32Array(RENDER_W * RENDER_H);
  const warm = new Float32Array(RENDER_W * RENDER_H);
  const grainRand = mulberry32(SEED_DETAIL ^ 0x9e37);
  const grain = new Uint8Array(256 * 256);
  for (let i = 0; i < grain.length; i++) grain[i] = (grainRand() * 256) | 0;
  for (let py = 0; py < RENDER_H; py++) {
    const ly = py / SCALE;
    const wy = ly - BLEED_Y;
    const gy = ly / CELL;
    for (let px = 0; px < RENDER_W; px++) {
      const lx = px / SCALE;
      const wx = lx - BLEED_X;
      const gx = lx / CELL;
      const h = bilinear(height, gx, gy);
      /* calm glade under the cluster: the noise dies down, the land lifts
         gently toward a warm sage pasture */
      const td = bilinear(townGrid, gx, gy);
      const glade = 1 - smoothstep(20, 130, td);
      const det = detailN(wx * 0.03, wy * 0.03) * (1 - glade * 0.7);
      const mot = mottleN(wx * 0.007, wy * 0.007) * (1 - glade * 0.6);
      const g = (grain[((py & 255) << 8) | (px & 255)] - 128) / 128;
      const i = py * RENDER_W + px;
      value[i] = clamp01(h + det * 0.058 + mot * 0.052 + g * 0.02 + glade * 0.045);
      /* hillshade V2: a ±10-unit elevation difference, whisper-quiet */
      const hx = bilinear(gradX, gx, gy) * SHADE_ELEV;
      const hy = bilinear(gradY, gx, gy) * SHADE_ELEV;
      shade[i] = clamp(1 + (-hx * LIGHT_X - hy * LIGHT_Y) * SHADE_GAIN, 0.85, 1.15);
      /* small seating shadow under the clusters (~7 %) + warm pasture lift */
      mul[i] = 1 - CLEARING_SHADOW * (1 - smoothstep(20, 120, td));
      warm[i] = glade;
      /* outside the play area, sink into the table's darkness (stronger patina) */
      const out = Math.hypot(Math.max(-wx, wx - WORLD_W, 0), Math.max(-wy, wy - WORLD_H, 0));
      vignette[i] = 1 - smoothstep(40, 430, out) * 0.62;
    }
  }

  partial.value = value;
  partial.vignette = vignette;
  partial.shade = shade;
  partial.mul = mul;
  partial.warm = warm;
  partial.rivers = rivers;
  partial.groves = groves;
  partial.woods = woods;
  partial.fields = fields;
  partial.hedges = hedges;
  return partial;
}

/* ------------------------------------------------------------------ */
/* palettes                                                             */
/* ------------------------------------------------------------------ */

type Rgb = [number, number, number];

/** canal era V2: blue-black valleys and bottle-green mids kept, but the
 *  heights come down from ochre to SAGE and grey-beige — a narrow, quiet
 *  ramp (top luminance ≈ 80) so the land stops reading as camouflage. */
const CANAL_STOPS: [number, Rgb][] = [
  [0.0, [0x0e, 0x1a, 0x1e]], // #0E1A1E
  [0.14, [0x16, 0x26, 0x2a]], // #16262A
  [0.29, [0x24, 0x38, 0x2e]], // #24382E
  [0.43, [0x33, 0x45, 0x2f]], // #33452F
  [0.57, [54, 66, 47]], // dark sage
  [0.71, [56, 66, 49]],
  [0.82, [58, 66, 50]], // sage
  [0.91, [70, 72, 55]], // grey-beige
  [1.0, [86, 82, 60]], // pale stubble beige
];

/** rail era: the same land, smoke-stained — darker, desaturated, sepia */
function railTint([r, g, b]: Rgb): Rgb {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const d = 0.6; // desaturation
  const k = 0.78; // global darkening
  return [clamp((lerp(r, lum, d) * 1.12 + 10) * k, 0, 255), clamp(lerp(g, lum, d) * 0.98 * k, 0, 255), clamp(lerp(b, lum, d) * 0.85 * k, 0, 255)];
}

function buildLut(stops: [number, Rgb][], tint?: (c: Rgb) => Rgb): Uint8Array {
  const lut = new Uint8Array(512 * 3);
  for (let i = 0; i < 512; i++) {
    const v = i / 511;
    let s = 0;
    while (s < stops.length - 2 && v > stops[s + 1][0]) s++;
    const [v0, c0] = stops[s];
    const [v1, c1] = stops[s + 1];
    const t = clamp01((v - v0) / (v1 - v0));
    const c: Rgb = [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    const out = tint ? tint(c) : c;
    lut[i * 3] = out[0];
    lut[i * 3 + 1] = out[1];
    lut[i * 3 + 2] = out[2];
  }
  return lut;
}

/* ------------------------------------------------------------------ */
/* canvas rendering                                                    */
/* ------------------------------------------------------------------ */

/** burnt-parchment brown the bleed tips into, instead of plain black */
const BLEED_BROWN: Rgb = [94, 62, 34];

function paintGround(canvas: HTMLCanvasElement, t: Terrain, lut: Uint8Array, vigStrength: number): CanvasRenderingContext2D {
  canvas.width = RENDER_W;
  canvas.height = RENDER_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(RENDER_W, RENDER_H);
  const data = img.data;
  for (let i = 0; i < RENDER_W * RENDER_H; i++) {
    const vi = clamp(Math.floor(t.value[i] * 511), 0, 511) * 3;
    const vig = 1 - (1 - t.vignette[i]) * vigStrength;
    /* the bleed also drifts toward burnt parchment before darkening */
    const brown = clamp01((1 - t.vignette[i]) * vigStrength) * 0.8;
    const sh = t.shade[i] * t.mul[i];
    /* warm sage-pasture lift in the town glades */
    const w = t.warm[i];
    const j = i * 4;
    data[j] = lerp(lut[vi] * sh + w * 9, BLEED_BROWN[0], brown) * vig;
    data[j + 1] = lerp(lut[vi + 1] * sh + w * 11, BLEED_BROWN[1], brown) * vig;
    data[j + 2] = lerp(lut[vi + 2] * sh + w * 3, BLEED_BROWN[2], brown) * vig;
    data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

/** rural structure (V2): sober flat field plots (plough brown / sage
 *  pasture / beige stubble) with soft rounded edges, seamed by thin dark
 *  hedgerows — geographic signal instead of chromatic noise */
const FIELD_FILLS: Rgb[] = [
  [122, 98, 64], // plough brown
  [134, 144, 100], // sage pasture
  [162, 148, 102], // beige stubble
];

function drawFields(ctx: CanvasRenderingContext2D, t: Terrain, era: 'canal' | 'rail'): void {
  ctx.save();
  const canal = era === 'canal';
  for (const f of t.fields) {
    const [r0, g0, b0] = FIELD_FILLS[f.fam];
    const j = (f.j - 0.5) * 22;
    const a = (canal ? 0.112 : 0.085) + (f.j - 0.5) * 0.03;
    ctx.fillStyle = `rgba(${Math.round(r0 + j)},${Math.round(g0 + j)},${Math.round(b0 + j * 0.6)},${a})`;
    ctx.beginPath();
    ctx.moveTo((f.pts[0][0] + BLEED_X) * SCALE, (f.pts[0][1] + BLEED_Y) * SCALE);
    for (let k = 1; k < f.pts.length; k++) ctx.lineTo((f.pts[k][0] + BLEED_X) * SCALE, (f.pts[k][1] + BLEED_Y) * SCALE);
    ctx.closePath();
    ctx.fill();
  }
  /* hedgerows: hairline dark dashes between some neighbouring plots */
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of t.hedges) {
    for (let k = 2; k < s.length; k += 2) {
      ctx.moveTo((s[k - 2] + BLEED_X) * SCALE, (s[k - 1] + BLEED_Y) * SCALE);
      ctx.lineTo((s[k] + BLEED_X) * SCALE, (s[k + 1] + BLEED_Y) * SCALE);
    }
  }
  ctx.lineWidth = Math.max(0.5, 1.4 * SCALE);
  ctx.strokeStyle = canal ? 'rgba(22,28,17,0.19)' : 'rgba(16,20,13,0.17)';
  ctx.stroke();
  ctx.restore();
}

/** pale warm verges edging every route (V2): two thin offset seams flanking
 *  the trace (plus a softer outer echo), so the links read at a glance —
 *  never under the water or the rails themselves, and never across towns */
function drawVerges(ctx: CanvasRenderingContext2D, era: 'canal' | 'rail'): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const canal = era === 'canal';
  for (const def of LINKS) {
    const pts = routeFor(def).pts;
    for (const side of [-1, 1]) {
      /* V3: a GROUND effect, not foreground lines — dark sand/sage tint at
         very low alpha, one discontinuous subpath per band (town-clear
         stretches only) */
      for (const [off, width, alpha] of [
        [9, 1.2, canal ? 0.025 : 0.02],
        [5.5, 2.2, canal ? 0.08 : 0.06],
      ] as const) {
        let pen = false;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p0 = pts[Math.max(0, i - 1)];
          const p1 = pts[Math.min(pts.length - 1, i + 1)];
          const dx = p1[0] - p0[0];
          const dy = p1[1] - p0[1];
          const len = Math.hypot(dx, dy) || 1;
          const x = pts[i][0] + (-dy / len) * off * side;
          const y = pts[i][1] + (dx / len) * off * side;
          if (townDistance(x, y) < 36) {
            pen = false;
            continue;
          }
          if (pen) ctx.lineTo((x + BLEED_X) * SCALE, (y + BLEED_Y) * SCALE);
          else ctx.moveTo((x + BLEED_X) * SCALE, (y + BLEED_Y) * SCALE);
          pen = true;
        }
        ctx.lineWidth = width * SCALE;
        ctx.strokeStyle = canal ? `rgba(148,144,102,${alpha})` : `rgba(126,122,90,${alpha})`;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** engraved contour lines: one dark pass plus a faint light ridge offset a
 *  hair toward SE, so they read as etched into the paper (alpha ≤ 0.10) */
function drawContours(ctx: CanvasRenderingContext2D, t: Terrain, era: 'canal' | 'rail'): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const [alpha, ox, oy, light] of [
    [CONTOUR_ALPHA, 0, 0, false],
    [CONTOUR_RIDGE_ALPHA, 0.7, 0.6, true],
  ] as const) {
    ctx.beginPath();
    for (const s of t.contours) {
      ctx.moveTo((s[0] + BLEED_X) * SCALE + ox, (s[1] + BLEED_Y) * SCALE + oy);
      ctx.lineTo((s[2] + BLEED_X) * SCALE + ox, (s[3] + BLEED_Y) * SCALE + oy);
    }
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = light
      ? era === 'canal'
        ? `rgba(228,218,192,${alpha})`
        : `rgba(200,192,176,${alpha})`
      : era === 'canal'
        ? `rgba(22,18,12,${alpha})`
        : `rgba(14,12,9,${alpha})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRivers(ctx: CanvasRenderingContext2D, t: Terrain, dark: string, core: string, glint: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  /* thin bright glint, offset a touch downstream-SE so it reads against the
     NW light as a sun-struck bank rather than a centred highlight */
  const OX = 1.2 * SCALE;
  const OY = 1.0 * SCALE;
  for (const river of t.rivers) {
    for (const [width, color, ox, oy, skip, tail] of [
      [4.2 * SCALE, dark, 0, 0, 0, 0],
      /* the light passes start well downstream and stop a hair early, so
         neither the spring nor the mouth ends in a bright round blob */
      [1.8 * SCALE, core, 0, 0, 6, 2],
      [0.9 * SCALE, glint, OX, OY, 10, 4],
    ] as const) {
      const start = Math.min(skip, river.length - 1);
      const end = Math.max(start + 1, river.length - tail);
      ctx.beginPath();
      ctx.moveTo((river[start][0] + BLEED_X) * SCALE + ox, (river[start][1] + BLEED_Y) * SCALE + oy);
      for (let i = start + 1; i < end; i++) ctx.lineTo((river[i][0] + BLEED_X) * SCALE + ox, (river[i][1] + BLEED_Y) * SCALE + oy);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* painted woods (V2): at most three cheap FLAT passes per organic ellipse —
   a dark underwood mass offset away from the light, the sober bottle-green
   crown itself, and (on the lit crowns) a small canopy touch toward NW */
function drawGroves(ctx: CanvasRenderingContext2D, t: Terrain, era: 'canal' | 'rail'): void {
  ctx.save();
  const canal = era === 'canal';
  for (const g of t.groves) {
    const x = (g.x + BLEED_X) * SCALE;
    const y = (g.y + BLEED_Y) * SCALE;
    const rx = g.rx * SCALE;
    const ry = g.ry * SCALE;
    /* underwood shadow, bulging downstream-SE (kept light, V4) */
    ctx.fillStyle = canal ? 'rgba(12,20,14,0.25)' : 'rgba(10,15,12,0.23)';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.22, y + ry * 0.3, rx * 1.1, ry * 1.12, g.rot, 0, Math.PI * 2);
    ctx.fill();
    /* LUMINOUS bottle-green crowns (V4: leafy, not ink), greyer by rail */
    const l = canal ? 42 + g.shade * 20 : 30 + g.shade * 13;
    ctx.fillStyle = `rgba(${Math.round(l * 0.58)},${Math.round(l)},${Math.round(l * 0.62)},${canal ? 0.58 : 0.48})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, g.rot, 0, Math.PI * 2);
    ctx.fill();
    /* canopy touch toward the light — wider and brighter (V4) */
    if (g.shade > 0.45) {
      const hl = canal ? 84 + g.shade * 34 : 56 + g.shade * 20;
      ctx.fillStyle = `rgba(${Math.round(hl * 0.8)},${Math.round(hl)},${Math.round(hl * 0.6)},${canal ? 0.42 : 0.34})`;
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.3, y - ry * 0.34, rx * 0.56, ry * 0.58, g.rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** patina, both eras: wide deterministic mist/vein bands drifting over the
 *  land, and a faint seeded craquelure — all flat strokes, no gradients */
function drawPatina(ctx: CanvasRenderingContext2D, era: 'canal' | 'rail'): void {
  const rand = mulberry32(SEED_PATINA);
  const canal = era === 'canal';
  ctx.save();
  ctx.lineCap = 'round';
  /* broad pale veins of mist, crossing the whole board on lazy curves */
  for (let i = 0; i < 12; i++) {
    const x0 = rand() * LOGICAL_W - BLEED_X;
    const y0 = rand() * LOGICAL_H - BLEED_Y;
    const x1 = x0 + (rand() - 0.5) * 3600;
    const y1 = y0 + (rand() - 0.5) * 1800;
    const cx = (x0 + x1) / 2 + (rand() - 0.5) * 900;
    const cy = (y0 + y1) / 2 + (rand() - 0.5) * 700;
    ctx.beginPath();
    ctx.moveTo((x0 + BLEED_X) * SCALE, (y0 + BLEED_Y) * SCALE);
    ctx.quadraticCurveTo((cx + BLEED_X) * SCALE, (cy + BLEED_Y) * SCALE, (x1 + BLEED_X) * SCALE, (y1 + BLEED_Y) * SCALE);
    ctx.lineWidth = (90 + rand() * 170) * SCALE;
    ctx.strokeStyle = canal ? `rgba(198,186,158,${0.035 + rand() * 0.035})` : `rgba(172,166,150,${0.03 + rand() * 0.03})`;
    ctx.stroke();
  }
  /* a few darker veins, like old damp stains */
  for (let i = 0; i < 5; i++) {
    const x0 = rand() * LOGICAL_W - BLEED_X;
    const y0 = rand() * LOGICAL_H - BLEED_Y;
    const x1 = x0 + (rand() - 0.5) * 2600;
    const y1 = y0 + (rand() - 0.5) * 1400;
    ctx.beginPath();
    ctx.moveTo((x0 + BLEED_X) * SCALE, (y0 + BLEED_Y) * SCALE);
    ctx.lineTo((x1 + BLEED_X) * SCALE, (y1 + BLEED_Y) * SCALE);
    ctx.lineWidth = (50 + rand() * 110) * SCALE;
    ctx.strokeStyle = `rgba(40,32,22,${0.03 + rand() * 0.03})`;
    ctx.stroke();
  }
  /* craquelure: short seeded hairline cracks, kept off the town clusters */
  ctx.lineWidth = Math.max(0.5, 1.1 * SCALE);
  for (let i = 0; i < 170; i++) {
    const x = rand() * LOGICAL_W - BLEED_X;
    const y = rand() * LOGICAL_H - BLEED_Y;
    const a = rand() * Math.PI * 2;
    const len = 18 + rand() * 70;
    const mx = x + Math.cos(a) * len * 0.5;
    const my = y + Math.sin(a) * len * 0.5;
    if (townDistance(mx, my) < 110) continue;
    ctx.beginPath();
    ctx.moveTo((x + BLEED_X) * SCALE, (y + BLEED_Y) * SCALE);
    ctx.lineTo((x + Math.cos(a) * len + BLEED_X) * SCALE, (y + Math.sin(a) * len + BLEED_Y) * SCALE);
    ctx.strokeStyle = `rgba(30,24,16,${0.04 + rand() * 0.045})`;
    ctx.stroke();
  }
  ctx.restore();
}

/** rail era only: dark soot above the industrial towns, plus wide banks
 *  of pale smoke haze drifting over the whole land */
function drawSmoke(ctx: CanvasRenderingContext2D): void {
  const rand = mulberry32(SEED_SMOKE);
  ctx.save();
  const blob = (x: number, y: number, rLogical: number, inner: string) => {
    const r = rLogical * SCALE;
    const px = (x + BLEED_X) * SCALE;
    const py = (y + BLEED_Y) * SCALE;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = grad;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  };
  /* soot clinging to the mill towns */
  for (const town of TOWNS) {
    const c = townChrome(town);
    const blobs = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < blobs; i++) {
      blob(c.ax + (rand() - 0.5) * 220, c.ay + (rand() - 0.5) * 160, 110 + rand() * 170, `rgba(24,21,18,${0.26 + rand() * 0.1})`);
    }
  }
  /* pale haze banks, some drifting into the bleed */
  for (let i = 0; i < 16; i++) {
    const x = rand() * LOGICAL_W - BLEED_X;
    const y = rand() * LOGICAL_H - BLEED_Y;
    blob(x, y, 240 + rand() * 320, `rgba(158,154,146,${0.05 + rand() * 0.07})`);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* hybrid painted × procedural fusion                                   */
/*                                                                     */
/* The historical painted grounds bring back the hand-painted matter   */
/* the pure heightfield lacks: brush grain, broad mist-and-vale light, */
/* patina. They are fused INTO the procedural ground — never drawn as  */
/* plain sprites — by transferring their luminance structure onto the  */
/* procedural palette, per pixel, once, on the offscreen canvas:       */
/*                                                                     */
/*   out = lf · lerp(proc, paint · procLum/paintLum, kChroma · w)      */
/*                                                                     */
/* lf mixes the painting's broad tonal structure (low-pass lum/mean,   */
/* gentle) with its fine grain (lum/low-pass, stronger); w is the      */
/* bake-time paintMask (0 on the clusters/routes). The chroma term     */
/* re-tints the painting to the procedural brightness, so only its     */
/* hue mood bleeds through. Weights stay partial and the factors are   */
/* clamped, so the board keeps its own light and never turns muddy.    */
/* ------------------------------------------------------------------ */

const PAINTED_URL = { canal: '/map-era-canal.webp', rail: '/map-era-rail.webp' } as const;

/* fusion strength: broad tonal structure follows the painting gently
   (rail leans further into its smoke-stained print), the fine grain
   follows it strongly, and a small chroma pull borrows the palette mood */
const PAINT_TONE = { canal: 0.55, rail: 0.62 } as const;
const PAINT_DETAIL = 0.72;
const PAINT_CHROMA = { canal: 0.28, rail: 0.3 } as const;
/* per-channel floors ON the masked network (towns/routes): the painting's
   recognizable broad marks and hues are largely silenced there, but its
   brush matter must still cover them almost fully — otherwise the calm
   glades read as a flat hub-and-spoke blob against the fused country */
const PAINT_DETAIL_FLOOR = 0.78;
const PAINT_TONE_FLOOR = 0.22;
const PAINT_CHROMA_FLOOR = 0.15;
/* post-fusion play-area luminance renormalization: the fusion must never
   darken the board globally — canal lifts a touch, rail stays smokier */
const PAINT_LIFT = { canal: 1.08, rail: 1.0 } as const;
/* low-pass radius for the tone/detail split, in render px (~28 logical) */
const PAINT_BLUR = 14;
/* clamps on the transferred factors: the painting modulates, never crushes */
const TONE_MIN = 0.5;
const TONE_MAX = 1.9;
const DETAIL_MIN = 0.6;
const DETAIL_MAX = 1.55;

type PaintedMaps = Record<'canal' | 'rail', HTMLImageElement | null>;
let painted: PaintedMaps | null = null;
let paintPrep: Promise<void> | null = null;

function loadPainted(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** preloads the two historical painted grounds for the hybrid fusion;
 *  never rejects — a missing webp just leaves that era purely procedural.
 *  Await it before the first getProceduralBoardTextures() call (the board
 *  boot and the minimap both do), so the cached canvases are born fused. */
export function prepareProceduralBoardMaps(): Promise<void> {
  paintPrep ??= Promise.all([loadPainted(PAINTED_URL.canal), loadPainted(PAINTED_URL.rail)])
    .then(([canal, rail]) => {
      painted = { canal, rail };
    })
    .catch(() => {
      painted = { canal: null, rail: null };
    });
  return paintPrep;
}

/** separable box blur (sliding window, clamped edges) — one-time bake */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

/** fuses the historical painting into the freshly baked procedural ground
 *  (in place on the ground's ImageData): luminance-structure transfer +
 *  a measured chroma bleed, weighted by the paintMask lattice, then a
 *  play-area luminance renormalization so the fusion redistributes the
 *  board's light instead of dimming it */
function fusePainting(ctx: CanvasRenderingContext2D, img: HTMLImageElement, t: Terrain, era: 'canal' | 'rail'): void {
  const scratch = document.createElement('canvas');
  scratch.width = RENDER_W;
  scratch.height = RENDER_H;
  const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, RENDER_W, RENDER_H);
  const paint = sctx.getImageData(0, 0, RENDER_W, RENDER_H).data;
  const base = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  const out = base.data;
  const N = RENDER_W * RENDER_H;
  /* play area in render px (bleed cropped): all means are measured there,
     not over the painting's misty/dark bleed */
  const ax0 = Math.round(BLEED_X * SCALE);
  const ay0 = Math.round(BLEED_Y * SCALE);
  const ax1 = ax0 + Math.round(WORLD_W * SCALE);
  const ay1 = ay0 + Math.round(WORLD_H * SCALE);
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    lum[i] = 0.299 * paint[j] + 0.587 * paint[j + 1] + 0.114 * paint[j + 2];
  }
  const low = boxBlur(lum, RENDER_W, RENDER_H, PAINT_BLUR);
  /* normalize the broad structure around 1 ON THE PLAY AREA */
  let meanLow = 0;
  for (let py = ay0; py < ay1; py++) for (let px = ax0; px < ax1; px++) meanLow += low[py * RENDER_W + px];
  meanLow /= (ax1 - ax0) * (ay1 - ay0);
  const toneK = PAINT_TONE[era];
  const chromaK = PAINT_CHROMA[era];
  let procMean = 0;
  let fusedMean = 0;
  for (let py = 0; py < RENDER_H; py++) {
    const gy = py / SCALE / CELL;
    const inY = py >= ay0 && py < ay1;
    for (let px = 0; px < RENDER_W; px++) {
      const i = py * RENDER_W + px;
      const j = i * 4;
      const w = bilinear(t.paintMask, px / SCALE / CELL, gy);
      const pl = 0.299 * out[j] + 0.587 * out[j + 1] + 0.114 * out[j + 2];
      const tone = clamp(low[i] / meanLow, TONE_MIN, TONE_MAX);
      const detail = clamp(lum[i] / Math.max(low[i], 3), DETAIL_MIN, DETAIL_MAX);
      /* every channel keeps a floor on the masked network: the painting's
         broad marks and hues retreat there, its brush matter stays */
      const lf = lerp(1, tone, toneK * lerp(PAINT_TONE_FLOOR, 1, w)) * lerp(1, detail, PAINT_DETAIL * lerp(PAINT_DETAIL_FLOOR, 1, w));
      /* the painting recolored at the procedural brightness: hue only */
      const s = pl / Math.max(lum[i], 3);
      const ck = chromaK * lerp(PAINT_CHROMA_FLOOR, 1, w);
      out[j] = lf * lerp(out[j], paint[j] * s, ck);
      out[j + 1] = lf * lerp(out[j + 1], paint[j + 1] * s, ck);
      out[j + 2] = lf * lerp(out[j + 2], paint[j + 2] * s, ck);
      if (inY && px >= ax0 && px < ax1) {
        procMean += pl;
        fusedMean += 0.299 * out[j] + 0.587 * out[j + 1] + 0.114 * out[j + 2];
      }
    }
  }
  /* measured gain: bring the fused play area back to the procedural mean
     (× era lift), clamped so a pathological painting can never blow up */
  const gain = clamp((procMean * PAINT_LIFT[era]) / Math.max(fusedMean, 1), 0.8, 1.35);
  if (Math.abs(gain - 1) > 0.005) {
    for (let i = 0; i < N; i++) {
      const j = i * 4;
      out[j] *= gain;
      out[j + 1] *= gain;
      out[j + 2] *= gain;
    }
  }
  ctx.putImageData(base, 0, 0);
}

/* ------------------------------------------------------------------ */
/* public API (lazy, cached at module level)                           */
/* ------------------------------------------------------------------ */

interface BoardAssets {
  canal: Texture;
  rail: Texture;
  canalCanvas: HTMLCanvasElement;
  railCanvas: HTMLCanvasElement;
}

let assets: BoardAssets | null = null;

function buildAssets(): BoardAssets {
  const t = terrain ?? buildTerrain();
  terrain = t;

  const canalCanvas = document.createElement('canvas');
  const canalCtx = paintGround(canalCanvas, t, buildLut(CANAL_STOPS), 1);
  /* the painting fuses INTO the bare ground; every aligned overlay (fields,
     verges, contours, rivers, groves, patina) is then drawn ON TOP of the
     hybrid, so the geographic signal keeps its crispness and its life */
  if (painted?.canal) fusePainting(canalCtx, painted.canal, t, 'canal');
  drawFields(canalCtx, t, 'canal');
  drawVerges(canalCtx, 'canal');
  drawContours(canalCtx, t, 'canal');
  drawRivers(canalCtx, t, 'rgba(18,30,28,0.72)', 'rgba(96,138,118,0.72)', 'rgba(190,214,198,0.3)');
  drawGroves(canalCtx, t, 'canal');
  drawPatina(canalCtx, 'canal');

  const railCanvas = document.createElement('canvas');
  const railCtx = paintGround(railCanvas, t, buildLut(CANAL_STOPS, railTint), 1.5);
  if (painted?.rail) fusePainting(railCtx, painted.rail, t, 'rail');
  drawFields(railCtx, t, 'rail');
  drawVerges(railCtx, 'rail');
  drawContours(railCtx, t, 'rail');
  drawRivers(railCtx, t, 'rgba(14,20,19,0.72)', 'rgba(62,82,70,0.76)', 'rgba(150,164,152,0.34)');
  drawGroves(railCtx, t, 'rail');
  drawPatina(railCtx, 'rail');
  drawSmoke(railCtx);

  return { canal: Texture.from(canalCanvas), rail: Texture.from(railCanvas), canalCanvas, railCanvas };
}

/** the two era grounds, generated once and cached (never in the ticker) */
export function getProceduralBoardTextures(): ProceduralBoardTextures {
  assets ??= buildAssets();
  return assets;
}

const previewCache = new Map<number, { canal: string; rail: string }>();

/** lightweight data URLs of the PLAY AREA (bleed cropped) for the minimap */
export function getProceduralBoardPreviewUrls(width = 384): { canal: string; rail: string } {
  assets ??= buildAssets();
  const cached = previewCache.get(width);
  if (cached) return cached;
  const w = Math.max(16, Math.round(width));
  const h = Math.round((w * WORLD_H) / WORLD_W);
  /* source rect of the play area inside the full render (bleed cropped, so
     minimap overlays keep their world→minimap linear mapping) */
  const sx = BLEED_X * SCALE;
  const sy = BLEED_Y * SCALE;
  const sw = WORLD_W * SCALE;
  const sh = WORLD_H * SCALE;
  const out = { canal: '', rail: '' };
  for (const key of ['canal', 'rail'] as const) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(assets[key === 'canal' ? 'canalCanvas' : 'railCanvas'], sx, sy, sw, sh, 0, 0, w, h);
    out[key] = c.toDataURL('image/jpeg', 0.85);
  }
  previewCache.set(width, out);
  return out;
}
