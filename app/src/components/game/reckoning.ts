import { INDUSTRIES, LINKS, incomeLevel } from '@/game/data';
import type { GameState, IndustryType } from '@/game/types';
import type { ChapterId } from '@/platform/cours';
import { linkIcons } from './lessons';

/* ------------------------------------------------------------------ */
/* The reckoning of a short game played out: where each seat's points   */
/* came from, what the reader left on the table, and what to do better  */
/* next time. Read off the finished game alone — its tiles, its ledger  */
/* and the engine's own count — once the books are closed: nothing of   */
/* it is said while the game runs, and nothing hidden is read. A full   */
/* game, whose close counts no purse, has the analysis instead.         */
/* ------------------------------------------------------------------ */

/** the short game's close (engine canalOnlyBonus): a point for every £4
 *  in the purse, fifteen at most */
const PER_POINT = 4;
const MOST = 15;
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

/** one seat's points, by where they came from; they add up to its total */
export interface Sources {
  seat: number;
  name: string;
  vp: number;
  /** the flipped tiles' points, by level */
  tiles: number;
  flips: Flips[];
  /** the links' points: the icons at their ends */
  links: number;
  laid: Laid[];
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
}

export type AdviceId = 'unsold' | 'unspent' | 'links' | 'again' | 'barrels' | 'level' | 'hoard' | 'idle' | 'owed';

/** where each thing to do better is taught: the lesson of the guided game
 *  that says it, and the chapter of the rules — in the order a tie
 *  between two stakes is broken */
export const TAUGHT: Readonly<Record<AdviceId, { lesson: string; chapter: ChapterId }>> = {
  unsold: { lesson: 'reach', chapter: 'selling' },
  unspent: { lesson: 'lastRounds', chapter: 'supply' },
  links: { lesson: 'linkWorth', chapter: 'network' },
  again: { lesson: 'levelTwo', chapter: 'industries' },
  barrels: { lesson: 'barrel', chapter: 'selling' },
  level: { lesson: 'flipped', chapter: 'money' },
  hoard: { lesson: 'eraEnd', chapter: 'money' },
  idle: { lesson: 'plan', chapter: 'actions' },
  owed: { lesson: 'loan', chapter: 'money' },
};

/** a thing to do better, what it cost this game (its stake, in points),
 *  the figures it is said with, and where it is taught: a lesson of the
 *  guided game and a chapter of the rules */
export interface Advice {
  id: AdviceId;
  stake: number;
  vars: Record<string, number>;
  lesson: string;
  chapter: ChapterId;
}

export type Source = 'tiles' | 'links' | 'barrels' | 'purse' | 'level' | 'again' | 'owed';

export interface Reckoning {
  me: Sources;
  /** the seat measured against: the winner, or the runner-up when the
   *  reader won */
  rival: Sources;
  won: boolean;
  /** the sources the result was made on, the widest gap first: what the
   *  winner scored more than the other there */
  gaps: { source: Source; gap: number }[];
  left: Left;
  advice: Advice[];
}

const townOf = (key: string): string => key.split(':')[0];
const printed = (industry: IndustryType, level: number) => INDUSTRIES[industry][level - 1];

/** the links a seat laid, read off the ledger: they leave the board with
 *  the count, the ledger keeps them */
