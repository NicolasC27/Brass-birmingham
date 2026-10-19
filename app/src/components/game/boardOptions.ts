import { useSyncExternalStore } from 'react';
import type { ChipStyle, SlotArt, StockStyle, TileArt } from '@/gl/faces';
import type { TrafficLevel } from '@/gl/ambiance';
import type { IndustryType } from '@/game/types';
import { sanitizeRailMode } from './railLogic';

/* ------------------------------------------------------------------ */
/* Board display options — one tiny shared store (localStorage-backed) */
/* so the on-board quick toggles (PixiBoard) AND the settings panel    */
/* (Game.tsx) drive the same values.                                   */
/* ------------------------------------------------------------------ */

export type MinimapSize = 's' | 'm' | 'l';
/** the mat's levels: the player's cards with a pile, flat compact boxes, or bare pills */
export type MatStyle = 'cards' | 'compact' | 'chips';
/** the printed mat's order, left to right */
export const MAT_ORDER_DEFAULT: IndustryType[] = ['cotton', 'manufacturer', 'pottery', 'brewery', 'coal', 'iron'];
/** a stored order, made whole again (every industry once, unknown ones dropped) */
export const sanitizeMatOrder = (o: unknown): IndustryType[] => {
  const seen = Array.isArray(o) ? (o as IndustryType[]).filter((i, k, a) => MAT_ORDER_DEFAULT.includes(i) && a.indexOf(i) === k) : [];
  return [...seen, ...MAT_ORDER_DEFAULT.filter((i) => !seen.includes(i))];
};
export const MAT_STYLES: MatStyle[] = ['cards', 'compact', 'chips'];
/** the players' column: narrow medallions, the full cards, or folded
 *  away into a slip on the left edge */
export type RailMode = 'medals' | 'cards' | 'slip';
/** where the income track runs: along the bottom edge or down the left edge */
export type IncomeSide = 'bottom' | 'left';
/** the ground under the board: a ground's paintings per era, and for the
 *  relief model the survey — cart roads, towpaths, the rail era's railways —
 *  served as a layer of its own so hiding the traces (key C) hides it too;
 *  the water stays in the land */
export type MapSet = { canal: string; rail: string; etch?: { canal: string; rail: string } };
/* the country as a made thing: a painted plaster model of low English
   swells under a raking light, a shelf cut in it for every town, the rail
   era the same model gone grey with a century of smoke settled on it. The
   board is always this English model: no other ground is offered. */
export const MAP_URL: MapSet = { canal: '/map-relief-canal.webp', rail: '/map-relief-rail.webp', etch: { canal: '/map-relief-canal-etch.webp', rail: '/map-relief-rail-etch.webp' } };
/* the model above is a painting of the Midlands. A second board is a
   second country, so its grounds are its own: it is served the one
   painted for it. */
const OTHER_BOARDS: Record<string, { canal: string; rail: string }> = {
  veneto: { canal: '/map-veneto-canal.webp', rail: '/map-veneto-rail.webp' },
};

export const mapUrls = (board?: string): MapSet => (board && OTHER_BOARDS[board]) || MAP_URL;

/* the minimap's plate: the small preset stands level with the open hand
   dock (180px tall); a width dragged by hand overrides the preset */
export const MM_W_FOR = { s: 320, m: 400, l: 480 } as const;
export const MM_MIN_W = 160;
export const MM_MAX_W = 640;
/** the room the table has: the window, less whatever lane sits beside it */
export const tableWidth = (): number => {
  if (typeof window === 'undefined') return 1280;
  return Math.round(document.querySelector('[data-table]')?.getBoundingClientRect().width || window.innerWidth);
};

/** what the plate leaves the hand beside it once the table is wide */
const MM_HAND_ROOM = 880;

export const minimapWidth = (o: { minimapSize: MinimapSize; minimapWidth: number; focus?: boolean }): number => {
  if (o.focus) return MM_MIN_W;
  const wanted = o.minimapWidth ? Math.min(MM_MAX_W, Math.max(MM_MIN_W, o.minimapWidth)) : MM_W_FOR[o.minimapSize];
  /* on a tablet the plate yields to the hand: a fifth of the table at most.
     On a desktop the cap is the room the hand leaves instead, for a fifth
     of 1440 px was already under the small preset and the corner could no
     longer widen the plate */
  const table = tableWidth();
  const cap = Math.max(MM_MIN_W, Math.floor(table * 0.22), table - MM_HAND_ROOM);
  return Math.min(wanted, cap);
};

/** beginner assistance: the table's house rule, or at home the board setting */
export function aidOn(assist: boolean | undefined, online: boolean): boolean {
  return !!assist || (!online && getBoardOptions().beginnerAid);
}

