import { INDUSTRIES, LINKS, MERCHANTS, TOWNS, TOWN_BY_ID, eraRounds, incomeLevel } from '@/game/data';
import { hasPresence, merchantDemand, networkTowns } from '@/game/engine';
import type { GameState, IndustryType, LinkDef, Merchant } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The words a lesson is said in. The guided game is a short one — the */
/* canal era alone, closed on a bonus — and some lessons read otherwise */
/* there: the purse and the income level count at the close, and no     */
/* sweep ever comes. A lesson keeps its id; its entry in the dictionary */
/* changes. Pure: the guide and the evening course both read it.        */
/* ------------------------------------------------------------------ */

/** the lessons a short game tells in words of its own */
const SHORT: Readonly<Record<string, string>> = {
  goal: 'goalShort',
  develop: 'developShort',
  loan: 'loanShort',
  eraEnd: 'eraEndShort',
  plan: 'planShort',
  tips: 'tipsShort',
};

/** a lesson's entry in a short game — the guided game is one */
export const shortKeyOf = (id: string): string => SHORT[id] ?? id;

/** the lessons told otherwise when the reader may pass them as things
 *  stand: the loan, when the purse already pays for the next works; the
 *  barrel, when none is left to drink */
const SPARE: Readonly<Record<string, string>> = {
  loan: 'loanSpare',
  barrel: 'barrelGone',
};

/** the reader's income level at the first payday of the game, as it was
 *  paid — the account book keeps it; null before that payday */
export function firstPayday(g: GameState, me: number): number | null {
  const h = g.history.find((x) => x.era === 'canal' && x.round === 1);
  return h?.income[me] ?? null;
}

/** the lesson's entry in the dictionary: the first payday reads as it was
 *  paid — owed, nought or drawn — a lesson the reader may pass as things
 *  stand says so (spare), a mine no canal of the reader's can lead to a
 *  forge from, or a network with no town for one, sends the canal and
 *  the forge another way, and a short game tells some lessons in its
 *  own words */
export function stepKeyOf(id: string, g: GameState, me: number, spare = false): string {
  if (id === 'payday') {
    const level = firstPayday(g, me) ?? incomeLevel(g.players[me].income);
    return level < 0 ? 'paydayOwed' : level === 0 ? 'paydayZero' : 'payday';
  }
  if (spare && SPARE[id]) return SPARE[id];
  if (id === 'link' && mines(g, me).length > 0 && forgesFromMines(g, me).length === 0) return 'linkAstray';
  /* with nothing on the board the forge card builds anywhere */
  if (id === 'iron' && hasPresence(g, me) && forgesInReach(g, me).length === 0) return 'ironAstray';
  return g.eraLength === 'short' ? shortKeyOf(id) : id;
}

const ends = (l: LinkDef): string[] => [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])];
/** a slot of the town that takes this industry and holds no tile yet */
const freeSlot = (g: GameState, town: string, industry: IndustryType): boolean => !!TOWN_BY_ID[town]?.slots.some((sp, i) => sp.allows.includes(industry) && !g.tiles[`${town}:${i}`]);
/** a town where the reader already has a tile of theirs */
const holds = (g: GameState, me: number, town: string): boolean => Object.entries(g.tiles).some(([key, x]) => x.owner === me && key.split(':')[0] === town);
/** a town where the reader's own forge stands */
const forgeOf = (g: GameState, me: number, town: string): boolean => Object.entries(g.tiles).some(([key, x]) => x.owner === me && x.industry === 'iron' && key.split(':')[0] === town);
/** the towns of the reader's mines */
const mines = (g: GameState, me: number): string[] => Object.entries(g.tiles).filter(([, x]) => x.owner === me && x.industry === 'coal').map(([key]) => key.split(':')[0]);
/** the canals from `town` that may still be the reader's: not laid, or
 *  laid by them. Another's canal carries the coal all the same, but puts
 *  no town in the reader's network, where the forge card builds */
const openCanals = (g: GameState, me: number, town: string): LinkDef[] => LINKS.filter((l) => l.canal && ends(l).includes(town) && (!g.links[l.id] || g.links[l.id].owner === me));
/** the towns among these, in the board's own order */
const inBoardOrder = (towns: Iterable<string>): string[] => {
  const set = new Set(towns);
  return TOWNS.map((t) => t.id).filter((id) => set.has(id));
};

/** the towns one canal of the reader's could lead to from `town` — not
 *  laid yet, or laid by them — with a forge slot still free, where the
 *  reader has no tile yet: in the canal era a player keeps one tile to a
 *  town, so the forge a mine feeds stands in another */
export function forgesFrom(g: GameState, me: number, town: string): string[] {
  return inBoardOrder(openCanals(g, me, town).flatMap((l) => ends(l).filter((x) => x !== town && freeSlot(g, x, 'iron') && !holds(g, me, x))));
}

/** where a first mine may stand for its coal to feed a forge of the
 *  reader's: the forge towns a canal leads to from a free mine slot, and
 *  the mine towns from which no canal leads to one. Read off the board,
 *  never written down for one map */
export function forgeWays(g: GameState, me: number): { forges: string[]; deadEnds: string[] } {
  const mines = TOWNS.filter((t) => freeSlot(g, t.id, 'coal') && !holds(g, me, t.id)).map((t) => t.id);
  const reach = mines.map((m) => ({ m, to: forgesFrom(g, me, m) }));
  return { forges: inBoardOrder(reach.flatMap((x) => x.to)), deadEnds: reach.filter((x) => x.to.length === 0).map((x) => x.m) };
}

