import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { readShared, shareFragment, sharedMoment } from '../share';
import type { SetupPayload } from '../types';

const SETUP: SetupPayload = {
  players: [
    { name: 'You', color: 'brass', type: 'human' },
    { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: 0, fidelity: 'core', assist: false },
};

describe('a game carried in a link', () => {
  it('comes back as it was, move for move', () => {
    let s = newGame(SETUP, 11);
    for (let i = 0; i < 14 && s.phase === 'action'; i++) {
      const wanted = s.current === 0 ? fallbackAction(s, 0) : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
      const r = applyAction(s, s.current, wanted);
      if (!r.state) throw new Error(r.error);
      s = r.state;
    }
    const fragment = shareFragment(s);
    expect(fragment.startsWith('#g=')).toBe(true);
    expect(fragment.slice(3)).not.toMatch(/[+/=]/);
    const back = readShared(fragment);
    expect(back).not.toBeNull();
    expect(back!.actions).toEqual(s.actions);
    expect(back!.players.map((p) => [p.money, p.income, p.vp])).toEqual(s.players.map((p) => [p.money, p.income, p.vp]));
    expect(Object.keys(back!.tiles).sort()).toEqual(Object.keys(s.tiles).sort());
  });
  it('refuses what is not one of ours', () => {
    expect(readShared('')).toBeNull();
    expect(readShared('#g=not-a-game')).toBeNull();
    expect(readShared('#other')).toBeNull();
  });
});

describe('a moment pointed at', () => {
  it('rides in the same fragment and comes back whole', () => {
    const g = newGame(SETUP, 11);
    const fragment = shareFragment(g, 12);
    expect(sharedMoment(fragment)).toBe(12);
    /* the game still arrives, the moment being only a word on the end */
    expect(readShared(fragment)).not.toBeNull();
    /* a fragment that points at nothing says so */
    expect(sharedMoment(shareFragment(g))).toBeNull();
  });
});