export interface BoardOptions {
  hideUnbuilt: boolean;
  bigChips: boolean;
  greyFreeMerchants: boolean;
  stockStyle: StockStyle;
  /** painting variant per industry (see TILE_VARIANTS) */
  tileArt: TileArt;
  /** the mat's industry blocks, in the order the player dragged them into */
  matOrder: IndustryType[];
  /** empty-slot face: engraved print or colour painting */
  slotArt: SlotArt;
  /** colour-blind mode: owner shape medallions on built cards and/or links */
  colorBlind: boolean;
  sealTiles: boolean;
  sealLinks: boolean;
  /** paper grain baked on built cards */
  cardGrain: boolean;
  /** income / VP layout on built cards */
  chipStyle: ChipStyle;
  minimapSize: MinimapSize;
  /** a width set by dragging the minimap's corner (0: the preset size) */
  minimapWidth: number;
  incomeSide: IncomeSide;
  /** the income track kept open as the full ruler, the HUD standing clear of it */
  incomePinned: boolean;
  /** boats and trains on built links */
  traffic: TrafficLevel;
  /** beginner aid: dim unplayable slots while planning, itemised price tags */
  beginnerAid: boolean;
  /** the players' column: medallions (the default), cards, or the slip */
  railMode: RailMode;
  /** the guide's column folded to a rail down the right edge (key G) */
  guideFolded: boolean;
  /** player mat spread wide (six columns) instead of the slim docked panel */
  matWide: boolean;
  /** the table's sounds, all of them: the master switch of the mixing desk */
  sound: boolean;
  /** the ambience of the era under the table (off by default for a reader
   *  who asked the system for less motion) */
  ambience: boolean;
  /** the canal's tune, heard through the canal era only */
  music: boolean;
  /** the townsfolk heard now and then in a town, a bubble saying what they said */
  voices: boolean;
  /** the buses' levels, 0 to 1: ambience, gestures of play, moments, the tune */
  volAmbience: number;
  volGestures: number;
  volMoments: number;
  volMusic: number;
  /** the telegrams wired across the table, and the machines' banter */
  telegrams: boolean;
  /** the focus view: rail folded, tools away, minimap small, hand tucked, no Gazette */
  focus: boolean;
  /** a game read again keeps its land lit rather than dimmed to night */
  reviewLit: boolean;
  /** the victory-point track along the top edge (the rail tells the points anyway) */
  vpTrack: boolean;
  /** mat levels as the player's real cards with a pile, or compact boxes */
  matStyle: MatStyle;
  /** ×n count badge on the cards (the pile already shows it) */
  matCount: boolean;
  settingsOpen: boolean;
}

const KEYS: Record<Exclude<keyof BoardOptions, 'settingsOpen'>, string> = {
  hideUnbuilt: 'brassworks.hideUnbuiltLinks',
  bigChips: 'brassworks.bigChips',
  greyFreeMerchants: 'brassworks.greyFreeMerchants',
  stockStyle: 'brassworks.stockStyle',
  tileArt: 'brassworks.tileArt',
  matOrder: 'brassworks.matOrder',
  slotArt: 'brassworks.slotArt',
  colorBlind: 'brassworks.colorBlind',
  sealTiles: 'brassworks.colorBlind.tiles',
  sealLinks: 'brassworks.colorBlind.links',
  cardGrain: 'brassworks.cardGrain',
  chipStyle: 'brassworks.chipStyle',
  minimapSize: 'brassworks.minimapSize',
  minimapWidth: 'brassworks.minimapWidth',
  incomeSide: 'brassworks.incomeSide',
  incomePinned: 'brassworks.incomePinned',
  traffic: 'brassworks.traffic',
  beginnerAid: 'brassworks.beginnerAid',
  railMode: 'brassworks.railMode',
  guideFolded: 'brassworks.guideFolded',
  matWide: 'brassworks.matWide',
  sound: 'brassworks.sound',
  ambience: 'brassworks.sound.ambience',
  volAmbience: 'brassworks.sound.volAmbience',
  volGestures: 'brassworks.sound.volGestures',
  volMoments: 'brassworks.sound.volMoments',
  music: 'brassworks.sound.music',
  volMusic: 'brassworks.sound.volMusic',
  voices: 'brassworks.sound.voices',
  telegrams: 'brassworks.telegrams',
  focus: 'brassworks.focus',
  reviewLit: 'brassworks.reviewLit',
  vpTrack: 'brassworks.vpTrack',
  matStyle: 'brassworks.matStyle',
  matCount: 'brassworks.matCount',
};

const read = <K extends keyof typeof KEYS>(k: K, fallback: BoardOptions[K]): BoardOptions[K] => {
  try {
    const v = localStorage.getItem(KEYS[k]);
    if (v === null) return fallback;
    if (typeof fallback === 'boolean') return (v === '1') as BoardOptions[K];
    if (typeof fallback === 'object') return JSON.parse(v) as BoardOptions[K];
    return v as BoardOptions[K];
  } catch {
    return fallback;
  }
};

