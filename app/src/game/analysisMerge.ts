import { GRADES } from './review';
import type { Grade } from './review';
import type { GameAction } from './actions';
import type { Reading, Verdict, Weighed } from './analysis';
import type { Kept } from './analysisKeep';

/* ------------------------------------------------------------------ */
/* One reading, read by several.                                       */
/*                                                                     */
/* A table online is read by every player at it, and the reading is    */
/* the same for all of them: the same deal, the same log, the same     */
/* judge, and a machine that plays on the same way every time. So the  */
/* figures are pooled — the office keeps one copy of the reading and   */
/* everyone adds to it what they have read.                            */
/*                                                                     */
/* This is the folding, and it belongs to nobody: the office folds     */
/* what comes in from the tables, the panel folds what the office      */
/* sends back, and both go by the same rule — a figure read longer     */
/* wins over one read short, and anything that does not look like a    */
/* figure at all is thrown away at the door.                           */
/* ------------------------------------------------------------------ */

/** the office's copy: the reading as the shelf keeps it, and how many passes
    each verdict holds — that count never leaves this side, it is only there
    to tell a verdict read three times from the same one read once */
export interface Held extends Kept {
  /** per seat, the passes behind the kept verdict, by the move's index */
  grades: Record<number, Record<number, number>>;
}

/** what one reader has just read: a handful of positions, a few turns and
    the roads of a line or two — never a whole reading at once, a frame has
    a size and the panel posts as the figures land */
export interface ReadingPart {
  /** how many moves of the game the reader read — a shorter game is a
      reading of its own, and the office keeps the longer one */
  moves: number;
  /** positions read: the index in the log, then one reading per seat */
  seats?: Record<number, Reading[]>;
  /** turns judged, with the passes each verdict holds */
  verdicts?: { seat: number; at: number; passes: number; verdict: Verdict }[];
  /** roads read longer, by the line of moves that leads to them */
  roads?: { seat: number; line: string; roads: Weighed[] }[];
  /** what a reading of the whole game sets out to do (a slice says nothing) */
  total?: number;
}

/** the game a part is measured against: nothing may point outside it */
export interface Facts {
  /** how many moves the game holds */
  moves: number;
  /** how many seats are at the table */
  seats: number;
}

/** what one frame may carry, and what a figure may look like: a part that
    goes over any of these is not folded, it is dropped */
export const CAPS = {
  positions: 96,
  verdicts: 16,
  lines: 8,
  roads: 64,
  line: 200,
  passes: 8,
  rounds: 40,
  /** the longest game the office will hold a reading of */
  moves: 400,
} as const;

export const emptyHeld = (): Held => ({ seats: {}, verdicts: {}, roads: {}, grades: {}, total: 0, done: 0, moves: 0 });

/* ------------------------- what a figure is ----------------------- */

