import { Assets, Container, FillGradient, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { INDUSTRIES, LINKS, MERCHANTS, PLAYER_COLORS, TOWNS } from '@/game/data';
import { barrelKey } from '@/game/engine';
import { townColor } from '@/game/townColors';
import { routeFor } from '@/components/game/routePaths';
import { merchantOpen, tileKey } from '@/game/engine';
import { tr } from '@/i18n';
import type { Era, GameState, IndustryType, LinkDef } from '@/game/types';
import { RIBBON_FONT, RIBBON_GAP, RIBBON_H, TILE, TILE_HALF, ribbonWidth, townChrome } from '@/components/game/townChrome';
import { FEET, SHADE } from './placeGround';
import { FIGURE_MIN_SCREEN, SEAL_MIN_SCREEN } from './floor';
import { roman } from './roman';
import { MEDAL_R, MT, ROW_SCALE, barrelLocal, rowLift, rowSlotX, rowWidth } from './merchantRow';
import type { FloorRule } from './floor';
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
/** the cream casing laid under a mark so it reads on water, hills and
 *  towns alike: the supply lines wear it, and so does an owner's mark */
export const CASING = 0xf2ead6;
/** how a built card is dressed (board options) */
export interface TileLook {
  slotArt: SlotArt;
  /** colour-blind mode: the owner's seal drawn larger on built cards, and
   *  seated on the links too (the seal on a card is always there) */
  colorBlind: boolean;
  sealTiles: boolean;
  sealLinks: boolean;
  cardGrain: boolean;
  chipStyle: ChipStyle;
}
export const DEFAULT_TILE_LOOK: TileLook = { slotArt: 'engraved', colorBlind: false, sealTiles: true, sealLinks: true, cardGrain: true, chipStyle: 'band' };
const playerHex = (game: GameState, i: number): number => hex(PLAYER_COLORS[game.players[i].color]?.hex ?? '#C9A45C');
/** a mark on a card that keeps a floor on screen (floor.ts): the ticker
 *  scales it about its own pin, as it does the name ribbons */
export interface Floored extends FloorRule {
  c: Container;
  /** the small print inside it, faded with the detail at far zoom */
  fine?: Container;
}
export interface SlotView {
  /** the whole card, pinned at the slot's centre: the ticker presses it
   *  when a tile is struck there (stamp.ts), and nothing else moves it */
  box: Container;
  frame: Graphics; // tile body (empty dark card / flipped muted card)
  art: Sprite; // painted face (slot cutout / built player-colour card)
  art2: Sprite; // right-half painting for dual-industry slots
  artMask: Graphics; // GPU-rounded clip on the built card (empty otherwise)
  rim: Graphics; // the owner's rim on a built card: read at every zoom
  detail: Container; // the income/VP band: faded at far zoom (farDetail)
  badges: Container; // level, stock, VP token, owner seal: always shown, floored
  deco: Container; // empty-slot chrome: frame lip, top glow
  glow: Graphics; // the top glow alone, hidden over a printed label
  /** the badges that keep a screen floor, rebuilt with them */
  floored: Floored[];
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
  /** everything printed on the table — ground, links, the ambiance,
   *  merchants, towns, ribbons — under one sheet, so a veil laid over the
   *  land is one pass and leaves the overlay, the hover and the FX in colour */
  land: Container;
  /** the four ground sheets alone: the night of a game read again */
  ground: Container;
  /** the sheet the links are drawn on; the ambiance goes right above it */
  linksLayer: Container;
  /** each era's painting, with the apron of ground laid round it */
  bgCanal: Container;
  bgRail: Container;
  /** the survey laid over each era's ground, hidden with the traces */
  etchCanal: Sprite;
  etchRail: Sprite;
  overlay: Container; // planning highlights, ghost lines, FX — above towns
  /** the one hover effect (a route lit under the pointer): its own layer,
   *  so a hover never rebuilds the overlay */
  hoverLayer: Container;
  linkGfx: Map<string, Graphics>;
  towns: Map<string, TownView>;
  merchantBeer: Map<string, Container>;
  /** all ribbon containers (towns + merchants) for the counter-scale pass */
  ribbons: Container[];
  redraw: (game: GameState) => void;
  setSpotlight: (player: number | null) => void;
  /** light only these slots (null = back to the spotlight rule); when
   *  `first` names some of them, those alone at full strength */
  setHighlight: (keys: string[] | null, first?: string[] | null) => void;
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

/** one print run: the engraved face, its halves, the dual-slot scenes */
interface Prints {
  print: Record<IndustryType, Texture>;
  halfL: Record<IndustryType, Texture>;
  halfR: Record<IndustryType, Texture>;
  pair: Record<string, Texture>;
}
/** every painting-derived texture for one tile style */
interface TileSet {
  cut: Record<IndustryType, Texture>; // transparent cutouts (empty slots, merchants)
  built: Record<IndustryType, Record<string, Texture>>; // per-owner-colour cards (plain)
  builtGrain: Record<IndustryType, Record<string, Texture>>; // same, paper grain baked in
  halfL: Record<IndustryType, Texture>; // colour left half (dual slots, fallback)
  halfR: Record<IndustryType, Texture>; // colour right half (fallback)
  pair: Record<string, Texture>; // combined dual-industry cutouts: key "a-b" (sorted)
  sepia: Prints; // the engraved sepia print (empty slots, the default)
  /** the black-and-white print, pulled only when a reader asks for it */
  mono: () => Prints;
  /** the reverse of a flipped card, the painting as one ink (inkTexture):
   *  pulled the first time a works of that industry turns over */
  ink: (i: IndustryType) => Texture;
  /** what the set is made of (cache keys), so a set no longer worn can be let go */
  arts: Set<string>;
  pairs: Set<string>;
}
/** what a piece of art holds on to: the files it was cut from, handed back
 *  to the loader, and the textures baked from them, destroyed */
interface Holdings {
  urls: string[];
  baked: Texture[];
}
/** one industry's textures from one variant directory */
interface IndustryArt extends Holdings {
  cut: Texture;
  built: Record<string, Texture>;
  builtGrain: Record<string, Texture>;
  halfL: Texture;
  halfR: Texture;
  print: Texture;
  printHalfL: Texture;
  printHalfR: Texture;
  /** the mono print, pulled on first call */
  mono: () => { print: Texture; halfL: Texture; halfR: Texture };
  /** the one-ink print of a flipped card's reverse, pulled on first call */
  ink: () => Texture;
}
/** one dual slot's scene, painted as one or assembled, and its prints */
interface PairArt extends Holdings {
  scene: Texture;
  print: Texture;
  mono: () => Texture;
}
const artCache = new Map<string, Promise<IndustryArt>>(); // `${dir}|${industry}`
const pairCache = new Map<string, Promise<PairArt | null>>(); // `${variant a}|${a}|${variant b}|${b}`
let tileSet: TileSet; // the set currently painted
let tileArt: TileArt = {}; // the variant choices it was built from
let barrelTex: Texture;
let villageTex: Texture;
/** the files loadBoardAssets fetched for the table itself, handed back on leaving */
let tableUrls: string[] = [];
/** the ground sheets the table wears now (PixiBoard says which, wearSheets) */
let sheetUrls: string[] = [];
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

/** lighten toward white by `f` (0..1) */
const tint = (c: number, f: number): number => {
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * f));
  return (ch((c >> 16) & 0xff) << 16) | (ch((c >> 8) & 0xff) << 8) | ch(c & 0xff);
};
/** multiply an rgb int by f (clamped) — muted owner colour */
const shade = (c: number, f: number): number => {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
};

