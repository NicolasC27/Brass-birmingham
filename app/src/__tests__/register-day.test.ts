import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* the day register is printed twice: once for the screen and once for the
   paper edition. They must read the same, declaration for declaration — a
   value corrected in one and forgotten in the other is the whole point of
   this test. */

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
    .split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .filter((d) => d.startsWith('--'));
}

/* the screen's day register, and the one the printer works from */
const screen = customProps(body('html[data-theme="light"] .platform-root {'));
const paper = customProps(body('@media print {\n  .platform-root {'));

describe('the day register', () => {
  it('declares the tokens the day depends on', () => {
    expect(screen.length).toBeGreaterThan(20);
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
      expect(screen.some((d) => d.startsWith(`${token}:`)), `missing ${token}`).toBe(true);
    }
  });

  it('reads the same on the screen and on the paper edition', () => {
    expect(paper).toEqual(screen);
  });
});
