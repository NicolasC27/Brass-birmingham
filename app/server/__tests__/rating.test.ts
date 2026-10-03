import { describe, expect, it } from 'vitest';
import { ephemerisOf, weekOf } from '@/platform/almanac';
import { CEILING, FLOOR, K_PLACING, K_SETTLED, fresh, ratingOf, seasonAt, settle } from '../rating';

/* The cote on paper: the seasons fall on the quarters, and a game moves
   every human against every other by the mean of what they took. */

describe('the cote', () => {
  it('names the season after the quarter, in the house\'s own years', () => {
    const s = seasonAt(Date.UTC(2026, 7, 15));
    expect(s).toEqual({ id: '2026-Q3', name: `Service d’été ${ephemerisOf(weekOf(Date.UTC(2026, 6, 1))).year}`, endsAt: Date.UTC(2026, 9, 1) });
    expect(seasonAt(Date.UTC(2026, 11, 31, 23, 59)).endsAt).toBe(Date.UTC(2027, 0, 1));
    expect(seasonAt(Date.UTC(2027, 0, 1)).id).toBe('2027-Q1');
  });

  it('moves two equals by half the K, and the winner up', () => {
    const [a, b] = settle([fresh(), fresh()], [40, 30], 0);
    expect(a).toEqual({ rating: 1200 + K_PLACING / 2, games: 1, won: 1, trend: [1220] });
    expect(b).toEqual({ rating: 1200 - K_PLACING / 2, games: 1, won: 0, trend: [1180] });
    /* a tie moves nobody, but is a game played */
    expect(settle([fresh(), fresh()], [30, 30], 0).map((s) => s.rating)).toEqual([1200, 1200]);
  });

  it('weighs each seat against every other, and settles down after ten games', () => {
    const settled = { ...fresh(), games: 10 };
    const [top, mid, low] = settle([settled, settled, settled], [50, 40, 30], 0);
    /* the first took two points where one was expected, the middle one of one */
    expect(top.rating).toBe(1200 + K_SETTLED / 2);
    expect(mid.rating).toBe(1200);
    expect(low.rating).toBe(1200 - K_SETTLED / 2);
    /* the higher the cote, the less a win over a lesser one is worth */
    const [strong, weak] = settle([{ ...fresh(), rating: 1800 }, fresh()], [50, 30], 0);
    expect(strong.rating - 1800).toBeLessThan(5);
    expect(1200 - weak.rating).toBeLessThan(5);
    /* and it never leaves its bounds */
    expect(settle([{ ...fresh(), rating: CEILING }, { ...fresh(), rating: FLOOR }], [50, 30], 0).map((s) => s.rating)).toEqual([CEILING, FLOOR]);
    expect(settle([fresh(), fresh()], [50, 30], 0)[0].trend.length).toBe(1);
  });

  it('shows the placements left and the guild rank', () => {
    expect(ratingOf(fresh())).toMatchObject({ rating: 1200, tier: 'journeyman', placements: 5 });
    expect(ratingOf({ rating: 1650, games: 7, won: 4, trend: [] })).toMatchObject({ tier: 'industrialist', placements: 0 });
  });
});
