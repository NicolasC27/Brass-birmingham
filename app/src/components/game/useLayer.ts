import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { escapeTop, openLayer, removeLayer, topLayer } from './layers';
import type { LayerZone } from './layers';
import { getFitReserve, subscribeFitReserve } from './boardView';

/* ------------------------------------------------------------------ */
/* The spike wired to the page. A panel says `useLayer(open, close)`,   */
/* hangs the returned ref on its outer box, and the table does the rest:*/
/*  - the ticket goes on the spike when it opens, off when it closes;   */
/*  - the keyboard lands in the panel as it opens (a field that took it */
/*    by itself keeps it), and goes back to whatever opened it after;   */
/*  - one Escape listener for the whole table, ahead of every other:    */
/*    it lifts the top ticket and stops there, so the key never reaches */
/*    the board's Escape (dropping the move in hand) while a panel is up;*/
/*  - a modal sheet on top keeps Tab inside it.                         */
/* The pattern is the platform's Modal (role, aria-modal, Escape, the   */
/* way out), carried over to a table where several sheets can be up.    */
/* ------------------------------------------------------------------ */

const boxes = new Map<number, RefObject<HTMLElement | null>>();

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onKey(e: KeyboardEvent): void {
  const top = topLayer();
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    escapeTop();
    return;
  }
  if (e.key !== 'Tab' || !top.modal) return;
  const box = boxes.get(top.id)?.current;
  if (!box) return;
  const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!stops.length) {
    e.preventDefault();
    box.focus();
    return;
  }
  const first = stops[0];
  const last = stops[stops.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || !box.contains(at))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !box.contains(at))) {
    e.preventDefault();
    first.focus();
  }
}

/* registered once, as the module loads: before any panel's own listener,
   so that the window's capture phase hears the spike first */
if (typeof window !== 'undefined') window.addEventListener('keydown', onKey, true);

export interface LayerOptions {
  /** the edge the panel holds, or the middle (the default) */
  zone?: LayerZone;
  /** holds the table: Tab stays inside while it is on top */
  modal?: boolean;
  /** take the keyboard as it opens (default true); a panel that opens by
   *  itself, not at the reader's asking, leaves it where it is */
  focus?: boolean;
}

/** a panel of the table: on the spike while `open`, closed by Escape when
 *  on top, by a newcomer on its edge, or by its own way out. Returns the
 *  ref for the panel's outer box (give it `tabIndex={-1}`). */
export function useLayer<T extends HTMLElement = HTMLDivElement>(open: boolean, close: () => void, opts: LayerOptions = {}): RefObject<T | null> {
  const { zone = 'centre', modal = false, focus = true } = opts;
  const box = useRef<T | null>(null);
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  const focusRef = useRef(focus);
  useLayoutEffect(() => {
    focusRef.current = focus;
  });
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = openLayer(zone, () => closeRef.current(), modal);
    boxes.set(id, box);
    /* the panel is mounted by now, its entrance still running */
    const raf = focusRef.current
      ? window.requestAnimationFrame(() => {
          const el = box.current;
          if (!el || el.contains(document.activeElement)) return;
          el.focus({ preventScroll: true });
        })
      : 0;
    return () => {
      window.cancelAnimationFrame(raf);
      const el = box.current;
      removeLayer(id);
      boxes.delete(id);
      /* the keyboard goes back where it came from — unless the reader has
         since taken it somewhere else of their own accord */
      const at = document.activeElement;
      const stranded = !at || at === document.body || (!!el && el.contains(at));
      if (stranded && trigger && trigger !== document.body && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, zone, modal]);
  return box;
}

/** the height the hand holds over the bottom of the table, live: panels
 *  that hang along an edge keep their foot above it */
export function useDockReserve(): number {
  return useSyncExternalStore(subscribeFitReserve, getFitReserve, getFitReserve);
}

/** a sheet hung at mid-height on the left edge (the notebook, a question
 *  to the guide): centred on the table, never taller than the room between
 *  the hand's reserve and its mirror at the top, so its foot always clears
 *  the hand. The centring rides on the panel's own `y: '-50%'` animation,
 *  since the entrance transform would overwrite a translate class. `left`
 *  is the HUD's left inset, so the sheet stands beside an income track
 *  run down that edge rather than over it. */
export function leftSheetStyle(reserve: number, left: number): { left: number; top: string; maxHeight: string } {
  return { left, top: '50%', maxHeight: `calc(100% - ${2 * (reserve + 8)}px)` };
}
