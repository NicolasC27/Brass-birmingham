/* ------------------------------------------------------------------ */
/* The guided game's trail, as the office and the direction read it.   */
/*                                                                     */
/* What the lessons did at one guided table: a lesson shown, passed —  */
/* by its deed, by Next or by Skip — set aside, shown as already done, */
/* the detour to the loan, the guide left, the machine let play on,    */
/* the game played out. Each event carries a random id drawn with the  */
/* table — never the account, never the table's code — and no more     */
/* than the lesson, where the game stood, the kind of screen, the      */
/* language, the build and the deal: enough to see where beginners     */
/* stop, nothing to find one of them by. Shared by the browser that    */
/* writes it (components/game/guideTrail.ts), the office that keeps it */
/* (server/store.ts) and the direction's page, which reads it summed   */
/* up and never one table at a time.                                   */
/* ------------------------------------------------------------------ */

export const TRAIL_KINDS = ['shown', 'already', 'passed', 'later', 'detour', 'left', 'playOn', 'finished'] as const;
export type TrailKind = (typeof TRAIL_KINDS)[number];

/** the screen, coarsely: a mouse, or a finger on a tablet held either
 *  way, or on anything smaller */
export const VIEWS = ['desktop', 'tablet-landscape', 'tablet-portrait', 'touch'] as const;
export type View = (typeof VIEWS)[number];

export const TRAIL_LANGS = ['fr', 'en', 'es', 'de'] as const;

/** how a lesson was passed: its deed done, read on from, or skipped */
export const PASSED = ['deed', 'next', 'skip'] as const;
export type Passed = (typeof PASSED)[number];

/** the word a kind of event carries: how a lesson was passed, whether the
 *  machine now plays on, how the game ended */
const HOWS: Partial<Record<TrailKind, readonly string[]>> = { passed: PASSED, playOn: ['on', 'off'], finished: ['played', 'abandoned'] };

export interface TrailEvent {
  /** the guided table's random id: nothing else names it */
  id: string;
  kind: TrailKind;
  /** the lesson it is about ('' when there is none) */
  lesson: string;
  how?: string;
  /** the game played out: the reader's points, then the machine's */
  vp?: [number, number];
  /** where the game stood: the round, and the actions played */
  round: number;
  at: number;
  /** seconds since the table's trail began */
  s: number;
  view: View;
  lang: string;
  version: string;
  /** the guided deal */
  seed: number;
}

/** the events of one frame, at most */
export const TRAIL_BATCH = 40;
/** the events one table may leave: a guided game says a hundred or so */
export const TRAIL_CAP = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
/** how long the office keeps them */
export const TRAIL_DAYS = 180;
export const TRAIL_MS = TRAIL_DAYS * DAY_MS;
/** the office notes the day an event came in, not its moment: a moment,
 *  with the deal and the move played, would find the table in the
 *  register of games at home, and its account with it */
export const dayOf = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;
/** a table not played out and silent since the day before yesterday —
 *  a whole day at least, read off the days its events came in — was let go */
export const STALE_MS = 2 * DAY_MS;
/** a screen or a deal read alone over fewer tables than this is not read:
 *  the two together could narrow the funnel down to one table's story */
export const TRAIL_FEW = 5;

const ID = /^[0-9a-f]{16}$/;
const LESSON = /^[A-Za-z]{0,24}$/;
const VERSION = /^[\w.+-]{1,40}$/;
const whole = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const one = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** an event as it came over the wire, checked and cut to its fields — null
 *  when anything in it is not what a guided table says */
export function eventOf(raw: unknown): TrailEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (!one(TRAIL_KINDS, e.kind) || typeof e.id !== 'string' || !ID.test(e.id) || typeof e.lesson !== 'string' || !LESSON.test(e.lesson)) return null;
  const hows = HOWS[e.kind];
  if (hows ? !one(hows, e.how) : e.how !== undefined) return null;
  const vp = e.vp;
  if (e.kind === 'finished' ? !(Array.isArray(vp) && vp.length === 2 && vp.every((v) => whole(v, 999))) : vp !== undefined) return null;
  if (!whole(e.round, 300) || !whole(e.at, 5000) || !whole(e.s, TRAIL_DAYS * 24 * 60 * 60) || !whole(e.seed, 2 ** 32 - 1)) return null;
  if (!one(VIEWS, e.view) || !one(TRAIL_LANGS, e.lang) || typeof e.version !== 'string' || !VERSION.test(e.version)) return null;
  return {
    id: e.id,
    kind: e.kind,
    lesson: e.lesson,
    ...(hows ? { how: e.how as string } : {}),
    ...(Array.isArray(vp) ? { vp: [vp[0] as number, vp[1] as number] as [number, number] } : {}),
    round: e.round,
    at: e.at,
    s: e.s,
    view: e.view,
    lang: e.lang,
    version: e.version,
    seed: e.seed,
  };
}

