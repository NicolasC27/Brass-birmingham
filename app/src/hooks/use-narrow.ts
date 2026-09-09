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

