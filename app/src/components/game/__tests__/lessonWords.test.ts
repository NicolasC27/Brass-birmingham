import { describe, expect, it } from 'vitest';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { incomeLevel } from '@/game/data';
import { buildTargets, eraRounds, newGame } from '@/game/engine';
import type { GameState, SetupPayload, TileState } from '@/game/types';
import { LOW_PURSE, barrelBonuses, closingWords, dryRound, firstPayday, loanWords, shortKeyOf, stepKeyOf } from '../lessonWords';

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
    expect(stepKeyOf('plan', g, 0)).toBe('planShort');
    expect(stepKeyOf('tips', g, 0)).toBe('tipsShort');
    /* the rest read the same in either game */
    expect(stepKeyOf('coal', g, 0)).toBe('coal');
  });

  it('is the plain one in a full game', () => {
    const g = table('standard');
    expect(stepKeyOf('goal', g, 0)).toBe('goal');
    expect(stepKeyOf('loan', g, 0)).toBe('loan');
    expect(stepKeyOf('eraEnd', g, 0)).toBe('eraEnd');
  });

  it('tells a loan the reader may pass in words of its own, in either game', () => {
    for (const g of [table(), table('standard')]) {
      expect(stepKeyOf('loan', g, 0, true)).toBe('loanSpare');
      /* a lesson with no such words keeps its own */
      expect(stepKeyOf('coal', g, 0, true)).toBe('coal');
    }
    expect(stepKeyOf('goal', table(), 0, true)).toBe('goalShort');
  });

  it('gives the evening course the guided game’s own titles', () => {
    expect(shortKeyOf('goal')).toBe('goalShort');
    expect(shortKeyOf('welcome')).toBe('welcome');
  });
});

const play = (g: GameState, a: GameAction): GameState => {
  const r = applyAction(g, g.current, a);
  if (!r.state) throw new Error(r.error);
  return r.state;
};
/** the first round played through: the reader's mine, then the machine's move */
const firstRound = (g: GameState): GameState => {
  const at = g.players[0].hand.flatMap((c) => buildTargets(g, 0, c).filter((x) => x.valid && x.industry === 'coal').map((x) => ({ card: c.id, x })))[0];
  let s = play(g, { kind: 'build', card: at.card, town: at.x.town, slot: at.x.slot, industry: 'coal' });
  while (s.round === 1) s = play(s, fallbackAction(s, s.current));
  return s;
};

describe('the first payday', () => {
  it('is read as it was paid, not as the purse stands', () => {
    const g = table();
    expect(firstPayday(g, 0)).toBeNull();
    const s = firstRound(g);
    /* nothing of the reader's flipped in the first round: the payday paid nought */
    expect(firstPayday(s, 0)).toBe(0);
    expect(stepKeyOf('payday', s, 0)).toBe('paydayZero');
    /* a loan since sinks the level below nought; the first payday stays what it was */
    let mine = s;
    while (mine.current !== 0) mine = play(mine, fallbackAction(mine, mine.current));
    const later = play(mine, { kind: 'loan', card: mine.players[0].hand[0].id });
    expect(incomeLevel(later.players[0].income)).toBeLessThan(0);
    expect(stepKeyOf('payday', later, 0)).toBe('paydayZero');
  });

  it('owed, when the income stood below nought', () => {
    const g = structuredClone(firstRound(table()));
    g.history[0].income[0] = -3;
    expect(stepKeyOf('payday', g, 0)).toBe('paydayOwed');
    g.history[0].income[0] = 2;
    expect(stepKeyOf('payday', g, 0)).toBe('payday');
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

describe('the merchants’ barrels', () => {
  it('are read off the table: every merchant with a tile that is not blank', () => {
    const g = table();
    expect(barrelBonuses(g)).toEqual([
      { merchant: 'Shrewsbury', bonus: { vp: 4 } },
      { merchant: 'Oxford', bonus: { income: 2 } },
      { merchant: 'Gloucester', bonus: { develop: true } },
    ]);
  });

  it('leave out a merchant dealt only blank tiles, who keeps no barrel', () => {
    const g = structuredClone(table());
    g.merchantTiles['m-gloucester'] = ['blank', 'blank'];
    expect(barrelBonuses(g).map((x) => x.merchant)).toEqual(['Shrewsbury', 'Oxford']);
  });
});

describe('the round the draw pile runs dry', () => {
  /** a canal era played through plainly, at a table of this size: the
   *  round each one opened with an empty pile, and the era's last round */
  const era = (seats: number) => {
    const setup = {
      players: Array.from({ length: seats }, (_, i) => ({ name: `P${i}`, color: ['brass', 'oxblood', 'verdigris', 'steel'][i], type: 'bot', persona: 'wedgwood' })),
      options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: false },
    } as SetupPayload;
    let g = newGame(withEdition(setup), 5);
    const dry: number[] = [];
    let last = g.round;
    while (g.phase === 'action') {
      if (g.turnPos === 0 && g.deck.length === 0 && !dry.includes(g.round)) dry.push(g.round);
      last = g.round;
      g = play(g, fallbackAction(g, g.current));
    }
    return { dry, last };
  };

  it.each([2, 3, 4])('comes four rounds before the end at %i seats', (seats) => {
    const { dry, last } = era(seats);
    expect(last).toBe(eraRounds(seats));
    expect(dry[0]).toBe(dryRound(seats));
  });
});
