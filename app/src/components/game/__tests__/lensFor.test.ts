import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { Card, GameState, SetupPayload, TileState, Verb } from '@/game/types';
import { lensFor, linksToBuyer, missingLinks } from '../lensFor';

/* The lens of each lesson, on the guided game's deal (seed 3, two seats):
   Shrewsbury buys cotton, by Coalbrookdale; Oxford buys everything, by
   Birmingham and Redditch; Gloucester manufactured goods, by Redditch and
   Worcester. It lights the places a lesson is about, the ones its advice
   would take first strongest, and steps aside for a move being chosen */

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

const tile = (owner: number, industry: TileState['industry'], extra: Partial<TileState> = {}): TileState => ({ owner, industry, level: 1, flipped: false, cubes: 0, ...extra });
const link = (g: GameState, id: string, owner: number) => {
  g.links[id] = { owner, era: 'canal' } as GameState['links'][string];
};
/** a card put in the reader's hand */
const give = (g: GameState, card: Card): string => {
  g.players[0].hand.push(card);
  return card.id;
};
const ctx = (g: GameState, sel: string | null = null, verb: Verb | null = null, mat: number | null = null) => ({ g, me: 0, sel, mat, verb });
const coalCard = (g: GameState) => g.players[0].hand.find((c) => c.kind === 'industry' && c.industry === 'coal')!.id;

describe('the lens of the lesson on coal', () => {
  it('rings the hand, then Build, then lights where the card builds a mine', () => {
    const g = table();
    expect(lensFor('coal', ctx(g))).toEqual({ hud: 'hand' });
    expect(lensFor('coal', ctx(g, coalCard(g)))).toEqual({ hud: 'build' });
    expect(lensFor('coal', ctx(g, coalCard(g), 'network'))).toEqual({ hud: 'build' });
  });

  it('lights first the mines a canal leads from to a town with a forge slot', () => {
    const g = table();
    const lens = lensFor('coal', ctx(g, coalCard(g), 'build'))!;
    /* every place the card builds a mine stays lit */
    expect(lens.slots).toContain('coalbrookdale:2');
    expect(lens.slots).toContain('nuneaton:1');
    expect(lens.slots).toContain('redditch:0');
    /* the dead ends come after: no canal from them reaches a forge */
    expect(lens.first).not.toContain('coalbrookdale:2');
    expect(lens.first).not.toContain('nuneaton:1');
    expect(lens.first).not.toContain('redditch:0');
    expect(lens.first).toEqual(expect.arrayContaining(['belper:1', 'wolverhampton:1', 'dudley:0', 'kidderminster:0']));
    expect(lens.first!.length).toBe(lens.slots!.length - 3);
  });

  it('sends the camera to the mine with the most forges in reach, not the first on the board', () => {
    const g = table();
    /* Wolverhampton: Walsall, Coalbrookdale and Dudley by one canal each */
    expect(lensFor('coal', ctx(g, coalCard(g), 'build'))!.at).toBe('wolverhampton');
  });

  it('leaves every other place of the card lit, the mines first', () => {
    const g = table();
    const wild = give(g, { id: 'wl', kind: 'wild-location' });
    const lens = lensFor('coal', ctx(g, wild, 'build'))!;
    /* a brewery's place is no mine's, and stays open all the same */
    expect(lens.slots).toContain('uttoxeter:0');
    expect(lens.first).not.toContain('uttoxeter:0');
    expect(lens.first).toContain('wolverhampton:1');
    /* no mine of the town leads to a forge: its mine comes first all the same */
    const town = give(g, { id: 'cb', kind: 'location', town: 'coalbrookdale' });
    expect(lensFor('coal', ctx(g, town, 'build'))).toEqual({ slots: ['coalbrookdale:0', 'coalbrookdale:2'], first: ['coalbrookdale:2'], at: 'coalbrookdale' });
  });
});

describe('the lens of the lesson on links', () => {
  it('lights the canal from the reader’s mine to a forge town', () => {
    const g = table();
    g.tiles['wolverhampton:1'] = tile(0, 'coal', { cubes: 2 });
    const card = g.players[0].hand[0].id;
    const ways = ['walsall--wolverhampton', 'wolverhampton--coalbrookdale', 'wolverhampton--dudley'];
    expect(lensFor('link', ctx(g))).toEqual({ hud: 'network', links: ways, at: ways[0] });
    expect(lensFor('link', ctx(g, card, 'network'))).toEqual({ links: ways, at: ways[0] });
    /* another move chosen: its own places, the verb rung */
    expect(lensFor('link', ctx(g, card, 'build'))).toEqual({ hud: 'network' });
  });
});

