import type { Mode } from './lessons';

/* ------------------------------------------------------------------ */
/* The guide's hold on the machine.                                    */
/*                                                                     */
/* At the guided table the machine waits while the reader reads: its   */
/* last move's plate, the table's news, a lesson's page, a moment for  */
/* the coach's word. The guide's hold is its own switch: the reader's  */
/* pause of the machines, among the table's tools, is another, and     */
/* neither lifts the other. The functions here are pure; the guide     */
/* reads the table into a Reading and sets its hold from an effect.    */
/* ------------------------------------------------------------------ */

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
 *  thing to read first — or nothing */
export function holdFor(r: Reading): Hold | null {
  if (r.plate) return 'plate';
  if (r.news) return 'news';
  if (newPage(r)) return 'page';
  if (r.review) return 'review';
  return r.coach ? 'coach' : null;
}
