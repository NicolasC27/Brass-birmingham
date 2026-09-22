import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { cloneState } from '../clone';
import { newGame } from '../engine';
import { legalActions } from '../search';
import type { GameState, SetupPayload } from '../types';

const setup = (n: number): SetupPayload =>
  ({
    players: Array.from({ length: n }, (_, k) => ({ name: `P${k}`, color: ['brass', 'oxblood', 'verdigris', 'steel'][k], type: 'bot', persona: ['boulton', 'wedgwood', 'arkwright', 'watt'][k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  }) as SetupPayload;

/** every state a game passes through, the quick bot at the wheel */
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

describe('a quick copy of the table', () => {
  it('holds everything the thorough copy would', () => {
    for (const players of [2, 3, 4]) {
      for (const s of statesOf(300 + players, players)) {
        expect(cloneState(s)).toEqual(structuredClone(s));
      }
    }
  });

  it('shares nothing a move could write on', () => {
    const states = statesOf(77, 4).filter((s) => s.phase === 'action');
    expect(states.length).toBeGreaterThan(30);
    for (const s of states) {
      const c = cloneState(s);
      /* the arrays and records a move reaches into */
      expect(c.players).not.toBe(s.players);
      expect(c.order).not.toBe(s.order);
      expect(c.tiles).not.toBe(s.tiles);
      expect(c.links).not.toBe(s.links);
      expect(c.market).not.toBe(s.market);
      expect(c.deck).not.toBe(s.deck);
      expect(c.discard).not.toBe(s.discard);
      expect(c.wildLeft).not.toBe(s.wildLeft);
      expect(c.merchantBeer).not.toBe(s.merchantBeer);
      expect(c.merchantBonusTaken).not.toBe(s.merchantBonusTaken);
      expect(c.merchantTiles).not.toBe(s.merchantTiles);
      for (const [k, p] of c.players.entries()) {
        expect(p).not.toBe(s.players[k]);
        expect(p.hand).not.toBe(s.players[k].hand);
        expect(p.stacks).not.toBe(s.players[k].stacks);
        expect(p.stacks.coal).not.toBe(s.players[k].stacks.coal);
        expect(p.stats).not.toBe(s.players[k].stats);
        expect(p.incomeHistory).not.toBe(s.players[k].incomeHistory);
      }
      for (const k of Object.keys(c.tiles)) expect(c.tiles[k]).not.toBe(s.tiles[k]);
      for (const k of Object.keys(c.links)) expect(c.links[k]).not.toBe(s.links[k]);
      for (const k of Object.keys(c.merchantTiles)) expect(c.merchantTiles[k]).not.toBe(s.merchantTiles[k]);
    }
  });

  it('leaves the original untouched when a move is played on the copy', () => {
    let checked = 0;
    for (const s of statesOf(91, 4)) {
      if (s.phase !== 'action') continue;
      const legal = legalActions(s, s.current);
      if (!legal.length) continue;
      const before = structuredClone(s);
      for (const a of legal.slice(0, 4)) {
        const r = applyAction(cloneState(s), s.current, a);
        expect(r.state ?? before).toBeTruthy();
        checked += 1;
      }
      expect(s).toEqual(before);
      if (checked > 120) break;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