/* ------------------------------ summed up ----------------------------- */

/** an event as the office keeps it: with the day it came in (dayOf) */
export interface TrailRow extends TrailEvent {
  seen: number;
}

/** the tables the funnel is read over: one kind of screen, one deal */
export interface TrailFilter {
  view?: View;
  seed?: number;
}

/** a filter as sent over the wire, checked: what is not one is dropped */
export function filterOf(raw: unknown): TrailFilter {
  const f = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { ...(one(VIEWS, f.view) ? { view: f.view } : {}), ...(whole(f.seed, 2 ** 32 - 1) ? { seed: f.seed } : {}) };
}

/** one lesson, over every table that came to it */
export interface LessonFunnel {
  id: string;
  /** tables it was shown at (or passed at, folded away) */
  shown: number;
  /** tables it was shown at as a deed already done */
  already: number;
  /** tables it was passed at, by its deed, by Next, by Skip */
  deed: number;
  next: number;
  skip: number;
  /** times it was set aside */
  later: number;
  /** tables it sent to the loan first */
  detour: number;
  /** tables whose reader left the guide on it */
  left: number;
  /** tables let go on it: not played out, silent a day or more */
  stopped: number;
  /** tables whose game ended with the guide this far */
  closing: number;
  /** from shown to passed, the median: actions played, and seconds */
  actions: number | null;
  seconds: number | null;
}

/** the tables of one kind of screen, or of one deal */
export interface TrailSplit {
  key: string;
  tables: number;
  played: number;
  abandoned: number;
  left: number;
  stopped: number;
  /** over the games played out: won, tied, and the mean gap in points */
  wins: number;
  ties: number;
  gap: number | null;
  /** the lessons passed at a table, the median */
  passed: number | null;
}

