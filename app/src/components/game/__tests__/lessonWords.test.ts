import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { shortKeyOf, stepKeyOf } from '../lessonWords';

/* the words the lessons are said in, on the guided table itself — you
   against Wedgwood, the canal era only, the deal of seed 3 — and on the
   same deal played as a full game */

function table(eraLength: 'short' | 'standard' = 'short'): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength, marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

describe('the entry a lesson is said under', () => {
  it('is its own in a short game where the rules differ', () => {
    const g = table();
    expect(stepKeyOf('goal', g, 0)).toBe('goalShort');
    expect(stepKeyOf('loan', g, 0)).toBe('loanShort');
    expect(stepKeyOf('eraEnd', g, 0)).toBe('eraEndShort');
    /* the rest read the same in either game */
    expect(stepKeyOf('coal', g, 0)).toBe('coal');
  });

  it('is the plain one in a full game', () => {
    const g = table('standard');
    expect(stepKeyOf('goal', g, 0)).toBe('goal');
    expect(stepKeyOf('loan', g, 0)).toBe('loan');
    expect(stepKeyOf('eraEnd', g, 0)).toBe('eraEnd');
  });

  it('gives the evening course the guided game’s own titles', () => {
    expect(shortKeyOf('goal')).toBe('goalShort');
    expect(shortKeyOf('welcome')).toBe('welcome');
  });
});
