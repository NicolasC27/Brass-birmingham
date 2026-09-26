import { applyAction, fallbackAction, setupOf } from './actions';
import { eraRounds, newGame } from './engine';
import type { GameAction } from './actions';
import { chooseBotAction, evaluate, searchTurn, worthTrying } from './search';
import type { Era, GameState } from './types';
import type { Grade } from './review';

/* ------------------------------------------------------------------ */
/* The analysis — a finished game read move by move, the way a chess    */
/* game is: every position on the board, an estimated chance of winning */
/* at each, the moves the reader played graded against the machine's    */
/* best, and at any of their turns the other roads: what else could have */
/* been played there, and where each would have left them.             */
/* ------------------------------------------------------------------ */

/** every position of the game: positions[k] is the table after k actions */
export function positionsOf(g: GameState): GameState[] {
  const setup = setupFrom(g);
  const out: GameState[] = [setup];
  let s = setup;
  for (const a of g.actions) {
    const r = applyAction(s, s.current, a);
    /* a vote is cast on anyone's turn, in the voter's name */
    const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
    if (!next) break;
    s = next;
    out.push(s);
  }
  return out;
}

/** how many points ahead of the best rival the judge sees this seat, in the judge's units */
export function edgeOf(s: GameState, me: number): number {
  const mine = evaluate(s, me);
  let best = -Infinity;
  s.players.forEach((_, i) => {
    if (i !== me) best = Math.max(best, evaluate(s, i));
  });
  return best === -Infinity ? 0 : mine - best;
}

/** the rounds still to be played after this one, both eras counted */
export function roundsLeft(s: GameState): number {
  const perEra = eraRounds(s.players.length);
  const eras = s.eraLength === 'short' ? 1 : 2;
  const played = (s.era === 'rail' ? perEra : 0) + s.round;
  return Math.max(0, eras * perEra - played);
}

/* The chance's constants, fitted on 340 tables of machines of uneven
   strength (98 000 positions, tools/bots/calibrate.ts then a log-loss
   fit): the width of the curve at the last round, how much it widens
   per round still to play, and how far a tie with the best rival sits
   below even while other rivals remain. Predicted deciles land within
   five points of the observed win rate at two, three and four seats.
   The judges that read on before weighing have scales of their own. */
export interface Scale {
  /** the width of the curve at the last round */
  width: number;
  /** how much it widens per round still to play */
  widen: number;
  /** how far a tie with the best rival sits below even, per rival beyond one and per round left */
  rivals: number;
}
/** the scale of a position weighed as it stands */
export const SHORT_SCALE: Scale = { width: 4.5, widen: 2, rivals: 0.7 };

/** the chance a lead gives, on a scale: a logistic, wider while rounds remain */
export function chanceOf(edge: number, left: number, seats: number, scale: Scale): number {
  const spread = scale.width * Math.sqrt(1 + scale.widen * left);
  const shift = scale.rivals * (seats - 2) * left;
  return 1 / (1 + Math.exp(-(edge - shift) / spread));
}

/** the chance of winning the judge gives this seat here, 0 to 1: a logistic
    on the edge, wider while the game is young — the same lead is worth less
    with eighteen rounds to play than with one — and, at a table of more than
    two, a tie with the best rival reads below even while rounds remain */
export function winChance(s: GameState, me: number): number {
  if (s.phase === 'game-over') {
    const top = Math.max(...s.players.map((p) => p.vp));
    return s.players[me].vp >= top ? 1 : 0;
  }
  return chanceOf(edgeOf(s, me), roundsLeft(s), s.players.length, SHORT_SCALE);
}

export type Quality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
/** a move graded on what it left on the table against the machine's best */
export function qualityOf(gap: number): Quality {
  if (gap <= 0.5) return 'best';
  if (gap < 2) return 'good';
  if (gap < 6) return 'inaccuracy';
  if (gap < 15) return 'mistake';
  return 'blunder';
}

export interface Road {
  action: GameAction;
  /** the table after it */
  after: GameState;
  chance: number;
}

/** the other roads from a position of the reader's: the moves worth trying
 *  there, each played out one step and weighed, the best first */
