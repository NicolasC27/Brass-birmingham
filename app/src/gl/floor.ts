import { ribbonLabelScale } from '@/components/game/boardView';

/* A mark on a card that keeps a floor on screen — a figure (level, stock,
   score) or an owner's seal. The name ribbons already hold one
   (ribbonLabelScale, RIBBON_MIN_SCREEN); the marks borrow the same rule,
   read at the screen scale rather than the zoom: never smaller than they
   are drawn, grown until they reach their floor, and held within the
   ribbons' ceiling so a card keeps its proportions. No PixiJS here, so the
   rule can be put to the test on its own. */

/** a figure on a card (level, stock, score) never reads under this on screen */
export const FIGURE_MIN_SCREEN = 10;
/** nor an owner's seal, measured on its shape */
export const SEAL_MIN_SCREEN = 8;

export interface FloorRule {
  /** the size that must stay legible, in world units (a numeral's font, a seal's shape) */
  size: number;
  /** its floor, in screen px */
  px: number;
  /** a scale it never goes under (the seal, larger in colour-blind mode) */
  base: number;
  /** a scale it never goes over, where a larger mark would run into its neighbour */
  max?: number;
}

/** the scale a mark takes at screen scale `s` (world units → px) */
export function flooredScale(s: number, f: FloorRule): number {
  return Math.min(f.max ?? Infinity, Math.max(f.base, ribbonLabelScale(1, s, f.size, f.px)));
}
