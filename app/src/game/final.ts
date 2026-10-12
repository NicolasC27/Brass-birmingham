import { setupOf } from './actions';
import { SETUP_KEY } from './types';
import type { FinalPayload, GameState } from './types';

/* ------------------------------------------------------------------ */
/* The ledger of the game just closed, handed from the board to the    */
/* pages that read it: the ceremony, the replay and the review.        */
/*                                                                     */
/* It is nothing but a projection of a game the office holds, so it is */
/* not written down anywhere — it lives as long as the visit that made */
/* it. A page reloaded finds the game again by the table its address   */
/* names, and projects it afresh.                                      */
/* ------------------------------------------------------------------ */

let held: FinalPayload | null = null;

/** the game just closed, for the pages that follow the board */
export const keepFinal = (payload: FinalPayload): void => {
  held = payload;
};

/** the ledger the board left, if this visit made one */
export const heldFinal = (): FinalPayload | null => held;

/** the table just played, written as the salon's own: a rematch is dealt
 *  for it, and the salon opens set with it. The next deal takes today's
 *  rules, whatever edition this one was dealt under. */
export const keepTableOf = (game: GameState): void => {
  try {
    const setup = setupOf(game);
    const options = { ...setup.options };
    delete options.rules;
    localStorage.setItem(SETUP_KEY, JSON.stringify({ ...setup, options }));
  } catch {
    /* no storage: the salon falls back on its own last table */
  }
};
