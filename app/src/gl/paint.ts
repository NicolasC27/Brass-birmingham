import { Assets, Container, FillGradient, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { INDUSTRIES, LINKS, MERCHANTS, PLAYER_COLORS, TOWNS } from '@/game/data';
import { townColor } from '@/game/townColors';
import { routeFor } from '@/components/game/routePaths';
import { merchantOpen, tileKey } from '@/game/engine';
import { tr } from '@/i18n';
import type { GameState, IndustryType, LinkDef } from '@/game/types';
import { RIBBON_FONT, RIBBON_H, TILE, TILE_HALF, ribbonWidth, townChrome } from '@/components/game/townChrome';

/* ------------------------------------------------------------------ */
/* paint.ts — WebGL scene graph for the board, at visual parity with   */
/* the SVG reference (Board.tsx / TownNode.tsx / townChrome.ts):       */
/* winding links (canal water ribbons / rail ballast + sleepers),      */
/* towns (painted villages, slot tiles as transparent cutouts on dark    */
/* cards, built works as full player-colour cards with level pips and    */
/* resource badges), merchant tavern signs, parchment ribbons.           */
/* Everything is redrawn on game-state change (a few times per turn —  */
/* cheap), and ONLY the camera moves per frame.                        */
/* ------------------------------------------------------------------ */

const hex = (s: string): number => parseInt(s.replace('#', ''), 16);
/** stock-badge layouts on built tiles (A-B probe) */
export type StockStyle = 'counter' | 'big' | 'tag' | 'top' | 'corner';
/** empty-slot face: sepia engraving printed on the board, or the colour painting */
export type SlotArt = 'engraved' | 'painted';
/** income / VP on built cards: one quiet bottom band, or two boxed chips */
export type ChipStyle = 'band' | 'chips';
/** tile painting set: the original icons (cart, barrel…) or the buildings
 *  drawn in tools/tiles (colliery, brewhouse…) — served from /tiles-works */
export type TileStyle = 'icons' | 'works';
/** how a built card is dressed (board options) */
export interface TileLook {
  slotArt: SlotArt;
  /** colour-blind mode: the owner's shape on built cards and/or links */
  colorBlind: boolean;
  sealTiles: boolean;
  sealLinks: boolean;
  cardGrain: boolean;
  chipStyle: ChipStyle;
}
export const DEFAULT_TILE_LOOK: TileLook = { slotArt: 'engraved', colorBlind: false, sealTiles: true, sealLinks: true, cardGrain: true, chipStyle: 'band' };
const playerHex = (game: GameState, i: number): number => hex(PLAYER_COLORS[game.players[i].color]?.hex ?? '#C9A45C');
/** industry key → icon asset (key 'manufacturer' vs file 'manufacture') */
const ICON_FOR: Record<IndustryType, string> = {
  coal: '/icon-coal.svg',
  iron: '/icon-iron.svg',
  cotton: '/icon-cotton.svg',
  manufacturer: '/icon-manufacture.svg',
  pottery: '/icon-pottery.svg',
  brewery: '/icon-brewery.svg',
};
/** industry key → asset file stem ('manufacturer' vs file 'manufacture') */
const FILE_FOR: Record<IndustryType, string> = {
  coal: 'coal',
  iron: 'iron',
  cotton: 'cotton',
  manufacturer: 'manufacture',
  pottery: 'pottery',
  brewery: 'brewery',
};
/** empty-slot art: the painting cut out on transparency (no baked backdrop) */
const CUT_FOR = (i: IndustryType): string => `/tile-${FILE_FOR[i]}-cut.png`;
/** built works: painting precomposed on the OWNER's colour, like the
 *  physical game — the whole tile card is the ownership marker */
const BUILT_FOR = (i: IndustryType, color: string): string => `/tile-${FILE_FOR[i]}-${color}.png`;

export interface SlotView {
  ring: Graphics; // unused by towns (kept for the ticker's alpha write)
  frame: Graphics; // tile body (empty dark card / flipped muted card)
  art: Sprite; // painted face (slot cutout / built player-colour card)
  art2: Sprite; // right-half painting for dual-industry slots
  artMask: Graphics; // GPU-rounded clip on the built card (empty otherwise)
  schematic: Container; // far-zoom parchment industry glyph(s)
  schemDisc: Graphics; // schematic neutral disc (redrawn per industry)
  schemGlyph: Sprite; // schematic icon, first (or only) industry
  schemGlyph2: Sprite; // second icon — dual-industry slots show BOTH, big
  extras: Graphics; // far-LOD details: level pips
  detailC: Container; // LOD text details: etched mark, income/VP chips
  badges: Container; // flipped rim/VP + resource cubes/barrels (always visible)
  deco: Container; // empty-slot chrome: frame lip, top glow
  hit: Graphics;
  /** per-frame alphas recomputed in the ticker from these bases */
  artBase: number; // painting alpha at rest (1 shown / 0 flipped)
  spotAlpha: number; // player spotlight dimming (1 or 0.3)
  hasTile: boolean; // built works present
  flipped: boolean; // ember VP face — no schematic glyph, no painting
}

export interface TownView {
  slots: SlotView[];
  ribbon: Container;
  plaque: Graphics;
}

export interface BoardScene {
  world: Container;
  bgCanal: Sprite;
  bgRail: Sprite;
  overlay: Container; // planning highlights, ghost lines, FX — above towns
  linkGfx: Map<string, Graphics>;
  linkHit: Map<string, Graphics>;
  towns: Map<string, TownView>;
  merchantBeer: Map<string, Container>;
  /** all ribbon containers (towns + merchants) for the counter-scale pass */
  ribbons: Container[];
  redraw: (game: GameState) => void;
  setSpotlight: (player: number | null) => void;
  /** light only these slots (null = back to the spotlight rule) */
  setHighlight: (keys: string[] | null) => void;
  /** hide unbuilt link traces (board option, keyboard C) */
  setHideUnbuilt: (hide: boolean) => void;
  /** larger income/VP chips on built tiles (board option) */
  setBigChips: (big: boolean) => void;
  /** grey out merchant bonuses not yet claimed (board option) */
  setGreyFreeMerchants: (grey: boolean) => void;
  /** switch the stock-badge layout on built tiles (A-B probe) */
  setStockStyle: (s: StockStyle) => void;
  /** empty-slot art, owner seal, paper grain, income/VP layout (board options) */
  setTileLook: (look: TileLook) => void;
  /** swap the painting set (loads the alternate set on first use) */
  setTileStyle: (style: TileStyle) => Promise<void>;
}

/** every painting-derived texture for one tile style */
interface TileSet {
  cut: Record<IndustryType, Texture>; // transparent cutouts (empty slots, merchants)
  built: Record<IndustryType, Record<string, Texture>>; // per-owner-colour cards (plain)
  builtGrain: Record<IndustryType, Record<string, Texture>>; // same, paper grain baked in
  halfL: Record<IndustryType, Texture>; // colour left half (dual slots, fallback)
  halfR: Record<IndustryType, Texture>; // colour right half (fallback)
  pair: Record<string, Texture>; // combined dual-industry cutouts: key "a-b" (sorted)
  print: Record<IndustryType, Texture>; // engraved sepia print (empty slots)
  printHalfL: Record<IndustryType, Texture>; // engraved left half (dual slots, fallback)
  printHalfR: Record<IndustryType, Texture>; // engraved right half (fallback)
  printPair: Record<string, Texture>; // engraved combined dual-industry prints
}
/** industries that have a building painting in /tiles-works */
const WORKS_INDUSTRIES: IndustryType[] = ['coal', 'brewery'];
const WORKS_DIR = '/tiles-works';
const tileSets: Partial<Record<TileStyle, TileSet>> = {};
let tileSet: TileSet; // the set currently painted
let iconTex: Record<IndustryType, Texture>;
let schematicTex: Record<IndustryType, Texture>;
let barrelTex: Texture;
let boatTex: Texture; // night barge — the merchants' default framed painting
/* one painting per merchant when /merchant-<id>.png exists (e.g. Gloucester
   docks); the shared barge otherwise */
const merchantArt = new Map<string, Texture>();
let villageTex: Texture;

/** canonical key for a dual-industry slot painting */
export const pairKey = (a: IndustryType, b: IndustryType): string => [a, b].sort().join('-');
/** pair painting file stem (sorted FILE stems — 'manufacture', not the key) */
const pairFile = (a: IndustryType, b: IndustryType): string => [FILE_FOR[a], FILE_FOR[b]].sort().join('-');

/** multiply an rgb int by f (clamped) — muted/brightened owner colour */
/** lighten toward white by `f` (0..1) */
const tint = (c: number, f: number): number => {
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * f));
  return (ch((c >> 16) & 0xff) << 16) | (ch((c >> 8) & 0xff) << 8) | ch(c & 0xff);
};
const shade = (c: number, f: number): number => {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
};

