/* ------------------------------------------------------------------ */
/* Where a tooltip's plate goes, from its anchor's box on the screen:   */
/* pinned by the edge that faces the anchor, centred on it along the    */
/* other axis, and slid back inside the screen when centring would push */
/* it past an edge (a pawn at the end of a track, a bracket of the      */
/* income ruler at the top or foot of the left edge).                   */
/* ------------------------------------------------------------------ */

export type TipSide = 'top' | 'bottom' | 'left' | 'right';
export interface TipBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TipAt {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/** the room kept between the plate and the screen's edge */
export const TIP_MARGIN = 8;
/** the gap between the plate and its anchor, by default */
export const TIP_GAP = 8;

/** the start of a `size` long plate centred on `centre`, kept inside [0, room] */
function slide(centre: number, size: number, room: number): number {
  const start = centre - size / 2;
  const max = room - TIP_MARGIN - size;
  return max < TIP_MARGIN ? Math.max(0, (room - size) / 2) : Math.min(max, Math.max(TIP_MARGIN, start));
}

/**
 * The plate's fixed position. `plate` is its measured size (null before the
 * first measure: centred by the edge's middle alone, as a best guess). The
 * anchor is first cut to the screen, so a bracket half scrolled out of a
 * zoomed track centres its plate on the part that shows. `gap` parts the
 * plate from the anchor (wider to clear the track a pawn stands on).
 */
export function placeTip(side: TipSide, anchor: TipBox, plate: { w: number; h: number } | null, vw: number, vh: number, gap = TIP_GAP): TipAt {
  const x0 = Math.max(0, anchor.x);
  const x1 = Math.min(vw, anchor.x + anchor.w);
  const y0 = Math.max(0, anchor.y);
  const y1 = Math.min(vh, anchor.y + anchor.h);
  const cx = x1 > x0 ? (x0 + x1) / 2 : anchor.x + anchor.w / 2;
  const cy = y1 > y0 ? (y0 + y1) / 2 : anchor.y + anchor.h / 2;
  const w = plate?.w ?? 0;
  const h = plate?.h ?? 0;
  switch (side) {
    case 'top':
      return { left: slide(cx, w, vw), bottom: vh - anchor.y + gap };
    case 'bottom':
      return { left: slide(cx, w, vw), top: anchor.y + anchor.h + gap };
    case 'left':
      return { right: vw - anchor.x + gap, top: slide(cy, h, vh) };
    default:
      return { left: anchor.x + anchor.w + gap, top: slide(cy, h, vh) };
  }
}
