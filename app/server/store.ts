import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { GameAction } from '@/game/actions';
import type { SetupPayload } from '@/game/types';
import type { Identity, Table } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The register — everything the house must not forget.                */
/*                                                                     */
/* Accounts and their sessions, the tables, and every game as what a   */
/* game really is: a seed and a list of moves. Nothing derived is kept */
/* on disk; a restart replays the moves and the board is back, which   */
/* is also the strongest check that the log and the engine agree.      */
/*                                                                     */
/* SQLite comes with Node itself — no native build, no dependency.     */
/* ------------------------------------------------------------------ */

export interface Account extends Identity {
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

export type SignUpError = 'bad-name' | 'weak-password' | 'name-taken';

/** names are short, printable and unique once folded */
export const NAME_RULE = /^[\p{L}\p{N} ._'-]{2,20}$/u;
export const MIN_PASSWORD = 8;
/** a session lasts a month of silence */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const SCHEMA = `
create table if not exists accounts (
  id        text primary key,
  name      text not null,
  folded    text not null unique,
  secret    text not null,
  createdAt integer not null
);
create table if not exists sessions (
  token     text primary key,
  accountId text not null references accounts(id) on delete cascade,
  createdAt integer not null,
  seenAt    integer not null
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
  finishedAt integer
);
create table if not exists moves (
  code   text not null,
  idx    integer not null,
  action text not null,
  primary key (code, idx)
);
`;

/** a name is one name whatever the case or the stray spaces around it */
const fold = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

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

export class Store {
  private db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('pragma journal_mode = wal');
    this.db.exec('pragma foreign_keys = on');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  /* ---------------------------- accounts --------------------------- */

  /** open an account, or say why it cannot be opened */
  signUp(name: string, password: string): { account: Account } | { error: SignUpError } {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!NAME_RULE.test(clean)) return { error: 'bad-name' };
    if (password.length < MIN_PASSWORD) return { error: 'weak-password' };
    const folded = fold(clean);
    if (this.db.prepare('select 1 from accounts where folded = ?').get(folded)) return { error: 'name-taken' };
    const account: Account = { id: 'a-' + randomBytes(8).toString('hex'), name: clean, createdAt: Date.now() };
    this.db
      .prepare('insert into accounts (id, name, folded, secret, createdAt) values (?, ?, ?, ?, ?)')
      .run(account.id, account.name, folded, seal(password), account.createdAt);
    return { account };
  }

  /** the account behind a name and a password, or null */
  signIn(name: string, password: string): Account | null {
    const row = this.db.prepare('select id, name, secret, createdAt from accounts where folded = ?').get(fold(name)) as
      | { id: string; name: string; secret: string; createdAt: number }
      | undefined;
    if (!row || !matches(password, row.secret)) return null;
    return { id: row.id, name: row.name, createdAt: row.createdAt };
  }

  account(id: string): Account | null {
    const row = this.db.prepare('select id, name, createdAt from accounts where id = ?').get(id) as Account | undefined;
    return row ?? null;
  }

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

  /* ----------------------------- tables ---------------------------- */

  saveTable(t: Table): void {
    this.db
      .prepare('insert or replace into tables (code, name, hostId, seats, options, status, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(t.code, t.name, t.hostId, JSON.stringify(t.seats), JSON.stringify(t.options), t.status, t.createdAt, t.updatedAt);
  }

  dropTable(code: string): void {
    this.db.prepare('delete from moves where code = ?').run(code);
    this.db.prepare('delete from games where code = ?').run(code);
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
      .prepare('insert or replace into games (code, seed, setup, seats, startedAt, finishedAt) values (?, ?, ?, ?, ?, null)')
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

  finishGame(code: string): void {
    this.db.prepare('update games set finishedAt = ? where code = ?').run(Date.now(), code);
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
}