/** The /icon-*.svg line art is black; tint multiplies and can never turn
 *  black into parchment — so rasterize a light version once via canvas
 *  (invert + warm lift), matching the SVG's SchematicGlyph (#F5EBD2). */
async function parchmentTexture(url: string): Promise<Texture> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'invert(0.92) sepia(0.35) brightness(1.15)';
  ctx.drawImage(img, 0, 0, 64, 64);
  return Texture.from(c);
}

/** Empty slots are PRINTED on the board, built works are physical cards
 *  laid on top (official board: grey printed icons vs. player-colour tiles).
 *  Rebake a painting as a monochrome sepia engraving — ink for the darks,
 *  parchment for the lights — so the colour of a placed tile is the only
 *  colour in the slot grid. Done once per texture at load. */
function engraveTexture(tex: Texture): Texture {
  const src = tex.source.resource as CanvasImageSource | undefined;
  if (!src) return tex;
  const w = tex.width;
  const h = tex.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return tex;
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  /* ink #2a2118 → faded parchment #bfa982, slight gamma so mid-tones stay legible */
  const ink = [0x2a, 0x21, 0x18];
  const paper = [0xbf, 0xa9, 0x82];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = Math.pow((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, 0.85);
    d[i] = ink[0] + (paper[0] - ink[0]) * lum;
    d[i + 1] = ink[1] + (paper[1] - ink[1]) * lum;
    d[i + 2] = ink[2] + (paper[2] - ink[2]) * lum;
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(c);
}

/** Built cards are cardboard: a faint paper grain (art direction: 4–7 %
 *  overlay) baked once into the owner-colour card texture. Deterministic
 *  hashed cells of a few texels so the grain still shows once the card is
 *  scaled down to its ~60–100 px on screen. */
function grainTexture(tex: Texture): Texture {
  const src = tex.source.resource as CanvasImageSource | undefined;
  if (!src) return tex;
  const w = tex.width;
  const h = tex.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return tex;
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cell = Math.max(1, Math.round(w / 110));
  const amp = 14; // ≈ ±5.5 % of full range
  for (let y = 0; y < h; y++) {
    const cy = Math.floor(y / cell);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const cx = Math.floor(x / cell);
      let n = (cx * 374761393 + cy * 668265263) | 0;
      n = ((n ^ (n >>> 13)) * 1274126177) | 0;
      const g = (((n ^ (n >>> 16)) & 0xffff) / 0xffff - 0.5) * 2 * amp;
      d[i] = Math.max(0, Math.min(255, d[i] + g));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + g));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + g));
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(c);
}

/** the dual-industry slot pairs printed on the board */
function dualPairs(): [IndustryType, IndustryType][] {
  const pairs: [IndustryType, IndustryType][] = [];
  for (const town of TOWNS) {
    for (const s of town.slots) {
      if (s.allows.length === 2 && !pairs.some(([a, b]) => pairKey(a, b) === pairKey(s.allows[0], s.allows[1]))) {
        pairs.push([s.allows[0], s.allows[1]]);
      }
    }
  }
  return pairs;
}

/** Load one painting set from `dir`. With a `base` set, only WORKS_INDUSTRIES
 *  (and the pairs involving them) are fetched — everything else is shared. */
async function loadTileSet(dir: string, base?: TileSet): Promise<TileSet> {
  const industries = Object.keys(ICON_FOR) as IndustryType[];
  const colorNames = Object.keys(PLAYER_COLORS);
  const own = (i: IndustryType) => !base || WORKS_INDUSTRIES.includes(i);
  const fetched = industries.filter(own);
  const loaded = await Assets.load([...fetched.map((i) => dir + CUT_FOR(i)), ...fetched.flatMap((i) => colorNames.map((c) => dir + BUILT_FOR(i, c)))]);
  const cut = Object.fromEntries(industries.map((i) => [i, own(i) ? loaded[dir + CUT_FOR(i)] : base!.cut[i]])) as TileSet['cut'];
  const built = Object.fromEntries(
    industries.map((i) => [i, own(i) ? Object.fromEntries(colorNames.map((c) => [c, loaded[dir + BUILT_FOR(i, c)]])) : base!.built[i]]),
  ) as TileSet['built'];
  const builtGrain = Object.fromEntries(
    industries.map((i) => [i, own(i) ? Object.fromEntries(colorNames.map((c) => [c, grainTexture(built[i][c])])) : base!.builtGrain[i]]),
  ) as TileSet['builtGrain'];
  /* combined dual-industry cutouts (generated: tile-<a>-<b>-cut.png, sorted
     FILE stems) — loaded tolerantly, dual slots fall back to half-crops */
  const pair: Record<string, Texture> = {};
  await Promise.all(
    dualPairs().map(async ([a, b]) => {
      const k = pairKey(a, b);
      if (!own(a) && !own(b)) {
        if (base!.pair[k]) pair[k] = base!.pair[k];
        return;
      }
      try {
        pair[k] = await Assets.load(`${dir}/tile-${pairFile(a, b)}-cut.png`);
      } catch {
        /* not generated — half-crop fallback applies */
      }
    }),
  );
  /* clean vertical halves for dual slots without a combined painting */
  const halves = (src: Record<IndustryType, Texture>, right: boolean) =>
    Object.fromEntries(
      industries.map((i) => {
        const t = src[i];
        return [i, new Texture({ source: t.source, frame: new Rectangle(right ? t.width / 2 : 0, 0, t.width / 2, t.height) })];
      }),
    ) as Record<IndustryType, Texture>;
  /* engraved prints for the empty slots (see engraveTexture) */
  const print = Object.fromEntries(industries.map((i) => [i, own(i) ? engraveTexture(cut[i]) : base!.print[i]])) as TileSet['print'];
  const printPair = Object.fromEntries(Object.entries(pair).map(([k, t]) => [k, base?.pair[k] === t ? base.printPair[k] : engraveTexture(t)]));
  return { cut, built, builtGrain, halfL: halves(cut, false), halfR: halves(cut, true), pair, print, printHalfL: halves(print, false), printHalfR: halves(print, true), printPair };
}

/** the painting set for a style, fetched on first use */
async function ensureTileSet(style: TileStyle): Promise<TileSet> {
  if (!tileSets[style]) tileSets[style] = style === 'works' ? await loadTileSet(WORKS_DIR, tileSets.icons) : await loadTileSet('');
  return tileSets[style]!;
}

/** preload every texture the scene needs (incl. boat/train icons for traffic) */
export async function loadBoardAssets(): Promise<void> {
  const industries = Object.keys(ICON_FOR) as IndustryType[];
  const urls = ['/beer-barrel.png', '/merchant-boat.png', '/town-village.png', '/vehicle-boat.png', '/boat-fx.png', '/icon-canal.svg', '/icon-rail.svg', ...industries.map((i) => ICON_FOR[i])];
  const loaded = await Assets.load(urls);
  tileSet = await ensureTileSet('icons');
  iconTex = Object.fromEntries(industries.map((i) => [i, loaded[ICON_FOR[i]]])) as Record<IndustryType, Texture>;
  barrelTex = loaded['/beer-barrel.png'];
  boatTex = loaded['/merchant-boat.png'];
  await Promise.all(
    MERCHANTS.map(async (m) => {
      try {
        merchantArt.set(m.id, await Assets.load(`/merchant-${m.id.replace(/^m-/, '')}.png`));
      } catch {
        /* no dedicated painting for this merchant: the barge is used */
      }
    }),
  );
  villageTex = loaded['/town-village.png'];
  schematicTex = Object.fromEntries(
    await Promise.all(industries.map(async (i) => [i, await parchmentTexture(ICON_FOR[i])])),
  ) as Record<IndustryType, Texture>;
}

/* The true winding route (same as the SVG board): a dense sampling of the
   bulged quad from routeFor — used for BOTH drawing and hit geometry, so
   the hover zone always sits exactly on the visible track. */
const linkPoints = (def: LinkDef): [number, number][] => routeFor(def).pts;

function tracePath(g: Graphics, pts: [number, number][]): void {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
}

/**
 * Trace a polyline as dash subpaths (SVG strokeDasharray equivalent —
 * Pixi strokes have no native dash support). One stroke() call after
 * this paints every dash.
 */
