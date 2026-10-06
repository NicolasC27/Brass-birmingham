import type { FinalPayload } from './types';

/* ------------------------------------------------------------------ */
/* The ledger of the game just closed, handed from the board to the    */
/* pages that read it: the ceremony, the replay and the review.        */
/*                                                                     */
/* It is nothing but a projection of a game the office holds, so it is */
/* not written down anywhere — it lives as long as the visit that made */
/* it. Come back to /results with the page reloaded and there is none,  */
/* which is the truth: the record of that game is at the desk.         */
/* ------------------------------------------------------------------ */

let held: FinalPayload | null = null;

/** the game just closed, for the pages that follow the board */
export const keepFinal = (payload: FinalPayload): void => {
  held = payload;
};

/** the ledger the board left, if this visit made one */
export const heldFinal = (): FinalPayload | null => held;