/** the forge towns a canal of the reader's could lead to from their own
 *  mines: where the lesson on canals sends the first one. A forge of
 *  theirs already standing at the far end counts, so the lesson read
 *  back still says where the canal went */
export function forgesFromMines(g: GameState, me: number): string[] {
  return inBoardOrder(mines(g, me).flatMap((m) => [...forgesFrom(g, me, m), ...openCanals(g, me, m).flatMap((l) => ends(l).filter((x) => x !== m && forgeOf(g, me, x)))]));
}

/** the forge towns the reader's network touches, where the forge card
 *  builds: a forge slot free in a town with no tile of theirs, or a forge
 *  of theirs already standing */
export function forgesInReach(g: GameState, me: number): string[] {
  return inBoardOrder([...networkTowns(g, me)].filter((x) => (freeSlot(g, x, 'iron') && !holds(g, me, x)) || forgeOf(g, me, x)));
}

/** the merchants of this table who keep a barrel — a tile of theirs that
 *  is not blank — and what drinking one gives: the lesson on beer names
 *  them from the table, never from one deal written down */
export function barrelBonuses(g: GameState): { merchant: string; bonus: Merchant['bonus'] }[] {
  return MERCHANTS.filter((m) => (g.merchantTiles[m.id] ?? []).some((x) => x !== 'blank')).map((m) => ({ merchant: m.name, bonus: m.bonus }));
}

/** who buys what at this table, from the merchants' tiles: each merchant
 *  that buys anything, and the goods it buys — all three said as one. The
 *  lesson on works names them from the table, never from one deal; the
 *  merchants that buy everything come last */
export function buyersOf(g: GameState): { merchant: string; goods: IndustryType[] | 'all' }[] {
  const buying = MERCHANTS.map((m) => ({ merchant: m.name, buys: merchantDemand(g, m.id) })).filter((x) => x.buys.length > 0);
  const all = (x: { buys: IndustryType[] }) => x.buys.length === 3;
  return [...buying.filter((x) => !all(x)), ...buying.filter(all)].map((x) => ({ merchant: x.merchant, goods: all(x) ? 'all' : x.buys }));
}

/** a works tile as the mat offers it next, and what building it asks */
export interface MatWorks {
  industry: IndustryType;
  level: number;
  cost: number;
  coal: number;
  iron: number;
}

/** the works the reader's mat offers next: the lowest tile left of the
 *  cotton mills, the manufactories and the potteries, with its price.
 *  The lesson on works quotes them off the mat, since a development may
 *  already have taken a level I away; a tile the era does not build is
 *  left out, unless no other is left to quote */
export function worksOnMat(g: GameState, me: number): MatWorks[] {
  const tops = (['cotton', 'manufacturer', 'pottery'] as const).flatMap((industry): MatWorks[] => {
    const level = g.players[me].stacks[industry][0];
    const tile = level === undefined ? undefined : INDUSTRIES[industry][level - 1];
    return tile ? [{ industry, level, cost: tile.cost, coal: tile.coal, iron: tile.iron }] : [];
  });
  const now = tops.filter((x) => INDUSTRIES[x.industry][x.level - 1].eras.includes(g.era));
  return now.length ? now : tops;
}

/** below this a purse builds little: a loan taken with less was for want of money */
export const LOW_PURSE = 15;

/** the words for a machine's loan, told by the purse it was taken from:
 *  its last card of a short game borrows for the close, a thin purse for
 *  want of money, a full one to build dear without waiting for payday */
export function loanWords(g: GameState, seat: number, purse: number): 'loanClose' | 'loanLow' | 'loanAhead' {
  if (g.eraLength === 'short' && g.deck.length === 0 && g.players[seat].hand.length === 0) return 'loanClose';
  return purse < LOW_PURSE ? 'loanLow' : 'loanAhead';
}

/** the round the draw pile is empty from: an era ends once the pile and
 *  the hands are both empty, and the eight cards of a hand last its last
 *  four rounds (game-data §4.3) */
export const dryRound = (players: number): number => eraRounds(players) - 3;

/** a tile of the reader's, named by the era's last words */
export interface Named {
  industry: IndustryType;
  town: string;
}

/** what the guide says as the canal era draws to its close, from the round
 *  before its last: a full game warns of the sweep of the level-1 tiles, a
 *  short one of what its close counts, since no sweep comes. The reader's
 *  tiles concerned are named when there are any — the level-1 ones the
 *  sweep will take, or, in a short game, every tile still unflipped,
 *  whatever its level: it will score nothing */
export function closingWords(g: GameState, me: number): { era: string; mine: { key: string; tiles: Named[]; unflipped: number } | null } | null {
  if (g.era !== 'canal' || g.round < eraRounds(g.players.length) - 1) return null;
  const mine = Object.entries(g.tiles).filter(([, x]) => x.owner === me);
  const named = (list: typeof mine): Named[] => list.map(([key, x]) => ({ industry: x.industry, town: key.split(':')[0] }));
  if (g.eraLength === 'short') {
    const open = mine.filter(([, x]) => !x.flipped);
    return { era: 'eraEndShort', mine: open.length ? { key: 'eraEndMineShort', tiles: named(open), unflipped: open.length } : null };
  }
  const doomed = mine.filter(([, x]) => x.level === 1);
  const unflipped = doomed.filter(([, x]) => !x.flipped).length;
  return { era: 'eraEnd', mine: doomed.length ? { key: unflipped ? 'eraEndMine' : 'eraEndMineFlipped', tiles: named(doomed), unflipped } : null };
}
