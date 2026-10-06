import type { JudgeId, Reading, Verdict, Weighed } from './analysis';

/* ------------------------------------------------------------------ */
/* An analysis kept.                                                   */
/*                                                                     */
/* Reading a game through is a minute of a worker's thinking, and the  */
/* panel is opened again and again — the same game, the same seat, the */
/* same figures. So they are held for the length of a visit, one entry */
/* per game and judge — a reading by another judge is another reading, */
/* on another scale, and the two never mix.                            */
/*                                                                     */
/* Nothing of this is written down. What keeps a reading from one day  */
/* to the next is the office, which holds one per game and hands it    */
/* back when the panel opens (analysisShare.ts); this is the memory of */
/* a visit, so that closing the panel and opening it again is free.    */
/*                                                                     */
/* A position is read for the whole table at once — the machine plays  */
/* every seat on, so one continuation gives every seat its chance — so */
/* the curve is kept for all of them and changing seats costs nothing. */
/* What a turn was worth belongs to the seat that played it, and the   */
/* verdicts and the long readings of roads are kept seat by seat.      */
/* Only figures and moves are kept, never a table: a GameState is      */
/* heavy, and the engine plays the game again from its deal in no time.*/
/* ------------------------------------------------------------------ */

const PREFIX = 'analysis';
/** how many readings are held at once; the least recently read goes first */
const KEEP = 8;

/** the readings of this visit, by key */
const held = new Map<string, Entry>();

/** everything a reading of a game holds, as the panel keeps it */
export interface Kept {
  /** per position, one reading per seat */
  seats: Record<number, Reading[]>;
  /** per seat, a verdict per turn of theirs, by the move's index */
  verdicts: Record<number, Record<number, Verdict>>;
  /** per seat, the roads read longer, by the line of moves that leads to them */
  roads: Record<number, Record<string, Weighed[]>>;
  /** how many readings the pass was to make, and how many have landed: an
      entry written halfway through says so, and is read again rather than
      taken for the whole truth */
  total: number;
  done: number;
  /** how many moves of the game this reading covers */
  moves: number;
}

/** a reading held, and when it was last written — the moves' count guards
    against a game that has moved on since */
interface Entry extends Kept {
  read: number;
}

/** the entry of one table read by one judge: its code, its deal and the judge
    that read it — a reading by another judge is another reading, on another
    scale, and the two never mix */
export const analysisKey = (table: string, seed: number, judge: JudgeId = 'long'): string => `${PREFIX}:${table}:${seed}:${judge}`;

/* figures to four decimals: a chance is shown to the point, and the entry is
   half the size for it */
const trim = (x: number): number => Math.round(x * 1e4) / 1e4;
const trimReading = (r: Reading): Reading => ({ chance: trim(r.chance), low: trim(r.low), high: trim(r.high), passes: r.passes });
const trimWeighed = (w: Weighed[]): Weighed[] => w.map((r) => ({ action: r.action, chance: trim(r.chance) }));
const trimVerdict = (v: Verdict): Verdict => ({ ...v, roads: trimWeighed(v.roads), mine: trim(v.mine), best: trim(v.best), loss: trim(v.loss) });

const numbered = <T,>(o: Record<number, T>, f: (x: T) => T): Record<number, T> => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, f(x)])) as Record<number, T>;

/** the reading kept for this game, if one was written by the judge that
    stands — of this game as it stands, or of a shorter stretch of it: a
    position's reading plays the machine on from there and never looks at what
    was played after, so the first half of a game keeps its worth when the
    second is added to it */
export function readKept(key: string, moves: number): Kept | null {
  const e = held.get(key);
  if (!e || !e.seats || e.moves > moves) return null;
  return { seats: e.seats, verdicts: e.verdicts ?? {}, roads: e.roads ?? {}, total: e.total ?? 0, done: e.done ?? 0, moves: e.moves };
}

/** a reading is whole when every figure it set out to make has landed */
export const isWhole = (k: Kept | null, moves: number): boolean => !!k && k.moves >= moves && k.total > 0 && k.done >= k.total;

/** the reading of this game, written down */
export function keepAnalysis(key: string, moves: number, kept: Omit<Kept, 'moves'>): void {
  const entry: Entry = {
    moves,
    read: Date.now(),
    seats: numbered(kept.seats, (list) => list.map(trimReading)),
    verdicts: numbered(kept.verdicts, (byTurn) => numbered(byTurn, trimVerdict)),
    roads: numbered(kept.roads, (byLine) => Object.fromEntries(Object.entries(byLine).map(([k, w]) => [k, trimWeighed(w)]))),
    total: kept.total,
    done: kept.done,
  };
  held.set(key, entry);
  sweep(KEEP);
}

/** keep at most `most` readings, the least recently written dropped */
export function sweep(most: number): void {
  const list = [...held.entries()].sort((a, b) => a[1].read - b[1].read);
  for (const [key] of list.slice(0, Math.max(0, list.length - most))) held.delete(key);
}
