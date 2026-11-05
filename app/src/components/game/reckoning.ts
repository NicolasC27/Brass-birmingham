import { INDUSTRIES, LINKS, incomeLevel } from '@/game/data';
import type { GameState, IndustryType } from '@/game/types';
import type { ChapterId } from '@/platform/cours';
import { linkIcons } from './lessons';

/* ------------------------------------------------------------------ */
/* The reckoning of a game played out: where each seat's points came    */
/* from, what the reader left on the table, and what to do better next  */
/* time. Read off the finished game alone — its tiles, its ledger and   */
/* the engine's own count — once the books are closed: nothing of it is */
/* said while the game runs, and nothing hidden is read. A short game   */
/* counts its close; a full one counts each era apart, and no purse.    */
/* ------------------------------------------------------------------ */

/** the short game's close (engine canalOnlyBonus): a point for every £4
 *  in the purse, fifteen at most */
const PER_POINT = 4;
const MOST = 15;
/** the purse past which the close counts nothing more */
export const PURSE_CAP = MOST * PER_POINT;
const WORKS: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

/** the flipped tiles of one level, and what they scored */
export interface Flips {
  level: number;
  count: number;
  vp: number;
}

/** a link laid, its ends, and the link icons it counted */
export interface Laid {
  id: string;
  ends: string[];
  vp: number;
}

/** the close of the books: the purse's points (money / 4, fifteen at
 *  most), the income level as points, and the flipped tiles of level II
 *  or more counted again */
export interface Books {
  money: number;
  purse: number;
  level: number;
  again: number;
  total: number;
}

/** a full game's two counts: each era's tiles and links, as the engine
 *  split them */
export interface Eras {
  canalTiles: number;
  canalLinks: number;
  railTiles: number;
  railLinks: number;
  /** the canal's links laid, which the count took off the board */
  canals: number;
  /** the points of the tiles not flipped at the canal's count */
  pending: number;
}

/** one seat's points, by where they came from; they add up to its total */
export interface Sources {
  seat: number;
  name: string;
  vp: number;
  /** the flipped tiles' points, by level — at the last count */
  tiles: number;
  flips: Flips[];
  /** the links' points: the icons at their ends — both eras' in a full game */
  links: number;
  /** the links laid, with what they counted: a full game's rails alone,
   *  the canals having left the board at the canal's count */
  laid: Laid[];
  /** a full game's counts, era by era; null for a short game */
  eras: Eras | null;
  /** the merchants' barrels drunk, in points */
  barrels: number;
  books: Books;
  /** points lost at a payday the purse could not meet */
  owed: number;
  /** the actions the seat played */
  actions: number;
}

/** a tile of the reader's never flipped, and what it would have scored:
 *  its points, and at the close again from level II */
export interface Unflipped {
  industry: IndustryType;
  level: number;
  town: string;
  vp: number;
  worth: number;
}

/** what the reader left on the table */
export interface Left {
  unflipped: Unflipped[];
  worth: number;
  /** cards played for nothing: passes */
  passes: number;
  /** links whose ends carried no icon at the count */
  bare: Laid[];
  /** money the purse's fifteen points could not count */
  beyond: number;
  /** a full game's: the money left, which its end counts for nothing, and
   *  the points of the tiles not flipped at the canal's count */
  purse: number;
  swept: number;
}

export type AdviceId = 'unsold' | 'unspent' | 'links' | 'again' | 'barrels' | 'level' | 'hoard' | 'idle' | 'owed' | 'swept';

/** where each thing to do better is taught: the lesson of the guided game
 *  that says it, and the chapter of the rules that teaches the way to it —
 *  in the order a tie between two stakes is broken. The rules tell a full
 *  game, and no chapter tells the short game's close: the income level is
 *  raised as the money chapter says, a level 2 reached as the industries'
 *  says, but a purse past its cap has its lesson alone */
export const TAUGHT: Readonly<Record<Exclude<AdviceId, 'swept'>, { lesson: string; chapter: ChapterId | null }>> = {
  unsold: { lesson: 'reach', chapter: 'selling' },
  unspent: { lesson: 'lastRounds', chapter: 'supply' },
  links: { lesson: 'linkWorth', chapter: 'network' },
  again: { lesson: 'levelTwo', chapter: 'industries' },
  barrels: { lesson: 'barrel', chapter: 'selling' },
  level: { lesson: 'flipped', chapter: 'money' },
  hoard: { lesson: 'eraEnd', chapter: null },
  idle: { lesson: 'plan', chapter: 'actions' },
  owed: { lesson: 'loan', chapter: 'money' },
};

