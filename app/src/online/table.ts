import type { BotPersona, PlayerColor, SetupOptions, StoredSetup } from '@/components/setup/constants';
import { personaFor } from '@/game/data';
import type { GameAction } from '@/game/actions';
import type { Tally } from '@/game/tally';
import type { Era, SetupPayload } from '@/game/types';

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
  persona?: BotPersona;
  /** what a bot was before the characters: read from old registers, never written */
  difficulty?: string;
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
  /** a table the office dealt from the ranked queue: the cote is at stake, no machines */
  ranked?: boolean;
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
  /** the member's own likeness, a small square picture kept at the office (a data URL), or none */
  portrait: string | null;
  createdAt: number;
  /** the Monday edition by post, asked for */
  newsletter: boolean;
  /** an account the office opened by itself so a first game had somewhere to
   *  be written: it plays and it keeps, and it becomes a member when its
   *  owner gives it a name and an address */
  guest: boolean;
}

/** a paper the office keeps for an account: what the browser wrote, as it wrote it */
export interface Paper {
  body: unknown;
  updatedAt: number;
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
  ranked?: boolean;
  updatedAt: number;
}

/* ------------------------- the hall, the cote, the counter ------------------------- */

/** a game's shape in a few strokes: the towns held (a town once per holder) and the links laid, each by the seat's index */
export interface Sketch {
  board?: string;
  towns: [town: string, owner: number][];
  links: [link: string, owner: number][];
}

/** a table anyone may look at: the register of what is being played */
export interface PublicTable {
  code: string;
  name: string;
  hostName: string;
  /** the account id names the likeness the office serves */
  seats: { id: string; name: string; color: PlayerColor; kind: 'human' | 'bot' }[];
  status: 'open' | 'playing';
  eraLength: 'short' | 'standard';
  era?: Era;
  round?: number;
  /** the seat to act */
  current?: number;
  /** the board in a few strokes, while in play */
  sketch?: Sketch;
  ranked: boolean;
  /** sockets watching the table right now, the seated ones included */
  watchers: number;
  updatedAt: number;
  /** a friend of the viewer sits here */
  friend?: boolean;
}

/* ---- the register, a page at a time: a thousand tables are not read whole ---- */

export const TABLE_FILTERS = ['all', 'seats', 'friends', 'ranked', 'rail', 'live'] as const;
export type TableFilter = (typeof TABLE_FILTERS)[number];
export type TableSort = 'filling' | 'fresh';
export interface TableQuery {
  filter?: TableFilter;
  /** a code, a host or a table name */
  q?: string;
  sort?: TableSort;
  offset?: number;
  limit?: number;
}
export const TABLE_PAGE = 20;
/** the query as the office reads it: the same on both ends, so a page can be matched to its asking */
export function normalizeQuery(q: TableQuery = {}): Required<TableQuery> {
  const limit = Math.min(50, Math.max(1, Math.floor(Number(q.limit) || TABLE_PAGE)));
  return {
    filter: (TABLE_FILTERS as readonly string[]).includes(q.filter ?? '') ? (q.filter as TableFilter) : 'all',
    q: String(q.q ?? '').trim().toLowerCase().slice(0, 40),
    sort: q.sort === 'fresh' ? 'fresh' : 'filling',
    offset: Math.max(0, Math.floor(Number(q.offset) || 0)),
    limit,
  };
}
/** a company of the club: members band together under a name of the era,
 *  and the honours rank the companies by their members' wins this season */
export interface Company {
  id: string;
  name: string;
  members: number;
}
export interface CompanyRow extends Company {
  wins: number;
  games: number;
  createdAt: number;
}
export interface CompanyBoard {
  season: Season;
  rows: CompanyRow[];
  /** the viewer's own company, if any */
  mine: Company | null;
}

/** the club's week, as the office prints it on Monday: how many games were
 *  played out, the game of the week, the most assiduous member, the latest games */
export interface Edition {
  week: number;
  games: number;
  best: { code: string; name: string; finishedAt: number; winner: string; vp: number; players: string[] } | null;
  busiest: { name: string; games: number } | null;
  latest: { code: string; name: string; finishedAt: number; winner: string; vp: number; players: number }[];
  /** what the machines made of the club this week, by their name */
  machines: { name: string; won: number; lost: number }[];
}

/** a service closed: its honours, as the office prints them */
export interface SeasonReview {
  season: Season;
  games: number;
  players: LeaderRow[];
  companies: CompanyRow[];
  best: Edition['best'];
}

/** a headline wired from a table in play: the round just played, told the
 *  Gazette's way (game/gazette.ts), with the table it came from */
export interface Dispatch {
  code: string;
  table: string;
  at: number;
  era: 'canal' | 'rail';
  round: number;
  key: string;
  vars: Record<string, string | number>;
}

