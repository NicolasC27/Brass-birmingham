import { describe, expect, it } from 'vitest';
import { LANGS } from '../index';
import type { Lang } from '../index';
import { de } from '../de';
import { en } from '../en';
import { es } from '../es';
import { fr } from '../fr';

/* ------------------------------------------------------------------ */
/* the four sheets say the same things: every key one tongue holds    */
/* the others hold too, and each sentence is handed the same figures  */
/* and names in every tongue. The types catch a key missing where a   */
/* sheet is typed to the letter; a record typed loosely, or a {name}  */
/* spelt another way, only a reading catches — this one.              */
/* ------------------------------------------------------------------ */

const DICTS = { en, fr, es, de } as const;

/** every string of a dictionary, by its dotted key */
function strings(node: unknown, path: string[] = [], out = new Map<string, string>()): Map<string, string> {
  if (typeof node === 'string') out.set(path.join('.'), node);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node as Record<string, unknown>)) strings(v, [...path, k], out);
  return out;
}

/** the {placeholders} a sentence is filled with, a count named only in
 *  its [n|one|many] agreement included */
const holes = (text: string): string[] => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe('the four sheets', () => {
  const sheets = Object.fromEntries(LANGS.map((l) => [l, strings(DICTS[l])])) as Record<Lang, Map<string, string>>;

  it('hold the same keys', () => {
    const all = new Set(LANGS.flatMap((l) => [...sheets[l].keys()]));
    const missing: string[] = [];
    for (const key of all) for (const l of LANGS) if (!sheets[l].has(key)) missing.push(`${l} lacks ${key}`);
    expect(missing).toEqual([]);
  });

  it('fill each sentence with the same placeholders', () => {
    const off: string[] = [];
    for (const [key, text] of sheets.en) {
      const want = holes(text).join(' ');
      for (const l of LANGS) {
        const other = sheets[l].get(key);
        if (other === undefined) continue;
        const got = holes(other).join(' ');
        if (got !== want) off.push(`${l}:${key} has {${got}}, en has {${want}}`);
      }
    }
    expect(off).toEqual([]);
  });
});
