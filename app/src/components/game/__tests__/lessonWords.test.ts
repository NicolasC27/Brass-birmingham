import { describe, expect, it } from 'vitest';
import { applyAction, withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { LOW_PURSE, loanWords, shortKeyOf, stepKeyOf } from '../lessonWords';

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

describe('the words for a machine’s loan', () => {
  it('go by the purse it was taken from', () => {
    const g = table();
    expect(loanWords(g, 1, LOW_PURSE - 1)).toBe('loanLow');
    expect(loanWords(g, 1, 35)).toBe('loanAhead');
  });

  it('say the close when its last card of a short game borrows', () => {
    const g = structuredClone(table());
    g.deck = [];
    g.players[1].hand = [];
    expect(loanWords(g, 1, 41)).toBe('loanClose');
    /* a full game has no close to borrow for */
    expect(loanWords({ ...g, eraLength: 'standard' }, 1, 41)).toBe('loanAhead');
  });

  it('read the purse off the loan’s own line of the ledger', () => {
    const g = table();
    const seat = g.current;
    const before = g.players[seat].money;
    const r = applyAction(g, seat, { kind: 'loan', card: g.players[seat].hand[0].id });
    const line = r.state!.ledger.find((e) => e.key === 'loan');
    expect(line?.vars?.purse).toBe(before);
  });
});