export function roadsFrom(s: GameState, me: number, keep = 8, played?: GameAction): Road[] {
  if (s.phase !== 'action' || s.current !== me) return [];
  /* every legal move, one road per distinct move — two cards that build the
     same tile in the same place are the same road */
  const seen = new Map<string, Road>();
  for (const action of worthTrying(s, me)) {
    const key = sameRoad(action);
    if (seen.has(key)) continue;
    const after = applyAction(s, me, action).state;
    if (after) seen.set(key, { action, after, chance: winChance(after, me) });
  }
  const roads = [...seen.values()].sort((a, b) => b.chance - a.chance);
  const top = roads.slice(0, keep);
  /* the move actually played always sits among them, however it ranks */
  if (played) {
    const key = sameRoad(played);
    if (!top.some((r) => sameRoad(r.action) === key)) {
      const it = roads.find((r) => sameRoad(r.action) === key);
      if (it) top.push(it);
      else {
        /* a move the search never offers, a plain pass say: still a road */
        const after = applyAction(s, me, played).state;
        if (after) top.push({ action: played, after, chance: winChance(after, me) });
      }
    }
  }
  return top;
}

/** a move stripped of the card it was paid with and of the slot and source
    the engine would pick alike: what it does on the board */
export function sameRoad(a: GameAction): string {
  const rest: Record<string, unknown> = { ...a };
  for (const k of ['card', 'slot', 'ironFrom', 'beerFrom', 'reason']) delete rest[k];
  return JSON.stringify(rest);
}

/* the setup a game began from, as the store keeps it on the state */
function setupFrom(g: GameState): GameState {
  return newGame(setupOf(g), g.seed);
}

/** a move of the machine's while a branch is followed on, and the table after it */
export interface Followed {
  seat: number;
  action: GameAction;
  after: GameState;
  /** a road the reader chose, not a move the machine played */
  pick?: boolean;
}

/** the machine plays every seat on from here until the reader's turn comes
    round again (or the game ends), so a branch shows the replies and the
    table as the reader would find it; each move keeps its table */
export function followToTurn(s: GameState, me: number, budgetMs = 40, most = 16): Followed[] {
  const played: Followed[] = [];
  let cur = s;
  let guard = 0;
  while (played.length < most && cur.phase !== 'game-over' && guard++ < most * 3) {
    if (cur.phase === 'scoring-canal') {
      const next = applyAction(cur, cur.current, { kind: 'begin-rail' }).state;
      if (!next) break;
      cur = next;
      continue;
    }
    /* a new turn of the reader's: not the one the branch left them in */
    if (played.length > 0 && cur.phase === 'action' && cur.current === me && (cur.round !== s.round || cur.turnPos !== s.turnPos || cur.era !== s.era)) break;
    const seat = cur.current;
    const action = chooseBotAction(cur, seat, { strength: 0.8, budgetMs }) ?? fallbackAction(cur, seat);
    const next = applyAction(cur, seat, action).state ?? applyAction(cur, seat, fallbackAction(cur, seat)).state;
    if (!next) break;
    played.push({ seat, action, after: next });
    cur = next;
  }
  return played;
}

/* ------------------------------------------------------------------ */
/* The long judge. A position weighed as it stands says little about a */
/* loan against a pass: the cash is on the table, the cost comes later. */
/* So, the way an engine reads the replies, the machine plays on a few  */
/* moves for every seat before the position is weighed — and every      */
/* figure the analysis shows, the curve, the roads and the grades, is   */
/* read on that one scale: the chance of winning.                       */
/* ------------------------------------------------------------------ */

export interface Judge {
  /** moves played on, every seat, before the table is weighed */
  plies: number;
  /** how long the machine thinks about each of them */
  budgetMs: number;
  /** the scale its leads are read on, fitted for this depth (tools/bots/calibrate.ts) */
  scale: Scale;
}

/* Each judge's scale is fitted on its own readings (tools/bots/calibrate.ts
   with DEEP=1: 96 tables of two to four uneven machines, 22 600 positions
   read by all three judges). The longer the reading, the better it tells
   the outcome — log loss 0.403 as the table stands, 0.391 five moves on,
   0.377 ten moves on — and each lands its deciles within five points. */
export const LONG_JUDGE: Judge = { plies: 5, budgetMs: 15, scale: { width: 7, widen: 0.5, rivals: 0.5 } };

