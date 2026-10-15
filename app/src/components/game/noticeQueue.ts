import { create } from 'zustand';
import type { Headline } from '@/game/gazette';
import type { Era } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The table's notices as a book, with no DOM and no React: what is    */
/* said, in what order, and what has been put away. One book, one      */
/* order:                                                               */
/*  - what touches the reader (a tile of theirs covered or turned, a    */
/*    beer drunk from their brewery, the era's last round, their turn   */
/*    after a long wait) stands ahead of what the others did;           */
/*  - within a rank, first come first shown, so a notice never jumps    */
/*    past one already being read;                                      */
/*  - three at most are open at the top of the book, the rest wait      */
/*    behind a "+n";                                                    */
/*  - the others' flips, several from one seat, are read as one notice  */
/*    with a count, the latest facts on top;                            */
/*  - no clock: a notice stays open until the reader files it, or until */
/*    a newer one of its kind makes it stale (the next paper, the next  */
/*    call to play, the next era's last round). Filed is not lost: the  */
/*    book keeps the latest pages, and the reader leafs back through    */
/*    them.                                                             */
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
  /** the seat it is about: its mark stands by the notice */
  owner?: number;
  industry?: string;
  title: string;
  detail: string;
  /** the round and era it was said in, for the book */
  round?: number;
  era?: Era;
  /** how many events the notice stands for (the others' flips gather) */
  count: number;
  /** arrival order, for first come first shown within a rank */
  seq: number;
  /** put away, by the reader or by a newer notice of its kind: still in
   *  the book, no longer open */
  filed: boolean;
  gazette?: GazetteIssue;
}

export type Incoming = Omit<Notice, 'count' | 'seq' | 'filed'>;

/** at most this many open at once */
export const MAX_SHOWN = 3;
/** the book keeps this many pages; the oldest filed go first */
export const BOOK_PAGES = 40;

/** kinds where a newcomer makes the one before it stale */
const STALES: ReadonlySet<NoticeKind> = new Set<NoticeKind>(['turn', 'lastRound', 'gazette']);

/** a notice that gathers with a newcomer rather than stand beside it */
function gathers(held: Notice, fresh: Incoming): boolean {
  return !held.filed && held.rank === 1 && fresh.rank === 1 && held.kind === 'flip' && fresh.kind === 'flip' && held.owner === fresh.owner;
}

/** the book cut back to its pages: every open notice stays, the oldest
 *  filed ones go */
function trimmed(notes: Notice[], pages: number): Notice[] {
  const over = notes.length - pages;
  if (over <= 0) return notes;
  const drop = new Set(
    notes
      .filter((n) => n.filed)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, over)
      .map((n) => n.id),
  );
  return notes.filter((n) => !drop.has(n.id));
}

/** the book with the newcomers in: each either joins its open twin (the
 *  count goes up, the latest facts are shown), or files the stale one of
 *  its kind and takes its place at the back of its rank. A notice already
 *  in the book, open or filed, is not said twice. `seq` carries on from
 *  the caller's counter. */
export function enqueue(held: readonly Notice[], incoming: readonly Incoming[], seq: number, pages = BOOK_PAGES): { notes: Notice[]; seq: number } {
  let notes = held.slice();
  let next = seq;
  for (const fresh of incoming) {
    if (notes.some((n) => n.id === fresh.id)) continue;
    const twin = notes.findIndex((n) => gathers(n, fresh));
    if (twin >= 0) {
      const n = notes[twin];
      notes[twin] = { ...n, title: fresh.title, detail: fresh.detail, industry: fresh.industry ?? n.industry, round: fresh.round ?? n.round, era: fresh.era ?? n.era, count: n.count + 1 };
      continue;
    }
    if (STALES.has(fresh.kind)) notes = notes.map((n) => (n.kind === fresh.kind && !n.filed ? { ...n, filed: true } : n));
    notes.push({ ...fresh, count: 1, seq: next++, filed: false });
  }
  return { notes: trimmed(notes, pages), seq: next };
}

/** the book with the open notices that match put away; the same book when
 *  none does, so a caller's state is left alone */
export function fileWhere(notes: readonly Notice[], match: (n: Notice) => boolean): Notice[] {
  if (!notes.some((n) => !n.filed && match(n))) return notes as Notice[];
  return notes.map((n) => (!n.filed && match(n) ? { ...n, filed: true } : n));
}

/** the open notices in reading order: the reader's own first, then first come */
export function ordered(notes: readonly Notice[]): Notice[] {
  return notes.filter((n) => !n.filed).sort((a, b) => b.rank - a.rank || a.seq - b.seq);
}

/** what is open on show and how many wait behind it */
export function shownOf(notes: readonly Notice[], max = MAX_SHOWN): { shown: Notice[]; waiting: number } {
  const all = ordered(notes);
  return { shown: all.slice(0, max), waiting: Math.max(0, all.length - max) };
}

/** the filed pages, the latest first */
export function filedOf(notes: readonly Notice[]): Notice[] {
  return notes.filter((n) => n.filed).sort((a, b) => b.seq - a.seq);
}

/* ------------------------------------------------------------------ */
/* The Gazette is set by its own component and read in the book: the   */
/* issue of the moment is handed over here.                            */
/* ------------------------------------------------------------------ */

export const useGazetteDesk = create<{ issue: GazetteIssue | null; publish: (issue: GazetteIssue | null) => void }>((set) => ({
  issue: null,
  publish: (issue) => set({ issue }),
}));

/* ------------------------------------------------------------------ */
/* The test bench lays notices in by hand, to see the book without     */
/* playing to the moment that says them (dev builds only: the table    */
/* listens under import.meta.env.DEV).                                 */
/* ------------------------------------------------------------------ */

const hands = new Set<(items: Incoming[]) => void>();

/** the book listens for notices laid in by hand */
export function onLaidNotices(fn: (items: Incoming[]) => void): () => void {
  hands.add(fn);
  return () => hands.delete(fn);
}

/** notices laid in the open book by hand, as if the table had said them */
export function layNotices(items: Incoming[]): void {
  for (const fn of [...hands]) fn(items);
}
