import { describe, expect, it } from 'vitest';
import { withEdition } from '../actions';
import { buildTargets, newGame } from '../engine';
import type { BuildTarget } from '../engine';
import type { SetupPayload } from '../types';
import { refusalOf, whyNoBuild } from '../refusals';

/* the one refusal worth telling, among the reasons the engine gives for
   every place it was asked about */

const no = (reason: string, town = 'birmingham'): BuildTarget => ({ town, slot: 0, industry: 'iron', level: 1, cost: 0, coalPlan: { sources: [], shortage: 0, totalCost: 0 }, ironPlan: { sources: [], shortage: 0, totalCost: 0 }, total: 0, valid: false, reason });

describe('the refusal worth telling', () => {
  it('puts what a canal, a mine or a loan would open before the structural reasons', () => {
    const targets = [no('Occupied by another industry'), no('This card builds in stoke only'), no('Needs £9 — you hold £4'), no('Not in your network'), no('No connected coal — reach a mine or a merchant', 'redditch')];
    expect(refusalOf(targets)?.town).toBe('redditch');
    expect(whyNoBuild(targets.slice(0, 4))).toBe('Needs £9 — you hold £4');
    expect(whyNoBuild(targets.slice(0, 2))).toBe('Occupied by another industry');
    /* a card that names another town or industry is told last */
    expect(whyNoBuild(targets.slice(1, 2))).toBe('This card builds in stoke only');
  });

  it('takes, among reasons ranked alike, the one most places give — and the first place to give it', () => {
    const targets = [no('This card builds in stoke only', 'a'), no('This card builds coal only', 'b'), no('This card builds coal only', 'c')];
    expect(refusalOf(targets)?.town).toBe('b');
  });

  it('has nothing to tell when nothing was refused', () => {
    expect(refusalOf([])).toBeNull();
    expect(refusalOf([{ ...no('Not in your network'), valid: true }])).toBeNull();
    expect(whyNoBuild([])).toBe('No valid construction site for this card');
  });

  it('tells the forge card on a bare board that no coal is connected', () => {
    const setup = { players: [{ name: 'Vous', color: 'brass', type: 'human' }, { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' }], options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true } } as SetupPayload;
    const g = newGame(withEdition(setup), 3);
    const forge = g.players[0].hand.find((c) => c.kind === 'industry' && c.industry === 'iron')!;
    /* the market's coal needs a merchant in reach: nowhere on a bare board */
    expect(whyNoBuild(buildTargets(g, 0, forge).filter((x) => x.industry === 'iron'))).toBe('No connected coal — reach a mine or a merchant');
  });
});