/** the machine's move while a position is read on: the search plain, at the
    strength asked for — not chooseBotAction, whose easing bends to who sits
    at the table and pins the expert's seat at its best, neither of which a
    judge should care about */
function readerMove(s: GameState, seat: number, strength: number, budgetMs: number): GameAction {
  try {
    const r = searchTurn(s, seat, { strength, budgetMs });
    if (r) return r.action;
  } catch {
    /* a line the search loses: the plain move stands in */
  }
  return fallbackAction(s, seat);
}

/** the tables a few moves on, one per move, the machine playing every seat at
    `strength` — one continuation of the several a position is read by */
export function lookAhead(s: GameState, judge: Judge, strength = 1): GameState[] {
  const out: GameState[] = [];
  let cur = s;
  let guard = 0;
  while (out.length < judge.plies && cur.phase !== 'game-over' && guard++ < judge.plies * 3) {
    if (cur.phase === 'scoring-canal') {
      const next = applyAction(cur, cur.current, { kind: 'begin-rail' }).state;
      if (!next) break;
      cur = next;
      continue;
    }
    const seat = cur.current;
    const action = readerMove(cur, seat, strength, judge.budgetMs);
    const next = applyAction(cur, seat, action).state ?? applyAction(cur, seat, fallbackAction(cur, seat)).state;
    if (!next) break;
    cur = next;
    out.push(cur);
  }
  return out;
}

/** the lead read along the continuation: the mean over its tables, which
    steadies a figure that one table alone would leave to the last move */
export function deepEdge(s: GameState, me: number, judge: Judge, strength = 1): number {
  const path = lookAhead(s, judge, strength);
  if (!path.length) return edgeOf(s, me);
  return path.reduce((sum, p) => sum + edgeOf(p, me), 0) / path.length;
}

/** the chance of winning from here, read after the replies, on the judge's own scale */
export function deepChance(s: GameState, me: number, judge: Judge = LONG_JUDGE, strength = 1): number {
  if (s.phase === 'game-over') return winChance(s, me);
  const path = lookAhead(s, judge, strength);
  if (!path.length) return winChance(s, me);
  const last = path[path.length - 1];
  if (last.phase === 'game-over') return winChance(last, me);
  const edge = path.reduce((sum, p) => sum + edgeOf(p, me), 0) / path.length;
  return chanceOf(edge, roundsLeft(s), s.players.length, judge.scale);
}

/* ------------------------------------------------------------------ */
/* Three continuations, not one. A position played on once hangs on the */
/* line the machine happened to pick there: one loan taken a move early */
/* and the figure jumps. So it is played on three times, the machine a  */
/* shade weaker each time — a weaker machine picks a different line, not */
/* a worse position — and the reading is the mean of the three, with the */
/* spread between them kept: how far apart the three passes landed is    */
/* how sure the judge is, and the panel says so.                        */
/* ------------------------------------------------------------------ */

/** the strengths a position is read at, the flat-out pass first so the first
    figure to land is the best single one */
export const PASSES = [1, 0.85, 0.7] as const;

/** a position read by one or more continuations */
export interface Reading {
  /** the mean of the passes */
  chance: number;
  /** the lowest and the highest of them */
  low: number;
  high: number;
  /** how many passes it holds */
  passes: number;
}

/** several readings of the same position as one: the mean, and the spread */
export function blendChances(list: readonly number[]): Reading {
  const chance = list.reduce((sum, c) => sum + c, 0) / list.length;
  return { chance, low: Math.min(...list), high: Math.max(...list), passes: list.length };
}

/** half the spread between the passes, the figure the panel shows after the
    mean: « 34 % ± 6 » */
export const bandOf = (r: Reading): number => (r.high - r.low) / 2;

/** the position read by every pass at once — the worker reads them one pass
    at a time instead, so the curve lands early and sharpens after */
export function readChance(s: GameState, me: number, judge: Judge = LONG_JUDGE, strengths: readonly number[] = PASSES): Reading {
  return blendChances(strengths.map((x) => deepChance(s, me, judge, x)));
}

/** what a move may cost in chance before it stops being a good one: the
    grades of the review, on the one scale */
export const LOSS = { top: 0.01, good: 0.03, inaccuracy: 0.07, mistake: 0.15 } as const;

