/* ------------------------------------------------------------------ */
/* The almanac. The journal counts its weeks from the first Monday of  */
/* 2026; every week is a year of the era, and prints one thing that    */
/* happened in the Midlands that year — the ephemeris. The text lives  */
/* in the dictionaries under platform.almanac.e<n>; the years here.    */
/* ------------------------------------------------------------------ */

/** Monday 5 January 2026, 00:00 UTC — week 0 of the journal */
export const WEEK0 = Date.UTC(2026, 0, 5);
export const WEEK_MS = 7 * 24 * 3600 * 1000;

/** the journal's week for an instant (0 for the first) */
export const weekOf = (now = Date.now()): number => Math.max(0, Math.floor((now - WEEK0) / WEEK_MS));
/** when that week closes */
export const weekEndsAt = (week: number): number => WEEK0 + (week + 1) * WEEK_MS;
/** whole days until the week closes, never less than 1 while it lasts */
export const daysLeft = (week: number, now = Date.now()): number => Math.max(1, Math.ceil((weekEndsAt(week) - now) / (24 * 3600 * 1000)));

/** the years of the ephemerides, in the order the weeks print them */
export const ALMANAC_YEARS = [
  1770, 1771, 1772, 1774, 1775, 1776, 1777, 1779, 1781, 1782, 1784, 1785, 1788, 1790, 1791, 1792, 1793, 1798, 1800, 1801,
  1802, 1804, 1805, 1809, 1811, 1812, 1814, 1815, 1819, 1821, 1825, 1829, 1830, 1833, 1837, 1838, 1840, 1846, 1854, 1865,
] as const;

export interface Ephemeris {
  index: number;
  year: number;
  /** the dictionary key of the line */
  key: string;
}

/** the ephemeris of a week: the year of the era, and the line to print */
export function ephemerisOf(week = weekOf()): Ephemeris {
  const index = week % ALMANAC_YEARS.length;
  return { index, year: ALMANAC_YEARS[index], key: `platform.almanac.e${index}` };
}
