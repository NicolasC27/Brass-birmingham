import { describe, expect, it } from 'vitest';
import { applyAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { adaptiveStrength, chooseBotAction, determinize, evaluate, knobs, legalActions, searchTurn } from '../search';
import type { GameState, SetupPayload } from '../types';

const setup = (): SetupPayload => ({
  players: [
    { name: 'Mr Watt', color: 'oxblood', type: 'bot', persona: 'watt' },
    { name: 'Mr Boulton', color: 'brass', type: 'bot', persona: 'boulton' },
    { name: 'Miss Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

/** a game played to the end, every machine searching its turn */
function playOut(seed: number, onTurn?: (s: GameState) => void): GameState {
  let s = newGame(setup(), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 3000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    onTurn?.(s);
    const wanted = chooseBotAction(s, s.current, { budgetMs: 60, depth: 0 }) ?? fallbackAction(s, s.current);
    const r = applyAction(s, s.current, wanted);
    s = r.state ?? applyAction(s, s.current, fallbackAction(s, s.current)).state!;
  }
  return s;
}

describe('the machines', () => {
  it('only lists actions the engine accepts, and never touches the state', () => {
    let turn = 0;
    playOut(11, (s) => {
      /* every fourth turn of the game, each seat's whole list goes through the engine */
      if ((turn++ & 3) !== 0) return;
      const before = JSON.stringify(s);
      for (const a of legalActions(s, s.current)) expect(applyAction(s, s.current, a).state, JSON.stringify(a)).not.toBeNull();
      expect(JSON.stringify(s)).toBe(before);
    });
  }, 20_000);

  it('plays a whole game through and keeps within its budget', () => {
    let slowest = 0;
    const s = playOut(12, (g) => {
      if (g.current !== 0) return;
      const r = searchTurn(g, 0, { budgetMs: 60 });
      if (r) slowest = Math.max(slowest, r.ms);
    });
    expect(s.phase).toBe('game-over');
    /* the budget bounds the beam, not the last first action being read */
    expect(slowest).toBeLessThan(600);
  }, 20_000);

  it('reads the table from its own seat', () => {
    const s = newGame(setup(), 13);
    const mine = evaluate(s, 0);
    const theirs = evaluate(s, 1);
    expect(Number.isFinite(mine)).toBe(true);
    expect(Number.isFinite(theirs)).toBe(true);
    /* a fresh table: nobody is ahead by much */
    expect(Math.abs(mine)).toBeLessThan(5);
  });

  it('plays weaker on a shorter leash, and no worse than the heuristic at the bottom', () => {
    expect(knobs(1)).toMatchObject({ second: true, noise: 0, beam: 8 });
    expect(knobs(0).second).toBe(false);
    expect(knobs(0).noise).toBeGreaterThan(knobs(0.5).noise);
    expect(knobs(0).budgetMs).toBeLessThan(knobs(1).budgetMs);
    const s = newGame(setup(), 14);
    for (const strength of [0, 0.3, 0.6, 1]) expect(chooseBotAction(s, 0, { strength })).not.toBeNull();
    expect(chooseBotMove(s, 0)).not.toBeNull();
  });

  it('looks past its own turn at the top of the dial, on cards it has not seen', () => {
    expect(knobs(0.7).depth).toBe(0);
    expect(knobs(0.85).depth).toBe(1);
    expect(knobs(1).depth).toBe(2);
    const s = newGame(setup(), 16);
    /* the unseen cards are dealt afresh: same counts, our hand untouched, the same cards overall */
    let x = 7;
    const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const d = determinize(s, 0, rand);
    expect(d.players.map((p) => p.hand.length)).toEqual(s.players.map((p) => p.hand.length));
    expect(d.deck.length).toBe(s.deck.length);
    expect(d.players[0].hand).toEqual(s.players[0].hand);
    const ids = (g: GameState) => [...g.deck, ...g.players.slice(1).flatMap((p) => p.hand)].map((c) => c.id).sort();
    expect(ids(d)).toEqual(ids(s));
    expect(JSON.stringify(s)).toBe(JSON.stringify(newGame(setup(), 16)));
    /* a full-strength turn stays legal and within its budget */
    const r = searchTurn(s, 0, { strength: 1, budgetMs: 400 });
    expect(r).not.toBeNull();
    expect(applyAction(s, 0, r!.action).state).not.toBeNull();
    expect(r!.ms).toBeLessThan(900);
  });

  it('eases when it runs away from the humans, and never at a table of machines', () => {
    const s = newGame(setup(), 15);
    expect(adaptiveStrength(s, 0, 0.8)).toBe(0.8);
    const humans = structuredClone(s);
    humans.players[1].isBot = false;
    expect(adaptiveStrength(humans, 0, 0.8)).toBe(0.8);
    humans.players[0].vp = 40;
    expect(adaptiveStrength(humans, 0, 0.8)).toBeLessThan(0.6);
    humans.players[1].vp = 80;
    expect(adaptiveStrength(humans, 0, 0.8)).toBeGreaterThan(0.9);
    humans.assist = true;
    expect(adaptiveStrength(humans, 0, 0.8)).toBeLessThanOrEqual(0.65);
  });
});
