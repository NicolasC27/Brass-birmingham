import { describe, expect, it } from 'vitest';
import { ALMANAC_YEARS, WEEK0, WEEK_MS, daysLeft, ephemerisOf, weekEndsAt, weekOf } from '../almanac';

/* the journal counts its weeks from the first Monday of 2026, a year of the era each */

describe('the almanac', () => {
  it('counts the weeks from the first Monday, never below zero', () => {
    expect(weekOf(WEEK0)).toBe(0);
    expect(weekOf(WEEK0 - 1)).toBe(0);
    expect(weekOf(WEEK0 + WEEK_MS)).toBe(1);
    expect(weekOf(WEEK0 + 36 * WEEK_MS + 3 * 24 * 3600 * 1000)).toBe(36);
    expect(weekEndsAt(0)).toBe(WEEK0 + WEEK_MS);
  });

  it('prints the years in turn, and starts again after the last', () => {
    expect(ephemerisOf(0)).toEqual({ index: 0, year: 1770, key: 'platform.almanac.e0' });
    expect(ephemerisOf(ALMANAC_YEARS.length).year).toBe(1770);
    expect(ephemerisOf(7).year).toBe(1779);
    /* the years only rise */
    for (let i = 1; i < ALMANAC_YEARS.length; i++) expect(ALMANAC_YEARS[i]).toBeGreaterThan(ALMANAC_YEARS[i - 1]);
  });

  it('leaves at least a day while the week lasts', () => {
    expect(daysLeft(0, WEEK0)).toBe(7);
    expect(daysLeft(0, WEEK0 + WEEK_MS - 1000)).toBe(1);
  });
});
