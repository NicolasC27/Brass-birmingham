import { useCallback, useSyncExternalStore } from 'react';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { de } from './de';
import { TOWN_BY_ID } from '@/game/data';

/* ------------------------------------------------------------------ */
/* i18n — tiny dependency-free FR/EN store.                            */
/* useT() (components) and tr() (non-React code, e.g. the WebGL scene) */
/* resolve dot-paths ("game.topbar.toAct") with {var} interpolation;   */
/* missing keys fall back to English, then to the key itself.          */
/* Choice persists in localStorage (brassworks.lang); default follows  */
/* the browser language (French first).                                */
/* ------------------------------------------------------------------ */

export const LANGS = ['fr', 'en', 'es', 'de'] as const;
export type Lang = (typeof LANGS)[number];

/** the BCP 47 tag for dates and figures in that language */
export const localeOf = (l: string): string => (l === 'fr' ? 'fr-FR' : l === 'es' ? 'es-ES' : l === 'de' ? 'de-DE' : 'en-GB');
import type { Dict } from './en';
export type { Dict } from './en';

const KEY = 'brassworks.lang';

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    if ((LANGS as readonly string[]).includes(saved ?? '')) return saved as Lang;
  } catch {
    /* private mode */
  }
  const spoken = typeof navigator !== 'undefined' ? navigator.language.toLowerCase().slice(0, 2) : 'en';
  return (LANGS as readonly string[]).includes(spoken) ? (spoken as Lang) : 'en';
})();

/* the sheet says which language it is set in: hyphenation, quotation
   marks and the voice of a screen reader all read this attribute */
function proclaim(l: Lang): void {
  /* the office runs this file too, and an office has no sheet to mark:
     the page is reached through globalThis so the server build, which
     carries no DOM types, still compiles */
  const sheet = (globalThis as { document?: { documentElement: { lang: string } } }).document;
  if (sheet) sheet.documentElement.lang = l;
}

proclaim(lang);

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
  proclaim(l);
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

const DICTS: Record<Lang, Dict> = { en, fr, es, de };
/** a whole dictionary, for a reader that searches it rather than looks a key up */
export const dictOf = (l: Lang): AnyDict => DICTS[l] as unknown as AnyDict;

function lookup(dict: AnyDict, key: string): string | undefined {
  const v = key.split('.').reduce<unknown>((o, k) => (o as AnyDict | undefined)?.[k], dict);
  return typeof v === 'string' ? v : undefined;
}

/** one or many: French counts 0 as one thing, the others do not */
const isOne = (n: number, l: Lang): boolean => (l === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1);

function fmt(s: string, vars?: Record<string, string | number>, l: Lang = lang): string {
  if (!vars) return s;
  let out = s;
  /* [n|cube|cubes] — the word agreeing with the count named first */
  out = out.replace(/\[(\w+)\|([^|\]]*)\|([^\]]*)\]/g, (_m, k: string, one: string, many: string) => (isOne(Number(vars[k] ?? 0), l) ? one : many));
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** an engine refusal in the reader's language: the English sentence, or
 *  the office's code, is the key. A refusal the sheets do not know is said
 *  as a plain sentence, and its raw words go to the console, never to the
 *  player's bubble. */
export function reasonText(text: string | null | undefined): string {
  if (!text) return '';
  const dict = dictOf(lang);
  const said = (dict.game as AnyDict | undefined)?.reasons as Record<string, string> | undefined;
  const known = knownReason(text, dict, said);
  if (known !== null) return known;
  if (sheetsSay(text, lang)) return text;
  const seen = `${lang}\n${text}`;
  if (!confessed.has(seen)) {
    confessed.add(seen);
    console.error(`[refusal] no sentence for: ${text}`);
  }
  return said?.unknown ?? lookup(en as AnyDict, 'game.reasons.unknown') ?? text;
}

/* each unknown refusal is confessed once per tongue: the bubble that shows
   it re-renders, the console need not repeat itself */
const confessed = new Set<string>();

/* the table also hands this path sentences it has already put in the
   reader's tongue (a queued move dropped, the line being set again): they
   are recognised against the sheets' own templates and stand as written.
   A template with hardly a word of its own ("{industry} L{level}") would
   swallow anything, and is left out. */
const shapes = new Map<Lang, { plain: Set<string>; shaped: RegExp[] }>();
const verdicts = new Map<string, boolean>();
const SLOT = /\{\w+\}|\[\w+\|[^|\]]*\|[^\]]*\]/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function template(s: string): RegExp {
  let src = '';
  let from = 0;
  for (const m of s.matchAll(SLOT)) {
    src += escape(s.slice(from, m.index));
    const agree = m[0].match(/^\[\w+\|([^|\]]*)\|([^\]]*)\]$/);
    src += agree ? `(?:${escape(agree[1])}|${escape(agree[2])})` : '[\\s\\S]+?';
    from = (m.index ?? 0) + m[0].length;
  }
  return new RegExp(`^${src}${escape(s.slice(from))}$`, 'u');
}

