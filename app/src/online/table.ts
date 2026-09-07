import type { BotDifficulty, PlayerColor, SetupOptions, StoredSetup } from '@/components/setup/constants';

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

export type LobbyError = 'not-found' | 'full' | 'started' | 'refused' | 'offline';

/** why the office would not sign you in */
export type AuthError = 'bad-name' | 'weak-password' | 'name-taken' | 'bad-credentials' | 'no-session' | 'sign-in-first';

export interface Identity {
  id: string;
  name: string;
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
    players: table.seats.map((s) => ({ name: s.name, color: s.color, type: s.kind, ...(s.kind === 'bot' ? { difficulty: s.difficulty ?? 'industrialist' } : {}) })),
    options: table.options,
  };
}

export function canStart(table: Table): boolean {
  return table.status === 'open' && table.seats.length >= 2 && table.seats.every((s) => s.kind === 'bot' || s.ready);
}
