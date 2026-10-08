import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Where the table's fixed pieces stand (the banner, the rail, the      */
/* minimap, the hand, the guide's lane), for the panels that hang       */
/* beside them. The banner's own measure is the pattern: a              */
/* ResizeObserver on the pieces, and nothing read on a clock. Pieces    */
/* are looked up again when the table's tree changes (the banner is     */
/* remounted when the turn changes hands), at most once a frame, and a  */
/* new rect is only handed back when one of its edges has moved.        */
/* ------------------------------------------------------------------ */

export interface HudRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const same = (a: readonly (HudRect | null)[], b: readonly (HudRect | null)[]): boolean =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i];
    if (!x || !y) return x === y;
    return x.top === y.top && x.left === y.left && x.right === y.right && x.bottom === y.bottom;
  });

function rectOf(el: Element | null): HudRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  /* a hidden tab measures every box at zero: nothing is learned from it */
  if (r.width === 0 && r.height === 0) return null;
  return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
}

/** the rects of the first element matching each selector, kept current
 *  while `active`; null for a piece that is not on the table */
export function useHudRects(selectors: readonly string[], active = true): (HudRect | null)[] {
  const key = selectors.join('\n');
  const [rects, setRects] = useState<(HudRect | null)[]>(() => selectors.map(() => null));
  useEffect(() => {
    if (!active) return;
    const sels = key.split('\n');
    let watched: (Element | null)[] = [];
    let frame = 0;
    const ro = new ResizeObserver(() => later());
    const read = () => {
      frame = 0;
      const found = sels.map((q) => document.querySelector(q));
      if (found.some((el, i) => el !== watched[i])) {
        ro.disconnect();
        for (const el of found) if (el) ro.observe(el);
        watched = found;
      }
      const next = found.map(rectOf);
      setRects((prev) => (same(prev, next) ? prev : next));
    };
    const later = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    /* a piece mounted or remounted: looked up again on the next frame */
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    read();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', later);
    };
  }, [key, active]);
  return rects;
}
