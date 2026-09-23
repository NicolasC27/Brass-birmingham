import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts — the single-key actions a player may rebind     */
/* from the settings panel. One tiny store (localStorage-backed), the  */
/* same shape as boardOptions, read by every key handler through       */
/* isKey(e, action). Digits, Enter, Escape, the arrows and the zoom    */
/* keys stay fixed: they mirror the hand and the camera, not a panel.  */
/* ------------------------------------------------------------------ */

export type KeyAction = 'undo' | 'replay' | 'fullscreen' | 'links' | 'market' | 'ledger' | 'mat' | 'matWide' | 'matStyle' | 'settings' | 'hand' | 'rules' | 'fit' | 'focus' | 'survey' | 'lastMove' | 'vpTrack';
export const KEY_ACTIONS: KeyAction[] = ['undo', 'replay', 'mat', 'matWide', 'matStyle', 'settings', 'market', 'ledger', 'vpTrack', 'hand', 'links', 'focus', 'survey', 'lastMove', 'fullscreen', 'rules', 'fit'];

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
};

const KEY = 'brassworks.keys.v1';

/** the key a KeyboardEvent carries, normalised (letters lower-case) */
export const eventKey = (e: KeyboardEvent): string => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

/** keys that cannot be bound: they already drive the hand or the camera */
export const RESERVED_KEYS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '+', '=', '-', '_', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Tab']);

let state: Record<KeyAction, string> = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<KeyAction, string>>;
      return { ...DEFAULT_KEYS, ...parsed };
    }
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