/** and in a full game: its links laid era after era, taught by the second
 *  lesson's rails; the tiles the canal's count found unflipped, by its
 *  last rounds; the actions, by its plan for the rail. No close, no
 *  purse, no level counted: none of their advice */
export const TAUGHT_FULL: Readonly<Partial<Record<AdviceId, { lesson: string; chapter: ChapterId | null }>>> = {
  unsold: { lesson: 'reach', chapter: 'selling' },
  unspent: { lesson: 'railLast', chapter: 'supply' },
  links: { lesson: 'rails', chapter: 'network' },
  swept: { lesson: 'canalClose', chapter: 'eras' },
  barrels: { lesson: 'barrel', chapter: 'selling' },
  idle: { lesson: 'railPlan', chapter: 'actions' },
  owed: { lesson: 'loan', chapter: 'money' },
};

/** the advice said otherwise of a full game: its links, its tiles, its
 *  actions run over two eras */
const FULL_WORDS: Partial<Record<AdviceId, string>> = { unspent: 'unspentFull', links: 'linksFull', idle: 'idleFull' };

/** a thing to do better, what it cost this game (its stake, in points),
 *  the figures it is said with, and where it is taught: a lesson of the
 *  guided game and, where one teaches it, a chapter of the rules */
export interface Advice {
  id: AdviceId;
  /** its words: game.reckoning.advice.<key> */
  key: string;
  stake: number;
  vars: Record<string, number>;
  lesson: string;
  chapter: ChapterId | null;
}

export type Source = 'tiles' | 'links' | 'barrels' | 'purse' | 'level' | 'again' | 'owed' | 'canalTiles' | 'canalLinks' | 'railTiles' | 'railLinks';
/** the rows of a short game's account, in the order the points were made */
export const SHORT_ROWS: readonly Source[] = ['tiles', 'links', 'barrels', 'purse', 'level', 'again', 'owed'];
/** and of a full game's: each era's count, then the barrels and the paydays */
export const FULL_ROWS: readonly Source[] = ['canalTiles', 'canalLinks', 'railTiles', 'railLinks', 'barrels', 'owed'];

/** a game level on points, and what settled it — the engine's own order:
 *  the income level, then the money, else the order of the seats — with
 *  the reader's figure and the rival's */
export interface Tie {
  vp: number;
  by: 'level' | 'money' | 'seat';
  mine: number;
  theirs: number;
}

export interface Reckoning {
  /** a full game, counted era by era */
  full: boolean;
  me: Sources;
  /** the seat measured against: the winner, or the runner-up when the
   *  reader won */
  rival: Sources;
  won: boolean;
  /** the sources the result was made on, the widest gap first: what the
   *  winner scored more than the other there */
  gaps: { source: Source; gap: number }[];
  /** and the sources the other did better on, the widest first */
  leads: { source: Source; gap: number }[];
  /** a game level on points: what settled it, since no gap did */
  tie: Tie | null;
  left: Left;
  advice: Advice[];
}

const townOf = (key: string): string => key.split(':')[0];
const printed = (industry: IndustryType, level: number) => INDUSTRIES[industry][level - 1];

/** the links a seat laid, read off the ledger — in one era, or both: they
 *  leave the board with the count, the ledger keeps them */
function laidBy(g: GameState, seat: number, era?: GameState['era']): string[] {
  return g.ledger.filter((e) => e.player === seat && e.key === 'network' && (!era || e.era === era)).flatMap((e) => [e.vars?.linkId, e.vars?.linkId2].filter((x): x is string => typeof x === 'string' && x !== ''));
}

