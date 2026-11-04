import { useEffect, useSyncExternalStore } from 'react';
import { getLang } from '@/i18n';
import { ONLINE_URL, onlineWire } from '@/online/net';
import { TRAIL_BATCH } from '@/online/guideTrail';
import type { Passed, TrailEvent, View } from '@/online/guideTrail';
import { lessonIndex, lessonOf, optionalNow, roundOf } from './lessons';
import type { LessonCtx, Mode, Progress } from './lessons';

/* ------------------------------------------------------------------ */
/* The guided game's trail, written as it is played: the lessons shown, */
/* how each was passed, the ones set aside, the detour to the loan, the */
/* guide left, the machine let play on, the game played out — so the   */
/* direction may see where beginners stop (online/guideTrail.ts sums it */
/* up). It is read off the guide as it renders: what is in view, and    */
/* the progress as it moves; the guide itself only says when it is      */
/* left. It leaves a few events at a time on the game's own socket,     */
/* under a random id drawn with the guided table — never the account,   */
/* never the table's code — and nothing leaves at all with no office    */
/* configured, or once the reader has said no on the evening course.   */
/* ------------------------------------------------------------------ */

/** the guided table's trail: its random id, kept with the table as the
 *  progress is — one table at a time */
export const TRAIL_KEY = 'brassworks.guide.trail';
/** the reader said no: nothing is noted, nothing leaves */
export const TRAIL_OFF_KEY = 'brassworks.guide.trail.off';

export interface TrailRecord {
  /** the table it is kept for — here only: the code never leaves the browser */
  code: string;
  id: string;
  /** when it was drawn: the events count their seconds from it */
  t0: number;
  /** what was said already, each once: 'shown:coal', 'passed:coal', 'later:iron:3'… */
  said: string[];
  /** the furthest lesson come to, in the lessons' order, and the last one in view */
  reached: string | null;
  last: string | null;
  /** the machine let play on, as last said */
  playOn: boolean;
}

/** an event before the page adds the screen, the language and the build */
export type Step = Omit<TrailEvent, 'view' | 'lang' | 'version'>;

/** what the guide shows, and how far the reader has come */
export interface Sight {
  table: string | null;
  tutorial: boolean;
  c: LessonCtx | null;
  p: Progress;
  /** the lesson in view, how it is given, and — in the loan's detour —
   *  the lesson that led there */
  shown: string | null;
  mode: Mode | null;
  from: string | null;
  /** the guide left, on this lesson */
  left?: string;
}

/** the screen, coarsely: a mouse is a desk; a finger, a tablet held one
 *  way or the other, or anything smaller */
export function viewOf(width: number, height: number, coarse: boolean): View {
  if (!coarse) return 'desktop';
  if (Math.min(width, height) < 600) return 'touch';
  return width >= height ? 'tablet-landscape' : 'tablet-portrait';
}

/** how a lesson just passed was: its deed done after it was shown undone;
 *  read on from — a page, a deed done beforehand, a deed that may wait;
 *  or skipped, its deed still undone */
export function passedHow(p: Progress, id: string, c: LessonCtx): Passed {
  const l = lessonOf(id);
  if (!l?.done) return 'next';
  const seen = p.seen[id];
  if (l.done(c, seen)) return seen ? 'deed' : 'next';
  return optionalNow(id, c) ? 'next' : 'skip';
}

/** a table's first record: what its progress holds already is taken as said */
export function freshRecord(code: string, p: Progress, now: number, id: string): TrailRecord {
  const said = [...p.passed.map((l) => `passed:${l}`), ...Object.entries(p.later).map(([l, r]) => `later:${l}:${r}`)];
  const reached = p.passed.reduce<string | null>((far, l) => (far === null || lessonIndex(l) > lessonIndex(far) ? l : far), null);
  return { code, id, t0: now, said, reached, last: null, playOn: !!p.playOn };
}

/** the record read back, or null when it is not one */
export function recordOf(raw: string | null): TrailRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<TrailRecord> | null;
    if (!r || typeof r.code !== 'string' || typeof r.id !== 'string' || !/^[0-9a-f]{16}$/.test(r.id) || typeof r.t0 !== 'number' || !Array.isArray(r.said)) return null;
    const lesson = (v: unknown) => (typeof v === 'string' ? v : null);
    return { code: r.code, id: r.id, t0: r.t0, said: r.said.filter((k): k is string => typeof k === 'string'), reached: lesson(r.reached), last: lesson(r.last), playOn: r.playOn === true };
  } catch {
    return null;
  }
}

