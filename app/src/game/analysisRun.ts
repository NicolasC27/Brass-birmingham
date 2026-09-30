import { setupOf } from './actions';
import { judgeOf, positionsOf, readingTotal } from './analysis';
import type { JudgeId, Reading, Verdict, Weighed } from './analysis';
import { analysisKey, isWhole, keepAnalysis, readKept } from './analysisKeep';
import type { Kept } from './analysisKeep';
import { CAPS, doneOf, foldHeld, foldPart } from './analysisMerge';
import type { Held, ReadingPart } from './analysisMerge';
import { SLICE, shareOf } from './analysisShare';
import type { Share } from './analysisShare';
import type { Ask, Note } from './analysisWorker';
import { recordProgress } from './progress';
import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* The one reading of a game.                                          */
/*                                                                     */
/* A game is read once, by one worker, whoever asked: the board starts */
/* it the moment the last move is played — and again at the turn of    */
/* the eras, to have the first half done early — and the panel, opened */
/* a moment later, does not start over. It watches the same reading,   */
/* shows what has landed and waits for the rest.                       */
/*                                                                     */
/* What is read goes on the shelf as it goes, not only at the end, so  */
/* a page reloaded halfway through picks the reading up where it was.  */
/*                                                                     */
/* At a table of the club the shelf is not the only copy: the office   */
/* keeps one for the whole table. It is asked for before anything is   */
/* read again, the game is shared out a stretch at a time so two       */
/* players never read the same positions, and what lands here goes     */
/* back up as it goes — so the last to open the panel pays nothing.    */
/* ------------------------------------------------------------------ */

/** a reading as it stands, for the panel to draw */
export interface Snapshot extends Kept {
  key: string;
  /** the seat whose turns are being judged */
  seat: number;
  /** the judge reading it */
  judge: JudgeId;
  done: number;
  /** what the pass set out to do (0 when nothing is running) */
  total: number;
  running: boolean;
  /** the other readers of this table at work on the same reading */
  readers: number;
}

const EMPTY: Snapshot = { key: '', seat: -1, judge: 'long', seats: {}, verdicts: {}, roads: {}, total: 0, moves: 0, done: 0, running: false, readers: 0 };

let snap: Snapshot = EMPTY;
/* the workers reading now: two share a fresh game, half the positions each */
let workers: Worker[] = [];
const parts = new Map<Worker, { done: number; total: number; over: boolean }>();
let written = 0;
/* the figures held, counted the way the workers count them: what was on the
   shelf when this reading started, then every pass they have posted since */
let base = 0;
const watchers = new Set<() => void>();
/* the passes behind each verdict held, which the panel never shows: they are
   there to tell a turn read three times from the same turn read once */
let grades: Held['grades'] = {};
/* the office's copy of this reading, when the game is a table's */
let share: Share | null = null;
/* what has been read here and not yet posted, and when the last batch went */
let outbox: ReadingPart | null = null;
let posted = 0;
/* the other readers' figures, as they come in */
let unlisten: (() => void) | null = null;
/* the reading this pass belongs to: a new one makes the old one let go */
let pass = 0;
/* the run under way, settled when every worker of it is over */
let finish: (() => void) | null = null;

const tell = () => watchers.forEach((f) => f());

/** the reading as it stands */
export const reading = (): Snapshot => snap;

/** watch the reading: the callback fires whenever a figure lands */
export function onReading(cb: () => void): () => void {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}

/** stop the reading under way (a game left, a seat changed) */
export function stopReading(): void {
  for (const w of workers) w.terminate();
  workers = [];
  parts.clear();
  unlisten?.();
  unlisten = null;
  share = null;
  outbox = null;
  finish?.();
  finish = null;
  if (snap.running) {
    snap = { ...snap, running: false };
    tell();
  }
}

const keep = (): void => {
  keepAnalysis(snap.key, snap.moves, { seats: snap.seats, verdicts: snap.verdicts, roads: snap.roads, total: snap.total, done: snap.done });
};

/** how far the reading has got: what this browser's workers have posted, and
    what the other readers of the table have sent in — never past the whole */
const far = (): number => Math.min(Math.max(base + [...parts.values()].reduce((sum, p) => sum + p.done, 0), doneOf({ ...snap, grades })), snap.total);

/* ---------------------------- the office -------------------------- */

