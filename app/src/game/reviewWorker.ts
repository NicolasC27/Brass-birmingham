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
import { chooseBotAction, evaluate } from './search';
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

/** one move of the reader's, beside the one the machine would have made */
export interface Second {
  /** the index of the move in the log */
  at: number;
  era: 'canal' | 'rail';
  round: number;
  yours: GameAction;
  theirs: GameAction;
  /** how much better the machine reads its own move, in its own units */
  gap: number;
}

export type Note = { kind: 'progress'; done: number; total: number } | { kind: 'done'; seconds: Second[] } | { kind: 'failed'; why: string };

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
  const seconds: Second[] = [];
  let done = 0;
  yield { kind: 'progress', done: 0, total: mine };
  for (let at = 0; at < actions.length; at += 1) {
    const a = actions[at];
    const who = actorOf(s, a);
    if (readable(s, a, seat)) {
      const before = s;
      const theirs = chooseBotAction(before, seat, { budgetMs, strength: 1 });
      const yoursAfter = applyAction(before, seat, a).state;
      const theirsAfter = theirs ? applyAction(before, seat, theirs).state : null;
      if (theirs && yoursAfter && theirsAfter) {
        const gap = Math.round((evaluate(theirsAfter, seat) - evaluate(yoursAfter, seat)) * 10) / 10;
        /* the same move read twice is no second opinion */
        if (gap > 0 && JSON.stringify(theirs) !== JSON.stringify(a)) seconds.push({ at, era: before.era, round: before.round, yours: a, theirs, gap });
      }
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
  /* the widest gaps first: those are the moves worth looking at again */
  seconds.sort((x, y) => y.gap - x.gap);
  yield { kind: 'done', seconds };
}

/* the worker's own mouth, when this module is loaded as one */
if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent<Ask>) => {
    for (const note of readGame(e.data)) self.postMessage(note);
  };
}
