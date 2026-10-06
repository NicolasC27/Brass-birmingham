import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PlayerColor } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';
import type { Held } from '@/game/analysisMerge';
import type { ChallengeBoard, ChallengeRow, Company, CompanyBoard, CompanyRow, Edition, Friend, HomeSave, HomeTable, Paper, SeasonReview, Identity, Invitation, Leaderboard, LeaderRow, Me, PastGame, Purse, Rating, Season, Stats, Table } from '@/online/table';
import { COUNTER_BY_ID, FREE_ITEMS, GUINEAS } from '@/online/counter';
import { randomId } from '@/online/table';
import { emptyTally } from '@/game/tally';
import type { Tally } from '@/game/tally';
import { fresh, ratingOf, seasonAt, settle } from './rating';
import type { Standing } from './rating';
import { MEETINGS_CAP } from './watch';
import type { Flag } from './watch';

/** the first moment of a season id such as 2026-Q3 */
function seasonStart(id: string): number {
  const m = id.match(/^(\d{4})-Q([1-4])$/);
  return m ? Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1) : 0;
}

/* ------------------------------------------------------------------ */
/* The register — everything the house must not forget.                */
/*                                                                     */
/* Accounts and their sessions, the tables, and every game as what a   */
/* game really is: a seed and a list of moves. Nothing derived is kept */
/* on disk; a restart replays the moves and the board is back, which   */
/* is also the strongest check that the log and the engine agree.      */
/*                                                                     */
/* An account has an address. The letter that proves it, and the one   */
/* that lets a password be chosen again, are tokens with an hour to    */
/* live. Invitations are letters too: from one account to another,     */
/* about one table, answered once.                                     */
/*                                                                     */
/* The cote of every account, season by season, and its purse — the    */
/* guineas earned at the tables and what they bought — live here too,  */
/* written when a game is played out.                                  */
/*                                                                     */
/* SQLite comes with Node itself — no native build, no dependency.     */
/* ------------------------------------------------------------------ */

/** an idea or a bug in the suggestion box */
export interface Note {
  id: string;
  accountId: string;
  page: string;
  kind: 'idea' | 'bug';
  text: string;
  createdAt: number;
}

export interface Account extends Me {
  createdAt: number;
  /** when the charter was accepted at sign-up (null for accounts from before it) */
  acceptedAt: number | null;
  /** the member closed the account: it holds nothing of them any more */
  closedAt: number | null;
}

export interface StoredGame {
  code: string;
  seed: number;
  setup: SetupPayload;
  /** the account id of each seat, in player order */
  seatIds: string[];
  actions: GameAction[];
  finishedAt: number | null;
}

export type SignUpError = 'bad-name' | 'bad-email' | 'weak-password' | 'name-taken' | 'email-taken';
export type TokenKind = 'verify' | 'reset';

