/* ------------------------------------------------------------------ */
/* The watch — what the house does against cheating.                   */
/*                                                                     */
/* The table server already holds the whole truth and applies every    */
/* move through the engine, so a client can neither play a card it    */
/* does not hold nor see a hand that is not its own. What is left is  */
/* the human kind of cheating: two accounts under one roof at a       */
/* ranked table, two friends trading wins to lift a cote, a machine   */
/* playing a human's seat. This file holds the small pure pieces of   */
/* that watch; the hall and the register wire them in.                */
/* ------------------------------------------------------------------ */

/** loopback and the unknown say nothing about who sits where */
const UNKNOWN = new Set(['', '127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** two accounts whose sockets come from the same address: kin, not to be
 *  seated together at a ranked table */
export function sameHouse(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || UNKNOWN.has(a) || UNKNOWN.has(b)) return false;
  return a === b;
}

/** how many ranked games a season may weigh the same two accounts against
 *  each other; beyond it their meetings move neither cote */
export const MEETINGS_CAP = 4;

/** a turn opened faster than a hand can read a board */
export const QUICK_MS = 1500;
/** so many quick openings in a row, and the seat is noted */
export const QUICK_TURNS = 12;

/** the pace of each seat at a table: the time each turn took to open,
 *  and a word when a run of them is quicker than a human reads */
export class PaceWatch {
  private runs = new Map<string, number>();
  private noted = new Set<string>();

  /** a human's first action of a turn, so many ms after the turn was
   *  lit; true the one time the run crosses the line */
  note(code: string, seat: number, ms: number): boolean {
    const key = `${code}:${seat}`;
    const run = ms < QUICK_MS ? (this.runs.get(key) ?? 0) + 1 : 0;
    this.runs.set(key, run);
    if (run < QUICK_TURNS || this.noted.has(key)) return false;
    this.noted.add(key);
    return true;
  }

  forget(code: string): void {
    for (const k of [...this.runs.keys()]) if (k.startsWith(`${code}:`)) this.runs.delete(k);
    for (const k of [...this.noted]) if (k.startsWith(`${code}:`)) this.noted.delete(k);
  }
}

/** a mark in the register: what was seen, of whom, where */
export interface Flag {
  id: string;
  accountId: string;
  kind: 'pace' | 'meetings' | 'household';
  detail: string;
  code: string | null;
  at: number;
}
