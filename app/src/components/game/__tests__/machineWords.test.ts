import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { LINKS } from '@/game/data';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { setLang, tr } from '@/i18n';
import { botReason, happenings } from '../machineWords';

/* the machine's plate and the news, on the guided table — you against
   Wedgwood, the canal era only, the deal of seed 3 — with the board set
   by hand where a move needs it */

const ME = 0;
const BOT = 1;

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return structuredClone(newGame(withEdition(setup), 3));
}

/** the key said, and its figures: the words are the dictionaries' business */
const keys = (k: string, v?: Record<string, string | number>) => (v ? `${k}${JSON.stringify(v)}` : k);

/** the machine plays `a`, whoever's turn the deal left it at */
function botPlays(g: GameState, a: GameAction): GameState {
  g.current = BOT;
  const r = applyAction(g, BOT, a);
  expect(r.error).toBeUndefined();
  return r.state!;
}

const link = (a: string, b: string) => LINKS.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))!.id;

describe('the machine’s plate', () => {
  afterEach(() => setLang('fr'));

  it('stays on its move when the payday that follows takes a tile of its', () => {
    const g = table();
    /* deep in debt, one tile to give up, and the round's last action */
    g.players[BOT].income = 0;
    g.players[BOT].money = 0;
    g.tiles['leek:0'] = { owner: BOT, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    const first = applyAction(g, ME, { kind: 'pass', card: g.players[ME].hand[0].id }).state!;
    const after = botPlays(first, { kind: 'pass', card: first.players[BOT].hand[0].id });
    expect(after.ledger.some((e) => e.key === 'sellOff' && e.player === BOT)).toBe(true);
    const plate = botReason(after, ME, keys, 'fr');
    expect(plate?.why).toMatch(/^game\.guide\.bot\.pass/);
    /* and the debt itself comes as news */
    expect(happenings(after, ME, keys).map((x) => x.text).join('\n')).toMatch(/game\.guide\.happens\.theirsSellOff/);
  });

  it('says who opens the next round, and that a tie keeps this round’s order', () => {
    /* round 1 passed, both seats at £0; round 2 to its last action */
    const pass = (g: GameState, seat: number) => applyAction(g, seat, { kind: 'pass', card: g.players[seat].hand[0].id }).state!;
    let g = pass(pass(table(), ME), BOT);
    expect(g.round).toBe(2);
    g = pass(pass(pass(g, ME), ME), BOT);
    expect(g.current).toBe(BOT);
    const last = (spentMe: number) => {
      const before = structuredClone(g);
      before.players[ME].spent = spentMe;
      return pass(before, BOT);
    };
    /* the same spent: the order stands, and the reader, first this round, opens the next */
    expect(botReason(last(0), ME, keys, 'fr')!.turn).toMatch(/^game\.guide\.turn\.roundOverTieYou/);
    /* the reader spent more: the machine opens it, having spent least */
    expect(botReason(last(5), ME, keys, 'fr')!.turn).toMatch(/^game\.guide\.turn\.roundOverBot/);
  });

  it('says what a turn costs in the first round of two actions, and not after', () => {
    const pass = (g: GameState, seat: number) => applyAction(g, seat, { kind: 'pass', card: g.players[seat].hand[0].id }).state!;
    const cards = (g: GameState) => botReason(g, ME, keys, 'fr')!.turn.includes('game.guide.turn.cards');
    let g = pass(pass(table(), ME), BOT);
    expect(cards(g)).toBe(false);
    g = pass(pass(pass(g, ME), ME), BOT);
    expect(g.round).toBe(2);
    expect(cards(g)).toBe(true);
    /* round 3, the order kept by the tie: the machine's first action,
       the words not said again */
    g = pass(pass(pass(g, BOT), ME), ME);
    const first = pass(g, BOT);
    expect(first.round).toBe(3);
    expect(cards(first)).toBe(false);
  });

  it('says where the coal of its build came from, and what the new tile did', () => {
    const g = table();
    /* the reader's mine at Kidderminster, a canal of theirs to Coalbrookdale */
    g.tiles['kidderminster:0'] = { owner: ME, industry: 'coal', level: 1, flipped: false, cubes: 2 };
    g.links[link('coalbrookdale', 'kidderminster')] = { owner: ME, era: 'canal' };
    g.players[BOT].hand = [{ id: 'w', kind: 'wild-location' }];
    const after = botPlays(g, { kind: 'build', card: 'w', town: 'coalbrookdale', slot: 0, industry: 'iron' });
    setLang('fr');
    const why = botReason(after, ME, tr, 'fr')!.why;
    expect(why).toContain('Le charbon est venu de votre mine de Kidderminster.');
    /* an iron works sells to the iron market wherever it stands */
    expect(why).toMatch(/au marché du fer en se posant/);
    expect(why).toMatch(/Vide aussitôt|restent? dessus/);
  });

  it('tells a mine that reached no merchant from one that found the coal market full', () => {
    const mine = (linked: boolean, coal: number) => {
      const g = table();
      if (linked) g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
      g.market.coal = coal;
      g.players[BOT].hand = [{ id: 'w', kind: 'wild-location' }];
      return botReason(botPlays(g, { kind: 'build', card: 'w', town: 'redditch', slot: 0, industry: 'coal' }), ME, keys, 'fr')!.why;
    };
    expect(mine(true, 14)).toMatch(/game\.guide\.bot\.build\.coalFull\{[^}]*"left":2/);
    expect(mine(false, 5)).toMatch(/game\.guide\.bot\.build\.noMerchant/);
    expect(mine(true, 5)).toMatch(/game\.guide\.bot\.build\.sold/);
    /* a canal the reader lays to Oxford afterwards does not rewrite why
       the mine sold nothing as it was laid */
    const g = table();
    g.players[BOT].hand = [{ id: 'w', kind: 'wild-location' }];
    g.market.coal = 5;
    const built = botPlays(g, { kind: 'build', card: 'w', town: 'redditch', slot: 0, industry: 'coal' });
    const id = link('redditch', 'm-oxford');
    built.links[id] = { owner: ME, era: 'canal' };
    built.ledger.push({ id: 9999, round: built.round, era: built.era, player: ME, verb: 'network', text: '', key: 'network', vars: { linkId: id }, at: built.actions.length });
    expect(botReason(built, ME, keys, 'fr')!.why).toMatch(/game\.guide\.bot\.build\.noMerchant/);
  });

  it('never promises a works a buyer its links do not reach', () => {
    const works = (buys: 'all' | 'cotton', level?: number) => {
      const g = table();
      g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
      g.merchantTiles['m-oxford'] = [buys, 'blank'];
      g.players[BOT].hand = [{ id: 'w', kind: 'wild-location' }];
      g.players[BOT].money = 50;
      if (level) g.players[BOT].stacks.manufacturer = [level];
      return botReason(botPlays(g, { kind: 'build', card: 'w', town: 'redditch', slot: 0, industry: 'manufacturer' }), ME, keys, 'fr')!.why;
    };
    expect(works('all')).toMatch(/game\.guide\.bot\.build\.reaches\{[^}]*"list":"Oxford"/);
    /* the beer the tile drinks to sell: one, or two for the heaviest */
    expect(works('all')).toMatch(/"beer":1/);
    expect(works('all', 5)).toMatch(/"beer":2/);
    expect(works('cotton')).toMatch(/game\.guide\.bot\.build\.noBuyer/);
    /* the coal bought, for want of a mine joined to it */
    expect(works('all')).toMatch(/game\.guide\.bot\.coalFrom/);
  });

  it('says what a link reached: a merchant, and a works of its it now sells', () => {
    const g = table();
    g.tiles['redditch:0'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.merchantTiles['m-oxford'] = ['all', 'blank'];
    g.players[BOT].hand = [{ id: 'w', kind: 'wild-location' }];
    const after = botPlays(g, { kind: 'network', card: 'w', link: link('redditch', 'm-oxford') });
    setLang('fr');
    const why = botReason(after, ME, tr, 'fr')!.why;
    expect(why).toContain('Elle atteint Oxford, qui achète le coton, les manufactures et la poterie.');
    expect(why).toContain('Sa manufacture de Redditch peut désormais se vendre à Oxford.');
  });

  it('names the beer a sale drank: the barrel, a brewery of the reader’s, its own', () => {
    const sale = (beer: 'barrel' | 'yours' | 'own') => {
      const g = table();
      g.tiles['redditch:0'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
      g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
      g.merchantTiles['m-oxford'] = ['all', 'blank'];
      g.merchantBeer = beer === 'barrel' ? { 'm-oxford:0': 1 } : {};
      for (const k of Object.keys(g.tiles)) if (g.tiles[k].industry === 'brewery') delete g.tiles[k];
      /* a brewery of the reader's, joined to the sale by a canal of theirs */
      if (beer === 'yours') {
        g.tiles['birmingham:0'] = { owner: ME, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
        g.links[link('birmingham', 'm-oxford')] = { owner: ME, era: 'canal' };
      }
      if (beer === 'own') g.tiles['worcester:0'] = { owner: BOT, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
      const after = botPlays(g, { kind: 'sell', card: g.players[BOT].hand[0].id, sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }] });
      return botReason(after, ME, tr, 'fr')!.why;
    };
    setLang('fr');
    expect(sale('barrel')).toContain('La bière bue venait du baril d’Oxford.');
    expect(sale('yours')).toContain('La bière bue venait de votre brasserie de Birmingham.');
    expect(sale('own')).toContain('La bière bue venait de sa propre brasserie.');
  });

  it('tells a mine of the reader’s sold out as it was laid in one piece of news', () => {
    const mine = (room: number) => {
      const g = table();
      g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
      g.market.coal = 14 - room;
      g.players[ME].hand = [{ id: 'w', kind: 'wild-location' }];
      const after = applyAction(g, ME, { kind: 'build', card: 'w', town: 'redditch', slot: 0, industry: 'coal' }).state!;
      return happenings(after, ME, keys).map((x) => x.text);
    };
    /* room for both cubes: sold, emptied and flipped, said once */
    const out = mine(5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^game\.guide\.happens\.market\{/);
    expect(out[0]).toContain('"goods":"game.guide.happens.goods.coal{\\"n\\":2}"');
    /* room for one: the sale alone */
    expect(mine(1).map((x) => x.split('{')[0])).toEqual(['game.guide.happens.restockMine']);
  });

  it('tells a rival’s brewery drained by the reader’s sale as beer, not coal and iron', () => {
    const g = table();
    g.tiles['redditch:0'] = { owner: ME, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.links[link('redditch', 'm-oxford')] = { owner: ME, era: 'canal' };
    g.merchantTiles['m-oxford'] = ['all', 'blank'];
    g.merchantBeer = {};
    for (const k of Object.keys(g.tiles)) if (g.tiles[k].industry === 'brewery') delete g.tiles[k];
    g.tiles['birmingham:0'] = { owner: BOT, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    g.links[link('birmingham', 'm-oxford')] = { owner: BOT, era: 'canal' };
    const after = applyAction(g, ME, { kind: 'sell', card: g.players[ME].hand[0].id, sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }] }).state!;
    const out = happenings(after, ME, keys).map((x) => x.text.split('{')[0]);
    expect(out).toContain('game.guide.happens.theirsBarrel');
    expect(out).not.toContain('game.guide.happens.theirs');
  });

  it('tells every tile of a sale, and the merchant once', () => {
    const g = table();
    g.tiles['redditch:0'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.tiles['birmingham:1'] = { owner: BOT, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    g.links[link('redditch', 'm-oxford')] = { owner: BOT, era: 'canal' };
    g.links[link('birmingham', 'm-oxford')] = { owner: BOT, era: 'canal' };
    g.merchantTiles['m-oxford'] = ['all', 'all'];
    g.merchantBeer['m-oxford:0'] = 1;
    g.merchantBeer['m-oxford:1'] = 1;
    const after = botPlays(g, { kind: 'sell', card: g.players[BOT].hand[0].id, sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }, { town: 'birmingham', slot: 1, merchant: 'm-oxford' }] });
    const plate = botReason(after, ME, keys, 'fr')!;
    expect(plate.what).toMatch(/^game\.guide\.sellMany/);
    expect(plate.why).toMatch(/^game\.guide\.bot\.sellSome\{/);
    /* said in French, both tiles and Oxford, elided */
    setLang('fr');
    const said = botReason(after, ME, tr, 'fr')!;
    expect(said.what).toContain('Wedgwood vend');
    expect(said.why).toContain('Vendre sa manufacture de Redditch et sa manufacture de Birmingham à Oxford les retourne');
    /* the two barrels gave the bonus twice */
    expect(said.why.match(/\+2 cases de revenu/g)).toHaveLength(2);
  });
});
