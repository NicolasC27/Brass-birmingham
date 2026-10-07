import { localeOf } from '@/i18n';

/* ------------------------------------------------------------------ */
/* Since when one is of the club.                                      */
/*                                                                     */
/* The desk and the profile printed the same sentence in two hands —   */
/* « septembre 2026 » at one counter, « 21 septembre 2026 » at the     */
/* other — and a reader who saw both was left wondering which register */
/* was wrong. A club remembers the month a member was entered, never   */
/* the day, so the day is dropped and both counters read from here.    */
/* ------------------------------------------------------------------ */

/** the month and year a membership was entered, in the reader's own tongue */
export function memberSince(createdAt: number | string, lang: string): string {
  return new Date(createdAt).toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' });
}
