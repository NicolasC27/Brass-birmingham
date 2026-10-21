/* The photo mode's print: how large the plate is pulled, in what format
   it leaves, what it is called, and the line engraved under the name.
   Pure measures here, read by photo.ts and the photo toolbar — nothing
   in this file touches the GPU or the page. */

import type { Era } from '@/game/types';

/** the looks a photograph may be printed in */
export type PhotoLook = 'none' | 'sepia' | 'aquarelle' | 'nuit';
export const PHOTO_LOOKS: readonly PhotoLook[] = ['none', 'sepia', 'aquarelle', 'nuit'];

export const isPhotoLook = (v: unknown): v is PhotoLook => typeof v === 'string' && (PHOTO_LOOKS as readonly string[]).includes(v);

/** the widest print pulled, in pixels: a 4K screen's width */
export const PRINT_MAX_W = 3840;
/** and the tallest, for a frame stood on its end */
export const PRINT_MAX_H = 3840;
/** the print is pulled at twice the frame, when that stays under the caps */
export const PRINT_FACTOR = 2;
/** past this many pixels a PNG runs to tens of megabytes: the print
 *  leaves as a JPEG instead */
export const PNG_MAX_PIXELS = 4_000_000;

export interface PrintSize {
  width: number;
  height: number;
  /** print pixels to one pixel of the frame */
  scale: number;
}

/** the size of the print pulled from a frame of w×h (CSS pixels): twice
 *  the frame, held under 3840 on either side, never less than the frame
 *  itself unless the frame is already past the cap */
export function printSize(w: number, h: number, factor = PRINT_FACTOR): PrintSize {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0, scale: 0 };
  const scale = Math.min(factor, PRINT_MAX_W / w, PRINT_MAX_H / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
}

/** PNG for a print of modest size, JPEG past PNG_MAX_PIXELS */
export function printFormat(width: number, height: number): 'png' | 'jpeg' {
  return width * height > PNG_MAX_PIXELS ? 'jpeg' : 'png';
}

export interface CaptionFacts {
  era: Era;
  round: number;
  /** the game is played out: the caption says so rather than a round */
  over: boolean;
  /** a table at the office has a code; a game at home has none */
  code: string | null;
  year: number;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** the line under the signature: "Canal, manche 6 · 2026", the table's
 *  code first when it has one */
export function photoCaption(t: Translate, f: CaptionFacts): string {
  const era = t(f.era === 'rail' ? 'game.photo.caption.rail' : 'game.photo.caption.canal');
  const moment = f.over ? t('game.photo.caption.over', { era }) : t('game.photo.caption.round', { era, round: f.round });
  const parts = [moment, String(f.year)];
  if (f.code) parts.unshift(t('game.photo.caption.table', { code: f.code }));
  return parts.join(' · ');
}

/** the file's name: blackrail-rail-r7-sepia.png */
export function photoFileName(f: Pick<CaptionFacts, 'era' | 'round' | 'over'>, look: PhotoLook, format: 'png' | 'jpeg'): string {
  const moment = f.over ? 'fin' : `r${f.round}`;
  const ext = format === 'png' ? 'png' : 'jpg';
  return ['blackrail', f.era, moment, look === 'none' ? null : look].filter(Boolean).join('-') + `.${ext}`;
}
