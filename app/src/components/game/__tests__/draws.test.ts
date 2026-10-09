import { beforeAll, describe, expect, it } from 'vitest';
import { LINKS } from '@/game/data';
import { barrelKey, buildTargets, linkTargets, newGame, sellTargets } from '@/game/engine';
import type { BuildTarget, LinkTarget } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { setLang, tr } from '@/i18n';
import { drawText, mergeDraws, moveHead, planDraws, saleText, waybillText } from '../draws';
import type { Draw, DrawPicks } from '../draws';

/* ------------------------------------------------------------------ */
/* The waybill of the banner: what a move draws, token by token, from   */
/* the siding it really leaves — the mine the reader named, a rival's   */
/* works, the exchange at its price, a merchant's barrel.               */
/* ------------------------------------------------------------------ */

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'human' },
  { name: 'Bob', color: 'verdigris', type: 'human' },
  { name: 'Cy', color: 'brass', type: 'human' },
  { name: 'Di', color: 'steel', type: 'human' },
];
const setup: SetupPayload = { players: SEATS, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } };

/* Coalbrookdale, one canal from a full mine in Wolverhampton and one from
   a mine on its last cube in Kidderminster, both a rival's */
function table(): { s: GameState; me: number; other: number } {
  const s = newGame(setup, 42);
  const me = s.current;
  const other = (me + 1) % 4;
  s.tiles['wolverhampton:1'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 3 };
  s.tiles['kidderminster:0'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 1 };
  s.links['wolverhampton--coalbrookdale'] = { owner: other, era: 'canal' };
  s.links['coalbrookdale--kidderminster'] = { owner: other, era: 'canal' };
  s.players[me].hand = [{ id: 'wild-1', kind: 'wild-location' }];
  s.players[me].money = 40;
  return { s, me, other };
}

function ironWorks(s: GameState, me: number): BuildTarget {
  const t = buildTargets(s, me, s.players[me].hand[0]).find((x) => x.valid && x.town === 'coalbrookdale' && x.slot === 0 && x.industry === 'iron');
  expect(t).toBeDefined();
  return t!;
}

const picks = (p: Partial<DrawPicks>): DrawPicks => ({ verb: null, buildPick: null, linkPick: null, secondLinkPick: null, sellPicks: [], developPick: [], developIron: [], ...p });

beforeAll(() => setLang('en'));

describe('the waybill of a build', () => {
  it('draws the coal from the rival mine the engine picks, tinted as a rival', () => {
    const { s, me, other } = table();
    const w = planDraws(s, me, picks({ verb: 'build', buildPick: ironWorks(s, me) }));
    expect(w.draws).toEqual([{ resource: 'coal', source: 'rival', n: 1, cost: 0, owner: other, town: 'wolverhampton' }]);
    expect(drawText(w.draws[0], s, tr)).toBe(`1 coal from ${s.players[other].name}'s mine at Wolverhampton`);
    /* the works reaches a merchant: its spare iron goes to the exchange at once */
    expect(w.sale).toMatchObject({ resource: 'iron', n: 2 });
    expect(saleText(w.sale!, tr)).toBe(`sells 2 iron to the market, +£${w.sale!.gain}`);
  });

  it('follows the mine the reader named', () => {
    const { s, me } = table();
    const w = planDraws(s, me, picks({ verb: 'build', buildPick: ironWorks(s, me), buildCoal: ['kidderminster:0'] }));
    expect(w.draws.map((d) => d.town)).toEqual(['kidderminster']);
  });

  it('calls the reader’s own mine their own', () => {
    const { s, me } = table();
    s.tiles['wolverhampton:1'].owner = me;
    s.tiles['kidderminster:0'].owner = me;
    const w = planDraws(s, me, picks({ verb: 'build', buildPick: ironWorks(s, me) }));
    expect(w.draws[0].source).toBe('own');
    expect(drawText(w.draws[0], s, tr)).toBe('1 coal from your mine at Wolverhampton');
  });

  it('heads the line with the works and the town, and the tile’s own price', () => {
    const { s, me } = table();
    const head = moveHead(s, me, picks({ verb: 'build', buildPick: ironWorks(s, me) }), tr);
    expect(head).toEqual({ what: 'Iron Works L1 · Coalbrookdale', price: 5 });
  });
});

describe('the waybill of a development', () => {
  it('buys its iron at the exchange when no works holds a cube, at the price paid', () => {
    const { s, me } = table();
    const w = planDraws(s, me, picks({ verb: 'develop', developPick: ['pottery', 'cotton'], developIron: [null, null] }));
    expect(w.draws).toHaveLength(1);
    expect(w.draws[0]).toMatchObject({ resource: 'iron', source: 'market', n: 2 });
    expect(w.draws[0].cost).toBeGreaterThan(0);
    expect(drawText(w.draws[0], s, tr)).toBe(`2 iron from the market for £${w.draws[0].cost}`);
  });

  it('takes the iron from a works on the board before the exchange', () => {
    const { s, me, other } = table();
    s.tiles['dudley:0'] = { owner: other, industry: 'iron', level: 1, flipped: false, cubes: 4 };
    const w = planDraws(s, me, picks({ verb: 'develop', developPick: ['pottery'], developIron: [null] }));
    expect(w.draws).toEqual([{ resource: 'iron', source: 'rival', n: 1, cost: 0, owner: other, town: 'dudley' }]);
    expect(waybillText(w, s, tr)).toBe(`1 iron from ${s.players[other].name}'s ironworks at Dudley`);
  });
});

