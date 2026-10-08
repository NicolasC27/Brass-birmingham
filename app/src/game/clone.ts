/* ------------------------------------------------------------------ */
/* A copy of the table, made quickly.                                  */
/*                                                                     */
/* Every move a machine considers is played on a copy, and the copy    */
/* was made by `structuredClone`, which walks the whole state field by */
/* field — the deck, every hand, every ledger line — and rebuilds it.  */
/* Measured on a mid-game position it took 298 µs, nearly nine tenths  */
/* of the cost of trying a move at all. A turn tries five hundred      */
/* pairs, so the machines spent most of their thinking time copying.   */
/*                                                                     */
/* This one copies only what can change. Cards are written once at     */
/* setup and never touched again, so the arrays holding them are cut   */
/* rather than rebuilt and the cards themselves are shared; the same   */
/* goes for the merchant tiles, which are plain words. Everything a    */
/* move can reach into and change — a seat, a tile, a link, the market */
/* — is made afresh.                                                   */
/*                                                                     */
/* `src/game/__tests__/clone.test.ts` holds it honest: over real games */
/* the copy must equal what `structuredClone` would have made, and     */
/* nothing written on the copy may ever show through on the original.  */
/* ------------------------------------------------------------------ */

import { INDUSTRIES_IN_ORDER } from './data';
import type { Card, GameState, IndustryType, LinkState, PlayerState, TileState } from './types';

/** cards are written at setup and never altered: the array is cut, the
 *  cards within it are shared */
const cards = (a: Card[]): Card[] => a.slice();

function clonePlayer(p: PlayerState): PlayerState {
  const stacks = {} as Record<IndustryType, number[]>;
  for (const ind of INDUSTRIES_IN_ORDER) stacks[ind] = p.stacks[ind].slice();
  return {
    ...p,
    hand: cards(p.hand),
    stacks,
    stats: { ...p.stats },
    incomeHistory: p.incomeHistory.slice(),
  };
}

function cloneTiles(t: Record<string, TileState>): Record<string, TileState> {
  const out: Record<string, TileState> = {};
  for (const k in t) out[k] = { ...t[k] };
  return out;
}

function cloneLinks(l: Record<string, LinkState>): Record<string, LinkState> {
  const out: Record<string, LinkState> = {};
  for (const k in l) out[k] = { ...l[k] };
  return out;
}

function cloneMerchantTiles(m: GameState['merchantTiles']): GameState['merchantTiles'] {
  const out: GameState['merchantTiles'] = {};
  for (const k in m) out[k] = m[k].slice();
  return out;
}

/** a field of the table as the copy takes it: `'kept'` for a word or a
 *  number, which the copy may share, or the function that makes it afresh */
type Take<T> = 'kept' | ((v: NonNullable<T>) => NonNullable<T>);

/** every field of the table, and how a copy takes it. This is the one list:
 *  a field added to `GameState` does not compile until it is written here,
 *  and `clone.test.ts` checks over real games that no field holding an
 *  object is left `'kept'` */
export const TAKE: { [K in keyof Required<GameState>]: Take<GameState[K]> } = {
  version: 'kept',
  seed: 'kept',
  era: 'kept',
  round: 'kept',
  eraLength: 'kept',
  marketTemper: 'kept',
  fidelity: 'kept',
  timerMinutes: 'kept',
  assist: 'kept',
  board: 'kept',
  rules: 'kept',
  players: (v) => v.map(clonePlayer),
  order: (v) => v.slice(),
  turnPos: 'kept',
  current: 'kept',
  actionsLeft: 'kept',
  tiles: cloneTiles,
  links: cloneLinks,
  market: (v) => ({ ...v }),
  deck: cards,
  discard: cards,
  wildLeft: (v) => ({ ...v }),
  merchantTiles: cloneMerchantTiles,
  merchantBeer: (v) => ({ ...v }),
  merchantBonusTaken: (v) => ({ ...v }),
  /* the lines of the ledger are written once and never changed: the list
     is cut, the lines shared */
  ledger: (v) => v.slice(),
  ledgerSeq: 'kept',
  phase: 'kept',
  fxSeq: 'kept',
  lastFx: (v) => ({ ...v, at: [v.at[0], v.at[1]] }),
  canalScores: (v) => v.slice(),
  canalSplit: (v) => v.map((x) => ({ ...x })),
  finalScores: (v) => v.slice(),
  finalSplit: (v) => v.map((x) => ({ ...x })),
  winner: 'kept',
  concessions: (v) => v.slice(),
  abandoned: 'kept',
  history: (v) => v.map((h) => structuredClone(h)),
  lastSpent: (v) => v.slice(),
  /* an action is a word of the log, never rewritten */
  actions: (v) => v.slice(),
};

/** the fields a copy makes afresh, read once off the list above */
const FRESH = (Object.keys(TAKE) as (keyof GameState)[]).filter((k) => TAKE[k] !== 'kept');

/** the table as it stands, ready to be played on without touching the original */
export function cloneState(s: GameState): GameState {
  const out = { ...s } as Record<keyof GameState, unknown>;
  for (const k of FRESH) {
    const v = s[k];
    if (v !== undefined && v !== null) out[k] = (TAKE[k] as (x: unknown) => unknown)(v);
  }
  return out as GameState;
}
