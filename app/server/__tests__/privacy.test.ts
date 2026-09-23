import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { DEPARTED_MS, Store, weakPassword } from '../store';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, PASSWORD, post } from './guest';

/* What the register keeps of a member, and how little a copy of it gives
   away: tokens sealed, passwords worth the name, an account closed and its
   owner forgotten. And the door: a name tried too often waits, a page from
   elsewhere gets no socket. */

describe('the seals', () => {
  const dirs: string[] = [];
  const fresh = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-'));
    dirs.push(dir);
    return path.join(dir, 'test.db');
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('keeps no session or letter token in the clear, and seals the old ones', () => {
    const file = fresh();
    const store = new Store(file);
    const ada = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace');
    if (!('account' in ada)) throw new Error(ada.error);
    const token = store.openSession(ada.account.id);
    const letter = store.writeLetter(ada.account.id, 'verify');
    const db = new DatabaseSync(file);
    const kept = (db.prepare('select token from sessions').all() as { token: string }[]).map((r) => r.token);
    expect(kept).toHaveLength(1);
    expect(kept[0]).not.toBe(token);
    expect(kept[0]).toHaveLength(64);
    expect((db.prepare('select token from letters').get() as { token: string }).token).not.toBe(letter);
    expect(store.session(token)?.name).toBe('Ada');
    expect(store.verify(letter)?.verified).toBe(true);
    /* a register from before: a plain token, sealed on opening, still opens its session */
    const plain = 'ab'.repeat(24);
    db.prepare('insert into sessions (token, accountId, createdAt, seenAt) values (?, ?, ?, ?)').run(plain, ada.account.id, Date.now(), Date.now());
    db.close();
    store.close();
    const again = new Store(file);
    expect(again.session(plain)?.name).toBe('Ada');
    const db2 = new DatabaseSync(file);
    expect((db2.prepare('select count(*) as n from sessions where length(token) = 48').get() as { n: number }).n).toBe(0);
    db2.close();
    again.close();
  });

  it('refuses a password everybody tries, or the member’s own name', () => {
    expect(weakPassword('short')).toBe(true);
    expect(weakPassword('password123')).toBe(true);
    expect(weakPassword('Pass-word-123')).toBe(true);
    expect(weakPassword('aaaaaaaaaa')).toBe(true);
    expect(weakPassword('wedgwood-forever', 'Josiah Wedgwood')).toBe(true);
    expect(weakPassword('my-nicolas-key', 'Ada', 'nicolas@example.test')).toBe(true);
    expect(weakPassword('countess-of-lovelace', 'Ada', 'ada@example.test')).toBe(false);
    expect(weakPassword('another-password-1', 'Ada Lovelace', 'other@example.test')).toBe(false);
  });

  it('closes an account and forgets its owner, keeps the law’s copy', () => {
    const file = fresh();
    const store = new Store(file);
    const ada = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace', { ip: '10.0.0.1', accepted: true });
    const bob = store.signUp('Bob', 'bob@example.test', 'another-password-1');
    if (!('account' in ada) || !('account' in bob)) throw new Error('accounts');
    expect(ada.account.acceptedAt).not.toBeNull();
    store.befriend(ada.account.id, bob.account.id);
    const token = store.openSession(ada.account.id);
    const taken = store.exportOf(ada.account.id)!;
    expect((taken.friends as unknown[]).length).toBe(1);
    expect((taken.account as { email: string; createdIp: string }).email).toBe('ada@example.test');
    expect((taken.account as { createdIp: string }).createdIp).toBe('10.0.0.1');

    expect(store.closeAccount(ada.account.id, 'wrong')).toBe('wrong-password');
    expect(store.closeAccount(ada.account.id, 'countess-of-lovelace')).toBeNull();
    expect(store.closeAccount(ada.account.id, 'countess-of-lovelace')).toBe('not-found');
    expect(store.session(token)).toBeNull();
    expect(store.signIn('Ada', 'countess-of-lovelace')).toBeNull();
    expect(store.accountByEmail('ada@example.test')).toBeNull();
    /* the name is free again, the account reads as a number */
    expect('account' in store.signUp('Ada', 'ada2@example.test', 'countess-of-lovelace')).toBe(true);
    expect(store.account(ada.account.id)?.name).toMatch(/^Membre [0-9a-f]{6}$/);
    expect(store.friendsOf(bob.account.id)).toHaveLength(0);
    const db = new DatabaseSync(file);
    expect(db.prepare('select name, email from departed').get()).toMatchObject({ name: 'Ada', email: 'ada@example.test' });
    expect((db.prepare('select createdIp from accounts where id = ?').get(ada.account.id) as { createdIp: string | null }).createdIp).toBeNull();
    /* the sweep: the law's copy goes after five years */
    store.sweepPrivacy(Date.now() + 1000);
    expect((db.prepare('select count(*) as n from departed').get() as { n: number }).n).toBe(1);
    store.sweepPrivacy(Date.now() + DEPARTED_MS + 1000);
    expect((db.prepare('select count(*) as n from departed').get() as { n: number }).n).toBe(0);
    db.close();
    store.close();
  });
});

