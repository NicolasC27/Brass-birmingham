/* ------------------------------------------------------------------ */
/* The table's three floors. Nothing of the shell goes under them:      */
/*  - a line of text is at least TEXT_FLOOR_PX tall (the board's own    */
/*    engraved rulers aside, and the miniatures in the settings, which  */
/*    are pictures and say so with a `picture-scale` mark);             */
/*  - text stands at CONTRAST_FLOOR against what it is printed on, or   */
/*    CONTRAST_FLOOR_LARGE for large type and for the state of a        */
/*    control (a full socket against an empty one);                     */
/*  - a control offers at least TARGET_FLOOR_PX square to the pointer,  */
/*    its drawing smaller if it must be, its hit zone never.            */
/* A test walks the shell's sources against the first, and holds the   */
/* inks chosen for the second to their ratios.                          */
/* ------------------------------------------------------------------ */

export const TEXT_FLOOR_PX = 9;
export const CONTRAST_FLOOR = 4.5;
export const CONTRAST_FLOOR_LARGE = 3;
export const TARGET_FLOOR_PX = 24;

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** relative luminance of a #RRGGBB ink */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** the contrast ratio of two #RRGGBB inks, 1 to 21 */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
