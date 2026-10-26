import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Narrow screens (tablets and phones): the floating HUD folds — the   */
/* player rail becomes a horizontal strip under the top bar and the    */
/* mat and settings take the whole width. One media query, one hook.  */
/* ------------------------------------------------------------------ */

const QUERY = '(max-width: 1023px)';
const mql = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(QUERY) : null;

export function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mql?.addEventListener('change', cb);
      return () => mql?.removeEventListener('change', cb);
    },
    () => mql?.matches ?? false,
    () => false,
  );
}


/* ------------------------------------------------------------------ */
/* Wide screens: enough room beside the board for a lane of its own —  */
/* the guide's, in a guided game.                                      */
/* ------------------------------------------------------------------ */

const WIDE = '(min-width: 1100px)';
const wide = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(WIDE) : null;

export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      wide?.addEventListener('change', cb);
      return () => wide?.removeEventListener('change', cb);
    },
    () => wide?.matches ?? false,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* A measure of the window, followed as it is resized or a tablet      */
/* turned: the lanes that take a share of it are measured again, and   */
/* the page renders only when the measure itself changes.              */
/* ------------------------------------------------------------------ */

const onResize = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};

export function useWindowMeasure<T extends number | string | boolean>(measure: (width: number) => T): T {
  return useSyncExternalStore(onResize, () => measure(window.innerWidth), () => measure(1280));
}
