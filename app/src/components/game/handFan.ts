/* ------------------------------------------------------------------ */
/* The fan's measure: how wide the cards of the hand are, and how far  */
/* they overlap, read from the room the dock is given.                 */
/* ------------------------------------------------------------------ */

/* A card is never narrower than CARD_MIN nor wider than CARD_MAX; between
   the two it takes its share of the room the fan is given. Only when even
   the narrowest cards will not sit side by side do they overlap, and then
   by exactly what the room lacks — never by a fixed step. */
export const CARD_MIN = 84;
export const CARD_MAX = 100;
export const CARD_H = 120;
/* the least of a covered card that stays in view: its liseré and the
   start of its name */
export const CARD_PEEK = 40;
/* the dock's fixed parts, left of the fan: padding, deck plate, verb grid,
   and the gaps between them; the hints column right of it when shown */
export const DOCK_FIXED = 32 + 64 + 216 + 3 * 12 + 8;
export const HINTS_W = 190 + 12;
/* the dock's open height: the strip and the body */
export const DOCK_OPEN_H = 180;

export interface FanMeasure {
  /** each card's width */
  card: number;
  /** the margin laid before every card but the first (≤ 0: overlap) */
  step: number;
}

/** the cards' width and overlap for `n` cards in `room` px */
export function fanMeasure(n: number, room: number): FanMeasure {
  if (n <= 0) return { card: CARD_MIN, step: 0 };
  const card = Math.max(CARD_MIN, Math.min(CARD_MAX, Math.floor(room / n)));
  if (n === 1) return { card, step: 0 };
  const step = Math.floor((room - n * card) / (n - 1));
  return { card, step: Math.max(-(card - CARD_PEEK), Math.min(4, step)) };
}

