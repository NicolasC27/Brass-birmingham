import type { Rating, Season } from '@/online/table';
import { tierOf } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The cote — where one stands this season.                           */
/*                                                                     */
/* A season is a quarter of the calendar, named as the house would     */
/* write it in its ledger. The cote is an Elo: after a ranked game,    */
/* every human seat is weighed against every other, the winner of the  */
/* pair taking the point, a tie half of it, and the seat moves by the  */
/* mean of what it took over what was expected. The first games move   */
/* it twice as fast — the placements — and it never leaves [600, 3000].*/
/* Nothing here touches the register: the store keeps the standings,   */
/* this file only says what they become.                               */
/* ------------------------------------------------------------------ */

export const START = 1200;
export const FLOOR = 600;
export const CEILING = 3000;
/** the K factor: forty over the first games, twenty once the cote is firm */
export const K_PLACING = 40;
export const K_SETTLED = 20;
export const PLACING_GAMES = 10;
/** placement games before the cote is shown as firm */
export const PLACEMENTS = 5;
/** how many cotes the trend keeps */
export const TREND = 12;

/** the standing as the register keeps it */
export interface Standing {
  rating: number;
  games: number;
  won: number;
  /** the last cotes, oldest first */
  trend: number[];
}

export const fresh = (): Standing => ({ rating: START, games: 0, won: 0, trend: [] });

/** the season a moment falls in: one quarter, named in the house's own years */
export function seasonAt(now = Date.now()): Season {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  const endsAt = quarter === 4 ? Date.UTC(year + 1, 0, 1) : Date.UTC(year, quarter * 3, 1);
  return { id: `${year}-Q${quarter}`, name: `Exercice ${year - 200} · T${quarter}`, endsAt };
}

const expected = (mine: number, theirs: number): number => 1 / (1 + 10 ** ((theirs - mine) / 400));
const clamp = (r: number): number => Math.min(CEILING, Math.max(FLOOR, Math.round(r)));

/** the standings after a ranked game: `vp` per seat, `winner` the seat the
 *  game named — the cotes move on the points, the win goes on the record;
 *  `weighs` says which pairs count (a pair met too often this season does not) */
export function settle(before: Standing[], vp: number[], winner: number, weighs: (i: number, j: number) => boolean = () => true): Standing[] {
  return before.map((s, i) => {
    let taken = 0;
    let others = 0;
    for (let j = 0; j < before.length; j++) {
      if (j === i || !weighs(i, j)) continue;
      const actual = vp[i] > vp[j] ? 1 : vp[i] === vp[j] ? 0.5 : 0;
      taken += actual - expected(s.rating, before[j].rating);
      others += 1;
    }
    const k = s.games < PLACING_GAMES ? K_PLACING : K_SETTLED;
    const rating = others ? clamp(s.rating + (k * taken) / others) : s.rating;
    return { rating, games: s.games + 1, won: s.won + (i === winner ? 1 : 0), trend: [...s.trend, rating].slice(-TREND) };
  });
}

/** the standing as the desk shows it */
export function ratingOf(s: Standing): Rating {
  return { rating: s.rating, tier: tierOf(s.rating), games: s.games, won: s.won, placements: Math.max(0, PLACEMENTS - s.games), trend: s.trend };
}