function sourcesOf(g: GameState, seat: number): Sources {
  const p = g.players[seat];
  const own = Object.entries(g.tiles).filter(([, t]) => t.owner === seat && t.flipped);
  const byLevel = new Map<number, Flips>();
  for (const [, t] of own) {
    const f = byLevel.get(t.level) ?? { level: t.level, count: 0, vp: 0 };
    f.count += 1;
    f.vp += printed(t.industry, t.level).vp;
    byLevel.set(t.level, f);
  }
  const flips = [...byLevel.values()].sort((a, b) => a.level - b.level);
  const tiles = flips.reduce((n, f) => n + f.vp, 0);
  /* what each link counted: the tiles as the close left them — a short
     game sweeps none; in a full one, the rails, the canals' tiles gone */
  const full = g.eraLength !== 'short';
  const laid = laidBy(g, seat, full ? 'rail' : undefined).map((id) => {
    const l = LINKS.find((x) => x.id === id);
    return { id, ends: l ? [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])] : [], vp: linkIcons(g, seat, id) };
  });
  const canal = g.canalSplit?.[seat];
  const rail = g.finalSplit?.[seat];
  const eras: Eras | null = full
    ? { canalTiles: canal?.tiles ?? 0, canalLinks: canal?.links ?? 0, railTiles: rail?.tiles ?? tiles, railLinks: rail?.links ?? (g.finalScores?.[seat] ?? 0) - tiles, canals: laidBy(g, seat, 'canal').length, pending: canal?.pending ?? 0 }
    : null;
  /* the count's own split when the game kept it, else what the era gave less the tiles */
  const links = eras ? eras.canalLinks + eras.railLinks : (canal?.links ?? (g.canalScores?.[seat] ?? 0) - tiles);
  const barrels = g.ledger.filter((e) => e.player === seat && e.key === 'sell').reduce((n, e) => n + Number(e.vars?.bonusVp ?? 0), 0);
  const owed = g.ledger.filter((e) => e.player === seat && e.key === 'short').reduce((n, e) => n + Number(e.vars?.amount ?? 0), 0);
  /* a full game closes no books: its purse and its level count nothing */
  const purse = full ? 0 : Math.min(MOST, Math.floor(Math.max(0, p.money) / PER_POINT));
  const level = full ? 0 : incomeLevel(p.income);
  const again = full ? 0 : flips.filter((f) => f.level >= 2).reduce((n, f) => n + f.vp, 0);
  const actions = new Set(g.ledger.filter((e) => e.player === seat && e.verb !== 'system' && e.verb !== 'score' && e.at !== undefined).map((e) => e.at)).size;
  return { seat, name: p.name, vp: p.vp, tiles, flips, links, laid, eras, barrels, books: { money: p.money, purse, level, again, total: purse + level + again }, owed, actions };
}

/** the points each source gave, by name — the rows of the account the
 *  game keeps, a short one's or a full one's */
export const bySource = (s: Sources): Partial<Record<Source, number>> =>
  s.eras
    ? { canalTiles: s.eras.canalTiles, canalLinks: s.eras.canalLinks, railTiles: s.eras.railTiles, railLinks: s.eras.railLinks, barrels: s.barrels, owed: -s.owed }
    : { tiles: s.tiles, links: s.links, barrels: s.barrels, purse: s.books.purse, level: s.books.level, again: s.books.again, owed: -s.owed };

/** the reckoning of a finished game for the reader's seat; null for a
 *  game still running, given up, or a full one its last count never
 *  reached */
