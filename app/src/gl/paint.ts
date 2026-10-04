import { Assets, Container, FillGradient, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { INDUSTRIES, LINKS, MERCHANTS, PLAYER_COLORS, TOWNS } from '@/game/data';
import { townColor } from '@/game/townColors';
import { routeFor } from '@/components/game/routePaths';
import { merchantOpen, tileKey } from '@/game/engine';
import { tr } from '@/i18n';
import type { Era, GameState, IndustryType, LinkDef } from '@/game/types';
import { RIBBON_FONT, RIBBON_H, TILE, TILE_HALF, townChrome } from '@/components/game/townChrome';
import { HOUSES } from './houses';
import { FEET, SHADE } from './placeGround';
import { BUILT_FOR, CUT_FOR, FRONT_RANK, ICON_FOR, PARTNER, pairFile, pairKey, variantOf } from './faces';
import type { ChipStyle, SlotArt, StockStyle, TileArt, TileVariant } from './faces';

/* the faces live in their own module (no PixiJS); the board's callers keep finding them here */
export { FILE_FOR, ICON_FOR, TILE_VARIANTS, industryFaceUrl, pairKey, tileFaceUrl, variantFaceUrl } from './faces';
export type { ChipStyle, SlotArt, StockStyle, TileArt, TileVariant } from './faces';

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
export interface SlotView {
  ring: Graphics; // unused by towns (kept for the ticker's alpha write)
  frame: Graphics; // tile body (empty dark card / flipped muted card)
  art: Sprite; // painted face (slot cutout / built player-colour card)
  art2: Sprite; // right-half painting for dual-industry slots
  artMask: Graphics; // GPU-rounded clip on the built card (empty otherwise)
  extras: Graphics; // far-LOD details: level pips
  detailC: Container; // LOD text details: etched mark, income/VP chips
  badges: Container; // flipped rim/VP + resource cubes/barrels (always visible)
  deco: Container; // empty-slot chrome: frame lip, top glow
  glow: Graphics; // the top glow alone, hidden over a printed label
  hit: Graphics;
  /** per-frame alphas recomputed in the ticker from these bases */
  artBase: number; // painting alpha at rest (1 shown / 0 flipped)
  spotAlpha: number; // player spotlight dimming (1 or 0.3)
  hasTile: boolean; // built works present
  flipped: boolean; // ember VP face — no painting
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
  /** the one hover effect (a route lit under the pointer): its own layer,
   *  so a hover never rebuilds the overlay */
  hoverLayer: Container;
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
  /** swap painting variants per industry (alternate files fetched on first use) */
  setTileArt: (art: TileArt) => Promise<void>;
  /** the village under each town: the painting, or the ink hamlet of the
   *  engraved map; `ground` names the board whose relief shapes the shadows
   *  (placeGround.ts), or nothing on a level ground */
  setVillages: (style: 'painted' | 'engraved', ground?: string | null) => void;
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
  mono: Record<IndustryType, Texture>; // black-and-white print (empty slots, plainer)
  monoHalfL: Record<IndustryType, Texture>;
  monoHalfR: Record<IndustryType, Texture>;
  monoPair: Record<string, Texture>;
}
/** one industry's textures from one variant directory */
interface IndustryArt {
  cut: Texture;
  built: Record<string, Texture>;
  builtGrain: Record<string, Texture>;
  halfL: Texture;
  halfR: Texture;
  print: Texture;
  printHalfL: Texture;
  printHalfR: Texture;
  mono: Texture;
  monoHalfL: Texture;
  monoHalfR: Texture;
}
const artCache = new Map<string, Promise<IndustryArt>>(); // `${dir}|${industry}`
const pairCache = new Map<string, Promise<Texture | null>>(); // default-set pairs, `${a}-${b}`
let tileSet: TileSet; // the set currently painted
let tileArt: TileArt = {}; // the variant choices it was built from
let barrelTex: Texture;
/* one painting per merchant when /merchant-<id>.png exists (e.g. Gloucester
   docks); the shared barge otherwise */
const houseArt = new Map<string, Texture>();
/* dev only: the signs' textures at hand in the console (a film's clock) */
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __houseArt?: typeof houseArt }).__houseArt = houseArt;
let villageTex: Texture;
/** the trades that have a works of their own to show */
const WORKS: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];
/** five wharves, one to a merchant */
const WHARVES = [0, 1, 2, 3, 4];
/* four painted places, one to a town, for every ground but the engraved map */
let placeTex: Texture[] = [];
/* and one works to a trade: a town that has built shows what it built */
let worksTex: Partial<Record<IndustryType, Texture>> = {};
/* and a wharf under every merchant's sign, so the edge of the map is a
   place of business rather than a picture hung in the air */
let wharfTex: (Texture | null)[] = [];
/** each drawing's soft silhouette, by served name: laid down as its shadow */
let shadowTex: Record<string, Texture | null> = {};
/* the engraved map lays an ink hamlet under each town instead (three, in turn) */
let hamletTex: Texture[] = [];

/** canonical key for a dual-industry slot painting */

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

/** Empty slots are PRINTED on the board, built works are physical cards
 *  laid on top (official board: grey printed icons vs. player-colour tiles).
 *  Rebake a painting as a monochrome sepia engraving — ink for the darks,
 *  parchment for the lights — so the colour of a placed tile is the only
 *  colour in the slot grid. Done once per texture at load. */