/** the reader asked the system for less motion: the ambience starts shut */
function reducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
/** a stored level, between 0 and 1 */
function level(k: 'volAmbience' | 'volGestures' | 'volMoments' | 'volMusic', fallback: number): number {
  const v = Number(read(k, fallback));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

let state: BoardOptions = {
  hideUnbuilt: read('hideUnbuilt', false),
  bigChips: read('bigChips', true),
  greyFreeMerchants: read('greyFreeMerchants', false),
  /* the corner disc, the v3 tiles and the single band are the table's own
     and no longer offered: a choice stored when they were is not read */
  stockStyle: 'corner',
  tileArt: {},
  matOrder: read('matOrder', [...MAT_ORDER_DEFAULT]),
  /* the empty slots print in black ink by default: the sepia plate stays a choice */
  slotArt: read('slotArt', 'mono'),
  /* on by default: oxblood and verdigris sit too close under deuteranopia
     and protanopia for colour alone to tell the owners apart */
  /* colour-blind seals are asked for, not imposed */
  colorBlind: read('colorBlind', false),
  sealTiles: read('sealTiles', true),
  sealLinks: read('sealLinks', true),
  cardGrain: read('cardGrain', true),
  chipStyle: 'band',
  minimapSize: read('minimapSize', 's'),
  minimapWidth: Number(read('minimapWidth', 0 as never)) || 0,
  incomeSide: read('incomeSide', 'bottom'),
  incomePinned: read('incomePinned', false),
  /* the ground is no longer a choice (the English model for everyone): a
     `mapStyle` or `railPainting` stored when it was is not read */
  traffic: read('traffic', 'light'),
  beginnerAid: read('beginnerAid', false),
  railMode: sanitizeRailMode(read('railMode', 'medals')),
  guideFolded: read('guideFolded', false),
  matWide: read('matWide', false),
  sound: read('sound', true),
  ambience: read('ambience', !reducedMotion()),
  volAmbience: level('volAmbience', 0.5),
  volGestures: level('volGestures', 0.8),
  volMoments: level('volMoments', 0.8),
  music: read('music', true),
  /* low: the tune is heard under the ambience, not over the table */
  volMusic: level('volMusic', 0.5),
  voices: read('voices', true),
  telegrams: read('telegrams', true),
  focus: read('focus', false),
  reviewLit: read('reviewLit', false),
  vpTrack: read('vpTrack', false),
  matStyle: read('matStyle', 'cards'),
  matCount: read('matCount', false),
  settingsOpen: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function setBoardOption<K extends keyof BoardOptions>(key: K, value: BoardOptions[K]): void {
  state = { ...state, [key]: value };
  if (key !== 'settingsOpen') {
    try {
      localStorage.setItem(KEYS[key as keyof typeof KEYS], typeof value === 'boolean' ? (value ? '1' : '0') : typeof value === 'object' ? JSON.stringify(value) : String(value));
    } catch {
      /* non-fatal */
    }
  }
  emit();
}

export function useBoardOptions(): BoardOptions {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const getBoardOptions = (): BoardOptions => state;

/** track thickness (px): the VP track always runs along the top; the income
 *  track takes the bottom edge or the left edge depending on `incomeSide` */
export const TRACK_H = 36;
export const TRACK_W = 52;
/** the income track at rest: a thin brass filet that opens into the full
 *  ruler (TRACK_H / TRACK_W) under the pointer or the keyboard; down the
 *  left edge its lane holds each rung's pay on a plate under the tokens,
 *  the widest (−10 £) with room either side */
export const FILET_H = 20;
export const FILET_W = 42;
/** the room the HUD keeps from an edge nothing holds, and between a track
 *  and what floats beside it */
const HUD_GAP = 8;
/** down the left edge the HUD stands clear of the filet's lane, its pays
 *  included; the open ruler reaches a little over the edge of the
 *  lantern's lane of the players' column but stops short of the purses
 *  under the medallions (centred on the rings, they widen with the
 *  figures: 139 £ | 126 still clears it), which it hid */
const LEFT_TRACK_INSET = FILET_W + HUD_GAP;
/** pixel insets every floating HUD element keeps from the screen edges: the
 *  income track is counted at rest, the ruler opens over the margin; a
 *  pinned track is the ruler for good, and the HUD stands clear of all of it */
export function hudInsets(o: BoardOptions, vpTrack = true, lane = 0): { left: number; bottom: number; top: number; right: number } {
  return {
    top: vpTrack ? TRACK_H + HUD_GAP : HUD_GAP,
    left: o.incomeSide === 'left' ? (o.incomePinned ? TRACK_W + HUD_GAP : LEFT_TRACK_INSET) : 12,
    bottom: o.incomeSide === 'bottom' ? (o.incomePinned ? TRACK_H : FILET_H) + HUD_GAP : 12,
    right: lane + 12,
  };
}
/** where the income track down the left edge starts: under whatever holds
 *  the top of the screen (the VP track, a read game's curve), else at the
 *  very top, never under them nor leaving a gap above it */
export const leftTrackTop = (insets: { top: number }): number => Math.max(0, insets.top - HUD_GAP);
