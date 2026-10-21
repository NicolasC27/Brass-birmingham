import type { BotPersona, IndustryType } from './types';

/* ------------------------------------------------------------------ */
/* The rivalries: what a character remembers of the games it played    */
/* against one account at home.                                        */
/*                                                                     */
/* The office counts them from the finished games it keeps (games,     */
/* who came out ahead, the last result and a few facts of the last     */
/* game); this file only says what the record looks like and which of */
/* a character's lines it calls for. Nothing here reads the game being */
/* played: a rival remembers, it does not look over the reader's hand. */
/* ------------------------------------------------------------------ */

/** the last game a character played against the account */
export interface RivalLast {
  /** the game's code and when it was played out */
  code: string;
  at: number;
  /** the board it stood on */
  map: string;
  /** the account came out ahead of the character */
  won: boolean;
  /** the account's points and the character's */
  vp: number;
  theirs: number;
  /** a town the account built more in than the character, which built there too */
  town?: { id: string; name: string };
  /** the industry the account leaned on */
  industry?: IndustryType;
  /** the loans the account took, when they were many */
  loans?: number;
  /** the account was behind at the canal's close, and won all the same */
  comeback?: boolean;
  /** the industry the character built most of */
  own?: IndustryType;
}

/** one character's memory of one account */
export interface Rivalry {
  persona: BotPersona;
  games: number;
  /** games the account finished ahead of the character, and behind it */
  won: number;
  lost: number;
  /** the run of results ending with the last game: above zero the
   *  account's wins, below zero the character's */
  streak: number;
  last: RivalLast;
}

/** a character's word at the start of a game, as the tongues say it */
export interface RivalWord {
  persona: BotPersona;
  /** the situation it answers (the key under rivals.<persona>) */
  key: RivalKey;
  vars: Record<string, string | number>;
}

export const RIVAL_KEYS = ['first', 'absence', 'streakYours', 'streakMine', 'comeback', 'close', 'town', 'loans', 'industry', 'own', 'revenge', 'gloat', 'tally'] as const;
export type RivalKey = (typeof RIVAL_KEYS)[number];

/** the words a letter may close on */
export const PS_KEYS = ['first', 'streakYours', 'streakMine', 'tally'] as const;
export type PsKey = (typeof PS_KEYS)[number];

/** a character not met in this long is glad — or sorry — to see the account again */
export const ABSENCE_MS = 21 * 24 * 60 * 60 * 1000;
/** a game this close is remembered as close */
export const CLOSE_MARGIN = 3;
/** a run this long is a streak */
export const STREAK = 3;

/** the situations a record calls for, the most particular first: each tier
 *  is tried in turn, and within a tier the dice choose */
export function situations(r: Rivalry | null, now: number, map: string): RivalKey[][] {
  if (!r || r.games === 0) return [['first']];
  const l = r.last;
  const tiers: RivalKey[][] = [];
  if (now - l.at >= ABSENCE_MS) tiers.push(['absence']);
  if (r.streak >= STREAK) tiers.push(['streakYours']);
  if (r.streak <= -STREAK) tiers.push(['streakMine']);
  tiers.push([...(l.won && l.comeback ? ['comeback' as const] : []), ...(Math.abs(l.vp - l.theirs) <= CLOSE_MARGIN ? ['close' as const] : [])]);
  /* a town is only called back on the board it stands on */
  tiers.push([...(l.town && l.map === map ? ['town' as const] : []), ...(l.loans ? ['loans' as const] : []), ...(l.industry ? ['industry' as const] : []), ...(!l.won && l.own ? ['own' as const] : [])]);
  tiers.push([l.won ? 'revenge' : 'gloat', 'tally']);
  return tiers.filter((t) => t.length > 0);
}

/** the values a line may name, read off the record */
export function wordVars(r: Rivalry | null, name: string): Record<string, string | number> {
  if (!r) return { name };
  const l = r.last;
  return {
    name,
    games: r.games,
    won: r.won,
    lost: r.lost,
    n: Math.abs(r.streak),
    vp: l.vp,
    theirs: l.theirs,
    margin: Math.abs(l.vp - l.theirs),
    ...(l.town ? { town: l.town.name } : {}),
    ...(l.industry ? { industry: l.industry } : {}),
    ...(l.loans ? { loans: l.loans } : {}),
    ...(l.own ? { own: l.own } : {}),
  };
}

/** the word a character says as a game begins: the most particular
 *  situation the record calls for, never the one it said last time to this
 *  account (`said`), the dice choosing within a tier */
export function pickWord(persona: BotPersona, r: Rivalry | null, o: { now: number; map: string; name: string; said?: RivalKey | null; random?: () => number }): RivalWord {
  const random = o.random ?? Math.random;
  const tiers = situations(r, o.now, o.map);
  let key: RivalKey = tiers[0][0];
  for (const tier of tiers) {
    const fresh = tier.filter((k) => k !== o.said);
    if (!fresh.length) continue;
    key = fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
    break;
  }
  return { persona, key, vars: wordVars(r, o.name) };
}

/** the rival who speaks at a table: the character at it with the most
 *  history against the account (the latest met breaking a tie), or, when
 *  none has any, the first of them in the order given */
export function chooseRival(seated: readonly BotPersona[], rivals: readonly Rivalry[]): { persona: BotPersona; rivalry: Rivalry | null } | null {
  if (!seated.length) return null;
  const known = rivals.filter((r) => seated.includes(r.persona) && r.games > 0).sort((a, b) => b.games - a.games || b.last.at - a.last.at);
  return known.length ? { persona: known[0].persona, rivalry: known[0] } : { persona: seated[0], rivalry: null };
}

/** the record with one more game folded in — a game already counted (the
 *  record's last) is not counted twice */
export function foldGame(r: Rivalry | null, persona: BotPersona, g: { code: string; at: number; map: string; won: boolean; vp: number; theirs: number }): Rivalry {
  if (r && r.last.code === g.code) return r;
  const was = r ?? { persona, games: 0, won: 0, lost: 0, streak: 0 };
  const streak = g.won ? (was.streak > 0 ? was.streak + 1 : 1) : was.streak < 0 ? was.streak - 1 : -1;
  return {
    persona,
    games: was.games + 1,
    won: was.won + (g.won ? 1 : 0),
    lost: was.lost + (g.won ? 0 : 1),
    streak,
    last: { code: g.code, at: g.at, map: g.map, won: g.won, vp: g.vp, theirs: g.theirs },
  };
}

/** the postscript of a letter, from the record once the game it answers is
 *  folded in: a first game, a run of three or more, else the count */
export function pickPs(r: Rivalry): { key: PsKey; vars: Record<string, number> } {
  const vars = { games: r.games, won: r.won, lost: r.lost, n: Math.abs(r.streak) };
  if (r.games <= 1) return { key: 'first', vars };
  if (r.streak >= STREAK) return { key: 'streakYours', vars };
  if (r.streak <= -STREAK) return { key: 'streakMine', vars };
  return { key: 'tally', vars };
}