/** figures from the office folded into the reading on show */
function fold(part: ReadingPart, readers?: number): void {
  const held = foldPart({ ...snap, grades }, part);
  grades = held.grades;
  snap = { ...snap, seats: held.seats, verdicts: held.verdicts, roads: held.roads, ...(readers === undefined ? {} : { readers }) };
  snap = { ...snap, done: far() };
  tell();
}

/** what this browser has just read, held back until there is a batch of it:
    a frame a figure would be a frame a second, and the office has a table
    to serve */
function stash(part: ReadingPart): void {
  if (!share) return;
  const out: ReadingPart = outbox ?? { moves: snap.moves };
  if (part.seats) out.seats = { ...(out.seats ?? {}), ...part.seats };
  if (part.verdicts) out.verdicts = [...(out.verdicts ?? []), ...part.verdicts];
  if (part.roads) out.roads = [...(out.roads ?? []), ...part.roads];
  if (part.total !== undefined) out.total = part.total;
  outbox = out;
  const full = Object.keys(out.seats ?? {}).length >= CAPS.positions / 2 || (out.verdicts?.length ?? 0) >= CAPS.verdicts / 2 || (out.roads?.length ?? 0) >= CAPS.lines / 2;
  if (full || Date.now() - posted > 4000) flush();
}

/** the batch, out to the office */
function flush(): void {
  if (!share || !outbox) return;
  const out = outbox;
  outbox = null;
  posted = Date.now();
  /* a frame has a size: the positions go in one batch, the turns in another */
  const seats = Object.entries(out.seats ?? {});
  for (let i = 0; i < seats.length; i += CAPS.positions) share.post({ moves: out.moves, total: out.total, seats: Object.fromEntries(seats.slice(i, i + CAPS.positions)) });
  for (let i = 0; i < (out.verdicts?.length ?? 0); i += CAPS.verdicts) share.post({ moves: out.moves, verdicts: out.verdicts!.slice(i, i + CAPS.verdicts) });
  for (let i = 0; i < (out.roads?.length ?? 0); i += CAPS.lines) share.post({ moves: out.moves, roads: out.roads!.slice(i, i + CAPS.lines) });
  if (!seats.length && !out.verdicts?.length && !out.roads?.length && out.total !== undefined) share.post({ moves: out.moves, total: out.total });
}

/* ---------------------------- the workers ------------------------- */

/** the workers set going on these asks; it settles when every one of them is
 *  over, when one of them gives up, or when the reading is dropped */
function run(asks: Ask[], seat: number): Promise<void> {
  const onNote = (w: Worker) => (e: MessageEvent<Note>) => {
    const n = e.data;
    const part = parts.get(w) ?? { done: 0, total: 0, over: false };
    if (n.kind === 'position') {
      part.done = n.done;
      part.total = n.total;
      snap = { ...snap, seats: { ...snap.seats, [n.k]: n.seats } };
      stash({ moves: snap.moves, seats: { [n.k]: n.seats } });
    } else if (n.kind === 'turn') {
      part.done = n.done;
      part.total = n.total;
      snap = { ...snap, verdicts: { ...snap.verdicts, [n.seat]: { ...(snap.verdicts[n.seat] ?? {}), [n.verdict.at]: n.verdict } } };
      grades = { ...grades, [n.seat]: { ...(grades[n.seat] ?? {}), [n.verdict.at]: n.passes } };
      stash({ moves: snap.moves, verdicts: [{ seat: n.seat, at: n.verdict.at, passes: n.passes, verdict: n.verdict }] });
    } else if (n.kind === 'roads') {
      snap = { ...snap, roads: { ...snap.roads, [seat]: { ...(snap.roads[seat] ?? {}), [n.key]: n.roads } } };
      stash({ moves: snap.moves, roads: [{ seat, line: n.key, roads: n.roads }] });
    } else if (n.kind === 'done') {
      part.over = true;
      part.done = part.total;
    } else if (n.kind === 'failed') {
      stopReading();
      return;
    }
    parts.set(w, part);
    const all = [...parts.values()];
    snap = { ...snap, done: far() };
    if (all.length === workers.length && all.every((p) => p.over)) {
      flush();
      base += all.reduce((sum, p) => sum + p.done, 0);
      for (const one of workers) one.terminate();
      workers = [];
      parts.clear();
      snap = { ...snap, done: far() };
      finish?.();
      finish = null;
      tell();
      return;
    }
    /* the shelf is written as the reading goes: a page reloaded halfway
       through finds the figures already read */
    if (snap.done - written >= 40) {
      written = snap.done;
      keep();
    }
    tell();
  };
  for (const one of asks) {
    let w: Worker;
    try {
      w = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      continue;
    }
    workers.push(w);
    parts.set(w, { done: 0, total: 0, over: false });
    w.onmessage = onNote(w);
    w.postMessage(one);
  }
  if (!workers.length) return Promise.resolve();
  return new Promise<void>((ok) => {
    finish = ok;
  });
}

