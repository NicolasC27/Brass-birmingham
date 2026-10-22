import { describe, expect, it } from 'vitest';
import { withEdition } from '../actions';
import { LINKS } from '../data';
import { buildTargets, developOptions, linkTargets, newGame, sellTargets } from '../engine';
import type { BuildTarget, LinkTarget } from '../engine';
import type { GameState, SetupPayload } from '../types';
import { NO_FREE_LINK, refusalOf, whyNoBuild, whyNoDevelop, whyNoLink, whyNoSale } from '../refusals';
import { dictOf, reasonText, setLang } from '@/i18n';
import type { Lang } from '@/i18n';

/* the one refusal worth telling, among the reasons the engine gives for
   every place it was asked about */

/** the guided table: you against Wedgwood, the canal era only, seed 3 */
function guided(): GameState {
  const setup = { players: [{ name: 'Vous', color: 'brass', type: 'human' }, { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' }], options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true } } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

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

  it('tells a place of the network before a place out of it', () => {
    const targets = [no('Not in your network', 'a'), no('Not in your network', 'b'), no('Canal Era: one tile per location', 'c'), no('This card builds in stoke only', 'd')];
    expect(refusalOf(targets)?.town).toBe('c');
    expect(whyNoBuild([no('Not in your network', 'a'), no('Occupied by another industry', 'b')])).toBe('Occupied by another industry');
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
    const g = guided();
    const forge = g.players[0].hand.find((c) => c.kind === 'industry' && c.industry === 'iron')!;
    /* the market's coal needs a merchant in reach: nowhere on a bare board */
    expect(whyNoBuild(buildTargets(g, 0, forge).filter((x) => x.industry === 'iron'))).toBe('No connected coal — reach a mine or a merchant');
  });
});

describe('a link or a sale refused', () => {
  /* a manufacturer of the reader's in Redditch, Oxford buying everything,
     and — when asked for — every canal from Redditch laid by the machine */
  const table = (walled: boolean, money = 17): GameState => {
    const g = structuredClone(guided());
    g.tiles['redditch:0'] = { owner: 0, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.merchantTiles['m-oxford'] = ['all'];
    g.merchantBeer = {};
    g.players[0].money = money;
    if (walled) for (const l of LINKS.filter((x) => x.canal && [x.a, x.b, x.alsoConnects].includes('redditch'))) g.links[l.id] = { owner: 1, era: 'canal' };
    return g;
  };

  it('tells a purse that pays for a canal that no free link touches the network', () => {
    const walled = table(true);
    expect(linkTargets(walled, 0).some((x) => x.valid)).toBe(false);
    expect(whyNoLink(linkTargets(walled, 0))).toBe(NO_FREE_LINK);
    /* a canal left free, and no money for it: the money */
    expect(whyNoLink(linkTargets(table(false, 1), 0))).toBe('Needs £3 — you hold £1');
  });

  it('tells a rail with no coal to burn why, in every tongue — and money before it', () => {
    /* the rail era, a cotton mill of the reader's at Leek, no link and no mine on the board */
    const g = structuredClone(guided());
    Object.assign(g, { era: 'rail', eraLength: 'standard', links: {}, tiles: { 'leek:0': { owner: 0, industry: 'cotton', level: 1, flipped: false, cubes: 0 } } });
    g.players[0].money = 30;
    const why = whyNoLink(linkTargets(g, 0));
    expect(why).toBe('No connected coal for the locomotives');
    for (const l of ['fr', 'en', 'de', 'es'] as Lang[]) {
      setLang(l);
      expect(reasonText(why)).not.toBe(((dictOf(l).game as Record<string, unknown>).reasons as Record<string, string>).unknown);
    }
    /* a rail the purse cannot pay has its coal: a loan lays it */
    const mixed = [{ valid: false, reason: 'No connected coal for the locomotives' }, { valid: false, reason: 'Needs £7 — you hold £4' }] as LinkTarget[];
    expect(whyNoLink(mixed)).toBe('Needs £7 — you hold £4');
  });

  it('tells a works joined to its buyer that it lacks its beer', () => {
    expect(whyNoSale(sellTargets(table(false), 0))).toBe('No goods connected to a demanding merchant');
    /* the machine's canal to Oxford joins it: no barrel, no brewery */
    expect(whyNoSale(sellTargets(table(true), 0))).toMatch(/^Needs 1 beer/);
  });
});

describe('nothing to develop', () => {
  it('tells an empty purse the money, not the iron the market holds', () => {
    const g = structuredClone(guided());
    g.players[0].money = 0;
    expect(g.market.iron).toBeGreaterThan(0);
    expect(whyNoDevelop(developOptions(g, 0))).toBe('Cannot afford the iron');
    /* an emptied market still sells, at its dearest */
    g.market.iron = 0;
    g.players[0].money = 5;
    expect(whyNoDevelop(developOptions(g, 0))).toBe('Cannot afford the iron');
    expect(whyNoDevelop([])).toBe('Nothing worth developing (needs iron)');
  });
});
