import type { GameState } from './types';
import { actionsFor, projectedOrder } from './engine';

/* ------------------------------------------------------------------ */
/* The rounds — whether the one under way is the game's last, and     */
/* where a seat stands at the next. Pure game logic: the fan, the     */
/* notices and the office's test bench all read it, and none of them  */
/* should drag the browser in with it.                                 */
/* ------------------------------------------------------------------ */

/** the round under way is the game's last: the draw pile is out, and no
 *  hand will hold a card once every seat has played its turn — those who
 *  have played keep what they hold, the seat at the table lays its actions
 *  left, the seats still to come two cards each (a scout leaves hands
 *  uneven, so the count is taken seat by seat). The canal's last round
 *  still leads into the rail's first, where the order holds. */
export function lastRound(game: GameState): boolean {
  if (game.deck.length > 0) return false;
  if (game.era !== 'rail' && game.eraLength !== 'short') return false;
  return game.order.every((seat, at) => {
    const held = game.players[seat].hand.length;
    if (at < game.turnPos) return held === 0;
    if (at === game.turnPos) return held <= game.actionsLeft;
    return held <= actionsFor(game, game.players[seat]);
  });
}

/** the seat's place at the next round, counted from one: the engine's own
 *  order (least spent first, a tie keeping today's order). Null when there
 *  is no next round to take a place at. */
export function nextTurnPlace(game: GameState, seat: number): number | null {
  if (game.phase !== 'action' || lastRound(game)) return null;
  const at = projectedOrder(game).indexOf(seat);
  return at < 0 ? null : at + 1;
}
