import { describe, expect, it } from 'vitest';
import { onControl, typing } from '../keybindings';

/* a key event as the table sees it: only its target matters here */
const on = (target: unknown) => ({ target }) as unknown as KeyboardEvent;
const el = (tagName: string, over: Record<string, unknown> = {}) => ({ tagName, isContentEditable: false, closest: () => null, ...over });

describe('the keyboard knows where it is', () => {
  it('leaves a field its letters', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(typing(on(el(tag)))).toBe(true);
    expect(typing(on(el('DIV', { isContentEditable: true })))).toBe(true);
    expect(typing(on(el('DIV')))).toBe(false);
    expect(typing(on(null))).toBe(false);
  });

  it('leaves Enter to the control it lands on', () => {
    const button = el('BUTTON', { closest: (q: string) => (q.includes('button') ? {} : null) });
    expect(onControl(on(button))).toBe(true);
    expect(onControl(on(el('DIV')))).toBe(false);
  });
});
