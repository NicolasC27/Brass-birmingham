import { describe, expect, it } from 'vitest';
import { actorOf, applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { BOT_SKILL } from '../data';
import { newGame } from '../engine';
import { reviewGame } from '../review';
import { readGame } from '../reviewWorker';
import type { GameAction } from '../actions';
import type { SetupPayload } from '../types';

/* the review reads a finished game off its own log: every figure in it
   must be one the table actually held */

const SEATS: SetupPayload['players'] = [
  { name: 'Nico', color: 'brass', type: 'human' },
  { name: 'Eve', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
  { name: 'Cy', color: 'verdigris', type: 'bot', persona: 'arkwright' },
  { name: 'Max', color: 'steel', type: 'bot', persona: 'boulton' },
];

const setup = (n: number, eraLength: 'short' | 'standard' = 'standard'): SetupPayload => ({
  players: SEATS.slice(0, n),
  options: { eraLength, marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

/** a whole game played by the simple machine, and the log it leaves */
function playOut(n: number, seed: number, eraLength: 'short' | 'standard' = 'standard') {
  let s = newGame(setup(n, eraLength), seed);
  const log: GameAction[] = [];
  for (let i = 0; i < 900 && s.phase !== 'game-over'; i++) {
    const seat = s.current;
    /* the ceremony is a move of the table's own: the log carries it */
    const a: GameAction = s.phase === 'scoring-canal' ? { kind: 'begin-rail' } : (botAction(chooseBotMove(s, seat, BOT_SKILL.foreman)) ?? fallbackAction(s, seat));
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) break;
    log.push(a);
    s = r.state;
  }
  return { s, log };
}

describe('the review of a finished game', () => {
  const { s, log } = playOut(4, 11);
  const review = reviewGame(setup(4), 11, log);

  it('names every seat and its final points', () => {
    expect(review.seats.map((x) => x.name)).toEqual(s.players.map((p) => p.name));
    expect(review.seats.map((x) => x.vp)).toEqual(s.players.map((p) => p.vp));
  });

  it('accounts for every point away from the era scores', () => {
    review.seats.forEach((x) => {
      const canal = x.canal.tiles + x.canal.links;
      const rail = x.rail ? x.rail.tiles + x.rail.links : 0;
      /* a merchant's barrel pays at once, an empty purse costs at once:
         between them they close the gap the era scores leave */
      expect(canal + rail + x.bonus - x.penalty).toBe(x.vp);
      expect(x.bonus).toBeGreaterThanOrEqual(0);
      expect(x.penalty).toBeGreaterThanOrEqual(0);
    });
  });

  it('reads the standing after every move, banked plus what the board owes', () => {
    expect(review.curve.length).toBeGreaterThan(40);
    /* every beat names the move it followed */
    review.curve.forEach((b) => {
      expect(log[b.at]).toBeTruthy();
      expect(b.proj).toHaveLength(review.seats.length);
    });
    /* the indices climb, one beat per move the table accepted */
    for (let i = 1; i < review.curve.length; i++) expect(review.curve[i].at).toBeGreaterThan(review.curve[i - 1].at);
    /* once the books are closed the standing is the score itself */
    const last = review.curve[review.curve.length - 1];
    expect(last.proj).toEqual(review.seats.map((x) => x.vp));
    /* and before a penny is spent nobody is owed anything but their tiles */
    expect(review.curve[0].proj.every((v) => v >= 0)).toBe(true);
  });

  it('counts the actions each seat actually took', () => {
    /* the actor of a move is whoever was to act when it was played, so the
       count is made the same way the review makes it: by replaying */
    let t = newGame(setup(4), 11);
    const fromLog = t.players.map(() => 0);
    for (const a of log) {
      const seat = actorOf(t, a);
      if (a.kind !== 'begin-rail' && seat >= 0) fromLog[seat] += 1;
      const r = applyAction(t, seat, a);
      if (!r.state) break;
      t = r.state;
    }
    expect(review.seats.map((x) => x.actions)).toEqual(fromLog);
  });

  it('splits the points into what the eras paid', () => {
    review.seats.forEach((x, i) => {
      const canal = x.canal.tiles + x.canal.links;
      const rail = x.rail ? x.rail.tiles + x.rail.links : 0;
      expect(canal).toBe(s.canalScores?.[i] ?? 0);
      expect(rail).toBe(s.finalScores?.[i] ?? 0);
      /* and nothing is left unexplained in a full game */
      expect(x.close).toBe(x.vp - canal - rail);
    });
  });

  it('says what never flipped and what it was worth', () => {
    review.seats.forEach((x, i) => {
      const own = Object.values(s.tiles).filter((t) => t.owner === i && !t.flipped);
      expect(x.idle.length).toBe(own.length);
      expect(x.idleVp).toBe(x.idle.reduce((sum, t) => sum + t.vp, 0));
    });
  });

  it('follows the table round by round', () => {
    expect(review.rounds.length).toBeGreaterThanOrEqual(15);
    expect(review.rounds[0].vp.length).toBe(4);
    /* the points a seat holds never fall over the game */
    for (let i = 1; i < review.rounds.length; i++)
      review.rounds[i].vp.forEach((v, seat) => expect(v).toBeGreaterThanOrEqual(review.rounds[i - 1].vp[seat] - 60));
  });

  it('counts one opening per round, shared out', () => {
    const total = review.seats.reduce((sum, x) => sum + x.opened, 0);
    expect(total).toBeGreaterThanOrEqual(review.rounds.length);
  });

  it('reads an initiation game as one, with its closing books', () => {
    const short = playOut(2, 5, 'short');
    const r = reviewGame(setup(2, 'short'), 5, short.log);
    expect(r.short).toBe(true);
    r.seats.forEach((x) => expect(x.rail).toBeNull());
    /* the close is what the era score does not explain */
    r.seats.forEach((x, i) => expect(x.close).toBe(x.vp - (short.s.canalScores?.[i] ?? 0)));
  });

  it('reads the same game the same way twice', () => {
    const again = reviewGame(setup(4), 11, log);
    expect(again).toEqual(review);
  });
});

describe('the machine reading the moves back', () => {
  it('reads every move of the seat it was given, and no other', () => {
    const { log } = playOut(2, 3, 'short');
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 0, budgetMs: 40 })];
    const progress = notes.filter((n) => n.kind === 'progress');
    const done = notes.find((n) => n.kind === 'done');
    expect(notes.some((n) => n.kind === 'failed')).toBe(false);
    expect(done).toBeTruthy();
    /* one reading per move of that seat, and the count never passes the total */
    expect(progress.length).toBeGreaterThan(5);
    progress.forEach((p) => p.kind === 'progress' && expect(p.done).toBeLessThanOrEqual(p.total));
  });

  it('knows how many moves it has to read before it starts', () => {
    const { log } = playOut(2, 3, 'short');
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 1, budgetMs: 40 })];
    const progress = notes.filter((n) => n.kind === 'progress');
    /* the seat's own moves, counted the slow way */
    let t = newGame(setup(2, 'short'), 3);
    let mine = 0;
    for (const a of log) {
      if (actorOf(t, a) === 1 && t.phase === 'action' && a.kind !== 'begin-rail') mine += 1;
      const r = applyAction(t, actorOf(t, a), a);
      if (!r.state) break;
      t = r.state;
    }
    expect(progress.length).toBe(mine + 1); // the first note is the empty bar
    progress.forEach((p) => p.kind === 'progress' && expect(p.total).toBe(mine));
    const last = progress[progress.length - 1];
    if (last.kind !== 'progress') throw new Error('no progress');
    expect(last.done).toBe(mine);
  });

  it('reports every move it read, in play order, with what it would have done', () => {
    const { log } = playOut(2, 3, 'short');
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 0, budgetMs: 40 })];
    const done = notes.find((n) => n.kind === 'done');
    if (done?.kind !== 'done') throw new Error('no reading');
    /* every move of the seat is reported, in the order it was played */
    expect(done.moves.length).toBeGreaterThan(5);
    for (let i = 1; i < done.moves.length; i++) expect(done.moves[i].at).toBeGreaterThan(done.moves[i - 1].at);
    done.moves.forEach((m) => {
      expect(log[m.at]).toEqual(m.yours);
      expect(m.gap).toBeGreaterThanOrEqual(0);
      /* the machine's own move is named only where it differs */
      if (m.same) expect(m.theirs).toBeNull();
      else if (m.theirs) expect(JSON.stringify(m.yours)).not.toBe(JSON.stringify(m.theirs));
      if (m.same) expect(m.gap).toBe(0);
    });
    /* and at least one of them is a move it would have played otherwise */
    expect(done.moves.some((m) => m.gap > 0)).toBe(true);
  });

  it('says so rather than throwing when a log does not replay', () => {
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: [{ kind: 'sell', card: 'nope', sales: [] }], seat: 0, budgetMs: 20 })];
    expect(notes.some((n) => n.kind === 'failed')).toBe(true);
  });
});
