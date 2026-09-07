import type { Card, GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* What a seat is allowed to see.                                      */
/*                                                                     */
/* The server holds the whole truth — the seed, the deck in order, the */
/* four hands. A client gets a state with the same shape, so the board */
/* and the mats paint it unchanged, but the hands that are not its own */
/* and the deck are replaced by cards of the right count and no face,  */
/* and the seed goes with them (it is the deck, one shuffle away).     */
/* The discard pile stays: it lies face up on a real table.            */
/* ------------------------------------------------------------------ */

const faceDown = (n: number, tag: string): Card[] => Array.from({ length: n }, (_, i) => ({ id: `hidden:${tag}:${i}`, kind: 'wild-industry' as const }));

/** the state as `seat` may see it (-1 = a spectator: every hand is shut) */
export function viewFor(s: GameState, seat: number): GameState {
  const v = structuredClone(s);
  v.seed = 0;
  v.deck = faceDown(v.deck.length, 'deck');
  v.players.forEach((p, i) => {
    if (i !== seat) p.hand = faceDown(p.hand.length, `hand${i}`);
  });
  return v;
}
