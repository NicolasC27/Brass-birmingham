import { SETUP_STORAGE_KEY, type StoredSetup } from '@/components/setup/constants';
import { personaName, incomeLevel } from './data';
import { deedsOf, type Deeds } from './plan';
import { openHomeGame } from './home';
import { paper, writePaper } from '@/platform/papers';
import { weekOf } from '@/platform/almanac';
import type { BotPersona, GameState, IndustryType, SetupPayload } from './types';

/* ------------------------------------------------------------------ */
/* The challenge of the week. One table, the same for everyone from    */
/* Monday to Sunday: a fixed deal (the seed comes from the week), named */
/* machines across the table — Mr Watt always among them — and a       */
/* handful of conditions that all have to hold at the close. The      */
/* journal prints it as a notice; a game opened from it is a local     */
/* table like any other, remembered here by its code so the deal and   */
/* the verdict find each other. Points: the victory points, fifteen a  */
/* condition met, twenty-five more when every one is. One of the       */
/* office's papers.                                                    */
/* ------------------------------------------------------------------ */

export const POINTS_PER_RULE = 15;
export const POINTS_ALL = 25;

/** one condition of a challenge, read on the human's seat at the close */
export type Rule =
  | { kind: 'win' }
  | { kind: 'vp'; min: number }
  | { kind: 'loans'; max: number }
  | { kind: 'industry'; industry: IndustryType; level: number; count: number; sold?: boolean; era?: 'canal' | 'rail' }
  | { kind: 'links'; min: number; era?: 'canal' | 'rail' }
  | { kind: 'doubleRails'; min: number }
  | { kind: 'income'; min: number }
  | { kind: 'money'; min: number }
  | { kind: 'develops'; min: number };

export interface ChallengeDef {
  id: string;
  /** the machines across the table, in seat order */
  rivals: BotPersona[];
  options: StoredSetup['options'];
  rules: Rule[];
}

/* the eight notices, printed in turn week after week; the deal changes
   every week even when the notice comes back */
export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'forges',
    rivals: ['watt', 'boulton'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'industry', industry: 'iron', level: 3, count: 2 }, { kind: 'loans', max: 1 }, { kind: 'vp', min: 130 }],
  },
  {
    id: 'noBanker',
    rivals: ['wedgwood', 'arkwright', 'watt'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'loans', max: 0 }, { kind: 'links', min: 8 }],
  },
  {
    id: 'burton',
    rivals: ['watt', 'arkwright'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'industry', industry: 'brewery', level: 1, count: 4, sold: true }, { kind: 'income', min: 20 }],
  },
  {
    id: 'manchesterLine',
    rivals: ['boulton', 'watt', 'wedgwood'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'links', min: 8, era: 'rail' }, { kind: 'doubleRails', min: 3 }],
  },
  {
    id: 'staffordshire',
    rivals: ['wedgwood', 'watt'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'industry', industry: 'pottery', level: 1, count: 2, sold: true, era: 'canal' }, { kind: 'industry', industry: 'pottery', level: 4, count: 1, sold: true }, { kind: 'vp', min: 140 }],
  },
  {
    id: 'bigCotton',
    rivals: ['arkwright', 'watt', 'boulton'],
    options: { eraLength: 'standard', marketTemper: 'volatile', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'industry', industry: 'cotton', level: 3, count: 3, sold: true }, { kind: 'loans', max: 2 }],
  },
  {
    id: 'shortEra',
    rivals: ['watt', 'wedgwood'],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'links', min: 10 }, { kind: 'money', min: 30 }],
  },
  {
    id: 'boxes',
    rivals: ['watt', 'boulton', 'arkwright'],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    rules: [{ kind: 'win' }, { kind: 'industry', industry: 'manufacturer', level: 5, count: 2 }, { kind: 'develops', min: 3 }],
  },
];

export interface Challenge extends ChallengeDef {
  week: number;
  /** the deal of the week */
  seed: number;
  /** the notice's number, as the journal prints it */
  number: number;
}

/** the deal of a week: fixed by the week, different every week */
const seedOf = (week: number): number => 100003 + week * 7919;

/** the notice of a week, the one running by default */
export function challengeOf(week = weekOf()): Challenge {
  const def = CHALLENGES[week % CHALLENGES.length];
  return { ...def, week, seed: seedOf(week), number: week + 1 };
}

/* ------------------------------ the register ------------------------------ */

export interface Attempt {
  week: number;
  id: string;
  code: string;
  at: number;
  vp: number;
  rank: number;
  met: boolean[];
  points: number;
}

interface Register {
  /** the local tables opened from a notice, by code */
  tables: Record<string, { week: number; id: string; seed: number }>;
  attempts: Attempt[];
}