const rate = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const count = (x: unknown, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= hi;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

const cleanReading = (r: unknown): Reading | null =>
  object(r) && rate(r.chance) && rate(r.low) && rate(r.high) && count(r.passes, CAPS.passes) && r.passes > 0 && r.low <= r.high ? { chance: r.chance, low: r.low, high: r.high, passes: r.passes } : null;

/** a move is not replayed here — the office does not judge, it files. All
    that is asked of one is that it names a kind, so the panel can draw it */
const cleanAction = (a: unknown): GameAction | null => (object(a) && typeof a.kind === 'string' && a.kind.length <= 24 ? (a as unknown as GameAction) : null);

function cleanRoads(list: unknown): Weighed[] | null {
  if (!Array.isArray(list) || list.length > CAPS.roads) return null;
  const out: Weighed[] = [];
  for (const w of list) {
    if (!object(w) || !rate(w.chance)) return null;
    const action = cleanAction(w.action);
    if (!action) return null;
    out.push({ action, chance: w.chance });
  }
  return out;
}

function cleanVerdict(v: unknown, facts: Facts): Verdict | null {
  if (!object(v)) return null;
  if (!count(v.at, facts.moves - 1) || !count(v.round, CAPS.rounds) || (v.era !== 'canal' && v.era !== 'rail')) return null;
  if (!rate(v.mine) || !rate(v.best) || !rate(v.loss)) return null;
  if (typeof v.grade !== 'string' || !GRADES.includes(v.grade as Grade)) return null;
  const roads = cleanRoads(v.roads);
  if (!roads) return null;
  return { at: v.at, round: v.round, era: v.era, roads, mine: v.mine, best: v.best, loss: v.loss, grade: v.grade as Grade };
}

/** a part as it may be folded, or null when it cannot be believed: every
    index inside the game, every chance a chance, nothing beyond the caps */
export function cleanPart(raw: unknown, facts: Facts): ReadingPart | null {
  if (!object(raw) || !count(raw.moves, Math.min(facts.moves, CAPS.moves)) || facts.seats < 1) return null;
  const part: ReadingPart = { moves: raw.moves };
  if (raw.total !== undefined) {
    if (!count(raw.total, 1e6)) return null;
    part.total = raw.total;
  }
  if (raw.seats !== undefined) {
    if (!object(raw.seats)) return null;
    const entries = Object.entries(raw.seats);
    if (entries.length > CAPS.positions) return null;
    const seats: Record<number, Reading[]> = {};
    for (const [k, list] of entries) {
      const at = Number(k);
      /* a position is the table after k moves: there is one more of them than
         there are moves, the deal included */
      if (!count(at, facts.moves) || !Array.isArray(list) || list.length !== facts.seats) return null;
      const read = list.map(cleanReading);
      if (read.some((r) => !r)) return null;
      seats[at] = read as Reading[];
    }
    part.seats = seats;
  }
  if (raw.verdicts !== undefined) {
    if (!Array.isArray(raw.verdicts) || raw.verdicts.length > CAPS.verdicts) return null;
    const verdicts: ReadingPart['verdicts'] = [];
    for (const one of raw.verdicts) {
      if (!object(one) || !count(one.seat, facts.seats - 1) || !count(one.at, facts.moves - 1) || !count(one.passes, CAPS.passes) || one.passes < 1) return null;
      const verdict = cleanVerdict(one.verdict, facts);
      if (!verdict || verdict.at !== one.at) return null;
      verdicts.push({ seat: one.seat, at: one.at, passes: one.passes, verdict });
    }
    part.verdicts = verdicts;
  }
  if (raw.roads !== undefined) {
    if (!Array.isArray(raw.roads) || raw.roads.length > CAPS.lines) return null;
    const roads: ReadingPart['roads'] = [];
    for (const one of raw.roads) {
      if (!object(one) || !count(one.seat, facts.seats - 1) || typeof one.line !== 'string' || one.line.length > CAPS.line) return null;
      const weighed = cleanRoads(one.roads);
      if (!weighed) return null;
      roads.push({ seat: one.seat, line: one.line, roads: weighed });
    }
    part.roads = roads;
  }
  return part;
}

/* ---------------------------- the folding ------------------------- */

/** how many figures a reading holds: a pass at a position, a pass at a turn */
export const doneOf = (h: Held): number =>
  Object.values(h.seats).reduce((n, list) => n + (list[0]?.passes ?? 0), 0) + Object.values(h.grades).reduce((n, byMove) => n + Object.values(byMove).reduce((s, p) => s + p, 0), 0);

/** the shelf's own entry, as a reading the office would keep: nothing is
    known of the passes behind its verdicts, so a verdict from anywhere else
    wins over it — the office's copy is the fuller of the two */
export const heldOf = (k: Kept): Held => ({ ...k, grades: {} });

/** two readings of the same game as one. It is the same rule as a part's:
 *  the longer reading of a position or a turn wins, and roads already read
 *  are left alone — so a browser's shelf and the office's copy fold into
 *  each other whichever way round they are taken. */
export function foldHeld(into: Held, other: Held): Held {
  const out: Held = { ...into, moves: Math.max(into.moves, other.moves), seats: { ...into.seats }, verdicts: { ...into.verdicts }, roads: { ...into.roads }, grades: { ...into.grades } };
  for (const [k, list] of Object.entries(other.seats)) {
    const at = Number(k);
    if ((out.seats[at]?.[0]?.passes ?? 0) < (list[0]?.passes ?? 0)) out.seats[at] = list;
  }
  for (const [s, byMove] of Object.entries(other.verdicts)) {
    const seat = Number(s);
    for (const [m, verdict] of Object.entries(byMove)) {
      const at = Number(m);
      const passes = other.grades[seat]?.[at] ?? 0;
      if (out.verdicts[seat]?.[at] && (out.grades[seat]?.[at] ?? 0) >= passes) continue;
      out.verdicts[seat] = { ...(out.verdicts[seat] ?? {}), [at]: verdict };
      out.grades[seat] = { ...(out.grades[seat] ?? {}), [at]: passes };
    }
  }
  for (const [s, byLine] of Object.entries(other.roads)) {
    const seat = Number(s);
    for (const [line, roads] of Object.entries(byLine)) {
      if (out.roads[seat]?.[line]) continue;
      out.roads[seat] = { ...(out.roads[seat] ?? {}), [line]: roads };
    }
  }
  out.total = Math.max(out.total, other.total);
  out.done = out.total > 0 ? Math.min(doneOf(out), out.total) : doneOf(out);
  return out;
}

/** a part folded into a reading. Nothing is ever lost: a figure read by more
 *  passes takes the place of one read by fewer, and a figure read by fewer
 *  leaves the longer one alone — so the order the parts arrive in does not
 *  matter, and two readers who overlap agree in the end. */
export function foldPart(into: Held, part: ReadingPart): Held {
  /* a reading of a longer game than the one kept swallows it: a position is
     read forward and never looks at what came after, so the figures stand */
  const out: Held = { ...into, moves: Math.max(into.moves, part.moves), seats: { ...into.seats }, verdicts: { ...into.verdicts }, roads: { ...into.roads }, grades: { ...into.grades } };
  for (const [k, list] of Object.entries(part.seats ?? {})) {
    const at = Number(k);
    const had = out.seats[at];
    if (!had || (had[0]?.passes ?? 0) < (list[0]?.passes ?? 0)) out.seats[at] = list;
  }
  for (const { seat, at, passes, verdict } of part.verdicts ?? []) {
    if ((out.grades[seat]?.[at] ?? 0) > passes) continue;
    out.verdicts[seat] = { ...(out.verdicts[seat] ?? {}), [at]: verdict };
    out.grades[seat] = { ...(out.grades[seat] ?? {}), [at]: passes };
  }
  for (const { seat, line, roads } of part.roads ?? []) {
    out.roads[seat] = { ...(out.roads[seat] ?? {}), [line]: roads };
  }
  out.total = Math.max(out.total, part.total ?? 0);
  out.done = out.total > 0 ? Math.min(doneOf(out), out.total) : doneOf(out);
  return out;
}
