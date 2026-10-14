import { describe, expect, it } from 'vitest';
import { INDUSTRIES, LINKS, MERCHANT_BY_ID } from '@/game/data';
import { buildTargets, newGame } from '@/game/engine';
import type { SellTarget } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { barrelAt } from '../merchantRow';
import { routeFor } from '@/components/game/routePaths';
import { provenance, saleBeer, slotAt, sourceCounts, wayBetween } from '../provenance';
import type { PlanPicks, Thread } from '../provenance';

/* the table of the rules' coal case: an iron works for Coalbrookdale burns
   coal, a full mine in Wolverhampton and a mine on its last cube in
   Kidderminster, one canal away each */
const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'human' },
  { name: 'Bob', color: 'verdigris', type: 'human' },
  { name: 'Cy', color: 'brass', type: 'human' },
  { name: 'Di', color: 'steel', type: 'human' },
];
const table = (): { s: GameState; me: number } => {
  const s = newGame({ players: SEATS, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } }, 42);
  const me = s.current;
  const other = (me + 1) % 4;
  s.tiles['wolverhampton:1'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 3 };
  s.tiles['kidderminster:0'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 1 };
  s.links['wolverhampton--coalbrookdale'] = { owner: other, era: 'canal' };
  s.links['coalbrookdale--kidderminster'] = { owner: other, era: 'canal' };
  s.players[me].hand = [{ id: 'wild-1', kind: 'wild-location' }];
  s.players[me].money = 40;
  return { s, me };
};
const picks = (over: Partial<PlanPicks>): PlanPicks => ({
  verb: null,
  buildPick: null,
  linkPick: null,
  secondLinkPick: null,
  sellPicks: [],
  developPick: [],
  developIron: [],
  hoverKey: null,
  ...over,
});
const none = { targets: [], links: [], sales: [] };

describe('where a build draws its coal from', () => {
  const works = (s: GameState, me: number) => buildTargets(s, me, s.players[me].hand[0]).find((x) => x.valid && x.town === 'coalbrookdale' && x.slot === 0 && x.industry === 'iron')!;

  it('threads each cube from the engine\'s mine to the place picked', () => {
    const { s, me } = table();
    const t = works(s, me);
    const p = provenance(s, me, picks({ verb: 'build', buildPick: t }), none);
    const coal = INDUSTRIES.iron[0].coal;
    expect(p.threads).toHaveLength(1);
    expect(p.threads[0]).toMatchObject({ resource: 'coal', amount: coal, key: 'wolverhampton:1', source: 'tile', onTile: true });
    expect(p.threads[0].from).toEqual(slotAt('wolverhampton:1'));
    expect(p.threads[0].to).toEqual(slotAt('coalbrookdale:0'));
    expect(p.market).toEqual([]);
  });

  it('runs the coal along the canal it takes, from the mine to the site', () => {
    const { s, me } = table();
    const route = provenance(s, me, picks({ verb: 'build', buildPick: works(s, me) }), none).threads[0].route;
    const canal = routeFor(LINKS.find((l) => l.id === 'wolverhampton--coalbrookdale')!, 'canal').pts;
    expect(route).not.toBeNull();
    expect(route![0]).toEqual(slotAt('wolverhampton:1'));
    expect(route![route!.length - 1]).toEqual(slotAt('coalbrookdale:0'));
    /* every point of the canal, walked from Wolverhampton's end */
    const from = canal[0][0] === route![1][0] && canal[0][1] === route![1][1] ? canal : [...canal].reverse();
    expect(route!.slice(1, 1 + from.length)).toEqual(from);
  });

  it('follows the mine the hand names, as the move will be sent', () => {
    const { s, me } = table();
    const t = works(s, me);
    const p = provenance(s, me, picks({ verb: 'build', buildPick: t, buildCoal: ['kidderminster:0'] }), none);
    expect(p.threads.map((x) => x.key)).toEqual(['kidderminster:0']);
  });

  it('shows the candidate under the pointer before anything is picked', () => {
    const { s, me } = table();
    const t = works(s, me);
    const p = provenance(s, me, picks({ verb: 'build', hoverKey: 'coalbrookdale:0' }), { targets: [t], links: [], sales: [] });
    expect(p.threads.map((x) => x.key)).toEqual(['wolverhampton:1']);
  });

  it('traces nothing without a verb, or for a seat that is not at the table', () => {
    const { s, me } = table();
    const t = works(s, me);
    expect(provenance(s, me, picks({ buildPick: t }), none).threads).toEqual([]);
    expect(provenance(s, -1, picks({ verb: 'build', buildPick: t }), none).threads).toEqual([]);
  });
});

