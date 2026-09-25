import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction, setupOf } from '../actions';
import { chooseBotMove } from '../bot';
import { debrief, readDebrief, turnsOf } from '../debrief';
import { newGame } from '../engine';
import { GIVE, gradeOf } from '../review';
import { readGame } from '../reviewWorker';
import type { Second } from '../reviewWorker';
import type { SetupPayload } from '../types';

/* The debrief reads a game again with the review page's own measure: at
   each of the reader's turns the move played is weighed against the moves
   open beside it, in widths of the gap between the best and the middling
   one. The moments worse than a good move are kept, worst first, and the
   panel and the page agree about every one of them. */

const SETUP: SetupPayload = {
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: 0, fidelity: 'core', assist: false },
};

/** a game where the reader never plays: twelve turns of the weakest move */
function played(seed: number, me: number, turns = 12) {
  let s = newGame(SETUP, seed);
  for (let i = 0; i < turns && s.phase === 'action'; i++) {
    const wanted = s.current === me ? fallbackAction(s, me) : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
    const r = applyAction(s, s.current, wanted);
    if (!r.state) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe('the debrief', () => {
  it("reads the reader's turns and keeps the worst moments by the review's measure", () => {
    const s = played(11, 0);
    const me = 0;
    const turns = turnsOf(s, me);
    expect(turns.length).toBeGreaterThan(2);
    for (const at of turns) expect(s.actions[at].kind === 'pass' || s.actions[at].kind === 'loan' || s.actions[at].kind === 'scout').toBe(true);
    /* a turn of the machine's is nobody's lesson */
    const hers = s.actions.findIndex((_, i) => !turns.includes(i));
    expect(hers).toBeGreaterThanOrEqual(0);
    expect(turns).not.toContain(hers);

    const moments = debrief(s, me, { budgetMs: 40 });
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.length).toBeLessThanOrEqual(3);
    for (const m of moments) {
      expect(turns).toContain(m.at);
      expect(m.give).toBeGreaterThan(GIVE.good);
      expect(m.grade).toBe(gradeOf(m.give));
      expect(m.grade === 'inaccuracy' || m.grade === 'mistake' || m.grade === 'blunder').toBe(true);
      expect(m.choices).toBeGreaterThan(0);
      expect(m.before.actions.length).toBe(m.at);
      expect(m.before.current).toBe(me);
      expect(m.better).not.toEqual(m.mine);
    }
    /* worst first: what was given up, not what the clock was worth */
    for (let i = 1; i < moments.length; i++) expect(moments[i - 1].give).toBeGreaterThanOrEqual(moments[i].give);
  });

  it('says of a move exactly what the review page says of it', () => {
    const s = played(11, 0);
    const me = 0;
    const moments = debrief(s, me, { budgetMs: 40 });
    const page: Second[] = [];
    for (const note of readGame({ setup: setupOf(s), seed: s.seed, actions: s.actions, seat: me, budgetMs: 40 })) {
      if (note.kind === 'done') page.push(...note.moves);
      if (note.kind === 'failed') throw new Error(note.why);
    }
    expect(page.length).toBe(turnsOf(s, me).length);
    for (const m of moments) {
      const read = page.find((x) => x.at === m.at);
      expect(read).toBeDefined();
      expect(read?.give).toBe(m.give);
      expect(gradeOf(read!.give)).toBe(m.grade);
      expect(read?.better).toEqual(m.better);
    }
    /* the panel keeps the worst the page found, and nothing the page calls sound */
    const worst = page
      .filter((x) => x.better && x.give > GIVE.good)
      .sort((a, b) => b.give - a.give)
      .slice(0, 3)
      .map((x) => x.at);
    expect(moments.map((m) => m.at)).toEqual(worst);
  });

  it('walks the log once, whatever the length of the game', () => {
    const s = played(7, 0);
    const me = 0;
    const reading = readDebrief(s, me, { budgetMs: 20 });
    let step = reading.next();
    const total = step.value.total;
    expect(total).toBe(turnsOf(s, me).length);
    let steps = 0;
    while (!step.done) {
      step = reading.next();
      steps += 1;
      expect(step.value.done).toBeLessThanOrEqual(total);
      expect(step.value.moments.length).toBeLessThanOrEqual(3);
    }
    /* one step per turn read, and a last one to close: no turn read twice */
    expect(steps).toBe(total + 1);
    expect(step.value.done).toBe(total);
  });

  it('has nothing to read before a move is played', () => {
    const empty = newGame(SETUP, 3);
    expect(turnsOf(empty, 0)).toEqual([]);
    expect(debrief(empty, 0, { budgetMs: 20 })).toEqual([]);
  });
});
