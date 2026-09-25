/* ------------------------------------------------------------------ */
/* The second reading: what the machine would have played in your seat. */
/*                                                                     */
/* The search thinks on whatever thread it is given, and it is slow by  */
/* design, so it is given one of its own here: the page asks, this      */
/* replays the log, and at each of the reader's moves it asks the       */
/* machine for its own and measures the distance between the two.      */
/*                                                                     */
/* Its verdict is an opinion, and the page says so. The machine plays   */
/* about as well as a strong table and no better — it has been measured */
/* refusing lines that strong players call best.                        */
/* ------------------------------------------------------------------ */

import { actorOf, applyAction } from './actions';
import type { GameAction } from './actions';
import { newGame } from './engine';
import { chooseBotAction, evaluate, searchTurn } from './search';
import type { GameState, SetupPayload } from './types';

export interface Ask {
  setup: SetupPayload;
  seed: number;
  actions: GameAction[];
  /** the seat whose moves are read */
  seat: number;
  /** how long the machine may think about each move */
  budgetMs?: number;
}

/** one move of the reader's, beside the ones it could have played
 *
 *  The machine's reading is on a scale of its own — banked points, what may
 *  still flip, cash, income and position, blended — and that scale drifts
 *  as a game runs on: early moves are worth far more to it than late ones.
 *  A move is therefore not judged against a fixed bar but against the other
 *  moves open at that very table: the best of them, and the middling one.
 *  `give` is what was given up in middling-move widths, which is a figure
 *  that means the same thing in the first round and the last. */
export interface Second {
  /** the index of the move in the log */
  at: number;
  era: 'canal' | 'rail';
  round: number;
  yours: GameAction;
  /** what the machine would have played, when it differs from the move */
  theirs: GameAction | null;
  /** the machine's reading of the table after the move played, the best
   *  move open, and the middling one */
  mine: number;
  best: number;
  median: number;
  /** how many moves were open at that table */
  choices: number;
  /** what was given up, measured in middling-move widths */
  give: number;
  /** the move played was the best reading of them all */
  top: boolean;
}

export type Note = { kind: 'progress'; done: number; total: number } | { kind: 'done'; moves: Second[] } | { kind: 'failed'; why: string };

/** a move of the given seat's that is worth a second reading */
const readable = (s: GameState, a: GameAction, seat: number): boolean =>
  actorOf(s, a) === seat && s.phase === 'action' && a.kind !== 'begin-rail' && a.kind !== 'concede' && a.kind !== 'resign';

/** how many moves the reading will look at — counted before it starts, so
 *  the caller's bar knows where it is going */
function countReadable(ask: Ask): number {
  let s: GameState;
  try {
    s = newGame(ask.setup, ask.seed);
  } catch {
    return 0;
  }
  let n = 0;
  for (const a of ask.actions) {
    if (readable(s, a, ask.seat)) n += 1;
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) break;
    s = r.state;
  }
  return n;
}

/** the reading, step by step, so a caller may show it moving */
export function* readGame(ask: Ask): Generator<Note, void, unknown> {
  const { setup, seed, actions, seat } = ask;
  const budgetMs = ask.budgetMs ?? 1200;
  let s: GameState;
  try {
    s = newGame(setup, seed);
  } catch (e) {
    yield { kind: 'failed', why: String(e) };
    return;
  }
  const mine = countReadable(ask);
  const moves: Second[] = [];
  let done = 0;
  yield { kind: 'progress', done: 0, total: mine };
  for (let at = 0; at < actions.length; at += 1) {
    const a = actions[at];
    const who = actorOf(s, a);
    if (readable(s, a, seat)) {
      const before = s;
      /* every move open at this table, each read one move on: the spread
         of the position, which is the only fair yardstick for the one
         played. The search fills this list on its way past, so it is free. */
      const read = searchTurn(before, seat, { budgetMs, strength: 1, rank: true });
      const ranked = read?.ranked ?? [];
      const yoursAfter = applyAction(before, seat, a).state;
      const played = yoursAfter ? evaluate(yoursAfter, seat) : 0;
      const scores = ranked.map((r) => r.score);
      const best = scores.length ? Math.max(scores[0], played) : played;
      const median = scores.length ? scores[Math.floor(scores.length / 2)] : played;
      const width = Math.max(0.5, best - median);
      const give = Math.round(((best - played) / width) * 100) / 100;
      const theirs = read?.action ?? chooseBotAction(before, seat, { budgetMs, strength: 1 });
      const same = !!theirs && JSON.stringify(theirs) === JSON.stringify(a);
      moves.push({
        at,
        era: before.era,
        round: before.round,
        yours: a,
        theirs: same ? null : theirs,
        mine: Math.round(played * 10) / 10,
        best: Math.round(best * 10) / 10,
        median: Math.round(median * 10) / 10,
        choices: scores.length,
        give: Math.max(0, give),
        top: give <= 0,
      });
      done += 1;
      yield { kind: 'progress', done, total: mine };
    }
    const r = applyAction(s, who, a);
    if (!r.state) {
      yield { kind: 'failed', why: `move ${at} (${a.kind}) refused — ${r.error ?? 'no reason'}` };
      return;
    }
    s = r.state;
  }
  /* in the order they were played: the page sorts them as it needs */
  yield { kind: 'done', moves };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask>) => {
    for (const note of readGame(e.data)) self.postMessage(note);
  };
}