function traceDashes(g: Graphics, pts: [number, number][], on: number, off: number, dashOffset = 0): void {
  const pattern = on + off;
  const pos = (((-dashOffset) % pattern) + pattern) % pattern; // pattern position at path start
  let drawing = pos < on;
  let remain = drawing ? on - pos : pattern - pos;
  for (let i = 1; i < pts.length; i++) {
    const [sx, sy] = pts[i - 1];
    const [ex, ey] = pts[i];
    const segLen = Math.hypot(ex - sx, ey - sy);
    if (segLen === 0) continue;
    const ux = (ex - sx) / segLen;
    const uy = (ey - sy) / segLen;
    let consumed = 0;
    while (consumed < segLen - 1e-9) {
      const step = Math.min(remain, segLen - consumed);
      if (drawing) {
        g.moveTo(sx + ux * consumed, sy + uy * consumed);
        g.lineTo(sx + ux * (consumed + step), sy + uy * (consumed + step));
      }
      consumed += step;
      remain -= step;
      if (remain <= 1e-9) {
        drawing = !drawing;
        remain = drawing ? on : off;
      }
    }
  }
}

/** dashed circle outline (empty beer-slot ghost, SVG strokeDasharray '3 3.5') */
function traceDashedCircle(g: Graphics, x: number, y: number, r: number, on: number, off: number): void {
  const c = 2 * Math.PI * r;
  const n = Math.max(1, Math.round(c / (on + off)));
  const step = c / n;
  for (let i = 0; i < n; i++) {
    const a0 = (i * step) / r;
    const a1 = a0 + (on * (step / (on + off))) / r;
    g.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
    g.arc(x, y, r, a0, a1);
  }
}

/** iso-cube face palette per goods type (mirrors TownNode CUBE_PAINT) */
const CUBE_PAINT = {
  coal: { top: 0x4c463e, left: 0x1c1714, right: 0x0f0d0b, glint: 0x8c857a },
  iron: { top: 0xe39a58, left: 0xa65328, right: 0x6e2f13, glint: 0xf5c38d },
} as const;

/** small iso 3D cube (three shaded faces + brass liseré), centred on (x, y) */
function drawCube(g: Graphics, x: number, y: number, s: number, kind: keyof typeof CUBE_PAINT): void {
  const p = CUBE_PAINT[kind];
  const hw = s / 2; // half width
  const q = s / 4; // top-face slope
  const edge = { width: 0.55, color: 0xc9a45c, alpha: 0.5, join: 'round' as const };
  g.poly([x - hw, y - q, x, y, x, y + hw, x - hw, y + q]).fill(p.left).stroke(edge);
  g.poly([x, y, x + hw, y - q, x + hw, y + q, x, y + hw]).fill(p.right).stroke(edge);
  g.poly([x, y - hw, x + hw, y - q, x, y, x - hw, y - q]).fill(p.top).stroke(edge);
  /* glossy glint on the top face */
  g.poly([x - hw * 0.42, y - q * 1.35, x - hw * 0.05, y - hw * 0.72, x + hw * 0.18, y - q * 1.2, x - hw * 0.2, y - q * 0.9]).fill({
    color: p.glint,
    alpha: 0.55,
  });
}

/** shape glyph inside the owner medallion (colour + shape accessibility rule) */
function drawShapeGlyph(g: Graphics, shape: string, x: number, y: number): void {
  if (shape === 'square') g.rect(x - 4, y - 4, 8, 8).fill(0x100d0b);
  else if (shape === 'diamond') g.poly([x, y - 5.2, x + 5.2, y, x, y + 5.2, x - 5.2, y]).fill(0x100d0b);
  else if (shape === 'triangle') g.poly([x, y - 4.8, x + 4.8, y + 4, x - 4.8, y + 4]).fill(0x100d0b);
  else g.circle(x, y, 4.4).fill(0x100d0b);
}

/** owner seal on a built card: dark ring, colour disc, the player's shape */
function drawOwnerMedallion(g: Graphics, x: number, y: number, col: number, shape: string): void {
  g.circle(x, y, 7).fill(0x100d0b).stroke({ width: 0.8, color: 0xf2ead6, alpha: 0.35 });
  g.circle(x, y, 5.6).fill(col);
  drawShapeGlyph(g, shape, x, y);
}

/**
 * Name ribbon (RibbonShape in TownNode.tsx): scroll bar with small side
 * hats and engraved small caps. Shared by towns AND merchants. Without a
 * tint it's the cream parchment (merchants); WITH a tint the bar takes the
 * town's own colour with cream small caps, like the physical Brass banners.
 * The box is positioned at (cx, cy) with all geometry local, so the camera
 * counter-scale pass can rescale it in place.
 */
function makeRibbon(labelText: string, cx: number, cy: number, w: number, h: number, tint?: number): { box: Container; plaque: Graphics } {
  const box = new Container();
  box.position.set(cx, cy);
  box.eventMode = 'none';
  const l = -w / 2;
  const r = w / 2;
  const t = -h / 2;
  const b = h / 2;
  const plaque = new Graphics();
  plaque.eventMode = 'none';
  const edge = tint !== undefined ? shade(tint, 0.5) : 0x8a6b33;
  /* small side hats: wings tucked behind the bar */
  plaque.poly([l + 3, t + 4, l - 11, t + 7, l - 6, 0, l - 11, b - 1, l + 3, b + 3]).fill(tint !== undefined ? shade(tint, 0.78) : 0xc9b384).stroke({ width: 0.8, color: edge });
  plaque.poly([r - 3, t + 4, r + 11, t + 7, r + 6, 0, r + 11, b - 1, r - 3, b + 3]).fill(tint !== undefined ? shade(tint, 0.78) : 0xc9b384).stroke({ width: 0.8, color: edge });
  /* main bar: vertical gradient (parchment, or the town colour) */
  const bar = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
  if (tint !== undefined) {
    bar.addColorStop(0, shade(tint, 1.12)).addColorStop(0.52, tint).addColorStop(1, shade(tint, 0.8));
  } else {
    bar.addColorStop(0, '#F7EFDD').addColorStop(0.52, '#F4ECD8').addColorStop(1, '#DCC99E');
  }
  plaque.roundRect(l, t, w, h, 2.5).fill(bar).stroke({ width: 1.1, color: edge, alpha: 0.9 });
  /* top edge highlight + fold tuck shadows */
  plaque.moveTo(l + 3, t + 1.6).lineTo(r - 3, t + 1.6).stroke({ width: 0.9, color: 0xfffcf0, alpha: tint !== undefined ? 0.3 : 0.75 });
  plaque.poly([l + 1, b - 7, l + 1, b + 1, l + 7, b + 1]).fill({ color: tint !== undefined ? shade(tint, 0.62) : 0xa98f5e, alpha: 0.55 });
  plaque.poly([r - 1, b - 7, r - 1, b + 1, r - 7, b + 1]).fill({ color: tint !== undefined ? shade(tint, 0.62) : 0xa98f5e, alpha: 0.55 });
  /* engraved small caps; underlay gives the carved relief */
  const style = { fontFamily: "'IM Fell English SC','Playfair Display',serif", fontSize: RIBBON_FONT, letterSpacing: 1 };
  const under = new Text({ text: labelText, style: { ...style, fill: tint !== undefined ? shade(tint, 0.35) : 0xfffdf4 } });
  under.anchor.set(0.5);
  under.position.set(0, 1.1);
  under.alpha = tint !== undefined ? 0.8 : 0.6;
  const label = new Text({ text: labelText, style: { ...style, fill: tint !== undefined ? 0xf7efdd : 0x2a241c } });
  label.anchor.set(0.5);
  under.eventMode = 'none';
  label.eventMode = 'none';
  box.addChild(plaque, under, label);
  return { box, plaque };
}

