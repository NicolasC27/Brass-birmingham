import { ANALYSIS_VERSION } from './analysis';
import type { Reading, Verdict, Weighed } from './analysis';

/* ------------------------------------------------------------------ */
/* An analysis kept.                                                   */
/*                                                                     */
/* Reading a game through is a minute of a worker's thinking, and the  */
/* panel is opened again and again — the same game, the same seat, the */
/* same figures. So they are kept in this browser, one entry per game, */
/* stamped with the judge that wrote them: change a judge, a scale or  */
/* the passes, ANALYSIS_VERSION moves and every old entry is thrown    */
/* away rather than shown on a scale it was not read on.               */
/*                                                                     */
/* A position is read for the whole table at once — the machine plays  */
/* every seat on, so one continuation gives every seat its chance — so */
/* the curve is kept for all of them and changing seats costs nothing. */
/* What a turn was worth belongs to the seat that played it, and the   */
/* verdicts and the long readings of roads are kept seat by seat.      */
/* Only figures and moves are kept, never a table: a GameState is      */
/* heavy, and the engine plays the game again from its deal in no time.*/
/* ------------------------------------------------------------------ */

const PREFIX = 'brassworks.analysis.v1';
/** how many readings this browser keeps; the least recently read goes first */
const KEEP = 8;

/** everything a reading of a game holds, as the panel keeps it */
export interface Kept {
  /** per position, one reading per seat */
  seats: Record<number, Reading[]>;
  /** per seat, a verdict per turn of theirs, by the move's index */
  verdicts: Record<number, Record<number, Verdict>>;
  /** per seat, the roads read longer, by the line of moves that leads to them */
  roads: Record<number, Record<string, Weighed[]>>;
  /** how many readings the pass was to make: a part-read game keeps its count */
  total: number;
  /** how many moves of the game this reading covers */
  moves: number;
}

/** what is written: the reading, the judge that wrote it, and the game it
    was read from — the moves' count guards against a table that has moved on */
interface Entry extends Kept {
  v: number;
  read: number;
}

/** the entry of one table: its code and its deal. Every seat is in it */
export const analysisKey = (table: string, seed: number): string => `${PREFIX}:${table}:${seed}`;

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
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const e = JSON.parse(raw) as Entry;
    if (!e || e.v !== ANALYSIS_VERSION || !e.seats || e.moves > moves) return null;
    return { seats: e.seats, verdicts: e.verdicts ?? {}, roads: e.roads ?? {}, total: e.total ?? 0, moves: e.moves };
  } catch {
    return null;
  }
}

/** the reading of this game, written down */
export function keepAnalysis(key: string, moves: number, kept: Omit<Kept, 'moves'>): void {
  const entry: Entry = {
    v: ANALYSIS_VERSION,
    moves,
    read: Date.now(),
    seats: numbered(kept.seats, (list) => list.map(trimReading)),
    verdicts: numbered(kept.verdicts, (byTurn) => numbered(byTurn, trimVerdict)),
    roads: numbered(kept.roads, (byLine) => Object.fromEntries(Object.entries(byLine).map(([k, w]) => [k, trimWeighed(w)]))),
    total: kept.total,
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* the shelf is full: the oldest readings go, then this one is tried once more */
    sweep(0);
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      /* still no room: the panel reads the game again next time, no worse */
      return;
    }
  }
  sweep(KEEP);
}

/** the readings of this browser, oldest first */
function entries(): { key: string; read: number }[] {
  const out: { key: string; read: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${PREFIX}:`)) continue;
      let read = 0;
      try {
        read = (JSON.parse(localStorage.getItem(key) ?? '{}') as Entry).read ?? 0;
      } catch {
        /* an entry that no longer parses: the oldest there is */
      }
      out.push({ key, read });
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => a.read - b.read);
}

/** keep at most `most` readings, the least recently written dropped */
export function sweep(most: number): void {
  const list = entries();
  for (const { key } of list.slice(0, Math.max(0, list.length - most))) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* non-fatal */
    }
  }
}
