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

/** how long another seat's move is shown the survey's way (ms): the
 *  board's veil lasts about as long, so the two clocks agree */
export const GLIMPSE_MS = 1500;

export const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

/* the hand dock overlays the bottom of the screen. The board is framed on
   the room the HUD leaves it, not on the whole canvas: the dock says how
   tall it stands (its open height, so the board does not breathe each time
   the hand folds) and the fit takes that strip off the height it fits the
   world into. FIT_PAD_BOTTOM is only what is assumed before a dock has
   spoken, and after it has gone (a game being read, a spectator's table).
   The world centre stays at the container centre, so worldToScreen and
   screenToWorld remain exact inverses; the strip is won back by the pan,
   which may lift the map until its southern edge clears the dock. */
export const FIT_PAD_BOTTOM = 88;

let fitReserve = FIT_PAD_BOTTOM;
const reserveListeners = new Set<() => void>();

/** the height (px, from the bottom of the frame) the HUD holds over the
 *  board; called by the hand dock, never by the board itself */
export function setFitReserve(px: number): void {
  const next = Math.max(0, Math.round(px));
  if (next === fitReserve) return;
  fitReserve = next;
  for (const fn of [...reserveListeners]) fn();
}

export const getFitReserve = (): number => fitReserve;

export function subscribeFitReserve(fn: () => void): () => void {
  reserveListeners.add(fn);
  return () => reserveListeners.delete(fn);
}

/** scale that fits the whole world inside a cw×ch container, minus the
 *  bottom strip the HUD holds (never less than half the height) */
export function fitScale(cw: number, ch: number): number {
  if (cw <= 0 || ch <= 0) return 1;
  return Math.min(cw / WORLD_W, Math.max(ch - fitReserve, ch / 2) / WORLD_H);
}

/** how far (px, upward) the map must be lifted at scale s for its southern
 *  edge to clear the HUD's strip */
function liftFor(s: number, ch: number): number {
  return Math.max(0, (WORLD_H * s) / 2 + fitReserve - ch / 2);
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
  /* upward, the map may always rise far enough to show its southern towns
     above the hand, even where the bleed alone would not allow it */
  const up = Math.max(my, liftFor(s, ch));
  /* while the whole play area fits in the strip above the hand, it stays
     in that strip: nothing of it is ever pushed under the dock at a view
     that could show it all */
  const free = ch - fitReserve;
  const hh = (WORLD_H * s) / 2;
  const [lo, hi] = 2 * hh <= free ? [hh - ch / 2, free - hh - ch / 2] : [-up, my];
  return {
    k: clampK(v.k),
    x: Math.min(mx, Math.max(-mx, v.x)),
    y: Math.min(hi, Math.max(lo, v.y)),
  };
}

/** the whole-board view framed on the room the HUD leaves: the world at the
 *  fit, its centre raised to the middle of the free strip above the hand.
 *  The camera's fit and its opening view are meant to use this. */
export function fitView(cw: number, ch: number): View {
  return clampPan({ k: 1, x: 0, y: -fitReserve / 2 }, cw, ch);
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

/** the least zoom at which world point (wx,wy) can sit in the middle of the
 *  screen: nearer the edge, the pan clamp holds the map back unless the
 *  camera is close enough that the bleed covers the rest of the screen */
export function kToCentre(wx: number, wy: number, cw: number, ch: number): number {
  const fit = fitScale(cw, ch);
  if (fit <= 0) return 1;
  const roomX = Math.max(1, (WORLD_W / 2 + BLEED_X - Math.abs(wx - WORLD_W / 2)) * fit);
  const roomY = Math.max(1, (WORLD_H / 2 + BLEED_Y - Math.abs(wy - WORLD_H / 2)) * fit);
  return clampK(Math.max(cw / 2 / roomX, ch / 2 / roomY) * 1.03);
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
 * Far-zoom level of detail. Only the income/VP band of a built tile fades
 * when the camera stands far back; the owner's rim, the level, the stock,
 * the points and the seal are read at every zoom. The threshold is a zoom
 * over the fit, not an absolute screen scale: the fitted view itself sits
 * under any absolute threshold on every screen below 1760×1078, so one
 * indexed on the screen scale would keep the band hidden at the opening
 * view whatever the window. At the fit and just past it the band is away;
 * the first steps of zoom bring it back.
 */
export const FAR_LOD_K = 1.2;

/** the income/VP band's alpha at zoom k (over the fit): 0 far back, 1 closer in */
export function farDetail(k: number): 0 | 1 {
  return k < FAR_LOD_K ? 0 : 1;
}

/** @deprecated an absolute screen-scale threshold, kept only for the board
 *  until it reads `farDetail(k)` instead */
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

/* ---------------- HUD hung from a point of the map ---------------- */

export interface MapAnchor {
  /** the point of the map, in world units */
  wx: number;
  wy: number;
  /** offset from that point, in screen pixels */
  px?: number;
  py?: number;
  /** keep this many pixels from the left and right edges of the frame */
  clampX?: number;
}

export interface AnchorRegistry {
  /** hang an element from the map; the element is placed at once, and
   *  kept in place by the ticker until the returned function is called */
  register(el: HTMLElement, at: MapAnchor): () => void;
}

/** the element's place for this view of the map */
export function placeAnchor(el: HTMLElement, at: MapAnchor, v: View, w: number, h: number): void {
  const [sx, sy] = worldToScreen(at.wx, at.wy, v, w, h);
  const x = at.clampX ? Math.max(at.clampX, Math.min(w - at.clampX, sx)) : sx;
  el.style.left = `${x + (at.px ?? 0)}px`;
  el.style.top = `${sy + (at.py ?? 0)}px`;
}
