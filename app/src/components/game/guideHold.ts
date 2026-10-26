import type { GameState } from '@/game/types';
import type { Mode } from './lessons';

/* ------------------------------------------------------------------ */
/* The guide's hold on the machine.                                    */
/*                                                                     */
/* At the guided table the machine waits while the reader reads: its   */
/* last move's plate, the table's news, a lesson's page, a moment for  */
/* the coach's word. After the first rounds the reader may let it play */
/* on: its plates go to the thread without holding it, and only a page */
/* not read yet — a lesson come up, a deed done beforehand — still     */
/* does. The guide's hold is its own switch: the reader's pause of the */
/* machines, among the table's tools, is another, and neither lifts    */
/* the other. The functions here are pure; the guide reads the table   */
/* into a Reading and sets its hold from an effect.                    */
/* ------------------------------------------------------------------ */

/** the round from which the reader may let the machine play on: the
 *  first rounds are read at the guide's pace, a move at a time */
export const PLAY_ON_FROM = 3;

/** the reader may let the machine play on: the first rounds are behind */
export const mayPlayOn = (g: GameState): boolean => g.era === 'rail' || g.round >= PLAY_ON_FROM;

/** what the guide has on show that the reader may not have read */
export interface Reading {
  /** the machine's last move, its plate fresh and not dismissed */
  plate: boolean;
  /** the table's news, not dismissed */
  news: boolean;
  /** how the lesson due is given (see lessons.ts `due`); null outside
   *  the guided game */
  page: Mode | null;
  /** a lesson read back */
  review: boolean;
  /** the coach's word on the reader's last move, awaited or on show */
  coach: boolean;
}

/** what the machine waits on: the plate, the news, a page not read
 *  yet, a lesson read back, the coach */
export type Hold = 'plate' | 'news' | 'page' | 'review' | 'coach';

/** a page the reader has not read yet: a lesson to read, or a deed done
 *  beforehand, whose page says what it changes */
const newPage = (r: Reading): boolean => r.page === 'read' || r.page === 'already';

/** what holds the machine on its turn at the guided table, the first
 *  thing to read first — or nothing. Let play on, it waits on a new
 *  page alone: its plates and the news go by, a lesson read back is
 *  the reader's own leisure, and the coach's word only a moment */
export function holdFor(r: Reading, playOn = false): Hold | null {
  if (playOn) return newPage(r) ? 'page' : null;
  if (r.plate) return 'plate';
  if (r.news) return 'news';
  if (newPage(r)) return 'page';
  if (r.review) return 'review';
  return r.coach ? 'coach' : null;
}
