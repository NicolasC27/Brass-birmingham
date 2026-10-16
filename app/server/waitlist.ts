import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { WAIT_LANGS, reach } from '@/online/waitlist';
import type { Audience, Circular, Entrant, WaitBook, WaitLang } from '@/online/waitlist';

/* ------------------------------------------------------------------ */
/* The waiting list.                                                   */
/*                                                                     */
/* Before the line opens, the front page takes addresses. Each one     */
/* gets a letter to answer — an address nobody answers for is struck   */
/* after a week — and every letter after that carries its own way out: */
/* one click and the line is gone, with nothing kept of it.            */
/*                                                                     */
/* The direction writes circulars to the list; each is cut into one    */
/* letter per address, and the office posts them a few at a time,     */
/* under the day's cap, so the post never sees a flood from a new      */
/* sender. Kept in the register's own file, beside the accounts.       */
/* ------------------------------------------------------------------ */

const SCHEMA = `
create table if not exists waitlist (
  id            text primary key,
  email         text not null,
  emailFolded   text not null unique,
  lang          text not null,
  source        text not null default '',
  ip            text,
  createdAt     integer not null,
  /* the letter's link, sealed as the account letters are; null once answered */
  confirmSeal   text unique,
  confirmSentAt integer,
  confirmedAt   integer,
  /* the way out printed in every letter. Kept in the clear: it can do
     nothing but strike its own line */
  leave         text not null unique
);
create table if not exists circulars (
  id        text primary key,
  subject   text not null,
  body      text not null,
  audience  text not null,
  createdAt integer not null,
  stoppedAt integer
);
/* one letter of a circular to one address. A line struck from the list
   takes its letters still waiting with it; those already sent stay, with
   no address, so the circular's count holds */
create table if not exists circular_post (
  circularId text not null,
  entrantId  text not null,
  sentAt     integer,
  tries      integer not null default 0,
  error      text,
  primary key (circularId, entrantId)
);
`;

/** an address nobody answered for is struck after a week */
export const UNCONFIRMED_MS = 7 * 24 * 60 * 60 * 1000;
/** a second letter to answer, at most every ten minutes */
export const RESEND_MS = 10 * 60 * 1000;
/** a letter the post turns down this many times is given up */
export const TRIES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const token = (): string => randomBytes(24).toString('hex');
const sealed = (t: string): string => createHash('sha256').update(t).digest('hex');
const foldEmail = (email: string): string => email.trim().toLowerCase();
export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_EMAIL = 254;

export type Entry =
  /** a new line, or one not answered yet: the letter to answer goes out with this token */
  | { kind: 'letter'; token: string; email: string; lang: WaitLang; leave: string }
  /** already on the list, or asked again too soon: nothing leaves */
  | { kind: 'known' }
  | { kind: 'bad-email' };

/** one letter of a circular, ready for the post */
export interface Due {
  circularId: string;
  entrantId: string;
  email: string;
  lang: WaitLang;
  leave: string;
  subject: string;
  body: string;
}

interface EntrantRow {
  id: string;
  email: string;
  lang: string;
  source: string;
  createdAt: number;
  confirmedAt: number | null;
  letters: number;
  awaiting: number;
}

interface CircularRow {
  id: string;
  subject: string;
  body: string;
  audience: string;
  createdAt: number;
  stoppedAt: number | null;
  total: number;
  sent: number;
  failed: number;
}

const langOf = (l: string): WaitLang => ((WAIT_LANGS as readonly string[]).includes(l) ? (l as WaitLang) : 'en');

export class Waitlist {
  private db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('pragma busy_timeout = 5000');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  /** an address left on the front page */
  enter(email: string, lang: string, source: string, ip: string, now = Date.now()): Entry {
    const address = String(email ?? '').trim();
    if (address.length > MAX_EMAIL || !EMAIL_RULE.test(address)) return { kind: 'bad-email' };
    const folded = foldEmail(address);
    const had = this.db.prepare('select id, lang, confirmedAt, confirmSentAt, leave from waitlist where emailFolded = ?').get(folded) as { id: string; lang: string; confirmedAt: number | null; confirmSentAt: number | null; leave: string } | undefined;
    const t = token();
    if (had) {
      /* answered already, or a letter left a moment ago: the page says the
         same thing either way, and nothing tells a stranger which it was */
      if (had.confirmedAt !== null || (had.confirmSentAt !== null && now - had.confirmSentAt < RESEND_MS)) return { kind: 'known' };
      this.db.prepare('update waitlist set confirmSeal = ?, confirmSentAt = ? where id = ?').run(sealed(t), now, had.id);
      return { kind: 'letter', token: t, email: address, lang: langOf(had.lang), leave: had.leave };
    }
    const id = 'w-' + randomBytes(8).toString('hex');
    const leave = token();
    const l = langOf(lang);
    this.db
      .prepare('insert into waitlist (id, email, emailFolded, lang, source, ip, createdAt, confirmSeal, confirmSentAt, confirmedAt, leave) values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, ?)')
      .run(id, address, folded, l, String(source ?? '').slice(0, 120), ip || null, now, sealed(t), now, leave);
    return { kind: 'letter', token: t, email: address, lang: l, leave };
  }

  /** the letter answered: true when the token named a line */
  confirm(t: string, now = Date.now()): boolean {
    if (typeof t !== 'string' || !/^[0-9a-f]{48}$/.test(t)) return false;
    /* the address that answers is kept, not the machine it answered from */
    const r = this.db.prepare('update waitlist set confirmedAt = ?, confirmSeal = null, ip = null where confirmSeal = ?').run(now, sealed(t));
    return Number(r.changes) > 0;
  }