function sheetsSay(text: string, l: Lang): boolean {
  const key = `${l}\n${text}`;
  const cached = verdicts.get(key);
  if (cached !== undefined) return cached;
  let book = shapes.get(l);
  if (!book) {
    const plain = new Set<string>();
    const shaped: RegExp[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') {
        if (!node.match(SLOT)) plain.add(node);
        else if ((node.replace(SLOT, '').match(/\p{L}/gu)?.length ?? 0) >= 8) shaped.push(template(node));
      } else if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v);
    };
    const d = dictOf(l);
    walk(d.game);
    walk(d.board);
    book = { plain, shaped };
    shapes.set(l, book);
  }
  const said = book.plain.has(text) || book.shaped.some((r) => r.test(text));
  if (verdicts.size > 500) verdicts.clear();
  verdicts.set(key, said);
  return said;
}

function knownReason(text: string, dict: AnyDict, said: Record<string, string> | undefined): string | null {
  if (said?.[text]) return said[text];
  /* a code followed by its detail, "out-of-step: the log stands at 12":
     the code is said, the detail is for the console */
  const coded = text.match(/^([a-z]+(?:-[a-z]+)+)(?::\s|$)/);
  if (coded && said?.[coded[1]]) {
    if (coded[1] !== text) console.error(`[refusal] ${text}`);
    return said[coded[1]];
  }
  /* the few refusals that carry a number: match on the words around it */
  const owed = text.match(/^Needs £(\d+) — you hold £(\d+)$/);
  if (owed && said?.needsMoney) return fmt(said.needsMoney, { need: owed[1], have: owed[2] });
  const beer = text.match(/^Needs (\d+) beer — a brewery of yours, one connected here, or the merchant's barrel$/);
  if (beer && said?.needsBeer) return fmt(said.needsBeer, { n: beer[1] }, lang);
  /* the refusals that carry a name — a town, an industry, an era */
  const board = dict.board as AnyDict | undefined;
  const refusal = board?.refusal as (Record<string, string> & { plain?: Record<string, string> }) | undefined;
  if (!refusal) return null;
  if (refusal.plain?.[text]) return refusal.plain[text];
  const industry = (id: string) => lookup(dict, `game.log.industry.${id}`) ?? lookup(en as AnyDict, `game.log.industry.${id}`) ?? id;
  const era = (id: string) => lookup(dict, `board.era.${id}`) ?? id;
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^This card builds in (\S+) only$/))) return fmt(refusal.cardTown, { town: TOWN_BY_ID[m[1]]?.name ?? m[1] });
  if ((m = text.match(/^This card builds (.+) only$/))) return fmt(refusal.cardIndustry, { list: m[1].split(' or ').map(industry).join(' / ') });
  if ((m = text.match(/^No (\w+) tiles left$/))) return fmt(refusal.noTiles, { industry: industry(m[1]) });
  if ((m = text.match(/^(\w+) L(\d) cannot be built in the (\w+) era$/))) return fmt(refusal.wrongEra, { industry: industry(m[1]), level: m[2], era: era(m[3]) });
  if ((m = text.match(/^Opponent's tile can only be overbuilt once no (\w+) is left anywhere$/))) return fmt(refusal.overbuildOnce, { resource: industry(m[1]) });
  return null;
}

/** a sum of money as the reader's sheets set it: "12 £" in French and
 *  Spanish, with the unbreakable space the sheets use, "£12" in English
 *  and German; a debt keeps its minus sign in front ("−£3", "−3 £") */
export function money(n: number | string, l: Lang = lang): string {
  const debt = typeof n === 'number' ? n < 0 : /^[-−]/.test(n);
  const figure = typeof n === 'number' ? String(Math.abs(n)) : n.replace(/^[-−]/, '');
  const sum = l === 'fr' || l === 'es' ? `${figure}\u00a0£` : `£${figure}`;
  return debt ? `−${sum}` : sum;
}

/** translate outside React (current language, English fallback) */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const dict = dictOf(lang);
  return fmt(lookup(dict, key) ?? lookup(en as AnyDict, key) ?? key, vars, lang);
}

/** translate in a language named, not the page's — the office writes each
 *  letter in its reader's language (English fallback) */
export function trIn(l: Lang, key: string, vars?: Record<string, string | number>): string {
  return fmt(lookup(dictOf(l), key) ?? lookup(en as AnyDict, key) ?? key, vars, l);
}

/** React hook: t('game.topbar.toAct', { name }) re-renders on language change */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const l = useLang();
  /* one function per language, so effects may depend on it without churning */
  return useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = dictOf(l);
    return fmt(lookup(dict, key) ?? lookup(en as AnyDict, key) ?? key, vars, l);
  }, [l]);
}
