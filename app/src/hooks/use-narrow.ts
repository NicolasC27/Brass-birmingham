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
