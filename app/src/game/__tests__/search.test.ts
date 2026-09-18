import { describe, expect, it } from 'vitest';
import { applyAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { chooseBotAction, evaluate, legalActions, searchTurn } from '../search';
import type { GameState, SetupPayload } from '../types';

const setup = (difficulty: 'magnate' | 'industrialist' = 'magnate'): SetupPayload => ({
  players: [
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty },
    { name: 'Bess', color: 'brass', type: 'bot', difficulty: 'industrialist' },
    { name: 'Cy', color: 'verdigris', type: 'bot', difficulty: 'industrialist' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

/** a game played to the end, the magnate at seat 0 searching every turn */
function playOut(seed: number, onTurn?: (s: GameState) => void): GameState {
  let s = newGame(setup(), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 3000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    onTurn?.(s);
    const wanted = chooseBotAction(s, s.current, { budgetMs: 60 }) ?? fallbackAction(s, s.current);
    const r = applyAction(s, s.current, wanted);
    s = r.state ?? applyAction(s, s.current, fallbackAction(s, s.current)).state!;
  }
  return s;
}

describe('the magnate', () => {
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
  });

  it('reads the table from its own seat', () => {
    const s = newGame(setup(), 13);
    const mine = evaluate(s, 0);
    const theirs = evaluate(s, 1);
    expect(Number.isFinite(mine)).toBe(true);
    expect(Number.isFinite(theirs)).toBe(true);
    /* a fresh table: nobody is ahead by much */
    expect(Math.abs(mine)).toBeLessThan(5);
  });

  it('leaves the other difficulties to the heuristic', () => {
    const s = newGame(setup('industrialist'), 14);
    const heuristic = chooseBotMove(s, 0);
    const chosen = chooseBotAction(s, 0);
    expect(chosen?.kind).toBe(heuristic?.kind);
  });
});
