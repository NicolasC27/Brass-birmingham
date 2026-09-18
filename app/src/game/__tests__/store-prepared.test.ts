import { describe, expect, it } from 'vitest';
import { newGame } from '../engine';
import { lastActionOf, projectQueued, suggestUnless, unlessHit } from '../store';
import type { Unless } from '../store';
import type { GameState, LedgerEntry, SetupPayload } from '../types';

/* the clauses on a prepared move: what they offer, and what makes them fire */

const setup: SetupPayload = {
  players: [
    { name: 'Nico', color: 'brass', type: 'human' },
    { name: 'Eve', color: 'oxblood', type: 'human' },
    { name: 'Cy', color: 'verdigris', type: 'bot', persona: 'wedgwood' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const line = (over: Partial<LedgerEntry>): LedgerEntry => ({ id: 1, round: 1, era: 'canal', verb: 'build', text: '', ...over });

describe('the ready-made clauses', () => {
  it('guard the slot and the town of a build', () => {
    const s = suggestUnless({ kind: 'build', card: 'c', town: 'dudley', slot: 0, industry: 'coal' });
    expect(s.map((x) => x.key)).toEqual(['slotTaken', 'linkLaid']);
    expect(s[0].unless).toEqual({ player: 'any', kind: 'build', town: 'dudley' });
    expect(s[1].unless).toEqual({ player: 'any', kind: 'network', town: 'dudley' });
  });
  it('guard the very link, and the far town only when it is a town', () => {
    const toTown = suggestUnless({ kind: 'network', card: 'c', link: 'birmingham--dudley' });
    expect(toTown.map((x) => x.key)).toEqual(['linkTaken', 'builtThere']);
    expect(toTown[0].unless.link).toBe('birmingham--dudley');
    expect(toTown[1].unless.town).toBe('dudley');
    const toMerchant = suggestUnless({ kind: 'network', card: 'c', link: 'birmingham--m-oxford' });
    expect(toMerchant.map((x) => x.key)).toEqual(['linkTaken']);
  });
  it('guard the merchant of a sale, not the seller\'s town', () => {
    const s = suggestUnless({ kind: 'sell', card: 'c', sales: [{ town: 'kidderminster', slot: 1, merchant: 'm-gloucester' }] });
    expect(s[0].unless).toEqual({ player: 'any', kind: 'sell', merchant: 'm-gloucester' });
  });
});

describe('a clause fires', () => {
  const me = 0;
  it('on a link laid to the town, whichever end the ledger names first', () => {
    const u: Unless = { player: 'any', kind: 'network', town: 'dudley' };
    const laid = line({ player: 1, verb: 'network', key: 'network', region: 'birmingham', vars: { townA: 'birmingham', townB: 'dudley', linkId: 'birmingham--dudley' } });
    expect(unlessHit(u, laid, me)).toBe(true);
    expect(unlessHit(u, { ...laid, vars: { townA: 'birmingham', townB: 'walsall', linkId: 'birmingham--walsall' } }, me)).toBe(false);
    /* my own move never counts against my own plan */
    expect(unlessHit(u, { ...laid, player: me }, me)).toBe(false);
  });
  it('on that very link, and on a sale to that merchant from anywhere', () => {
    const link: Unless = { player: 'any', kind: 'network', link: 'birmingham--dudley' };
    expect(unlessHit(link, line({ player: 2, verb: 'network', key: 'network', region: 'dudley', vars: { townA: 'dudley', townB: 'birmingham', linkId: 'birmingham--dudley' } }), me)).toBe(true);
    expect(unlessHit(link, line({ player: 2, verb: 'network', key: 'network', region: 'dudley', vars: { townA: 'dudley', townB: 'kidderminster', linkId: 'dudley--kidderminster' } }), me)).toBe(false);
    const beer: Unless = { player: 1, kind: 'sell', merchant: 'm-gloucester' };
    expect(unlessHit(beer, line({ player: 1, verb: 'sell', key: 'sell', region: 'worcester', vars: { merchantId: 'm-gloucester' } }), me)).toBe(true);
    expect(unlessHit(beer, line({ player: 1, verb: 'sell', key: 'sell', region: 'kidderminster', vars: { merchantId: 'm-oxford' } }), me)).toBe(false);
    expect(unlessHit(beer, line({ player: 2, verb: 'sell', key: 'sell', region: 'worcester', vars: { merchantId: 'm-gloucester' } }), me)).toBe(false);
  });
  it('on a build there, of that works when one is named', () => {
    const any: Unless = { player: 'any', kind: 'build', town: 'dudley' };
    const coal: Unless = { player: 'any', kind: 'build', town: 'dudley', industry: 'coal' };
    const iron = line({ player: 1, verb: 'build', key: 'build', region: 'dudley', vars: { industry: 'iron' } });
    expect(unlessHit(any, iron, me)).toBe(true);
    expect(unlessHit(coal, iron, me)).toBe(false);
    expect(unlessHit(coal, { ...iron, vars: { industry: 'coal' } }, me)).toBe(true);
  });
});

describe('the last move of a seat', () => {
  it('is an action of theirs, not a flip credited to them', () => {
    const g: GameState = { ...newGame(setup, 5), actions: [{ kind: 'pass', card: 'x' } as never, { kind: 'pass', card: 'y' } as never] };
    g.ledger = [
      line({ id: 10, player: 1, verb: 'build', key: 'build', at: 0 }),
      line({ id: 11, player: 1, verb: 'score', key: 'flip', at: 1 }),
      line({ id: 12, player: 0, verb: 'sell', key: 'sell', at: 1 }),
    ];
    expect(lastActionOf(g, 1)).toBe(0);
    expect(lastActionOf(g, 0)).toBe(1);
    expect(lastActionOf(g, 2)).toBe(-1);
  });
});

describe('the projection of prepared moves', () => {
  it('grants no more actions than the turn will', () => {
    const g = newGame(setup, 5);
    expect(g.round).toBe(1);
    const sim = projectQueued(g, 0, []);
    expect(sim.actionsLeft).toBe(1);
    expect(sim.current).toBe(0);
  });
});