function engraveTexture(tex: Texture, mono = false): Texture {
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
  /* ink #2a2118 → faded parchment #bfa982, slight gamma so mid-tones stay
     legible; the mono print is black ink on white paper, contrast pushed,
     for eyes that want the empty slots plainer still */
  const ink = mono ? [0x12, 0x10, 0x0e] : [0x2a, 0x21, 0x18];
  const paper = mono ? [0xf0, 0xec, 0xe2] : [0xbf, 0xa9, 0x82];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const raw = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const lum = mono ? Math.min(1, Math.max(0, (Math.pow(raw, 0.9) - 0.5) * 1.35 + 0.5)) : Math.pow(raw, 0.85);
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

const half = (t: Texture, right: boolean): Texture => new Texture({ source: t.source, frame: new Rectangle(right ? t.width / 2 : 0, 0, t.width / 2, t.height) });

/** derive the halves and the engraved print every set needs from its face */
const artFrom = (cut: Texture, built: Record<string, Texture>, builtGrain: Record<string, Texture>): IndustryArt => {
  const print = engraveTexture(cut);
  const mono = engraveTexture(cut, true);
  return { cut, built, builtGrain, halfL: half(cut, false), halfR: half(cut, true), print, printHalfL: half(print, false), printHalfR: half(print, true), mono, monoHalfL: half(mono, false), monoHalfR: half(mono, true) };
};

/** fetch (once) one industry's art from a variant: a finished painting that
 *  serves as slot face and as every owner's card, or the cutout and the
 *  four colour cards of a drawn set */
function loadIndustryArt(v: TileVariant | undefined, i: IndustryType): Promise<IndustryArt> {
  const dir = v?.dir ?? '';
  const key = `${dir}|${i}`;
  let p = artCache.get(key);
  if (!p) {
    p = (async () => {
      const colorNames = Object.keys(PLAYER_COLORS);
      const loaded = await Assets.load([dir + CUT_FOR(i, v?.ext), ...colorNames.map((c) => dir + BUILT_FOR(i, c, v?.ext))]);
      const built = Object.fromEntries(colorNames.map((c) => [c, loaded[dir + BUILT_FOR(i, c, v?.ext)]])) as Record<string, Texture>;
      const builtGrain = Object.fromEntries(colorNames.map((c) => [c, grainTexture(built[c])])) as Record<string, Texture>;
      return artFrom(loaded[dir + CUT_FOR(i, v?.ext)], built, builtGrain);
    })();
    artCache.set(key, p);
  }
  return p;
}

/** fetch (once, tolerantly) one painting by url — null when the set does not
 *  carry it, so a missing scene falls back rather than breaking the board */
function loadUrl(url: string): Promise<Texture | null> {
  let p = pairCache.get(url);
  if (!p) {
    p = Assets.load(url).catch(() => null) as Promise<Texture | null>;
    pairCache.set(url, p);
  }
  return p;
}

/** fetch (once, tolerantly) a dual-slot painting painted as one scene rather
 *  than assembled: a finished set's own, or the default set's */
function loadPair(a: IndustryType, b: IndustryType): Promise<Texture | null> {
  const url = `/tile-${pairFile(a, b)}-cut.png`;
  let p = pairCache.get(url);
  if (!p) {
    p = Assets.load(url).catch(() => null) as Promise<Texture | null>;
    pairCache.set(url, p);
  }
  return p;
}

/** Assemble a dual-slot painting from two cutouts, the way the build script
 *  does for the default set: the front industry low left, whole or cropped
 *  to its tallest part; the partner behind, right, scaled down. Null when
 *  neither industry has a front recipe (the half-crops apply then). */
function composePair(a: IndustryType, ta: Texture, va: TileVariant | undefined, b: IndustryType, tb: Texture, vb: TileVariant | undefined): Texture | null {
  const aFront = FRONT_RANK[a] <= FRONT_RANK[b];
  const [front, ft, fv, back, bt] = aFront ? [a, ta, va, b, tb] : [b, tb, vb, a, ta];
  const recipe = fv?.front;
  const place = PARTNER[back];
  const fs = ft.source.resource as CanvasImageSource | undefined;
  const bs = bt.source.resource as CanvasImageSource | undefined;
  if (!recipe || !place || !fs || !bs || FRONT_RANK[front] === FRONT_RANK[back]) return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const bw = (512 * place.scale) / 100;
  ctx.drawImage(bs, recipe.partnerX?.[back] ?? place.x, 512 - bw - 38, bw, bw);
  const [cx, cw] = recipe.crop ?? [0, 512];
  const sx = ft.width / 512;
  const fh = (512 * recipe.scale) / 100;
  ctx.drawImage(fs, cx * sx, 0, cw * sx, ft.height, 4, 512 - fh - 38, (cw * recipe.scale) / 100, fh);
  return Texture.from(c);
}
const composedCache = new Map<string, Texture>(); // `${variant a}|${a}|${variant b}|${b}`

/** Assemble the painting set for a per-industry variant choice. A dual-slot
 *  painting is the default file when both industries are on their default,
 *  and is composed from the two chosen cutouts otherwise — so the crate on
 *  a coal-and-goods slot is always the crate of the goods slots. */
async function buildTileSet(art: TileArt): Promise<TileSet> {
  const industries = Object.keys(ICON_FOR) as IndustryType[];
  const arts = Object.fromEntries(await Promise.all(industries.map(async (i) => [i, await loadIndustryArt(variantOf(i, art), i)]))) as Record<IndustryType, IndustryArt>;
  const pair: Record<string, Texture> = {};
  const printPair: Record<string, Texture> = {};
  const monoPair: Record<string, Texture> = {};
  await Promise.all(
    dualPairs().map(async ([a, b]) => {
      const va = variantOf(a, art);
      const vb = variantOf(b, art);
      const key = `${va?.id ?? ''}|${a}|${vb?.id ?? ''}|${b}`;
      let t: Texture | null | undefined = composedCache.get(key);
      if (!t) {
        /* both industries on a set that paints this very slot: its scene.
           Both on the default set: that one has its own scenes too.
           Anything mixed is assembled from the two cutouts. */
        const sameSet = va && vb && va.id === vb.id && va.pair ? va.dir + va.pair(a, b) : null;
        t = sameSet ? await loadUrl(sameSet) : !va?.dir && !vb?.dir ? await loadPair(a, b) : composePair(a, arts[a].cut, va, b, arts[b].cut, vb);
        if (t) composedCache.set(key, t);
      }
      if (!t) return;
      pair[pairKey(a, b)] = t;
      printPair[pairKey(a, b)] = engravedPair(key, t);
      monoPair[pairKey(a, b)] = engravedPair(key, t, true);
    }),
  );
  const by = <K extends keyof IndustryArt>(k: K) => Object.fromEntries(industries.map((i) => [i, arts[i][k]])) as Record<IndustryType, IndustryArt[K]>;
  return { cut: by('cut'), built: by('built'), builtGrain: by('builtGrain'), halfL: by('halfL'), halfR: by('halfR'), pair, print: by('print'), printHalfL: by('printHalfL'), printHalfR: by('printHalfR'), printPair, mono: by('mono'), monoHalfL: by('monoHalfL'), monoHalfR: by('monoHalfR'), monoPair };
}
const printPairCache = new Map<string, Texture>();
function engravedPair(key: string, t: Texture, mono = false): Texture {
  const k = mono ? `${key}|mono` : key;
  let e = printPairCache.get(k);
  if (!e) {
    e = engraveTexture(t, mono);
    printPairCache.set(k, e);
  }
  return e;
}

/* WebKit (the Linux and macOS desktop shells, Safari) hands a texture
   decoded in a worker over as a black bitmap once it is large: the map
   paintings came up as night. Decoding stays on the main thread there. */
const WEBKIT = typeof navigator !== 'undefined' && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

/** preload every texture the scene needs (incl. boat/train icons for traffic) */
export async function loadBoardAssets(): Promise<void> {
  Assets.setPreferences({ preferWorkers: !WEBKIT });
  const urls = ['/beer-barrel.png', '/town-village.webp', '/town-hamlet-0.webp', '/town-hamlet-1.webp', '/town-hamlet-2.webp', '/town-place-0.webp', '/town-place-1.webp', '/town-place-2.webp', '/town-place-3.webp', '/vehicle-boat.png', '/boat-fx.png', '/icon-canal.svg', '/icon-rail.svg'];
  const loaded = await Assets.load(urls);
  /* a works is a nicety, not a need: one not painted yet must not take the
     whole board down with it, so each is asked for on its own and a miss
     leaves the town its painted place */
  const works = await Promise.all(WORKS.map(async (i) => [i, await Assets.load<Texture>(`/town-works-${i}.webp`).catch(() => null)] as const));
  const wharves = await Promise.all(WHARVES.map((n) => Assets.load<Texture>(`/merchant-wharf-${n}.webp`).catch(() => null)));
  tileSet = await buildTileSet({});
  barrelTex = loaded['/beer-barrel.png'];
  /* a house may come alive: a short looping film of its quay served beside
     the still (smoke drifting, lamps flickering). The still stands in when
     no film is served, when the reader has asked for less motion, or
     under WebKit, whose video textures come up as static. */
  const stillOnly = WEBKIT || (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  await Promise.all(
    MERCHANTS.map(async (m) => {
      const name = m.id.replace(/^m-/, '');
      try {
        let tex: Texture | null = null;
        if (!stillOnly) {
          const film = `/merchant-house-${name}.webm`;
          const head = await fetch(film, { method: 'HEAD' }).catch(() => null);
          if (head?.ok && (head.headers.get('content-type') ?? '').startsWith('video/')) {
            tex = await Assets.load<Texture>({ src: film, data: { autoPlay: true, loop: true, muted: true, playsInline: true, preload: true } }).catch(() => null);
          }
        }
        houseArt.set(m.id, tex ?? (await Assets.load(`/merchant-house-${name}.webp`)));
      } catch {
        /* no sign painted for this house: it is not drawn */
      }
    }),
  );
  villageTex = loaded['/town-village.webp'];
  hamletTex = [loaded['/town-hamlet-0.webp'], loaded['/town-hamlet-1.webp'], loaded['/town-hamlet-2.webp']];
  placeTex = [loaded['/town-place-0.webp'], loaded['/town-place-1.webp'], loaded['/town-place-2.webp'], loaded['/town-place-3.webp']];
  worksTex = Object.fromEntries(works.filter(([, t]) => !!t)) as Partial<Record<IndustryType, Texture>>;
  wharfTex = wharves;
  const drawn = [0, 1, 2, 3].map((i) => `town-place-${i}`).concat(WORKS.map((i) => `town-works-${i}`), WHARVES.map((n) => `merchant-wharf-${n}`));
  shadowTex = Object.fromEntries(await Promise.all(drawn.map(async (n) => [n, await Assets.load<Texture>(`/${n}-shadow.webp`).catch(() => null)] as const)));
}

/* The true winding route (same as the SVG board): a dense sampling of the
   bulged quad from routeFor — used for BOTH drawing and hit geometry, so
   the hover zone always sits exactly on the visible track. */
const linkPoints = (def: LinkDef, era: Era = 'canal'): [number, number][] => routeFor(def, era).pts;

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
export function drawOwnerMedallion(g: Graphics, x: number, y: number, col: number, shape: string): void {
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

/** A brass nameplate, the kind screwed to a gallery frame: dark face,
 *  double brass fillet, a screw at each end, the name engraved in cream.
 *  It sits over the plate painted on the sign, so the name reads at every
 *  zoom: counter-scaled with the town ribbons. */
function makeNameplate(labelText: string, cx: number, cy: number): Container {
  const box = new Container();
  box.position.set(cx, cy);
  box.eventMode = 'none';
  const style = { fontFamily: "'IM Fell English SC','Playfair Display',serif", fontSize: RIBBON_FONT + 1, letterSpacing: 2.2 };
  const label = new Text({ text: labelText, style: { ...style, fill: 0xf4e6c2 } });
  label.anchor.set(0.5);
  const w = Math.ceil(label.width) + 34;
  const h = 20;
  const g = new Graphics();
  g.roundRect(-w / 2 + 1.5, -h / 2 + 2.5, w, h, 3).fill({ color: 0x000000, alpha: 0.5 });
  const brass = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
  brass.addColorStop(0, '#E8CD8E').addColorStop(0.5, '#C9A45C').addColorStop(1, '#7E5F28');
  g.roundRect(-w / 2, -h / 2, w, h, 3).fill(brass);
  g.roundRect(-w / 2 + 2.2, -h / 2 + 2.2, w - 4.4, h - 4.4, 2).fill(0x1c150e).stroke({ width: 0.7, color: 0x5a4520, alpha: 0.9 });
  g.moveTo(-w / 2 + 4, -h / 2 + 3.2).lineTo(w / 2 - 4, -h / 2 + 3.2).stroke({ width: 0.7, color: 0xfff3c8, alpha: 0.35 });
  for (const sx of [-w / 2 + 7, w / 2 - 7]) {
    g.circle(sx, 0, 2.2).fill(brass).stroke({ width: 0.6, color: 0x3a2a12 });
    g.moveTo(sx - 1.4, -1).lineTo(sx + 1.4, 1).stroke({ width: 0.7, color: 0x3a2a12 });
  }
  g.eventMode = 'none';
  const under = new Text({ text: labelText, style: { ...style, fill: 0x000000 } });
  under.anchor.set(0.5);
  under.position.set(0, 1);
  under.alpha = 0.7;
  under.eventMode = 'none';
  label.eventMode = 'none';
  box.addChild(g, under, label);
  return box;
}

export function buildBoardScene(bgCanal: Sprite, bgRail: Sprite): BoardScene {
  const world = new Container();
  const linksLayer = new Container();
  const hitLayer = new Container();
  const merchantsLayer = new Container();
  const townsLayer = new Container();
  const ribbonsLayer = new Container();
  const overlay = new Container();
  const hoverLayer = new Container();
  hoverLayer.eventMode = 'none';
  world.addChild(bgCanal, bgRail, linksLayer, merchantsLayer, townsLayer, hitLayer, ribbonsLayer, overlay, hoverLayer);
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

  /* ----------------------------- shadows ----------------------------- */
  /** the shadow a place throws: its own silhouette laid flat on the ground
   *  from its foot, away from the light over the reader's left shoulder —
   *  flipped over the foot, squashed and leaning down and right, the way a
   *  lamp throws a model's shadow across the table. `shade` is the land
   *  where it falls (placeGround.ts): below zero the ground drops away and
   *  the shadow runs long down the slope; above, the ground climbs and it
   *  bunches short and dense against the rise. (ox, oy) is the drawing's
   *  top-left, `size` its side; a drawing shown mirrored leans the other
   *  way in its own frame so the shadow still falls right on the board. */
  const castShadow = (sp: Sprite, name: string, ox: number, oy: number, size: number, shade: number, mirrored = false) => {
    const tex = shadowTex[name];
    const foot = FEET[name];
    if (!tex || !foot) {
      sp.visible = false;
      return;
    }
    const [fx, fy] = foot;
    const down = Math.max(0, -shade);
    const up = Math.max(0, shade);
    const flip = mirrored ? -1 : 1;
    const k = size / tex.width;
    sp.visible = true;
    if (sp.texture !== tex) sp.texture = tex;
    sp.anchor.set(fx, fy);
    sp.position.set(ox + fx * size, oy + fy * size);
    sp.scale.set(k, -k * (0.55 + down * 0.75 - up * 0.3));
    sp.skew.x = flip * (0.75 + down * 0.3);
    sp.alpha = 0.5 - down * 0.1 + up * 0.18;
  };
  /* the wharves' shadows and the signs' posts, recast when the ground changes */
  const wharves: { g: Sprite; name: string; ox: number; oy: number; size: number; id: string }[] = [];
  const signPosts: { raise: (shade: number) => void; id: string }[] = [];
  /* how the land lies under each place on the ground in play; empty on a level one */
  let groundShade: Record<string, number> = {};

  /* ---------------------------- merchants ---------------------------- */
  /* The merchant houses: each one a painted SIGN — gilded frame, the quay
     at dusk, the name on a brass plate, a blank brass medallion — served as
     one picture (tools/assets/build-houses.py). In front of the painting,
     one physical tile per printed slot and the beer barrel at its foot; on
     the medallion, the bonus engraved. Everything that changes (tiles,
     barrels, claimed, closed) is redrawn in drawMerchants.               */
  const SIGN_W = 236; // every sign the same width; its height follows the picture
  const MT = 46; // merchant tile size
  const MT_GAP = 10;
  const merchantBeer = new Map<string, Container>();
  const merchantDyn = new Map<string, { plate: Container; slots: Container; medal: Container; claimed: Container; closed: Container; slotX: number[]; tileTop: number }>();
  const ribbons: Container[] = [];
  for (const m of MERCHANTS) {
    const id = m.id.replace(/^m-/, '');
    const house = HOUSES[id];
    const tex = houseArt.get(m.id);
    if (!house || !tex) continue;
    const W = SIGN_W;
    const H = W / house.aspect;
    const plate = new Container();
    /* southern merchants (Oxford, Gloucester) sit on the map's bottom edge:
       their sign rides 34 units above the node so the hand dock never hides it */
    const south = m.y > 1500;
    plate.position.set(m.x, m.y - (south ? 34 : 0));
    plate.scale.set(1.45);
    plate.eventMode = 'none';

    /* the wharf the sign belongs to, standing on the map below it: the same
       hand as the towns' places, the same light, its own cleared ground */
    const qi = MERCHANTS.indexOf(m) % Math.max(1, wharfTex.length);
    const quay = wharfTex[qi];
    if (quay) {
      const qw = W * 0.92;
      const q = new Sprite(quay);
      q.anchor.set(0.5);
      q.width = qw;
      q.height = qw;
      q.position.set(0, H * 0.52 + qw * 0.22);
      q.alpha = 0.94;
      q.eventMode = 'none';
      const qShadow = new Sprite();
      qShadow.eventMode = 'none';
      plate.addChild(qShadow, q);
      wharves.push({ g: qShadow, name: `merchant-wharf-${qi}`, ox: -qw / 2, oy: q.y - qw / 2, size: qw, id: m.id });
    }
    /* the sign stands on the quay: two oak posts from its lower corners down
       to the deck, their feet planted, and the board's shadow thrown across
       the deck and the ground beyond from the light over the reader's left
       shoulder. Where the ground falls away the posts run longer to reach
       it and the shadow runs with them; against a rise both draw in. */
    const posts = new Graphics();
    posts.eventMode = 'none';
    const signShadow = new Graphics();
    signShadow.eventMode = 'none';
    const deck = quay ? H * 0.52 + W * 0.92 * 0.22 : H / 2 + 36;
    const raise = (shade: number) => {
      const down = Math.max(0, -shade);
      const up = Math.max(0, shade);
      const foot = H / 2 + (deck - H / 2) * (1 + down * 0.35 - up * 0.15);
      const lean = 0.75 + down * 0.3;
      const h = (foot + H / 2) * 0.5 * (1 + down * 0.75 - up * 0.3);
      posts.clear();
      signShadow.clear();
      const [l, r] = [-W / 2 + 22, W / 2 - 22];
      for (const px of [l, r]) {
        posts.roundRect(px - 4, H / 2 - 10, 8, foot - H / 2 + 10, 2).fill(0x3e2a18);
        posts.rect(px - 4, H / 2 - 10, 3, foot - H / 2 + 10).fill({ color: 0x8a6640, alpha: 0.7 });
        posts.ellipse(px, foot, 9, 3.5).fill({ color: 0x1e160e, alpha: 0.35 });
      }
      signShadow.poly([l - 4, foot, r + 4, foot, r + 4 + lean * h, foot + h, l - 4 + lean * h, foot + h]).fill({ color: 0x1e160e, alpha: 0.3 - down * 0.06 + up * 0.1 });
    };
    raise(0);
    signPosts.push({ raise, id: m.id });
    const sign = new Sprite(tex);
    sign.anchor.set(0.5);
    sign.width = W;
    sign.height = H;
    sign.eventMode = 'none';
    plate.addChild(signShadow, posts, sign);

    /* tile shelves (static): a faint recess where each merchant tile sits,
       low and left on the board, over the wharf's water */
    const slotX: number[] = [];
    const x0 = -W / 2 + W * 0.09 + MT / 2;
    const tileTop = -H * 0.06;
    const shelf = new Graphics();
    shelf.eventMode = 'none';
    for (let i = 0; i < m.slots; i++) {
      const x = x0 + i * (MT + MT_GAP);
      slotX.push(x);
      shelf.roundRect(x - MT / 2 - 2, tileTop - 2, MT + 4, MT + 4, 6).fill({ color: 0x000000, alpha: 0.4 }).stroke({ width: 0.8, color: 0xc9a45c, alpha: 0.35 });
    }
    plate.addChild(shelf);

    /* the bonus, engraved on the sign's own medallion */
    const medalX = (house.medal[0] - 0.5) * W;
    const medalY = (house.medal[1] - 0.5) * H;
    const medalR = house.medal[2] * W;
    const cap = new Text({
      text: tr('board.merchant.bonus').toUpperCase(),
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 6.5, fontWeight: '700', letterSpacing: 1.8, fill: 0xe8c87a },
    });
    cap.anchor.set(0.5);
    cap.position.set(medalX, medalY + medalR + 7);
    cap.eventMode = 'none';
    /* only where it fits between the medallion and the frame's bottom band */
    if (medalY + medalR + 12 < H / 2 - 8) plate.addChild(cap);

    const slots = new Container();
    slots.eventMode = 'none';
    const medal = new Container();
    medal.eventMode = 'none';
    /* long labels ("+2 income") engrave on two lines: the figure big, the word small */
    const words = m.bonusLabel.split(' ');
    const big = words.length > 1 ? words[0] : m.bonusLabel;
    const small = words.length > 1 ? words.slice(1).join(' ') : '';
    const bigFont = Math.min(medalR * 0.95, big.length <= 3 ? 17 : big.length <= 5 ? 14 : big.length <= 6 ? 11 : 9.5);
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
      engrave(big, bigFont, medalY - 4, true);
      engrave(small.toUpperCase(), 6.5, medalY + 8, false);
    } else {
      engrave(big, bigFont, medalY, true);
    }
    /* claimed: the medallion is spent — dark wash and a cream check */
    const claimed = new Container();
    claimed.eventMode = 'none';
    const wash = new Graphics().circle(medalX, medalY, medalR).fill({ color: 0x100d0b, alpha: 0.62 });
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
    closed.position.set(-W * 0.12, 0);
    closed.addChild(stampBox, stamp);
    closed.visible = false;
    plate.addChild(slots, medal, claimed, closed);

    merchantsLayer.addChild(plate);
    merchantBeer.set(m.id, slots);
    merchantDyn.set(m.id, { plate, slots, medal, claimed, closed, slotX, tileTop });

    /* the name, legible at every zoom: a counter-scaled brass plate laid over
       the one painted on the sign's top band */
    const box = makeNameplate(m.name.toUpperCase(), m.x, m.y - (south ? 34 : 0) - (H / 2 - H * 0.1) * 1.45);
    ribbonsLayer.addChild(box);
    ribbons.push(box);
  }

  /* ----------------------------- villages ---------------------------- */
  /* Painted village grounding each town cluster, BELOW the slot tiles   */
  /* (TownNode: deterministic mirror, 0.62 opacity — 0.55 for farms).    */
  /* Under the engraved map the same box holds an ink hamlet instead.    */
  /* The shadow is cast here, not baked (castShadow), so the land can     */
  /* shape it; the annex holds a second trade behind the first.           */
  type Village = { box: Container; sprite: Sprite; annex: Sprite; shadow: Sprite; annexShadow: Sprite; mirror: boolean; town: (typeof TOWNS)[number]; farm: boolean; hamlet: number; place: number; h: number };
  const villages: Village[] = [];
  /* which family of places is in play, so a redraw knows whether to dress */
  let villageStyle: 'painted' | 'engraved' = 'painted';
  for (const town of TOWNS) {
    const c = townChrome(town);
    const mirror = (town.x * 7 + town.y * 13) % 2 === 0;
    const vBox = new Container();
    vBox.position.set(c.villageCx, c.villageBottom);
    vBox.scale.x = mirror ? -1 : 1;
    vBox.alpha = town.farm ? 0.55 : 0.62;
    vBox.eventMode = 'none';
    const shadow = new Sprite();
    shadow.eventMode = 'none';
    const annexShadow = new Sprite();
    annexShadow.eventMode = 'none';
    const annex = new Sprite();
    annex.visible = false;
    annex.eventMode = 'none';
    const v = new Sprite(villageTex);
    v.position.set(-c.villageH / 2, -c.villageH);
    v.width = c.villageH;
    v.height = c.villageH;
    v.eventMode = 'none';
    vBox.addChild(shadow, annexShadow, annex, v);
    townsLayer.addChild(vBox);
    villages.push({ box: vBox, sprite: v, annex, shadow, annexShadow, mirror, town, farm: !!town.farm, hamlet: (town.x * 3 + town.y * 5) % 3, place: (town.x * 5 + town.y * 11) % 4, h: c.villageH });
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
      const detailC = new Container();
      detailC.eventMode = 'none';
      townsLayer.addChild(ring, frame, art, art2, artMask, deco, extras, detailC, badges, hit);
      slots.push({ ring, frame, art, art2, artMask, extras, detailC, badges, deco, glow: topGlow, hit, artBase: 0.95, spotAlpha: 1, hasTile: false, flipped: false });
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
  /* the unbuilt links drawn as water, which hiding only dims */
  const water = new Set<string>();
  const WATER_DIM = 0.45;
  let bigChips = false;
  let greyFreeMerchants = false;
  let stockStyle: StockStyle = 'counter';
  let look: TileLook = { ...DEFAULT_TILE_LOOK };
  let styleReq = 0;

  /* resource stock badge layouts on a built tile (A-B choice) */
  /* level and link value, top-left of a built tile: a dark plaque with the
     level as a roman numeral, then one chain link per point the tile adds
     to each neighbouring canal or rail at era's end. Sits in `badges` so it
     reads at any zoom, like the stock disc. */
  const ROMAN = ['', 'I', 'II', 'III', 'IV'];
  const drawLevelMark = (into: Container, x: number, y: number, level: number, links: number, muted: boolean) => {
    const h = bigChips ? 14 : 12;
    const x0 = x - TILE_HALF + 2.75;
    const y0 = y - TILE_HALF + 2.75;
    const ink = muted ? 0xc9b48a : 0xf4ecd8;
    const g = new Graphics();
    g.eventMode = 'none';
    const numeral = new Text({
      text: ROMAN[level] ?? String(level),
      style: { fontFamily: "'Playfair Display', serif", fontSize: bigChips ? 10.5 : 9, fontWeight: '900', fill: ink },
    });
    numeral.anchor.set(0.5);
    numeral.eventMode = 'none';
    const w1 = Math.max(h + 2, Math.ceil(numeral.width) + 8);
    g.roundRect(x0, y0, w1, h, 3).fill({ color: 0x0c0a08, alpha: muted ? 0.5 : 0.74 }).stroke({ width: 0.6, color: ink, alpha: 0.3 });
    numeral.position.set(x0 + w1 / 2, y0 + h / 2 + 0.5);
    into.addChild(g, numeral);
    if (links <= 0) return;
    const lw = bigChips ? 8 : 7;
    const lh = bigChips ? 5 : 4;
    const step = lw - 2;
    const w2 = 6 + step * (links - 1) + lw;
    const x1 = x0 + w1 + 2;
    g.roundRect(x1, y0, w2, h, 3).fill({ color: 0x0c0a08, alpha: muted ? 0.5 : 0.74 }).stroke({ width: 0.6, color: ink, alpha: 0.3 });
    for (let i = 0; i < links; i++) {
      g.roundRect(x1 + 3 + i * step, y0 + h / 2 - lh / 2, lw, lh, lh / 2).stroke({ width: 1.1, color: ink, alpha: muted ? 0.8 : 0.95 });
    }
  };
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
  /* the hit strokes follow the era's routes: retraced when the era turns */
  let hitEra: Era = 'canal';
  const drawLinks = (game: GameState) => {
    if (game.era !== hitEra) {
      hitEra = game.era;
      for (const def of LINKS) {
        const hit = linkHit.get(def.id)!;
        hit.clear();
        tracePath(hit, linkPoints(def, hitEra));
        hit.stroke({ width: 26, color: 0xffffff, alpha: 0 });
      }
    }
    for (const def of LINKS) {
      const g = linkGfx.get(def.id)!;
      g.clear();
      g.alpha = 1;
      const pts = linkPoints(def, game.era);
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
        if (railStyle && game.era === 'rail') {
          /* the railway itself is painted into the rail-era map (ballast,
             sleepers, steel): the trace only lifts it — a faint dark bed
             for readability over the mist, a steel glint down the middle */
          tracePath(g, pts);
          g.stroke({ width: 9, color: 0x0c0e0e, alpha: furrow * 0.35, cap: 'round', join: 'round' });
          tracePath(g, pts);
          g.stroke({ width: 2, color: 0xb4bcc2, alpha: furrow * 0.5, cap: 'round', join: 'round' });
        } else if (railStyle) {
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
        /* board option (key C): unbuilt traces hidden. Water is geography,
           not a trace: an unbuilt canal keeps its ribbon, only dimmed, so
           the country does not lose its rivers when the surveys go */
        if (railStyle) water.delete(def.id);
        else water.add(def.id);
        if (hideUnbuilt) g.alpha = railStyle ? 0 : WATER_DIM;
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
          /* one unbroken sheen: dashes here read as sleepers, and a canal
             in the owner's colour was taken for a railway */
          tracePath(g, pts);
          g.stroke({ width: 1.4, color: tint(col, 0.6), alpha: 0.6, cap: 'round', join: 'round' });
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

  /** the trades a town wears: its built works in the order the board reads
   *  them, each kind once — the first is the place itself, so it changes
   *  the moment the first works goes up and settles on whatever was built
   *  first after that; the second kind stands behind it as an annex */
  const tradesOf = (game: GameState, town: (typeof TOWNS)[number]): IndustryType[] => {
    const out: IndustryType[] = [];
    for (let si = 0; si < town.slots.length; si++) {
      const tile = game.tiles[tileKey(town.id, si)];
      if (tile && worksTex[tile.industry] && !out.includes(tile.industry)) out.push(tile.industry);
    }
    return out;
  };
  const builtIn = (game: GameState, town: (typeof TOWNS)[number]): number => {
    let n = 0;
    for (let si = 0; si < town.slots.length; si++) if (game.tiles[tileKey(town.id, si)]) n++;
    return n;
  };

  /** lay each town's place: the ink hamlet of the engraved map; else its
   *  works if it has one — a tenth larger for every further works, three at
   *  most, a second trade as an annex — else the painted village its
   *  coordinates chose for it; and under all of these the shadow the land
   *  gives it. Farms never grow and never trade. */
  const layVillages = (game: GameState | null) => {
    const engraved = villageStyle === 'engraved' && hamletTex.length === 3;
    /* every other ground gets one of four painted places, a farm always the
       hamlet of the four: the same picture under twenty-two towns read as
       wallpaper, and at the painting's old size it read as nothing at all */
    const placed = !engraved && placeTex.length === 4;
    for (const v of villages) {
      const trades = game && placed && !v.farm ? tradesOf(game, v.town) : [];
      const built = game && placed && !v.farm ? builtIn(game, v.town) : 0;
      const first = trades[0];
      const name = first ? `town-works-${first}` : `town-place-${v.farm ? 3 : v.place}`;
      const tex = engraved ? hamletTex[v.hamlet] : placed ? (first && worksTex[first]) || placeTex[v.farm ? 3 : v.place] : villageTex;
      if (v.sprite.texture !== tex) v.sprite.texture = tex;
      /* the painting fits the card block; the hamlet is drawn wider, its
         church above the cards and its wharf below the ribbon, so the
         town shows around them. Farms have no hamlet. */
      const grow = 1 + 0.1 * Math.min(3, Math.max(0, built - 1));
      const size = (engraved ? v.h * 2.2 : placed ? v.h * 1.15 : v.h) * grow;
      const lift = engraved ? v.h * 0.4 : placed ? v.h * 0.22 : 0;
      v.sprite.width = size;
      v.sprite.height = size;
      v.sprite.position.set(-size / 2, -size + lift);
      v.box.alpha = engraved ? (v.farm ? 0 : 0.85) : placed ? (v.farm ? 0.72 : 0.84) : v.farm ? 0.55 : 0.62;
      const second = trades[1] ? worksTex[trades[1]] : undefined;
      v.annex.visible = !!second;
      const shade = groundShade[v.town.id] ?? 0;
      if (second) {
        if (v.annex.texture !== second) v.annex.texture = second;
        const a = size * 0.62;
        const ax = -size / 2 - a * 0.22;
        const ay = -size + lift + size * 0.08;
        v.annex.width = a;
        v.annex.height = a;
        v.annex.position.set(ax, ay);
        castShadow(v.annexShadow, `town-works-${trades[1]}`, ax, ay, a, shade, v.mirror);
      } else v.annexShadow.visible = false;
      if (placed) castShadow(v.shadow, name, -size / 2, -size + lift, size, shade, v.mirror);
      else v.shadow.visible = false;
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
          /* the whole tile CARD is the ownership marker (physical game):
             the painting comes precomposed on the owner's colour. The card
             is a physical object laid ON the printed board: soft drop
             shadow, a darker bottom edge for thickness, and the owner's
             colour on the rim so ownership reads at every zoom. */
          frame.roundRect(x - TILE_HALF + 1, y - TILE_HALF + 4, TILE - 2, TILE, 7).fill({ color: 0x000000, alpha: 0.42 });
          frame.roundRect(x - TILE_HALF, y - TILE_HALF + 2.5, TILE, TILE, 6).fill(shade(col, 0.42));
          if (tile.flipped) {
            /* flipped = the works has paid out: the painting stays as a sepia
               engraving over the owner's colour, so a flipped mill still
               reads as a mill, and the score sits in the middle on a brass
               token, stamped like a counter laid on the card. The owner's
               rim stays, quieter. */
            art.texture = tileSet.print[tile.industry] ?? tileSet.cut[tile.industry];
            art.position.set(x - TILE_HALF, y - TILE_HALF);
            artMask.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
            art.mask = artMask;
            art.width = TILE;
            art.height = TILE;
            sv.artBase = 0.42;
            art.alpha = sv.artBase;
            art.visible = true;
            extras.roundRect(x - TILE_HALF + 1.25, y - TILE_HALF + 1.25, TILE - 2.5, TILE - 2.5, 5.5).stroke({ width: 2.5, color: col, alpha: 0.6 });
            extras.roundRect(x - TILE_HALF + 2.75, y - TILE_HALF + 2.75, TILE - 5.5, TILE - 5.5, 4.5).stroke({ width: 0.8, color: 0x0c0a08, alpha: 0.7 });
            /* the token: a brass coin, dark face, milled edge, the score stamped */
            const R = 14;
            const token = new Graphics();
            token.circle(x + 1, y + 2, R).fill({ color: 0x000000, alpha: 0.4 });
            token.circle(x, y, R).fill(0x2a2118).stroke({ width: 2, color: 0xc9a45c });
            token.circle(x, y, R - 3).stroke({ width: 0.8, color: 0xc9a45c, alpha: 0.55 });
            token.eventMode = 'none';
            const vpText = new Text({
              text: String(lv.vp),
              style: { fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: '900', fill: 0xe8c47a },
            });
            vpText.anchor.set(0.5);
            vpText.position.set(x, y - 2);
            vpText.eventMode = 'none';
            const vpLabel = new Text({
              text: tr('board.tile.vp'),
              style: { fontFamily: "'Archivo', sans-serif", fontSize: 5.5, fontWeight: '700', letterSpacing: 1.4, fill: 0xc9a45c },
            });
            vpLabel.anchor.set(0.5);
            vpLabel.position.set(x, y + 7.5);
            vpLabel.eventMode = 'none';
            badges.addChild(token, vpText, vpLabel);
            if (look.colorBlind && look.sealTiles) drawOwnerMedallion(extras, x + TILE_HALF - 8, y - TILE_HALF + 8, col, shape);
            drawLevelMark(badges, x, y, tile.level, lv.links, true);
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
            drawLevelMark(badges, x, y, tile.level, lv.links, false);
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
          sv.glow.visible = !variantOf(allows[0], tileArt)?.label;
          /* NO ring on empty slots — a contour only appears once a player
             owns the tile, and then in THEIR colour (see built branch) */
          /* tile body: dark face, NO border on empty slots — the frame is
             the owner marker, it only means something once a tile is built;
             the town colour code stays on the name banner (physical game) */
          frame.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0x12100c);
          /* the painted art IS the face, full colour at every zoom.
             Dual slot: the generated combined painting when available
             (one cohesive composition), otherwise the half-crop split. */
          const engraved = look.slotArt !== 'painted';
          /* the print set: sepia, or black ink on white for plainer slots */
          const mono = look.slotArt === 'mono';
          const prints = mono ? { pair: tileSet.monoPair, halfL: tileSet.monoHalfL, halfR: tileSet.monoHalfR, print: tileSet.mono } : { pair: tileSet.printPair, halfL: tileSet.printHalfL, halfR: tileSet.printHalfR, print: tileSet.print };
          if (allows.length > 1) {
            const combined = (engraved ? prints.pair : tileSet.pair)[pairKey(allows[0], allows[1])];
            if (combined) {
              art.texture = combined;
              art.position.set(x - TILE_HALF + 4, y - TILE_HALF + 4);
              art.width = TILE - 8;
              art.height = TILE - 8;
              art2.visible = false;
            } else {
              const hw = (TILE - 8) / 2;
              art.texture = (engraved ? prints.halfL : tileSet.halfL)[allows[0]];
              art.position.set(x - TILE_HALF + 4, y - TILE_HALF + 4);
              art.width = hw;
              art.height = TILE - 8;
              art2.texture = (engraved ? prints.halfR : tileSet.halfR)[allows[1]];
              art2.position.set(x - TILE_HALF + 4 + hw, y - TILE_HALF + 4);
              art2.width = hw;
              art2.height = TILE - 8;
              art2.visible = true;
              frame.moveTo(x, y - TILE_HALF + 4).lineTo(x, y + TILE_HALF - 4).stroke({ width: 2, color: 0x0c0a08 });
            }
          } else {
            art.texture = (engraved ? prints.print : tileSet.cut)[allows[0]];
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
      const TILE_TOP = dyn.tileTop;
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
          painting('cotton', x, cy - 10, 20);
          painting('manufacturer', x - 10, cy + 9, 20);
          painting('pottery', x + 10, cy + 9, 20);
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
      /* unbuilt traces soften under a spotlight too (unless hidden — water stays, dimmed) */
      else linkGfx.get(def.id)!.alpha = hideUnbuilt ? (water.has(def.id) ? WATER_DIM : 0) : spotlight === null ? 1 : 0.45;
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
    hoverLayer,
    linkGfx,
    linkHit,
    towns,
    merchantBeer,
    ribbons,
    redraw(game: GameState) {
      lastGame = game;
      drawLinks(game);
      drawTowns(game);
      layVillages(game);
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
    async setTileArt(art: TileArt) {
      const req = ++styleReq;
      const set = await buildTileSet(art);
      if (req !== styleReq) return; // a later switch won
      tileSet = set;
      tileArt = art;
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
    setVillages(style, ground) {
      villageStyle = style;
      groundShade = (ground && SHADE[ground]) || {};
      layVillages(lastGame);
      for (const w of wharves) castShadow(w.g, w.name, w.ox, w.oy, w.size, groundShade[w.id] ?? 0);
      for (const p of signPosts) p.raise(groundShade[p.id] ?? 0);
    },
  };
}

