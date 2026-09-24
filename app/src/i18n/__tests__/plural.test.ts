import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LANGS, setLang, tr } from '../index';
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
    expect(tr('game.guide.happens.restockMine', { industry: 'forge', n: 1, gain: 4 })).toContain('1 spare cube ');
    expect(tr('game.guide.happens.restockMine', { industry: 'forge', n: 3, gain: 9 })).toContain('3 spare cubes ');
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