describe('where a sale drinks its beer from', () => {
  const sale = (): SellTarget => ({
    town: 'coalbrookdale',
    slot: 0,
    tile: { owner: 0, industry: 'cotton', level: 1, flipped: false, cubes: 0 },
    merchant: 'm-shrewsbury',
    beer: [{ kind: 'merchant', merchant: 'm-shrewsbury', slot: 0 }],
    valid: true,
  });

  it('keeps the engine\'s barrel where the hand names none', () => {
    expect(saleBeer(sale())).toEqual([{ kind: 'merchant', merchant: 'm-shrewsbury', slot: 0 }]);
    expect(saleBeer(sale(), [null])).toEqual([{ kind: 'merchant', merchant: 'm-shrewsbury', slot: 0 }]);
  });

  it('reads a brewery or a barrel named in the hand', () => {
    expect(saleBeer(sale(), ['wolverhampton:1'])).toEqual([{ kind: 'brewery', town: 'wolverhampton', slot: 1 }]);
    expect(saleBeer(sale(), ['merchant:1'])).toEqual([{ kind: 'merchant', merchant: 'm-shrewsbury', slot: 1 }]);
  });

  it('threads the beer from the barrel it is drunk from to the works sold', () => {
    const { s, me } = table();
    const m = MERCHANT_BY_ID['m-shrewsbury'];
    expect(m).toBeDefined();
    const p = provenance(s, me, picks({ verb: 'sell', sellPicks: [sale()] }), none);
    expect(p.threads).toHaveLength(1);
    expect(p.threads[0]).toMatchObject({ resource: 'beer', source: 'barrel', key: 'merchant:m-shrewsbury:0' });
    expect(p.threads[0].from).toEqual(barrelAt(m, 0));
    const named = provenance(s, me, picks({ verb: 'sell', sellPicks: [sale()], sellBeer: { 'coalbrookdale:0': ['wolverhampton:1'] } }), none);
    expect(named.threads[0]).toMatchObject({ source: 'tile', key: 'wolverhampton:1' });
  });
});

describe('the way goods travel', () => {
  it('goes town by town over the links laid, the shortest way', () => {
    const { s } = table();
    expect(wayBetween(s, 'wolverhampton', ['kidderminster'])?.nodes).toEqual(['wolverhampton', 'coalbrookdale', 'kidderminster']);
    expect(wayBetween(s, 'coalbrookdale', ['coalbrookdale'])).toEqual({ nodes: ['coalbrookdale'], links: [] });
  });

  it('finds none where no link leads, and counts a link about to be laid', () => {
    const { s } = table();
    expect(wayBetween(s, 'wolverhampton', ['walsall'])).toBeNull();
    const extra = LINKS.filter((l) => l.id === 'walsall--wolverhampton');
    expect(extra).toHaveLength(1);
    expect(wayBetween(s, 'kidderminster', ['walsall'], extra)?.nodes).toEqual(['kidderminster', 'coalbrookdale', 'wolverhampton', 'walsall']);
  });

  it('rolls a merchant\'s barrel along the link to its works, and nothing unreached', () => {
    const { s, me } = table();
    const sale: SellTarget = {
      town: 'coalbrookdale',
      slot: 0,
      tile: { owner: me, industry: 'cotton', level: 1, flipped: false, cubes: 0 },
      merchant: 'm-shrewsbury',
      beer: [{ kind: 'merchant', merchant: 'm-shrewsbury', slot: 0 }],
      valid: true,
    };
    expect(provenance(s, me, picks({ verb: 'sell', sellPicks: [sale] }), none).threads[0].route).toBeNull();
    s.links['coalbrookdale--m-shrewsbury'] = { owner: me, era: 'canal' };
    const route = provenance(s, me, picks({ verb: 'sell', sellPicks: [sale] }), none).threads[0].route;
    expect(route?.[0]).toEqual(barrelAt(MERCHANT_BY_ID['m-shrewsbury'], 0));
    expect(route?.[route.length - 1]).toEqual(slotAt('coalbrookdale:0'));
  });
});

describe('the count on a source', () => {
  const thread = (key: string, to: [number, number], amount = 1, resource: Thread['resource'] = 'coal'): Thread => ({ resource, amount, from: [0, 0], source: 'tile', key, to, onTile: false, route: null });

  it('engrave one plate with the whole draw when a mine feeds both rails of a double', () => {
    expect(sourceCounts([thread('wolverhampton:1', [10, 10]), thread('wolverhampton:1', [50, 50])])).toEqual([2, null]);
  });

  it('keep a plate for each source and each resource', () => {
    const threads = [thread('wolverhampton:1', [10, 10]), thread('kidderminster:0', [10, 10], 2), thread('kidderminster:0', [10, 10], 1, 'beer')];
    expect(sourceCounts(threads)).toEqual([1, 2, 1]);
  });
});
