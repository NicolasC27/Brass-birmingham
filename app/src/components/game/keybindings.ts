import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts — the single-key actions a player may rebind     */
/* from the settings panel. One tiny store (localStorage-backed), the  */
/* same shape as boardOptions, read by every key handler through       */
/* isKey(e, action). Digits, Enter, Escape, the arrows and the zoom    */
/* keys stay fixed: they mirror the hand and the camera, not a panel.  */
/* ------------------------------------------------------------------ */

export type KeyAction = 'undo' | 'replay' | 'fullscreen' | 'links' | 'market' | 'ledger' | 'mat' | 'matWide' | 'matStyle' | 'settings' | 'hand' | 'rules' | 'fit' | 'focus' | 'survey' | 'lastMove' | 'vpTrack' | 'analysis' | 'photo' | 'guide';
export const KEY_ACTIONS: KeyAction[] = ['undo', 'replay', 'mat', 'matWide', 'matStyle', 'settings', 'market', 'ledger', 'vpTrack', 'hand', 'links', 'focus', 'survey', 'lastMove', 'guide', 'analysis', 'fullscreen', 'photo', 'rules', 'fit'];

export const DEFAULT_KEYS: Record<KeyAction, string> = {
  undo: 'z',
  replay: 'r',
  fullscreen: 'f',
  links: 'c',
  market: 'm',
  ledger: 'l',
  mat: 'p',
  matWide: 'w',
  matStyle: 't',
  settings: 's',
  hand: 'h',
  rules: '?',
  fit: '0',
  focus: 'v',
  survey: 'o',
  lastMove: 'd',
  vpTrack: 'b',
  /* the analysis, once the game is played out */
  analysis: 'q',
  /* the photo mode: the table without its HUD, to be printed */
  photo: 'i',
  /* the guide's lane folded to its rail, and back */
  guide: 'g',
};

const KEY = 'brassworks.keys.v1';

/** the key a KeyboardEvent carries, normalised (letters lower-case) */
export const eventKey = (e: KeyboardEvent): string => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

/** keys that cannot be bound: they already drive the hand or the camera */
export const RESERVED_KEYS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '+', '=', '-', '_', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Tab']);

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * A stored set of keys made whole against today's actions. The player's
 * own choices stand; an action added since (or one that came back sharing
 * a key) takes its default when it is free, else the default the holder of
 * its key gave up — the same exchange a rebinding makes — else the first
 * free letter. Two actions never answer to one key: a mat moved to Q stays
 * on Q when the analysis arrives with Q for its default.
 */
export function reconcileKeys(stored: Partial<Record<string, unknown>> | null | undefined): Record<KeyAction, string> {
  const out: Partial<Record<KeyAction, string>> = {};
  const taken = new Set<string>();
  const src = stored && typeof stored === 'object' ? stored : {};
  for (const a of KEY_ACTIONS) {
    const k = src[a];
    if (typeof k !== 'string' || !k || RESERVED_KEYS.has(k) || taken.has(k)) continue;
    out[a] = k;
    taken.add(k);
  }
  for (const a of KEY_ACTIONS) {
    if (out[a] !== undefined) continue;
    const mine = DEFAULT_KEYS[a];
    const holder = KEY_ACTIONS.find((b) => out[b] === mine);
    const traded = holder ? DEFAULT_KEYS[holder] : undefined;
    const k = !taken.has(mine) ? mine : traded && !taken.has(traded) ? traded : [...LETTERS].find((l) => !taken.has(l)) ?? mine;
    out[a] = k;
    taken.add(k);
  }
  return out as Record<KeyAction, string>;
}

let state: Record<KeyAction, string> = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return reconcileKeys(JSON.parse(raw) as Partial<Record<string, unknown>>);
  } catch {
    /* private mode / malformed */
  }
  return { ...DEFAULT_KEYS };
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
};

export const getKeybindings = (): Record<KeyAction, string> => state;

/** bind `key` to `action`; an action that already had this key takes the
 *  freed one in exchange, so every action always keeps a key */
export function setKeybinding(action: KeyAction, key: string): void {
  const k = key.length === 1 ? key.toLowerCase() : key;
  const prev = state[action];
  const other = (Object.keys(state) as KeyAction[]).find((a) => a !== action && state[a] === k);
  state = { ...state, [action]: k, ...(other ? { [other]: prev } : {}) };
  persist();
  emit();
}

export function resetKeybindings(): void {
  state = { ...DEFAULT_KEYS };
  persist();
  emit();
}

export function useKeybindings(): Record<KeyAction, string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

/** does this key event trigger `action`? ('?' also answers to shift+/ ) */
export function isKey(e: KeyboardEvent, action: KeyAction): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const bound = state[action];
  if (bound === '?' && e.shiftKey && e.key === '/') return true;
  return eventKey(e) === bound;
}

/** how a key is printed on a keycap */
export const keyLabel = (k: string): string => (k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k);

/** the reader is writing somewhere: a field keeps its letters, and no
 *  shortcut of the table may take them */
export function typing(e: KeyboardEvent): boolean {
  const on = e.target as HTMLElement | null;
  if (!on || typeof on.tagName !== 'string') return false;
  return on.tagName === 'INPUT' || on.tagName === 'TEXTAREA' || on.tagName === 'SELECT' || on.isContentEditable === true;
}

/** the key lands on a control of its own (a button, a tab, a link): Enter
 *  and Space belong to that control, not to the move in hand */
export function onControl(e: KeyboardEvent): boolean {
  const on = e.target as HTMLElement | null;
  return !!on && typeof on.closest === 'function' && on.closest('button, [role="button"], [role="tab"], [role="menuitem"], a[href], summary') !== null;
}
