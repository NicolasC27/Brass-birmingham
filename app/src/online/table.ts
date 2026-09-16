import type { BotDifficulty, PlayerColor, SetupOptions, StoredSetup } from '@/components/setup/constants';
import type { Tally } from '@/game/tally';
import type { Era } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The table model — seats, colours, readiness. Deliberately free of   */
/* React and of the browser: the lobby client, the online transport    */
/* and the server all describe a table with these very types, so a     */
/* table travels over the wire without a translation layer.            */
/* ------------------------------------------------------------------ */

export interface TableSeat {
  /** the player's id (per tab locally, the account online) — bots get their own */
  id: string;
  name: string;
  color: PlayerColor;
  kind: 'human' | 'bot';
  difficulty?: BotDifficulty;
  /** this seat's candle: undefined = the table's timer, null = no candle, or minutes */
  minutes?: number | null;
  ready: boolean;
  joinedAt: number;
}

export interface Table {
  code: string;
  name: string;
  hostId: string;
  seats: TableSeat[];
  options: SetupOptions;
  status: 'open' | 'starting';
  createdAt: number;
  updatedAt: number;
}

export type LobbyError = 'not-found' | 'full' | 'started' | 'refused' | 'offline' | 'verify-first' | 'no-such-player' | 'already-seated' | 'already-invited' | 'not-yours' | 'already-friends' | 'yourself';

/** why the office would not sign you in */
export type AuthError =
  | 'bad-name'
  | 'bad-email'
  | 'weak-password'
  | 'name-taken'
  | 'email-taken'
  | 'bad-credentials'
  | 'wrong-password'
  | 'no-session'
  | 'sign-in-first'
  | 'bad-token'
  | 'unknown-email';

export interface Identity {
  id: string;
  name: string;
}

/** the account, as its owner sees it */
export interface Me extends Identity {
  email: string | null;
  /** the address has answered its letter: the tables are open */
  verified: boolean;
  motto: string;
  favoriteColor: PlayerColor | null;
  createdAt: number;
}

/** a table as the desk lists it: who sits there, and whose move it is */
export interface TableSummary {
  code: string;
  name: string;
  hostId: string;
  seats: { id: string; name: string; color: PlayerColor; kind: 'human' | 'bot' }[];
  status: 'open' | 'playing' | 'over';
  era?: Era;
  round?: number;
  /** the seat to act, while the game is in play */
  current?: number;
  /** it is my move */
  myTurn: boolean;
  updatedAt: number;
}

export interface Invitation {
  id: string;
  code: string;
  tableName: string;
  from: Identity;
  to: Identity;
  createdAt: number;
}

/** a finished game, as the desk remembers it */
export interface PastGame {
  code: string;
  name: string;
  finishedAt: number;
  players: { id: string; name: string; color: PlayerColor; vp: number; bot: boolean; tally?: Tally }[];
  winner: number;
  /** the game ended by the table's own vote */
  abandoned: boolean;
}

export interface Stats {
  played: number;
  won: number;
  /** victory points, on average, over finished games */
  averageVp: number;
  bestVp: number;
  /** the finishing place, on average (1 = first), over games played out */
  averagePlace: number;
  /** the games that carry a tally — the ones the sum below is over */
  tallied: number;
  /** everything done at the tables, added up over finished games */
  tally: Tally | null;
  /** the chair taken most often */
  colour: PlayerColor | null;
  /** the record against every other person met at a table, most played first */
  rivals: { id: string; name: string; played: number; won: number; lost: number }[];
}

/** a friend, or a friendship on its way: 'asks' = they asked me, 'asked' = I asked them */
export interface Friend {
  id: string;
  account: Identity;
  status: 'friends' | 'asks' | 'asked';
  /** a socket of theirs is open right now */
  online: boolean;
  /** the table they sit at that is in play: one may go and watch it */
  playing?: { code: string; name: string };
}

/** everything the desk shows: my tables, my letters, my friends, my past games */
export interface Desk {
  tables: TableSummary[];
  invitations: Invitation[];
  /** the invitations I sent that are still unanswered */
  sent: Invitation[];
  friends: Friend[];
  history: PastGame[];
  stats: Stats;
}

export const MAX_SEATS = 4;
/** a table code: four glyphs from an alphabet without look-alikes */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

/** the order in which free chairs take their colour */
export const SEAT_COLORS: PlayerColor[] = ['brass', 'oxblood', 'verdigris', 'steel'];

/** a random id from the code alphabet */
export const randomId = (n = 8): string => Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

/** the first colour nobody at the table holds */
export function freeColor(table: Pick<Table, 'seats'>, wanted?: PlayerColor): PlayerColor {
  const taken = new Set(table.seats.map((s) => s.color));
  if (wanted && !taken.has(wanted)) return wanted;
  return SEAT_COLORS.find((c) => !taken.has(c)) ?? 'brass';
}

/** the game page's setup contract, from a table about to start */
export function setupFromTable(table: Table): StoredSetup {
  return {
    players: table.seats.map((s) => ({ name: s.name, color: s.color, type: s.kind, ...(s.kind === 'bot' ? { difficulty: s.difficulty ?? 'industrialist' } : {}), ...(s.minutes !== undefined ? { minutes: s.minutes } : {}) })),
    options: table.options,
  };
}

export function canStart(table: Table): boolean {
  return table.status === 'open' && table.seats.length >= 2 && table.seats.every((s) => s.kind === 'bot' || s.ready);
}
