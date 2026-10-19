import type { GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The lessons of the guided game, and how far the reader has come.     */
/*                                                                      */
/* A lesson is a record kept by its id: a page to read, or a deed to do */
/* on the table. A deed passes its lesson once it holds after the       */
/* lesson was shown undone; a deed done beforehand leaves the lesson a  */
/* page to read, with a word that it is already done. A page waiting on */
/* the game keeps its place until its time comes, however far the       */
/* reader reads on, and a lesson set aside comes back the next round.   */
/*                                                                      */
/* The progress is kept by id, for the one table the guided game is     */
/* played at, and a lesson passed stays passed: undoing a move does not */
/* teach it again. The functions here are pure; the guide settles the   */
/* progress while it renders and writes it down from an effect.         */
/* ------------------------------------------------------------------ */

/** what a lesson may point at on the screen */
export type Show = 'mat' | 'market' | 'vp';

/** what a lesson reads: the table, the reader's seat, the card chosen in
 *  the hand and the seat whose mat is open */
export interface LessonCtx {
  g: GameState;
  me: number;
  sel: string | null;
  mat: number | null;
}

export interface Lesson {
  id: string;
  /** the deed the lesson asks for, read off the table; none for a page */
  done?: (c: LessonCtx) => boolean;
  /** a lesson that only makes sense once this holds: it waits in its place */
  when?: (c: LessonCtx) => boolean;
  /** a deed the reader may pass as things stand */
  optional?: boolean;
  /** a deed the reader may set aside until the next round, once they have
   *  played an action since it came up */
  deferrable?: boolean;
  show?: Show;
}

const WORKS = ['cotton', 'manufacturer', 'pottery'];
const built = (c: LessonCtx, industries: string[]) => Object.values(c.g.tiles).some((t) => t.owner === c.me && industries.includes(t.industry));

/** the lessons, in the order the guide gives them */
export const LESSONS: readonly Lesson[] = [
  { id: 'welcome' },
  { id: 'board' },
  { id: 'goal', show: 'vp' },
  { id: 'money' },
  { id: 'mat', show: 'mat', done: (c) => c.mat !== null },
  { id: 'matRead', show: 'mat' },
  { id: 'hand', done: (c) => c.sel !== null },
  { id: 'coal', done: (c) => built(c, ['coal']) },
  /* read while the table waits: her turn comes once it has been read */
  { id: 'botTurn' },
  { id: 'payday', when: (c) => c.g.round >= 2 },
  { id: 'link', done: (c) => Object.values(c.g.links).some((l) => l.owner === c.me) },
  { id: 'iron', done: (c) => built(c, ['iron']) },
  { id: 'develop' },
  { id: 'works', done: (c) => built(c, WORKS) },
  { id: 'market', show: 'market' },
  { id: 'beer' },
  { id: 'sell', done: (c) => c.g.players[c.me].stats.sold > 0 },
  { id: 'flipped', when: (c) => c.g.players[c.me].stats.sold > 0 },
  { id: 'loan', done: (c) => c.g.players[c.me].loans > 0 },
  { id: 'eraEnd' },
  { id: 'plan' },
  { id: 'tips' },
  { id: 'onward' },
];

export const LESSON_IDS: readonly string[] = LESSONS.map((l) => l.id);
/** the last lesson: reading on from it closes the guide */
export const LAST_LESSON = LESSON_IDS[LESSON_IDS.length - 1];

export const lessonIndex = (id: string): number => LESSON_IDS.indexOf(id);
export const lessonOf = (id: string): Lesson | undefined => LESSONS[lessonIndex(id)];

/* ------------------------------ progress ----------------------------- */

export interface Progress {
  v: 2;
  /** the table the guided game is played at */
  code: string | null;
  /** the lessons passed, in the order they were: the reader's history */
  passed: string[];
  /** the lessons set aside, by the round they were set aside in */
  later: Record<string, number>;
  /** the deeds shown undone, by the action and the round they first came up at */
  seen: Record<string, { at: number; round: number }>;
}

export const freshProgress = (code: string | null): Progress => ({ v: 2, code, passed: [], later: {}, seen: {} });

/** the round, counted across the eras: a lesson set aside in the last
 *  round of the canal comes back in the first of the rail */
export const roundOf = (g: GameState): number => (g.era === 'rail' ? 100 : 0) + g.round;

/** a deed that holds after its lesson was shown undone: as good as passed */
const earned = (p: Progress, l: Lesson, c: LessonCtx): boolean => !!l.done && !!p.seen[l.id] && l.done(c);
/** set aside, and the round it was set aside in not over yet */
const aside = (p: Progress, id: string, c: LessonCtx): boolean => p.later[id] !== undefined && roundOf(c.g) <= p.later[id];

/** every deed seen undone that now holds, passed — in the lessons' order;
 *  the same progress when nothing moved */
export function settle(p: Progress, c: LessonCtx): Progress {
  const now = LESSONS.filter((l) => !p.passed.includes(l.id) && earned(p, l, c)).map((l) => l.id);
  return now.length ? { ...p, passed: [...p.passed, ...now] } : p;
}

/** how the lesson due is given: a page to read, a deed to do, a deed done
 *  beforehand (a page, with a word that it is done), or nothing left */
export type Mode = 'read' | 'do' | 'already' | 'finished';

export interface Due {
  id: string | null;
  index: number;
  mode: Mode;
}

/** the lesson due: the first not passed, not set aside, and not waiting on the game */
export function due(p: Progress, c: LessonCtx): Due {
  for (let i = 0; i < LESSONS.length; i++) {
    const l = LESSONS[i];
    if (p.passed.includes(l.id) || earned(p, l, c) || aside(p, l.id, c)) continue;
    if (l.when && !l.when(c)) continue;
    if (!l.done) return { id: l.id, index: i, mode: 'read' };
    return { id: l.id, index: i, mode: l.done(c) ? 'already' : 'do' };
  }
  return { id: null, index: LESSONS.length, mode: 'finished' };
}

/** a deed on show, noted while it is still undone: doing it now passes it.
 *  Only on the reader's own turn — on the machine's the guide says no more
 *  than whose turn it is, and a deed done under the next page is read as done */
export function see(p: Progress, id: string, c: LessonCtx): Progress {
  const l = lessonOf(id);
  if (!l?.done || p.seen[id] || l.done(c)) return p;
  if (c.g.phase !== 'action' || c.g.current !== c.me) return p;
  return { ...p, seen: { ...p.seen, [id]: { at: c.g.actions.length, round: roundOf(c.g) } } };
}

/** the lesson passed: read on from, done, or skipped */
export function pass(p: Progress, id: string): Progress {
  if (p.passed.includes(id)) return p;
  const later = { ...p.later };
  delete later[id];
  return { ...p, passed: [...p.passed, id], later };
}

/** the lesson set aside until the next round; it comes back in its place */
export function setAside(p: Progress, id: string, c: LessonCtx): Progress {
  return { ...p, later: { ...p.later, [id]: roundOf(c.g) } };
}

/** "Later" is offered on a deed that allows it, once the reader has
 *  played an action since the lesson first came up */
export function mayLater(p: Progress, id: string, c: LessonCtx): boolean {
  const s = p.seen[id];
  return !!lessonOf(id)?.deferrable && !!s && c.g.ledger.some((e) => e.player === c.me && (e.at ?? -1) >= s.at && e.verb !== 'system' && e.verb !== 'score');
}

const LOAN_AT = lessonIndex('loan');

/** the lesson shown in place of the one due: when money is what its deed
 *  lacks and the loan is still to be taught, the loan comes first, and the
 *  lesson due comes back after it */
export function detourOf(p: Progress, d: Due, c: LessonCtx, short: boolean, loanOk: boolean): string | null {
  if (!short || !loanOk || d.mode !== 'do' || d.id === null || d.index >= LOAN_AT) return null;
  if (p.passed.includes('loan') || LESSONS[LOAN_AT].done!(c)) return null;
  return 'loan';
}

/* ------------------------------ reading back ------------------------- */

/** a lesson read again, and its place in the history — past its end for
 *  a lesson not passed yet (the one the sheet of progress points at) */
export interface Review {
  id: string;
  at: number;
}

/** Back: the lesson passed before this one, or null when there is none */
export function back(p: Progress, r: Review | null): Review | null {
  const at = (r ? r.at : p.passed.length) - 1;
  return at >= 0 && at < p.passed.length ? { id: p.passed[at], at } : null;
}

/** Next while reading back: the lesson passed after this one, or the live
 *  lesson again (null) — it never passes anything */
export function forward(p: Progress, r: Review | null): Review | null {
  if (!r) return null;
  const at = r.at + 1;
  return at < p.passed.length ? { id: p.passed[at], at } : null;
}

/** a lesson opened out of turn, read back from its place in the history */
export function reread(p: Progress, id: string): Review {
  const at = p.passed.indexOf(id);
  return { id, at: at >= 0 ? at : p.passed.length };
}

/* ------------------------------- the disk ---------------------------- */

/** the progress, one record for the guided table */
export const PROGRESS_KEY = 'brassworks.tutorial.progress';
/** before the lessons had ids: the index read past and the first lesson
 *  not passed, counted in the order of V1_ORDER */
const STEP_KEY = 'brassworks.tutorial.step';
const REACH_KEY = 'brassworks.tutorial.reached';
/** the order those indices counted in, kept as it was whatever the
 *  lessons become */
const V1_ORDER = ['welcome', 'board', 'goal', 'money', 'mat', 'matRead', 'hand', 'coal', 'botTurn', 'payday', 'link', 'iron', 'develop', 'works', 'market', 'beer', 'sell', 'flipped', 'loan', 'eraEnd', 'plan', 'tips', 'onward'];

const known = (id: unknown): id is string => typeof id === 'string' && lessonIndex(id) >= 0;
const keep = <V>(o: unknown, ok: (v: unknown) => v is V): Record<string, V> =>
  Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => known(k) && ok(v))) as Record<string, V>;
