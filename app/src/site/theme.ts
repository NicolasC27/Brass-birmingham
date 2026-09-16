import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* The site's two dresses: the Bourse (slate, porcelain, copper) and   */
/* the Cercle (baize, mahogany, brass, printed paper). One attribute   */
/* on the root element, the stylesheet does the rest; the board never  */
/* changes with it.                                                    */
/* ------------------------------------------------------------------ */

export type SiteTheme = 'bourse' | 'cercle';
export const SITE_THEMES: SiteTheme[] = ['bourse', 'cercle'];

const KEY = 'brassworks.site';

const read = (): SiteTheme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'cercle' ? 'cercle' : 'bourse';
  } catch {
    return 'bourse';
  }
};

let theme: SiteTheme = read();
const listeners = new Set<() => void>();

const apply = () => {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-site', theme);
};
apply();

export function setSiteTheme(t: SiteTheme): void {
  theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* the choice lasts as long as this page then */
  }
  apply();
  listeners.forEach((f) => f());
}

export const getSiteTheme = (): SiteTheme => theme;

export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => theme,
    () => 'bourse',
  );
}
