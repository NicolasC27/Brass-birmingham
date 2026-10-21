import { boardOf, DEFAULT_BOARD } from '@/game/boards';
import { personaFor } from '@/game/data';
import { foldGame } from '@/game/rivalry';
import type { RivalLast, Rivalry } from '@/game/rivalry';
import type { Tally } from '@/game/tally';
import type { BotPersona, IndustryType, SetupPayload } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The rivalries, counted where the games are kept.                    */
/*                                                                     */
/* Every game at home an account played out is on the register with   */
/* its deal and its standings — each seat's points and its tally of   */
/* what it laid where. That is the whole of a character's memory: who  */
/* came out ahead, by how much, and a few facts of the last game (the  */
/* town the account took from it, the industry it leaned on, the loans */
/* it ran up, a canal era lost and a game won all the same). Nothing   */
/* is replayed: the standings were read off the log when it ended.    */
/* ------------------------------------------------------------------ */

/** the standings of a game at home, as the register keeps them */
export interface FinishedResult {
  players: { vp: number; bot: boolean; resigned?: boolean; tally?: Tally }[];
  winner: number;
  abandoned: boolean;
  /** each seat's points at the canal's close (games from before it was kept have none) */
  canal?: number[];
}

/** one game at home played out, as the register hands it over */
export interface Finished {
  code: string;
  finishedAt: number;
  setup: SetupPayload;
  result: FinishedResult;
}

/** a town remembered takes at least this many of the account's tiles */
const TOWN_TILES = 2;
/** an industry leaned on: this many tiles, and this share of all laid */
const LEANING_TILES = 3;
const LEANING_SHARE = 0.4;
/** the loans that are remembered */
const MANY_LOANS = 3;
/** behind by this much at the canal's close, and a game won all the same */
const COMEBACK_GAP = 5;

/** the industry a tally laid most of, when it laid enough of it */
function leaning(t: Tally | undefined, share: number): IndustryType | undefined {
  if (!t) return undefined;
  const all = Object.values(t.industries).reduce((a, n) => a + (n ?? 0), 0);
  let best: IndustryType | undefined;
  let most = 0;
  for (const [ind, n] of Object.entries(t.industries) as [IndustryType, number][]) if (n > most) [best, most] = [ind, n];
  return best && most >= LEANING_TILES && most >= all * share ? best : undefined;
}

/** the town the account built more in than the character, which built
 *  there too — the most tiles first */
function townTaken(mine: Tally | undefined, theirs: Tally | undefined): string | undefined {
  if (!mine || !theirs) return undefined;
  let best: string | undefined;
  let most = 0;
  for (const [town, n] of Object.entries(mine.towns)) {
    const had = theirs.towns[town] ?? 0;
    if (n >= TOWN_TILES && had > 0 && n > had && n > most) [best, most] = [town, n];
  }
  return best;
}

/** the account came out ahead of that seat: more points, or, level, the
 *  engine's winner, then the income and the purse the game ended on */
function ahead(r: FinishedResult, me: number, them: number): boolean {
  const a = r.players[me];
  const b = r.players[them];
  if (a.vp !== b.vp) return a.vp > b.vp;
  if (r.winner === me || r.winner === them) return r.winner === me;
  const ia = a.tally?.income ?? 0;
  const ib = b.tally?.income ?? 0;
  if (ia !== ib) return ia > ib;
  return (a.tally?.money ?? 0) > (b.tally?.money ?? 0);
}

/** what one character remembers of one game: the result against the
 *  account's best-placed seat, and the game's facts */
function memoryOf(g: Finished, me: number, them: number): RivalLast {
  const r = g.result;
  const mine = r.players[me];
  const theirs = r.players[them];
  const won = ahead(r, me, them);
  const map = g.setup.options.map ?? DEFAULT_BOARD;
  const town = townTaken(mine.tally, theirs.tally);
  const industry = leaning(mine.tally, LEANING_SHARE);
  const own = leaning(theirs.tally, 0);
  const loans = mine.tally?.loans ?? 0;
  const canal = r.canal;
  const comeback = won && !!canal && canal[me] !== undefined && canal[them] !== undefined && canal[them] - canal[me] >= COMEBACK_GAP;
  return {
    code: g.code,
    at: g.finishedAt,
    map,
    won,
    vp: mine.vp,
    theirs: theirs.vp,
    ...(town ? { town: { id: town, name: boardOf(map).townById[town]?.name ?? town } } : {}),
    ...(industry ? { industry } : {}),
    ...(loans >= MANY_LOANS ? { loans } : {}),
    ...(comeback ? { comeback: true } : {}),
    ...(own ? { own } : {}),
  };
}

/** every character's memory of an account, from the games at home it
 *  played out: the order they are handed in does not matter. A game the
 *  table folded, or one with no seat of the account's, is not remembered */
export function rivalriesOf(games: readonly Finished[]): Rivalry[] {
  const out = new Map<BotPersona, Rivalry>();
  for (const g of [...games].sort((a, b) => a.finishedAt - b.finishedAt || (a.code < b.code ? -1 : 1))) {
    const r = g.result;
    if (r.abandoned || r.players.length !== g.setup.players.length) continue;
    /* several people round one screen play under one account: it is the
       best placed of them the characters remember */
    const humans = g.setup.players.map((s, i) => ({ s, i })).filter((x) => x.s.type === 'human' && !r.players[x.i].bot);
    if (!humans.length) continue;
    const me = humans.sort((a, b) => r.players[b.i].vp - r.players[a.i].vp)[0].i;
    const met = new Set<BotPersona>();
    g.setup.players.forEach((seat, them) => {
      if (seat.type !== 'bot') return;
      const persona = personaFor(seat);
      /* two chairs of one character (an old deal): the first speaks */
      if (met.has(persona)) return;
      met.add(persona);
      const last = memoryOf(g, me, them);
      out.set(persona, { ...foldGame(out.get(persona) ?? null, persona, last), last });
    });
  }
  return [...out.values()];
}

/** the accounts whose rivalries are held counted at once */
const KEPT_MOST = 5000;

/** the rivalries of each account, counted again only when a game of theirs
 *  has been played out or put away since */
export class Rivals {
  private kept = new Map<string, { stamp: string; list: Rivalry[] }>();
  private read: (ownerId: string) => Finished[];
  private stampOf: (ownerId: string) => string;

  constructor(read: (ownerId: string) => Finished[], stampOf: (ownerId: string) => string) {
    this.read = read;
    this.stampOf = stampOf;
  }

  of(ownerId: string): Rivalry[] {
    const stamp = this.stampOf(ownerId);
    const kept = this.kept.get(ownerId);
    if (kept && kept.stamp === stamp) return kept.list;
    const list = rivalriesOf(this.read(ownerId));
    /* a memory, not a hoard: a crowded office starts its count again */
    if (this.kept.size >= KEPT_MOST) this.kept.clear();
    this.kept.set(ownerId, { stamp, list });
    return list;
  }
}
