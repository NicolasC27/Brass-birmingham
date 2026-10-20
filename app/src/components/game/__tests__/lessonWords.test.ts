import { describe, expect, it } from 'vitest';
import { applyAction, withEdition } from '@/game/actions';
import { eraRounds, newGame } from '@/game/engine';
import type { GameState, SetupPayload, TileState } from '@/game/types';
import { LOW_PURSE, closingWords, loanWords, shortKeyOf, stepKeyOf } from '../lessonWords';

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
    expect(stepKeyOf('develop', g, 0)).toBe('developShort');
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

describe('the words of the era’s last rounds', () => {
  const tile = (industry: TileState['industry'], level: number, flipped: boolean): TileState => ({ owner: 0, industry, level, flipped, cubes: 0 });
  /** the table in its round before the last, with the reader's tiles on it */
  const late = (eraLength: 'short' | 'standard', tiles: Record<string, TileState>): GameState => {
    const g = structuredClone(table(eraLength));
    g.round = eraRounds(g.players.length) - 1;
    g.tiles = { ...tiles, 'derby:0': { ...tile('coal', 1, false), owner: 1 } };
    return g;
  };

  it('wait for the round before the last', () => {
    const g = late('short', {});
    g.round -= 1;
    expect(closingWords(g, 0)).toBeNull();
  });

  it('name in a short game every tile still unflipped, whatever its level', () => {
    const g = late('short', { 'belper:0': tile('coal', 1, true), 'stoke:1': tile('pottery', 2, false), 'dudley:0': tile('iron', 1, false) });
    const words = closingWords(g, 0)!;
    expect(words.era).toBe('eraEndShort');
    expect(words.mine?.key).toBe('eraEndMineShort');
    /* the machine's tiles are its own business */
    expect(words.mine?.tiles).toEqual([
      { industry: 'pottery', town: 'stoke' },
      { industry: 'iron', town: 'dudley' },
    ]);
  });

  it('say nothing of the reader’s tiles when all are flipped', () => {
    const words = closingWords(late('short', { 'belper:0': tile('coal', 1, true) }), 0)!;
    expect(words.era).toBe('eraEndShort');
    expect(words.mine).toBeNull();
  });

  it('warn a full game of the sweep of its level-1 tiles, flipped or not', () => {
    const open = closingWords(late('standard', { 'belper:0': tile('coal', 1, false), 'stoke:1': tile('pottery', 2, false) }), 0)!;
    expect(open.era).toBe('eraEnd');
    expect(open.mine).toEqual({ key: 'eraEndMine', tiles: [{ industry: 'coal', town: 'belper' }], unflipped: 1 });
    /* all flipped: no count of nought unflipped */
    const done = closingWords(late('standard', { 'belper:0': tile('coal', 1, true) }), 0)!;
    expect(done.mine?.key).toBe('eraEndMineFlipped');
  });
});
