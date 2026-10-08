/* ------------------------------------------------------------------ */
/* One grammar of state for the moves that pick on the board — build,   */
/* network, sell — so that "this one could be taken" and "this one is   */
/* taken" read the same way whatever the verb:                          */
/*   - a candidate wears the state ink, faint, with a soft halo;        */
/*   - the one picked wears the same ink pale and full, ringed in light;*/
/*   - the one under the pointer gets a thin cream edge of its own.     */
/* The state inks keep off the seats' hues: a brass ring on a brass     */
/* seat's tile would say "mine" and "pick me" in the same breath, so    */
/* the brass stays the seat's and the jeton's, never a state.           */
/* Plain numbers, for the WebGL board and for any DOM that shows the    */
/* same states.                                                         */
/* ------------------------------------------------------------------ */

export interface StateInk {
  /** the ink (0xRRGGBB) */
  color: number;
  /** the halo drawn under the mark, and its fill */
  halo: number;
  fill: number;
  /** the mark's own stroke width, in world units */
  width: number;
}

/** could be taken: the state ink, faint */
export const CANDIDATE: StateInk = { color: 0x7fe08f, halo: 0.22, fill: 0.1, width: 4 };

/** taken: the same ink, pale and full, a notch wider */
export const PICKED: StateInk = { color: 0xc4ffcc, halo: 0.35, fill: 0.16, width: 5 };

/** under the pointer: a thin cream edge, on top of whichever state */
export const HOVERED = { color: 0xf4ecd8, alpha: 0.9, width: 1.5 } as const;

/** the ink of a mark in the grammar: picked, or merely possible */
export function stateInk(picked: boolean): StateInk {
  return picked ? PICKED : CANDIDATE;
}
