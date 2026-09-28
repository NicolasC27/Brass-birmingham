import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { PLANS, deedsOf, goalsOf, planOf } from '../plan';
import type { GameState, SetupPayload } from '../types';

const SETUP: SetupPayload = {
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: 0, fidelity: 'core', assist: false },
};

/** a whole game played out by the heuristic machine, both seats */
function played(seed: number): GameState {
  let s = newGame(SETUP, seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 4000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const a = botAction(chooseBotMove(s, seat)) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s;
}

describe('the plan a seat played', () => {
  it('counts the moves into the things the guide names', () => {
    const g = played(42);
    const d = deedsOf(g, 0);
    /* every tile still standing was built by a move of mine — and a few more
       besides, the canal era's being swept off the board before the rail */
    const mine = Object.values(g.tiles).filter((t) => t.owner === 0);
    expect(d.built.length).toBeGreaterThanOrEqual(mine.length);
    expect(d.actions).toBeGreaterThan(0);
    /* the canal era's links are swept with its tiles: what stands at the end
       is the rail the seat laid, a doubled one counting twice */
    const rail = d.links.filter((l) => l.era === 'rail');
    expect(Object.values(g.links).filter((l) => l.owner === 0).length).toBe(rail.length + rail.filter((l) => l.double).length);
    expect(d.vp).toBe(g.players[0].vp);
    /* what was sold was turned over */
    for (const b of d.built) expect(typeof b.sold).toBe('boolean');
    const goals = goalsOf(d);
    expect(goals.coalMines.done).toBe(d.built.filter((b) => b.industry === 'coal').length);
    expect(goals.fewCanals.done).toBeLessThanOrEqual(1);
  });

  it('names the closest plan and scores every one of them', () => {
    const g = played(7);
    const read = planOf(g, 0);
    expect(read.all).toHaveLength(Object.keys(PLANS).length);
    for (let i = 1; i < read.all.length; i++) expect(read.all[i - 1].score).toBeGreaterThanOrEqual(read.all[i].score);
    expect(read.best).toBe(read.all[0]);
    expect(read.best.score).toBeGreaterThanOrEqual(0);
    expect(read.best.score).toBeLessThanOrEqual(1);
    expect(read.best.goals.length).toBeGreaterThan(2);
    for (const goal of read.best.goals) {
      expect(goal.target).toBeGreaterThan(0);
      expect(goal.done).toBeGreaterThanOrEqual(0);
    }
    expect(read.tips.map((t) => t.id)).toEqual(['perAction', 'lowLeft', 'income']);
    /* a seat that played nothing carries no plan at all */
    const fresh = newGame(SETUP, 3);
    const empty = planOf(fresh, 0);
    expect(empty.best.score).toBe(0);
    expect(empty.deeds.actions).toBe(0);
  });
});