/** names are short, printable and unique once folded */
export const NAME_RULE = /^[\p{L}\p{N} ._'-]{2,20}$/u;
/** an address: something, an at, a dot somewhere after it */
export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;
/** how long the name and address of a closed account are kept aside: five years, as the law asks */
export const DEPARTED_MS = 5 * 365 * 24 * 60 * 60 * 1000;
/** passwords everybody tries first: refused whatever their length */
const COMMON_PASSWORDS = new Set(['password', 'password1', 'password123', 'motdepasse', 'passwort', 'contraseña', 'contrasena', '12345678', '123456789', '1234567890', 'qwertyuiop', 'azertyuiop', 'qwerty123', 'azerty123', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'trustno1', 'letmein1', 'welcome1', 'admin123', 'abcd1234', 'abc12345', '11111111', '00000000', 'birmingham', 'blackrail', 'brassworks', 'brass1234', 'wedgwood']);
export const MAX_MOTTO = 80;
/** a likeness travels as a data URL: 160 px square in WebP is ten to twenty thousand characters */
export const MAX_PORTRAIT = 64_000;
const PORTRAIT_DATA = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/;
/** a page of notes beside one game, and no more */
export const MAX_NOTES = 32_000;
/** a session lasts a month of silence */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
/** a letter is good for an hour */
export const TOKEN_MS = 60 * 60 * 1000;

const SCHEMA = `
create table if not exists accounts (
  id            text primary key,
  name          text not null,
  folded        text not null unique,
  secret        text not null,
  createdAt     integer not null,
  email         text,
  emailFolded   text unique,
  verifiedAt    integer,
  motto         text not null default '',
  favoriteColor text,
  /* opened by the office itself, so a first game has somewhere to be
     written: no address, no password, and a name until one is chosen */
  guest         integer not null default 0
);
create table if not exists departed (
  accountId text primary key,
  name      text not null,
  email     text,
  closedAt  integer not null
);
create table if not exists sessions (
  token     text primary key,
  accountId text not null references accounts(id) on delete cascade,
  createdAt integer not null,
  seenAt    integer not null
);
create table if not exists letters (
  token     text primary key,
  accountId text not null references accounts(id) on delete cascade,
  kind      text not null,
  createdAt integer not null
);
create table if not exists invitations (
  id         text primary key,
  code       text not null,
  fromId     text not null,
  toId       text not null,
  createdAt  integer not null,
  answeredAt integer
);
create table if not exists tables (
  code      text primary key,
  name      text not null,
  hostId    text not null,
  seats     text not null,
  options   text not null,
  status    text not null,
  createdAt integer not null,
  updatedAt integer not null
);
create table if not exists games (
  code       text primary key,
  seed       integer not null,
  setup      text not null,
  seats      text not null,
  startedAt  integer not null,
  finishedAt integer,
  result     text,
  /* a game played at home has no table of its own: it carries its name,
     the account that played it, and what the register needs to list it
     without replaying the log */
  home       integer not null default 0,
  name       text,
  ownerId    text,
  brief      text,
  updatedAt  integer
);
create table if not exists friends (
  id         text primary key,
  aId        text not null,
  bId        text not null,
  askedBy    text not null,
  createdAt  integer not null,
  acceptedAt integer,
  unique (aId, bId)
);
create table if not exists feedback (
  id        text primary key,
  accountId text not null,
  page      text not null,
  kind      text not null,
  text      text not null,
  createdAt integer not null
);
create table if not exists moves (
  code   text not null,
  idx    integer not null,
  action text not null,
  primary key (code, idx)
);
create table if not exists game_players (
  code      text not null,
  accountId text not null,
  primary key (code, accountId)
);
create table if not exists ratings (
  accountId text not null,
  season    text not null,
  rating    integer not null,
  games     integer not null,
  won       integer not null,
  trend     text not null,
  updatedAt integer not null,
  primary key (accountId, season)
);
create table if not exists flags (
  id        text primary key,
  accountId text not null,
  kind      text not null,
  detail    text not null,
  code      text,
  at        integer not null
);
create table if not exists analyses (
  code      text not null,
  seed      integer not null,
  judge     text not null,
  v         integer not null,
  body      text not null,
  updatedAt integer not null,
  primary key (code, seed, judge, v)
);
create table if not exists notes (
  accountId text not null,
  code      text not null,
  body      text not null,
  updatedAt integer not null,
  primary key (accountId, code)
);
create table if not exists purses (
  accountId text primary key,
  guineas   integer not null,
  owned     text not null
);
create table if not exists papers (
  accountId text not null,
  kind      text not null,
  body      text not null,
  updatedAt integer not null,
  primary key (accountId, kind)
);
create table if not exists mailings (
  key text primary key,
  at  integer not null
);
create table if not exists companies (
  id        text primary key,
  name      text not null,
  folded    text not null unique,
  founderId text not null,
  createdAt integer not null
);
create table if not exists challenges (
  accountId text not null,
  week      integer not null,
  id        text not null,
  points    integer not null,
  vp        integer not null,
  met       text not null,
  at        integer not null,
  primary key (accountId, week)
);
`;

/** columns added since the first register: an old file learns them on opening */
const GROWTH: [table: string, column: string, ddl: string][] = [
  ['accounts', 'companyId', 'text'],
  ['accounts', 'newsletter', 'integer not null default 0'],
  ['accounts', 'email', 'text'],
  ['accounts', 'emailFolded', 'text'],
  ['accounts', 'verifiedAt', 'integer'],
  ['accounts', 'motto', "text not null default ''"],
  ['accounts', 'favoriteColor', 'text'],
  ['accounts', 'createdIp', 'text'],
  ['accounts', 'portrait', 'text'],
  ['accounts', 'acceptedAt', 'integer'],
  ['accounts', 'closedAt', 'integer'],
  ['accounts', 'guest', 'integer not null default 0'],
  ['games', 'result', 'text'],
  ['games', 'home', 'integer not null default 0'],
  ['games', 'name', 'text'],
  ['games', 'ownerId', 'text'],
  ['games', 'brief', 'text'],
  ['games', 'updatedAt', 'integer'],
  ['tables', 'ranked', 'integer not null default 0'],
];

/** a name is one name whatever the case or the stray spaces around it */
const fold = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');
const foldEmail = (email: string): string => email.trim().toLowerCase();

const token = (): string => randomBytes(24).toString('hex');
/** a token as the register keeps it: its hash, so a copy of the register opens no session and resets no password */
const sealed = (t: string): string => createHash('sha256').update(t).digest('hex');

/** why a password will not do: too short, everybody's, or the member's own name or address */
export function weakPassword(password: string, name = '', email = ''): boolean {
  if (password.length < MIN_PASSWORD) return true;
  const flat = password.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (COMMON_PASSWORDS.has(flat) || /^(.)\1+$/.test(flat)) return true;
  const own: (readonly [string, number])[] = [[name, 4], ...name.split(/\s+/).map((w) => [w, 4] as const), [email.split('@')[0], 6]];
  return own.some(([x, least]) => {
    const part = x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    return part.length >= least && flat.includes(part);
  });
}

/** scrypt, salt and all, in one field */
function seal(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function matches(password: string, secret: string): boolean {
  const [saltHex, wantHex] = secret.split(':');
  if (!saltHex || !wantHex) return false;
  const want = Buffer.from(wantHex, 'hex');
  const got = scryptSync(password, Buffer.from(saltHex, 'hex'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

/* the same seal and the same check, off the event loop: a sign-in must not
   hold every table in the house still while the key is derived */
const derive = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

async function sealAsync(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt, 64)).toString('hex')}`;
}

async function matchesAsync(password: string, secret: string): Promise<boolean> {
  const [saltHex, wantHex] = secret.split(':');
  if (!saltHex || !wantHex) return false;
  const want = Buffer.from(wantHex, 'hex');
  const got = await derive(password, Buffer.from(saltHex, 'hex'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

interface AccountRow {
  id: string;
  name: string;
  createdAt: number;
  email: string | null;
  verifiedAt: number | null;
  motto: string;
  favoriteColor: string | null;
  portrait: string | null;
  acceptedAt: number | null;
  closedAt: number | null;
  newsletter: number | null;
  guest: number | null;
}

/** where an account was opened from, and whether the charter was accepted */
export interface Origin {
  ip?: string | null;
  accepted?: boolean;
}

const COLORS: PlayerColor[] = ['brass', 'oxblood', 'verdigris', 'steel'];
const ACCOUNT_COLUMNS = 'id, name, createdAt, email, verifiedAt, motto, favoriteColor, acceptedAt, closedAt, newsletter, portrait, guest';

function accountOf(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    email: r.email,
    verified: r.verifiedAt !== null,
    motto: r.motto ?? '',
    favoriteColor: COLORS.includes(r.favoriteColor as PlayerColor) ? (r.favoriteColor as PlayerColor) : null,
    portrait: typeof r.portrait === 'string' && r.portrait ? r.portrait : null,
    acceptedAt: r.acceptedAt,
    closedAt: r.closedAt,
    newsletter: r.newsletter === 1,
    guest: r.guest === 1,
  };
}

/** the game's outcome, kept with the game once it is over */
interface Result {
  players: { name: string; color: PlayerColor; vp: number; bot: boolean; resigned?: boolean; tally?: Tally }[];
  winner: number;
  abandoned: boolean;
}

/** what the register needs to list a game at home without replaying it */
export type Brief = Pick<HomeTable, 'era' | 'round' | 'seats'>;

/** a `games` row of a game played at home, as SQLite hands it over */
interface HomeRow {
  code: string;
  seed: number;
  setup: string;
  seats: string;
  startedAt: number;
  finishedAt: number | null;
  name: string | null;
  brief: string | null;
  updatedAt: number | null;
}

/** the line of the register a stored game carries — nothing when its brief
 *  will not parse: a row the register cannot describe, it does not list */
function briefOf(r: HomeRow): HomeTable | null {
  let brief: Brief | null = null;
  try {
    brief = JSON.parse(r.brief ?? 'null') as Brief | null;
  } catch {
    return null;
  }
  if (!brief || !Array.isArray(brief.seats)) return null;
  return {
    code: r.code,
    name: r.name ?? r.code,
    startedAt: r.startedAt,
    updatedAt: r.updatedAt ?? r.startedAt,
    era: brief.era,
    round: brief.round,
    seats: brief.seats,
    ...(r.finishedAt !== null ? { over: true } : {}),
  };
}

/** the standings as the record keeps them, read off the final position */
function resultOf(state: GameState, tallies?: Tally[]): Result {
  return {
    players: state.players.map((p, i) => ({ name: p.name, color: p.color as PlayerColor, vp: p.vp, bot: !!p.isBot && !p.resigned, ...(p.resigned ? { resigned: true } : {}), ...(tallies?.[i] ? { tally: tallies[i] } : {}) })),
    winner: state.winner ?? 0,
    abandoned: !!state.abandoned,
  };
}

export class Store {
  private db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('pragma journal_mode = wal');
    this.db.exec('pragma foreign_keys = on');
    this.db.exec(SCHEMA);
    this.grow();
  }

  /** an older register gets the columns it lacks */
  private grow(): void {
    for (const [table, column, ddl] of GROWTH) {
      const has = (this.db.prepare(`pragma table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
      if (!has) this.db.exec(`alter table ${table} add column ${column} ${ddl}`);
    }
    /* an address is one account's: a register grown from before the column
       had no such rule, and one that already holds a twin keeps it, logged */
    try {
      this.db.exec('create unique index if not exists accounts_email on accounts(emailFolded) where emailFolded is not null');
    } catch (e) {
      console.error('register: two accounts share an address, the rule waits:', (e as Error).message);
    }
    /* the forum is gone: a register that had one drops its tables, addresses and all */
    for (const table of ['forum_reports', 'forum_seen', 'forum_translations', 'forum_spent', 'forum_bans', 'forum_posts', 'forum_threads']) this.db.exec(`drop table if exists ${table}`);
    /* a register from before tokens were hashed: its sessions and letters are sealed in place */
    for (const table of ['sessions', 'letters']) {
      const plain = this.db.prepare(`select token from ${table} where length(token) = 48`).all() as { token: string }[];
      for (const { token: t } of plain) this.db.prepare(`update ${table} set token = ? where token = ?`).run(sealed(t), t);
    }
    /* the seats of every game, one row each, for the games before the ledger */
    this.db.exec('insert or ignore into game_players (code, accountId) select g.code, j.value from games g, json_each(g.seats) j where not exists (select 1 from game_players p where p.code = g.code)');
  }

  close(): void {
    this.db.close();
  }

  /* ---------------------------- accounts --------------------------- */

  /** the name, the address and the password as the office will have them, or why not */
  private application(name: string, email: string, password: string): { clean: string; address: string } | { error: SignUpError } {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!NAME_RULE.test(clean)) return { error: 'bad-name' };
    const address = email.trim();
    if (!EMAIL_RULE.test(address) || address.length > 120) return { error: 'bad-email' };
    if (weakPassword(password, clean, address)) return { error: 'weak-password' };
    if (this.db.prepare('select 1 from accounts where folded = ?').get(fold(clean))) return { error: 'name-taken' };
    if (this.db.prepare('select 1 from accounts where emailFolded = ?').get(foldEmail(address))) return { error: 'email-taken' };
    return { clean, address };
  }

  private enrol(clean: string, address: string, secret: string, from: Origin): { account: Account } | { error: SignUpError } {
    const id = 'a-' + randomBytes(8).toString('hex');
    const now = Date.now();
    try {
      this.db
        .prepare('insert into accounts (id, name, folded, secret, createdAt, email, emailFolded, verifiedAt, motto, favoriteColor, createdIp, acceptedAt) values (?, ?, ?, ?, ?, ?, ?, null, ?, null, ?, ?)')
        .run(id, clean, fold(clean), secret, now, address, foldEmail(address), '', from.ip ?? null, from.accepted ? now : null);
    } catch {
      /* two applications for one name, the other sealed first */
      return { error: this.db.prepare('select 1 from accounts where folded = ?').get(fold(clean)) ? 'name-taken' : 'email-taken' };
    }
    return { account: this.account(id)! };
  }

  /** an account the office opens by itself, so that a first game played at
   *  home has somewhere to be written. No address and no password: nobody
   *  signs in to it, the browser holds its session and that is all. It
   *  becomes a member the day its owner gives it a name and an address */
  enrolGuest(from: Origin = {}): Account {
    const id = 'a-' + randomBytes(8).toString('hex');
    const now = Date.now();
    /* a name of the same shape as anyone's, and free */
    let name = '';
    for (let tries = 0; tries < 20 && !name; tries++) {
      const tried = `Invité ${randomId(4)}`;
      if (!this.db.prepare('select 1 from accounts where folded = ?').get(fold(tried))) name = tried;
    }
    if (!name) name = `Invité ${randomBytes(4).toString('hex').toUpperCase()}`;
    this.db
      .prepare("insert into accounts (id, name, folded, secret, createdAt, email, emailFolded, verifiedAt, motto, favoriteColor, createdIp, acceptedAt, guest) values (?, ?, ?, ?, ?, null, null, null, '', null, ?, ?, 1)")
      .run(id, name, fold(name), seal(randomBytes(32).toString('hex')), now, from.ip ?? null, from.accepted ? now : null);
    return this.account(id)!;
  }

  /** a guest becomes a member: the same account, now with a name of its
   *  owner's choosing, an address and a password. Everything it played
   *  stays under it — the register only ever knew its id */
  promoteGuest(accountId: string, name: string, email: string, password: string, from: Origin = {}): { account: Account } | { error: SignUpError } {
    const row = this.db.prepare('select guest from accounts where id = ? and closedAt is null').get(accountId) as { guest: number | null } | undefined;
    if (!row || row.guest !== 1) return { error: 'name-taken' };
    const a = this.application(name, email, password);
    if ('error' in a) return a;
    const now = Date.now();
    try {
      this.db
        .prepare('update accounts set name = ?, folded = ?, secret = ?, email = ?, emailFolded = ?, verifiedAt = null, createdIp = coalesce(createdIp, ?), acceptedAt = coalesce(acceptedAt, ?), guest = 0 where id = ?')
        .run(a.clean, fold(a.clean), seal(password), a.address, foldEmail(a.address), from.ip ?? null, from.accepted ? now : null, accountId);
    } catch {
      return { error: this.db.prepare('select 1 from accounts where folded = ?').get(fold(a.clean)) ? 'name-taken' : 'email-taken' };
    }
    return { account: this.account(accountId)! };
  }

  /** guests that never played and have gone quiet: an account the office
   *  opened and nobody used is an account the office may forget */
  sweepGuests(olderThan = 30 * 24 * 60 * 60 * 1000, now = Date.now()): number {
    const stale = this.db
      .prepare('select id from accounts where guest = 1 and createdAt < ? and not exists (select 1 from game_players p where p.accountId = accounts.id)')
      .all(now - olderThan) as { id: string }[];
    for (const { id } of stale) {
      for (const table of ['sessions', 'letters', 'purses', 'papers', 'notes']) this.db.prepare(`delete from ${table} where accountId = ?`).run(id);
      this.db.prepare('delete from accounts where id = ?').run(id);
    }
    return stale.length;
  }

  /** open an account, or say why it cannot be opened */
  signUp(name: string, email: string, password: string, from: Origin = {}): { account: Account } | { error: SignUpError } {
    const a = this.application(name, email, password);
    return 'error' in a ? a : this.enrol(a.clean, a.address, seal(password), from);
  }

  /** the same, with the key derived off the event loop */
  async signUpAsync(name: string, email: string, password: string, from: Origin = {}): Promise<{ account: Account } | { error: SignUpError }> {
    const a = this.application(name, email, password);
    return 'error' in a ? a : this.enrol(a.clean, a.address, await sealAsync(password), from);
  }

  private credentials(name: string): (AccountRow & { secret: string }) | undefined {
    const key = name.trim();
    return this.db
      .prepare(`select ${ACCOUNT_COLUMNS}, secret from accounts where closedAt is null and (folded = ? or (emailFolded is not null and emailFolded = ?))`)
      .get(fold(key), foldEmail(key)) as (AccountRow & { secret: string }) | undefined;
  }

  /** the account behind a name (or an address) and a password, or null */
  signIn(name: string, password: string): Account | null {
    const row = this.credentials(name);
    if (!row || !matches(password, row.secret)) return null;
    return accountOf(row);
  }

  async signInAsync(name: string, password: string): Promise<Account | null> {
    const row = this.credentials(name);
    if (!row || !(await matchesAsync(password, row.secret))) return null;
    return accountOf(row);
  }

  account(id: string): Account | null {
    const row = this.db.prepare(`select ${ACCOUNT_COLUMNS} from accounts where id = ?`).get(id) as AccountRow | undefined;
    return row ? accountOf(row) : null;
  }

  /** who goes by this name (folded, so the case does not matter) */
  accountByName(name: string): Account | null {
    const row = this.db.prepare(`select ${ACCOUNT_COLUMNS} from accounts where folded = ?`).get(fold(name)) as AccountRow | undefined;
    return row ? accountOf(row) : null;
  }

  accountByEmail(email: string): Account | null {
    const row = this.db.prepare(`select ${ACCOUNT_COLUMNS} from accounts where emailFolded = ?`).get(foldEmail(email)) as AccountRow | undefined;
    return row ? accountOf(row) : null;
  }

  /** a new address, unverified until its letter is answered */
  setEmail(id: string, email: string): 'bad-email' | 'email-taken' | null {
    const address = email.trim();
    if (!EMAIL_RULE.test(address) || address.length > 120) return 'bad-email';
    const taken = this.db.prepare('select id from accounts where emailFolded = ?').get(foldEmail(address)) as { id: string } | undefined;
    if (taken && taken.id !== id) return 'email-taken';
    this.db.prepare('update accounts set email = ?, emailFolded = ?, verifiedAt = null where id = ?').run(address, foldEmail(address), id);
    return null;
  }

  /** the profile, within its margins */
  setProfile(id: string, patch: { motto?: string; favoriteColor?: PlayerColor | null; newsletter?: boolean; portrait?: string | null }): void {
    if (patch.newsletter !== undefined) this.db.prepare('update accounts set newsletter = ? where id = ?').run(patch.newsletter ? 1 : 0, id);
    /* the likeness: a small square picture as a data URL, or none; anything
       else — too large, not a picture — is not taken */
    if (patch.portrait !== undefined) {
      const ok = patch.portrait === null || (patch.portrait.length <= MAX_PORTRAIT && PORTRAIT_DATA.test(patch.portrait));
      if (ok) this.db.prepare('update accounts set portrait = ? where id = ?').run(patch.portrait, id);
    }
    if (patch.motto !== undefined) this.db.prepare('update accounts set motto = ? where id = ?').run(patch.motto.trim().slice(0, MAX_MOTTO), id);
    if (patch.favoriteColor !== undefined) this.db.prepare('update accounts set favoriteColor = ? where id = ?').run(patch.favoriteColor && COLORS.includes(patch.favoriteColor) ? patch.favoriteColor : null, id);
  }

  /** a new password, given the current one */
  changePassword(id: string, current: string, next: string): 'wrong-password' | 'weak-password' | null {
    const row = this.db.prepare('select secret from accounts where id = ?').get(id) as { secret: string } | undefined;
    if (!row || !matches(current, row.secret)) return 'wrong-password';
    const own = this.account(id);
    if (weakPassword(next, own?.name, own?.email ?? '')) return 'weak-password';
    this.db.prepare('update accounts set secret = ? where id = ?').run(seal(next), id);
    this.db.prepare('delete from sessions where accountId = ?').run(id);
    return null;
  }

  /* ---------------------------- letters ---------------------------- */

  /** a token for a letter; any earlier letter of the same kind is void */
  writeLetter(accountId: string, kind: TokenKind): string {
    this.db.prepare('delete from letters where accountId = ? and kind = ?').run(accountId, kind);
    const t = token();
    this.db.prepare('insert into letters (token, accountId, kind, createdAt) values (?, ?, ?, ?)').run(sealed(t), accountId, kind, Date.now());
    return t;
  }

  /** the account a letter was written to — the letter is spent */
  openLetter(t: string, kind: TokenKind): Account | null {
    const row = this.db.prepare('select accountId, createdAt from letters where token = ? and kind = ?').get(sealed(t), kind) as { accountId: string; createdAt: number } | undefined;
    if (!row) return null;
    this.db.prepare('delete from letters where token = ?').run(sealed(t));
    if (Date.now() - row.createdAt > TOKEN_MS) return null;
    return this.account(row.accountId);
  }

  /** the address answered: the tables are open */
  verify(t: string): Account | null {
    const account = this.openLetter(t, 'verify');
    if (!account) return null;
    this.db.prepare('update accounts set verifiedAt = ? where id = ?').run(Date.now(), account.id);
    return this.account(account.id);
  }

  /** a password chosen again through a letter; every session is closed */
  resetPassword(t: string, password: string): Account | null | 'weak-password' {
    if (password.length < MIN_PASSWORD) return 'weak-password';
    const account = this.openLetter(t, 'reset');
    if (!account) return null;
    if (weakPassword(password, account.name, account.email ?? '')) return 'weak-password';
    this.db.prepare('update accounts set secret = ? where id = ?').run(seal(password), account.id);
    this.db.prepare('delete from sessions where accountId = ?').run(account.id);
    return account;
  }

  /* ---------------------------- sessions --------------------------- */

  /** a token that stands for this account until it is forgotten */
  openSession(accountId: string): string {
    const t = token();
    const now = Date.now();
    this.db.prepare('insert into sessions (token, accountId, createdAt, seenAt) values (?, ?, ?, ?)').run(sealed(t), accountId, now, now);
    return t;
  }

  /** whose token this is — and it stays alive by being used */
  session(t: string): Account | null {
    const row = this.db.prepare('select accountId, seenAt from sessions where token = ?').get(sealed(t)) as { accountId: string; seenAt: number } | undefined;
    if (!row) return null;
    if (Date.now() - row.seenAt > SESSION_MS) {
      this.closeSession(t);
      return null;
    }
    this.db.prepare('update sessions set seenAt = ? where token = ?').run(Date.now(), sealed(t));
    const account = this.account(row.accountId);
    return account && !account.closedAt ? account : null;
  }

  closeSession(t: string): void {
    this.db.prepare('delete from sessions where token = ?').run(sealed(t));
  }

  /** the sessions this account holds: when each was opened and last used */
  sessionsOf(accountId: string): { createdAt: number; seenAt: number }[] {
    return this.db.prepare('select createdAt, seenAt from sessions where accountId = ? order by seenAt desc').all(accountId) as { createdAt: number; seenAt: number }[];
  }

  /* --------------------------- the member's data --------------------------- */

  /** everything the register holds under this account, for the member to take away */
  exportOf(accountId: string): Record<string, unknown> | null {
    const a = this.db.prepare('select id, name, email, createdAt, verifiedAt, motto, favoriteColor, acceptedAt, createdIp from accounts where id = ?').get(accountId) as Record<string, unknown> | undefined;
    if (!a) return null;
    const rows = (sql: string) => this.db.prepare(sql).all(accountId);
    return {
      exportedAt: new Date().toISOString(),
      account: a,
      sessions: this.sessionsOf(accountId),
      friends: rows('select f.createdAt, f.acceptedAt, a.name from friends f join accounts a on a.id = (case when f.aId = ?1 then f.bId else f.aId end) where f.aId = ?1 or f.bId = ?1'),
      feedback: rows('select page, kind, text, createdAt from feedback where accountId = ?'),
      games: rows('select g.code, g.name, g.home, g.startedAt, g.finishedAt, g.result from games g join game_players p on p.code = g.code where p.accountId = ?1'),
      ratings: rows('select season, rating, games, won, updatedAt from ratings where accountId = ?'),
      purse: this.db.prepare('select guineas, owned from purses where accountId = ?').get(accountId) ?? null,
      papers: rows('select kind, body, updatedAt from papers where accountId = ?'),
      notes: rows('select code, body, updatedAt from notes where accountId = ?'),
      flags: rows('select kind, detail, code, at from flags where accountId = ?'),
    };
  }

  /** the account is closed and what identifies the member is erased: the name
   *  becomes a number, the address and the password go, every session, letter,
   *  friendship, invitation and note goes with them. The games stay under the
   *  number, so the other players' records still read. The name and address are
   *  kept aside, apart from everything, for as long as the law asks of a host. */
  closeAccount(accountId: string, password: string): 'wrong-password' | 'not-found' | null {
    const row = this.db.prepare('select name, email, secret from accounts where id = ? and closedAt is null').get(accountId) as { name: string; email: string | null; secret: string } | undefined;
    if (!row) return 'not-found';
    if (!matches(password, row.secret)) return 'wrong-password';
    const now = Date.now();
    const gone = `Membre ${accountId.slice(2, 8)}`;
    this.db.exec('begin');
    try {
      this.db.prepare('insert or replace into departed (accountId, name, email, closedAt) values (?, ?, ?, ?)').run(accountId, row.name, row.email, now);
      this.db
        .prepare("update accounts set name = ?, folded = ?, email = null, emailFolded = null, secret = ?, motto = '', favoriteColor = null, portrait = null, createdIp = null, closedAt = ? where id = ?")
        .run(gone, fold(gone), seal(randomBytes(32).toString('hex')), now, accountId);
      for (const table of ['sessions', 'letters', 'feedback', 'purses', 'papers', 'notes']) {
        try {
          this.db.prepare(`delete from ${table} where accountId = ?`).run(accountId);
        } catch {
          /* a table this register does not have */
        }
      }
      /* the games at the tables stay under the number, so the other players'
         records still read; the games played at home were nobody else's and
         go with their papers */
      for (const { code } of this.db.prepare('select code from games where home = 1 and ownerId = ?').all(accountId) as { code: string }[]) {
        this.db.prepare('delete from games where code = ?').run(code);
        this.db.prepare('delete from moves where code = ?').run(code);
        this.db.prepare('delete from game_players where code = ?').run(code);
        this.db.prepare('delete from analyses where code = ?').run(code);
      }
      this.db.prepare('delete from friends where aId = ? or bId = ?').run(accountId, accountId);
      this.db.prepare('delete from invitations where fromId = ? or toId = ?').run(accountId, accountId);
      this.db.exec('commit');
    } catch (e) {
      this.db.exec('rollback');
      throw e;
    }
    return null;
  }

  /** what the law lets go, let go: the names kept aside longer than five
   *  years, the sessions and letters long dead */
  sweepPrivacy(now = Date.now()): void {
    this.db.prepare('delete from departed where closedAt < ?').run(now - DEPARTED_MS);
    this.db.prepare('delete from sessions where seenAt < ?').run(now - SESSION_MS);
    this.db.prepare('delete from letters where createdAt < ?').run(now - TOKEN_MS);
  }

  /* -------------------------- invitations -------------------------- */

  invite(code: string, from: Identity, to: Identity): Invitation {
    const id = 'i-' + randomBytes(6).toString('hex');
    const now = Date.now();
    this.db.prepare('insert into invitations (id, code, fromId, toId, createdAt, answeredAt) values (?, ?, ?, ?, ?, null)').run(id, code, from.id, to.id, now);
    return { id, code, tableName: this.tableName(code), from, to, createdAt: now };
  }

  /** an unanswered invitation from one account to another, about one table */
  pendingInvitation(code: string, toId: string): Invitation | null {
    const row = this.db.prepare('select id from invitations where code = ? and toId = ? and answeredAt is null').get(code, toId) as { id: string } | undefined;
    return row ? this.invitation(row.id) : null;
  }

  invitation(id: string): Invitation | null {
    const row = this.db.prepare('select id, code, fromId, toId, createdAt from invitations where id = ? and answeredAt is null').get(id) as
      | { id: string; code: string; fromId: string; toId: string; createdAt: number }
      | undefined;
    if (!row) return null;
    const from = this.account(row.fromId);
    const to = this.account(row.toId);
    if (!from || !to) return null;
    return { id: row.id, code: row.code, tableName: this.tableName(row.code), from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name }, createdAt: row.createdAt };
  }

  /** the letter is answered, whichever way */
  answerInvitation(id: string): void {
    this.db.prepare('update invitations set answeredAt = ? where id = ?').run(Date.now(), id);
  }

  /** the table is gone or full: its letters are void */
  voidInvitations(code: string): string[] {
    const rows = this.db.prepare('select toId, fromId from invitations where code = ? and answeredAt is null').all(code) as { toId: string; fromId: string }[];
    this.db.prepare('update invitations set answeredAt = ? where code = ? and answeredAt is null').run(Date.now(), code);
    return [...new Set(rows.flatMap((r) => [r.toId, r.fromId]))];
  }

  /** letters waiting on this account's desk, and the ones it sent */
  invitationsFor(accountId: string): { received: Invitation[]; sent: Invitation[] } {
    const ids = (dir: 'toId' | 'fromId') => (this.db.prepare(`select id from invitations where ${dir} = ? and answeredAt is null order by createdAt desc`).all(accountId) as { id: string }[]).map((r) => r.id);
    const load = (list: string[]) => list.map((id) => this.invitation(id)).filter((i): i is Invitation => !!i);
    return { received: load(ids('toId')), sent: load(ids('fromId')) };
  }

  private tableName(code: string): string {
    const row = this.db.prepare('select name from tables where code = ?').get(code) as { name: string } | undefined;
    return row?.name ?? code;
  }

  /* ----------------------------- friends --------------------------- */

  /** ask to be friends — or, if they asked first, accept; null when done, else why not */
  befriend(fromId: string, toId: string): 'yourself' | 'already-friends' | null {
    if (fromId === toId) return 'yourself';
    const [a, b] = [fromId, toId].sort();
    const row = this.db.prepare('select id, askedBy, acceptedAt from friends where aId = ? and bId = ?').get(a, b) as { id: string; askedBy: string; acceptedAt: number | null } | undefined;
    if (row?.acceptedAt) return 'already-friends';
    if (row) {
      /* they asked me: asking back is accepting */
      if (row.askedBy !== fromId) this.db.prepare('update friends set acceptedAt = ? where id = ?').run(Date.now(), row.id);
      return null;
    }
    this.db.prepare('insert into friends (id, aId, bId, askedBy, createdAt, acceptedAt) values (?, ?, ?, ?, ?, null)').run('fr-' + randomBytes(6).toString('hex'), a, b, fromId, Date.now());
    return null;
  }

  /** the friendship (or the asking) is over — only one of the two may end it */
  unfriend(id: string, byId: string): boolean {
    const r = this.db.prepare('delete from friends where id = ? and (aId = ? or bId = ?)').run(id, byId, byId);
    return r.changes > 0;
  }

  friendsOf(accountId: string): Friend[] {
    const rows = this.db.prepare('select id, aId, bId, askedBy, acceptedAt from friends where aId = ? or bId = ? order by createdAt desc').all(accountId, accountId) as { id: string; aId: string; bId: string; askedBy: string; acceptedAt: number | null }[];
    const out: Friend[] = [];
    for (const r of rows) {
      const other = this.account(r.aId === accountId ? r.bId : r.aId);
      if (!other) continue;
      out.push({ id: r.id, account: { id: other.id, name: other.name }, status: r.acceptedAt ? 'friends' : r.askedBy === accountId ? 'asked' : 'asks', online: false });
    }
    return out;
  }

  /** the ids of everyone this account is friends with, or asked, or was asked by */
  friendIds(accountId: string): string[] {
    return this.friendsOf(accountId).map((f) => f.account.id);
  }

  /* ---------------------------- feedback --------------------------- */

  /** an idea or a bug, as a player wrote it */
  feedback(accountId: string, page: string, kind: string, text: string): Note {
    const note: Note = { id: 'f-' + randomBytes(6).toString('hex'), accountId, page: page.slice(0, 120), kind: kind === 'bug' ? 'bug' : 'idea', text: text.trim().slice(0, 4000), createdAt: Date.now() };
    this.db.prepare('insert into feedback (id, accountId, page, kind, text, createdAt) values (?, ?, ?, ?, ?, ?)').run(note.id, note.accountId, note.page, note.kind, note.text, note.createdAt);
    return note;
  }

  /** how many notes this account has posted since `since` */
  feedbackSince(accountId: string, since: number): number {
    return (this.db.prepare('select count(*) as n from feedback where accountId = ? and createdAt >= ?').get(accountId, since) as { n: number }).n;
  }

  /** the whole suggestion box, newest first, each note with its author's name */
  feedbackList(): (Note & { name: string })[] {
    return this.db
      .prepare('select f.id, f.accountId, f.page, f.kind, f.text, f.createdAt, a.name from feedback f join accounts a on a.id = f.accountId order by f.createdAt desc')
      .all() as unknown as (Note & { name: string })[];
  }

  /* ----------------------------- tables ---------------------------- */

  saveTable(t: Table): void {
    this.db
      .prepare('insert or replace into tables (code, name, hostId, seats, options, status, createdAt, updatedAt, ranked) values (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(t.code, t.name, t.hostId, JSON.stringify(t.seats), JSON.stringify(t.options), t.status, t.createdAt, t.updatedAt, t.ranked ? 1 : 0);
  }

  /** the table is gone; a game played out at it stays on the record */
  dropTable(code: string): void {
    if (!this.gameFinished(code)) {
      this.db.prepare('delete from moves where code = ?').run(code);
      this.db.prepare('delete from game_players where code = ?').run(code);
      this.db.prepare('delete from games where code = ?').run(code);
    }
    this.db.prepare('delete from invitations where code = ?').run(code);
    this.db.prepare('delete from tables where code = ?').run(code);
    if (!this.gameFinished(code)) this.dropAnalyses(code);
  }

  tables(): Table[] {
    const rows = this.db.prepare('select * from tables').all() as {
      code: string;
      name: string;
      hostId: string;
      seats: string;
      options: string;
      status: string;
      createdAt: number;
      updatedAt: number;
      ranked: number;
    }[];
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      hostId: r.hostId,
      seats: JSON.parse(r.seats) as Table['seats'],
      options: JSON.parse(r.options) as Table['options'],
      status: r.status === 'starting' ? 'starting' : 'open',
      ...(r.ranked ? { ranked: true } : {}),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /* ------------------------------ games ---------------------------- */

  /** a game begins at this table — false when one was already played out here */
  openGame(code: string, seed: number, setup: SetupPayload, seatIds: string[]): boolean {
    if (this.gameFinished(code)) return false;
    this.db
      .prepare('insert or replace into games (code, seed, setup, seats, startedAt, finishedAt, result) values (?, ?, ?, ?, ?, null, null)')
      .run(code, seed, JSON.stringify(setup), JSON.stringify(seatIds), Date.now());
    this.db.prepare('delete from moves where code = ?').run(code);
    this.db.prepare('delete from game_players where code = ?').run(code);
    this.dropAnalyses(code);
    const seat = this.db.prepare('insert or ignore into game_players (code, accountId) values (?, ?)');
    for (const id of seatIds) seat.run(code, id);
    return true;
  }

  /** a game was played out at this table */
  gameFinished(code: string): boolean {
    const row = this.db.prepare('select finishedAt from games where code = ?').get(code) as { finishedAt: number | null } | undefined;
    return !!row && row.finishedAt !== null;
  }

  /** one accepted action, at its place in the log */
  appendMove(code: string, idx: number, action: GameAction): void {
    this.db.prepare('insert or replace into moves (code, idx, action) values (?, ?, ?)').run(code, idx, JSON.stringify(action));
  }

  /** an action taken back */
  dropMove(code: string, idx: number): void {
    this.db.prepare('delete from moves where code = ? and idx >= ?').run(code, idx);
  }

  /** the game is over: the standings go on the record, the humans are
   *  paid, and at a ranked table their cotes move */
  finishGame(code: string, state?: GameState, tallies?: Tally[], ranked = false): void {
    const result: Result | null = state ? resultOf(state, tallies) : null;
    this.db.prepare('update games set finishedAt = ?, result = ? where code = ?').run(Date.now(), result ? JSON.stringify(result) : null, code);
    /* a game the table voted away pays nothing and moves no cote */
    if (!state || state.abandoned) return;
    const row = this.db.prepare('select seats from games where code = ?').get(code) as { seats: string } | undefined;
    if (!row) return;
    const seatIds = JSON.parse(row.seats) as string[];
    const winner = state.winner ?? 0;
    const times = ranked ? GUINEAS.rankedTimes : 1;
    /* the seats that stayed to the end are paid; a chair left to a machine
       earns nothing, but at a ranked table its result is still its account's */
    const stayed = state.players.map((_, i) => i).filter((i) => !state.players[i].isBot && !!seatIds[i]);
    for (const i of stayed) this.earn(seatIds[i], (GUINEAS.sitting + (i === winner ? GUINEAS.win : 0)) * times);
    const humans = state.players.map((_, i) => i).filter((i) => (!state.players[i].isBot || state.players[i].resigned) && !!seatIds[i]);
    if (!ranked || humans.length < 2) return;
    const season = seasonAt();
    const before = humans.map((i) => this.standing(seatIds[i], season.id) ?? fresh());
    /* two accounts that keep meeting stop weighing on each other: past the
       cap their games move neither cote, and the pair is noted once */
    const met = humans.map((i) => humans.map((j) => (i === j ? 0 : this.meetings(seatIds[i], seatIds[j], season.id, code))));
    humans.forEach((i, a) => humans.forEach((j, b) => {
      if (a < b && met[a][b] === MEETINGS_CAP) for (const id of [seatIds[i], seatIds[j]]) this.flag(id, 'meetings', `${MEETINGS_CAP} ranked games against ${id === seatIds[i] ? seatIds[j] : seatIds[i]} this season; the next move no cote`, code);
    }));
    const after = settle(before, humans.map((i) => state.players[i].vp), humans.indexOf(winner), (a, b) => met[a][b] < MEETINGS_CAP);
    humans.forEach((i, k) => this.saveStanding(seatIds[i], season.id, after[k]));
  }

  /** ranked games this season, before `code`, where both accounts sat */
  meetings(a: string, b: string, seasonId: string, code: string): number {
    const from = seasonStart(seasonId);
    const row = this.db
      .prepare(
        'select count(*) as n from games g join tables t on t.code = g.code where t.ranked = 1 and g.finishedAt is not null and g.finishedAt >= ? and g.code <> ? and exists (select 1 from game_players p where p.code = g.code and p.accountId = ?) and exists (select 1 from game_players p where p.code = g.code and p.accountId = ?)',
      )
      .get(from, code, a, b) as { n: number };
    return row.n;
  }

  /* ---------------------------- games at home ---------------------------- */
  /* A game against the machines is a game like any other: a seed and a log,  */
  /* kept under the account that played it. It has no table of its own, so it */
  /* carries its own name and a brief — era, round, seats — the register      */
  /* lists without replaying a move. The brief is the only thing derived kept */
  /* on disk, and the log remains what decides.                               */

  /** a code no game holds yet */
  private freeGameCode(): string {
    let code = randomId(4);
    while (this.db.prepare('select 1 from games where code = ?').get(code)) code = randomId(4);
    return code;
  }

  /** a game begins at home: its line, its deal, and the account it belongs to */
  openHomeGame(ownerId: string, name: string, seed: number, setup: SetupPayload, brief: Brief): HomeTable {
    const code = this.freeGameCode();
    const now = Date.now();
    /* a chair a person sits in is the owner's, whoever their name says they
       are — several people round one screen still play under one account */
    const seatIds = brief.seats.map((s, i) => (s.kind === 'human' ? ownerId : `bot-${i}`));
    this.db
      .prepare('insert into games (code, seed, setup, seats, startedAt, finishedAt, result, home, name, ownerId, brief, updatedAt) values (?, ?, ?, ?, ?, null, null, 1, ?, ?, ?, ?)')
      .run(code, seed, JSON.stringify(setup), JSON.stringify(seatIds), now, name, ownerId, JSON.stringify(brief), now);
    this.db.prepare('insert or ignore into game_players (code, accountId) values (?, ?)').run(code, ownerId);
    return { code, name, startedAt: now, updatedAt: now, ...brief };
  }

  /** this account's game at that code, or nothing — another account's game is
   *  nothing to it */
  private homeRow(ownerId: string, code: string): HomeRow | null {
    const row = this.db.prepare('select * from games where code = ? and home = 1 and ownerId = ?').get(code, ownerId) as HomeRow | undefined;
    return row ?? null;
  }

  /** one accepted action of a game at home, and the brief it leaves behind */
  appendHomeMove(ownerId: string, code: string, idx: number, action: GameAction, brief: Brief): boolean {
    if (!this.homeRow(ownerId, code)) return false;
    this.appendMove(code, idx, action);
    this.db.prepare('update games set brief = ?, updatedAt = ? where code = ?').run(JSON.stringify(brief), Date.now(), code);
    return true;
  }

  /** a move taken back at home, and everything after it */
  dropHomeMoves(ownerId: string, code: string, idx: number, brief: Brief): boolean {
    if (!this.homeRow(ownerId, code)) return false;
    this.dropMove(code, idx);
    this.db.prepare('update games set brief = ?, updatedAt = ? where code = ?').run(JSON.stringify(brief), Date.now(), code);
    return true;
  }

  /** a game at home played out: the standings go on the record. Nothing is
   *  paid and no cote moves — the machines are not an opponent one earns
   *  against */
  finishHomeGame(ownerId: string, code: string, state: GameState, tallies?: Tally[]): void {
    if (!this.homeRow(ownerId, code)) return;
    this.db.prepare('update games set finishedAt = ?, result = ?, updatedAt = ? where code = ?').run(Date.now(), JSON.stringify(resultOf(state, tallies)), Date.now(), code);
  }

  /** this account's games at home, the last touched first */
  homeGames(ownerId: string): HomeTable[] {
    const rows = this.db.prepare('select * from games where home = 1 and ownerId = ? order by coalesce(updatedAt, startedAt) desc').all(ownerId) as unknown as HomeRow[];
    return rows.map((r) => briefOf(r)).filter((t): t is HomeTable => t !== null);
  }

  /** one game at home, whole: its line, its deal and its log */
  homeSave(ownerId: string, code: string): HomeSave | null {
    const row = this.homeRow(ownerId, code);
    const line = row && briefOf(row);
    if (!row || !line) return null;
    return {
      ...line,
      seed: row.seed,
      setup: JSON.parse(row.setup) as SetupPayload,
      actions: (this.db.prepare('select action from moves where code = ? order by idx').all(code) as { action: string }[]).map((m) => JSON.parse(m.action) as GameAction),
    };
  }

  /** a game at home put away for good */
  forgetHomeGame(ownerId: string, code: string): void {
    if (!this.homeRow(ownerId, code)) return;
    this.db.prepare('delete from games where code = ?').run(code);
    this.db.prepare('delete from moves where code = ?').run(code);
    this.db.prepare('delete from game_players where code = ?').run(code);
    this.db.prepare('delete from notes where code = ?').run(code);
    this.dropAnalyses(code);
  }

  /* -------------------------- marks and notes --------------------------- */
  /* What a reader wrote beside a game of theirs: the towns they pinned and  */
  /* the page they kept. One row an account and a game, so two people at one */
  /* table never read each other's notes.                                    */

  /** the notes this account keeps beside that game, as they wrote them */
  notes(accountId: string, code: string): unknown {
    const row = this.db.prepare('select body from notes where accountId = ? and code = ?').get(accountId, code) as { body: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.body) as unknown;
    } catch {
      return null;
    }
  }

  /** the notes as they now stand — false when they are more than a page */
  putNotes(accountId: string, code: string, body: unknown): boolean {
    const text = JSON.stringify(body ?? null);
    if (text.length > MAX_NOTES) return false;
    this.db
      .prepare('insert into notes (accountId, code, body, updatedAt) values (?, ?, ?, ?) on conflict (accountId, code) do update set body = excluded.body, updatedAt = excluded.updatedAt')
      .run(accountId, code, text, Date.now());
    return true;
  }

  /* ------------------------------- the watch ------------------------------ */

  /** a mark against an account: what the watch saw, where */
  flag(accountId: string, kind: Flag['kind'], detail: string, code: string | null = null): Flag {
    const f: Flag = { id: 'f-' + randomBytes(6).toString('hex'), accountId, kind, detail, code, at: Date.now() };
    this.db.prepare('insert into flags (id, accountId, kind, detail, code, at) values (?, ?, ?, ?, ?, ?)').run(f.id, f.accountId, f.kind, f.detail, f.code, f.at);
    return f;
  }

  /** every mark, newest first, with the account's name */
  flags(): (Flag & { name: string })[] {
    return this.db.prepare('select f.*, a.name from flags f left join accounts a on a.id = f.accountId order by f.at desc').all() as unknown as (Flag & { name: string })[];
  }

  /** the games of the tables — a game played at home belongs to no table and
   *  the hall has nothing to reopen for it */
  games(): StoredGame[] {
    const rows = this.db.prepare('select * from games where home = 0').all() as {
      code: string;
      seed: number;
      setup: string;
      seats: string;
      finishedAt: number | null;
    }[];
    return rows.map((r) => ({
      code: r.code,
      seed: r.seed,
      setup: JSON.parse(r.setup) as SetupPayload,
      seatIds: JSON.parse(r.seats) as string[],
      finishedAt: r.finishedAt,
      actions: (this.db.prepare('select action from moves where code = ? order by idx').all(r.code) as { action: string }[]).map((m) => JSON.parse(m.action) as GameAction),
    }));
  }

  /* ---------------------------- readings --------------------------- */

  /** the reading kept of this table's game, under this judge and this
   *  version of the analysis — another judge, or another version, is another
   *  reading and never mixes with this one */
  analysis(code: string, seed: number, judge: string, v: number): Held | null {
    const row = this.db.prepare('select body from analyses where code = ? and seed = ? and judge = ? and v = ?').get(code, seed, judge, v) as { body: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.body) as Held;
    } catch {
      return null;
    }
  }

  /** the reading as it now stands, over the last */
  saveAnalysis(code: string, seed: number, judge: string, v: number, held: Held): void {
    this.db.prepare('insert or replace into analyses (code, seed, judge, v, body, updatedAt) values (?, ?, ?, ?, ?, ?)').run(code, seed, judge, v, JSON.stringify(held), Date.now());
  }

  /** the readings of a table, thrown away — a fresh game at the same code */
  dropAnalyses(code: string): void {
    this.db.prepare('delete from analyses where code = ?').run(code);
  }

  /** readings nobody has come back to in a long while */
  sweepAnalyses(olderThan: number, now = Date.now()): void {
    this.db.prepare('delete from analyses where updatedAt < ?').run(now - olderThan);
  }

  /** what a part of a reading is measured against: the deal, the length of
   *  the game and the seats at it — a game the office no longer plays but
   *  still has on the record is read all the same */
  gameFacts(code: string): { seed: number; moves: number; seats: number } | null {
    const row = this.db.prepare('select seed, seats from games where code = ?').get(code) as { seed: number; seats: string } | undefined;
    if (!row) return null;
    const moves = (this.db.prepare('select count(*) as n from moves where code = ?').get(code) as { n: number }).n;
    let seats = 0;
    try {
      seats = (JSON.parse(row.seats) as string[]).length;
    } catch {
      return null;
    }
    return { seed: row.seed, moves, seats };
  }

  /** the finished games this account sat at, newest first */
  historyFor(accountId: string, limit = 20): PastGame[] {
    const rows = this.db
      .prepare(
        'select g.code, g.seats, g.finishedAt, g.result, g.home, coalesce(t.name, g.name) as name from games g left join tables t on t.code = g.code where g.finishedAt is not null and g.result is not null and g.code in (select code from game_players where accountId = ?) order by g.finishedAt desc, g.rowid desc limit ?',
      )
      .all(accountId, limit) as { code: string; seats: string; finishedAt: number; result: string; name: string | null; home: number }[];
    return rows.map((r) => {
      const seatIds = JSON.parse(r.seats) as string[];
      const result = JSON.parse(r.result) as Result;
      return {
        code: r.code,
        name: r.name ?? r.code,
        finishedAt: r.finishedAt,
        players: result.players.map((p, i) => ({ id: seatIds[i] ?? '', ...p })),
        winner: result.winner,
        abandoned: result.abandoned,
        ...(r.home ? { home: true } : {}),
      };
    });
  }

  statsFor(accountId: string): Stats {
    /* the figures are of the tables: a game against the machines is on the
       record, and out of them — it would flatter every average it touched */
    const games = this.historyFor(accountId, 10_000).filter((g) => !g.home);
    /* a game the table voted away was never played out: it counts for nothing */
    const mine = games.filter((g) => !g.abandoned).map((g) => ({ vp: g.players[g.players.findIndex((p) => p.id === accountId)]?.vp ?? 0, won: g.players[g.winner]?.id === accountId }));
    const played = mine.length;
    /* the sum of every tally on record, the place at each table, the
       chair taken, and the record against every other person met */
    const tally = emptyTally();
    let tallied = 0;
    const places: number[] = [];
    const colours = new Map<PlayerColor, number>();
    const rivals = new Map<string, Stats['rivals'][number]>();
    for (const g of games) {
      const me = g.players.find((p) => p.id === accountId);
      if (!me) continue;
      colours.set(me.color, (colours.get(me.color) ?? 0) + 1);
      if (me.tally) {
        tallied += 1;
        for (const k of ['built', 'links', 'sold', 'developed', 'loans', 'scouts', 'flipped', 'money', 'income'] as const) tally[k] += me.tally[k];
        for (const [ind, n] of Object.entries(me.tally.industries)) tally.industries[ind as keyof Tally['industries']] = (tally.industries[ind as keyof Tally['industries']] ?? 0) + (n ?? 0);
        for (const [town, n] of Object.entries(me.tally.towns)) tally.towns[town] = (tally.towns[town] ?? 0) + n;
      }
      if (g.abandoned) continue;
      places.push(1 + g.players.filter((p) => p.vp > me.vp).length);
      for (const p of g.players) {
        if (p.bot || p.id === accountId || !p.id) continue;
        const r = rivals.get(p.id) ?? { id: p.id, name: p.name, played: 0, won: 0, lost: 0 };
        r.played += 1;
        if (me.vp > p.vp) r.won += 1;
        else if (me.vp < p.vp) r.lost += 1;
        rivals.set(p.id, r);
      }
    }
    const colour = [...colours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      played,
      won: mine.filter((m) => m.won).length,
      averageVp: played ? Math.round(mine.reduce((a, m) => a + m.vp, 0) / played) : 0,
      bestVp: mine.reduce((a, m) => Math.max(a, m.vp), 0),
      averagePlace: places.length ? Math.round((places.reduce((a, b) => a + b, 0) / places.length) * 10) / 10 : 0,
      tallied,
      tally: tallied ? tally : null,
      colour,
      rivals: [...rivals.values()].sort((a, b) => b.played - a.played || a.name.localeCompare(b.name)).slice(0, 8),
    };
  }

  /* ----------------------------- the cote -------------------------- */

  /** where this account stands in a season, or null before its first ranked game */
  standing(accountId: string, season: string): Standing | null {
    const row = this.db.prepare('select rating, games, won, trend from ratings where accountId = ? and season = ?').get(accountId, season) as { rating: number; games: number; won: number; trend: string } | undefined;
    return row ? { rating: row.rating, games: row.games, won: row.won, trend: JSON.parse(row.trend) as number[] } : null;
  }

  saveStanding(accountId: string, season: string, s: Standing): void {
    this.db
      .prepare('insert or replace into ratings (accountId, season, rating, games, won, trend, updatedAt) values (?, ?, ?, ?, ?, ?, ?)')
      .run(accountId, season, s.rating, s.games, s.won, JSON.stringify(s.trend), Date.now());
  }

  ratingFor(accountId: string, season: string): Rating | null {
    const s = this.standing(accountId, season);
    return s ? ratingOf(s) : null;
  }

  /** the season's board: every account with a ranked game, best cote first,
   *  the top fifty listed and my own place among them */
  leaderboard(season: Season, meId: string, limit = 50): Leaderboard {
    const rows = this.db
      .prepare(
        'select r.accountId as id, a.name, a.favoriteColor as color, r.rating, r.games, r.won, r.trend from ratings r join accounts a on a.id = r.accountId where r.season = ? and r.games >= 1 and a.verifiedAt is not null order by r.rating desc, r.games desc, a.name collate nocase',
      )
      .all(season.id) as { id: string; name: string; color: string | null; rating: number; games: number; won: number; trend: string }[];
    const all: LeaderRow[] = rows.map((r) => {
      const trend = JSON.parse(r.trend) as number[];
      const { tier } = ratingOf({ rating: r.rating, games: r.games, won: r.won, trend });
      return { id: r.id, name: r.name, color: COLORS.includes(r.color as PlayerColor) ? (r.color as PlayerColor) : null, rating: r.rating, tier, games: r.games, won: r.won, trend };
    });
    const at = all.findIndex((r) => r.id === meId);
    return { season, players: all.length, rows: all.slice(0, limit), me: at < 0 ? null : { ...all[at], rank: at + 1 } };
  }

  /* --------------------------- the notices -------------------------- */

  /** an attempt at the week's notice: the best per account is kept, and the
   *  conditions newly met are paid — so many a condition, so much more
   *  when every one holds for the first time. Returns what was paid. */
  postChallenge(accountId: string, week: number, id: string, points: number, vp: number, met: boolean[]): number {
    const row = this.db.prepare('select points, met from challenges where accountId = ? and week = ?').get(accountId, week) as { points: number; met: string } | undefined;
    const before: boolean[] = row ? (JSON.parse(row.met) as boolean[]) : [];
    const count = (m: boolean[]) => m.filter(Boolean).length;
    const all = (m: boolean[]) => m.length > 0 && m.every(Boolean);
    const paid = Math.max(0, count(met) - count(before)) * GUINEAS.challengeRule + (all(met) && !all(before) ? GUINEAS.challengeAll : 0);
    const better = !row || points > row.points || count(met) > count(before);
    if (better) {
      const keptMet = count(met) >= count(before) ? met : before;
      this.db
        .prepare('insert into challenges (accountId, week, id, points, vp, met, at) values (?, ?, ?, ?, ?, ?, ?) on conflict (accountId, week) do update set id = excluded.id, points = max(points, excluded.points), vp = excluded.vp, met = excluded.met, at = excluded.at')
        .run(accountId, week, id, points, vp, JSON.stringify(keptMet), Date.now());
    }
    if (paid > 0) this.earn(accountId, paid);
    return paid;
  }

  /** the week's board: every account's best attempt, the most points first */
  challengeBoard(week: number, meId: string, limit = 50): ChallengeBoard {
    const rows = this.db
      .prepare('select c.accountId as id, a.name, a.favoriteColor as color, c.points, c.vp, c.met, c.at from challenges c join accounts a on a.id = c.accountId where c.week = ? order by c.points desc, c.at asc')
      .all(week) as { id: string; name: string; color: string | null; points: number; vp: number; met: string; at: number }[];
    const all: ChallengeRow[] = rows.map((r) => ({ id: r.id, name: r.name, color: COLORS.includes(r.color as PlayerColor) ? (r.color as PlayerColor) : null, points: r.points, vp: r.vp, met: JSON.parse(r.met) as boolean[], at: r.at }));
    const at = all.findIndex((r) => r.id === meId);
    return { week, players: all.length, rows: all.slice(0, limit), me: at < 0 ? null : { ...all[at], rank: at + 1 } };
  }

  /* ---------------------------- the papers -------------------------- */

  /** every paper the office keeps for an account, by kind */
  papers(accountId: string): Record<string, Paper> {
    const rows = this.db.prepare('select kind, body, updatedAt from papers where accountId = ?').all(accountId) as { kind: string; body: string; updatedAt: number }[];
    const out: Record<string, Paper> = {};
    for (const r of rows) {
      try {
        out[r.kind] = { body: JSON.parse(r.body) as unknown, updatedAt: r.updatedAt };
      } catch {
        /* a paper that no longer reads: left out */
      }
    }
    return out;
  }

  /** a paper written: kept as given, sixty-four thousand characters at most */
  putPaper(accountId: string, kind: string, body: unknown): boolean {
    const text = JSON.stringify(body ?? null);
    if (!/^[a-z]{2,24}$/.test(kind) || text.length > 64_000) return false;
    this.db.prepare('insert into papers (accountId, kind, body, updatedAt) values (?, ?, ?, ?) on conflict (accountId, kind) do update set body = excluded.body, updatedAt = excluded.updatedAt').run(accountId, kind, text, Date.now());
    return true;
  }

  /* --------------------------- the mailings -------------------------- */

  /** a mailing done once: true the first time the key is claimed */
  claimMailing(key: string): boolean {
    const had = this.db.prepare('select 1 from mailings where key = ?').get(key);
    if (had) return false;
    this.db.prepare('insert into mailings (key, at) values (?, ?)').run(key, Date.now());
    return true;
  }

  /** the verified addresses that asked for the Monday edition */
  subscribers(): { email: string; name: string }[] {
    return this.db.prepare('select email, name from accounts where newsletter = 1 and verifiedAt is not null and email is not null and closedAt is null').all() as { email: string; name: string }[];
  }

  /* -------------------------- the companies ------------------------- */

  /** the company an account belongs to, with its head count */
  companyOf(accountId: string): Company | null {
    const row = this.db
      .prepare('select c.id, c.name, (select count(*) from accounts a where a.companyId = c.id and a.closedAt is null) as members from companies c join accounts me on me.companyId = c.id where me.id = ?')
      .get(accountId) as { id: string; name: string; members: number } | undefined;
    return row ? { id: row.id, name: row.name, members: row.members } : null;
  }

  /** every company, ranked by its members' wins this season, then by size */
  companies(season: Season, meId: string): CompanyBoard {
    const rows = this.db
      .prepare(
        'select c.id, c.name, c.createdAt, (select count(*) from accounts a where a.companyId = c.id and a.closedAt is null) as members, coalesce((select sum(r.won) from ratings r join accounts a on a.id = r.accountId where a.companyId = c.id and r.season = ?), 0) as wins, coalesce((select sum(r.games) from ratings r join accounts a on a.id = r.accountId where a.companyId = c.id and r.season = ?), 0) as games from companies c order by wins desc, members desc, c.createdAt asc',
      )
      .all(season.id, season.id) as unknown as CompanyRow[];
    return { season, rows: rows.map((r) => ({ id: r.id, name: r.name, members: r.members, wins: r.wins, games: r.games, createdAt: r.createdAt })), mine: this.companyOf(meId) };
  }

  /** found a company: the name must be free and three letters at least;
   *  one belongs to one company at a time. Returns the refusal, if any */
  foundCompany(accountId: string, name: string): string | null {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (clean.length < 3) return 'name-short';
    if (this.companyOf(accountId)) return 'in-company';
    const folded = clean.toLowerCase();
    if (this.db.prepare('select 1 from companies where folded = ?').get(folded)) return 'name-taken';
    const id = randomId(6);
    this.db.prepare('insert into companies (id, name, folded, founderId, createdAt) values (?, ?, ?, ?, ?)').run(id, clean, folded, accountId, Date.now());
    this.db.prepare('update accounts set companyId = ? where id = ?').run(id, accountId);
    return null;
  }

  joinCompany(accountId: string, id: string): string | null {
    if (this.companyOf(accountId)) return 'in-company';
    if (!this.db.prepare('select 1 from companies where id = ?').get(id)) return 'not-found';
    this.db.prepare('update accounts set companyId = ? where id = ?').run(id, accountId);
    return null;
  }

  /** leave one's company; a company left empty is struck off */
  leaveCompany(accountId: string): void {
    const c = this.companyOf(accountId);
    if (!c) return;
    this.db.prepare('update accounts set companyId = null where id = ?').run(accountId);
    if (c.members <= 1) this.db.prepare('delete from companies where id = ?').run(c.id);
  }

  /* --------------------------- the edition -------------------------- */

  /** the club's week, from the games played out between two Mondays: the
   *  game of the week is the one won with the most points at a table of
   *  two humans at least; the most assiduous member sat at the most of them */
  editionOf(week: number, from: number, to: number): Edition {
    const rows = this.db
      .prepare('select g.code, g.seats, g.finishedAt, g.result, t.name from games g left join tables t on t.code = g.code where g.home = 0 and g.finishedAt is not null and g.result is not null and g.finishedAt >= ? and g.finishedAt < ? order by g.finishedAt desc')
      .all(from, to) as { code: string; seats: string; finishedAt: number; result: string; name: string | null }[];
    const games = rows
      .map((r) => {
        const result = JSON.parse(r.result) as Result;
        const seatIds = JSON.parse(r.seats) as string[];
        return { code: r.code, name: r.name ?? r.code, finishedAt: r.finishedAt, result, seatIds };
      })
      .filter((g) => !g.result.abandoned);
    const humans = (g: (typeof games)[number]) => g.result.players.filter((p) => !p.bot).length;
    const best = [...games].filter((g) => humans(g) >= 2).sort((a, b) => b.result.players[b.result.winner].vp - a.result.players[a.result.winner].vp)[0] ?? null;
    const sat = new Map<string, number>();
    for (const g of games) for (const id of g.seatIds) if (id) sat.set(id, (sat.get(id) ?? 0) + 1);
    const top = [...sat.entries()].sort((a, b) => b[1] - a[1])[0];
    const busiestName = top ? ((this.db.prepare('select name from accounts where id = ?').get(top[0]) as { name: string } | undefined)?.name ?? null) : null;
    const line = (g: (typeof games)[number]) => ({ code: g.code, name: g.name, finishedAt: g.finishedAt, winner: g.result.players[g.result.winner]?.name ?? '—', vp: g.result.players[g.result.winner]?.vp ?? 0, players: g.result.players.length });
    /* the machines' record: a win when a machine took the table, a loss otherwise */
    const machines = new Map<string, { won: number; lost: number }>();
    for (const g of games) {
      g.result.players.forEach((p, i) => {
        if (!p.bot) return;
        const m = machines.get(p.name) ?? { won: 0, lost: 0 };
        if (i === g.result.winner) m.won += 1;
        else m.lost += 1;
        machines.set(p.name, m);
      });
    }
    return {
      week,
      games: games.length,
      best: best ? { ...line(best), players: best.result.players.map((p) => p.name) } : null,
      busiest: top && busiestName ? { name: busiestName, games: top[1] } : null,
      latest: games.slice(0, 6).map(line),
      machines: [...machines.entries()].map(([name, r]) => ({ name, ...r })),
    };
  }

  /* ---------------------------- the services -------------------------- */

  /** every service the cote has known, the latest first */
  seasons(): string[] {
    return (this.db.prepare('select distinct season from ratings order by season desc').all() as { season: string }[]).map((r) => r.season);
  }

  /** a service's honours: the players by rating, the companies by wins, the
   *  game of the service among those played out between its dates */
  seasonReview(season: Season, from: number, to: number): SeasonReview {
    const board = this.leaderboard(season, '', 10);
    const companies = this.companies(season, '').rows.slice(0, 5);
    const edition = this.editionOf(0, from, to);
    return { season, games: edition.games, players: board.rows, companies, best: edition.best };
  }

  /* ----------------------------- the purse ------------------------- */

  /** the guineas earned and what they bought — the free items are everyone's */
  purse(accountId: string): Purse {
    const row = this.db.prepare('select guineas, owned from purses where accountId = ?').get(accountId) as { guineas: number; owned: string } | undefined;
    const owned = row ? (JSON.parse(row.owned) as string[]) : [];
    return { guineas: row?.guineas ?? 0, owned: [...new Set([...FREE_ITEMS, ...owned])] };
  }

  earn(accountId: string, guineas: number): void {
    this.db.prepare('insert into purses (accountId, guineas, owned) values (?, ?, ?) on conflict (accountId) do update set guineas = guineas + excluded.guineas').run(accountId, guineas, '[]');
  }

  /** an item bought at the counter, or why not: unknown, already owned, or too dear */
  buy(accountId: string, item: string): 'refused' | null {
    const wanted = COUNTER_BY_ID[item];
    if (!wanted) return 'refused';
    const purse = this.purse(accountId);
    if (purse.owned.includes(item) || purse.guineas < wanted.price) return 'refused';
    const owned = JSON.stringify([...purse.owned.filter((i) => !FREE_ITEMS.includes(i)), item]);
    this.db.prepare('insert into purses (accountId, guineas, owned) values (?, ?, ?) on conflict (accountId) do update set guineas = guineas - ?, owned = ?').run(accountId, -wanted.price, owned, wanted.price, owned);
    return null;
  }
}