const isRound = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSight = (v: unknown): v is { at: number; round: number } => !!v && typeof v === 'object' && isRound((v as { at: unknown }).at) && isRound((v as { round: unknown }).round);

/** a record read back, or null when it is not one */
function parse(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Progress> | null;
    if (!v || v.v !== 2 || !Array.isArray(v.passed)) return null;
    return { v: 2, code: typeof v.code === 'string' ? v.code : null, passed: [...new Set(v.passed.filter(known))], later: keep(v.later, isRound), seen: keep(v.seen, isSight) };
  } catch {
    return null;
  }
}

/** the old indices read into a record: what lay below the first lesson
 *  not passed is passed; between it and the index read past, a page is
 *  passed, a deed is seen (it passes once it holds), and a page waiting
 *  on the game keeps its place */
export function fromIndices(step: number, reached: number, code: string | null): Progress {
  const cut = (n: number) => Math.max(0, Math.min(V1_ORDER.length, Math.floor(Number.isFinite(n) ? n : 0)));
  const p = freshProgress(code);
  const r = cut(reached);
  p.passed = V1_ORDER.slice(0, r).filter(known);
  for (const id of V1_ORDER.slice(r, Math.max(r, cut(step)))) {
    const l = lessonOf(id);
    if (!l || l.when) continue;
    if (l.done) p.seen[id] = { at: 0, round: 0 };
    else p.passed.push(id);
  }
  return p;
}