describe('the waybill of the rails', () => {
  const rail = () => {
    const { s, me, other } = table();
    s.era = 'rail';
    for (const l of Object.values(s.links)) l.era = 'rail';
    s.tiles['coalbrookdale:1'] = { owner: me, industry: 'iron', level: 2, flipped: false, cubes: 0 };
    delete s.links['coalbrookdale--kidderminster'];
    const first = linkTargets(s, me).find((t) => t.link.id === 'coalbrookdale--kidderminster') as LinkTarget;
    const def = LINKS.find((l) => l.a === 'coalbrookdale' && l.b === 'm-shrewsbury')!;
    const second: LinkTarget = { link: def, cost: 0, coalPlan: { sources: [], totalCost: 0, shortage: 0 }, total: 0, valid: true };
    return { s, me, other, first, second };
  };

  it('burns a cube a rail, the two from the same mine read as one token', () => {
    const { s, me, other, first, second } = rail();
    s.tiles['coalbrookdale:2'] = { owner: me, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    const w = planDraws(s, me, picks({ verb: 'network', linkPick: first, secondLinkPick: second }));
    const coal = w.draws.filter((d) => d.resource === 'coal');
    expect(coal).toEqual([{ resource: 'coal', source: 'rival', n: 2, cost: 0, owner: other, town: 'wolverhampton' }]);
    expect(w.draws.find((d) => d.resource === 'beer')).toMatchObject({ source: 'own', n: 1, town: 'coalbrookdale' });
  });

  it('reads two rails through a shared town as one line', () => {
    const { s, me, first, second } = rail();
    const head = moveHead(s, me, picks({ verb: 'network', linkPick: first, secondLinkPick: second }), tr);
    expect(head?.what).toBe('Kidderminster ⇄ Coalbrookdale ⇄ Shrewsbury');
    expect(head?.price).toBe(15);
  });

  it('draws nothing for a canal', () => {
    const { s, me } = table();
    const lay = linkTargets(s, me).find((t) => t.valid)!;
    expect(planDraws(s, me, picks({ verb: 'network', linkPick: lay })).draws).toEqual([]);
  });
});

describe('the waybill of a sale', () => {
  it('lets each tile drink what the ones before it left', () => {
    const { s, me } = table();
    s.merchantTiles['m-shrewsbury'] = ['all'];
    s.merchantBeer[barrelKey('m-shrewsbury', 0)] = 1;
    s.links['coalbrookdale--m-shrewsbury'] = { owner: me, era: 'canal' };
    s.tiles['coalbrookdale:0'] = { owner: me, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    s.tiles['coalbrookdale:1'] = { owner: me, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    s.tiles['coalbrookdale:2'] = { owner: me, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    const sales = sellTargets(s, me).filter((x) => x.valid && x.merchant === 'm-shrewsbury');
    expect(sales).toHaveLength(2);
    const w = planDraws(s, me, picks({ verb: 'sell', selectedCardId: 'wild-1', sellPicks: sales }));
    /* the first sale takes the merchant's one barrel, the second the brewery */
    expect(w.draws).toEqual([
      { resource: 'beer', source: 'merchant', n: 1, cost: 0, merchant: 'm-shrewsbury' },
      { resource: 'beer', source: 'own', n: 1, cost: 0, owner: me, town: 'coalbrookdale' },
    ]);
    /* the table itself is not touched */
    expect(s.tiles['coalbrookdale:0'].flipped).toBe(false);
    expect(s.merchantBeer[barrelKey('m-shrewsbury', 0)]).toBe(1);
    const head = moveHead(s, me, picks({ verb: 'sell', sellPicks: sales }), tr);
    expect(head?.what).toBe('Cotton Mill L1 → Shrewsbury +1');
    expect(head?.full).toBe('Cotton Mill L1 → Shrewsbury · Cotton Mill L1 → Shrewsbury');
  });
});

describe('merging the tokens', () => {
  it('adds cubes and pounds from one siding, and keeps the order of the draw', () => {
    const d: Draw[] = [
      { resource: 'coal', source: 'market', n: 1, cost: 2 },
      { resource: 'iron', source: 'own', n: 1, cost: 0, owner: 0, town: 'dudley' },
      { resource: 'coal', source: 'market', n: 1, cost: 3 },
    ];
    expect(mergeDraws(d)).toEqual([
      { resource: 'coal', source: 'market', n: 2, cost: 5 },
      { resource: 'iron', source: 'own', n: 1, cost: 0, owner: 0, town: 'dudley' },
    ]);
    /* the input is left as it was */
    expect(d[0].n).toBe(1);
  });

  it('says a merchant’s barrel by its merchant', () => {
    const { s } = table();
    expect(drawText({ resource: 'beer', source: 'merchant', n: 1, cost: 0, merchant: 'm-shrewsbury' }, s, tr)).toBe("1 beer from the Shrewsbury merchant's barrel");
  });
});
