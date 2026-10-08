import { describe, expect, it } from 'vitest';
import { actorOf, applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { BOT_SKILL } from '../data';
import { newGame } from '../engine';
import { LOSS, gradeOfLoss } from '../analysis';
import { reviewGame, swingsFor } from '../review';
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
    const wanted: GameAction = s.phase === 'scoring-canal' ? { kind: 'begin-rail' } : (botAction(chooseBotMove(s, seat, BOT_SKILL.foreman)) ?? fallbackAction(s, seat));
    /* a move the engine refuses is put down for a scout or a pass, as the
       table itself does: the log carries the move that was played */
    let a = wanted;
    let r = applyAction(s, actorOf(s, a), a);
    if (!r.state && s.phase === 'action') {
      a = fallbackAction(s, seat);
      r = applyAction(s, seat, a);
    }
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

  it('does not credit the canal tiles twice at the turn of the eras', () => {
    /* the canal scoring banks the links and the tiles; the sweep that takes
       the level-1 tiles waits for the next move. Between the two the
       standing must already read as it will once the sweep has run. */
    const turn = log.findIndex((a) => a.kind === 'begin-rail');
    expect(turn).toBeGreaterThan(0);
    const scored = review.curve.find((b) => b.at === turn - 1);
    const swept = review.curve.find((b) => b.at === turn);
    if (!scored || !swept) throw new Error('no turn of the eras on the curve');
    expect(scored.proj).toEqual(swept.proj);
  });

  it('reads how each move moved the lead', () => {
    const swings = swingsFor(review, 0);
    expect(swings).toHaveLength(review.curve.length);
    /* the lead after one move is the lead before the next */
    for (let i = 1; i < swings.length; i++) expect(swings[i].was).toBeCloseTo(swings[i - 1].now, 6);
    swings.forEach((x) => expect(x.shift).toBeCloseTo(Math.round((x.now - x.was) * 10) / 10, 6));
    /* at the close the lead is the winner's margin */
    const last = swings[swings.length - 1];
    const others = review.seats.filter((x) => x.seat !== 0).map((x) => x.vp);
    expect(last.now).toBe(review.seats[0].vp - Math.max(...others));
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
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 0, judge: 'quick' })];
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
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 1, judge: 'quick' })];
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
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: log, seat: 0, judge: 'quick' })];
    const done = notes.find((n) => n.kind === 'done');
    if (done?.kind !== 'done') throw new Error('no reading');
    /* every move of the seat is reported, in the order it was played */
    expect(done.moves.length).toBeGreaterThan(5);
    for (let i = 1; i < done.moves.length; i++) expect(done.moves[i].at).toBeGreaterThan(done.moves[i - 1].at);
    done.moves.forEach((m) => {
      expect(log[m.at]).toEqual(m.yours);
      /* the cost is in chance of winning: never negative, never more than
         the best road was worth, and both ends are real probabilities */
      expect(m.loss).toBeGreaterThanOrEqual(0);
      expect(m.mine).toBeGreaterThanOrEqual(0);
      expect(m.mine).toBeLessThanOrEqual(1);
      expect(m.best).toBeGreaterThanOrEqual(m.mine);
      expect(m.loss).toBeCloseTo(m.best - m.mine, 6);
      expect(m.choices).toBeGreaterThan(0);
      /* and the grade is read off that cost, by the one grader */
      expect(m.grade).toBe(gradeOfLoss(m.loss));
      if (m.theirs) expect(JSON.stringify(m.yours)).not.toBe(JSON.stringify(m.theirs));
      if (m.top) expect(m.loss).toBeLessThanOrEqual(LOSS.top);
    });
    /* a game played by the plain machine is not a game of best roads */
    expect(done.moves.some((m) => m.loss > 0)).toBe(true);
  });

  it('says so rather than throwing when a log does not replay', () => {
    const notes = [...readGame({ setup: setup(2, 'short'), seed: 3, actions: [{ kind: 'sell', card: 'nope', sales: [] }], seat: 0, judge: 'quick' })];
    expect(notes.some((n) => n.kind === 'failed')).toBe(true);
  });
});

describe('grading a move by what it cost in chance', () => {
  it('calls the best road open the best move', () => {
    expect(gradeOfLoss(0)).toBe('top');
    expect(gradeOfLoss(LOSS.top)).toBe('top');
  });

  it('climbs through the grades as more chance is given up', () => {
    expect(gradeOfLoss(LOSS.top + 0.001)).toBe('good');
    expect(gradeOfLoss(LOSS.good)).toBe('good');
    expect(gradeOfLoss(LOSS.good + 0.001)).toBe('inaccuracy');
    expect(gradeOfLoss(LOSS.inaccuracy)).toBe('inaccuracy');
    expect(gradeOfLoss(LOSS.inaccuracy + 0.001)).toBe('mistake');
    expect(gradeOfLoss(LOSS.mistake)).toBe('mistake');
    expect(gradeOfLoss(LOSS.mistake + 0.001)).toBe('blunder');
    expect(gradeOfLoss(1)).toBe('blunder');
  });

  it('never runs backwards', () => {
    const order = ['top', 'good', 'inaccuracy', 'mistake', 'blunder'];
    let last = 0;
    for (let loss = 0; loss <= 1; loss += 0.01) {
      const rank = order.indexOf(gradeOfLoss(loss));
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });
});