describe('the lens of the lesson on works', () => {
  const wild = (g: GameState) => give(g, { id: 'wl', kind: 'wild-location' });

  it('lights first the works one canal from its buyer, when none is linked yet', () => {
    const g = table();
    const lens = lensFor('works', ctx(g, wild(g), 'build'))!;
    /* cotton, the one works a bare board lets the card build: Birmingham
       is a canal from Oxford, every other cotton slot further */
    expect(lens.slots).toContain('worcester:0');
    expect(lens.first).toEqual(['birmingham:0']);
    expect(lens.at).toBe('birmingham');
  });

  it('lights first the works whose buyer the links laid reach, whoever laid them', () => {
    const g = table();
    link(g, 'birmingham--m-oxford', 1);
    link(g, 'birmingham--worcester', 1);
    const lens = lensFor('works', ctx(g, wild(g), 'build'))!;
    /* Birmingham's manufactories too, their coal bought at the market by Oxford */
    expect(lens.first).toEqual(['worcester:0', 'worcester:1', 'birmingham:0', 'birmingham:1', 'birmingham:3']);
    expect(lens.slots).toContain('kidderminster:1');
    /* the camera to the cheapest: a manufactory, £8 and a cube */
    expect(lens.at).toBe('birmingham');
  });

  it('counts the links laid by anyone, and free links one each', () => {
    const g = table();
    const cotton = linksToBuyer(g, 'cotton');
    expect(cotton.get('m-oxford')).toBe(0);
    expect(cotton.get('birmingham')).toBe(1);
    expect(cotton.get('worcester')).toBe(2);
    link(g, 'birmingham--worcester', 1);
    expect(linksToBuyer(g, 'cotton').get('worcester')).toBe(1);
    /* Gloucester buys no cotton */
    expect(linksToBuyer(g, 'manufacturer').get('m-gloucester')).toBe(0);
  });
});

describe('the lens of the lesson on selling', () => {
  it('lights the works that will sell, never one that will not', () => {
    const g = table();
    g.tiles['worcester:0'] = tile(0, 'cotton');
    g.tiles['coventry:1'] = tile(0, 'manufacturer');
    link(g, 'birmingham--worcester', 0);
    link(g, 'birmingham--m-oxford', 1);
    const card = g.players[0].hand[0].id;
    expect(lensFor('sell', ctx(g))).toEqual({ slots: ['worcester:0'], at: 'worcester', hud: 'hand' });
    expect(lensFor('sell', ctx(g, card, 'sell'))).toEqual({ slots: ['worcester:0'], at: 'worcester' });
    /* another move chosen: the lens leaves it its own places */
    expect(lensFor('sell', ctx(g, card, 'build'))).toEqual({ hud: 'sell' });
  });

  it('dims nothing on the machine’s turn: the works that sell under the lamp', () => {
    const g = table();
    g.tiles['worcester:0'] = tile(0, 'cotton');
    link(g, 'birmingham--worcester', 0);
    link(g, 'birmingham--m-oxford', 1);
    g.current = 1;
    expect(lensFor('sell', ctx(g))).toEqual({ first: ['worcester:0'], at: 'worcester', hud: 'hand' });
    /* a sale prepared meanwhile: its own places, the rest dimmed */
    expect(lensFor('sell', ctx(g, g.players[0].hand[0].id, 'sell'))).toEqual({ slots: ['worcester:0'], at: 'worcester' });
  });

  it('lights the merchants who keep a barrel, when the buyer is joined and the beer lacks', () => {
    const g = table();
    g.tiles['worcester:0'] = tile(0, 'cotton');
    link(g, 'birmingham--worcester', 0);
    link(g, 'birmingham--m-oxford', 1);
    /* Oxford's barrel drunk, no brewery on the board: Shrewsbury keeps one for cotton */
    g.merchantBeer['m-oxford:0'] = 0;
    const card = g.players[0].hand[0].id;
    expect(lensFor('sell', ctx(g))).toEqual({ merchants: ['m-shrewsbury'], hud: 'hand' });
    expect(lensFor('sell', ctx(g, card, 'sell'))).toEqual({ merchants: ['m-shrewsbury'] });
    expect(lensFor('sell', ctx(g, card, 'build'))).toEqual({ hud: 'sell' });
  });

  it('lights the canal missing toward the buyer, when nothing sells', () => {
    const g = table();
    g.tiles['worcester:0'] = tile(0, 'cotton');
    const card = g.players[0].hand[0].id;
    expect(missingLinks(g, 0)).toEqual(['birmingham--worcester']);
    expect(lensFor('sell', ctx(g))).toEqual({ links: ['birmingham--worcester'], at: 'birmingham--worcester', hud: 'hand' });
    expect(lensFor('sell', ctx(g, card, 'network'))).toEqual({ links: ['birmingham--worcester'], at: 'birmingham--worcester' });
    /* Sell chosen with nothing to sell: the canal, and Network rung */
    expect(lensFor('sell', ctx(g, card, 'sell'))).toEqual({ links: ['birmingham--worcester'], at: 'birmingham--worcester', hud: 'network' });
    /* one canal laid, the next one on the way */
    link(g, 'birmingham--worcester', 0);
    expect(missingLinks(g, 0)).toEqual(['birmingham--m-oxford']);
  });
});

