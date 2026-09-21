import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PlayerColor } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';
import type { Friend, Identity, Invitation, Leaderboard, LeaderRow, Me, PastGame, Purse, Rating, Season, Stats, Table } from '@/online/table';
import { COUNTER_BY_ID, FREE_ITEMS, GUINEAS } from '@/online/counter';
import { BOARDS, POSTS_PER_PAGE, THREADS_PER_PAGE, EDIT_MS } from '@/forum/types';
import type { BoardKey, BoardSummary, Lang, ModAction, Post, Report, ReportReason, ThreadRow, ThreadView } from '@/forum/types';
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
/** how long the address a post was written from is kept: a year, as the law asks of a host */
export const POST_ADDRESS_MS = 365 * 24 * 60 * 60 * 1000;
/** how long the name and address of a closed account are kept aside: five years, as the law asks */
export const DEPARTED_MS = 5 * 365 * 24 * 60 * 60 * 1000;
/** passwords everybody tries first: refused whatever their length */
const COMMON_PASSWORDS = new Set(['password', 'password1', 'password123', 'motdepasse', 'passwort', 'contraseña', 'contrasena', '12345678', '123456789', '1234567890', 'qwertyuiop', 'azertyuiop', 'qwerty123', 'azerty123', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'trustno1', 'letmein1', 'welcome1', 'admin123', 'abcd1234', 'abc12345', '11111111', '00000000', 'birmingham', 'blackrail', 'brassworks', 'brass1234', 'wedgwood']);
export const MAX_MOTTO = 80;
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
  favoriteColor text
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
  result     text
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
create table if not exists purses (
  accountId text primary key,
  guineas   integer not null,
  owned     text not null
);
create table if not exists forum_threads (
  id        text primary key,
  board     text not null,
  accountId text not null references accounts(id) on delete cascade,
  title     text not null,
  createdAt integer not null,
  lastAt    integer not null,
  lastBy    text not null,
  replies   integer not null default 0,
  pinned    integer not null default 0,
  locked    integer not null default 0,
  hiddenAt  integer,
  hiddenBy  text,
  lang      text not null default 'en'
);
create index if not exists forum_threads_board on forum_threads (board, pinned, lastAt);
create table if not exists forum_posts (
  id        text primary key,
  threadId  text not null references forum_threads(id) on delete cascade,
  accountId text not null references accounts(id) on delete cascade,
  body      text not null,
  createdAt integer not null,
  editedAt  integer,
  hiddenAt  integer,
  hiddenBy  text,
  lang      text not null default 'en',
  refusedAt integer
);
create index if not exists forum_posts_thread on forum_posts (threadId, createdAt);
create table if not exists forum_bans (
  accountId text primary key references accounts(id) on delete cascade,
  at        integer not null,
  byId      text not null
);
create table if not exists forum_translations (
  subject   text not null,
  id        text not null,
  lang      text not null,
  text      text not null,
  model     text not null,
  tokensIn  integer not null,
  tokensOut integer not null,
  cost      real not null,
  createdAt integer not null,
  prompt    integer not null default 1,
  primary key (subject, id, lang)
);
create table if not exists forum_spent (
  at   integer not null,
  cost real not null
);
create table if not exists forum_reports (
  id         text primary key,
  postId     text not null references forum_posts(id) on delete cascade,
  accountId  text not null references accounts(id) on delete cascade,
  reason     text not null,
  text       text not null,
  createdAt  integer not null,
  resolvedAt integer,
  resolvedBy text,
  unique (postId, accountId)
);
create table if not exists forum_seen (
  accountId text not null references accounts(id) on delete cascade,
  threadId  text not null references forum_threads(id) on delete cascade,
  at        integer not null,
  primary key (accountId, threadId)
);
`;

/** columns added since the first register: an old file learns them on opening */
const GROWTH: [table: string, column: string, ddl: string][] = [
  ['forum_threads', 'lang', "text not null default 'en'"],
  ['forum_posts', 'lang', "text not null default 'en'"],
  ['forum_translations', 'prompt', 'integer not null default 1'],
  ['forum_posts', 'refusedAt', 'integer'],
  ['accounts', 'email', 'text'],
  ['accounts', 'emailFolded', 'text'],
  ['accounts', 'verifiedAt', 'integer'],
  ['accounts', 'motto', "text not null default ''"],
  ['accounts', 'favoriteColor', 'text'],
  ['accounts', 'createdIp', 'text'],
  ['accounts', 'acceptedAt', 'integer'],
  ['accounts', 'closedAt', 'integer'],
  ['forum_posts', 'ip', 'text'],
  ['games', 'result', 'text'],
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
  acceptedAt: number | null;
  closedAt: number | null;
}

/** where an account was opened from, and whether the charter was accepted */
export interface Origin {
  ip?: string | null;
  accepted?: boolean;
}

const COLORS: PlayerColor[] = ['brass', 'oxblood', 'verdigris', 'steel'];
const ACCOUNT_COLUMNS = 'id, name, createdAt, email, verifiedAt, motto, favoriteColor, acceptedAt, closedAt';

function accountOf(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    email: r.email,
    verified: r.verifiedAt !== null,
    motto: r.motto ?? '',
    favoriteColor: COLORS.includes(r.favoriteColor as PlayerColor) ? (r.favoriteColor as PlayerColor) : null,
    acceptedAt: r.acceptedAt,
    closedAt: r.closedAt,
  };
}

/** the game's outcome, kept with the game once it is over */
interface Result {
  players: { name: string; color: PlayerColor; vp: number; bot: boolean; resigned?: boolean; tally?: Tally }[];
  winner: number;
  abandoned: boolean;
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
  setProfile(id: string, patch: { motto?: string; favoriteColor?: PlayerColor | null }): void {
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
      threads: rows('select id, board, title, lang, createdAt, hiddenAt from forum_threads where accountId = ?'),
      posts: rows('select id, threadId, body, lang, createdAt, editedAt, hiddenAt, ip from forum_posts where accountId = ?'),
      reports: rows('select postId, reason, text, createdAt, resolvedAt from forum_reports where accountId = ?'),
      feedback: rows('select page, kind, text, createdAt from feedback where accountId = ?'),
      games: rows('select g.code, g.startedAt, g.finishedAt, g.result from games g join game_players p on p.code = g.code where p.accountId = ?1'),
      ratings: rows('select season, rating, games, won, updatedAt from ratings where accountId = ?'),
      purse: this.db.prepare('select guineas, owned from purses where accountId = ?').get(accountId) ?? null,
      flags: rows('select kind, detail, code, at from flags where accountId = ?'),
    };
  }

  /** the account is closed and what identifies the member is erased: the name
   *  becomes a number, the address and the password go, every session, letter,
   *  friendship, invitation, report and note goes with them. The posts stay
   *  under the number, so the threads still read. The name and address are kept
   *  aside, apart from everything, for as long as the law asks of a host. */
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
        .prepare("update accounts set name = ?, folded = ?, email = null, emailFolded = null, secret = ?, motto = '', favoriteColor = null, createdIp = null, closedAt = ? where id = ?")
        .run(gone, fold(gone), seal(randomBytes(32).toString('hex')), now, accountId);
      for (const table of ['sessions', 'letters', 'feedback', 'forum_reports', 'forum_seen', 'forum_bans', 'purses']) {
        try {
          this.db.prepare(`delete from ${table} where accountId = ?`).run(accountId);
        } catch {
          /* a table this register does not have */
        }
      }
      this.db.prepare('delete from friends where aId = ? or bId = ?').run(accountId, accountId);
      this.db.prepare('delete from invitations where fromId = ? or toId = ?').run(accountId, accountId);
      this.db.prepare('update forum_posts set ip = null where accountId = ?').run(accountId);
      this.db.exec('commit');
    } catch (e) {
      this.db.exec('rollback');
      throw e;
    }
    return null;
  }

  /** what the law lets go, let go: the addresses of posts older than a year,
   *  the names kept aside longer than five, the sessions and letters long dead */
  sweepPrivacy(now = Date.now()): void {
    this.db.prepare('update forum_posts set ip = null where ip is not null and createdAt < ?').run(now - POST_ADDRESS_MS);
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
    const result: Result | null = state
      ? {
          players: state.players.map((p, i) => ({ name: p.name, color: p.color as PlayerColor, vp: p.vp, bot: !!p.isBot && !p.resigned, ...(p.resigned ? { resigned: true } : {}), ...(tallies?.[i] ? { tally: tallies[i] } : {}) })),
          winner: state.winner ?? 0,
          abandoned: !!state.abandoned,
        }
      : null;
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

  games(): StoredGame[] {
    const rows = this.db.prepare('select * from games').all() as {
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

  /** the finished games this account sat at, newest first */
  historyFor(accountId: string, limit = 20): PastGame[] {
    const rows = this.db
      .prepare(
        'select g.code, g.seats, g.finishedAt, g.result, t.name from games g left join tables t on t.code = g.code where g.finishedAt is not null and g.result is not null and g.code in (select code from game_players where accountId = ?) order by g.finishedAt desc, g.rowid desc limit ?',
      )
      .all(accountId, limit) as { code: string; seats: string; finishedAt: number; result: string; name: string | null }[];
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
      };
    });
  }

  statsFor(accountId: string): Stats {
    const games = this.historyFor(accountId, 10_000);
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

  /* ------------------------------ the forum ------------------------------ */
  /* Threads and posts as the members wrote them; the moderators' marks on
     them; what each member has read. Nothing is ever deleted: a hidden
     post keeps its place and its text for the moderators, the members
     see that something was taken down. */

  private static THREAD = `select t.*, a.name as byName, l.name as lastName, s.at as seenAt
    from forum_threads t join accounts a on a.id = t.accountId join accounts l on l.id = t.lastBy
    left join forum_seen s on s.threadId = t.id and s.accountId = ?`;

  private threadRow(r: ThreadRecord): ThreadRow {
    return {
      id: r.id,
      board: r.board as BoardKey,
      title: r.title,
      lang: r.lang as Lang,
      by: { id: r.accountId, name: r.byName },
      createdAt: r.createdAt,
      lastAt: r.lastAt,
      lastBy: r.lastName,
      replies: r.replies,
      pinned: r.pinned === 1,
      locked: r.locked === 1,
      hidden: r.hiddenAt !== null,
      unread: r.seenAt === null || r.seenAt < r.lastAt,
    };
  }

  private postRow(r: PostRecord, mod: boolean): Post {
    const hidden = r.hiddenAt !== null;
    const post: Post = { id: r.id, threadId: r.threadId, by: { id: r.accountId, name: r.byName }, body: hidden && !mod ? '' : r.body, lang: r.lang as Lang, createdAt: r.createdAt, editedAt: r.editedAt, hidden, reports: mod ? r.reports : 0 };
    if (mod) {
      post.refused = r.refusedAt !== null;
      post.banned = this.forumBanned(r.accountId);
    }
    return post;
  }

  /** the five boards, with what a member has not read yet on each */
  forumBoards(accountId: string): BoardSummary[] {
    return BOARDS.map((key) => {
      const counts = this.db.prepare('select count(*) as threads, coalesce(sum(replies), 0) + count(*) as posts from forum_threads where board = ? and hiddenAt is null').get(key) as { threads: number; posts: number };
      const last = this.db.prepare('select t.id, t.title, t.lastAt, l.name from forum_threads t join accounts l on l.id = t.lastBy where t.board = ? and t.hiddenAt is null order by t.lastAt desc limit 1').get(key) as { id: string; title: string; lastAt: number; name: string } | undefined;
      const unread = this.db.prepare('select count(*) as n from forum_threads t left join forum_seen s on s.threadId = t.id and s.accountId = ? where t.board = ? and t.hiddenAt is null and (s.at is null or s.at < t.lastAt)').get(accountId, key) as { n: number };
      return { key, threads: counts.threads, posts: counts.posts, last: last ? { threadId: last.id, title: last.title, at: last.lastAt, by: last.name } : null, unread: unread.n };
    });
  }

  /** a board's threads, the pinned ones first, then the freshest; hidden ones for moderators only */
  forumThreads(board: BoardKey, page: number, accountId: string, mod: boolean): { page: number; pages: number; threads: ThreadRow[] } {
    const hiddenToo = mod ? '' : ' and t.hiddenAt is null';
    const total = (this.db.prepare(`select count(*) as n from forum_threads t where t.board = ?${hiddenToo}`).get(board) as { n: number }).n;
    const pages = Math.max(1, Math.ceil(total / THREADS_PER_PAGE));
    const at = Math.min(Math.max(1, page), pages);
    const rows = this.db.prepare(`${Store.THREAD} where t.board = ?${hiddenToo} order by t.pinned desc, t.lastAt desc limit ? offset ?`).all(accountId, board, THREADS_PER_PAGE, (at - 1) * THREADS_PER_PAGE) as unknown as ThreadRecord[];
    return { page: at, pages, threads: rows.map((r) => this.threadRow(r)) };
  }

  /** a thread and one page of its posts (page 0: the last one); null when it is not there for this reader */
  forumThread(id: string, page: number, accountId: string, mod: boolean): ThreadView | null {
    const r = this.db.prepare(`${Store.THREAD} where t.id = ?`).get(accountId, id) as unknown as ThreadRecord | undefined;
    if (!r || (r.hiddenAt !== null && !mod)) return null;
    const total = (this.db.prepare('select count(*) as n from forum_posts where threadId = ?').get(id) as { n: number }).n;
    const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
    const at = page <= 0 ? pages : Math.min(page, pages);
    const rows = this.db
      .prepare(
        `select p.*, a.name as byName, (select count(*) from forum_reports x where x.postId = p.id and x.resolvedAt is null) as reports
         from forum_posts p join accounts a on a.id = p.accountId where p.threadId = ? order by p.createdAt limit ? offset ?`,
      )
      .all(id, POSTS_PER_PAGE, (at - 1) * POSTS_PER_PAGE) as unknown as PostRecord[];
    return { thread: this.threadRow(r), page: at, pages, posts: rows.map((p) => this.postRow(p, mod)) };
  }

  /** the board a thread is on, or a post's thread and board */
  forumWhere(threadId: string): { board: BoardKey; locked: boolean; hidden: boolean } | null {
    const r = this.db.prepare('select board, locked, hiddenAt from forum_threads where id = ?').get(threadId) as { board: string; locked: number; hiddenAt: number | null } | undefined;
    return r ? { board: r.board as BoardKey, locked: r.locked === 1, hidden: r.hiddenAt !== null } : null;
  }
  forumPostWhere(postId: string): { threadId: string; board: BoardKey; accountId: string; createdAt: number; refused: boolean; reported: boolean } | null {
    const r = this.db
      .prepare('select p.threadId, p.accountId, p.createdAt, p.refusedAt, t.board, (select count(*) from forum_reports x where x.postId = p.id and x.resolvedAt is null) as reports from forum_posts p join forum_threads t on t.id = p.threadId where p.id = ?')
      .get(postId) as { threadId: string; accountId: string; createdAt: number; refusedAt: number | null; board: string; reports: number } | undefined;
    return r ? { threadId: r.threadId, board: r.board as BoardKey, accountId: r.accountId, createdAt: r.createdAt, refused: r.refusedAt !== null, reported: r.reports > 0 } : null;
  }

  /* ---- the members kept from writing, and the posts the interpreter declined ---- */
  forumBanned(accountId: string): boolean {
    return !!this.db.prepare('select 1 from forum_bans where accountId = ?').get(accountId);
  }
  /** the interpreter would not render this post: it is not sent again until a moderator clears it */
  forumRefuse(postId: string): void {
    this.db.prepare('update forum_posts set refusedAt = ? where id = ? and refusedAt is null').run(Date.now(), postId);
  }
  /** the posts the interpreter declined, as the moderators' second queue */
  forumRefused(): Report[] {
    const rows = this.db
      .prepare(
        `select p.id as postId, p.threadId, p.accountId, a.name as byName, p.body, p.lang as postLang, p.createdAt as postAt, p.editedAt, p.hiddenAt, p.refusedAt, t.title, t.board
         from forum_posts p join forum_threads t on t.id = p.threadId join accounts a on a.id = p.accountId
         where p.refusedAt is not null and p.hiddenAt is null order by p.refusedAt`,
      )
      .all() as unknown as (ReportRecord & { refusedAt: number })[];
    return rows.map((r) => ({
      id: r.postId,
      post: { id: r.postId, threadId: r.threadId, by: { id: r.accountId, name: r.byName }, body: r.body, lang: r.postLang as Lang, createdAt: r.postAt, editedAt: r.editedAt, hidden: false, reports: 0, refused: true, banned: this.forumBanned(r.accountId) },
      thread: { id: r.threadId, title: r.title, board: r.board as BoardKey },
      by: { id: '', name: '' },
      reason: 'other',
      text: '',
      createdAt: r.refusedAt,
    }));
  }

  /** a new thread with its first post */
  forumOpen(accountId: string, board: BoardKey, title: string, body: string, lang: Lang = 'en', ip: string | null = null): string {
    const now = Date.now();
    const id = 't-' + randomBytes(6).toString('hex');
    this.db.prepare('insert into forum_threads (id, board, accountId, title, createdAt, lastAt, lastBy, lang) values (?, ?, ?, ?, ?, ?, ?, ?)').run(id, board, accountId, title, now, now, accountId, lang);
    this.db.prepare('insert into forum_posts (id, threadId, accountId, body, createdAt, lang, ip) values (?, ?, ?, ?, ?, ?, ?)').run('p-' + randomBytes(6).toString('hex'), id, accountId, body, now, lang, ip);
    this.forumSeen(accountId, id, now);
    return id;
  }

  /** a reply: the post, and the page it lands on */
  forumReply(accountId: string, threadId: string, body: string, lang: Lang = 'en', ip: string | null = null): { post: Post; page: number } | 'forum-not-found' | 'forum-locked' {
    const where = this.forumWhere(threadId);
    if (!where || where.hidden) return 'forum-not-found';
    if (where.locked) return 'forum-locked';
    /* strictly after the thread's last word, so a reply in the same tick still reads as new */
    const last = (this.db.prepare('select lastAt from forum_threads where id = ?').get(threadId) as { lastAt: number }).lastAt;
    const now = Math.max(Date.now(), last + 1);
    const id = 'p-' + randomBytes(6).toString('hex');
    this.db.prepare('insert into forum_posts (id, threadId, accountId, body, createdAt, lang, ip) values (?, ?, ?, ?, ?, ?, ?)').run(id, threadId, accountId, body, now, lang, ip);
    this.db.prepare('update forum_threads set replies = replies + 1, lastAt = ?, lastBy = ? where id = ?').run(now, accountId, threadId);
    this.forumSeen(accountId, threadId, now);
    const total = (this.db.prepare('select count(*) as n from forum_posts where threadId = ?').get(threadId) as { n: number }).n;
    const name = (this.db.prepare('select name from accounts where id = ?').get(accountId) as { name: string }).name;
    return { post: { id, threadId, by: { id: accountId, name }, body, lang, createdAt: now, editedAt: null, hidden: false, reports: 0 }, page: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)) };
  }

  /** a correction: the author's for a quarter of an hour, a moderator's at any time */
  forumEdit(accountId: string, postId: string, body: string, mod: boolean, lang?: Lang): 'forum-not-found' | 'forum-not-yours' | 'forum-edit-window' | null {
    const post = this.forumPostWhere(postId);
    if (!post) return 'forum-not-found';
    if (!mod) {
      if (post.accountId !== accountId) return 'forum-not-yours';
      if (Date.now() - post.createdAt > EDIT_MS) return 'forum-edit-window';
    }
    this.db.prepare('update forum_posts set body = ?, editedAt = ?, lang = coalesce(?, lang) where id = ?').run(body, Date.now(), lang ?? null, postId);
    /* the renderings said something else: made again when next read */
    this.db.prepare("insert into forum_spent (at, cost) select createdAt, cost from forum_translations where subject = 'post' and id = ?").run(postId);
    this.db.prepare("delete from forum_translations where subject = 'post' and id = ?").run(postId);
    return null;
  }

  /** a member points a post out to the moderators, once per post */
  forumReport(accountId: string, postId: string, reason: ReportReason, text: string): 'forum-not-found' | 'forum-reported' | null {
    if (!this.forumPostWhere(postId)) return 'forum-not-found';
    const r = this.db.prepare('insert or ignore into forum_reports (id, postId, accountId, reason, text, createdAt) values (?, ?, ?, ?, ?, ?)').run('r-' + randomBytes(6).toString('hex'), postId, accountId, reason, text, Date.now());
    return r.changes === 0 ? 'forum-reported' : null;
  }

  /** what a moderator does: hide or show a post, lock or pin a thread, close a report */
  forumMod(accountId: string, action: ModAction, id: string): 'forum-not-found' | null {
    const now = Date.now();
    switch (action) {
      case 'hide':
      case 'unhide': {
        if (!this.forumPostWhere(id)) return 'forum-not-found';
        if (action === 'hide') {
          this.db.prepare('update forum_posts set hiddenAt = ?, hiddenBy = ? where id = ?').run(now, accountId, id);
          this.db.prepare('update forum_reports set resolvedAt = ?, resolvedBy = ? where postId = ? and resolvedAt is null').run(now, accountId, id);
        } else this.db.prepare('update forum_posts set hiddenAt = null, hiddenBy = null where id = ?').run(id);
        return null;
      }
      case 'lock':
      case 'unlock':
      case 'pin':
      case 'unpin': {
        if (!this.forumWhere(id)) return 'forum-not-found';
        const col = action === 'lock' || action === 'unlock' ? 'locked' : 'pinned';
        this.db.prepare(`update forum_threads set ${col} = ? where id = ?`).run(action === 'lock' || action === 'pin' ? 1 : 0, id);
        return null;
      }
      case 'resolve': {
        const r = this.db.prepare('update forum_reports set resolvedAt = ?, resolvedBy = ? where id = ? and resolvedAt is null').run(now, accountId, id);
        return r.changes === 0 ? 'forum-not-found' : null;
      }
      case 'ban': {
        if (!this.db.prepare('select 1 from accounts where id = ?').get(id)) return 'forum-not-found';
        this.db.prepare('insert or ignore into forum_bans (accountId, at, byId) values (?, ?, ?)').run(id, now, accountId);
        return null;
      }
      case 'unban': {
        const r = this.db.prepare('delete from forum_bans where accountId = ?').run(id);
        return r.changes === 0 ? 'forum-not-found' : null;
      }
      case 'clear': {
        const r = this.db.prepare('update forum_posts set refusedAt = null where id = ?').run(id);
        return r.changes === 0 ? 'forum-not-found' : null;
      }
    }
  }

  /** the open reports, oldest first, each with its post and thread */
  forumReports(): Report[] {
    const rows = this.db
      .prepare(
        `select r.id, r.reason, r.text, r.createdAt, r.accountId as reporterId, b.name as reporterName,
                p.id as postId, p.threadId, p.accountId, a.name as byName, p.body, p.lang as postLang, p.createdAt as postAt, p.editedAt, p.hiddenAt,
                t.title, t.board,
                (select count(*) from forum_reports x where x.postId = p.id and x.resolvedAt is null) as reports
         from forum_reports r join forum_posts p on p.id = r.postId join forum_threads t on t.id = p.threadId
         join accounts a on a.id = p.accountId join accounts b on b.id = r.accountId
         where r.resolvedAt is null order by r.createdAt`,
      )
      .all() as unknown as ReportRecord[];
    return rows.map((r) => ({
      id: r.id,
      post: { id: r.postId, threadId: r.threadId, by: { id: r.accountId, name: r.byName }, body: r.body, lang: r.postLang as Lang, createdAt: r.postAt, editedAt: r.editedAt, hidden: r.hiddenAt !== null, reports: r.reports },
      thread: { id: r.threadId, title: r.title, board: r.board as BoardKey },
      by: { id: r.reporterId, name: r.reporterName },
      reason: r.reason as ReportReason,
      text: r.text,
      createdAt: r.createdAt,
    }));
  }
  forumOpenReports(): number {
    return (this.db.prepare('select count(*) as n from forum_reports where resolvedAt is null').get() as { n: number }).n;
  }

  /* ---- the interpreter's renderings: one per post and tongue, and what they cost ---- */
  /** a rendering made under these instructions; an older one is made again */
  forumRendering(subject: 'post' | 'thread', id: string, lang: Lang, prompt: number): string | null {
    const r = this.db.prepare('select text from forum_translations where subject = ? and id = ? and lang = ? and prompt = ?').get(subject, id, lang, prompt) as { text: string } | undefined;
    return r ? r.text : null;
  }
  forumKeepRendering(subject: 'post' | 'thread', id: string, lang: Lang, text: string, model: string, tokensIn: number, tokensOut: number, cost: number, prompt: number): void {
    this.db.prepare('insert into forum_spent (at, cost) select createdAt, cost from forum_translations where subject = ? and id = ? and lang = ?').run(subject, id, lang);
    this.db
      .prepare('insert into forum_translations (subject, id, lang, text, model, tokensIn, tokensOut, cost, createdAt, prompt) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (subject, id, lang) do update set text = excluded.text, model = excluded.model, tokensIn = excluded.tokensIn, tokensOut = excluded.tokensOut, cost = excluded.cost, createdAt = excluded.createdAt, prompt = excluded.prompt')
      .run(subject, id, lang, text, model, tokensIn, tokensOut, cost, Date.now(), prompt);
  }
  /** dollars spent on renderings, all time — every rendering paid, replaced ones included */
  forumRenderingSpend(): number {
    return (this.db.prepare("select coalesce(sum(cost), 0) as d from forum_translations") .get() as { d: number }).d + (this.db.prepare("select coalesce(sum(cost), 0) as d from forum_spent").get() as { d: number }).d;
  }

  /** the member read the thread up to now */
  forumSeen(accountId: string, threadId: string, at = Date.now()): void {
    this.db.prepare('insert into forum_seen (accountId, threadId, at) values (?, ?, ?) on conflict (accountId, threadId) do update set at = excluded.at').run(accountId, threadId, at);
  }

  /** how fast this member writes: posts since `since`, and when the last thread and post were */
  forumPace(accountId: string, since: number): { posts: number; lastPostAt: number; lastThreadAt: number } {
    const posts = (this.db.prepare('select count(*) as n from forum_posts where accountId = ? and createdAt >= ?').get(accountId, since) as { n: number }).n;
    const lastPostAt = (this.db.prepare('select coalesce(max(createdAt), 0) as at from forum_posts where accountId = ?').get(accountId) as { at: number }).at;
    const lastThreadAt = (this.db.prepare('select coalesce(max(createdAt), 0) as at from forum_threads where accountId = ?').get(accountId) as { at: number }).at;
    return { posts, lastPostAt, lastThreadAt };
  }
}

interface ThreadRecord {
  id: string;
  board: string;
  accountId: string;
  title: string;
  createdAt: number;
  lastAt: number;
  lastBy: string;
  replies: number;
  pinned: number;
  locked: number;
  hiddenAt: number | null;
  lang: string;
  byName: string;
  lastName: string;
  seenAt: number | null;
}
interface PostRecord {
  id: string;
  threadId: string;
  accountId: string;
  body: string;
  createdAt: number;
  editedAt: number | null;
  hiddenAt: number | null;
  refusedAt: number | null;
  lang: string;
  byName: string;
  reports: number;
}
interface ReportRecord {
  id: string;
  reason: string;
  text: string;
  createdAt: number;
  reporterId: string;
  reporterName: string;
  postId: string;
  threadId: string;
  accountId: string;
  byName: string;
  body: string;
  postLang: string;
  postAt: number;
  editedAt: number | null;
  hiddenAt: number | null;
  title: string;
  board: string;
  reports: number;
}