export interface GuideFunnel {
  tables: number;
  events: number;
  played: number;
  abandoned: number;
  left: number;
  stopped: number;
  /** tables that let the machine play on */
  playOn: number;
  wins: number;
  ties: number;
  gap: number | null;
  lessons: LessonFunnel[];
  views: TrailSplit[];
  seeds: TrailSplit[];
  /** the first and the last event kept */
  from: number | null;
  to: number | null;
  days: number;
  /** the filter kept fewer than TRAIL_FEW tables: their count alone, with
   *  the splits over them all, and nothing of what they did */
  thin: boolean;
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** one table's events read together */
interface Table {
  view: View;
  seed: number;
  events: TrailRow[];
  last: number;
  end: TrailRow | null;
  left: TrailRow | null;
  /** the lesson it went silent on, when it was let go */
  stopped: string | null;
  passed: number;
}

function tablesOf(rows: readonly TrailRow[], now: number): Table[] {
  const by = new Map<string, TrailRow[]>();
  for (const r of rows) {
    const list = by.get(r.id);
    if (list) list.push(r);
    else by.set(r.id, [r]);
  }
  return [...by.values()].map((list) => {
    /* in the order the table said them: its own clock, then as they came */
    const events = list.map((r, i) => ({ r, i })).sort((a, b) => a.r.s - b.r.s || a.i - b.i).map((x) => x.r);
    const views = new Map<View, number>();
    for (const e of events) views.set(e.view, (views.get(e.view) ?? 0) + 1);
    const view = [...views].reduce((best, v) => (v[1] > best[1] ? v : best))[0];
    const end = events.find((e) => e.kind === 'finished') ?? null;
    const left = events.find((e) => e.kind === 'left') ?? null;
    const last = events.reduce((m, e) => Math.max(m, e.seen), 0);
    const lastShown = [...events].reverse().find((e) => e.kind === 'shown' || e.kind === 'already');
    const stopped = !end && !left && now - last > STALE_MS ? (lastShown?.lesson ?? '') : null;
    return { view, seed: events[0].seed, events, last, end, left, stopped, passed: new Set(events.filter((e) => e.kind === 'passed').map((e) => e.lesson)).size };
  });
}

function splitOf(key: string, tables: readonly Table[]): TrailSplit {
  const played = tables.filter((t) => t.end?.how === 'played');
  const gaps = played.map((t) => (t.end!.vp?.[0] ?? 0) - (t.end!.vp?.[1] ?? 0));
  return {
    key,
    tables: tables.length,
    played: played.length,
    abandoned: tables.filter((t) => t.end?.how === 'abandoned').length,
    left: tables.filter((t) => t.left).length,
    stopped: tables.filter((t) => t.stopped !== null).length,
    wins: gaps.filter((d) => d > 0).length,
    ties: gaps.filter((d) => d === 0).length,
    gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    passed: median(tables.map((t) => t.passed)),
  };
}

/** the funnel: every lesson in the guide's order (then any the order no
 *  longer holds), over the tables the filter keeps; the splits by screen
 *  and by deal over them all. Counts and medians only — no table's own
 *  story comes out of it, nor out of a filter that keeps too few */
export function funnelOf(rows: readonly TrailRow[], order: readonly string[], now = Date.now(), filter: TrailFilter = {}): GuideFunnel {
  const all = tablesOf(rows, now);
  const views = VIEWS.map((v) => splitOf(v, all.filter((t) => t.view === v))).filter((s) => s.tables > 0);
  const seeds = [...new Set(all.map((t) => t.seed))].sort((a, b) => a - b).map((seed) => splitOf(String(seed), all.filter((t) => t.seed === seed)));
  const narrowed = filter.view !== undefined || filter.seed !== undefined;
  const tables = all.filter((t) => (filter.view === undefined || t.view === filter.view) && (filter.seed === undefined || t.seed === filter.seed));
  if (narrowed && tables.length < TRAIL_FEW)
    return { tables: tables.length, events: 0, played: 0, abandoned: 0, left: 0, stopped: 0, playOn: 0, wins: 0, ties: 0, gap: null, lessons: [], views, seeds, from: null, to: null, days: TRAIL_DAYS, thin: true };
  const ids = [...order];
  for (const t of tables) for (const e of t.events) if (e.lesson && !ids.includes(e.lesson)) ids.push(e.lesson);
  const rowOf = new Map<string, LessonFunnel & { spans: [number, number][] }>(
    ids.map((id) => [id, { id, shown: 0, already: 0, deed: 0, next: 0, skip: 0, later: 0, detour: 0, left: 0, stopped: 0, closing: 0, actions: null, seconds: null, spans: [] }]),
  );
  for (const t of tables) {
    const first = new Map<string, TrailRow>();
    const came = new Set<string>();
    const already = new Set<string>();
    const detour = new Set<string>();
    const passed = new Map<string, TrailRow>();
    for (const e of t.events) {
      if (!e.lesson) continue;
      const row = rowOf.get(e.lesson)!;
      if (e.kind === 'shown' || e.kind === 'already') {
        if (!first.has(e.lesson)) first.set(e.lesson, e);
        came.add(e.lesson);
        if (e.kind === 'already') already.add(e.lesson);
      }
      if (e.kind === 'passed' && !passed.has(e.lesson)) {
        passed.set(e.lesson, e);
        came.add(e.lesson);
      }
      if (e.kind === 'later') row.later += 1;
      if (e.kind === 'detour') detour.add(e.lesson);
    }
    for (const id of came) rowOf.get(id)!.shown += 1;
    for (const id of already) rowOf.get(id)!.already += 1;
    for (const id of detour) rowOf.get(id)!.detour += 1;
    for (const [id, e] of passed) {
      const row = rowOf.get(id)!;
      if (e.how === 'deed' || e.how === 'next' || e.how === 'skip') row[e.how] += 1;
      const from = first.get(id);
      if (from) row.spans.push([Math.max(0, e.at - from.at), Math.max(0, e.s - from.s)]);
    }
    if (t.left?.lesson) rowOf.get(t.left.lesson)!.left += 1;
    if (t.stopped) rowOf.get(t.stopped)!.stopped += 1;
    if (t.end?.lesson) rowOf.get(t.end.lesson)!.closing += 1;
  }
  const lessons = ids.map((id) => {
    const { spans, ...row } = rowOf.get(id)!;
    return { ...row, actions: median(spans.map((x) => x[0])), seconds: median(spans.map((x) => x[1])) };
  });
  /* the lessons the order no longer holds, and no table of the filter came to, are not listed */
  const kept = lessons.filter((l, i) => i < order.length || l.shown + l.later + l.detour + l.left + l.closing > 0);
  const sum = splitOf('', tables);
  /* the span of what is kept, read without spreading a register into arguments */
  let from: number | null = null;
  let to: number | null = null;
  for (const t of tables)
    for (const e of t.events) {
      if (from === null || e.seen < from) from = e.seen;
      if (to === null || e.seen > to) to = e.seen;
    }
  return {
    tables: sum.tables,
    events: tables.reduce((n, t) => n + t.events.length, 0),
    played: sum.played,
    abandoned: sum.abandoned,
    left: sum.left,
    stopped: sum.stopped,
    playOn: tables.filter((t) => t.events.some((e) => e.kind === 'playOn' && e.how === 'on')).length,
    wins: sum.wins,
    ties: sum.ties,
    gap: sum.gap,
    lessons: kept,
    views,
    seeds,
    from,
    to,
    days: TRAIL_DAYS,
    thin: false,
  };
}
