import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, reasonText, setLang } from '../index';
import type { Lang } from '../index';
import { de } from '../de';
import { en } from '../en';
import { es } from '../es';
import { fr } from '../fr';

/* ------------------------------------------------------------------ */
/* the table's own sheets — game, board, rules — held to the house    */
/* conventions: a counted word agrees whatever its count is called, a */
/* tile's level has one form per tongue, a gesture one name, and the  */
/* engine's refusals never reach the player in the engine's English.  */
/* ------------------------------------------------------------------ */

const DICTS = { en, fr, es, de } as const;
const SHEETS = ['game', 'board', 'rules'] as const;

function strings(node: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof node === 'string') return [{ key: path.join('.'), text: node }];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => strings(v, [...path, k]));
}

const table = (lang: Lang) => SHEETS.flatMap((s) => strings(DICTS[lang][s], [s]));

/* the counts the table hands its sentences, under whatever name */
const COUNTS = ['n', 'count', 'built', 'links', 'sold', 'tiles', 'flipped', 'developed', 'loans', 'played', 'won', 'lost', 'removed', 'passes', 'band', 'rounds', 'hit', 'seconds', 'vp', 'left', 'total', 'coal', 'iron', 'beer', 'sale', 'amount', 'pending', 'max'];

/* words that may stand bare behind a count: units, function words, and
   the words that never move with a number in that tongue. Stricter than
   the site-wide list: charbon, fer and bière agree here. */
const BARE: Record<Lang, readonly string[]> = {
  fr: ['PV', 'de', 'des', 'du', 'dans', 'en', 'sur', 'à', 'au', 'aux', 'ou', 'et', 'par', 'pour', 'fois', 'revenu', 'vendu', 'd’accord'],
  en: ['VP', 'of', 'in', 'at', 'on', 'or', 'and', 'to', 'for', 'left', 'possible', 'best', 'good', 'coal', 'iron', 'beer', 'income', 'works', 'built', 'sold', 'developed', 'flipped', 'borrowed', 'short', 'level-1', 'agree', 'from', 'now', 'per'],
  es: ['PV', 'de', 'en', 'a', 'al', 'y', 'por', 'ingresos', 'vendido'],
  de: ['SP', 'von', 'in', 'am', 'an', 'auf', 'aus', 'und', 'für', 'je', 'noch', 'übrig', 'möglich', 'deiner', 'Kohle', 'Eisen', 'Bier', 'Einkommen', 'Plättchen', 'Würfel', 'Barren', 'gebaut', 'verkauft', 'entwickelt', 'umgedreht', 'umzudrehen', 'ausgegeben', 'geliehen', 'fehlen', 'einverstanden', 'wert', 'zurück'],
};

