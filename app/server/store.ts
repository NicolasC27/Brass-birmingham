import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PlayerColor } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';
import type { Identity, Invitation, Me, PastGame, Stats, Table } from '@/online/table';

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
/* SQLite comes with Node itself — no native build, no dependency.     */
/* ------------------------------------------------------------------ */

export interface Account extends Me {
  createdAt: number;
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
`;

/** columns added since the first register: an old file learns them on opening */
const GROWTH: [table: string, column: string, ddl: string][] = [
  ['accounts', 'email', 'text'],
  ['accounts', 'emailFolded', 'text'],
  ['accounts', 'verifiedAt', 'integer'],
  ['accounts', 'motto', "text not null default ''"],
  ['accounts', 'favoriteColor', 'text'],
  ['games', 'result', 'text'],
];

/** a name is one name whatever the case or the stray spaces around it */
const fold = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');
const foldEmail = (email: string): string => email.trim().toLowerCase();

const token = (): string => randomBytes(24).toString('hex');

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

interface AccountRow {
  id: string;
  name: string;
  createdAt: number;
  email: string | null;
  verifiedAt: number | null;
  motto: string;
  favoriteColor: string | null;
}

const COLORS: PlayerColor[] = ['brass', 'oxblood', 'verdigris', 'steel'];
const ACCOUNT_COLUMNS = 'id, name, createdAt, email, verifiedAt, motto, favoriteColor';

function accountOf(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    email: r.email,
    verified: r.verifiedAt !== null,
    motto: r.motto ?? '',
    favoriteColor: COLORS.includes(r.favoriteColor as PlayerColor) ? (r.favoriteColor as PlayerColor) : null,
  };
}

/** the game's outcome, kept with the game once it is over */
interface Result {
  players: { name: string; color: PlayerColor; vp: number; bot: boolean }[];
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
  }

  close(): void {
    this.db.close();
  }

  /* ---------------------------- accounts --------------------------- */

  /** open an account, or say why it cannot be opened */
  signUp(name: string, email: string, password: string): { account: Account } | { error: SignUpError } {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!NAME_RULE.test(clean)) return { error: 'bad-name' };
    const address = email.trim();
    if (!EMAIL_RULE.test(address) || address.length > 120) return { error: 'bad-email' };
    if (password.length < MIN_PASSWORD) return { error: 'weak-password' };
    const folded = fold(clean);
    if (this.db.prepare('select 1 from accounts where folded = ?').get(folded)) return { error: 'name-taken' };
    if (this.db.prepare('select 1 from accounts where emailFolded = ?').get(foldEmail(address))) return { error: 'email-taken' };
    const id = 'a-' + randomBytes(8).toString('hex');
    const now = Date.now();
    this.db
      .prepare('insert into accounts (id, name, folded, secret, createdAt, email, emailFolded, verifiedAt, motto, favoriteColor) values (?, ?, ?, ?, ?, ?, ?, null, ?, null)')
      .run(id, clean, folded, seal(password), now, address, foldEmail(address), '');
    return { account: this.account(id)! };
  }

  /** the account behind a name (or an address) and a password, or null */
  signIn(name: string, password: string): Account | null {
    const key = name.trim();
    const row = this.db
      .prepare(`select ${ACCOUNT_COLUMNS}, secret from accounts where folded = ? or (emailFolded is not null and emailFolded = ?)`)
      .get(fold(key), foldEmail(key)) as (AccountRow & { secret: string }) | undefined;
    if (!row || !matches(password, row.secret)) return null;
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
    if (next.length < MIN_PASSWORD) return 'weak-password';
    this.db.prepare('update accounts set secret = ? where id = ?').run(seal(next), id);
    this.db.prepare('delete from sessions where accountId = ?').run(id);
    return null;
  }

  /* ---------------------------- letters ---------------------------- */

  /** a token for a letter; any earlier letter of the same kind is void */
  writeLetter(accountId: string, kind: TokenKind): string {
    this.db.prepare('delete from letters where accountId = ? and kind = ?').run(accountId, kind);
    const t = token();
    this.db.prepare('insert into letters (token, accountId, kind, createdAt) values (?, ?, ?, ?)').run(t, accountId, kind, Date.now());
    return t;
  }

  /** the account a letter was written to — the letter is spent */
  openLetter(t: string, kind: TokenKind): Account | null {
    const row = this.db.prepare('select accountId, createdAt from letters where token = ? and kind = ?').get(t, kind) as { accountId: string; createdAt: number } | undefined;
    if (!row) return null;
    this.db.prepare('delete from letters where token = ?').run(t);
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
    this.db.prepare('update accounts set secret = ? where id = ?').run(seal(password), account.id);
    this.db.prepare('delete from sessions where accountId = ?').run(account.id);
    return account;
  }

  /* ---------------------------- sessions --------------------------- */

  /** a token that stands for this account until it is forgotten */
  openSession(accountId: string): string {
    const t = token();
    const now = Date.now();
    this.db.prepare('insert into sessions (token, accountId, createdAt, seenAt) values (?, ?, ?, ?)').run(t, accountId, now, now);
    return t;
  }

  /** whose token this is — and it stays alive by being used */
  session(t: string): Account | null {
    const row = this.db.prepare('select accountId, seenAt from sessions where token = ?').get(t) as { accountId: string; seenAt: number } | undefined;
    if (!row) return null;
    if (Date.now() - row.seenAt > SESSION_MS) {
      this.closeSession(t);
      return null;
    }
    this.db.prepare('update sessions set seenAt = ? where token = ?').run(Date.now(), t);
    return this.account(row.accountId);
  }

  closeSession(t: string): void {
    this.db.prepare('delete from sessions where token = ?').run(t);
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

  /* ---------------------------- feedback --------------------------- */

  /** an idea or a bug, as a player wrote it */
  feedback(accountId: string, page: string, kind: string, text: string): void {
    this.db
      .prepare('insert into feedback (id, accountId, page, kind, text, createdAt) values (?, ?, ?, ?, ?, ?)')
      .run('f-' + randomBytes(6).toString('hex'), accountId, page.slice(0, 120), kind === 'bug' ? 'bug' : 'idea', text.trim().slice(0, 4000), Date.now());
  }

  /* ----------------------------- tables ---------------------------- */

  saveTable(t: Table): void {
    this.db
      .prepare('insert or replace into tables (code, name, hostId, seats, options, status, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(t.code, t.name, t.hostId, JSON.stringify(t.seats), JSON.stringify(t.options), t.status, t.createdAt, t.updatedAt);
  }

  dropTable(code: string): void {
    this.db.prepare('delete from moves where code = ?').run(code);
    this.db.prepare('delete from games where code = ?').run(code);
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
    }[];
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      hostId: r.hostId,
      seats: JSON.parse(r.seats) as Table['seats'],
      options: JSON.parse(r.options) as Table['options'],
      status: r.status === 'starting' ? 'starting' : 'open',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /* ------------------------------ games ---------------------------- */

  openGame(code: string, seed: number, setup: SetupPayload, seatIds: string[]): void {
    this.db
      .prepare('insert or replace into games (code, seed, setup, seats, startedAt, finishedAt, result) values (?, ?, ?, ?, ?, null, null)')
      .run(code, seed, JSON.stringify(setup), JSON.stringify(seatIds), Date.now());
    this.db.prepare('delete from moves where code = ?').run(code);
  }

  /** one accepted action, at its place in the log */
  appendMove(code: string, idx: number, action: GameAction): void {
    this.db.prepare('insert or replace into moves (code, idx, action) values (?, ?, ?)').run(code, idx, JSON.stringify(action));
  }

  /** an action taken back */
  dropMove(code: string, idx: number): void {
    this.db.prepare('delete from moves where code = ? and idx >= ?').run(code, idx);
  }

  /** the game is over: the standings go on the record */
  finishGame(code: string, state?: GameState): void {
    const result: Result | null = state
      ? {
          players: state.players.map((p) => ({ name: p.name, color: p.color as PlayerColor, vp: p.vp, bot: !!p.isBot })),
          winner: state.winner ?? 0,
          abandoned: !!state.abandoned,
        }
      : null;
    this.db.prepare('update games set finishedAt = ?, result = ? where code = ?').run(Date.now(), result ? JSON.stringify(result) : null, code);
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
      .prepare('select g.code, g.seats, g.finishedAt, g.result, t.name from games g left join tables t on t.code = g.code where g.finishedAt is not null and g.result is not null order by g.finishedAt desc')
      .all() as { code: string; seats: string; finishedAt: number; result: string; name: string | null }[];
    const out: PastGame[] = [];
    for (const r of rows) {
      const seatIds = JSON.parse(r.seats) as string[];
      if (!seatIds.includes(accountId)) continue;
      const result = JSON.parse(r.result) as Result;
      out.push({
        code: r.code,
        name: r.name ?? r.code,
        finishedAt: r.finishedAt,
        players: result.players.map((p, i) => ({ id: seatIds[i] ?? '', ...p })),
        winner: result.winner,
        abandoned: result.abandoned,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  statsFor(accountId: string): Stats {
    const games = this.historyFor(accountId, 10_000);
    const mine = games.map((g) => ({ vp: g.players[g.players.findIndex((p) => p.id === accountId)]?.vp ?? 0, won: g.players[g.winner]?.id === accountId }));
    const played = mine.length;
    return {
      played,
      won: mine.filter((m) => m.won).length,
      averageVp: played ? Math.round(mine.reduce((a, m) => a + m.vp, 0) / played) : 0,
      bestVp: mine.reduce((a, m) => Math.max(a, m.vp), 0),
    };
  }
}
