import { create } from 'zustand';
import type { Headline } from '@/game/gazette';
import type { Era } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The table's notices as a queue, with no DOM and no React: what is   */
/* said, in what order, for how long. One pile, one order:              */
/*  - what touches the reader (a tile of theirs covered or turned, a    */
/*    beer drunk from their brewery, the era's last round, their turn   */
/*    after a long wait) stands ahead of what the others did;           */
/*  - within a rank, first come first shown, so a notice never jumps    */
/*    past one already being read;                                      */
/*  - three at most are shown, the rest wait their turn behind a "+n";  */
/*  - the others' flips, several from one seat, are read as one notice  */
/*    with a count, the latest facts on top;                            */
/*  - a notice stays as long as it takes to read it, and its clock only */
/*    runs while it is on show.                                         */
/* ------------------------------------------------------------------ */

export type NoticeKind = 'flip' | 'beer' | 'pin' | 'overbuilt' | 'lastRound' | 'turn' | 'gazette';

/** 2: it touches the reader; 1: the table's news; 0: the round's paper */
export type NoticeRank = 0 | 1 | 2;

export interface GazetteIssue {
  id: string;
  round: number;
  era: Era;
  lines: Headline[];
}

export interface Notice {
  id: string;
  kind: NoticeKind;
  rank: NoticeRank;
  /** the seat it is about: its colour runs down the notice's edge */
  owner?: number;
  industry?: string;
  title: string;
  detail: string;
  /** how many events the notice stands for (the others' flips gather) */
  count: number;
  /** arrival order, for first come first shown within a rank */
  seq: number;
  /** bumped when the notice is refreshed by a newcomer: its clock restarts */
  stamp: number;
  /** how long it stays on show, in ms */
  life: number;
  gazette?: GazetteIssue;
}

export type Incoming = Omit<Notice, 'count' | 'seq' | 'stamp' | 'life'> & { life?: number };

/** at most this many on show at once */
export const MAX_SHOWN = 3;

const READ_BASE_MS = 4200;
const READ_PER_CHAR_MS = 55;
const LIFE_MIN_MS = 5500;
const LIFE_MAX_MS = 12000;

/** as long as it takes to read, give or take: a short line five seconds
 *  and a half, a long one twelve; what touches the reader half as long
 *  again */
export function lifeFor(title: string, detail: string, rank: NoticeRank): number {
  const read = READ_BASE_MS + (title.length + detail.length) * READ_PER_CHAR_MS;
  const base = Math.min(LIFE_MAX_MS, Math.max(LIFE_MIN_MS, read));
  return Math.round(rank === 2 ? base * 1.5 : base);
}

/** a notice that gathers with a newcomer rather than stand beside it */
function gathers(held: Notice, fresh: Incoming): boolean {
  return held.rank === 1 && fresh.rank === 1 && held.kind === 'flip' && fresh.kind === 'flip' && held.owner === fresh.owner;
}

/** the queue with the newcomers in: each either joins its twin (the count
 *  goes up, the latest facts are shown, the clock starts over) or takes
 *  its place at the back of its rank. A notice already held is not said
 *  twice. `seq` carries on from the caller's counter. */
export function enqueue(held: readonly Notice[], incoming: readonly Incoming[], seq: number): { notes: Notice[]; seq: number } {
  const notes = held.slice();
  let next = seq;
  for (const fresh of incoming) {
    if (notes.some((n) => n.id === fresh.id)) continue;
    const twin = notes.findIndex((n) => gathers(n, fresh));
    const life = fresh.life ?? lifeFor(fresh.title, fresh.detail, fresh.rank);
    if (twin >= 0) {
      const n = notes[twin];
      notes[twin] = { ...n, title: fresh.title, detail: fresh.detail, industry: fresh.industry ?? n.industry, count: n.count + 1, stamp: n.stamp + 1, life };
      continue;
    }
    notes.push({ ...fresh, count: 1, seq: next++, stamp: 0, life });
  }
  return { notes, seq: next };
}

/** the pile in reading order: the reader's own first, then first come */
export function ordered(notes: readonly Notice[]): Notice[] {
  return notes.slice().sort((a, b) => b.rank - a.rank || a.seq - b.seq);
}

/** what is on show and how many wait behind it */
export function shownOf(notes: readonly Notice[], max = MAX_SHOWN): { shown: Notice[]; waiting: number } {
  const all = ordered(notes);
  return { shown: all.slice(0, max), waiting: Math.max(0, all.length - max) };
}

/* ------------------------------------------------------------------ */
/* The Gazette is set by its own component and read in the pile: the   */
/* issue of the moment is handed over here.                            */
/* ------------------------------------------------------------------ */

export const useGazetteDesk = create<{ issue: GazetteIssue | null; publish: (issue: GazetteIssue | null) => void }>((set) => ({
  issue: null,
  publish: (issue) => set({ issue }),
}));
