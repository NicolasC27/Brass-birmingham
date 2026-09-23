import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { CHAINS, chainSurplus } from '../chains';
import { INDUSTRIES } from '../data';
import { newGame } from '../engine';
import { evaluate, setEvalMode, setWeights } from '../search';
import { DEFAULTS, TRAINED } from '../weights';
import type { GameState, SetupPayload } from '../types';

const setup = (n: number): SetupPayload =>
  ({
    players: Array.from({ length: n }, (_, k) => ({ name: `P${k}`, color: ['brass', 'oxblood', 'verdigris', 'steel'][k], type: 'bot', persona: ['boulton', 'wedgwood', 'arkwright', 'watt'][k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  }) as SetupPayload;

/** a game played out by the quick bot, every position kept */
function statesOf(seed: number, players: number): GameState[] {
  const out: GameState[] = [];
  let s = newGame(setup(players), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 3000) {
    out.push(s);
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const a = botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current);
    s = applyAction(s, s.current, a).state ?? applyAction(s, s.current, fallbackAction(s, s.current)).state!;
  }
  out.push(s);
  return out;
}

describe('a line of play', () => {
  it('names only tiles the mats actually hold', () => {
    for (const chain of CHAINS) {
      expect(chain.legs.length).toBeGreaterThan(1);
      for (const leg of chain.legs) {
        const lv = INDUSTRIES[leg.industry][leg.level - 1];
        expect(lv, `${chain.name} wants ${leg.industry} L${leg.level}`).toBeTruthy();
        expect(lv.level).toBe(leg.level);
      }
    }
  });

  it('is worth nothing when there is no action left to spend', () => {
    for (const s of statesOf(41, 4)) {
      if (s.phase !== 'action') continue;
      for (let seat = 0; seat < s.players.length; seat++) {
        expect(chainSurplus(s, seat, 5, 0).best).toBe(0);
      }
    }
  });

  it('never asks for more actions than it was given', () => {
    let seen = 0;
    for (const s of statesOf(42, 3)) {
      if (s.phase !== 'action') continue;
      for (let seat = 0; seat < s.players.length; seat++) {
        const tight = chainSurplus(s, seat, 5, 2).best;
        const loose = chainSurplus(s, seat, 5, 60).best;
        expect(tight).toBeLessThanOrEqual(loose + 1e-9);
        if (loose > 0) seen += 1;
      }
    }
    /* the lines must be reachable somewhere, or the term measures nothing */
    expect(seen).toBeGreaterThan(20);
  });

  it('leaves the reading untouched while its weight is zero', () => {
    const was = TRAINED.chainPay;
    expect(was).toBe(0);
    setEvalMode('hand');
    for (const s of statesOf(43, 4).slice(0, 40)) {
      if (s.phase !== 'action') continue;
      setWeights({ ...DEFAULTS, chainPay: 0 });
      const off = evaluate(s, s.current);
      setWeights({ ...DEFAULTS, chainPay: 0, chainAction: 99 });
      const alsoOff = evaluate(s, s.current);
      expect(alsoOff).toBe(off);
    }
    setWeights(TRAINED);
  });

  it('pays less as an action is charged more', () => {
    let compared = 0;
    for (const s of statesOf(44, 4)) {
      if (s.phase !== 'action') continue;
      const cheap = chainSurplus(s, 0, 2, 60).best;
      const dear = chainSurplus(s, 0, 9, 60).best;
      if (cheap > 0) {
        expect(dear).toBeLessThanOrEqual(cheap + 1e-9);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(10);
  });
});
