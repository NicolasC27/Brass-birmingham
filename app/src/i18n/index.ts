import { useSyncExternalStore } from 'react';
import { en } from './en';
import { fr } from './fr';

/* ------------------------------------------------------------------ */
/* i18n — tiny dependency-free FR/EN store.                            */
/* useT() (components) and tr() (non-React code, e.g. the WebGL scene) */
/* resolve dot-paths ("game.topbar.toAct") with {var} interpolation;   */
/* missing keys fall back to English, then to the key itself.          */
/* Choice persists in localStorage (brassworks.lang); default follows  */
/* the browser language (French first).                                */
/* ------------------------------------------------------------------ */

export type Lang = 'en' | 'fr';
export type { Dict } from './en';

const KEY = 'brassworks.lang';

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    /* private mode */
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
})();

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* non-fatal */
  }
  for (const f of listeners) f();
}

/** subscribe without React (WebGL scene redraws) */
export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

type AnyDict = Record<string, unknown>;

function lookup(dict: AnyDict, key: string): string | undefined {
  const v = key.split('.').reduce<unknown>((o, k) => (o as AnyDict | undefined)?.[k], dict);
  return typeof v === 'string' ? v : undefined;
}

function fmt(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** an engine refusal in the reader's language — the English sentence is the key, and stands when unknown */
export function reasonText(text: string | null | undefined): string {
  if (!text) return '';
  const dict = (lang === 'fr' ? fr : en) as AnyDict;
  const said = (dict.game as AnyDict | undefined)?.reasons as Record<string, string> | undefined;
  if (said?.[text]) return said[text];
  /* the few refusals that carry a number: match on the words around it */
  const money = text.match(/^Needs £(\d+) — you hold £(\d+)$/);
  if (money && said?.needsMoney) return fmt(said.needsMoney, { need: money[1], have: money[2] });
  return text;
}

/** translate outside React (current language, English fallback) */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const dict = (lang === 'fr' ? fr : en) as AnyDict;
  return fmt(lookup(dict, key) ?? lookup(en as AnyDict, key) ?? key, vars);
}

/** React hook: t('game.topbar.toAct', { name }) re-renders on language change */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const l = useLang();
  const dict = (l === 'fr' ? fr : en) as AnyDict;
  return (key, vars) => fmt(lookup(dict, key) ?? lookup(en as AnyDict, key) ?? key, vars);
}