describe('the lens of the aims', () => {
  it('reach: the missing link, or a works built where its buyer is linked', () => {
    const g = table();
    g.tiles['worcester:0'] = tile(0, 'cotton');
    expect(lensFor('reach', ctx(g))?.links).toEqual(['birmingham--worcester']);
    const card = give(g, { id: 'wl', kind: 'wild-location' });
    const lens = lensFor('reach', ctx(g, card, 'build'))!;
    expect(lens.first).toEqual(['birmingham:0']);
    /* the card's other places, a brewery's among them, stay lit */
    expect(lens.slots).toContain('stafford:0');
  });

  it('barrel: the merchants who keep one, and the sales that drink it first', () => {
    const g = table();
    expect(lensFor('barrel', ctx(g))).toEqual({ merchants: ['m-shrewsbury', 'm-oxford', 'm-gloucester'] });
    /* Oxford's barrel drunk: a cotton sold there drinks the reader's
       brewery; one sold at Shrewsbury drinks its barrel */
    g.merchantBeer['m-oxford:0'] = 0;
    g.tiles['stone:0'] = tile(0, 'brewery', { cubes: 2 });
    g.tiles['worcester:0'] = tile(0, 'cotton');
    g.tiles['kidderminster:1'] = tile(0, 'cotton');
    link(g, 'birmingham--worcester', 0);
    link(g, 'birmingham--m-oxford', 1);
    link(g, 'coalbrookdale--kidderminster', 0);
    link(g, 'coalbrookdale--m-shrewsbury', 1);
    const card = g.players[0].hand[0].id;
    expect(lensFor('barrel', ctx(g, card, 'sell'))).toEqual({ slots: ['worcester:0', 'kidderminster:1'], first: ['kidderminster:1'], at: 'kidderminster', merchants: ['m-shrewsbury', 'm-gloucester'] });
    expect(lensFor('barrel', ctx(g, card, 'build'))).toBeNull();
  });
});

describe('the lens steps aside for a move being chosen', () => {
  it('beer: the breweries and the merchants’ barrels, until a move is chosen', () => {
    const g = table();
    g.tiles['stone:0'] = tile(1, 'brewery', { cubes: 1 });
    const card = g.players[0].hand[0].id;
    expect(lensFor('beer', ctx(g))).toEqual({ slots: ['stone:0'], merchants: ['m-shrewsbury', 'm-oxford', 'm-gloucester'] });
    expect(lensFor('beer', ctx(g, card))).toEqual({ slots: ['stone:0'], merchants: ['m-shrewsbury', 'm-oxford', 'm-gloucester'] });
    /* Build or Sell chosen: their own places stay lit */
    expect(lensFor('beer', ctx(g, card, 'build'))).toBeNull();
    expect(lensFor('beer', ctx(g, card, 'sell'))).toBeNull();
  });

  it('flipped: the reader’s flipped tiles, the sold works for the camera', () => {
    const g = table();
    g.tiles['belper:1'] = tile(0, 'coal', { flipped: true });
    g.tiles['worcester:0'] = tile(0, 'cotton', { flipped: true });
    const card = g.players[0].hand[0].id;
    expect(lensFor('flipped', ctx(g))).toEqual({ slots: ['belper:1', 'worcester:0'], at: 'worcester' });
    expect(lensFor('flipped', ctx(g, card, 'build'))).toBeNull();
  });

  it('board: the merchants, never over a move', () => {
    const g = table();
    expect(lensFor('board', ctx(g))).toEqual({ merchants: ['m-shrewsbury', 'm-oxford', 'm-gloucester'] });
    expect(lensFor('board', ctx(g, g.players[0].hand[0].id, 'build'))).toBeNull();
  });
});

describe('the halos of the lessons', () => {
  it('ring the points and the income track for the goal, the mat or the mat open', () => {
    const g = table();
    expect(lensFor('goal', ctx(g))).toEqual({ hud: ['vp', 'income'] });
    expect(lensFor('payday', ctx(g))).toEqual({ hud: 'income' });
    expect(lensFor('mat', ctx(g))).toEqual({ hud: 'mat' });
    expect(lensFor('matRead', ctx(g, null, null, 0))).toEqual({ hud: 'mat-open' });
    expect(lensFor('matRead', ctx(g, null, null, 1))).toEqual({ hud: 'mat-open' });
  });
});
