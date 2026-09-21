import { beforeAll, describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { ACTIONS, BUILD_AT, DEVELOP_ONE_AT, DEVELOP_TWO_AT, LINK_ONE_AT, LINK_TWO_AT, LOAN_AT, PASS_AT, SCOUT_AT, SELL_ALL_AT, SELL_ONE_AT, actionIndex, actionName, priors } from '../policy';
import { FEATURES, features } from '../net';
import type { Net } from '../net';
import { legalActions, searchTurn } from '../search';
import type { GameState, SetupPayload } from '../types';

const setup = (): SetupPayload => ({
  players: [
    { name: 'Mr Watt', color: 'oxblood', type: 'bot', persona: 'watt' },
    { name: 'Mr Boulton', color: 'brass', type: 'bot', persona: 'boulton' },
    { name: 'Miss Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

/** One game, played once for the whole file by the quick heuristic bot:
 *  the naming has to hold on real tables, and every test wants the same
 *  ones. Searching each turn would play the game over for every test. */
const TURNS: GameState[] = [];

beforeAll(() => {
  let s = newGame(setup(), 11);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 3000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    if (s.phase === 'action' && legalActions(s, s.current).length) TURNS.push(s);
    const wanted = botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current);
    s = applyAction(s, s.current, wanted).state ?? applyAction(s, s.current, fallbackAction(s, s.current)).state!;
  }
});

/** a network of the right shape whose weights say nothing: every name alike */
function flatPolicy(): Net {
  const sizes = [FEATURES, ACTIONS];
  return {
    sizes,
    weights: [new Float32Array(FEATURES * ACTIONS)],
    biases: [new Float32Array(ACTIONS)],
    mean: new Float32Array(FEATURES),
    scale: new Float32Array(FEATURES).fill(1),
    points: 1,
  };
}

describe('the names of the moves', () => {
  /* These offsets are written into every trained policy. Moving one renames
     every move that follows it and silently voids the networks trained so
     far, so they are pinned here rather than left to drift. */
  it('lays the families out where the trained policies expect them', () => {
    expect(BUILD_AT).toBe(0);
    expect(LINK_ONE_AT).toBe(132);
    expect(LINK_TWO_AT).toBe(171);
    expect(SELL_ALL_AT).toBe(210);
    expect(SELL_ONE_AT).toBe(211);
    expect(DEVELOP_ONE_AT).toBe(233);
    expect(DEVELOP_TWO_AT).toBe(239);
    expect(LOAN_AT).toBe(245);
    expect(SCOUT_AT).toBe(246);
    expect(PASS_AT).toBe(247);
    expect(ACTIONS).toBe(248);
  });

  it('names every move the search is willing to play', () => {
    let moves = 0;
    for (const s of TURNS) {
      for (const a of legalActions(s, s.current)) {
        const at = actionIndex(a);
        expect(at, `${a.kind} went unnamed`).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThan(ACTIONS);
        moves += 1;
      }
    }
    expect(TURNS.length).toBeGreaterThan(40);
    expect(moves).toBeGreaterThan(400);
  });

  it('gives every name words of its own', () => {
    const seen = new Set<string>();
    for (let at = 0; at < ACTIONS; at++) {
      const words = actionName(at);
      expect(words).not.toBe('?');
      seen.add(words);
    }
    expect(seen.size).toBe(ACTIONS);
  });

  it('tells a single sale from a clean sweep, and one development from two', () => {
    const one = actionIndex({ kind: 'sell', card: 'c', sales: [{ town: 'stoke', slot: 0, merchant: 'oxford' }] });
    const all = actionIndex({
      kind: 'sell',
      card: 'c',
      sales: [
        { town: 'stoke', slot: 0, merchant: 'oxford' },
        { town: 'leek', slot: 0, merchant: 'oxford' },
      ],
    });
    expect(one).toBeGreaterThanOrEqual(SELL_ONE_AT);
    expect(all).toBe(SELL_ALL_AT);
    expect(actionIndex({ kind: 'develop', card: 'c', industries: ['pottery'] })).toBe(DEVELOP_ONE_AT + 4);
    expect(actionIndex({ kind: 'develop', card: 'c', industries: ['pottery', 'pottery'] })).toBe(DEVELOP_TWO_AT + 4);
  });

  it('leaves the engine’s own book-keeping unnamed', () => {
    expect(actionIndex({ kind: 'begin-rail' })).toBe(-1);
    expect(actionIndex({ kind: 'resign', player: 0 })).toBe(-1);
  });
});

describe('ranking the moves', () => {
  it('shares one out over the moves on offer, and no further', () => {
    const policy = flatPolicy();
    let checked = 0;
    for (const s of TURNS) {
      if (checked >= 12) break;
      const legal = legalActions(s, s.current);
      if (legal.length < 2) continue;
      checked += 1;
      const p = priors(policy, features(s, s.current), legal);
      expect(p).toHaveLength(legal.length);
      let sum = 0;
      for (const x of p) {
        expect(x).toBeGreaterThan(0);
        sum += x;
      }
      expect(sum).toBeCloseTo(1, 5);
    }
    expect(checked).toBe(12);
  });

  it('splits a name between the moves that carry it', () => {
    const policy = flatPolicy();
    let checked = 0;
    for (const s of TURNS) {
      if (checked >= 6) break;
      const legal = legalActions(s, s.current);
      const at = legal.map(actionIndex);
      const alone = at.findIndex((k) => at.filter((j) => j === k).length === 1);
      const twinned = at.findIndex((k) => at.filter((j) => j === k).length === 2);
      if (alone < 0 || twinned < 0) continue;
      checked += 1;
      const p = priors(policy, features(s, s.current), legal);
      /* a policy with nothing to say gives every name the same worth, so
         two moves under one name each get half of what a lone move gets */
      expect(p[twinned]).toBeCloseTo(p[alone] / 2, 6);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('hands back the whole reading when the search is asked to rank', () => {
    let checked = 0;
    for (const s of TURNS) {
      if (checked >= 8) break;
      const legal = legalActions(s, s.current);
      const found = searchTurn(s, s.current, { budgetMs: 20, depth: 0, rank: true });
      if (!found) continue;
      checked += 1;
      expect(found.ranked).toBeDefined();
      expect(found.ranked!.length).toBeLessThanOrEqual(legal.length);
      expect(found.ranked!.length).toBeGreaterThan(0);
      /* best first */
      for (let k = 1; k < found.ranked!.length; k++) expect(found.ranked![k - 1].score).toBeGreaterThanOrEqual(found.ranked![k].score);
    }
    expect(checked).toBe(8);
  });

  it('says nothing extra when it is not asked', () => {
    expect(searchTurn(TURNS[0], TURNS[0].current, { budgetMs: 20, depth: 0 })?.ranked).toBeUndefined();
  });
});
