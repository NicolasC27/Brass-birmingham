import { setupOf } from './actions';
import { judgeOf } from './analysis';
import type { JudgeId, Reading, Verdict, Weighed } from './analysis';
import { analysisKey, isWhole, keepAnalysis, readKept } from './analysisKeep';
import type { Kept } from './analysisKeep';
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
}

const EMPTY: Snapshot = { key: '', seat: -1, judge: 'long', seats: {}, verdicts: {}, roads: {}, total: 0, moves: 0, done: 0, running: false };

let snap: Snapshot = EMPTY;
/* the workers reading now: two share a fresh game, half the positions each */
let workers: Worker[] = [];
const parts = new Map<Worker, { done: number; total: number; over: boolean }>();
let written = 0;
const watchers = new Set<() => void>();

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
  if (snap.running) {
    snap = { ...snap, running: false };
    tell();
  }
}

const keep = (): void => {
  keepAnalysis(snap.key, snap.moves, { seats: snap.seats, verdicts: snap.verdicts, roads: snap.roads, total: snap.total, done: snap.done });
};

/** read this game for this seat, and keep the figures as they land. Starts
 *  nothing when the same reading is already under way, or when the shelf
 *  already holds it whole. */
export function readGame(game: GameState, table: string, seat: number, judge: JudgeId = 'long'): Snapshot {
  if (seat < 0 || !game.actions.length) return snap;
  const key = analysisKey(table, game.seed, judge);
  const moves = game.actions.length;
  const kept = readKept(key, moves);
  const whole = isWhole(kept, moves);
  /* the same reading, still going: nothing to start — every seat's turns are
     being read, so a change of seat only says which one the panel shows */
  if (workers.length && snap.key === key && snap.moves === moves) {
    if (snap.seat !== seat) {
      snap = { ...snap, seat };
      tell();
    }
    return snap;
  }
  /* the shelf holds it all, this seat's turns included */
  if (whole && kept!.verdicts[seat]) {
    if (snap.key !== key || snap.seat !== seat || snap.moves !== moves || snap.running) {
      snap = { ...kept!, key, seat, judge, done: kept!.total, total: kept!.total, running: false };
      tell();
    }
    return snap;
  }
  stopReading();
  written = 0;
  const read = judgeOf(judge);
  const ask: Ask = { setup: setupOf(game), seed: game.seed, actions: game.actions, me: seat, judge: read.judge, passes: read.passes, all: true };
  /* nothing kept, or a reading left halfway: read it through. A reading of a
     shorter game reads on from where it stopped, and one that only wants this
     seat's turns leaves the positions alone. A game read from scratch is split
     between two workers, half the positions each, on two cores */
  const asks: Ask[] =
    !kept && moves > 8 ? (() => {
      const mid = Math.ceil((moves + 1) / 2);
      return [{ ...ask, range: [0, mid] }, { ...ask, range: [mid, moves + 1] }];
    })()
    : !kept ? [ask]
    : kept.moves < moves ? [{ ...ask, from: kept.moves }]
    : whole ? [{ ...ask, turnsOnly: true }]
    : [ask];
  const onNote = (w: Worker) => (e: MessageEvent<Note>) => {
    const n = e.data;
    const part = parts.get(w) ?? { done: 0, total: 0, over: false };
    if (n.kind === 'position') {
      part.done = n.done;
      part.total = n.total;
      snap = { ...snap, seats: { ...snap.seats, [n.k]: n.seats } };
    } else if (n.kind === 'turn') {
      part.done = n.done;
      part.total = n.total;
      snap = { ...snap, verdicts: { ...snap.verdicts, [n.seat]: { ...(snap.verdicts[n.seat] ?? {}), [n.verdict.at]: n.verdict } } };
    } else if (n.kind === 'roads') {
      snap = { ...snap, roads: { ...snap.roads, [seat]: { ...(snap.roads[seat] ?? {}), [n.key]: n.roads } } };
    } else if (n.kind === 'done') {
      part.over = true;
      part.done = part.total;
    } else if (n.kind === 'failed') {
      stopReading();
      return;
    }
    parts.set(w, part);
    const all = [...parts.values()];
    const done = all.reduce((sum, p) => sum + p.done, 0);
    const total = all.reduce((sum, p) => sum + p.total, 0);
    snap = { ...snap, done, total };
    if (all.length === workers.length && all.every((p) => p.over)) {
      snap = { ...snap, done: snap.total, running: false };
      keep();
      /* the seat's game, summed up for the desk's sheet of progress */
      if (snap.verdicts[seat]) recordProgress(game, table, seat, snap.verdicts[seat]);
      stopReading();
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
  if (!workers.length) return snap;
  snap = {
    key,
    seat,
    judge,
    moves,
    seats: kept?.seats ?? {},
    verdicts: kept?.verdicts ?? {},
    roads: kept?.roads ?? {},
    total: 0,
    done: 0,
    running: true,
  };
  tell();
  return snap;
}

/** a line's roads, read longer by the panel's own worker: they join the
 *  reading and the shelf, so the same line is never read twice */
export function keepRoads(key: string, seat: number, line: string, roads: Weighed[]): void {
  if (snap.key !== key) return;
  snap = { ...snap, roads: { ...snap.roads, [seat]: { ...(snap.roads[seat] ?? {}), [line]: roads } } };
  if (!snap.running) keep();
  tell();
}

export type { Kept, Reading, Verdict, Weighed };
