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
  /* nothing asked: the lamps go by the hour */
  return byTheHour();
}

/** the register the hour calls for: the night's from eight to seven */
export function byTheHour(now = new Date()): Theme {
  const h = now.getHours();
  return h >= 20 || h < 7 ? 'dark' : 'light';
}

const hasPreference = (): boolean => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'dark' || saved === 'light';
  } catch {
    return false;
  }
};

let theme: Theme = initialTheme();

/* every minute, while nobody has chosen, the lamps follow the hour — lit
   or put out with a short fade */
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (hasPreference()) return;
    const wanted = byTheHour();
    if (wanted === theme) return;
    document.documentElement.classList.add('lamps');
    window.setTimeout(() => document.documentElement.classList.remove('lamps'), 900);
    theme = wanted;
    apply(wanted);
    for (const f of listeners) f();
  }, 60_000);
}

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
