import { useSyncExternalStore } from 'react';
import type { ChipStyle, SlotArt, StockStyle, TileArt } from '@/gl/paint';
import type { TrafficLevel } from '@/gl/ambiance';
import type { IndustryType } from '@/game/types';

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
/** where the income track runs: along the bottom edge or down the left edge */
export type IncomeSide = 'bottom' | 'left';
/** the era paintings under the board: the original terrain with etched
 *  waterways, or the fully painted countryside with its canals and rails */
export type MapStyle = 'etched' | 'painted';
export const MAP_URL: Record<MapStyle, { canal: string; rail: string }> = {
  etched: { canal: '/map-era-canal.webp', rail: '/map-era-rail.webp' },
  painted: { canal: '/map-painted-canal.webp', rail: '/map-painted-rail.webp' },
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
  incomeSide: IncomeSide;
  mapStyle: MapStyle;
  /** boats and trains on built links */
  traffic: TrafficLevel;
  /** beginner aid: dim unplayable slots while planning, itemised price tags */
  beginnerAid: boolean;
  /** player mat spread wide (six columns) instead of the slim docked panel */
  matWide: boolean;
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
  incomeSide: 'brassworks.incomeSide',
  mapStyle: 'brassworks.mapStyle',
  traffic: 'brassworks.traffic',
  beginnerAid: 'brassworks.beginnerAid',
  matWide: 'brassworks.matWide',
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

let state: BoardOptions = {
  hideUnbuilt: read('hideUnbuilt', false),
  bigChips: read('bigChips', false),
  greyFreeMerchants: read('greyFreeMerchants', false),
  stockStyle: read('stockStyle', 'corner'),
  tileArt: read('tileArt', {}),
  matOrder: read('matOrder', [...MAT_ORDER_DEFAULT]),
  slotArt: read('slotArt', 'engraved'),
  colorBlind: read('colorBlind', false),
  sealTiles: read('sealTiles', true),
  sealLinks: read('sealLinks', true),
  cardGrain: read('cardGrain', true),
  chipStyle: read('chipStyle', 'band'),
  minimapSize: read('minimapSize', 's'),
  incomeSide: read('incomeSide', 'bottom'),
  mapStyle: read('mapStyle', 'etched'),
  traffic: read('traffic', 'light'),
  beginnerAid: read('beginnerAid', false),
  matWide: read('matWide', false),
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
export const TRACK_W = 56;
/** pixel insets every floating HUD element keeps from the screen edges */
export function hudInsets(o: BoardOptions): { left: number; bottom: number; top: number } {
  return { top: TRACK_H + 8, left: o.incomeSide === 'left' ? TRACK_W + 8 : 12, bottom: o.incomeSide === 'bottom' ? TRACK_H + 8 : 12 };
}
