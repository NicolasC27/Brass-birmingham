/* ------------------------------------------------------------------ */
/* Board pan/zoom view math.                                           */
/* The interactive layer lives on a fixed 3200×1800 "world" surface    */
/* (v13: maximum air — authentic 1600×1100 layout ×2.0/×1.63636, i.e.  */
/* ×1.25 on both axes from the v11 2560×1440 world; town clusters stay */
/* small brassforge-style islands inside ample open country).          */
/* `k` is zoom relative to fit, `x`/`y` are the pixel offset of the    */
/* world centre from the container centre.                             */
/* ------------------------------------------------------------------ */

export const WORLD_W = 3200;
export const WORLD_H = 1800;
/* zoom is a factor over the fit: 1 shows the whole world, and the board
   never zooms out past it — a smaller map only pushed plaques and tiles
   below what the eye can read and left empty space around. */
export const MIN_K = 1;
export const MAX_K = 3;

export interface View {
  k: number;
  x: number;
  y: number;
}

export const FIT_VIEW: View = { k: 1, x: 0, y: 0 };

export const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

/** scale that fits the whole world inside a cw×ch container */
export function fitScale(cw: number, ch: number): number {
  if (cw <= 0 || ch <= 0) return 1;
  return Math.min(cw / WORLD_W, ch / WORLD_H);
}

/** clamp pan so at least `margin` px of the map stays reachable on each axis */
/** the paintings run BLEED px of countryside past the play area on every
 *  side; the camera may drift into that margin but never past it, so the
 *  table's black never shows */
export const BLEED_X = 480;
export const BLEED_Y = 270;
export function clampPan(v: View, cw: number, ch: number): View {
  const s = fitScale(cw, ch) * v.k;
  const mx = Math.max(0, (WORLD_W * s) / 2 + BLEED_X * s - cw / 2);
  const my = Math.max(0, (WORLD_H * s) / 2 + BLEED_Y * s - ch / 2);
  return {
    k: clampK(v.k),
    x: Math.min(mx, Math.max(-mx, v.x)),
    y: Math.min(my, Math.max(-my, v.y)),
  };
}

/** world (viewBox) coords → container pixels */
export function worldToScreen(wx: number, wy: number, v: View, cw: number, ch: number): [number, number] {
  const s = fitScale(cw, ch) * v.k;
  return [cw / 2 + (wx - WORLD_W / 2) * s + v.x, ch / 2 + (wy - WORLD_H / 2) * s + v.y];
}

/** container pixels → world (viewBox) coords */
export function screenToWorld(sx: number, sy: number, v: View, cw: number, ch: number): [number, number] {
  const s = fitScale(cw, ch) * v.k;
  if (s === 0) return [WORLD_W / 2, WORLD_H / 2];
  return [WORLD_W / 2 + (sx - cw / 2 - v.x) / s, WORLD_H / 2 + (sy - ch / 2 - v.y) / s];
}

/** zoom by `factor`, keeping the world point under container point (sx,sy) fixed */
export function zoomAt(v: View, sx: number, sy: number, factor: number, cw: number, ch: number): View {
  const k2 = clampK(v.k * factor);
  const r = k2 / v.k;
  const cx = cw / 2;
  const cy = ch / 2;
  return clampPan(
    { k: k2, x: sx - cx - (sx - cx - v.x) * r, y: sy - cy - (sy - cy - v.y) * r },
    cw,
    ch,
  );
}

/** view that centres world point (wx,wy) at zoom k */
export function centeredOn(wx: number, wy: number, k: number, cw: number, ch: number): View {
  const k2 = clampK(k);
  const s = fitScale(cw, ch) * k2;
  return clampPan({ k: k2, x: -(wx - WORLD_W / 2) * s, y: -(wy - WORLD_H / 2) * s }, cw, ch);
}

/** counter-scale factor keeping town plaques readable across the zoom range */
export function labelScale(k: number): number {
  return Math.min(2.2, Math.max(0.75, 1 / k));
}

/** name-plaque text never renders below this many screen px (v11) */
export const RIBBON_MIN_SCREEN = 13;

/**
 * v14: hard cap on the plaque counter-scale — the floor below can never
 * blow ribbons past RIBBON_MAX_SCALE × their world size. At max zoom-out
 * (MIN_K = 0.75) on a 1080p container the uncapped floor would have
 * reached ~3× world size, hiding the map behind giant plaques; capped at
 * 1.5× the ribbons stay proportioned and the map remains visible.
 */
export const RIBBON_MAX_SCALE = 1.5;

/**
 * v14: far-zoom LOD threshold. When the EFFECTIVE screen scale
 * `fitScale(cw,ch) * k` drops below this, fine details that would be
 * unreadable anyway (income/VP chips, level pips, etched tile marks,
 * merchant name ribbons) fade out — town ribbons, industry tiles with
 * their cubes and links always stay (critical game state). Board.tsx is
 * the single place that evaluates this threshold and toggles the
 * `--bw-detail` CSS var; components just consume the var.
 */
export const FAR_LOD_SCREEN = 0.55;


/**
 * Plaque counter-scale with a hard screen-size floor (v11) and a hard
 * scale ceiling (v14): town, farm and merchant ribbons never render below
 * RIBBON_MIN_SCREEN px on screen *unless* that would exceed
 * RIBBON_MAX_SCALE × their world size. `fit` is the fitScale of the
 * container, `fontWorld` the plaque font size in world units. The floor
 * only ever ENLARGES plaques when they get too small; the ceiling keeps
 * them proportioned at deep zoom-out; at high zoom the plain labelScale
 * applies unchanged.
 */
export function ribbonLabelScale(k: number, fit: number, fontWorld: number, floorPx = RIBBON_MIN_SCREEN): number {
  const s = fit * k;
  if (s <= 0 || fontWorld <= 0) return labelScale(k);
  return Math.min(RIBBON_MAX_SCALE, Math.max(labelScale(k), floorPx / (fontWorld * s)));
}
