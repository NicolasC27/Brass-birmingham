import type { IndustryType } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The faces of the tiles: which painting set each industry wears and  */
/* where its files live. No PixiJS here — the HUD, the hand and the    */
/* settings read these too, and must not pull the renderer in with     */
/* them; the board imports them from here.                             */
/* ------------------------------------------------------------------ */

/** stock-badge layouts on built tiles (A-B probe) */
export type StockStyle = 'counter' | 'big' | 'tag' | 'top' | 'corner';
/** empty-slot face: sepia engraving printed on the board, the colour painting, or ink on the engraved sheet */
export type SlotArt = 'engraved' | 'mono' | 'painted' | 'ink';
/** income / VP on built cards: one quiet bottom band, or two boxed chips */
export type ChipStyle = 'band' | 'chips';
/** Painting variants per industry. Each variant is a directory holding the
 *  industry's file set (cutout and colour cards): '' = app/public, the drawn
 *  sets live in /tiles-<name>. `front` says how the painting sits in a
 *  dual-slot composition (see composePair). */
export interface TileVariant {
  id: string;
  dir: string;
  front: FrontRecipe;
  /** the format this set's files are written in. The flat drawings are PNG;
   *  a painted set does not compress as PNG and is written as WebP. */
  ext?: 'png' | 'webp';
  /** a set that paints the dual slots itself, as one scene: where its file
   *  for the slot taking either of two industries lives. Without it the
   *  board assembles the two cutouts (composePair). */
  pair?: (a: IndustryType, b: IndustryType) => string;
}
/** the front industry of a dual-slot painting: whole, or cropped to its
 *  tallest part (x, width in the 512 square), scaled; partners may be
 *  pushed right of their usual place */
export interface FrontRecipe {
  crop?: [x: number, w: number];
  scale: number;
  partnerX?: Partial<Record<IndustryType, number>>;
}
/** The painted subjects, cut out on transparency: the same hand as the
 *  painted set, but with no backdrop of their own, so an owner's colour
 *  shows through the card and the slot grid keeps its printed look.
 *  (The finished paintings live in /v3, these in /tiles-v3.) */
const subject = (front: FrontRecipe): TileVariant => ({ id: 'v3', dir: '/tiles-v3', front, ext: 'webp', pair: (a, b) => `/tile-combo-${pairKey(a, b)}.webp` });

export const TILE_VARIANTS: Partial<Record<IndustryType, TileVariant[]>> = {
  coal: [
    subject({ scale: 64 }),
    { id: 'wagon', dir: '', front: { scale: 64 } },
    { id: 'cart', dir: '/tiles-classic', front: { scale: 64 } },
    { id: 'colliery', dir: '/tiles-works', front: { crop: [22, 280], scale: 88, partnerX: { cotton: 154 } } },
  ],
  iron: [subject({ scale: 70 }), { id: 'foundry', dir: '', front: { scale: 70 } }],
  cotton: [subject({ scale: 70 }), { id: 'mill', dir: '', front: { scale: 70 } }],
  manufacturer: [
    subject({ scale: 62 }),
    { id: 'crate', dir: '', front: { scale: 62 } },
    { id: 'parcels', dir: '/tiles-classic', front: { scale: 62 } },
    { id: 'manufactory', dir: '/tiles-works', front: { crop: [10, 300], scale: 84, partnerX: { cotton: 160, iron: 160, pottery: 160 } } },
  ],
  pottery: [subject({ scale: 70 }), { id: 'kiln', dir: '', front: { scale: 70 } }],
  brewery: [
    subject({ scale: 60 }),
    { id: 'barrel', dir: '', front: { scale: 60 } },
    { id: 'mug', dir: '/tiles-classic', front: { scale: 60 } },
    { id: 'brewhouse', dir: '/tiles-works', front: { crop: [40, 305], scale: 80, partnerX: { cotton: 160, iron: 160 } } },
  ],
};
/** chosen variant id per industry (missing = the first, default one) */
export type TileArt = Partial<Record<IndustryType, string>>;
export const variantOf = (i: IndustryType, art: TileArt): TileVariant | undefined => TILE_VARIANTS[i]?.find((v) => v.id === art[i]) ?? TILE_VARIANTS[i]?.[0];
/** the face an industry wears under the current art choice: the finished
 *  painting, or the owner's colour card of a drawn set (the HUD paints the
 *  very same image the board does) */
export const tileFaceUrl = (i: IndustryType, art: TileArt, color: string): string => {
  const v = variantOf(i, art);
  return (v?.dir ?? '') + BUILT_FOR(i, color, v?.ext);
};
/** the face one variant shows for an industry — its cutout, or its painting */
export const variantFaceUrl = (v: TileVariant, i: IndustryType): string => v.dir + CUT_FOR(i, v.ext);
/** the face of an industry under the reader's chosen variant */
export const industryFaceUrl = (i: IndustryType, art: TileArt): string => variantFaceUrl(variantOf(i, art) ?? { id: '', dir: '', front: { scale: 64 } }, i);
/** which of two industries stands in front of a dual-slot painting, and
 *  how the one behind is placed (tools/tiles/build-tile.sh says the same) */
export const FRONT_RANK: Record<IndustryType, number> = { brewery: 0, coal: 1, manufacturer: 2, cotton: 3, iron: 3, pottery: 3 };
export const PARTNER: Partial<Record<IndustryType, { scale: number; x: number }>> = {
  cotton: { scale: 70, x: 150 },
  iron: { scale: 70, x: 150 },
  pottery: { scale: 70, x: 150 },
  manufacturer: { scale: 62, x: 195 },
};

/** industry key → icon asset (key 'manufacturer' vs file 'manufacture') */
export const ICON_FOR: Record<IndustryType, string> = {
  coal: '/icon-coal.svg',
  iron: '/icon-iron.svg',
  cotton: '/icon-cotton.svg',
  manufacturer: '/icon-manufacture.svg',
  pottery: '/icon-pottery.svg',
  brewery: '/icon-brewery.svg',
};
/** industry key → asset file stem ('manufacturer' vs file 'manufacture') */
export const FILE_FOR: Record<IndustryType, string> = {
  coal: 'coal',
  iron: 'iron',
  cotton: 'cotton',
  manufacturer: 'manufacture',
  pottery: 'pottery',
  brewery: 'brewery',
};
/** empty-slot art: the painting cut out on transparency (no baked backdrop) */
export const CUT_FOR = (i: IndustryType, ext = 'png'): string => `/tile-${FILE_FOR[i]}-cut.${ext}`;
/** built works: painting precomposed on the OWNER's colour, like the
 *  physical game — the whole tile card is the ownership marker */
export const BUILT_FOR = (i: IndustryType, color: string, ext = 'png'): string => `/tile-${FILE_FOR[i]}-${color}.${ext}`;

export const pairKey = (a: IndustryType, b: IndustryType): string => [a, b].sort().join('-');
/** pair painting file stem (sorted FILE stems — 'manufacture', not the key) */
export const pairFile = (a: IndustryType, b: IndustryType): string => [FILE_FOR[a], FILE_FOR[b]].sort().join('-');
