import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* the day register is written once. The screen reads it by default, the
   paper edition reads it whatever the screen shows, and the night is laid
   over it for the screen only. A second copy for the printer — where a
   value corrected in one and forgotten in the other went unseen — is what
   these tests keep out. */

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

/** the body of the rule opening at `head`, up to its matching brace */
function body(head: string): string {
  const at = css.indexOf(head);
  expect(at, `rule not found: ${head}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at + head.length - 1; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(at + head.length, i);
    }
  }
  throw new Error(`unclosed rule: ${head}`);
}

/** every custom property of a rule body, in order, comments stripped */
function customProps(rule: string): string[] {
  return rule
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/[;{}]/)
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .filter((d) => d.startsWith('--'));
}

const names = (decls: string[]) => decls.map((d) => d.slice(0, d.indexOf(':')));

/* the default register, the night laid over it, and the paper edition */
const day = customProps(body('.platform-root {\n  /* corners'));
const night = customProps(body('@media screen {'));
const paper = customProps(body('@media print {'));

describe('the day register', () => {
  it('declares the tokens the day depends on', () => {
    expect(day.length).toBeGreaterThan(20);
    for (const token of [
      '--iron-400',
      '--iron-600',
      '--brass-300',
      '--brass-400',
      '--brass-500',
      '--brass-plate',
      '--brass-plate-hover',
      '--signal-400',
      '--signal-ink',
      '--focus-ring',
      '--enamel-700',
      '--state-off-bg',
      '--state-off-ink',
    ]) {
      expect(day.some((d) => d.startsWith(`${token}:`)), `missing ${token}`).toBe(true);
    }
  });

  it('is not copied into the paper edition', () => {
    expect(paper).toEqual([]);
  });

  it('is overlaid token for token by the night, which is kept to the screen', () => {
    const shared = ['--radius', '--ink-on-brass', '--ink-on-signal'];
    const overlaid = new Set(names(night));
    for (const token of names(day)) {
      if (shared.includes(token)) continue;
      expect(overlaid.has(token), `the night leaves ${token} to the day`).toBe(true);
    }
    expect(css).toMatch(/@media screen \{\s*html\[data-theme="dark"\] \.platform-root,\s*\.platform-root \[data-theme="dark"\] \{/);
  });
});
