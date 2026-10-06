import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { newGame } from '../engine';
import type { Deeds } from '../plan';
import { CHALLENGES, POINTS_ALL, POINTS_PER_RULE, attemptsOf, challengeFor, challengeOf, challengeSeedFor, noteChallenge, noteChallengeTable, ruleMet } from '../challenge';
import type { GameState } from '../types';

/* the notice of the week: the deal fixed by the week, the conditions read on the close */

const deeds = (d: Partial<Deeds> = {}): Deeds => ({ built: [], links: [], loans: 0, develops: 0, developed: 0, actions: 0, lowLeft: 0, vp: 0, income: 0, ...d });

/** a table played out: three seats, the points given, seat 0 the human */
function over(vps: number[], extra: Partial<GameState['players'][number]> = {}): GameState {
  const g = newGame(
    {
      players: [
        { name: 'Nicolas', color: 'brass', type: 'human' },
        { name: 'Mr Watt', color: 'steel', type: 'bot', persona: 'watt' },
        { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
      ],
      options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    },
    7,
  );
  g.phase = 'game-over';
  g.players.forEach((p, i) => {
    p.vp = vps[i];
    Object.assign(p, extra);
  });
  return g;
}

describe('the notices', () => {
  it('print in turn, the deal changing every week', () => {
    expect(challengeOf(0).id).toBe(CHALLENGES[0].id);
    expect(challengeOf(CHALLENGES.length).id).toBe(CHALLENGES[0].id);
    expect(challengeOf(3).seed).not.toBe(challengeOf(11).seed);
    expect(challengeOf(36).number).toBe(37);
    for (const c of CHALLENGES) expect(c.rivals).toContain('watt');
  });

  it('read each condition on the seat', () => {
    const g = over([150, 120, 90], { money: 31, income: 60 });
    expect(ruleMet({ kind: 'win' }, g, 0, deeds())).toBe(true);
    expect(ruleMet({ kind: 'win' }, over([100, 120, 90]), 0, deeds())).toBe(false);
    expect(ruleMet({ kind: 'vp', min: 150 }, g, 0, deeds())).toBe(true);
    expect(ruleMet({ kind: 'vp', min: 151 }, g, 0, deeds())).toBe(false);
    expect(ruleMet({ kind: 'loans', max: 1 }, g, 0, deeds({ loans: 1 }))).toBe(true);
    expect(ruleMet({ kind: 'loans', max: 0 }, g, 0, deeds({ loans: 1 }))).toBe(false);
    const built = deeds({ built: [{ industry: 'iron', level: 3, era: 'canal', sold: false }, { industry: 'iron', level: 4, era: 'rail', sold: true }, { industry: 'pottery', level: 1, era: 'canal', sold: true }] });
    expect(ruleMet({ kind: 'industry', industry: 'iron', level: 3, count: 2 }, g, 0, built)).toBe(true);
    expect(ruleMet({ kind: 'industry', industry: 'iron', level: 3, count: 2, sold: true }, g, 0, built)).toBe(false);
    expect(ruleMet({ kind: 'industry', industry: 'pottery', level: 1, count: 1, sold: true, era: 'canal' }, g, 0, built)).toBe(true);
    expect(ruleMet({ kind: 'industry', industry: 'pottery', level: 1, count: 1, sold: true, era: 'rail' }, g, 0, built)).toBe(false);
    const links = deeds({ links: [{ era: 'canal', double: false }, { era: 'rail', double: true }, { era: 'rail', double: true }] });
    expect(ruleMet({ kind: 'links', min: 3 }, g, 0, links)).toBe(true);
    expect(ruleMet({ kind: 'links', min: 3, era: 'rail' }, g, 0, links)).toBe(false);
    expect(ruleMet({ kind: 'doubleRails', min: 2 }, g, 0, links)).toBe(true);
    expect(ruleMet({ kind: 'money', min: 30 }, g, 0, deeds())).toBe(true);
    expect(ruleMet({ kind: 'develops', min: 3 }, g, 0, deeds({ develops: 2 }))).toBe(false);
    /* the income is read as a level, not a space on the track */
    expect(ruleMet({ kind: 'income', min: 10 }, g, 0, deeds())).toBe(true);
    expect(ruleMet({ kind: 'income', min: 60 }, g, 0, deeds())).toBe(false);
  });
});

describe('an attempt', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('is dealt the week\'s seed and read at the close, points and all', () => {
    const c = challengeOf(36);
    /* the office deals the code; the register is what this test is about */
    const code = 'CH01';
    noteChallengeTable(code, c);
    expect(challengeSeedFor(code)).toBe(c.seed);
    expect(challengeFor(code)).toEqual({ week: 36, id: c.id });
    expect(challengeSeedFor('NOPE')).toBeNull();
    const g = over([164, 140, 125]);
    const a = noteChallenge(g, code);
    expect(a).not.toBeNull();
    expect(a!.rank).toBe(1);
    expect(a!.met).toHaveLength(c.rules.length);
    const met = a!.met.filter(Boolean).length;
    expect(a!.points).toBe(164 + POINTS_PER_RULE * met + (met === c.rules.length ? POINTS_ALL : 0));
    expect(attemptsOf(36)[0]?.code).toBe(code);
    /* a table the notice never opened is not read */
    expect(noteChallenge(g, 'NOPE')).toBeNull();
  });
});
