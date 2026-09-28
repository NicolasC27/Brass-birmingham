import { applyAction, setupOf } from './actions';
import { newGame } from './engine';
import type { GameAction } from './actions';
import type { GameState, SetupPayload } from './types';

/* ------------------------------------------------------------------ */
/* A game carried in a link — the deal and the moves, nothing else: the */
/* engine plays them again on arrival and the table stands as it did.  */
/* Small enough for a URL fragment, so nothing leaves the browser.     */
/* ------------------------------------------------------------------ */

interface Carried {
  v: 1;
  seed: number;
  setup: SetupPayload;
  actions: GameAction[];
}

const MARK = '#g=';

const toBase64Url = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string): string => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** the fragment that carries this game: append it to a local game's address.
    `at` names a move, and the reader arrives with the analysis open there —
    a moment pointed at rather than a whole game handed over */
export function shareFragment(g: GameState, at?: number): string {
  const carried: Carried = { v: 1, seed: g.seed, setup: setupOf(g), actions: g.actions };
  return MARK + toBase64Url(JSON.stringify(carried)) + (at !== undefined ? `&at=${at}` : '');
}

/** the move a fragment points at, if it points at one */
export function sharedMoment(hash: string): number | null {
  const m = /[&?]at=(\d+)/.exec(hash);
  return m ? Number(m[1]) : null;
}

/** the game a fragment carries, played again from its deal; nothing if the fragment is not one of ours or a move refuses */
export function readShared(hash: string): GameState | null {
  if (!hash.startsWith(MARK)) return null;
  try {
    const c = JSON.parse(fromBase64Url(hash.slice(MARK.length).split('&')[0])) as Carried;
    if (c.v !== 1 || !c.setup || !Array.isArray(c.actions)) return null;
    let s = newGame(c.setup, c.seed);
    for (const a of c.actions) {
      const r = applyAction(s, s.current, a);
      const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
      if (!next) return null;
      s = next;
    }
    return s;
  } catch {
    return null;
  }
}
