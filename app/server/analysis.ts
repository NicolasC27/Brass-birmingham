import { JUDGES } from '@/game/analysis';
import type { JudgeId } from '@/game/analysis';
import { cleanPart, emptyHeld, foldPart } from '@/game/analysisMerge';
import type { Facts, Held, ReadingPart } from '@/game/analysisMerge';
import type { Store } from './store';

/* ------------------------------------------------------------------ */
/* The office's copy of a reading.                                     */
/*                                                                     */
/* Reading a game through is a minute of a machine's thinking, and at  */
/* a table online every player used to pay it over again in their own  */
/* browser — the same deal, the same log, the same judge, the same     */
/* figures. The office keeps one copy instead: whoever reads posts     */
/* what lands, the office folds it in and passes it round, and a       */
/* player who opens the panel an hour later is handed the whole thing. */
/*                                                                     */
/* It also shares the work out. A reader asks for a slice of positions */
/* and reads only those; the office remembers which slices are taken   */
/* and hands the next reader another. A slice nobody has posted        */
/* against in a minute and a half is free again — a browser that was   */
/* closed must not take a stretch of the game to the grave.            */
/*                                                                     */
/* Nothing that comes in is believed: a reading is a handful of        */
/* figures, and every one of them is checked against the game the      */
/* office itself holds before it is folded in (analysisMerge).         */
/* ------------------------------------------------------------------ */

/** how long a slice stays taken without a word from the reader */
export const CLAIM_MS = 90_000;
/** the most positions one reader may take at once */
export const SLICE_MOST = 64;
/** readings nobody has come back to in a month are swept */
export const READING_MS = 30 * 24 * 60 * 60 * 1000;

/** the one reading: a table's game, read by one judge, on one scale */
export interface Id {
  code: string;
  seed: number;
  judge: JudgeId;
  v: number;
}

interface Taken {
  by: string;
  lo: number;
  hi: number;
  /** when it was taken, or last heard from */
  at: number;
}

const keyOf = (id: Id): string => `${id.code}:${id.seed}:${id.judge}:${id.v}`;

export const isJudge = (x: unknown): x is JudgeId => x === 'quick' || x === 'long' || x === 'deep';
/** the version of the analysis the reader was written by: a figure, nothing more */
export const isVersion = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0 && x < 1e6;

export class Readings {
  private live = new Map<string, Held>();
  private taken = new Map<string, Taken[]>();
  private store: Store;
  private now: () => number;

  constructor(store: Store, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
  }

  /** the reading of this game, from this hour's memory or from the register */
  private held(id: Id): Held {
    const key = keyOf(id);
    const mine = this.live.get(key);
    if (mine) return mine;
    const kept = this.store.analysis(id.code, id.seed, id.judge, id.v) ?? emptyHeld();
    this.live.set(key, kept);
    return kept;
  }

  /** the reading as the table may see it (null: the office keeps none yet) */
  read(id: Id): Held | null {
    const held = this.held(id);
    return held.moves > 0 || Object.keys(held.seats).length > 0 ? held : null;
  }

  /** figures just read, folded in — the part as it was kept, to pass on to
   *  the rest of the table, or null when it was not worth believing */
  add(id: Id, by: string, raw: unknown, facts: Facts): ReadingPart | null {
    const part = cleanPart(raw, facts);
    if (!part) return null;
    const key = keyOf(id);
    this.live.set(key, foldPart(this.held(id), part));
    this.store.saveAnalysis(id.code, id.seed, id.judge, id.v, this.live.get(key)!);
    /* a reader who posts is a reader still at work: their slices hold */
    for (const t of this.taken.get(key) ?? []) if (t.by === by) t.at = this.now();
    return part;
  }

  /** the slices taken now, the stale ones dropped */
  private stillTaken(key: string): Taken[] {
    const now = this.now();
    const held = (this.taken.get(key) ?? []).filter((t) => now - t.at < CLAIM_MS);
    this.taken.set(key, held);
    return held;
  }

  /** a stretch of positions for this reader, [lo, hi) — the first that is
   *  neither taken by somebody else nor read through already. An empty
   *  slice (lo === hi) says the game is covered: listen, do not read. */
  claim(id: Id, by: string, want: number, facts: Facts): { lo: number; hi: number } {
    const key = keyOf(id);
    const taken = this.stillTaken(key);
    const held = this.held(id);
    const passes = JUDGES[id.judge]?.passes.length ?? 0;
    /* a position is the table after k moves: one more of them than there are
       moves. One is done with when every pass of the judge has read it */
    const end = facts.moves + 1;
    const free = (k: number): boolean => (held.seats[k]?.[0]?.passes ?? 0) < passes && !taken.some((t) => t.by !== by && k >= t.lo && k < t.hi);
    const span = Math.max(1, Math.min(Math.floor(want) || 1, SLICE_MOST));
    let lo = 0;
    while (lo < end && !free(lo)) lo++;
    if (lo >= end) return { lo: 0, hi: 0 };
    let hi = lo;
    while (hi < end && hi - lo < span && free(hi)) hi++;
    this.taken.set(key, [...taken, { by, lo, hi, at: this.now() }]);
    return { lo, hi };
  }

  /** how many readers are at work on this reading */
  readers(id: Id): number {
    return new Set(this.stillTaken(keyOf(id)).map((t) => t.by)).size;
  }

  /** a reader gone: what they had taken is free again at once */
  release(by: string): void {
    for (const [key, list] of this.taken) this.taken.set(key, list.filter((t) => t.by !== by));
  }

  /** the readings of a table, forgotten (the game was played again there) */
  forget(code: string): void {
    for (const key of [...this.live.keys()]) if (key.startsWith(`${code}:`)) this.live.delete(key);
    for (const key of [...this.taken.keys()]) if (key.startsWith(`${code}:`)) this.taken.delete(key);
  }

  /** the old readings go from the register, and from this hour's memory */
  sweep(olderThan = READING_MS): void {
    this.store.sweepAnalyses(olderThan, this.now());
    this.live.clear();
  }
}