export function reckon(g: GameState, me: number): Reckoning | null {
  if (g.phase !== 'game-over' || g.abandoned || !g.players[me] || g.players.length < 2) return null;
  const full = g.eraLength !== 'short';
  if (full && !g.finalScores) return null;
  const all = g.players.map((_, i) => sourcesOf(g, i));
  const mine = all[me];
  const won = g.winner === me;
  const others = all.filter((s) => s.seat !== me);
  /* who the reader is measured against: whoever beat them, else the one nearest behind */
  const rival = won ? others.reduce((a, b) => (b.vp > a.vp ? b : a)) : (all[g.winner ?? -1] ?? others.reduce((a, b) => (b.vp > a.vp ? b : a)));
  const [hi, lo] = won ? [mine, rival] : [rival, mine];
  const a = bySource(hi);
  const b = bySource(lo);
  /* where one scored more than the other, the widest gap first */
  const over = (x: Partial<Record<Source, number>>, y: Partial<Record<Source, number>>) =>
    (Object.keys(x) as Source[]).map((source) => ({ source, gap: (x[source] ?? 0) - (y[source] ?? 0) })).filter((d) => d.gap > 0).sort((d, e) => e.gap - d.gap);
  const gaps = over(a, b);
  const leads = over(b, a);
  /* level on points: settled as the engine settles it — by the income
     level, which a full game's books do not count */
  const levelOf = (s: Sources) => incomeLevel(g.players[s.seat].income);
  const tie: Tie | null =
    mine.vp !== rival.vp ? null
    : levelOf(mine) !== levelOf(rival) ? { vp: mine.vp, by: 'level', mine: levelOf(mine), theirs: levelOf(rival) }
    : mine.books.money !== rival.books.money ? { vp: mine.vp, by: 'money', mine: mine.books.money, theirs: rival.books.money }
    : { vp: mine.vp, by: 'seat', mine: mine.seat, theirs: rival.seat };

  /* the reader's tiles never flipped, on the board at the end: a short
     game counts those of level II twice at its close */
  const unflipped: Unflipped[] = Object.entries(g.tiles)
    .filter(([, t]) => t.owner === me && !t.flipped)
    .map(([key, t]) => {
      const vp = printed(t.industry, t.level).vp;
      return { industry: t.industry, level: t.level, town: townOf(key), vp, worth: !full && t.level >= 2 ? vp * 2 : vp };
    });
  const passes = g.ledger.filter((e) => e.player === me && e.verb === 'pass').length;
  const left: Left = {
    unflipped,
    worth: unflipped.reduce((n, x) => n + x.worth, 0),
    passes,
    bare: mine.laid.filter((l) => l.vp === 0),
    beyond: full ? 0 : Math.max(0, mine.books.money - PURSE_CAP),
    purse: full ? Math.max(0, mine.books.money) : 0,
    swept: mine.eras?.pending ?? 0,
  };
  return { full, me: mine, rival, won, gaps, leads, tie, left, advice: adviceFor(mine, rival, left, full) };
}

/** what each thing to do better is said with and what it cost: its
 *  stake, in points — the three costliest are kept, of those the game's
 *  kind teaches */
function adviceFor(me: Sources, rival: Sources, left: Left, full: boolean): Advice[] {
  const works = left.unflipped.filter((x) => WORKS.includes(x.industry));
  const rest = left.unflipped.filter((x) => !WORKS.includes(x.industry));
  const sum = (xs: Unflipped[]) => xs.reduce((n, x) => n + x.worth, 0);
  const idle = left.passes + left.bare.length;
  /* an action of the rival's, on average: what a card played for nothing gave up */
  const perAction = rival.actions ? Math.round(rival.vp / rival.actions) : 0;
  const said: Record<AdviceId, { stake: number; vars: Record<string, number> }> = {
    unsold: { stake: sum(works), vars: { n: works.length, vp: sum(works) } },
    unspent: { stake: sum(rest), vars: { n: rest.length, vp: sum(rest) } },
    links: { stake: rival.links - me.links, vars: { mine: me.links, theirs: rival.links } },
    again: { stake: rival.books.again - me.books.again, vars: { mine: me.books.again, theirs: rival.books.again } },
    barrels: { stake: rival.barrels - me.barrels, vars: { mine: me.barrels, theirs: rival.barrels } },
    level: { stake: rival.books.level - me.books.level, vars: { mine: me.books.level, theirs: rival.books.level } },
    hoard: { stake: Math.floor(left.beyond / PER_POINT), vars: { money: left.beyond, cap: PURSE_CAP, most: MOST } },
    idle: { stake: idle * perAction, vars: { n: idle, passes: left.passes, bare: left.bare.length } },
    owed: { stake: me.owed, vars: { vp: me.owed } },
    swept: { stake: left.swept, vars: { vp: left.swept } },
  };
  const taught: Partial<Record<AdviceId, { lesson: string; chapter: ChapterId | null }>> = full ? TAUGHT_FULL : TAUGHT;
  return (Object.keys(taught) as AdviceId[])
    .map((id, k) => ({ k, a: { id, key: (full && FULL_WORDS[id]) || id, ...said[id], ...taught[id]! } }))
    .filter(({ a }) => a.stake > 0)
    .sort((x, y) => y.a.stake - x.a.stake || x.k - y.k)
    .slice(0, 3)
    .map(({ a }) => a);
}
