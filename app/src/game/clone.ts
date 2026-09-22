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

import type { Card, GameState, IndustryType, LinkState, PlayerState, TileState } from './types';

const INDUSTRIES_IN_ORDER: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];

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

/** the table as it stands, ready to be played on without touching the original */
export function cloneState(s: GameState): GameState {
  const out: GameState = {
    ...s,
    players: s.players.map(clonePlayer),
    order: s.order.slice(),
    tiles: cloneTiles(s.tiles),
    links: cloneLinks(s.links),
    market: { ...s.market },
    deck: cards(s.deck),
    discard: cards(s.discard),
    wildLeft: { ...s.wildLeft },
    merchantTiles: cloneMerchantTiles(s.merchantTiles),
    merchantBeer: { ...s.merchantBeer },
    merchantBonusTaken: { ...s.merchantBonusTaken },
    ledger: s.ledger.slice(),
    history: s.history.map((h) => structuredClone(h)),
    actions: s.actions.slice(),
  };
  if (s.lastFx) out.lastFx = { ...s.lastFx, at: [s.lastFx.at[0], s.lastFx.at[1]] };
  if (s.canalScores) out.canalScores = s.canalScores.slice();
  if (s.finalScores) out.finalScores = s.finalScores.slice();
  if (s.concessions) out.concessions = s.concessions.slice();
  if (s.lastSpent) out.lastSpent = s.lastSpent.slice();
  return out;
}
