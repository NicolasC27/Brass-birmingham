import { describe, expect, it } from 'vitest';
import { applyAction, replay, setupOf } from '../actions';
import type { GameAction } from '../actions';
import { INDUSTRIES, LINKS, incomeLevel } from '../data';
import { RULES_EDITION, buildTargets, eraRounds, linkTargets, newGame, sellTargets, serialize } from '../engine';
import type { Era, GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* The rules the engine once read wrongly, held to brass/game-data.md: */
/* the rail deal (§4.3, §5.13), a sale short of beer (§5.5, §5.6), the  */
/* bonus a sale owes a merchant's barrel alone (§1.3, §5.5), the coal a */
/* player may choose (§5.3), and what payday takes from a purse that    */
/* cannot pay (§5.12).                                                  */
/* ------------------------------------------------------------------ */

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'human' },
  { name: 'Bob', color: 'verdigris', type: 'human' },
  { name: 'Cy', color: 'brass', type: 'human' },
  { name: 'Di', color: 'steel', type: 'human' },
];
const setup = (n: number, rules?: number): SetupPayload => ({
  players: SEATS.slice(0, n),
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', ...(rules !== undefined ? { rules } : {}) },
});

/** a whole game of passes, each seat laying down the first card it holds:
 *  the log, and the actions each seat took in each era */
function passes(n: number, seed: number, rules?: number) {
  let s = newGame(setup(n, rules), seed);
  const log: GameAction[] = [];
  const taken: Record<Era, number[]> = { canal: Array(n).fill(0), rail: Array(n).fill(0) };
  const rounds: Record<Era, number> = { canal: 0, rail: 0 };
  for (let guard = 0; guard < 2000 && s.phase !== 'game-over'; guard++) {
    const a: GameAction = s.phase === 'scoring-canal' ? { kind: 'begin-rail' } : { kind: 'pass', card: s.players[s.current].hand[0].id };
    if (a.kind === 'pass') taken[s.era][s.current] += 1;
    rounds[s.era] = s.round;
    const r = applyAction(s, s.current, a);
    expect(r.error).toBeUndefined();
    s = r.state!;
    log.push(a);
  }
  return { s, log, taken, rounds };
}

describe('the rail deal', () => {
  it('gives every seat the same number of actions in each era, two a round at the rail', () => {
    for (const n of [2, 3, 4]) {
      const { s, taken, rounds } = passes(n, 7 + n);
      expect(s.phase).toBe('game-over');
      /* the canal: one action in the first round, two in every other */
      expect(new Set(taken.canal).size).toBe(1);
      expect(taken.canal[0]).toBe(1 + 2 * (eraRounds(n) - 1));
      /* the rail: eight cards dealt and nothing burnt, two actions a round */
      expect(taken.rail).toEqual(Array(n).fill(2 * eraRounds(n)));
      expect(rounds.rail).toBe(eraRounds(n));
    }
  });

  it('deals eight cards each and lays no card face down', () => {
    const { log } = passes(4, 1);
    const turn = log.findIndex((a) => a.kind === 'begin-rail');
    const rail = replay(setup(4), 1, log.slice(0, turn + 1));
    expect(rail.era).toBe('rail');
    expect(rail.players.every((p) => p.hand.length === 8)).toBe(true);
    expect(rail.discard).toEqual([]);
    /* every card of the deck in play again, the openers shuffled in: the
       whole pack less the thirty-two in hand, one draw for every action */
    const dealt = newGame(setup(4), 1);
    const pack = dealt.deck.length + dealt.discard.length + dealt.players.reduce((a, p) => a + p.hand.length, 0);
    expect(rail.deck.length).toBe(pack - 32);
  });

  it('still replays a log written under the first edition, and keeps it there', () => {
    const old = passes(4, 1, 1);
    /* the first edition burnt a card per seat: the rail was short for some */
    expect(new Set(old.taken.rail).size).toBeGreaterThan(1);
    /* a log saved before editions were written down names none */
    const bare = setup(4);
    const back = replay(bare, 1, old.log);
    expect(back.rules).toBe(1);
    expect(serialize(back)).toBe(serialize(old.s));
    /* and an undo, a fork or a review carry the edition on */
    expect(setupOf(back).options.rules).toBe(1);
    /* a log that names today's edition is never read under another: the
       same moves, dealt today, leave the rail four moves short of its end */
    const named = replay(setup(4, RULES_EDITION), 1, old.log);
    expect(named.rules).toBeUndefined();
    expect(named.phase).toBe('action');
  });

  it('reads a log that names no edition under today\'s rules when it stands there', () => {
    const today = passes(4, 1);
    const back = replay(setup(4), 1, today.log);
    expect(back.rules).toBeUndefined();
    expect(serialize(back)).toBe(serialize(today.s));
    /* the state keeps no mark of today's edition, and its setup names it */
    expect(newGame(setup(4, RULES_EDITION), 3).rules).toBeUndefined();
    expect(setupOf(today.s).options.rules).toBe(RULES_EDITION);
  });
});

