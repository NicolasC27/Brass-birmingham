import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { deepChance, gradeOfLoss, judgeTurn, positionsOf, qualityOf, roadsFrom, sameRoad, winChance } from '../analysis';
import { newGame } from '../engine';
import type { SetupPayload } from '../types';

const SETUP: SetupPayload = {
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: 0, fidelity: 'core', assist: false },
};

describe('the analysis', () => {
  it('lays every position out, weighs each, and offers the other roads at a turn of mine', () => {
    let s = newGame(SETUP, 5);
    const me = 0;
    for (let i = 0; i < 10 && s.phase === 'action'; i++) {
      const wanted = s.current === me ? fallbackAction(s, me) : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
      const r = applyAction(s, s.current, wanted);
      if (!r.state) throw new Error(r.error);
      s = r.state;
    }
    const positions = positionsOf(s);
    expect(positions).toHaveLength(s.actions.length + 1);
    expect(positions[positions.length - 1].actions.length).toBe(s.actions.length);
    expect(positions[0].actions).toHaveLength(0);
    for (const p of positions) {
      const c = winChance(p, me);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(1);
    }
    /* a turn of mine: the roads lead somewhere, the best first */
    const k = positions.findIndex((p) => p.current === me && p.phase === 'action');
    const roads = roadsFrom(positions[k], me, 5);
    expect(roads.length).toBeGreaterThan(1);
    for (let i = 1; i < roads.length; i++) expect(roads[i - 1].chance).toBeGreaterThanOrEqual(roads[i].chance);
    expect(roads[0].after.actions.length).toBe(k + 1);
    /* not my turn: no roads */
    const theirs = positions.findIndex((p) => p.current !== me && p.phase === 'action');
    expect(roadsFrom(positions[theirs], me)).toEqual([]);
    expect([qualityOf(0), qualityOf(1), qualityOf(3), qualityOf(10), qualityOf(30)]).toEqual(['best', 'good', 'inaccuracy', 'mistake', 'blunder']);
  });
});

describe('the long judge', () => {
  it('grades a move on the chance it cost, the played road among the roads', () => {
    let s = newGame(SETUP, 21);
    const me = 0;
    for (let i = 0; i < 6 && s.phase === 'action'; i++) {
      const wanted = s.current === me ? fallbackAction(s, me) : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
      const r = applyAction(s, s.current, wanted);
      if (!r.state) throw new Error(r.error);
      s = r.state;
    }
    const positions = positionsOf(s);
    const k = positions.findIndex((p) => p.current === me && p.phase === 'action');
    const quick = { plies: 2, budgetMs: 5 };
    const v = judgeTurn(positions[k], me, s.actions[k], quick);
    expect(v).not.toBeNull();
    expect(v!.at).toBe(k);
    expect(v!.roads.length).toBeGreaterThan(0);
    expect(v!.roads.some((r) => sameRoad(r.action) === sameRoad(s.actions[k]))).toBe(true);
    for (let i = 1; i < v!.roads.length; i++) expect(v!.roads[i - 1].chance).toBeGreaterThanOrEqual(v!.roads[i].chance);
    expect(v!.loss).toBeGreaterThanOrEqual(0);
    expect(v!.best).toBeGreaterThanOrEqual(v!.mine);
    expect(v!.grade).toBe(gradeOfLoss(v!.loss));
    expect(v!.roads[0].chance).toBe(v!.best);
    /* the judge's chance is one of the game's, 0 to 1 */
    const c = deepChance(positions[k], me, quick);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
    /* the grades, on the one scale */
    expect(gradeOfLoss(0)).toBe('top');
    expect(gradeOfLoss(0.02)).toBe('good');
    expect(gradeOfLoss(0.05)).toBe('inaccuracy');
    expect(gradeOfLoss(0.1)).toBe('mistake');
    expect(gradeOfLoss(0.3)).toBe('blunder');
  });
});