const readRegister = (): Register => {
  const v = paper<Partial<Register> | null>('challenge', null);
  return { tables: v?.tables && typeof v.tables === 'object' ? v.tables : {}, attempts: Array.isArray(v?.attempts) ? v.attempts : [] };
};
const writeRegister = (r: Register): void => writePaper('challenge', r);

/** the deal a local table was opened with, when it came from a notice */
export function challengeSeedFor(code: string): number | null {
  return readRegister().tables[code]?.seed ?? null;
}

/** the notice a local table answers, if any */
export function challengeFor(code: string): { week: number; id: string } | null {
  const e = readRegister().tables[code];
  return e ? { week: e.week, id: e.id } : null;
}

/** dress the table of the notice and open it at the office — the caller
 *  then opens /game/local/<code> */
export async function startChallenge(c: Challenge, me: string): Promise<string> {
  const colors = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
  const setup: StoredSetup = {
    players: [{ name: me, color: colors[0], type: 'human' }, ...c.rivals.map((p, i) => ({ name: personaName(p), color: colors[i + 1], type: 'bot' as const, persona: p }))],
    options: c.options,
  };
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
    localStorage.removeItem('brassworks.tutorial.v1');
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
  /* the deal the notice fixes goes to the office with the game; the code it
     deals back is what the register keys on */
  const table = await openHomeGame(c.seed, setup as unknown as SetupPayload);
  noteChallengeTable(table.code, c);
  return table.code;
}

/** this table answers that notice: the register says so, and reads the
 *  attempt at the close by the code */
export function noteChallengeTable(code: string, c: Challenge): void {
  const r = readRegister();
  r.tables[code] = { week: c.week, id: c.id, seed: c.seed };
  writeRegister(r);
}

/* ------------------------------ the verdict ------------------------------ */

/** does one condition hold, on what the seat did */
export function ruleMet(rule: Rule, g: GameState, me: number, d: Deeds): boolean {
  const p = g.players[me];
  const vps = g.players.map((x) => x.vp);
  switch (rule.kind) {
    case 'win':
      return !g.abandoned && vps.every((v, i) => i === me || v < vps[me]);
    case 'vp':
      return p.vp >= rule.min;
    case 'loans':
      return d.loans <= rule.max;
    case 'industry':
      return d.built.filter((b) => b.industry === rule.industry && b.level >= rule.level && (!rule.sold || b.sold) && (!rule.era || b.era === rule.era)).length >= rule.count;
    case 'links':
      return d.links.filter((l) => !rule.era || l.era === rule.era).length >= rule.min;
    case 'doubleRails':
      return d.links.filter((l) => l.double).length >= rule.min;
    case 'income':
      return incomeLevel(p.income) >= rule.min;
    case 'money':
      return p.money >= rule.min;
    case 'develops':
      return d.develops >= rule.min;
  }
}

/** a local table from a notice is over: the verdict, written to the register */
export function noteChallenge(g: GameState, code: string | null): Attempt | null {
  if (!code || g.phase !== 'game-over') return null;
  const r = readRegister();
  const entry = r.tables[code];
  if (!entry) return null;
  const def = CHALLENGES.find((c) => c.id === entry.id);
  const me = g.players.findIndex((p) => !p.isBot);
  if (!def || me < 0) return null;
  const d = deedsOf(g, me);
  const met = def.rules.map((rule) => ruleMet(rule, g, me, d));
  const all = met.every(Boolean);
  const vps = g.players.map((x) => x.vp);
  const attempt: Attempt = {
    week: entry.week,
    id: entry.id,
    code,
    at: Date.now(),
    vp: vps[me],
    rank: 1 + vps.filter((v) => v > vps[me]).length,
    met,
    points: g.abandoned ? 0 : vps[me] + POINTS_PER_RULE * met.filter(Boolean).length + (all ? POINTS_ALL : 0),
  };
  r.attempts = [attempt, ...r.attempts.filter((a) => a.code !== code)].slice(0, 200);
  writeRegister(r);
  return attempt;
}

/** my attempts at a week's notice, the best first */
export function attemptsOf(week: number): Attempt[] {
  return readRegister()
    .attempts.filter((a) => a.week === week)
    .sort((a, b) => b.points - a.points);
}

/** a table of the notice still in play on this device, if any */
export function openAttemptOf(week: number, open: { code: string }[]): string | null {
  const r = readRegister();
  const done = new Set(r.attempts.map((a) => a.code));
  return open.map((t) => t.code).find((c) => r.tables[c]?.week === week && !done.has(c)) ?? null;
}