export function buildBoardScene(bgCanal: Sprite, bgRail: Sprite): BoardScene {
  const world = new Container();
  const linksLayer = new Container();
  const hitLayer = new Container();
  const merchantsLayer = new Container();
  const townsLayer = new Container();
  const ribbonsLayer = new Container();
  const overlay = new Container();
  world.addChild(bgCanal, bgRail, linksLayer, merchantsLayer, townsLayer, hitLayer, ribbonsLayer, overlay);
  bgRail.alpha = 0;

  /* ------------------------------ links ------------------------------ */
  const linkGfx = new Map<string, Graphics>();
  const linkHit = new Map<string, Graphics>();
  for (const def of LINKS) {
    const g = new Graphics();
    g.eventMode = 'none';
    linksLayer.addChild(g);
    linkGfx.set(def.id, g);
    /* generous invisible hit stroke — Pixi hit-tests geometry, not alpha */
    const hit = new Graphics();
    tracePath(hit, linkPoints(def));
    hit.stroke({ width: 26, color: 0xffffff, alpha: 0 });
    hit.eventMode = 'static';
    hitLayer.addChild(hit);
    linkHit.set(def.id, hit);
  }

  /* ---------------------------- merchants ---------------------------- */
  /* The international market: a small FRAMED PAINTING (a night barge on   */
  /* the canal) in a dark wood frame with a brass bevel. In front of it,   */
  /* one physical tile per printed slot — the dealt merchant tile with the */
  /* same painted industry face as the town slots — and the beer barrel   */
  /* standing at each tile's foot. On the right, a brass bonus medallion.  */
  /* Everything that changes (tiles, barrels, claimed, closed) is redrawn  */
  /* in drawMerchants.                                                      */
  const PLATE_H = 88;
  const MT = 40; // merchant tile size
  const MT_GAP = 12;
  const MEDAL_R = 20;
  const PAD = 16;
  const TILE_TOP = -PLATE_H / 2 + 14;
  const plateWidth = (slots: number) => PAD + slots * MT + (slots - 1) * MT_GAP + 18 + MEDAL_R * 2 + PAD;
  const merchantBeer = new Map<string, Container>();
  const merchantDyn = new Map<
    string,
    { plate: Container; slots: Container; medal: Container; claimed: Container; closed: Container; slotX: number[]; medalX: number }
  >();
  const ribbons: Container[] = [];
  for (const m of MERCHANTS) {
    const W = plateWidth(m.slots);
    const plate = new Container();
    /* southern merchants (Oxford, Gloucester) sit on the map's bottom edge:
       their plate rides 34 units above the node so the hand dock never hides it */
    const south = m.y > 1500;
    plate.position.set(m.x, m.y - (south ? 34 : 0));
    plate.scale.set(1.15);
    plate.eventMode = 'none';

    /* drop shadow + dark wood frame + brass bevel */
    const frame = new Graphics();
    frame.eventMode = 'none';
    frame.roundRect(-W / 2 + 3, -PLATE_H / 2 + 6, W, PLATE_H, 9).fill({ color: 0x000000, alpha: 0.5 });
    const wood = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
    wood.addColorStop(0, '#5A4128').addColorStop(0.5, '#3E2C1B').addColorStop(1, '#2A1C10');
    frame.roundRect(-W / 2, -PLATE_H / 2, W, PLATE_H, 9).fill(wood).stroke({ width: 1.2, color: 0x1a120a });
    frame.roundRect(-W / 2 + 4, -PLATE_H / 2 + 4, W - 8, PLATE_H - 8, 6).stroke({ width: 1.6, color: 0xc9a45c, alpha: 0.9 });
    frame.roundRect(-W / 2 + 6, -PLATE_H / 2 + 6, W - 12, PLATE_H - 12, 5).stroke({ width: 0.8, color: 0x7a5a2a, alpha: 0.8 });
    plate.addChild(frame);

    /* the painting, masked to the inner frame, darkened toward the bottom so
       the tiles and barrels in front of it stay crisp */
    const artTex = merchantArt.get(m.id) ?? boatTex;
    const art = new Sprite(artTex);
    const innerW = W - 14;
    const innerH = PLATE_H - 14;
    const scale = Math.max(innerW / artTex.width, innerH / artTex.height);
    art.width = artTex.width * scale;
    art.height = artTex.height * scale;
    art.anchor.set(0.5, 0.42);
    art.position.set(0, 0);
    art.eventMode = 'none';
    const artMaskG = new Graphics().roundRect(-W / 2 + 7, -PLATE_H / 2 + 7, innerW, innerH, 5).fill(0xffffff);
    art.mask = artMaskG;
    const veil = new Graphics();
    const veilGrad = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
    veilGrad.addColorStop(0, 'rgba(10,8,6,0.05)').addColorStop(0.55, 'rgba(10,8,6,0.35)').addColorStop(1, 'rgba(10,8,6,0.72)');
    veil.roundRect(-W / 2 + 7, -PLATE_H / 2 + 7, innerW, innerH, 5).fill(veilGrad);
    veil.eventMode = 'none';
    plate.addChild(artMaskG, art, veil);

    /* tile shelves (static): a faint recess where each merchant tile sits */
    const slotX: number[] = [];
    const x0 = -W / 2 + PAD + MT / 2;
    const shelf = new Graphics();
    shelf.eventMode = 'none';
    for (let i = 0; i < m.slots; i++) {
      const x = x0 + i * (MT + MT_GAP);
      slotX.push(x);
      shelf.roundRect(x - MT / 2 - 2, TILE_TOP - 2, MT + 4, MT + 4, 6).fill({ color: 0x000000, alpha: 0.35 }).stroke({ width: 0.8, color: 0xc9a45c, alpha: 0.35 });
    }
    plate.addChild(shelf);

    /* bonus medallion: brass disc, double ring, engraved caption */
    const medalX = W / 2 - PAD - MEDAL_R;
    const medalY = -6;
    const medalG = new Graphics();
    medalG.eventMode = 'none';
    medalG.circle(medalX + 1.5, medalY + 2.5, MEDAL_R).fill({ color: 0x000000, alpha: 0.5 });
    const brass = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
    brass.addColorStop(0, '#F0D89A').addColorStop(0.45, '#C9A45C').addColorStop(1, '#7E5F28');
    medalG.circle(medalX, medalY, MEDAL_R).fill(brass).stroke({ width: 1.4, color: 0x4a3618 });
    medalG.circle(medalX, medalY, MEDAL_R - 3.5).stroke({ width: 1, color: 0x5a4520, alpha: 0.9 });
    medalG.circle(medalX, medalY, MEDAL_R - 1.6).stroke({ width: 0.8, color: 0xfff3c8, alpha: 0.55 });
    const cap = new Text({
      text: tr('board.merchant.bonus').toUpperCase(),
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 6.5, fontWeight: '700', letterSpacing: 1.8, fill: 0xe8c87a },
    });
    cap.anchor.set(0.5);
    cap.position.set(medalX, PLATE_H / 2 - 12);
    cap.eventMode = 'none';
    plate.addChild(medalG, cap);

    const slots = new Container();
    slots.eventMode = 'none';
    const medal = new Container();
    medal.eventMode = 'none';
    /* long labels ("+2 income") engrave on two lines: the figure big, the word small */
    const words = m.bonusLabel.split(' ');
    const big = words.length > 1 ? words[0] : m.bonusLabel;
    const small = words.length > 1 ? words.slice(1).join(' ') : '';
    const bigFont = big.length <= 3 ? 15 : big.length <= 5 ? 12.5 : 9.5;
    const engrave = (text: string, size: number, y: number, serif: boolean) => {
      const style = serif
        ? { fontFamily: "'Playfair Display',serif", fontSize: size, fontWeight: '900' as const }
        : { fontFamily: "'Archivo',sans-serif", fontSize: size, fontWeight: '700' as const, letterSpacing: 1 };
      const under = new Text({ text, style: { ...style, fill: 0xfff3c8 } });
      under.anchor.set(0.5);
      under.position.set(medalX, y + 0.8);
      under.alpha = 0.55;
      const main = new Text({ text, style: { ...style, fill: 0x2a1e0e } });
      main.anchor.set(0.5);
      main.position.set(medalX, y);
      under.eventMode = 'none';
      main.eventMode = 'none';
      medal.addChild(under, main);
    };
    if (small) {
      engrave(big, bigFont, medalY - 3.5, true);
      engrave(small.toUpperCase(), 6, medalY + 7.5, false);
    } else {
      engrave(big, bigFont, medalY, true);
    }
    /* claimed: the medallion is spent — dark wash and a cream check */
    const claimed = new Container();
    claimed.eventMode = 'none';
    const wash = new Graphics().circle(medalX, medalY, MEDAL_R).fill({ color: 0x100d0b, alpha: 0.62 });
    const tick = new Text({ text: '✓', style: { fontFamily: "'Archivo',sans-serif", fontSize: 18, fontWeight: '900', fill: 0xf4ecd8 } });
    tick.anchor.set(0.5);
    tick.position.set(medalX, medalY);
    claimed.addChild(wash, tick);
    claimed.visible = false;
    /* closed at this player count: rust stamp across the painting */
    const closed = new Container();
    closed.eventMode = 'none';
    const stamp = new Text({
      text: tr('board.merchant.closedStamp'),
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: '900', letterSpacing: 2.5, fill: 0xd05a48 },
    });
    stamp.anchor.set(0.5);
    stamp.rotation = -0.12;
    const stampBox = new Graphics().roundRect(-stamp.width / 2 - 7, -stamp.height / 2 - 2, stamp.width + 14, stamp.height + 4, 3).stroke({ width: 1.8, color: 0xd05a48 });
    stampBox.rotation = -0.12;
    closed.addChild(stampBox, stamp);
    closed.visible = false;
    plate.addChild(slots, medal, claimed, closed);

    merchantsLayer.addChild(plate);
    merchantBeer.set(m.id, slots);
    merchantDyn.set(m.id, { plate, slots, medal, claimed, closed, slotX, medalX });

    /* parchment name ribbon — identical chrome to the town ribbons (h=18).
       Northern merchants (Warrington, Nottingham) hang it BELOW the plate so
       the top-bar plaque never covers the name */
    const label = m.name.toUpperCase();
    const north = m.y < 400;
    const { box } = makeRibbon(label, m.x, m.y - (south ? 34 : 0) + (north ? 1 : -1) * ((PLATE_H / 2) * 1.15 + 12), ribbonWidth(label), 18);
    ribbonsLayer.addChild(box);
    ribbons.push(box);
  }

  /* ----------------------------- villages ---------------------------- */
  /* Painted village grounding each town cluster, BELOW the slot tiles   */
  /* (TownNode: deterministic mirror, 0.62 opacity — 0.55 for farms).    */
  for (const town of TOWNS) {
    const c = townChrome(town);
    const mirror = (town.x * 7 + town.y * 13) % 2 === 0;
    const vBox = new Container();
    vBox.position.set(c.villageCx, c.villageBottom);
    vBox.scale.x = mirror ? -1 : 1;
    vBox.alpha = town.farm ? 0.55 : 0.62;
    vBox.eventMode = 'none';
    const v = new Sprite(villageTex);
    v.position.set(-c.villageH / 2, -c.villageH);
    v.width = c.villageH;
    v.height = c.villageH;
    v.eventMode = 'none';
    vBox.addChild(v);
    townsLayer.addChild(vBox);
  }

  /* ----------------------------- towns ------------------------------- */
  const towns = new Map<string, TownView>();
  for (const town of TOWNS) {
    const c = townChrome(town);
    const slots: SlotView[] = [];
    for (let si = 0; si < town.slots.length; si++) {
      const pos = c.slots[si];
      const ring = new Graphics();
      const frame = new Graphics();
      const art = new Sprite();
      const art2 = new Sprite();
      /* GPU clip that rounds the built player-colour card exactly like the
         board's roundRect slots (baked-in PNG corners looked rough) */
      const artMask = new Graphics();
      const extras = new Graphics();
      const badges = new Container();
      const deco = new Container();
      const hit = new Graphics();
      art.visible = false;
      art2.visible = false;
      for (const o of [ring, frame, art, art2, artMask, extras, badges, deco]) o.eventMode = 'none';

      /* ---- static empty-slot chrome (SlotTile), toggled by `deco.visible` ---- */
      /* the painted industry art IS the slot face — no edge stripes, no
         corner chips, no diagonal slash; just the frame lip + warm glow */
      /* subtle warm top-inner highlight over the painting */
      const topGlow = new Graphics().rect(pos.x - TILE_HALF + 4, pos.y - TILE_HALF + 4, TILE - 8, (TILE - 8) * 0.45).fill({ color: 0xffdca6, alpha: 0.1 });
      topGlow.eventMode = 'none';
      deco.addChild(topGlow);
      /* frame lip over the painting: rounds the corners, adds relief */
      const lip = new Graphics().roundRect(pos.x - TILE_HALF + 1.5, pos.y - TILE_HALF + 1.5, TILE - 3, TILE - 3, 5).stroke({ width: 2.5, color: 0x0c0a08 });
      lip.eventMode = 'none';
      deco.addChild(lip);

      hit.rect(pos.x - TILE_HALF, pos.y - TILE_HALF, TILE, TILE).fill({ color: 0xffffff, alpha: 0 });
      hit.eventMode = 'static';
      /* schematic mode (SVG SchematicGlyph, --bw-schematic): big parchment
         line icon of the FIRST industry on a tinted disc, shown at far
         zoom over the stepped-back painting. Alpha driven by the ticker. */
      /* schematic mode: at far zoom the painting steps back and big
         parchment icon(s) name the slot — ONE centered for single-industry,
         TWO side by side for dual (reads "cotton OR coal" at a glance).
         The disc stays NEUTRAL (dark + brass rim): no industry tint. */
      const schematic = new Container();
      schematic.eventMode = 'none';
      schematic.alpha = 0;
      const schemDisc = new Graphics();
      schemDisc.eventMode = 'none';
      const schemGlyph = new Sprite(iconTex[town.slots[si].allows[0]]);
      schemGlyph.anchor.set(0.5);
      schemGlyph.eventMode = 'none';
      const schemGlyph2 = new Sprite(iconTex[town.slots[si].allows[0]]);
      schemGlyph2.anchor.set(0.5);
      schemGlyph2.eventMode = 'none';
      schemGlyph2.visible = false;
      schematic.addChild(schemDisc, schemGlyph, schemGlyph2);
      const detailC = new Container();
      detailC.eventMode = 'none';
      townsLayer.addChild(ring, frame, art, art2, artMask, schematic, deco, extras, detailC, badges, hit);
      slots.push({ ring, frame, art, art2, artMask, schematic, schemDisc, schemGlyph, schemGlyph2, extras, detailC, badges, deco, hit, artBase: 0.95, spotAlpha: 1, hasTile: false, flipped: false });
    }
    /* town colour code (physical Brass): the name banner itself takes the
       town's own colour — no dash, no underline */
    const { box, plaque } = makeRibbon(c.label, c.ribbonCx, c.ribbonCy, c.ribbonW, RIBBON_H, hex(townColor(town.id)));
    ribbonsLayer.addChild(box);
    ribbons.push(box);
    towns.set(town.id, { slots, ribbon: box, plaque });
  }

  /* ---------------------------- repaints ----------------------------- */
  let hideUnbuilt = false;
  let bigChips = false;
  let greyFreeMerchants = false;
  let stockStyle: StockStyle = 'counter';
  let look: TileLook = { ...DEFAULT_TILE_LOOK };
  let styleReq = 0;

  /* resource stock badge layouts on a built tile (A-B choice) */
  const drawStock = (badges: Container, x: number, y: number, n: number, kind: 'coal' | 'iron' | 'beer') => {
    const iconAt = (cx: number, cy: number, s: number) => {
      if (kind === 'beer') {
        const b = new Sprite(barrelTex);
        b.width = b.height = s;
        b.position.set(cx - s / 2, cy - s / 2);
        b.eventMode = 'none';
        badges.addChild(b);
      } else {
        const cube = new Graphics();
        drawCube(cube, cx, cy, s, kind);
        cube.eventMode = 'none';
        badges.addChild(cube);
      }
    };
    /* dark tag with icon left + ×n right, centred on (cx, cy) */
    const tag = (cx: number, cy: number, tw: number, th: number, iconS: number, font: number) => {
      const g = new Graphics().roundRect(cx - tw / 2, cy - th / 2, tw, th, 4).fill({ color: 0x17110c, alpha: 0.92 }).stroke({ width: 0.9, color: 0xf4ecd8, alpha: 0.45 });
      g.eventMode = 'none';
      badges.addChild(g);
      iconAt(cx - tw / 2 + iconS / 2 + 3, cy, iconS);
      const t = new Text({ text: `×${n}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: font, fontWeight: '700', fill: 0xf4ecd8 } });
      t.anchor.set(0.5, 0.5);
      t.position.set(cx + (tw / 2 - (iconS + 6)) / 2 + 2, cy + 0.5);
      t.eventMode = 'none';
      badges.addChild(t);
    };
    if (stockStyle === 'counter') tag(x, y + 7, 32, 15, 11, 9.5);
    else if (stockStyle === 'big') tag(x, y + 8, 46, 21, 14, 13);
    else if (stockStyle === 'tag') tag(x + TILE_HALF - 7, y, 34, 16, 11, 10); // hangs off the right edge
    else if (stockStyle === 'top') tag(x, y - TILE_HALF + 2, 34, 16, 11, 10); // hangs off the top edge
    else {
      /* corner disc: bare numeral with a brass rim — the industry art
         already says WHICH good it is (top-right: pips live top-left,
         chips bottom) */
      const cx = x + TILE_HALF - 5;
      const cy = y - TILE_HALF + 5;
      const g = new Graphics().circle(cx, cy, 10).fill({ color: 0x17110c, alpha: 0.95 }).stroke({ width: 1.4, color: 0xc9a45c });
      g.eventMode = 'none';
      badges.addChild(g);
      const t = new Text({ text: String(n), style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: '700', fill: 0xf4ecd8 } });
      t.anchor.set(0.5);
      t.position.set(cx, cy + 0.5);
      t.eventMode = 'none';
      badges.addChild(t);
    }
  };
  const drawLinks = (game: GameState) => {
    for (const def of LINKS) {
      const g = linkGfx.get(def.id)!;
      g.clear();
      g.alpha = 1;
      const pts = linkPoints(def);
      const built = game.links[def.id];
      if (!built) {
        /* unbuilt visibility (v9, Board.tsx):
           - CANAL ERA: buildable routes read as WATER (blue-grey ribbon
             over a faint dark halo); rail-only routes stay invisible
           - RAIL ERA: unbuilt traces become railway surveys (dark ballast,
             sleeper dashes, faint steel centre); canal-only routes fade */
        let furrow = 0;
        if (def.canal) {
          furrow = game.era === 'canal' ? 0.55 : def.rail ? 0.5 : 0.16;
        } else if (game.era === 'rail') {
          furrow = 0.55;
        }
        if (furrow <= 0) continue;
        const railStyle = game.era === 'rail' ? def.rail : !def.canal;
        if (railStyle) {
          /* railway survey: dark ballast bed, sleeper dashes, steel centre */
          tracePath(g, pts);
          g.stroke({ width: 11, color: 0x241d16, alpha: furrow, cap: 'round', join: 'round' });
          traceDashes(g, pts, 2.2, 7);
          g.stroke({ width: 7, color: 0x6b5138, alpha: furrow * 0.85 });
          tracePath(g, pts);
          g.stroke({ width: 3.2, color: 0x8e969e, alpha: furrow * 0.6, join: 'round' });
        } else {
          /* canal survey: continuous ribbon of still water + light sheen */
          tracePath(g, pts);
          g.stroke({ width: 8, color: 0x0e0c09, alpha: furrow * 0.55, cap: 'round', join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 3.85, color: 0x4a7a8c, alpha: Math.min(0.6, furrow), cap: 'round', join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 1.2, color: 0x8fb8c4, alpha: 0.5, cap: 'round', join: 'round' });
        }
        /* board option: unbuilt traces can be hidden entirely (key C) */
        if (hideUnbuilt) g.alpha = 0;
      } else {
        const col = playerHex(game, built.owner);
        const shape = PLAYER_COLORS[game.players[built.owner].color]?.shape ?? 'circle';
        /* owner glow */
        tracePath(g, pts);
        g.stroke({ width: 22, color: col, alpha: 0.3, cap: 'round', join: 'round' });
        if (built.era === 'rail') {
          /* steam-era track: dark ballast, visible sleepers, twin bright
             steel rails split by a dark groove, rail-top glint */
          tracePath(g, pts);
          g.stroke({ width: 16, color: 0x0e0b09, cap: 'round', join: 'round' });
          /* RAIL = one hue, the owner's: dark shade for the sleepers, a pale
             shade for the twin rails, the base colour for the ballast */
          tracePath(g, pts);
          g.stroke({ width: 13, color: col, join: 'round' });
          traceDashes(g, pts, 2.4, 8);
          g.stroke({ width: 9.5, color: shade(col, 0.35), alpha: 0.85 });
          tracePath(g, pts);
          g.stroke({ width: 4.6, color: tint(col, 0.55), alpha: 0.95, join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 1.4, color: shade(col, 0.5), join: 'round' });
          traceDashes(g, pts, 1.2, 15.8, -2);
          g.stroke({ width: 4.6, color: 0xffffff, alpha: 0.35 });
        } else {
          /* wide waterway: earthen banks, deep green water, owner liseré */
          tracePath(g, pts);
          g.stroke({ width: 20, color: 0x14100b, alpha: 0.95, cap: 'round', join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 18, color: 0x8a6b33, alpha: 0.22, join: 'round' });
          /* CANAL = one hue, the owner's: a darker channel down the middle
             and a pale ripple line — reads as water, never as green */
          tracePath(g, pts);
          g.stroke({ width: 15, color: col, cap: 'round', join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 6, color: shade(col, 0.45), alpha: 0.9, join: 'round' });
          traceDashes(g, pts, 6, 9, 3);
          g.stroke({ width: 1.6, color: tint(col, 0.6), alpha: 0.7 });
        }
        /* colour-blind mode: owner medallion seated mid-route (brass rim +
           colour + shape) — otherwise the owner's hue on the route is enough */
        if (look.colorBlind && look.sealLinks) {
          const mid = pts[Math.floor(pts.length / 2)];
          g.circle(mid[0], mid[1], 10).fill(0x100d0b).stroke({ width: 1.6, color: 0xc9a45c });
          g.circle(mid[0], mid[1], 7.6).fill(col).stroke({ width: 0.8, color: 0xf2ead6, alpha: 0.35 });
          drawShapeGlyph(g, shape, mid[0], mid[1]);
        }
      }
    }
  };

  /* rebake the schematic disc + glyph(s) for the slot's industry(ies).
     Single industry: one big parchment icon centred on a neutral disc.
     Dual industry: BOTH icons side by side on a wider plaque — the two
     options read at a glance, no clutter (stripes/chips hide at this zoom). */
  const bakeSchematic = (sv: SlotView, x: number, y: number, inds: IndustryType[]) => {
    sv.schemDisc.clear();
    if (inds.length > 1) {
      sv.schemDisc.roundRect(x - 31, y - 23, 62, 46, 12).fill({ color: 0x15110d, alpha: 0.94 });
      sv.schemDisc.roundRect(x - 31, y - 23, 62, 46, 12).stroke({ width: 1.4, color: 0xc9a45c, alpha: 0.55 });
      sv.schemGlyph.texture = schematicTex[inds[0]];
      sv.schemGlyph.position.set(x - 14, y);
      sv.schemGlyph.width = sv.schemGlyph.height = 25;
      sv.schemGlyph2.texture = schematicTex[inds[1]];
      sv.schemGlyph2.position.set(x + 14, y);
      sv.schemGlyph2.width = sv.schemGlyph2.height = 25;
      sv.schemGlyph2.visible = true;
    } else {
      sv.schemDisc.circle(x, y, 23).fill({ color: 0x15110d, alpha: 0.94 });
      sv.schemDisc.circle(x, y, 23).stroke({ width: 1.4, color: 0xc9a45c, alpha: 0.55 });
      sv.schemGlyph.texture = schematicTex[inds[0]];
      sv.schemGlyph.position.set(x, y);
      sv.schemGlyph.width = sv.schemGlyph.height = 40;
      sv.schemGlyph2.visible = false;
    }
  };

  const drawTowns = (game: GameState) => {
    for (const town of TOWNS) {
      const view = towns.get(town.id)!;
      const c = townChrome(town);
      for (let si = 0; si < town.slots.length; si++) {
        const sv = view.slots[si];
        const { ring, frame, art, art2, artMask, extras, badges, deco, detailC } = sv;
        const x = c.slots[si].x;
        const y = c.slots[si].y;
        const tile = game.tiles[tileKey(town.id, si)];
        ring.clear();
        frame.clear();
        extras.clear();
        artMask.clear();
        art.mask = null;
        for (const child of badges.removeChildren()) child.destroy();
        for (const child of detailC.removeChildren()) child.destroy();
        sv.hasTile = !!tile;
        sv.flipped = tile?.flipped ?? false;
        ring.alpha = 1;
        frame.alpha = 1;
        badges.alpha = 1;
        if (tile) {
          deco.visible = false;
          art2.visible = false;
          const colorName = game.players[tile.owner].color;
          const col = playerHex(game, tile.owner);
          const shape = PLAYER_COLORS[colorName]?.shape ?? 'circle';
          const lv = INDUSTRIES[tile.industry][tile.level - 1];
          bakeSchematic(sv, x, y, [tile.industry]);
          /* the whole tile CARD is the ownership marker (physical game):
             the painting comes precomposed on the owner's colour. The card
             is a physical object laid ON the printed board: soft drop
             shadow, a darker bottom edge for thickness, and the owner's
             colour on the rim so ownership reads at every zoom. */
          frame.roundRect(x - TILE_HALF + 1, y - TILE_HALF + 4, TILE - 2, TILE, 7).fill({ color: 0x000000, alpha: 0.42 });
          frame.roundRect(x - TILE_HALF, y - TILE_HALF + 2.5, TILE, TILE, 6).fill(shade(col, 0.42));
          if (tile.flipped) {
            /* flipped = muted player-colour back (soft vertical shading,
               dark VP numeral) — same printed feel as the built cards */
            /* the painting STAYS (dimmed under a wash of the owner colour) so a
               flipped mill still reads as a mill; the VP sits on a dark plate */
            art.texture = (look.cardGrain ? tileSet.builtGrain : tileSet.built)[tile.industry][colorName] ?? tileSet.cut[tile.industry];
            art.position.set(x - TILE_HALF, y - TILE_HALF);
            artMask.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
            art.mask = artMask;
            art.width = TILE;
            art.height = TILE;
            sv.artBase = 0.55;
            art.alpha = sv.artBase;
            art.visible = true;
            frame
              .roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6)
              .stroke({ width: 1.5, color: shade(col, 0.4), alpha: 0.9 });
            const wash = new Graphics().roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill({ color: shade(col, 0.6), alpha: 0.35 });
            wash.eventMode = 'none';
            const rim = new Graphics().roundRect(x - TILE_HALF + 3, y - TILE_HALF + 3, TILE - 6, TILE - 6, 4.5).stroke({ width: 1.5, color: 0xa6562b, alpha: 0.9 });
            rim.eventMode = 'none';
            const plate = new Graphics().roundRect(x - 15, y + TILE_HALF - 24, 30, 21, 4).fill({ color: 0x100d0b, alpha: 0.82 }).stroke({ width: 0.8, color: 0xa6562b, alpha: 0.8 });
            plate.eventMode = 'none';
            const vpText = new Text({
              text: String(lv.vp),
              style: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: '900', fill: 0xe8b26a },
            });
            vpText.anchor.set(0.5);
            vpText.position.set(x, y + TILE_HALF - 15.5);
            vpText.eventMode = 'none';
            const vpLabel = new Text({
              text: tr('board.tile.vp'),
              style: { fontFamily: "'Archivo', sans-serif", fontSize: 6, fontWeight: '600', letterSpacing: 1.2, fill: 0xa6562b },
            });
            vpLabel.anchor.set(0.5);
            vpLabel.position.set(x, y + TILE_HALF - 5.5);
            vpLabel.eventMode = 'none';
            badges.addChild(wash, rim, plate, vpText, vpLabel);
            if (look.colorBlind && look.sealTiles) drawOwnerMedallion(extras, x + TILE_HALF - 8, y - TILE_HALF + 8, col, shape);
            /* level pips, dark on the muted card */
            for (let i = 0; i < tile.level; i++) {
              extras.circle(x - TILE_HALF + 8 + i * 7, y - TILE_HALF + 6, 2.1).fill(0x241d14).stroke({ width: 0.5, color: shade(col, 1.25) });
            }
          } else {
            /* player-colour card painting (builtTex), full opacity, clipped
               to the slot's rounded rect by the GPU mask */
            art.texture = (look.cardGrain ? tileSet.builtGrain : tileSet.built)[tile.industry][colorName] ?? tileSet.cut[tile.industry];
            art.position.set(x - TILE_HALF, y - TILE_HALF);
            artMask.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
            art.mask = artMask;
            art.width = TILE;
            art.height = TILE;
            sv.artBase = 1;
            art.alpha = sv.artBase;
            art.visible = true;
            /* owner rim: colour band + dark inner hairline + light bevel */
            extras.roundRect(x - TILE_HALF + 1.25, y - TILE_HALF + 1.25, TILE - 2.5, TILE - 2.5, 5.5).stroke({ width: 2.5, color: col });
            extras.roundRect(x - TILE_HALF + 2.75, y - TILE_HALF + 2.75, TILE - 5.5, TILE - 5.5, 4.5).stroke({ width: 0.8, color: 0x0c0a08, alpha: 0.7 });
            extras.roundRect(x - TILE_HALF + 0.5, y - TILE_HALF + 0.5, TILE - 1, TILE - 1, 6).stroke({ width: 0.8, color: tint(col, 0.45), alpha: 0.8 });
            /* owner medallion (colour-blind safe): the player's shape on a
               small disc in the top-right corner — bottom-right when the
               stock disc already sits there ('corner' layout) */
            if (look.colorBlind && look.sealTiles) drawOwnerMedallion(extras, x + TILE_HALF - 8, stockStyle === 'corner' ? y + TILE_HALF - 8 - (bigChips ? 15 : 11) : y - TILE_HALF + 8, col, shape);
            const numStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: bigChips ? 10.5 : 7.5, fontWeight: '600' as const, fill: 0xf4ecd8 };
            const incText = new Text({ text: `+${lv.incomeDelta}`, style: numStyle });
            incText.eventMode = 'none';
            const vpText = new Text({ text: tr('board.tile.vpChip', { vp: lv.vp }), style: numStyle });
            vpText.eventMode = 'none';
            if (look.chipStyle === 'band') {
              /* income / VP: ONE quiet band along the bottom edge — income
                 left, VP right, cream numerals on a translucent dark strip.
                 bigChips (board option) enlarges it. */
              const ch = bigChips ? 15 : 11;
              const cy0 = y + TILE_HALF - 2.75 - ch;
              const band = new Graphics().roundRect(x - TILE_HALF + 2.75, cy0, TILE - 5.5, ch, 3.5).fill({ color: 0x0c0a08, alpha: 0.62 });
              band.eventMode = 'none';
              incText.anchor.set(0, 0.5);
              incText.position.set(x - TILE_HALF + 7, cy0 + ch / 2 + 0.5);
              incText.alpha = 0.95;
              vpText.anchor.set(1, 0.5);
              vpText.position.set(x + TILE_HALF - 7, cy0 + ch / 2 + 0.5);
              vpText.alpha = 0.95;
              detailC.addChild(band, incText, vpText);
            } else {
              /* two boxed chips riding the bottom edge — dark tokens with
                 cream numerals, readable on ANY player colour */
              const cw = bigChips ? 30 : 22;
              const ch = bigChips ? 16 : 12;
              const cy0 = y + TILE_HALF - ch;
              const chipInc = new Graphics().roundRect(x - TILE_HALF + 4, cy0, cw, ch, 3).fill({ color: 0x17110c, alpha: 0.92 }).stroke({ width: 0.8, color: 0xf4ecd8, alpha: 0.35 });
              chipInc.eventMode = 'none';
              incText.anchor.set(0.5);
              incText.position.set(x - TILE_HALF + 4 + cw / 2, cy0 + ch / 2 + 0.5);
              const chipVp = new Graphics().roundRect(x + TILE_HALF - 4 - cw, cy0, cw, ch, 3).fill({ color: 0x17110c, alpha: 0.92 }).stroke({ width: 0.8, color: 0xf4ecd8, alpha: 0.35 });
              chipVp.eventMode = 'none';
              vpText.anchor.set(0.5);
              vpText.position.set(x + TILE_HALF - 4 - cw / 2, cy0 + ch / 2 + 0.5);
              detailC.addChild(chipInc, incText, chipVp, vpText);
            }
            /* level pips along the top edge — dark on the colour card */
            for (let i = 0; i < tile.level; i++) {
              extras.circle(x - TILE_HALF + 8 + i * 7, y - TILE_HALF + 6, 2.1).fill(0x17110c).stroke({ width: 0.6, color: 0xf4ecd8, alpha: 0.7 });
            }
          }
          /* resource stock badge — layout is switchable (stockStyle, board
             option / A-B probe). The numeral is always exact; the industry
             implies the good, the mini icon only speeds the read. */
          if (!tile.flipped && tile.cubes > 0) {
            drawStock(badges, x, y, tile.cubes, tile.industry === 'brewery' ? 'beer' : tile.industry === 'iron' ? 'iron' : 'coal');
          }
        } else {
          const allows = town.slots[si].allows;
          deco.visible = true;
          bakeSchematic(sv, x, y, [...allows]);
          /* NO ring on empty slots — a contour only appears once a player
             owns the tile, and then in THEIR colour (see built branch) */
          /* tile body: dark face, NO border on empty slots — the frame is
             the owner marker, it only means something once a tile is built;
             the town colour code stays on the name banner (physical game) */
          frame.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0x12100c);
          /* the painted art IS the face, full colour at every zoom.
             Dual slot: the generated combined painting when available
             (one cohesive composition), otherwise the half-crop split. */
          const engraved = look.slotArt === 'engraved';
          if (allows.length > 1) {
            const combined = (engraved ? tileSet.printPair : tileSet.pair)[pairKey(allows[0], allows[1])];
            if (combined) {
              art.texture = combined;
              art.position.set(x - TILE_HALF + 4, y - TILE_HALF + 4);
              art.width = TILE - 8;
              art.height = TILE - 8;
              art2.visible = false;
            } else {
              const hw = (TILE - 8) / 2;
              art.texture = (engraved ? tileSet.printHalfL : tileSet.halfL)[allows[0]];
              art.position.set(x - TILE_HALF + 4, y - TILE_HALF + 4);
              art.width = hw;
              art.height = TILE - 8;
              art2.texture = (engraved ? tileSet.printHalfR : tileSet.halfR)[allows[1]];
              art2.position.set(x - TILE_HALF + 4 + hw, y - TILE_HALF + 4);
              art2.width = hw;
              art2.height = TILE - 8;
              art2.visible = true;
              frame.moveTo(x, y - TILE_HALF + 4).lineTo(x, y + TILE_HALF - 4).stroke({ width: 2, color: 0x0c0a08 });
            }
          } else {
            art.texture = (engraved ? tileSet.print : tileSet.cut)[allows[0]];
            art.position.set(x - TILE_HALF + 4, y - TILE_HALF + 4);
            art.width = TILE - 8;
            art.height = TILE - 8;
            art2.visible = false;
          }
          sv.artBase = engraved ? 0.88 : 1;
          art.alpha = sv.artBase;
          art2.alpha = sv.artBase;
          art.visible = true;
        }
      }
    }
  };

  const drawMerchants = (game: GameState) => {
    for (const m of MERCHANTS) {
      const dyn = merchantDyn.get(m.id)!;
      const open = merchantOpen(game, m.id);
      const isClaimed = !!game.merchantBonusTaken[m.id];
      dyn.plate.alpha = open ? 1 : 0.42;
      dyn.closed.visible = !open;
      /* board option: unclaimed medallions can be greyed back so claimed
         ones pop off the board (claimed always stay dimmed + ✓) */
      dyn.medal.alpha = isClaimed ? 0.5 : greyFreeMerchants ? 0.35 : 1;
      dyn.claimed.visible = isClaimed;
      for (const child of dyn.slots.removeChildren()) child.destroy();
      if (!open) continue;
      const tiles = game.merchantTiles[m.id] ?? [];
      const beer = game.merchantBeer[m.id] ?? 0;
      let barrelIdx = 0;
      /* a physical tile: dark card with a bottom-edge thickness, brass hairline,
         the painted industry face inside */
      const card = (x: number) => {
        const g = new Graphics();
        g.roundRect(x - MT / 2, TILE_TOP + 2, MT, MT, 5).fill(0x0b0806);
        g.roundRect(x - MT / 2, TILE_TOP, MT, MT, 5).fill(0x1b1611).stroke({ width: 1, color: 0xc9a45c, alpha: 0.75 });
        g.eventMode = 'none';
        dyn.slots.addChild(g);
      };
      const painting = (ind: IndustryType, px: number, py: number, size: number) => {
        const art = new Sprite(tileSet.cut[ind]);
        art.anchor.set(0.5);
        art.width = size;
        art.height = size;
        art.position.set(px, py);
        art.eventMode = 'none';
        dyn.slots.addChild(art);
      };
      tiles.forEach((tile, i) => {
        const x = dyn.slotX[i];
        const cy = TILE_TOP + MT / 2;
        if (tile === 'blank') {
          /* a blank tile: bare card, no trade, no barrel */
          card(x);
          const g = new Graphics();
          traceDashedCircle(g, x, cy, 9, 3, 3);
          g.stroke({ width: 1.2, color: 0x8a6b33, alpha: 0.7 });
          g.eventMode = 'none';
          dyn.slots.addChild(g);
          return;
        }
        card(x);
        if (tile === 'all') {
          /* ANY: the three trades share the card — cotton on top, goods and pottery below */
          painting('cotton', x, cy - 9, 16);
          painting('manufacturer', x - 9, cy + 8, 16);
          painting('pottery', x + 9, cy + 8, 16);
        } else {
          painting(tile, x, cy, MT - 6);
        }
        /* the beer barrel stands at the tile's foot, slightly overlapping the
           card like a token set down beside it; once drunk, a faint ring
           marks the empty spot */
        const bx = x + MT / 2 - 6;
        const by = TILE_TOP + MT + 2;
        if (barrelIdx < beer) {
          const sh = new Graphics().ellipse(bx, by + 10, 11, 4).fill({ color: 0x000000, alpha: 0.5 });
          sh.eventMode = 'none';
          const b = new Sprite(barrelTex);
          b.width = 28;
          b.height = 28;
          b.anchor.set(0.5);
          b.position.set(bx, by);
          b.eventMode = 'none';
          dyn.slots.addChild(sh, b);
        } else {
          const g = new Graphics();
          g.ellipse(bx, by + 6, 9, 3.5).fill({ color: 0x000000, alpha: 0.35 });
          traceDashedCircle(g, bx, by, 8, 2.5, 2.5);
          g.stroke({ width: 1, color: 0xc9a45c, alpha: 0.5 });
          g.eventMode = 'none';
          dyn.slots.addChild(g);
        }
        barrelIdx += 1;
      });
    }
  };

  let spotlight: number | null = null;
  /* a transient highlight (merchant hover): only these slot keys stay lit */
  let highlight: Set<string> | null = null;
  const applySpotlight = (game: GameState | null) => {
    if (!game) return;
    for (const def of LINKS) {
      const built = game.links[def.id];
      if (built) linkGfx.get(def.id)!.alpha = spotlight === null || built.owner === spotlight ? 1 : 0.3;
      /* unbuilt traces soften under a spotlight too (unless fully hidden) */
      else linkGfx.get(def.id)!.alpha = hideUnbuilt ? 0 : spotlight === null ? 1 : 0.45;
    }
    for (const town of TOWNS) {
      const view = towns.get(town.id)!;
      for (let si = 0; si < town.slots.length; si++) {
        const tile = game.tiles[tileKey(town.id, si)];
        /* spotlight = only the player's possessions stay at full strength:
           others' tiles AND empty slots step back */
        const key = tileKey(town.id, si);
        view.slots[si].spotAlpha = highlight ? (highlight.has(key) ? 1 : 0.28) : spotlight === null ? 1 : tile && tile.owner === spotlight ? 1 : 0.3;
      }
    }
  };

  let lastGame: GameState | null = null;
  return {
    world,
    bgCanal,
    bgRail,
    overlay,
    linkGfx,
    linkHit,
    towns,
    merchantBeer,
    ribbons,
    redraw(game: GameState) {
      lastGame = game;
      drawLinks(game);
      drawTowns(game);
      drawMerchants(game);
      applySpotlight(game);
    },
    setSpotlight(player: number | null) {
      spotlight = player;
      applySpotlight(lastGame);
    },
    setHighlight(keys: string[] | null) {
      highlight = keys ? new Set(keys) : null;
      applySpotlight(lastGame);
    },
    setHideUnbuilt(hide: boolean) {
      hideUnbuilt = hide;
      applySpotlight(lastGame); // re-applies both the hide and the spotlight dim
    },
    setBigChips(big: boolean) {
      bigChips = big;
      if (lastGame) drawTowns(lastGame);
    },
    setGreyFreeMerchants(grey: boolean) {
      greyFreeMerchants = grey;
      if (lastGame) drawMerchants(lastGame);
    },
    setStockStyle(s: StockStyle) {
      stockStyle = s;
      if (lastGame) drawTowns(lastGame);
    },
    async setTileStyle(style: TileStyle) {
      const req = ++styleReq;
      const set = await ensureTileSet(style);
      if (req !== styleReq) return; // a later switch won
      tileSet = set;
      if (lastGame) {
        drawTowns(lastGame);
        drawMerchants(lastGame);
      }
    },
    setTileLook(l: TileLook) {
      const linksToo = (l.colorBlind && l.sealLinks) !== (look.colorBlind && look.sealLinks);
      look = { ...l };
      if (!lastGame) return;
      drawTowns(lastGame);
      if (linksToo) {
        drawLinks(lastGame);
        applySpotlight(lastGame);
      }
    },
  };
}

export { ICON_FOR };