  /** the way out taken: the line is struck */
  leave(t: string): boolean {
    if (typeof t !== 'string' || !/^[0-9a-f]{48}$/.test(t)) return false;
    const row = this.db.prepare('select id from waitlist where leave = ?').get(t) as { id: string } | undefined;
    return row ? this.strike(row.id) : false;
  }

  /** a line struck, and its letters still waiting with it */
  strike(id: string): boolean {
    this.db.prepare('delete from circular_post where entrantId = ? and sentAt is null').run(id);
    return Number(this.db.prepare('delete from waitlist where id = ?').run(id).changes) > 0;
  }

  /** the lines nobody answered for in a week go */
  sweep(now = Date.now()): void {
    const stale = this.db.prepare('select id from waitlist where confirmedAt is null and createdAt < ?').all(now - UNCONFIRMED_MS) as { id: string }[];
    for (const { id } of stale) this.strike(id);
  }

  entrants(): Entrant[] {
    const rows = this.db
      .prepare(
        `select w.id, w.email, w.lang, w.source, w.createdAt, w.confirmedAt,
           (select count(*) from circular_post p where p.entrantId = w.id and p.sentAt is not null) as letters,
           (select count(*) from circular_post p join circulars c on c.id = p.circularId
              where p.entrantId = w.id and p.sentAt is null and p.tries < ${TRIES} and c.stoppedAt is null) as awaiting
         from waitlist w order by w.createdAt desc`,
      )
      .all() as unknown as EntrantRow[];
    return rows.map((r) => ({ id: r.id, email: r.email, lang: langOf(r.lang), source: r.source, createdAt: r.createdAt, confirmedAt: r.confirmedAt, letters: Number(r.letters), awaiting: Number(r.awaiting) }));
  }

  circulars(): Circular[] {
    const rows = this.db
      .prepare(
        `select c.id, c.subject, c.body, c.audience, c.createdAt, c.stoppedAt,
           (select count(*) from circular_post p where p.circularId = c.id) as total,
           (select count(*) from circular_post p where p.circularId = c.id and p.sentAt is not null) as sent,
           (select count(*) from circular_post p where p.circularId = c.id and p.sentAt is null and p.tries >= ${TRIES}) as failed
         from circulars c order by c.createdAt desc`,
      )
      .all() as unknown as CircularRow[];
    return rows.map((r) => ({ id: r.id, subject: r.subject, body: r.body, audience: JSON.parse(r.audience) as Audience, createdAt: r.createdAt, stoppedAt: r.stoppedAt, total: Number(r.total), sent: Number(r.sent), failed: Number(r.failed) }));
  }

  /** the circular letters that left in the last day */
  sentSince(since: number): number {
    return Number((this.db.prepare('select count(*) as n from circular_post where sentAt >= ?').get(since) as { n: number }).n);
  }

  book(cap: number, now = Date.now()): WaitBook {
    return { entrants: this.entrants(), circulars: this.circulars(), cap, sentToday: this.sentSince(now - DAY_MS) };
  }

  /** a circular written: one letter set aside for each address it reaches */
  write(subject: string, body: string, audience: Audience, now = Date.now()): Circular | null {
    const to = reach(this.entrants(), audience);
    if (!to.length) return null;
    const id = 'c-' + randomBytes(8).toString('hex');
    this.db.exec('begin');
    try {
      this.db.prepare('insert into circulars (id, subject, body, audience, createdAt, stoppedAt) values (?, ?, ?, ?, ?, null)').run(id, subject, body, JSON.stringify(audience), now);
      const add = this.db.prepare('insert into circular_post (circularId, entrantId) values (?, ?)');
      for (const e of to) add.run(id, e.id);
      this.db.exec('commit');
    } catch (e) {
      this.db.exec('rollback');
      throw e;
    }
    return this.circulars().find((c) => c.id === id) ?? null;
  }

  /** a circular stopped: its letters still waiting stay where they are */
  stop(id: string, now = Date.now()): boolean {
    return Number(this.db.prepare('update circulars set stoppedAt = ? where id = ? and stoppedAt is null').run(now, id).changes) > 0;
  }

  /** the next letters to post, the oldest circular first */
  due(n: number): Due[] {
    if (n <= 0) return [];
    const rows = this.db
      .prepare(
        `select p.circularId, p.entrantId, w.email, w.lang, w.leave, c.subject, c.body
         from circular_post p
         join circulars c on c.id = p.circularId
         join waitlist w on w.id = p.entrantId
         where p.sentAt is null and p.tries < ${TRIES} and c.stoppedAt is null
         order by c.createdAt, w.createdAt
         limit ?`,
      )
      .all(n) as unknown as (Omit<Due, 'lang'> & { lang: string })[];
    return rows.map((r) => ({ ...r, lang: langOf(r.lang) }));
  }

  /** a letter posted, or turned down by the post */
  posted(circularId: string, entrantId: string, error: string | null, now = Date.now()): void {
    if (error === null) this.db.prepare('update circular_post set sentAt = ?, error = null where circularId = ? and entrantId = ?').run(now, circularId, entrantId);
    else this.db.prepare('update circular_post set tries = tries + 1, error = ? where circularId = ? and entrantId = ?').run(error.slice(0, 300), circularId, entrantId);
  }
}