describe('the table’s sheets', () => {
  afterEach(() => setLang('fr'));

  it('agree every counted word, whatever the count is called', () => {
    const loose: string[] = [];
    const names = COUNTS.join('|');
    for (const lang of LANGS) {
      for (const { key, text } of table(lang)) {
        for (const m of text.matchAll(new RegExp(`\\{(${names})\\}[\\s\\u00a0\\u202f]+([^\\s\\u00a0\\u202f[{<]+)`, 'g'))) {
          if (new RegExp(`\\[${m[1]}\\|`).test(text)) continue;
          const word = m[2].replace(/[.,:;!?)\u2026"\u2019\u00bb]+$/u, '');
          if (!/\p{L}/u.test(word)) continue;
          if (BARE[lang].includes(word)) continue;
          loose.push(`${lang}:${key} → "{${m[1]}} ${word}"`);
        }
      }
    }
    expect(loose).toEqual([]);
  });

  it('write a tile’s level one way per tongue', () => {
    /* en L2 · fr N2 · es N2 · de Stufe 2 — the word in full only in a sentence or a heading */
    const stray: Record<Lang, RegExp> = {
      en: /\blvl\b|\bLvl\b|\bN\{level\}/,
      fr: /\bL\{|\bniv\.|\bNiv\b|\bS\{/,
      es: /\bL\{|\bniv\.|\bNiv\b|\bS\{/,
      de: /\bSt\.\s|\bS\{|\bL\{|\bN\{/,
    };
    const off: string[] = [];
    for (const lang of LANGS) {
      for (const { key, text } of table(lang)) {
        /* a placeholder's own name ({lvl}) is not a word on the page */
        if (stray[lang].test(text.replace(/\{(?!level\})\w+\}/g, '{}'))) off.push(`${lang}:${key} → ${text.slice(0, 60)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('give a gesture the same name on the bar and in the ledger', () => {
    const verbs = ['Build', 'Network', 'Develop', 'Sell', 'Loan', 'Scout', 'Pass'] as const;
    for (const lang of LANGS) {
      const hand = DICTS[lang].game.hand as unknown as Record<string, string>;
      const ledger = DICTS[lang].game.ledger as unknown as Record<string, string>;
      for (const v of verbs) expect(`${lang}:${v} ${ledger[`verb${v}`]}`).toBe(`${lang}:${v} ${hand[`verb${v}`].toLocaleUpperCase(lang)}`);
    }
  });

  it('name every industry on its own, in every tongue', () => {
    for (const lang of LANGS) {
      const named = DICTS[lang].game.industry as Record<string, string>;
      expect(Object.keys(named).sort()).toEqual(['brewery', 'coal', 'cotton', 'iron', 'manufacturer', 'pottery']);
      for (const v of Object.values(named)) expect(v.length).toBeGreaterThan(2);
    }
    expect(fr.game.industry.cotton).toBe('Filature');
  });

  it('set French with its own spaces and apostrophes', () => {
    const off: string[] = [];
    for (const { key, text } of table('fr')) {
      if (/\p{L}'\p{L}/u.test(text)) off.push(`${key}: straight apostrophe`);
      if (/[^\u00a0\d}]:(?!\/\/)|\d:(?!\d)/u.test(text.replace(/\{[^}]*\}/g, 'x'))) off.push(`${key}: “:” without its unbreakable space`);
      if (/[^\u202f!?][;!?]/u.test(text)) off.push(`${key}: “; ! ?” without the thin space`);
      if (/«(?!\u202f)|(?<!\u202f)»/u.test(text)) off.push(`${key}: guillemets without the thin space`);
      if (/£[{\d]/.test(text)) off.push(`${key}: pound sign before its figure`);
    }
    expect(off).toEqual([]);
  });

  /* every refusal the engine can give by name reaches the player in the
     player's tongue: read straight from the rulebook's source */
  it('translate every refusal the engine can give', () => {
    const src = ['../../game/actions.ts', '../../game/engine.ts'].map((p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')).join('\n');
    const said = new Set<string>();
    for (const m of src.matchAll(/(?:fail\(|reason:\s*|return\s+)'((?:[^'\\\n]|\\.)+)'/g)) {
      const text = m[1].replace(/\\'/g, "'");
      if (/^[A-Z][a-z]/.test(text) && text.includes(' ')) said.add(text);
    }
    expect(said.size).toBeGreaterThan(15);
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      setLang(lang);
      const english = [...said].filter((text) => reasonText(text) === text);
      expect(`${lang}: ${english.join(' | ')}`).toBe(`${lang}: `);
    }
  });

  it('say a coded refusal as a sentence, and an unknown one plainly', () => {
    setLang('fr');
    expect(reasonText('card-not-in-hand')).toBe('Cette carte n’est plus dans votre main — la table a avancé');
    expect(reasonText('out-of-step')).toMatch(/^La table/);
    for (const lang of LANGS) {
      const reasons = DICTS[lang].game.reasons as unknown as Record<string, string>;
      for (const code of ['card-not-in-hand', 'out-of-step', 'unknown']) expect(`${lang}:${code}:${reasons[code]?.length > 10}`).toBe(`${lang}:${code}:true`);
    }
  });
});