function laidBy(g: GameState, seat: number): string[] {
  return g.ledger.filter((e) => e.player === seat && e.key === 'network').flatMap((e) => [e.vars?.linkId, e.vars?.linkId2].filter((x): x is string => typeof x === 'string' && x !== ''));
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
  /* what each link counted: the tiles as the close left them — a short game sweeps none */
  const laid = laidBy(g, seat).map((id) => {
    const l = LINKS.find((x) => x.id === id);
    return { id, ends: l ? [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])] : [], vp: linkIcons(g, seat, id) };
  });
  /* the count's own split when the game kept it, else what the era gave less the tiles */
  const links = g.canalSplit?.[seat]?.links ?? (g.canalScores?.[seat] ?? 0) - tiles;
  const barrels = g.ledger.filter((e) => e.player === seat && e.key === 'sell').reduce((n, e) => n + Number(e.vars?.bonusVp ?? 0), 0);
  const owed = g.ledger.filter((e) => e.player === seat && e.key === 'short').reduce((n, e) => n + Number(e.vars?.amount ?? 0), 0);
  const purse = Math.min(MOST, Math.floor(Math.max(0, p.money) / PER_POINT));
  const level = incomeLevel(p.income);
  const again = flips.filter((f) => f.level >= 2).reduce((n, f) => n + f.vp, 0);
  const actions = new Set(g.ledger.filter((e) => e.player === seat && e.verb !== 'system' && e.verb !== 'score' && e.at !== undefined).map((e) => e.at)).size;
  return { seat, name: p.name, vp: p.vp, tiles, flips, links, laid, barrels, books: { money: p.money, purse, level, again, total: purse + level + again }, owed, actions };
}

/** the points each source gave, by name */
const bySource = (s: Sources): Record<Source, number> => ({ tiles: s.tiles, links: s.links, barrels: s.barrels, purse: s.books.purse, level: s.books.level, again: s.books.again, owed: -s.owed });

/** the reckoning of a finished short game for the reader's seat; null
 *  for a game still running, given up, or a full one */
export function reckon(g: GameState, me: number): Reckoning | null {
  if (g.phase !== 'game-over' || g.abandoned || g.eraLength !== 'short' || !g.players[me] || g.players.length < 2) return null;
  const all = g.players.map((_, i) => sourcesOf(g, i));
  const mine = all[me];
  const won = g.winner === me;
  const others = all.filter((s) => s.seat !== me);
  /* who the reader is measured against: whoever beat them, else the one nearest behind */
  const rival = won ? others.reduce((a, b) => (b.vp > a.vp ? b : a)) : (all[g.winner ?? -1] ?? others.reduce((a, b) => (b.vp > a.vp ? b : a)));
  const [hi, lo] = won ? [mine, rival] : [rival, mine];
  const a = bySource(hi);
  const b = bySource(lo);
  const gaps = (Object.keys(a) as Source[]).map((source) => ({ source, gap: a[source] - b[source] })).filter((x) => x.gap > 0).sort((x, y) => y.gap - x.gap);

  /* the reader's tiles never flipped: a short game leaves them all on the board */
  const unflipped: Unflipped[] = Object.entries(g.tiles)
    .filter(([, t]) => t.owner === me && !t.flipped)
    .map(([key, t]) => {
      const vp = printed(t.industry, t.level).vp;
      return { industry: t.industry, level: t.level, town: townOf(key), vp, worth: t.level >= 2 ? vp * 2 : vp };
    });
  const passes = g.ledger.filter((e) => e.player === me && e.verb === 'pass').length;
  const left: Left = {
    unflipped,
    worth: unflipped.reduce((n, x) => n + x.worth, 0),
    passes,
    bare: mine.laid.filter((l) => l.vp === 0),
    beyond: Math.max(0, mine.books.money - MOST * PER_POINT),
  };
  return { me: mine, rival, won, gaps, left, advice: adviceFor(mine, rival, left) };
}

/** what each thing to do better is said with and what it cost: its
 *  stake, in points — the three costliest are kept */
function adviceFor(me: Sources, rival: Sources, left: Left): Advice[] {
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
    hoard: { stake: Math.floor(left.beyond / PER_POINT), vars: { money: left.beyond, cap: MOST * PER_POINT, most: MOST } },
    idle: { stake: idle * perAction, vars: { n: idle, passes: left.passes, bare: left.bare.length } },
    owed: { stake: me.owed, vars: { vp: me.owed } },
  };
  return (Object.keys(TAUGHT) as AdviceId[])
    .map((id, k) => ({ k, a: { id, ...said[id], ...TAUGHT[id] } }))
    .filter(({ a }) => a.stake > 0)
    .sort((x, y) => y.a.stake - x.a.stake || x.k - y.k)
    .slice(0, 3)
    .map(({ a }) => a);
}