export const gradeOfLoss = (loss: number): Grade =>
  loss <= LOSS.top ? 'top' : loss <= LOSS.good ? 'good' : loss <= LOSS.inaccuracy ? 'inaccuracy' : loss <= LOSS.mistake ? 'mistake' : 'blunder';

/** a road as the long judge reads it, without the table it leads to (that
    is one applyAction away) — light enough to cross a worker's wire */
export interface Weighed {
  action: GameAction;
  chance: number;
}

/** the long judge's verdict on one move of the reader's */
export interface Verdict {
  /** the move's index in the log */
  at: number;
  round: number;
  era: Era;
  /** the roads open there, the played one among them, best first */
  roads: Weighed[];
  /** the chance after the move played, and after the best road */
  mine: number;
  best: number;
  /** what the move cost, in chance: best less mine, never below nought */
  loss: number;
  grade: Grade;
}

/** the reader's move at `before`, judged long: the roads worth a look are
    ranked as they stand, then each is read after the replies */
export function judgeTurn(before: GameState, me: number, played: GameAction, judge: Judge = LONG_JUDGE, strength = 1): Verdict | null {
  if (before.phase !== 'action' || before.current !== me) return null;
  const roads = roadsFrom(before, me, 8, played).map((r) => ({ action: r.action, chance: deepChance(r.after, me, judge, strength) })).sort((a, b) => b.chance - a.chance);
  if (!roads.length) return null;
  const key = sameRoad(played);
  const own = roads.find((r) => sameRoad(r.action) === key);
  const mine = own ? own.chance : (() => {
    const after = applyAction(before, me, played).state;
    return after ? deepChance(after, me, judge, strength) : roads[roads.length - 1].chance;
  })();
  const best = Math.max(mine, roads[0].chance);
  const loss = Math.max(0, best - mine);
  return { at: before.actions.length, round: before.round, era: before.era, roads, mine, best, loss, grade: gradeOfLoss(loss) };
}

/** the same turn read by several continuations: every road's chance is the
    mean of the passes that saw it, and the grade is read on that mean. A road
    one pass never offered counts only on the passes that did — the machine's
    own hand varies with its strength, and a road missed is not a road lost */
export function blendVerdicts(list: readonly Verdict[]): Verdict {
  const first = list[0];
  if (list.length === 1) return first;
  const sums = new Map<string, { action: GameAction; sum: number; n: number }>();
  for (const v of list) {
    for (const r of v.roads) {
      const key = sameRoad(r.action);
      const e = sums.get(key) ?? { action: r.action, sum: 0, n: 0 };
      e.sum += r.chance;
      e.n += 1;
      sums.set(key, e);
    }
  }
  const roads = [...sums.values()].map((e) => ({ action: e.action, chance: e.sum / e.n })).sort((a, b) => b.chance - a.chance);
  const mine = list.reduce((sum, v) => sum + v.mine, 0) / list.length;
  const best = Math.max(mine, roads[0]?.chance ?? mine);
  const loss = Math.max(0, best - mine);
  return { ...first, roads, mine, best, loss, grade: gradeOfLoss(loss) };
}

/** the roads of one turn read again, longer: what the panel asks for the
    turn being explored. One continuation only — the deep judge plays ten
    moves on, which steadies it, and the panel waits on this one */
export const DEEP_JUDGE: Judge = { plies: 10, budgetMs: 25, scale: { width: 6.5, widen: 0.5, rivals: 0.4 } };

export function weighRoads(before: GameState, me: number, roads: GameAction[], judge: Judge = DEEP_JUDGE): Weighed[] {
  return roads
    .map((action) => {
      const after = applyAction(before, me, action).state;
      return after ? { action, chance: deepChance(after, me, judge) } : null;
    })
    .filter((r): r is Weighed => !!r)
    .sort((a, b) => b.chance - a.chance);
}

/* ------------------------------------------------------------------ */
/* What a kept analysis was read by. A game read once is kept, so the  */
/* panel opens on its own figures instead of thinking again — but only */
/* while the judge that wrote them is the judge that stands. Bump this */
/* on any change to a judge, a scale, the passes or the grades.        */
/* ------------------------------------------------------------------ */
export const ANALYSIS_VERSION = 2;
