import { describe, expect, it } from 'vitest';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { incomeLevel } from '@/game/data';
import { buildTargets, eraRounds, newGame } from '@/game/engine';
import type { GameState, SetupPayload, TileState } from '@/game/types';
import { MOTIFS } from '@/game/progress';
import { LESSON_IDS } from '../lessons';
import { LOW_PURSE, MOTIF_LESSON, barrelBonuses, buyersOf, closingWords, dryRound, firstPayday, forgeWays, forgesFrom, forgesFromMines, loanWords, plainKeyOf, shortKeyOf, stepKeyOf, worksOnMat } from '../lessonWords';

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

  it('promises no payday in a short game\'s last round', () => {
    const g = table();
    const last = { ...g, round: 10 };
    expect(stepKeyOf('loan', last, 0)).toBe('loanShortLast');
    /* whether the purse may spare it or not: there is no later */
    expect(stepKeyOf('loan', last, 0, true)).toBe('loanShortLast');
    expect(stepKeyOf('loan', { ...g, round: 9 }, 0)).toBe('loanShort');
    /* a full game's canal ends on a payday: the rail is still to come */
    expect(stepKeyOf('loan', { ...table('standard'), round: 10 }, 0)).toBe('loan');
  });

  it('is the plain one in a full game', () => {
    const g = table('standard');
    expect(stepKeyOf('goal', g, 0)).toBe('goal');
    expect(stepKeyOf('loan', g, 0)).toBe('loan');
    expect(stepKeyOf('eraEnd', g, 0)).toBe('eraEnd');
  });

  it('reads the sale at a plain table as any sale, not the guided game\'s first', () => {
    for (const g of [table(), table('standard')]) {
      expect(stepKeyOf('sell', g, 0)).toBe('sell');
      expect(plainKeyOf('sell', g, 0)).toBe('sellAny');
      /* the others read as the game would have them */
      expect(plainKeyOf('loan', g, 0)).toBe(stepKeyOf('loan', g, 0));
    }
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

describe('who buys what at the table', () => {
  it('is read off the merchants’ tiles, those buying everything last', () => {
    /* seed 3: cotton at Shrewsbury, everything and a blank at Oxford, a
       blank and manufactured goods at Gloucester */
    expect(buyersOf(table())).toEqual([
      { merchant: 'Shrewsbury', goods: ['cotton'] },
      { merchant: 'Gloucester', goods: ['manufacturer'] },
      { merchant: 'Oxford', goods: 'all' },
    ]);
  });

  it('names two goods of one merchant, and leaves out a merchant of blanks', () => {
    const g = structuredClone(table());
    g.merchantTiles = { 'm-shrewsbury': ['blank'], 'm-oxford': ['pottery', 'cotton'], 'm-gloucester': ['all', 'manufacturer'] };
    expect(buyersOf(g)).toEqual([
      { merchant: 'Oxford', goods: ['cotton', 'pottery'] },
      { merchant: 'Gloucester', goods: 'all' },
    ]);
  });
});

describe('the works the mat offers next', () => {
  it('are its lowest tiles, priced as the tiles print them', () => {
    expect(worksOnMat(table(), 0)).toEqual([
      { industry: 'cotton', level: 1, cost: 12, coal: 0, iron: 0 },
      { industry: 'manufacturer', level: 1, cost: 8, coal: 1, iron: 0 },
      { industry: 'pottery', level: 1, cost: 17, coal: 0, iron: 1 },
    ]);
  });

  it('follow a development, and leave out a tile the era does not build', () => {
    const g = structuredClone(table());
    /* the cotton mills of level I developed away */
    g.players[0].stacks.cotton = g.players[0].stacks.cotton.filter((l) => l > 1);
    expect(worksOnMat(g, 0)[0]).toEqual({ industry: 'cotton', level: 2, cost: 14, coal: 1, iron: 0 });
    /* the rail era builds no level I cotton mill or manufactory */
    g.era = 'rail';
    expect(worksOnMat(g, 0).map((x) => `${x.industry} ${x.level}`)).toEqual(['cotton 2', 'pottery 1']);
    /* all built: nothing to quote */
    g.players[0].stacks = { ...g.players[0].stacks, cotton: [], manufacturer: [], pottery: [] };
    expect(worksOnMat(g, 0)).toEqual([]);
  });
});

describe('where a first mine feeds a forge', () => {
  const tile = (owner: number, industry: TileState['industry']): TileState => ({ owner, industry, level: 1, flipped: false, cubes: 0 });

  it('reads the forge towns and the dead ends off the board', () => {
    const g = table();
    /* the towns a canal leads to from a mine slot, and the three mine
       towns no canal leads from to a forge (review, a01v) */
    expect(forgeWays(g, 0)).toEqual({ forges: ['derby', 'stoke', 'walsall', 'coalbrookdale', 'dudley', 'birmingham'], deadEnds: ['coalbrookdale', 'nuneaton', 'redditch'] });
    expect(forgesFrom(g, 0, 'wolverhampton')).toEqual(['walsall', 'coalbrookdale', 'dudley']);
    expect(forgesFrom(g, 0, 'dudley')).toEqual(['birmingham']);
    /* Nuneaton's one canal goes to Tamworth; its ways to Coventry and Birmingham are rails */
    expect(forgesFrom(g, 0, 'nuneaton')).toEqual([]);
  });

  it('leaves out a town the reader already holds, and a forge slot taken', () => {
    const g = structuredClone(table());
    /* one tile to a town in the canal era: a works of the reader's in
       Birmingham leaves a Dudley mine no forge of theirs by canal */
    g.tiles = { 'birmingham:0': tile(0, 'cotton') };
    expect(forgesFrom(g, 0, 'dudley')).toEqual([]);
    expect(forgeWays(g, 0).deadEnds).toContain('dudley');
    /* the machine's forge on Birmingham's one forge slot: the same */
    g.tiles = { 'birmingham:2': tile(1, 'iron') };
    expect(forgesFrom(g, 0, 'dudley')).toEqual([]);
    /* the machine's works elsewhere in the town leaves the slot free */
    g.tiles = { 'birmingham:0': tile(1, 'cotton') };
    expect(forgesFrom(g, 0, 'dudley')).toEqual(['birmingham']);
  });

  it('sends the canal from the reader’s own mine, and nowhere from a dead end', () => {
    const g = structuredClone(table());
    expect(forgesFromMines(g, 0)).toEqual([]);
    g.tiles = { 'wolverhampton:1': tile(0, 'coal') };
    expect(forgesFromMines(g, 0)).toEqual(['walsall', 'coalbrookdale', 'dudley']);
    /* the machine's mine is not the reader's */
    g.tiles = { 'wolverhampton:1': tile(1, 'coal') };
    expect(forgesFromMines(g, 0)).toEqual([]);
    g.tiles = { 'redditch:0': tile(0, 'coal') };
    expect(forgesFromMines(g, 0)).toEqual([]);
  });

  it('counts the canals the reader may still lay or has laid, not another’s', () => {
    const g = structuredClone(table());
    g.tiles = { 'wolverhampton:1': tile(0, 'coal') };
    /* the machine's canal to Dudley carries the coal, but Dudley is not
       in the reader's network for it: the forge card cannot build there */
    g.links = { 'wolverhampton--dudley': { owner: 1, era: 'canal' } };
    expect(forgesFromMines(g, 0)).toEqual(['walsall', 'coalbrookdale']);
    expect(forgesFrom(g, 0, 'wolverhampton')).toEqual(['walsall', 'coalbrookdale']);
    g.links = { 'wolverhampton--dudley': { owner: 0, era: 'canal' } };
    expect(forgesFromMines(g, 0)).toEqual(['walsall', 'coalbrookdale', 'dudley']);
    /* the reader's forge built at the far end: the canal still went there */
    g.tiles['dudley:1'] = tile(0, 'iron');
    expect(forgesFromMines(g, 0)).toEqual(['walsall', 'coalbrookdale', 'dudley']);
    expect(stepKeyOf('link', g, 0)).toBe('link');
  });
});

describe('a canal and a forge sent another way', () => {
  const tile = (owner: number, industry: TileState['industry']): TileState => ({ owner, industry, level: 1, flipped: false, cubes: 0 });

  it('sends the canal toward a merchant from a mine no canal leads to a forge from', () => {
    const g = structuredClone(table());
    /* no mine yet: the plain words */
    expect(stepKeyOf('link', g, 0)).toBe('link');
    g.tiles = { 'wolverhampton:1': tile(0, 'coal') };
    expect(stepKeyOf('link', g, 0)).toBe('link');
    g.tiles = { 'redditch:0': tile(0, 'coal') };
    expect(stepKeyOf('link', g, 0)).toBe('linkAstray');
    /* the one free canal to a forge taken by the machine: the same */
    g.tiles = { 'dudley:0': tile(0, 'coal') };
    g.links = { 'birmingham--dudley': { owner: 1, era: 'canal' } };
    expect(stepKeyOf('link', g, 0)).toBe('linkAstray');
  });

  it('builds the forge on a location card when the network touches no forge town', () => {
    const g = structuredClone(table());
    /* nothing on the board: the forge card builds anywhere */
    expect(stepKeyOf('iron', g, 0)).toBe('iron');
    /* a canal from the mine to a forge town */
    g.tiles = { 'wolverhampton:1': tile(0, 'coal') };
    g.links = { 'wolverhampton--dudley': { owner: 0, era: 'canal' } };
    expect(stepKeyOf('iron', g, 0)).toBe('iron');
    /* a Redditch mine and its canal to Oxford: no forge town in the network */
    g.tiles = { 'redditch:0': tile(0, 'coal') };
    g.links = { 'redditch--m-oxford': { owner: 0, era: 'canal' } };
    expect(stepKeyOf('iron', g, 0)).toBe('ironAstray');
    /* read back once the forge stands: the plain words again */
    g.tiles['dudley:1'] = tile(0, 'iron');
    expect(stepKeyOf('iron', g, 0)).toBe('iron');
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

describe('the lesson the sheet’s advice opens', () => {
  it('teaches the move missed, never the one played in its stead', () => {
    for (const m of MOTIFS) expect(LESSON_IDS).toContain(MOTIF_LESSON[m]);
    /* a loan, a development, where a build was worth more: not the loan
       nor the development, which say to take them */
    expect(MOTIF_LESSON.loanOverBuild).toBe('works');
    expect(MOTIF_LESSON.developOverBuild).toBe('works');
    /* a single rail: not the opening canal, the plan that doubles them */
    expect(MOTIF_LESSON.singleRail).toBe('plan');
    /* a build where a link was worth more: the link to a buyer */
    expect(MOTIF_LESSON.buildOverLink).toBe('reach');
    const g = table('standard');
    expect(plainKeyOf(MOTIF_LESSON.singleRail, g, 0)).toBe('plan');
  });
});