/** the reading is over: the figures go on the shelf, the seat's game on the
 *  sheet of progress, and the panel stops waiting */
function land(game: GameState, table: string, seat: number): void {
  snap = { ...snap, done: far(), running: false };
  keep();
  /* the seat's game, summed up for the desk's sheet of progress */
  if (snap.verdicts[seat] && !table.startsWith('report:')) recordProgress(game, table, seat, snap.verdicts[seat]);
  stopReading();
  tell();
}

/* --------------------------- the reading -------------------------- */

/** what is left to read when the office is not in it: the whole game split
    between two workers, the rest of a reading left halfway, or this seat's
    turns alone when every position has been read already */
function asksFor(ask: Ask, kept: Kept | null, whole: boolean, moves: number): Ask[] {
  if (!kept && moves > 8) {
    const mid = Math.ceil((moves + 1) / 2);
    return [
      { ...ask, range: [0, mid] },
      { ...ask, range: [mid, moves + 1] },
    ];
  }
  if (!kept) return [ask];
  if (kept.moves < moves) return [{ ...ask, from: kept.moves }];
  return whole ? [{ ...ask, turnsOnly: true }] : [ask];
}

/** every turn of this seat read by every pass of the judge. At a table the
    positions are shared out between the readers, but a seat's own turns are
    its own business: another reader looks at them once, in passing, and that
    is not the reading this panel shows of its own moves */
function deepEnough(seat: number, passes: number): boolean {
  const held = grades[seat] ?? {};
  const turns = Object.keys(snap.verdicts[seat] ?? {});
  return turns.length > 0 && turns.every((at) => (held[Number(at)] ?? 0) >= passes);
}

/** the reading shared with the rest of the table: the office's copy first,
 *  then a stretch of the game at a time until it is covered — what the other
 *  readers land comes in on its own, through the share's own listener */
async function shareRead(game: GameState, table: string, seat: number, ask: Ask, moves: number, held: Share): Promise<void> {
  const mine = pass;
  let office: Held | null = null;
  try {
    const answer = await held.get();
    office = answer.reading;
    snap = { ...snap, readers: answer.readers };
  } catch {
    office = null;
  }
  if (pass !== mine || share !== held) return;
  /* a reading of a longer game than this one is a reading of another game */
  if (office && office.moves <= moves) {
    const both = foldHeld({ ...snap, grades }, office);
    grades = both.grades;
    base = Math.max(base, doneOf(both));
    snap = { ...snap, seats: both.seats, verdicts: both.verdicts, roads: both.roads, moves: Math.max(snap.moves, both.moves), done: far() };
    tell();
    /* the office had it all: nothing to read, and nothing to share out */
    if (isWhole(snap, moves) && snap.verdicts[seat]) {
      land(game, table, seat);
      return;
    }
  }
  const want = Math.max(8, Math.min(SLICE, Math.ceil((moves + 1) / 2)));
  /* the stretches read here already: handed the same one twice — the office
     never heard what was posted — this reader stops rather than read it again */
  const done = new Set<string>();
  for (;;) {
    const slices: Ask[] = [];
    let answered = true;
    for (let i = 0; i < 2; i++) {
      try {
        const slice = await held.claim(want);
        if (slice.hi <= slice.lo || done.has(`${slice.lo}:${slice.hi}`)) break;
        done.add(`${slice.lo}:${slice.hi}`);
        snap = { ...snap, readers: slice.readers };
        slices.push({ ...ask, range: [slice.lo, slice.hi] });
      } catch {
        answered = false;
        break;
      }
    }
    if (pass !== mine || share !== held) return;
    /* the office said nothing: read it here, the whole of it, as at home */
    if (!answered && !slices.length) {
      await run(asksFor(ask, null, false, moves), seat);
      break;
    }
    if (!slices.length) break;
    await run(slices, seat);
    if (pass !== mine || share !== held) return;
  }
  /* every position is read, by somebody — but a turn of this seat's another
     reader only glanced at is read again here, by every pass */
  if (pass === mine && share === held && !deepEnough(seat, ask.turnPasses?.length ?? 1)) await run([{ ...ask, turnsOnly: true, all: false }], seat);
  if (pass !== mine || share !== held) return;
  land(game, table, seat);
}