describe('the door', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  afterEach(async () => {
    for (const g of guests.splice(0)) g.close();
    await server?.close();
    server = null;
  });
  const arrive = async (name: string) => {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    await g.signUp();
    return g;
  };
  const answer = (g: Guest, rid: number) => g.until(`rid ${rid}`, () => !!g.frames.find((f) => 'rid' in f && f.rid === rid)).then(() => g.frames.find((f) => 'rid' in f && f.rid === rid)!);

  it('asks for the charter, waits after too many wrong passwords, and gives no socket to a page from elsewhere', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:', origins: ['https://blackrail.example'] });
    const ada = await arrive('Ada');
    const dan = new Guest('Dan');
    guests.push(dan);
    await dan.open(server.port);
    dan.send({ t: 'signup', rid: 1, name: 'Dan', email: 'dan@example.test', password: PASSWORD, accept: false });
    expect(await answer(dan, 1)).toMatchObject({ t: 'refused', error: 'must-accept' });
    /* eight wrong passwords, over fresh sockets so no single one is throttled:
       the ninth try is not even looked at, right or wrong */
    for (let i = 0; i < 8; i++) {
      const knock = new Guest(`Knock${i}`);
      guests.push(knock);
      await knock.open(server.port);
      knock.send({ t: 'signin', rid: 10 + i, name: 'Ada', password: 'not-it-at-all-' + i });
      expect(await answer(knock, 10 + i)).toMatchObject({ t: 'refused', error: 'bad-credentials' });
    }
    dan.send({ t: 'signin', rid: 30, name: 'ada', password: PASSWORD });
    expect(await answer(dan, 30)).toMatchObject({ t: 'refused', error: 'too-many-attempts' });
    expect(ada.me?.name).toBe('Ada');
    /* a browser page on another site: the handshake is refused */
    const refused = await new Promise<boolean>((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server!.port}`, { origin: 'https://evil.example' });
      ws.once('unexpected-response', () => ok(true));
      ws.once('error', () => ok(true));
      ws.once('open', () => {
        ws.close();
        ok(false);
      });
    });
    expect(refused).toBe(true);
    const welcome = await new Promise<boolean>((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server!.port}`, { origin: 'https://blackrail.example' });
      ws.once('error', () => ok(false));
      ws.once('open', () => {
        ws.close();
        ok(true);
      });
    });
    expect(welcome).toBe(true);
  });

  it('hands a member their data, and closes the account on their word', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const ada = await arrive('Ada');
    ada.send({ t: 'export', rid: 40 });
    const taken = await answer(ada, 40);
    expect(taken.t).toBe('export');
    expect(taken.t === 'export' ? (taken.data.account as { name: string }).name : '').toBe('Ada');
    ada.send({ t: 'close', rid: 41, password: 'wrong-one-entirely' });
    expect(await answer(ada, 41)).toMatchObject({ t: 'refused', error: 'wrong-password' });
    ada.send({ t: 'close', rid: 42, password: PASSWORD });
    expect((await answer(ada, 42)).t).toBe('done');
    ada.send({ t: 'desk', rid: 43 });
    expect(await answer(ada, 43)).toMatchObject({ t: 'refused', error: 'sign-in-first' });
    expect(server.store.signIn('Ada', PASSWORD)).toBeNull();
  });
});