/** the progress written in this visit, for a browser whose storage refuses it */
let kept: Progress | null = null;
const listeners = new Set<() => void>();

/** what this browser holds of the guided game: its record, or the old
 *  indices read into one; null when it was never begun */
export function readProgress(): Progress | null {
  try {
    const p = parse(localStorage.getItem(PROGRESS_KEY));
    if (p) return p;
    const step = localStorage.getItem(STEP_KEY);
    const reached = localStorage.getItem(REACH_KEY);
    if (step === null && reached === null) return null;
    return fromIndices(Number(step ?? 0), Number(reached ?? 0), null);
  } catch {
    /* no storage: what this visit wrote */
    return kept;
  }
}

/** what the disk holds for a table, as a key the last reading is kept by */
const shelfKey = (code: string | null): string => {
  try {
    return `${code}\n${[PROGRESS_KEY, STEP_KEY, REACH_KEY].map((k) => localStorage.getItem(k) ?? '').join('\n')}`;
  } catch {
    return `${code}\n`;
  }
};
let memo: { key: string; p: Progress } | null = null;

/** the progress at this table: its own record, the old indices taken up
 *  once, or a fresh start for a table that is not the one on record. The
 *  same object while nothing changes, so a render can subscribe to it */
export function progressAt(code: string): Progress {
  const key = shelfKey(code);
  if (memo?.key === key) return memo.p;
  const p = readProgress();
  const at = !p ? freshProgress(code) : p.code === code ? p : p.code === null ? { ...p, code } : freshProgress(code);
  memo = { key, p: at };
  return at;
}

/** write the progress down, and say so to whoever reads it */
export function saveProgress(p: Progress): void {
  kept = p;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    /* the old indices are read once, into the record */
    localStorage.removeItem(STEP_KEY);
    localStorage.removeItem(REACH_KEY);
  } catch {
    /* the record lives for this visit only */
  }
  /* read back as the very record written — even where the disk refused it,
     the next reading must not undo this one */
  memo = { key: shelfKey(p.code), p };
  for (const f of listeners) f();
}

/** hear every write of the progress */
export function onProgress(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}
