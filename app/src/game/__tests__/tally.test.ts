import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame } from '../engine';
import { tallyGame } from '../tally';
import type { GameState, SetupPayload } from '../types';

/* the tally counts a whole game from its log, whatever the ledger kept */

const setup: SetupPayload = {
  players: [
    { name: 'Ada', color: 'oxblood', type: 'bot', persona: 'watt' },
    { name: 'Bob', color: 'verdigris', type: 'bot', persona: 'boulton' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

function selfPlay(s0: GameState, cap = 600): GameState {
  let s = s0;
  for (let i = 0; i < cap && s.phase !== 'game-over'; i++) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const wanted = botAction(chooseBotMove(s, s.current));
    let r = wanted ? applyAction(s, s.current, wanted) : { state: null };
    if (!r.state) r = applyAction(s, s.current, fallbackAction(s, s.current));
    if (!r.state) throw new Error(`turn ${i}: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe('the tally of a game', () => {
  const end = selfPlay(newGame(setup, 11));
  const tallies = tallyGame(setup, 11, end.actions);

  it('counts every build of the log, by industry and by town', () => {
    const builds = end.actions.filter((a) => a.kind === 'build').length;
    const built = tallies.reduce((a, t) => a + t.built, 0);
    expect(end.phase).toBe('game-over');
    expect(built).toBe(builds);
    expect(built).toBeGreaterThan(0);
    for (const t of tallies) {
      expect(Object.values(t.industries).reduce((a, n) => a + (n ?? 0), 0)).toBe(t.built);
      expect(Object.values(t.towns).reduce((a, n) => a + n, 0)).toBe(t.built);
    }
  });

  it('counts the links, the sales and the loans as the log has them', () => {
    const count = (kind: string) => end.actions.filter((a) => a.kind === kind).length;
    expect(tallies.reduce((a, t) => a + t.loans, 0)).toBe(count('loan'));
    expect(tallies.reduce((a, t) => a + t.links, 0)).toBeGreaterThanOrEqual(count('network'));
    expect(tallies.reduce((a, t) => a + t.developed, 0)).toBeGreaterThanOrEqual(count('develop'));
    expect(tallies.reduce((a, t) => a + t.sold, 0)).toBeGreaterThanOrEqual(count('sell'));
  });

  it('keeps the purse and the income as the game ended', () => {
    end.players.forEach((p, i) => {
      expect(tallies[i].money).toBe(p.money);
      expect(tallies[i].income).toBe(p.income);
    });
  });
});