export interface TablesPage {
  query: Required<TableQuery>;
  /** the page asked for */
  tables: PublicTable[];
  /** how many the filter and the search leave in all */
  total: number;
  /** how many each filter would leave, under the same search */
  counts: Record<TableFilter, number>;
  /** the viewer's own tables, whatever the page */
  mine: PublicTable[];
  /** where the viewer's friends sit, three at most */
  friends: PublicTable[];
  /** the tables most watched right now, three at most */
  live: PublicTable[];
  /** the latest headlines from the tables in play, the newest first */
  dispatches: Dispatch[];
}

/** the guild ranks, by cote */
export type Tier = 'apprentice' | 'journeyman' | 'foreman' | 'industrialist' | 'magnate';
export const TIER_FLOOR: Record<Tier, number> = { apprentice: 0, journeyman: 1200, foreman: 1400, industrialist: 1600, magnate: 1800 };
export const tierOf = (rating: number): Tier => (rating >= 1800 ? 'magnate' : rating >= 1600 ? 'industrialist' : rating >= 1400 ? 'foreman' : rating >= 1200 ? 'journeyman' : 'apprentice');

/** where one stands this season */
export interface Rating {
  rating: number;
  tier: Tier;
  /** ranked games this season */
  games: number;
  won: number;
  /** placement games still to play before the cote is firm */
  placements: number;
  /** the last cotes, oldest first (the trend) */
  trend: number[];
}

export interface Season {
  id: string;
  /** "Exercice 1826 · T3" */
  name: string;
  endsAt: number;
}

export interface LeaderRow {
  id: string;
  name: string;
  color: PlayerColor | null;
  rating: number;
  tier: Tier;
  games: number;
  won: number;
  trend: number[];
}

export interface Leaderboard {
  season: Season;
  /** accounts ranked this season */
  players: number;
  rows: LeaderRow[];
  /** my own row and rank, when I am ranked */
  me: (LeaderRow & { rank: number }) | null;
}

/** one line of the week's board: an account's best attempt at the notice */
export interface ChallengeRow {
  id: string;
  name: string;
  color: PlayerColor | null;
  points: number;
  vp: number;
  /** the conditions, met or not, of the best attempt */
  met: boolean[];
  at: number;
}

/** the week's board, as the office keeps it */
export interface ChallengeBoard {
  week: number;
  /** accounts that attempted the notice */
  players: number;
  rows: ChallengeRow[];
  /** my own line and rank, when I attempted it */
  me: (ChallengeRow & { rank: number }) | null;
}

/** the queue I stand in */
export interface QueueState {
  mode: 'quick' | 'ranked';
  since: number;
  /** people in this queue, me included */
  waiting: number;
}

/** the counter's items: cosmetics paid in guineas earned at the tables */
export interface Purse {
  guineas: number;
  owned: string[];
}

/** the house at a glance */
export interface HallCounts {
  online: number;
  playing: number;
  queued: number;
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
  players: { id: string; name: string; color: PlayerColor; vp: number; bot: boolean; /** left the table before the end: a machine played the chair out */ resigned?: boolean; tally?: Tally }[];
  winner: number;
  /** the game ended by the table's own vote */
  abandoned: boolean;
  /** played at home against the machines: on the record, but out of the figures */
  home?: boolean;
}

/** a game played at home, as the register lists it — enough to show a line
 *  without replaying a single move */
export interface HomeTable {
  code: string;
  name: string;
  startedAt: number;
  updatedAt: number;
  era: Era;
  round: number;
  seats: { name: string; color: PlayerColor; kind: 'human' | 'bot' }[];
  /** played out: kept on the record, never resumed */
  over?: boolean;
}

/** a game at home as the office keeps it: the line of the register, the deal
 *  it was dealt from, and the log that replays it */
export interface HomeSave extends HomeTable {
  seed: number;
  setup: SetupPayload;
  actions: GameAction[];
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
  /** my cote this season (null before the first placement) */
  rating: Rating | null;
  season: Season;
  purse: Purse;
  hall: HallCounts;
  /** the queue I stand in, if any */
  queue: QueueState | null;
  /** the company I belong to, if any */
  company: Company | null;
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
    players: table.seats.map((s) => ({ name: s.name, color: s.color, type: s.kind, ...(s.kind === 'bot' ? { persona: personaFor(s) } : {}), ...(s.minutes !== undefined ? { minutes: s.minutes } : {}) })),
    options: table.options,
  };
}

export function canStart(table: Table): boolean {
  return table.status === 'open' && table.seats.length >= 2 && table.seats.every((s) => s.kind === 'bot' || s.ready);
}