/* the page's turn between two bakes: one texture is a few milliseconds of
   work, a whole set in one go held the press for the better part of a second */
const yieldToPage = (): Promise<void> => {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return s?.yield ? s.yield() : new Promise((r) => setTimeout(r, 0));
};

/** a painting drawn onto a canvas the CPU can read back quickly (a canvas
 *  left to the GPU pays a readback for every getImageData) */
function pixelsOf(tex: Texture): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData } | null {
  const src = tex.source.resource as CanvasImageSource | undefined;
  if (!src) return null;
  const c = document.createElement('canvas');
  c.width = tex.width;
  c.height = tex.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return { c, ctx, img: ctx.getImageData(0, 0, c.width, c.height) };
}

/* the engraving's tone curve, set in type once: 1024 steps of luminance to
   an ink-and-paper colour, sepia and black-and-white — a lookup where each
   pixel used to pay a Math.pow */
const TONE_STEPS = 1024;
const toneTable = (mono: boolean): Uint8ClampedArray => {
  const ink = mono ? [0x12, 0x10, 0x0e] : [0x2a, 0x21, 0x18];
  const paper = mono ? [0xf0, 0xec, 0xe2] : [0xbf, 0xa9, 0x82];
  const t = new Uint8ClampedArray(TONE_STEPS * 3);
  for (let i = 0; i < TONE_STEPS; i++) {
    const raw = i / (TONE_STEPS - 1);
    const lum = mono ? Math.min(1, Math.max(0, (Math.pow(raw, 0.9) - 0.5) * 1.35 + 0.5)) : Math.pow(raw, 0.85);
    for (let k = 0; k < 3; k++) t[i * 3 + k] = ink[k] + (paper[k] - ink[k]) * lum;
  }
  return t;
};
let sepiaTone: Uint8ClampedArray | null = null;
let monoTone: Uint8ClampedArray | null = null;

/** Empty slots are PRINTED on the board, built works are physical cards
 *  laid on top (official board: grey printed icons vs. player-colour tiles).
 *  Rebake a painting as a monochrome sepia engraving — ink for the darks,
 *  parchment for the lights — so the colour of a placed tile is the only
 *  colour in the slot grid. Done once per texture at load. */
function engraveTexture(tex: Texture, mono = false): Texture {
  const px = pixelsOf(tex);
  if (!px) return tex;
  const d = px.img.data;
  /* ink #2a2118 → faded parchment #bfa982, slight gamma so mid-tones stay
     legible; the mono print is black ink on white paper, contrast pushed,
     for eyes that want the empty slots plainer still */
  const tone = mono ? (monoTone ??= toneTable(true)) : (sepiaTone ??= toneTable(false));
  const k = (TONE_STEPS - 1) / 255;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const j = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * k + 0.5) | 0;
    d[i] = tone[j * 3];
    d[i + 1] = tone[j * 3 + 1];
    d[i + 2] = tone[j * 3 + 2];
  }
  px.ctx.putImageData(px.img, 0, 0);
  return Texture.from(px.c);
}

/** The reverse of a card (a flipped works) is printed in one ink, the
 *  owner's: rebake a painting as the ink alone — white, its opacity the
 *  darkness of the painting, so the lights drop out and the card's own
 *  colour shows through them. A tint then chooses the ink. The curve
 *  opens the darks a little, so a black subject (a cart of coal)
 *  keeps its detail rather than printing as one blot. */
function inkTexture(tex: Texture): Texture {
  const px = pixelsOf(tex);
  if (!px) return tex;
  const d = px.img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const ink = Math.min(1, Math.max(0, (1 - lum - 0.1) * 1.3)) ** 1.15;
    d[i + 3] = Math.round(d[i + 3] * ink);
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
  }
  px.ctx.putImageData(px.img, 0, 0);
  return Texture.from(px.c);
}

/** Built cards are cardboard: a faint paper grain (art direction: 4–7 %
 *  overlay) baked once into the owner-colour card texture. Deterministic
 *  hashed cells of a few texels so the grain still shows once the card is
 *  scaled down to its ~60–100 px on screen. */
function grainTexture(tex: Texture): Texture {
  const px = pixelsOf(tex);
  if (!px) return tex;
  const d = px.img.data;
  const w = px.c.width;
  const h = px.c.height;
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
      d[i] += g;
      d[i + 1] += g;
      d[i + 2] += g;
    }
  }
  px.ctx.putImageData(px.img, 0, 0);
  return Texture.from(px.c);
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

/** bake one texture from another, the page given its turn first, and keep
 *  the result on the holder's books (a bake that fell back to its source
 *  owns nothing new) */