describe('a sale short of beer', () => {
  /* two cotton mills of mine in Worcester, a canal to Gloucester, one barrel
     in the whole country: each mill could sell alone, not both */
  const table = (): { s: GameState; me: number } => {
    const s = newGame(setup(4), 42);
    const me = s.current;
    s.tiles['worcester:0'] = { owner: me, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    s.tiles['worcester:1'] = { owner: me, industry: 'cotton', level: 1, flipped: false, cubes: 0 };
    s.links['worcester--m-gloucester'] = { owner: me, era: 'canal' };
    s.merchantTiles['m-gloucester'] = ['all'];
    s.merchantBeer = {};
    for (const k of Object.keys(s.tiles)) if (s.tiles[k].industry === 'brewery') delete s.tiles[k];
    s.tiles['stone:0'] = { owner: me, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    s.players[me].hand = [{ id: 'any-1', kind: 'wild-location' }];
    return { s, me };
  };
  const both: GameAction = {
    kind: 'sell',
    card: 'any-1',
    sales: [
      { town: 'worcester', slot: 0, merchant: 'm-gloucester' },
      { town: 'worcester', slot: 1, merchant: 'm-gloucester' },
    ],
  };

  it('is refused whole, naming the tile that goes dry — never carried out by half', () => {
    const { s, me } = table();
    const offers = sellTargets(s, me).filter((t) => t.town === 'worcester');
    expect(offers.every((t) => t.valid)).toBe(true);
    const r = applyAction(s, me, both);
    expect(r.state).toBeNull();
    expect(r.error).toBe(`Needs ${INDUSTRIES.cotton[0].beerToSell} beer — a brewery of yours, one connected here, or the merchant's barrel`);
    /* the table as it was: no mill turned, the card still in hand */
    expect(s.tiles['worcester:0'].flipped).toBe(false);
    expect(s.tiles['stone:0'].cubes).toBe(1);
    /* the one mill the beer reaches sells */
    const one = applyAction(s, me, { ...both, sales: both.sales.slice(0, 1) } as GameAction);
    expect(one.state!.tiles['worcester:0'].flipped).toBe(true);
    expect(one.state!.tiles['worcester:1'].flipped).toBe(false);
  });

  it('went through by half under the first edition, and a log of it still does', () => {
    const { s, me } = table();
    s.rules = 1;
    const r = applyAction(s, me, both);
    expect(r.state).not.toBeNull();
    expect([r.state!.tiles['worcester:0'].flipped, r.state!.tiles['worcester:1'].flipped]).toEqual([true, false]);
  });
});

describe('a merchant\'s bonus on a sale', () => {
  /* a manufacturer of mine in Redditch, a canal to Oxford (+2 income on
     its barrel): the beer from Oxford's barrel, or from my own brewery on
     its last barrel, which flips and raises the income on its own */
  const table = (barrel: boolean): { s: GameState; me: number } => {
    const s = newGame(setup(4), 42);
    const me = s.current;
    s.tiles['redditch:0'] = { owner: me, industry: 'manufacturer', level: 1, flipped: false, cubes: 0 };
    s.links[LINKS.find((l) => l.a === 'redditch' && l.b === 'm-oxford')!.id] = { owner: me, era: 'canal' };
    s.merchantTiles['m-oxford'] = ['all'];
    s.merchantBeer = barrel ? { 'm-oxford:0': 1 } : {};
    for (const k of Object.keys(s.tiles)) if (s.tiles[k].industry === 'brewery') delete s.tiles[k];
    if (!barrel) s.tiles['stone:0'] = { owner: me, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
    s.players[me].hand = [{ id: 'any-1', kind: 'wild-location' }];
    return { s, me };
  };
  const sell: GameAction = { kind: 'sell', card: 'any-1', sales: [{ town: 'redditch', slot: 0, merchant: 'm-oxford' }] };
  const saleLine = (s: GameState) => s.ledger.filter((e) => e.key === 'sell').at(-1)!.vars!;

  it('is the barrel\'s: a sale that drinks it reports the income it gave', () => {
    const { s, me } = table(true);
    const income = s.players[me].income;
    const after = applyAction(s, me, sell).state!;
    expect(after.merchantBeer['m-oxford:0']).toBe(0);
    expect(saleLine(after)).toMatchObject({ bonusIncome: incomeLevel(income + 2) - incomeLevel(income), bonusVp: 0, bonusMoney: 0, bonusDevelop: 0 });
  });

  it('is nothing when my own brewery empties and flips on the way', () => {
    const { s, me } = table(false);
    const income = s.players[me].income;
    const after = applyAction(s, me, sell).state!;
    expect(after.tiles['stone:0']).toMatchObject({ cubes: 0, flipped: true });
    /* the brewery's flip raised the income all the same, on its own line */
    expect(after.players[me].income).toBe(income + INDUSTRIES.brewery[0].incomeDelta + INDUSTRIES.manufacturer[0].incomeDelta);
    expect(after.ledger.some((e) => e.key === 'flip' && e.vars?.why === 'barrel')).toBe(true);
    expect(saleLine(after)).toMatchObject({ bonusIncome: 0, bonusVp: 0, bonusMoney: 0, bonusDevelop: 0 });
  });
});

describe('the coal of a build', () => {
  /* an iron works for Coalbrookdale, which burns a cube: a full mine in
     Wolverhampton and a mine on its last cube in Kidderminster, one canal
     away each — the choice between them is the player's (§5.3) */
  const table = (): { s: GameState; me: number; other: number } => {
    const s = newGame(setup(4), 42);
    const me = s.current;
    const other = (me + 1) % 4;
    s.tiles['wolverhampton:1'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 3 };
    s.tiles['kidderminster:0'] = { owner: other, industry: 'coal', level: 2, flipped: false, cubes: 1 };
    s.links['wolverhampton--coalbrookdale'] = { owner: other, era: 'canal' };
    s.links['coalbrookdale--kidderminster'] = { owner: other, era: 'canal' };
    s.players[me].hand = [{ id: 'wild-1', kind: 'wild-location' }];
    s.players[me].money = 40;
    return { s, me, other };
  };
  const build = (coalFrom?: (string | null)[]): GameAction => ({ kind: 'build', card: 'wild-1', town: 'coalbrookdale', slot: 0, industry: 'iron', ...(coalFrom ? { coalFrom } : {}) });

  it('is drawn from the nearest mine the player names, and flips it', () => {
    const { s, me, other } = table();
    const t = buildTargets(s, me, s.players[me].hand[0]).find((x) => x.valid && x.town === 'coalbrookdale' && x.slot === 0 && x.industry === 'iron');
    expect(t).toBeDefined();
    const income = s.players[other].income;
    const r = applyAction(s, me, build(['kidderminster:0']));
    expect(r.state).not.toBeNull();
    expect(r.state!.tiles['kidderminster:0']).toMatchObject({ cubes: 0, flipped: true });
    expect(r.state!.tiles['wolverhampton:1'].cubes).toBe(3);
    /* the mine that ran dry pays its owner at once */
    expect(r.state!.players[other].income).toBe(income + INDUSTRIES.coal[1].incomeDelta);
  });

  it('is the engine\'s to choose when nothing, or no mine among the nearest, is named', () => {
    const { s, me } = table();
    const plain = applyAction(s, me, build()).state!;
    expect(plain.tiles['wolverhampton:1'].cubes).toBe(2);
    expect(plain.tiles['kidderminster:0'].cubes).toBe(1);
    /* a mine further off is no choice while a nearer one holds coal */
    s.tiles['dudley:0'] = { owner: me, industry: 'coal', level: 2, flipped: false, cubes: 3 };
    s.links['wolverhampton--dudley'] = { owner: me, era: 'canal' };
    const far = applyAction(s, me, build(['dudley:0'])).state!;
    expect(far.tiles['dudley:0'].cubes).toBe(3);
    expect(far.tiles['wolverhampton:1'].cubes).toBe(2);
  });

  it('is named cube by cube at the rail, the first link and then the second', () => {
    const { s, me } = table();
    s.era = 'rail';
    for (const l of Object.values(s.links)) l.era = 'rail';
    s.tiles['coalbrookdale:1'] = { owner: me, industry: 'iron', level: 2, flipped: false, cubes: 0 };
    delete s.links['coalbrookdale--kidderminster'];
    const lay = linkTargets(s, me).find((t) => t.link.id === 'coalbrookdale--kidderminster');
    expect(lay?.valid).toBe(true);
    const r = applyAction(s, me, { kind: 'network', card: 'wild-1', link: 'coalbrookdale--kidderminster', coalFrom: ['kidderminster:0'] });
    expect(r.state).not.toBeNull();
    expect(r.state!.tiles['kidderminster:0']).toMatchObject({ cubes: 0, flipped: true });
    expect(r.state!.tiles['wolverhampton:1'].cubes).toBe(3);
  });
});

describe('a purse that cannot pay', () => {
  /* the round's last seat puts down its card and payday comes: I am £0 in
     hand at income level −8, with three works on the board */
  const table = () => {
    const s = newGame(setup(4), 42);
    const me = s.current;
    s.order = [...s.order.filter((i) => i !== me), me];
    s.turnPos = s.order.length - 1;
    s.actionsLeft = 1;
    for (const p of s.players) {
      p.income = 20;
      p.money = 10;
    }
    s.players[me].income = 2; // level −8
    s.players[me].money = 0;
    s.players[me].hand = [{ id: 'last-1', kind: 'wild-location' }, ...s.players[me].hand.slice(1)];
    s.tiles['worcester:0'] = { owner: me, industry: 'cotton', level: 1, flipped: true, cubes: 0 }; // worth £6
    s.tiles['birmingham:1'] = { owner: me, industry: 'manufacturer', level: 3, flipped: false, cubes: 0 }; // worth £6
    s.tiles['coventry:0'] = { owner: me, industry: 'pottery', level: 3, flipped: true, cubes: 0 }; // worth £11
    s.links['worcester--m-gloucester'] = { owner: me, era: 'canal' };
    return { s, me };
  };

  it('gives up works at half their cost until the debt is covered, keeps the change, and never a link', () => {
    const { s, me } = table();
    const r = applyAction(s, me, { kind: 'pass', card: 'last-1' });
    const after = r.state!;
    expect(after.round).toBe(s.round + 1);
    const mine = Object.keys(after.tiles).filter((k) => after.tiles[k].owner === me);
    /* £8 owed: two works of £6 go, the third stays */
    expect(mine).toHaveLength(1);
    expect(after.players[me].money).toBe(4);
    expect(after.players[me].vp).toBe(s.players[me].vp);
    expect(after.links['worcester--m-gloucester']).toEqual({ owner: me, era: 'canal' });
  });

  it('costs a point for every pound still missing once the works are gone', () => {
    const { s, me } = table();
    delete s.tiles['coventry:0'];
    delete s.tiles['birmingham:1'];
    const after = applyAction(s, me, { kind: 'pass', card: 'last-1' }).state!;
    /* £8 owed, £6 raised: two points lost, and the purse left empty */
    expect(Object.keys(after.tiles).some((k) => after.tiles[k].owner === me)).toBe(false);
    expect(after.players[me].money).toBe(0);
    expect(after.players[me].vp).toBe(s.players[me].vp - 2);
  });
});