/** read this game for this seat, and keep the figures as they land. Starts
 *  nothing when the same reading is already under way, or when the shelf
 *  already holds it whole. `online` says the game is a table's: its reading
 *  is the office's, shared with everyone else at it. */
export function readGame(game: GameState, table: string, seat: number, judge: JudgeId = 'long', online = false): Snapshot {
  if (seat < 0 || !game.actions.length) return snap;
  const key = analysisKey(table, game.seed, judge);
  const moves = game.actions.length;
  const kept = readKept(key, moves);
  const whole = isWhole(kept, moves);
  /* the same reading, still going: nothing to start — every seat's turns are
     being read, so a change of seat only says which one the panel shows */
  if (snap.running && snap.key === key && snap.moves === moves) {
    if (snap.seat !== seat) {
      snap = { ...snap, seat };
      tell();
    }
    return snap;
  }
  /* the reading already in hand, whole, this seat's turns included: a change
     of seat costs nothing, and a table's reading is not asked for again */
  if (snap.key === key && snap.moves === moves && !snap.running && snap.verdicts[seat] && isWhole(snap, moves)) {
    if (snap.seat !== seat) {
      snap = { ...snap, seat };
      tell();
    }
    return snap;
  }
  /* the shelf holds it all, this seat's turns included */
  if (whole && kept!.verdicts[seat] && !online) {
    if (snap.key !== key || snap.seat !== seat || snap.moves !== moves || snap.running) {
      snap = { ...kept!, key, seat, judge, done: kept!.total, total: kept!.total, running: false, readers: 0 };
      tell();
    }
    return snap;
  }
  stopReading();
  pass += 1;
  written = 0;
  grades = {};
  const read = judgeOf(judge);
  const ask: Ask = { setup: setupOf(game), seed: game.seed, actions: game.actions, me: seat, judge: read.judge, passes: read.passes, turnPasses: read.turnPasses, all: true };
  const total = readingTotal(positionsOf(game), game.actions, seat, judge);
  /* the shelf says how far it got, counted the way the workers count */
  base = kept?.done ?? 0;
  snap = {
    key,
    seat,
    judge,
    moves,
    seats: kept?.seats ?? {},
    verdicts: kept?.verdicts ?? {},
    roads: kept?.roads ?? {},
    total,
    done: Math.min(base, total),
    running: true,
    readers: 0,
  };
  share = online ? shareOf(table, judge) : null;
  if (share) {
    posted = 0;
    unlisten = share.on((part, readers) => fold(part, readers));
    /* the shelf's copy is worth posting: the office may have none */
    if (kept) stash({ moves: kept.moves, seats: kept.seats, total });
    else stash({ moves, total });
    void shareRead(game, table, seat, ask, moves, share).catch(() => stopReading());
    tell();
    return snap;
  }
  const started = run(asksFor(ask, kept, whole, moves), seat);
  if (!workers.length) {
    snap = { ...snap, running: false };
    tell();
    return snap;
  }
  void started.then(() => {
    if (snap.key === key && snap.running) land(game, table, seat);
  });
  tell();
  return snap;
}

/** a line's roads, read longer by the panel's own worker: they join the
 *  reading and the shelf, so the same line is never read twice */
export function keepRoads(key: string, seat: number, line: string, roads: Weighed[]): void {
  if (snap.key !== key) return;
  snap = { ...snap, roads: { ...snap.roads, [seat]: { ...(snap.roads[seat] ?? {}), [line]: roads } } };
  if (share) {
    stash({ moves: snap.moves, roads: [{ seat, line, roads }] });
    flush();
  }
  if (!snap.running) keep();
  tell();
}

export type { Kept, Reading, Verdict, Weighed };
