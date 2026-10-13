import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTION_IDS, CHAPTER_IDS, passageFor } from '../refusalRules';
import { getActions, getChapters } from '@/components/rules/rulesData';
import game from '@/i18n/en/game';
import board from '@/i18n/en/board';

/* every refusal the engine can print as a plain literal */
function engineLiterals(): string[] {
  const out = new Set<string>();
  for (const f of ['engine.ts', 'actions.ts']) {
    const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
    for (const m of src.matchAll(/fail\(\s*(['"])((?:(?!\1).)+)\1/g)) out.add(m[2]);
    for (const m of src.matchAll(/reason:\s*(['"])((?:(?!\1).)+)\1/g)) out.add(m[2]);
  }
  return [...out];
}

const codes = [
  ...Object.keys(game.reasons),
  ...Object.keys((board.refusal as { plain?: Record<string, string> }).plain ?? {}),
  ...engineLiterals(),
];

describe('refusal → rule', () => {
  it('knows many refusals', () => {
    expect(codes.length).toBeGreaterThan(20);
  });

  it('gives every known refusal a passage that exists in the codex', () => {
    const chapters = new Set(getChapters().map((c) => c.id));
    const actions = new Set(getActions().map((a) => a.id));
    for (const c of CHAPTER_IDS) expect(chapters.has(c), c).toBe(true);
    for (const a of ACTION_IDS) expect(actions.has(a), a).toBe(true);
    for (const code of codes) {
      const p = passageFor(code);
      expect(chapters.has(p.chapter), code).toBe(true);
      if (p.action) expect(actions.has(p.action), code).toBe(true);
    }
  });

  it('cites, and follows the action being tried', () => {
    expect(passageFor('No connected coal — reach a mine or a merchant')).toEqual({ chapter: 'supply', action: 'build' });
    expect(passageFor('Needs £12 — you hold £0', 'build')).toEqual({ chapter: 'money', action: 'build' });
    expect(passageFor('out-of-step: the log stands at 12')).toEqual({ chapter: 'quickstart', action: null });
  });
});
