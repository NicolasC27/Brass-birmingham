/* ------------------------------------------------------------------ */
/* The waiting list, as the office and the direction both read it.     */
/*                                                                     */
/* An address left on the front page before the line opens: it answers */
/* its letter, then waits for the circulars the direction sends out —  */
/* the invitation to the trial run first of all. Shared by the office  */
/* (server/waitlist.ts) and the direction's page, so the count a       */
/* circular will reach is the same number on both sides.               */
/* ------------------------------------------------------------------ */

export const WAIT_LANGS = ['fr', 'en', 'es', 'de'] as const;
export type WaitLang = (typeof WAIT_LANGS)[number];

/** one address on the list */
export interface Entrant {
  id: string;
  email: string;
  lang: WaitLang;
  /** where the visitor came from: the `?via=` of the link, or the referring site */
  source: string;
  /** the country it was left from (ISO 3166 code), '' when unknown */
  country: string;
  createdAt: number;
  /** the address answered its letter (null: not yet) */
  confirmedAt: number | null;
  /** circulars that reached it, and those still waiting to leave */
  letters: number;
  awaiting: number;
}

/** who a circular is written to */
export interface Audience {
  /** one language, or every one */
  lang: WaitLang | null;
  /** only the addresses no circular was ever written to */
  fresh: boolean;
  /** the first so many, by order of arrival (null: all of them) */
  limit: number | null;
}

export interface Circular {
  id: string;
  subject: string;
  body: string;
  audience: Audience;
  createdAt: number;
  total: number;
  sent: number;
  /** letters the post turned down three times over */
  failed: number;
  /** stopped by the direction before every letter had left */
  stoppedAt: number | null;
}

/** the whole book, as the direction reads it */
export interface WaitBook {
  entrants: Entrant[];
  circulars: Circular[];
  /** the circular letters the office sends in a day at most */
  cap: number;
  /** and how many left in the last twenty-four hours */
  sentToday: number;
}

/** the founders: the first addresses to answer their letter get a year of
 *  Premium when it opens, counted in the order the letters were answered */
export const FOUNDERS = 100;

/** the founders among a book's lines: the first FOUNDERS confirmed, by the moment they answered */
export function founders(entrants: readonly Entrant[]): Set<string> {
  return new Set(
    entrants
      .filter((e) => e.confirmedAt !== null)
      .sort((a, b) => (a.confirmedAt ?? 0) - (b.confirmedAt ?? 0) || a.createdAt - b.createdAt)
      .slice(0, FOUNDERS)
      .map((e) => e.id),
  );
}

export const MAX_SUBJECT = 140;
export const MAX_BODY = 20_000;
/** a circular is written to this many addresses at most */
export const MAX_REACH = 50_000;

/** the addresses a circular would be written to: confirmed, in the
 *  audience, the earliest first */
export function reach(entrants: readonly Entrant[], audience: Audience): Entrant[] {
  const out = entrants
    .filter((e) => e.confirmedAt !== null && (audience.lang === null || e.lang === audience.lang) && (!audience.fresh || e.letters + e.awaiting === 0))
    .sort((a, b) => a.createdAt - b.createdAt);
  return audience.limit === null ? out : out.slice(0, Math.max(0, audience.limit));
}

/** an audience as sent over the wire, checked: null when it is not one */
export function audienceOf(raw: unknown): Audience | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const lang = a.lang === null || a.lang === undefined ? null : (WAIT_LANGS as readonly unknown[]).includes(a.lang) ? (a.lang as WaitLang) : undefined;
  const limit = a.limit === null || a.limit === undefined ? null : Number.isInteger(a.limit) && (a.limit as number) > 0 && (a.limit as number) <= MAX_REACH ? (a.limit as number) : undefined;
  if (lang === undefined || limit === undefined) return null;
  return { lang, fresh: a.fresh === true, limit };
}
