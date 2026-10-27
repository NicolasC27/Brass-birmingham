import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, KEY_ACTIONS, RESERVED_KEYS, getKeybindings, isKey, onControl, reconcileKeys, resetKeybindings, setKeybinding, typing } from '../keybindings';

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

/* a key pressed on the table, with no modifier unless asked */
const press = (key: string, over: Partial<KeyboardEvent> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, ...over }) as unknown as KeyboardEvent;

describe('the table’s shortcuts', () => {
  afterEach(() => resetKeybindings());

  it('gives every action a key of its own, none of them reserved', () => {
    expect(new Set(KEY_ACTIONS).size).toBe(Object.keys(DEFAULT_KEYS).length);
    const keys = KEY_ACTIONS.map((a) => DEFAULT_KEYS[a]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(RESERVED_KEYS.has(k)).toBe(false);
  });

  it('opens the mat on P, and leaves Q to the analysis', () => {
    expect(isKey(press('p'), 'mat')).toBe(true);
    expect(isKey(press('P', { shiftKey: true }), 'mat')).toBe(true);
    expect(isKey(press('p', { ctrlKey: true }), 'mat')).toBe(false);
    expect(isKey(press('q'), 'mat')).toBe(false);
    expect(isKey(press('q'), 'analysis')).toBe(true);
  });

  it('keeps a mat moved to Q on Q: the analysis takes the P it gave up', () => {
    setKeybinding('mat', 'q');
    expect(isKey(press('q'), 'mat')).toBe(true);
    expect(isKey(press('q'), 'analysis')).toBe(false);
    expect(getKeybindings().analysis).toBe('p');
  });

  it('answers ? to shift and slash', () => {
    expect(isKey(press('/', { shiftKey: true }), 'rules')).toBe(true);
  });

  it('folds the guide on G, or on the key the player gave it', () => {
    expect(isKey(press('g'), 'guide')).toBe(true);
    expect(isKey(press('g', { ctrlKey: true }), 'guide')).toBe(false);
    /* moved to J: G no longer folds it, and nothing else takes J */
    setKeybinding('guide', 'j');
    expect(isKey(press('j'), 'guide')).toBe(true);
    expect(isKey(press('g'), 'guide')).toBe(false);
    /* moved onto the ledger's L: the ledger takes the J the guide gave up */
    setKeybinding('guide', 'l');
    expect(getKeybindings().ledger).toBe('j');
  });
});

describe('keys kept from an older table', () => {
  it('lets the player’s choice stand over an action added since', () => {
    /* stored before the analysis had a key: the mat had been moved to Q */
    const { analysis: _gone, ...before } = { ...DEFAULT_KEYS, mat: 'q' };
    void _gone;
    const keys = reconcileKeys(before);
    expect(keys.mat).toBe('q');
    expect(keys.analysis).toBe('p');
  });

  it('gives the guide its G when a table from before it had none', () => {
    const { guide: _gone, ...before } = DEFAULT_KEYS;
    void _gone;
    expect(reconcileKeys(before).guide).toBe('g');
  });

  it('parts two actions stored on one key, the first in the list keeping it', () => {
    const keys = reconcileKeys({ ...DEFAULT_KEYS, mat: 'q', analysis: 'q' });
    expect(keys.mat).toBe('q');
    expect(keys.analysis).toBe('p');
  });

  it('falls back to a free letter when the exchange is taken too', () => {
    const keys = reconcileKeys({ ...DEFAULT_KEYS, mat: 'q', analysis: 'q', undo: 'p' });
    const all = KEY_ACTIONS.map((a) => keys[a]);
    expect(new Set(all).size).toBe(all.length);
    expect(keys.mat).toBe('q');
    expect(keys.undo).toBe('p');
    expect(keys.analysis).toMatch(/^[a-z]$/);
  });

  it('drops what cannot be a key and reads nonsense as the defaults', () => {
    expect(reconcileKeys({ ...DEFAULT_KEYS, mat: '1' }).mat).toBe('p');
    expect(reconcileKeys({ ...DEFAULT_KEYS, mat: 42 }).mat).toBe('p');
    expect(reconcileKeys(null)).toEqual(DEFAULT_KEYS);
  });
});
