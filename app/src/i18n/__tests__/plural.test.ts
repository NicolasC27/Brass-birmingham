import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LANGS, setLang, tr } from '../index';
import type { Lang } from '../index';
import { de } from '../de';
import { en } from '../en';
import { es } from '../es';
import { fr } from '../fr';

/* a counted word agrees with its count, in every tongue the house speaks */

const DICTS = { en, fr, es, de } as const;

/** every string of a dictionary, with its dotted key */
function strings(node: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof node === 'string') return [{ key: path.join('.'), text: node }];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => strings(v, [...path, k]));
}

describe('a counted word', () => {
  beforeEach(() => setLang('fr'));

  it('takes the singular for one, the plural beyond', () => {
    setLang('en');
    expect(tr('game.guide.happens.goods.coal', { n: 1 })).toBe('1 cube');
    expect(tr('game.guide.happens.goods.iron', { n: 3 })).toBe('3 bars');
    /* a new mine or works sells what the market can take — none of it spare */
    expect(tr('game.guide.happens.restockMine', { industry: 'forge', goods: tr('game.guide.happens.goods.iron', { n: 1 }), gain: 4 })).toContain('sold 1 bar to the market');
  });

  it('counts zero as one thing in French, as many elsewhere', () => {
    setLang('fr');
    expect(tr('game.guide.tips.industry', { n: 0 })).toContain('0 emplacement possible');
    expect(tr('game.guide.tips.industry', { n: 1 })).toContain('1 emplacement possible');
    expect(tr('game.guide.tips.industry', { n: 2 })).toContain('2 emplacements possibles');
    setLang('en');
    expect(tr('game.guide.tips.industry', { n: 0 })).toContain('0 slots');
    expect(tr('game.guide.tips.industry', { n: 1 })).toContain('1 slot ');
  });

  it('leaves a plural form nothing names as it stands', () => {
    setLang('fr');
    expect(tr('game.guide.tips.industry')).toContain('[n|emplacement|emplacements]');
  });

  it('is never left for the reader to resolve', () => {
    for (const lang of LANGS) {
      const loose = strings(DICTS[lang]).filter((x) => /\w\(s\)/.test(x.text));
      expect(loose.map((x) => `${lang}:${x.key}`)).toEqual([]);
    }
  });

  /* ------------------------------------------------------------------ */
  /* A count sets the word behind it. These are the only words allowed  */
  /* to stand there bare: units, which never take a plural; the         */
  /* function words that open a phrase instead of naming a thing; and   */
  /* the handful of uncountables the board deals in. Written out rather */
  /* than caught by a wide expression, so the next omission falls.      */
  /* ------------------------------------------------------------------ */
  const BARE: Record<Lang, readonly string[]> = {
    fr: [
      'min', 'h', 'j', 'PV', 'pts',
      'de', 'des', 'du', 'dans', 'en', 'sur', 'à', 'au', 'aux', 'ou', 'et', 'par', 'pour', 'autour', 'encore', 'plus',
      'charbon', 'fer', 'bière', 'revenu',
      /* une fois, trois fois — the word does not move */
      'fois',
    ],
    en: [
      'min', 'h', 'd', 'VP', 'pts',
      'of', 'in', 'at', 'on', 'or', 'and', 'to', 'from', 'for', 'with', 'still', 'more', 'left', 'open', 'possible',
      'waiting', 'watching', 'online', 'ranked', 'lost', 'best', 'good',
      'coal', 'iron', 'beer', 'income',
      /* a works, two works — the word does not move */
      'works',
    ],
    es: [
      'min', 'h', 'd', 'PV', 'pts',
      'de', 'del', 'en', 'sobre', 'a', 'al', 'o', 'y', 'por', 'para', 'aún', 'más', 'mirando', 'esperando',
      'carbón', 'hierro', 'cerveza', 'ingresos',
    ],
    de: [
      'Min', 'Std', 'T', 'SP', 'Pkt',
      'von', 'in', 'am', 'auf', 'aus', 'oder', 'und', 'mit', 'für', 'noch', 'mehr', 'übrig', 'offen', 'online',
      'gewertet', 'verloren', 'ausgegeben', 'möglich', 'deiner', 'deine',
      'Kohle', 'Eisen', 'Bier', 'Einkommen',
      /* der Spieler, die Spieler — the same word on either side of one */
      'Spieler', 'Würfel', 'Plättchen', 'Barren',
    ],
  };

  /* keys where the number orders rather than counts: seat two, not two seats */
  const ORDINAL: readonly string[] = ['setup.seat.openAria', 'setup.seat.nameAria', 'setup.seat.typeAria', 'setup.seat.colorAria'];

  it('sets the word standing behind a count', () => {
    const loose: string[] = [];
    for (const lang of LANGS) {
      for (const { key, text } of strings(DICTS[lang])) {
        if (ORDINAL.includes(key)) continue;
        for (const m of text.matchAll(/\{(count|n)\}[\s\u00a0\u202f]+([^\s\u00a0\u202f[{<]+)/g)) {
          /* the string already names its own form: nothing to settle */
          if (new RegExp(`\\[${m[1]}\\|`).test(text)) continue;
          const word = m[2].replace(/[.,:;!?)\u2026"\u2019\u00bb]+$/u, '');
          /* a symbol or a figure — ×, ·, £, an arrow — never takes a plural */
          if (!/\p{L}/u.test(word)) continue;
          if (BARE[lang].includes(word)) continue;
          loose.push(`${lang}:${key} → "{${m[1]}} ${word}"`);
        }
      }
    }
    expect(loose).toEqual([]);
  });

  it('names a count the string carries', () => {
    for (const lang of LANGS) {
      for (const { key, text } of strings(DICTS[lang])) {
        for (const [, name] of text.matchAll(/\[(\w+)\|[^|\]]*\|[^\]]*\]/g)) {
          expect(`${lang}:${key} → {${name}}`).toBe(text.includes(`{${name}}`) ? `${lang}:${key} → {${name}}` : `${lang}:${key} has no {${name}}`);
        }
      }
    }
  });

  it('agrees the same way in every tongue of a key', () => {
    const forms = (text: string) => [...text.matchAll(/\[(\w+)\|/g)].map((m) => m[1]).sort();
    const base = new Map(strings(en).map((x) => [x.key, x.text]));
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      for (const { key, text } of strings(DICTS[lang])) {
        const other = base.get(key);
        if (!other || !forms(other).length) continue;
        /* a tongue may need no agreement where English does, but never one English does not name */
        for (const name of forms(text)) expect(`${lang}:${key}:${name}`).toBe(other.includes(`{${name}}`) ? `${lang}:${key}:${name}` : `${lang}:${key} counts on {${name}}, English does not`);
      }
    }
  });

  afterEach(() => setLang('fr'));
});
