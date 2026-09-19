import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { debrief, readTurn, turnsOf } from '../debrief';
import { newGame } from '../engine';
import type { SetupPayload } from '../types';

/* The debrief reads a game again: the reader's turns, the machine's
   answer at each, and the widest gaps kept — a player who only passes
   is told so, a machine's own turns are never read. */

const SETUP: SetupPayload = {
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: 0, fidelity: 'core', assist: false },
};

describe('the debrief', () => {
  it('reads the reader\'s turns and keeps the moments another move was worth more', () => {
    let s = newGame(SETUP, 11);
    const me = 0;
    /* twelve actions: the reader passes on every turn, the machine plays its own */
    for (let i = 0; i < 12 && s.phase === 'action'; i++) {
      const wanted = s.current === me ? fallbackAction(s, me) : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
      const r = applyAction(s, s.current, wanted);
      if (!r.state) throw new Error(r.error);
      s = r.state;
    }
    const turns = turnsOf(s, me);
    expect(turns.length).toBeGreaterThan(2);
    for (const at of turns) expect(s.actions[at].kind === 'pass' || s.actions[at].kind === 'loan' || s.actions[at].kind === 'scout').toBe(true);
    const moments = debrief(s, me, { budgetMs: 40 });
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.length).toBeLessThanOrEqual(3);
    for (const m of moments) {
      expect(m.gap).toBeGreaterThan(0);
      expect(m.before.actions.length).toBe(m.at);
      expect(m.before.current).toBe(me);
      expect(m.better).not.toEqual(m.mine);
    }
    /* sorted by what was left on the table */
    for (let i = 1; i < moments.length; i++) expect(moments[i - 1].gap).toBeGreaterThanOrEqual(moments[i].gap);
    /* a turn of the machine's is nobody's lesson */
    const hers = s.actions.findIndex((_, i) => !turns.includes(i));
    expect(readTurn(s, me, hers, { budgetMs: 20 })).toBeNull();
  });
});