async function bake(into: Texture[], from: Texture, make: (t: Texture) => Texture): Promise<Texture> {
  await yieldToPage();
  const t = make(from);
  if (t !== from) into.push(t);
  return t;
}

const artKey = (v: TileVariant | undefined, i: IndustryType): string => `${v?.dir ?? ''}|${i}`;

/** fetch (once) one industry's art from a variant: the cutout and the four
 *  colour cards, the cards grained, the cutout engraved in sepia — the mono
 *  print waits until a reader asks for it */
function loadIndustryArt(v: TileVariant | undefined, i: IndustryType): Promise<IndustryArt> {
  const dir = v?.dir ?? '';
  const key = artKey(v, i);
  let p = artCache.get(key);
  if (!p) {
    p = (async () => {
      const colorNames = Object.keys(PLAYER_COLORS);
      const cutUrl = dir + CUT_FOR(i, v?.ext);
      const builtUrls = colorNames.map((c) => dir + BUILT_FOR(i, c, v?.ext));
      const urls = [cutUrl, ...builtUrls];
      const loaded = await Assets.load<Texture>(urls);
      const cut = loaded[cutUrl];
      const built = Object.fromEntries(colorNames.map((c, n) => [c, loaded[builtUrls[n]]])) as Record<string, Texture>;
      const baked: Texture[] = [];
      const builtGrain: Record<string, Texture> = {};
      for (const c of colorNames) builtGrain[c] = await bake(baked, built[c], grainTexture);
      const print = await bake(baked, cut, (t) => engraveTexture(t));
      let mono: { print: Texture; halfL: Texture; halfR: Texture } | null = null;
      let ink: Texture | null = null;
      return {
        cut,
        built,
        builtGrain,
        halfL: half(cut, false),
        halfR: half(cut, true),
        print,
        printHalfL: half(print, false),
        printHalfR: half(print, true),
        mono: () => {
          if (!mono) {
            const m = engraveTexture(cut, true);
            if (m !== cut) baked.push(m);
            mono = { print: m, halfL: half(m, false), halfR: half(m, true) };
          }
          return mono;
        },
        ink: () => (ink ??= bakeNow(baked, cut, inkTexture)),
        urls,
        baked,
      };
    })();
    artCache.set(key, p);
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

/** fetch (once, tolerantly) a dual slot's scene: the set's own painting
 *  when both industries wear a set that paints this very slot, the default
 *  set's when both are on it, else assembled from the two cutouts. Null
 *  when the set does not carry it, so the half-crops take over rather than
 *  the board breaking. */
function loadPairArt(key: string, a: IndustryType, va: TileVariant | undefined, b: IndustryType, vb: TileVariant | undefined, arts: Record<IndustryType, IndustryArt>): Promise<PairArt | null> {
  let p = pairCache.get(key);
  if (!p) {
    p = (async () => {
      const url = va && vb && va.id === vb.id && va.pair ? va.dir + va.pair(a, b) : !va?.dir && !vb?.dir ? `/tile-${pairFile(a, b)}-cut.png` : null;
      const loaded = url ? ((await Assets.load<Texture>(url).catch(() => null)) as Texture | null) : null;
      const scene = url ? loaded : composePair(a, arts[a].cut, va, b, arts[b].cut, vb);
      if (!scene) return null;
      const baked: Texture[] = loaded ? [] : [scene];
      const print = await bake(baked, scene, (t) => engraveTexture(t));
      let mono: Texture | null = null;
      return {
        scene,
        print,
        mono: () => (mono ??= bakeNow(baked, scene, (t) => engraveTexture(t, true))),
        urls: loaded && url ? [url] : [],
        baked,
      };
    })();
    pairCache.set(key, p);
  }
  return p;
}
/** the same bake, at once: a reader asked for it and is waiting */
function bakeNow(into: Texture[], from: Texture, make: (t: Texture) => Texture): Texture {
  const t = make(from);
  if (t !== from) into.push(t);
  return t;
}

/** Assemble the painting set for a per-industry variant choice. A dual-slot
 *  painting is the default file when both industries are on their default,
 *  and is composed from the two chosen cutouts otherwise — so the crate on
 *  a coal-and-goods slot is always the crate of the goods slots. */
async function buildTileSet(art: TileArt): Promise<TileSet> {
  const industries = Object.keys(ICON_FOR) as IndustryType[];
  const keys = new Set(industries.map((i) => artKey(variantOf(i, art), i)));
  const arts = Object.fromEntries(await Promise.all(industries.map(async (i) => [i, await loadIndustryArt(variantOf(i, art), i)]))) as Record<IndustryType, IndustryArt>;
  const pairKeys = new Set<string>();
  const pairs: [string, PairArt][] = [];
  await Promise.all(
    dualPairs().map(async ([a, b]) => {
      const va = variantOf(a, art);
      const vb = variantOf(b, art);
      const key = `${va?.id ?? ''}|${a}|${vb?.id ?? ''}|${b}`;
      pairKeys.add(key);
      const pa = await loadPairArt(key, a, va, b, vb, arts);
      if (pa) pairs.push([pairKey(a, b), pa]);
    }),
  );
  const by = <K extends keyof IndustryArt>(k: K) => Object.fromEntries(industries.map((i) => [i, arts[i][k]])) as Record<IndustryType, IndustryArt[K]>;
  const each = (f: (i: IndustryType) => Texture) => Object.fromEntries(industries.map((i) => [i, f(i)])) as Record<IndustryType, Texture>;
  let mono: Prints | null = null;
  return {
    cut: by('cut'),
    built: by('built'),
    builtGrain: by('builtGrain'),
    halfL: by('halfL'),
    halfR: by('halfR'),
    pair: Object.fromEntries(pairs.map(([k, pa]) => [k, pa.scene])),
    sepia: { print: by('print'), halfL: by('printHalfL'), halfR: by('printHalfR'), pair: Object.fromEntries(pairs.map(([k, pa]) => [k, pa.print])) },
    mono: () =>
      (mono ??= {
        print: each((i) => arts[i].mono().print),
        halfL: each((i) => arts[i].mono().halfL),
        halfR: each((i) => arts[i].mono().halfR),
        pair: Object.fromEntries(pairs.map(([k, pa]) => [k, pa.mono()])),
      }),
    ink: (i) => arts[i].ink(),
    arts: keys,
    pairs: pairKeys,
  };
}

/** hand a piece of art back: its bakes destroyed, its files returned */
const letGo = (h: Holdings | null): void => {
  if (!h) return;
  for (const t of h.baked) t.destroy(true);
  if (h.urls.length) void Assets.unload(h.urls);
};
/** let go of every art and dual-slot scene the kept set does not wear */
function releaseArts(keep: { arts: Set<string>; pairs: Set<string> }): void {
  for (const [k, p] of artCache) {
    if (keep.arts.has(k)) continue;
    artCache.delete(k);
    void p.then(letGo, () => undefined);
  }
  for (const [k, p] of pairCache) {
    if (keep.pairs.has(k)) continue;
    pairCache.delete(k);
    void p.then(letGo, () => undefined);
  }
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
  const kept = [...urls];
  /* a works is a nicety, not a need: one not painted yet must not take the
     whole board down with it, so each is asked for on its own and a miss
     leaves the town its painted place */
  const tolerant = async (url: string): Promise<Texture | null> => {
    const t = (await Assets.load<Texture>(url).catch(() => null)) as Texture | null;
    if (t) kept.push(url);
    return t;
  };
  const works = await Promise.all(WORKS.map(async (i) => [i, await tolerant(`/town-works-${i}.webp`)] as const));
  const wharves = await Promise.all(WHARVES.map((n) => tolerant(`/merchant-wharf-${n}.webp`)));
  tileSet = await buildTileSet({});
  tileArt = {};
  barrelTex = loaded['/beer-barrel.png'];
  villageTex = loaded['/town-village.webp'];
  hamletTex = [loaded['/town-hamlet-0.webp'], loaded['/town-hamlet-1.webp'], loaded['/town-hamlet-2.webp']];
  placeTex = [loaded['/town-place-0.webp'], loaded['/town-place-1.webp'], loaded['/town-place-2.webp'], loaded['/town-place-3.webp']];
  worksTex = Object.fromEntries(works.filter(([, t]) => !!t)) as Partial<Record<IndustryType, Texture>>;
  wharfTex = wharves;
  const drawn = [0, 1, 2, 3].map((i) => `town-place-${i}`).concat(WORKS.map((i) => `town-works-${i}`), WHARVES.map((n) => `merchant-wharf-${n}`));
  shadowTex = Object.fromEntries(await Promise.all(drawn.map(async (n) => [n, await tolerant(`/${n}-shadow.webp`)] as const)));
  tableUrls = kept;
}

/** the ground sheets now laid on the table: the ones they replace go back
 *  to the loader (38 MiB apiece on the GPU, and nothing else reads them) */
export function wearSheets(urls: string[]): void {
  const gone = sheetUrls.filter((u) => !urls.includes(u));
  sheetUrls = [...urls];
  if (gone.length) void Assets.unload(gone);
}

/* The table's textures are held while a board is up. The last board to go
   lets them go on the next turn of the page — not at once, so a board that
   is taken down and put straight back up (React's development double mount,
   a replay opened from the table) finds its press still inked. */
let holders = 0;
export function holdBoardAssets(): () => void {
  holders++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders--;
    if (holders > 0) return;
    setTimeout(() => {
      if (holders > 0) return;
      releaseArts({ arts: new Set(), pairs: new Set() });
      const files = [...tableUrls, ...sheetUrls];
      tableUrls = [];
      sheetUrls = [];
      if (files.length) void Assets.unload(files);
    }, 0);
  };
}

/** what the press holds right now, for the measures of a table being set:
 *  textures, and bytes at four to a texel */
export async function boardAssetTally(): Promise<{ textures: number; bytes: number }> {
  const seen = new Set<Texture>();
  const add = (t: Texture | null | undefined) => {
    if (t && !t.destroyed) seen.add(t);
  };
  for (const p of artCache.values()) {
    const a = await p;
    [a.cut, ...Object.values(a.built), ...a.baked].forEach(add);
  }
  for (const p of pairCache.values()) {
    const a = await p;
    if (a) [a.scene, ...a.baked].forEach(add);
  }
  for (const u of [...tableUrls, ...sheetUrls]) add(Assets.get<Texture>(u));
  let bytes = 0;
  for (const t of seen) bytes += t.source.pixelWidth * t.source.pixelHeight * 4;
  return { textures: seen.size, bytes };
}

/* The true winding route (same as the SVG board): a dense sampling of the
   bulged quad from routeFor — the same sampling the board's pointer reads
   (PixiBoard, linkAt), so the hover zone sits exactly on the visible track. */
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
export function drawCube(g: Graphics, x: number, y: number, s: number, kind: keyof typeof CUBE_PAINT): void {
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
  g.circle(x, y, 7).fill(0x100d0b).stroke({ width: 1, color: CASING, alpha: 0.85 });
  g.circle(x, y, 5.6).fill(col);
  drawShapeGlyph(g, shape, x, y);
}

/* the brass of a score coin: its face, its deep engraving and its shine */
const BRASS_FACE = 0xd6b36a;
const BRASS_DEEP = 0x7d5f2c;
const BRASS_LIGHT = 0xf4e0a8;
/** the ink the figures are struck in */
const COIN_INK = 0x241a10;

/** The reverse of a flipped card, under its engraving: the owner's colour,
 *  clean, a touch deeper towards the edges like a printed sheet, and a
 *  ruled border inside the rim — the frame of a certificate. */
function drawReverse(g: Graphics, x: number, y: number, col: number): void {
  const x0 = x - TILE_HALF;
  const y0 = y - TILE_HALF;
  g.roundRect(x0, y0, TILE, TILE, 6).fill(col);
  for (let i = 0; i < 4; i++) g.roundRect(x0 + 1 + i * 1.6, y0 + 1 + i * 1.6, TILE - 2 - i * 3.2, TILE - 2 - i * 3.2, 5.5).stroke({ width: 1.6, color: 0x000000, alpha: 0.1 - i * 0.022 });
  g.roundRect(x0 + 5, y0 + 5, TILE - 10, TILE - 10, 3).stroke({ width: 0.7, color: tint(col, 0.5), alpha: 0.55 });
  g.roundRect(x0 + 6.6, y0 + 6.6, TILE - 13.2, TILE - 13.2, 2.4).stroke({ width: 0.4, color: tint(col, 0.5), alpha: 0.4 });
}

/** A score struck on a brass coin centred on (x, y): an ink ring to part
 *  it from any card, a milled edge, an engraved inner ring, a glint, and
 *  the figure in ink — the figure alone: on a card turned over, a number
 *  can only be points. */
function drawScoreCoin(into: Container, x: number, y: number, vp: number, R = 12): void {
  const g = new Graphics();
  g.eventMode = 'none';
  g.circle(x + 0.8, y + 1.8, R + 1.2).fill({ color: 0x000000, alpha: 0.38 });
  g.circle(x, y, R + 1.3).fill(COIN_INK);
  g.circle(x, y, R).fill(BRASS_FACE);
  /* the milled edge: short strokes all round the rim */
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    g.moveTo(x + c * (R - 1.9), y + s * (R - 1.9)).lineTo(x + c * (R - 0.3), y + s * (R - 0.3));
  }
  g.stroke({ width: 0.55, color: BRASS_DEEP, alpha: 0.75 });
  g.circle(x, y, R - 2.6).stroke({ width: 0.7, color: BRASS_DEEP, alpha: 0.85 });
  const a0 = Math.PI * 1.08;
  g.moveTo(x + Math.cos(a0) * (R - 3.6), y + Math.sin(a0) * (R - 3.6)).arc(x, y, R - 3.6, a0, Math.PI * 1.62).stroke({ width: 1.1, color: BRASS_LIGHT, alpha: 0.75, cap: 'round' });
  const vpText = new Text({ text: String(vp), style: { fontFamily: "'Playfair Display', serif", fontSize: R + 1.5, fontWeight: '900', fill: COIN_INK } });
  vpText.anchor.set(0.5);
  vpText.position.set(x, y + 0.4);
  vpText.eventMode = 'none';
  into.addChild(g, vpText);
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

export function buildBoardScene(bgCanal: Container, bgRail: Container, etchCanal: Sprite, etchRail: Sprite): BoardScene {
  /* the sheets, bottom to top, each named: nothing on the table is found by
     its rank among its siblings */
  const world = new Container();
  const land = new Container();
  const ground = new Container();
  const linksLayer = new Container();
  const merchantsLayer = new Container();
  const townsLayer = new Container();
  const ribbonsLayer = new Container();
  const overlay = new Container();
  const hoverLayer = new Container();
  for (const c of [land, ground, linksLayer, merchantsLayer, townsLayer, ribbonsLayer, hoverLayer]) c.eventMode = 'none';
  ground.addChild(bgCanal, bgRail, etchCanal, etchRail);
  land.addChild(ground, linksLayer, merchantsLayer, townsLayer, ribbonsLayer);
  world.addChild(land, overlay, hoverLayer);
  bgRail.alpha = 0;
  etchRail.alpha = 0;

  /* ------------------------------ links ------------------------------ */
  const linkGfx = new Map<string, Graphics>();
  for (const def of LINKS) {
    const g = new Graphics();
    g.eventMode = 'none';
    linksLayer.addChild(g);
    linkGfx.set(def.id, g);
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
  /* the wharves' shadows, recast when the ground changes */
  const wharves: { g: Sprite; q: Sprite; name: string; ox: number; oy: number; size: number; id: string }[] = [];
  /* how the land lies under each place on the ground in play; empty on a level one */
  let groundShade: Record<string, number> = {};

  /* ---------------------------- merchants ---------------------------- */
  /* A merchant is laid out like a town: its tiles in a row with the bonus
     on a brass medallion beside them, the name on the towns' own ribbon
     below — counter-scaled like theirs — and its wharf standing behind, in
     the hand of the places. Nothing framed, nothing pictured. Everything
     that changes (tiles, barrels, claimed, closed) is redrawn in
     drawMerchants.                                                        */
  const merchantBeer = new Map<string, Container>();
  const merchantDyn = new Map<string, { plate: Container; slots: Container; medal: Container; claimed: Container; closed: Container; slotX: number[]; tileTop: number }>();
  const ribbons: Container[] = [];
  for (const m of MERCHANTS) {
    const plate = new Container();
    /* southern merchants (Oxford, Gloucester) sit on the map's bottom edge:
       their row rides 34 units above the node so the hand dock never hides it */
    plate.position.set(m.x, m.y - rowLift(m));
    plate.scale.set(ROW_SCALE);
    plate.eventMode = 'none';

    /* the row: the tiles, a gap, the medallion; centred on the node */
    const rowW = rowWidth(m.slots);
    const tileTop = -MT / 2;
    const slotX: number[] = [];
    for (let i = 0; i < m.slots; i++) slotX.push(rowSlotX(m.slots, i));
    const medalX = rowW / 2 - MEDAL_R;
    const medalY = 0;
    const medalR = MEDAL_R;
    const ribbonCy = MT / 2 + RIBBON_GAP + RIBBON_H / 2 + 2;

    /* the wharf behind the row, its foot planted just under the ribbon —
       the same hand as the towns' places, the same light, its own cleared
       ground and its shadow cast by the land (castShadow) */
    const qi = MERCHANTS.indexOf(m) % Math.max(1, wharfTex.length);
    const quay = wharfTex[qi];
    if (quay) {
      const qw = 210;
      const foot = FEET[`merchant-wharf-${qi}`]?.[1] ?? 0.7;
      const q = new Sprite(quay);
      q.anchor.set(0.5);
      q.width = qw;
      q.height = qw;
      q.position.set(0, ribbonCy + 16 - (foot - 0.5) * qw);
      q.alpha = 0.94;
      q.eventMode = 'none';
      const qShadow = new Sprite();
      qShadow.eventMode = 'none';
      plate.addChild(qShadow, q);
      wharves.push({ g: qShadow, q, name: `merchant-wharf-${qi}`, ox: -qw / 2, oy: q.y - qw / 2, size: qw, id: m.id });
    }

    /* the row's own shadow on the ground, then the shelves — a parchment
       recess for each tile, like a town's empty card — and the medallion:
       a brass disc with a beaded rim, seated on the ground */
    const under = new Graphics();
    under.eventMode = 'none';
    under.roundRect(-rowW / 2 - 1, -MT / 2 + 1, rowW + 8, MT + 8, 8).fill({ color: 0x1e160e, alpha: 0.26 });
    const shelf = new Graphics();
    shelf.eventMode = 'none';
    for (const x of slotX) {
      shelf.roundRect(x - MT / 2 - 2, tileTop - 2, MT + 4, MT + 4, 6).fill({ color: 0xe9dfc6, alpha: 0.5 }).stroke({ width: 0.9, color: 0x6b5232, alpha: 0.45 });
    }
    const brass = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, textureSpace: 'local' });
    brass.addColorStop(0, '#F0D48E').addColorStop(0.45, '#C9A45C').addColorStop(1, '#7E5F28');
    shelf.circle(medalX + 2, medalY + 3, medalR + 2).fill({ color: 0x1e160e, alpha: 0.4 });
    shelf.circle(medalX, medalY, medalR + 2).fill(0x5a4520);
    shelf.circle(medalX, medalY, medalR).fill(brass);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      shelf.circle(medalX + Math.cos(a) * (medalR - 2.2), medalY + Math.sin(a) * (medalR - 2.2), 0.9).fill({ color: 0xfff3c8, alpha: 0.8 });
    }
    shelf.circle(medalX, medalY, medalR - 4.5).stroke({ width: 0.8, color: 0x5a4520, alpha: 0.6 });
    plate.addChild(under, shelf);

    /* the word over the medallion, small caps in brass */
    const cap = new Text({
      text: tr('board.merchant.bonus').toUpperCase(),
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 6.5, fontWeight: '700', letterSpacing: 1.8, fill: 0x5a4520 },
    });
    cap.anchor.set(0.5);
    cap.position.set(medalX, medalY - medalR - 6);
    cap.eventMode = 'none';
    plate.addChild(cap);

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
    /* closed at this player count: rust stamp across the row */
    const closed = new Container();
    closed.eventMode = 'none';
    /* a stamp is struck in capitals, whatever case the sheets write it in */
    const stamp = new Text({
      text: tr('board.merchant.closedStamp').toLocaleUpperCase(),
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: '900', letterSpacing: 2.5, fill: 0xd05a48 },
    });
    stamp.anchor.set(0.5);
    stamp.rotation = -0.12;
    const stampBox = new Graphics().roundRect(-stamp.width / 2 - 7, -stamp.height / 2 - 2, stamp.width + 14, stamp.height + 4, 3).stroke({ width: 1.8, color: 0xd05a48 });
    stampBox.rotation = -0.12;
    closed.position.set(0, 0);
    closed.addChild(stampBox, stamp);
    closed.visible = false;
    plate.addChild(slots, medal, claimed, closed);

    merchantsLayer.addChild(plate);
    merchantBeer.set(m.id, slots);
    merchantDyn.set(m.id, { plate, slots, medal, claimed, closed, slotX, tileTop });

    /* the name, legible at every zoom: the towns' parchment ribbon, counter-scaled with theirs */
    const label = m.name.toUpperCase();
    const { box } = makeRibbon(label, m.x, plate.y + ribbonCy * 1.45, ribbonWidth(label), RIBBON_H);
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
      const frame = new Graphics();
      const art = new Sprite();
      const art2 = new Sprite();
      /* GPU clip that rounds the built player-colour card exactly like the
         board's roundRect slots (baked-in PNG corners looked rough) */
      const artMask = new Graphics();
      const rim = new Graphics();
      const detail = new Container();
      const badges = new Container();
      const deco = new Container();
      art.visible = false;
      art2.visible = false;
      for (const o of [frame, art, art2, artMask, rim, detail, badges, deco]) o.eventMode = 'none';

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

      /* one box per card, pinned at its centre, in the order the press lays them */
      const box = new Container();
      box.eventMode = 'none';
      box.pivot.set(pos.x, pos.y);
      box.position.set(pos.x, pos.y);
      box.addChild(frame, art, art2, artMask, deco, rim, detail, badges);
      townsLayer.addChild(box);
      slots.push({ box, frame, art, art2, artMask, rim, detail, badges, deco, glow: topGlow, floored: [], artBase: 0.95, spotAlpha: 1, hasTile: false, flipped: false });
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

  /** a group of marks pinned at (px, py) on a slot: the ticker scales it
   *  about that point so its `size` keeps `floor` px on screen (FIGURE_ /
   *  SEAL_MIN_SCREEN), never under `base`, never over `max` */
  const pinned = (sv: SlotView, px: number, py: number, size: number, floor: number, base = 1, max?: number): Floored => {
    const c = new Container();
    c.eventMode = 'none';
    c.pivot.set(px, py);
    c.position.set(px, py);
    sv.badges.addChild(c);
    const f: Floored = { c, size, px: floor, base, max };
    sv.floored.push(f);
    return f;
  };
  /* level and link value, top-left of a built tile: a dark plaque with the
     level as a roman numeral, then one chain link per point the tile adds
     to each neighbouring canal or rail at era's end. Pinned at the card's
     corner, so it grows inward, and held under the stock disc's reach. */
  const drawLevelMark = (sv: SlotView, x: number, y: number, level: number, links: number, muted: boolean) => {
    const h = bigChips ? 14 : 12;
    const font = bigChips ? 10.5 : 9;
    const x0 = x - TILE_HALF + 2.75;
    const y0 = y - TILE_HALF + 2.75;
    const into = pinned(sv, x0, y0, font, FIGURE_MIN_SCREEN, 1, 1.25).c;
    const ink = muted ? 0xc9b48a : 0xf4ecd8;
    const g = new Graphics();
    g.eventMode = 'none';
    const numeral = new Text({
      text: roman(level),
      style: { fontFamily: "'Playfair Display', serif", fontSize: font, fontWeight: '900', fill: ink },
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
  /* resource stock badge layouts on a built tile (A-B choice), each pinned
     at its own centre */
  const drawStock = (sv: SlotView, x: number, y: number, n: number, kind: 'coal' | 'iron' | 'beer') => {
    const iconAt = (into: Container, cx: number, cy: number, s: number) => {
      if (kind === 'beer') {
        const b = new Sprite(barrelTex);
        b.width = b.height = s;
        b.position.set(cx - s / 2, cy - s / 2);
        b.eventMode = 'none';
        into.addChild(b);
      } else {
        const cube = new Graphics();
        drawCube(cube, cx, cy, s, kind);
        cube.eventMode = 'none';
        into.addChild(cube);
      }
    };
    /* dark tag with icon left + ×n right, centred on (cx, cy) */
    const tag = (cx: number, cy: number, tw: number, th: number, iconS: number, font: number) => {
      const into = pinned(sv, cx, cy, font, FIGURE_MIN_SCREEN).c;
      const g = new Graphics().roundRect(cx - tw / 2, cy - th / 2, tw, th, 4).fill({ color: 0x17110c, alpha: 0.92 }).stroke({ width: 0.9, color: 0xf4ecd8, alpha: 0.45 });
      g.eventMode = 'none';
      into.addChild(g);
      iconAt(into, cx - tw / 2 + iconS / 2 + 3, cy, iconS);
      const t = new Text({ text: `×${n}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: font, fontWeight: '700', fill: 0xf4ecd8 } });
      t.anchor.set(0.5, 0.5);
      t.position.set(cx + (tw / 2 - (iconS + 6)) / 2 + 2, cy + 0.5);
      t.eventMode = 'none';
      into.addChild(t);
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
      const into = pinned(sv, cx, cy, 12.5, FIGURE_MIN_SCREEN).c;
      const g = new Graphics().circle(cx, cy, 10).fill({ color: 0x17110c, alpha: 0.95 }).stroke({ width: 1.4, color: 0xc9a45c });
      g.eventMode = 'none';
      into.addChild(g);
      const t = new Text({ text: String(n), style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: '700', fill: 0xf4ecd8 } });
      t.anchor.set(0.5);
      t.position.set(cx, cy + 0.5);
      t.eventMode = 'none';
      into.addChild(t);
    }
  };
  /* the owner's seal on a built card — the player's shape on their colour —
     is always there, pinned in a corner and floored like the figures: the
     colour of a card alone does not tell two players apart for every eye,
     nor on a card turned over. Colour-blind mode seats it larger. */
  const drawSeal = (sv: SlotView, sx: number, sy: number, col: number, shape: string) => {
    const into = pinned(sv, sx, sy, 9, SEAL_MIN_SCREEN, look.colorBlind && look.sealTiles ? 1.35 : 1).c;
    const g = new Graphics();
    g.eventMode = 'none';
    drawOwnerMedallion(g, sx, sy, col, shape);
    into.addChild(g);
  };
  /* the link value of a card turned over: what it adds to each canal or
     rail beside it when the era is scored — a dark plate at the foot of
     the card, one brass chain link per point, pinned at its left end
     (x0, cy) so it grows into the card */
  const drawLinkPlate = (sv: SlotView, x0: number, cy: number, links: number) => {
    const into = pinned(sv, x0, cy, 9, FIGURE_MIN_SCREEN, 1, 1.25).c;
    const lw = bigChips ? 9 : 8;
    const lh = bigChips ? 5.5 : 4.6;
    const step = lw - 2.2;
    const w = 8 + step * (links - 1) + lw;
    const h = bigChips ? 13 : 11;
    const g = new Graphics();
    g.eventMode = 'none';
    g.roundRect(x0, cy - h / 2, w, h, 3).fill({ color: 0x120d09, alpha: 0.8 }).stroke({ width: 0.7, color: BRASS_LIGHT, alpha: 0.5 });
    for (let i = 0; i < links; i++) g.roundRect(x0 + 4 + i * step, cy - lh / 2, lw, lh, lh / 2).stroke({ width: 1.3, color: BRASS_FACE });
    into.addChild(g);
  };
  const drawLinks = (game: GameState) => {
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
        /* board option (key C): every unbuilt trace hidden, water included —
           the relief ground serves its routes on a layer hidden with them,
           and keeps only the groove carved into the model for each */
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
          g.circle(mid[0], mid[1], 7.6).fill(col).stroke({ width: 0.8, color: CASING, alpha: 0.35 });
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
        const { frame, art, art2, artMask, rim, detail, badges, deco } = sv;
        const x = c.slots[si].x;
        const y = c.slots[si].y;
        const tile = game.tiles[tileKey(town.id, si)];
        frame.clear();
        rim.clear();
        artMask.clear();
        art.mask = null;
        for (const child of badges.removeChildren()) child.destroy({ children: true });
        for (const child of detail.removeChildren()) child.destroy({ children: true });
        sv.floored.length = 0;
        sv.hasTile = !!tile;
        sv.flipped = tile?.flipped ?? false;
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
            /* flipped = the works has paid out and now scores: the card
               shows its reverse, printed like a share certificate in the
               owner's own ink — a clean face in the owner's colour, the
               painting as a one-ink engraving on it (inkTexture), a ruled
               border — the score struck on a brass coin and the link value
               on a plate beside it: the two figures the tile still counts
               for. Nothing dimmed: a spent works is done, not disabled. */
            drawReverse(frame, x, y, col);
            art.texture = tileSet.ink(tile.industry);
            art.tint = shade(col, 0.3);
            art.position.set(x - TILE_HALF + 5, y - TILE_HALF + 4);
            artMask.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
            art.mask = artMask;
            art.width = TILE - 10;
            art.height = TILE - 10;
            sv.artBase = 0.78;
            art.alpha = sv.artBase;
            art.visible = true;
            rim.roundRect(x - TILE_HALF + 1.25, y - TILE_HALF + 1.25, TILE - 2.5, TILE - 2.5, 5.5).stroke({ width: 2.5, color: col });
            rim.roundRect(x - TILE_HALF + 2.75, y - TILE_HALF + 2.75, TILE - 5.5, TILE - 5.5, 4.5).stroke({ width: 0.8, color: 0x0c0a08, alpha: 0.7 });
            rim.roundRect(x - TILE_HALF + 0.5, y - TILE_HALF + 0.5, TILE - 1, TILE - 1, 6).stroke({ width: 0.8, color: tint(col, 0.45), alpha: 0.8 });
            /* the coin at the foot, right — where a card face shows its
               points — and the link value at the foot, left, where the
               face showed its income: the engraving stays whole above.
               Pinned so the figures keep their size far out */
            const cx = x + TILE_HALF - 15;
            const cy = y + TILE_HALF - 15;
            drawScoreCoin(pinned(sv, cx, cy, 13, FIGURE_MIN_SCREEN, 1, 1.3).c, cx, cy, lv.vp);
            if (lv.links > 0) drawLinkPlate(sv, x - TILE_HALF + 5, y + TILE_HALF - 10, lv.links);
            drawSeal(sv, x + TILE_HALF - 8, y - TILE_HALF + 8, col, shape);
            drawLevelMark(sv, x, y, tile.level, 0, true);
          } else {
            /* player-colour card painting (builtTex), full opacity, clipped
               to the slot's rounded rect by the GPU mask */
            art.texture = (look.cardGrain ? tileSet.builtGrain : tileSet.built)[tile.industry][colorName] ?? tileSet.cut[tile.industry];
            art.tint = 0xffffff;
            art.position.set(x - TILE_HALF, y - TILE_HALF);
            artMask.roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
            art.mask = artMask;
            art.width = TILE;
            art.height = TILE;
            sv.artBase = 1;
            art.alpha = sv.artBase;
            art.visible = true;
            /* owner rim: colour band + dark inner hairline + light bevel */
            rim.roundRect(x - TILE_HALF + 1.25, y - TILE_HALF + 1.25, TILE - 2.5, TILE - 2.5, 5.5).stroke({ width: 2.5, color: col });
            rim.roundRect(x - TILE_HALF + 2.75, y - TILE_HALF + 2.75, TILE - 5.5, TILE - 5.5, 4.5).stroke({ width: 0.8, color: 0x0c0a08, alpha: 0.7 });
            rim.roundRect(x - TILE_HALF + 0.5, y - TILE_HALF + 0.5, TILE - 1, TILE - 1, 6).stroke({ width: 0.8, color: tint(col, 0.45), alpha: 0.8 });
            /* the owner's seal in the top-right corner — bottom-right when
               the stock disc already sits there ('corner' layout) */
            drawSeal(sv, x + TILE_HALF - 8, stockStyle === 'corner' ? y + TILE_HALF - 8 - (bigChips ? 15 : 11) : y - TILE_HALF + 8, col, shape);
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
              detail.addChild(band, incText, vpText);
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
              detail.addChild(chipInc, incText, chipVp, vpText);
            }
            drawLevelMark(sv, x, y, tile.level, lv.links, false);
          }
          /* resource stock badge — layout is switchable (stockStyle, board
             option / A-B probe). The numeral is always exact; the industry
             implies the good, the mini icon only speeds the read. */
          if (!tile.flipped && tile.cubes > 0) {
            drawStock(sv, x, y, tile.cubes, tile.industry === 'brewery' ? 'beer' : tile.industry === 'iron' ? 'iron' : 'coal');
          }
        } else {
          const allows = town.slots[si].allows;
          deco.visible = true;
          art.tint = 0xffffff;
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
          const prints = mono ? tileSet.mono() : tileSet.sepia;
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
      /* a physical tile: dark card with a bottom-edge thickness, brass hairline,
         the painted industry face inside */
      const TILE_TOP = dyn.tileTop;
      const card = (x: number) => {
        const g = new Graphics();
        g.roundRect(x - MT / 2, TILE_TOP + 2, MT, MT, 5).fill(0x9c8a62);
        g.roundRect(x - MT / 2, TILE_TOP, MT, MT, 5).fill(0xe6d9bb).stroke({ width: 1, color: 0x6b5232, alpha: 0.75 });
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
        const [bx, by] = barrelLocal(m.slots, i);
        if ((game.merchantBeer[barrelKey(m.id, i)] ?? 0) > 0) {
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
      });
    }
  };

  let spotlight: number | null = null;
  /* a transient highlight (merchant hover, a lesson): only these slot
     keys stay lit — and when some come first, the others a step back */
  let highlight: Set<string> | null = null;
  let first: Set<string> | null = null;
  /** a slot lit after the ones that come first: still clear of the dimmed */
  const LIT_SECOND = 0.5;
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
        view.slots[si].spotAlpha = highlight ? (highlight.has(key) ? (!first || first.has(key) ? 1 : LIT_SECOND) : 0.28) : spotlight === null ? 1 : tile && tile.owner === spotlight ? 1 : 0.3;
      }
    }
  };

  let lastGame: GameState | null = null;
  return {
    world,
    land,
    ground,
    linksLayer,
    bgCanal,
    bgRail,
    etchCanal,
    etchRail,
    overlay,
    hoverLayer,
    linkGfx,
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
    setHighlight(keys: string[] | null, firstKeys?: string[] | null) {
      highlight = keys ? new Set(keys) : null;
      first = keys && firstKeys?.length ? new Set(firstKeys) : null;
      applySpotlight(lastGame);
    },
    setHideUnbuilt(hide: boolean) {
      hideUnbuilt = hide;
      etchCanal.visible = !hide;
      etchRail.visible = !hide;
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
      /* nothing on the table wears the set it replaced any more */
      releaseArts(set);
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
      /* an ink map keeps its own hand: no painted wharf on it */
      for (const w of wharves) {
        castShadow(w.g, w.name, w.ox, w.oy, w.size, groundShade[w.id] ?? 0);
        w.q.visible = style !== 'engraved';
        if (style === 'engraved') w.g.visible = false;
      }
    },
  };
}

