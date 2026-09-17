import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* theme — tiny dependency-free dark/light store (same pattern as     */
/* i18n/index.ts). Choice persists in localStorage                    */
/* (brassworks.theme.v1); first visit follows prefers-color-scheme.   */
/* The attribute lives on <html> (set pre-paint by the inline script  */
/* in index.html) while every variable stays scoped to .platform-root,*/
/* so /game and the legacy overlays are never affected.               */
/* ------------------------------------------------------------------ */

export type Theme = 'dark' | 'light';

const KEY = 'brassworks.theme.v1';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* private mode */
  }
  /* the register of day is the house's dress: dark only when asked */
  return 'light';
}

let theme: Theme = initialTheme();

const listeners = new Set<() => void>();

function apply(t: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
}

/* sync <html> with the resolved theme (the inline script already did
   it pre-paint; this covers script-less/SSR-ish edge cases) */
apply(theme);

export function getTheme(): Theme {
  return theme;
}

export function setTheme(t: Theme): void {
  theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* non-fatal */
  }
  apply(t);
  for (const f of listeners) f();
}

export function toggleTheme(): void {
  setTheme(theme === 'dark' ? 'light' : 'dark');
}

/** subscribe without React */
export function onThemeChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => theme,
  );
}