/** what the guide says now that it has not said yet at this table, and
 *  the record that remembers it. A new guided table draws its id; at the
 *  guided table, the lessons passed and set aside, the machine let play
 *  on, the lesson in view; once it is played out — the guide left or not
 *  — the end. A deed the last action did is told on the ledger it opens;
 *  what the final ledger passes besides is no reader's doing, and is
 *  noted without a word */
export function stepsOf(r0: TrailRecord | null, s: Sight, now: number, draw: () => string): { record: TrailRecord | null; steps: Step[] } {
  if (!s.table || !s.c) return { record: r0, steps: [] };
  const c = s.c;
  const g = c.g;
  const r = s.tutorial && (!r0 || r0.code !== s.table) ? freshRecord(s.table, s.p, now, draw()) : r0;
  if (!r || r.code !== s.table) return { record: r0, steps: [] };
  /* a guided table first seen played out — from before the trail — ended
     with nothing noted: its end is not news */
  if (r !== r0 && g.phase === 'game-over') r.said.push('finished');
  const playing = g.phase === 'action';
  const base = { id: r.id, round: roundOf(g), at: g.actions.length, s: Math.max(0, Math.round((now - r.t0) / 1000)), seed: g.seed };
  const steps: Step[] = [];
  const said = new Set(r.said);
  let { reached, last, playOn } = r;
  const say = (key: string, e: () => Pick<Step, 'kind' | 'lesson'> & Partial<Step>, aloud = true) => {
    if (said.has(key)) return;
    said.add(key);
    if (aloud) steps.push({ ...base, ...e() });
  };
  const further = (id: string) => {
    if (reached === null || lessonIndex(id) > lessonIndex(reached)) reached = id;
  };
  if (s.tutorial) {
    for (const id of s.p.passed) {
      if (said.has(`passed:${id}`)) continue;
      const how = passedHow(s.p, id, c);
      const aloud = playing || how === 'deed';
      say(`passed:${id}`, () => ({ kind: 'passed', lesson: id, how }), aloud);
      if (aloud) further(id);
    }
    for (const [id, round] of Object.entries(s.p.later)) say(`later:${id}:${round}`, () => ({ kind: 'later', lesson: id }), playing);
    if (!!s.p.playOn !== playOn) {
      playOn = !!s.p.playOn;
      if (playing) steps.push({ ...base, kind: 'playOn', lesson: last ?? '', how: playOn ? 'on' : 'off' });
    }
    if (playing && s.shown) {
      const shown = s.shown;
      if (s.from) say(`detour:${s.from}`, () => ({ kind: 'detour', lesson: s.from! }));
      const kind = s.mode === 'already' && !s.from ? 'already' : 'shown';
      say(`${kind}:${shown}`, () => ({ kind, lesson: shown }));
      last = shown;
      further(shown);
    }
    if (playing && s.left !== undefined) say('left', () => ({ kind: 'left', lesson: s.left! }));
  }
  if (g.phase === 'game-over') {
    const other = g.players.findIndex((_, i) => i !== c.me);
    const vp = (i: number) => Math.max(0, Math.min(999, g.players[i]?.vp ?? 0));
    say('finished', () => ({ kind: 'finished', lesson: reached ?? '', how: g.abandoned ? 'abandoned' : 'played', vp: [vp(c.me), vp(other)] }));
  }
  const moved = r !== r0 || said.size !== r.said.length || reached !== r.reached || last !== r.last || playOn !== r.playOn;
  return { record: moved ? { ...r, said: [...said], reached, last, playOn } : r0, steps };
}

/* -------------------------------- the post ------------------------------ */

/** a lesson's events gathered this long before they leave — and, the
 *  line down, tried again after as long */
export const TRAIL_WAIT_MS = 5000;
/** and never two frames closer than this but as the page goes: the
 *  office takes six a second */
export const TRAIL_GAP_MS = 1000;
/** the most kept waiting while the line is down; the oldest go first */
export const TRAIL_HELD = 200;

export interface TrailPost {
  push(e: TrailEvent): void;
  /** the next frame now rather than in a while */
  flush(): void;
  /** the page is going: a frame at once, whatever the gap — one, not a
   *  burst the office would cut; the rest in its time if the page stays */
  drain(): void;
  drop(): void;
  readonly waiting: number;
}

/** the events on their way: gathered, then sent a frame at a time — kept
 *  here while the line will not take one — and dropped, never sent, while
 *  `shut` holds */
