/* Where the guide keeps what the reader arranged, and how much room it takes
 * from the table. Their own file, so the launcher of a guided game and the
 * page that lays out the board can read them without pulling the panel in. */

/** the lesson the note is folded on, or -1 */
export const MINI_KEY = 'brassworks.guide.mini';
/** the spot the note was dragged to */
export const POS_KEY = 'brassworks.guide.pos';

/** how wide a lane the guide holds down the right edge, and zero when the
 *  window is too narrow to spare it — the note then floats over the board */
export function guideDock(width = typeof window === 'undefined' ? 1280 : window.innerWidth): number {
  if (width < 1100) return 0;
  return Math.max(320, Math.min(420, Math.round(width * 0.26)));
}