export function trailPost(send: (events: TrailEvent[]) => boolean, shut: () => boolean): TrailPost {
  let queue: TrailEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sentAt = -Infinity;
  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const soon = (ms: number) => {
    if (timer === null) timer = setTimeout(post.flush, ms);
  };
  /** a frame out, and the next one in its time; the line down, the frame
   *  stays and is tried again in a while */
  const out = () => {
    if (!send(queue.slice(0, TRAIL_BATCH))) return soon(TRAIL_WAIT_MS);
    queue = queue.slice(TRAIL_BATCH);
    sentAt = Date.now();
    if (queue.length) soon(TRAIL_GAP_MS);
  };
  const post: TrailPost = {
    push(e) {
      if (shut()) return;
      queue.push(e);
      if (queue.length > TRAIL_HELD) queue.shift();
      if (queue.length >= TRAIL_BATCH) post.flush();
      else soon(TRAIL_WAIT_MS);
    },
    flush() {
      stop();
      if (shut()) queue = [];
      if (!queue.length) return;
      const wait = sentAt + TRAIL_GAP_MS - Date.now();
      if (wait > 0) return soon(wait);
      out();
    },
    drain() {
      stop();
      if (shut()) queue = [];
      if (queue.length) out();
    },
    drop() {
      stop();
      queue = [];
    },
    get waiting() {
      return queue.length;
    },
  };
  return post;
}

/* ------------------------------- the reader ----------------------------- */

/** the reader's word, for a browser whose storage refuses it */
let offHere = false;
const offWatch = new Set<() => void>();

export function trailOff(): boolean {
  try {
    return localStorage.getItem(TRAIL_OFF_KEY) === '1' || offHere;
  } catch {
    return offHere;
  }
}

const post = trailPost((events) => onlineWire()?.trail(events) ?? false, () => !ONLINE_URL || trailOff());

/** the reader says no, or yes again: no says it for what is waiting too */
export function setTrailOff(off: boolean): void {
  offHere = off;
  try {
    if (off) localStorage.setItem(TRAIL_OFF_KEY, '1');
    else localStorage.removeItem(TRAIL_OFF_KEY);
  } catch {
    /* this visit only */
  }
  if (off) post.drop();
  for (const f of offWatch) f();
}

export function useTrailOff(): boolean {
  return useSyncExternalStore(
    (f) => {
      offWatch.add(f);
      return () => {
        offWatch.delete(f);
      };
    },
    trailOff,
    () => false,
  );
}

/* the page going, or put away: what waits leaves now */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => post.drain());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') post.drain();
  });
}

/* ------------------------------- the guide ------------------------------ */

/** the record as this visit last wrote it; once the storage has refused
 *  it — full, or shut — it is the record, and what the storage still
 *  holds from before is stale: read back, it would draw a new id or say
 *  again what was said */
let kept: TrailRecord | null = null;
let refused = false;

function readRecord(): TrailRecord | null {
  if (refused) return kept;
  try {
    return recordOf(localStorage.getItem(TRAIL_KEY));
  } catch {
    refused = true;
    return kept;
  }
}

function drawId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** the build (vite.config's buildName), in the letters the office takes */
const VERSION = String(import.meta.env.VITE_VERSION ?? import.meta.env.MODE ?? 'dev').replace(/[^\w.+-]/g, '-').slice(0, 40) || 'dev';

function note(s: Sight): void {
  if (!s.table || !s.c) return;
  const r = readRecord();
  if (!s.tutorial && r?.code !== s.table) return;
  const { record, steps } = stepsOf(r, s, Date.now(), drawId);
  if (record && record !== r) {
    kept = record;
    try {
      localStorage.setItem(TRAIL_KEY, JSON.stringify(record));
    } catch {
      /* the record lives for this visit */
      refused = true;
    }
  }
  if (!steps.length) return;
  const view = viewOf(window.innerWidth, window.innerHeight, window.matchMedia?.('(pointer: coarse)').matches ?? false);
  for (const e of steps) post.push({ ...e, view, lang: getLang(), version: VERSION });
  /* the end of the story leaves at once: the page may be closed next */
  if (steps.some((e) => e.kind === 'left' || e.kind === 'finished')) post.flush();
}

/** the guide's trail, noted as it renders: the lesson in view (with how
 *  it is given, and the lesson that led to the loan), and the progress */
export function useGuideTrail(table: string | null, tutorial: boolean, c: LessonCtx | null, p: Progress, shown: string | null, mode: Mode | null, from: string | null): void {
  useEffect(() => note({ table, tutorial, c, p, shown, mode, from }), [table, tutorial, c, p, shown, mode, from]);
}

/** the guide left, on the lesson on show */
export function leftGuide(table: string | null, c: LessonCtx | null, p: Progress, lesson: string): void {
  note({ table, tutorial: true, c, p, shown: null, mode: null, from: null, left: lesson });
}
