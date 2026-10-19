import { afterEach, describe, expect, it } from 'vitest';
import { UNCONFIRMED_MS, Waitlist } from '../waitlist';
import { serve } from '../index';
import type { Serving } from '../index';
import type { Mail, Mailer } from '../mail';
import type { WaitBook } from '@/online/waitlist';
import { reach } from '@/online/waitlist';
import { Guest, post } from './guest';

/* The waiting list: an address kept only once it answers, struck when it
   does not or when it asks to leave, and the circulars cut into letters
   that leave a few at a time under the day's cap. And the door: a page
   elsewhere writes nothing, a member who is not of the direction reads
   nothing. */

const tokenOf = (mail: Mail | undefined, path: 'confirmer' | 'retrait'): string => mail?.text.match(new RegExp(`/avant-premiere/${path}/([a-f0-9]{48})`))?.[1] ?? '';

describe('the list', () => {
  it('keeps an address once, and only answered ones are written to', () => {
    const w = new Waitlist(':memory:');
    const first = w.enter('Ada@Example.test', 'fr', 'forum', '1.2.3.4', 1000);
    expect(first.kind).toBe('letter');
    /* the same address again, a moment later: nothing leaves */
    expect(w.enter(' ada@example.test ', 'en', '', '1.2.3.4', 2000).kind).toBe('known');
    /* ten minutes on, unanswered: a second letter, and only the new link works */
    const again = w.enter('ada@example.test', 'en', '', '1.2.3.4', 1000 + 11 * 60 * 1000);
    expect(again.kind).toBe('letter');
    if (first.kind !== 'letter' || again.kind !== 'letter') throw new Error('no letter');
    expect(again.lang).toBe('fr');
    expect(w.confirm(first.token)).toBe(0);
    expect(w.enter('not an address', 'fr', '', '', 0).kind).toBe('bad-email');
    expect(reach(w.entrants(), { lang: null, fresh: false, limit: null })).toHaveLength(0);
    expect(w.confirm(again.token)).toBe(1);
    expect(w.confirm(again.token)).toBe(0);
    expect(w.seatsLeft()).toBe(99);
    expect(w.enter('ada@example.test', 'fr', '', '', 10 ** 13).kind).toBe('known');
    const [ada] = w.entrants();
    expect(ada).toMatchObject({ email: 'Ada@Example.test', lang: 'fr', source: 'forum', letters: 0, awaiting: 0 });
    expect(ada.confirmedAt).not.toBeNull();
    w.close();
  });

  it('strikes the unanswered after a week, and a line that leaves', () => {
    const w = new Waitlist(':memory:');
    w.enter('late@example.test', 'en', '', '', 0);
    const kept = w.enter('kept@example.test', 'en', '', '', 0);
    if (kept.kind !== 'letter') throw new Error('no letter');
    w.confirm(kept.token);
    w.sweep(UNCONFIRMED_MS + 1);
    expect(w.entrants().map((e) => e.email)).toEqual(['kept@example.test']);
    expect(w.leave('f'.repeat(48))).toBe(false);
    expect(w.leave(kept.leave)).toBe(true);
    expect(w.entrants()).toEqual([]);
    w.close();
  });

  it('cuts a circular into letters, the earliest first, and counts what left', () => {
    const w = new Waitlist(':memory:');
    for (const [i, lang] of (['fr', 'en', 'fr', 'de'] as const).entries()) {
      const e = w.enter(`p${i}@example.test`, lang, '', '', i);
      if (e.kind === 'letter') w.confirm(e.token);
    }
    expect(w.write('Hello', 'Body', { lang: 'es', fresh: false, limit: null })).toBeNull();
    const c = w.write('Invitation', 'Come aboard', { lang: 'fr', fresh: true, limit: 1 }, 100);
    expect(c).toMatchObject({ total: 1, sent: 0 });
    /* the second invitation passes over whoever the first one reached */
    const c2 = w.write('Invitation', 'Come aboard', { lang: 'fr', fresh: true, limit: 5 }, 200);
    expect(c2?.total).toBe(1);
    const due = w.due(10);
    expect(due.map((d) => d.email)).toEqual(['p0@example.test', 'p2@example.test']);
    w.posted(due[0].circularId, due[0].entrantId, null, 5000);
    for (let i = 0; i < 3; i++) w.posted(due[1].circularId, due[1].entrantId, 'turned down');
    expect(w.due(10)).toEqual([]);
    expect(w.sentSince(4000)).toBe(1);
    const [second, first] = w.circulars();
    expect(first.id).toBe(c!.id);
    expect(first).toMatchObject({ sent: 1, failed: 0 });
    expect(second).toMatchObject({ sent: 0, failed: 1 });
    /* a stopped circular leaves nothing more */
    const c3 = w.write('News', 'Line', { lang: null, fresh: false, limit: null });
    w.stop(c3!.id);
    expect(w.due(10)).toEqual([]);
    w.close();
  });
});

describe('the front desk and the direction', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const sent: Mail[] = [];
  const mailer: Mailer = {
    async send(mail) {
      sent.push(mail);
      /* the members' own letters go where the test guests look for them */
      await post.send(mail);
    },
  };
  afterEach(async () => {
    for (const g of guests.splice(0)) g.close();
    await server?.close();
    server = null;
    sent.length = 0;
  });
  const open = () => serve({ port: 0, mailer, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, editionEvery: 0, circularEvery: 0, file: ':memory:', origins: ['https://blackrail.example'], admins: ['ada@example.test'], appUrl: 'https://blackrail.example', officeUrl: 'https://office.blackrail.example', locate: (ip) => (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ? 'IN' : '') });
  const at = (path: string, body: unknown, origin = 'https://blackrail.example') =>
    fetch(`http://127.0.0.1:${server!.port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  const until = async (what: string, ready: () => boolean) => {
    for (let i = 0; i < 200 && !ready(); i++) await new Promise((r) => setTimeout(r, 10));
    if (!ready()) throw new Error(`waited in vain for ${what}`);
  };

  it('takes an address from the page, answers its letter, and lets it go', async () => {
    server = await open();
    expect((await at('/waitlist', { email: 'reader@example.test', lang: 'de', via: 'bgg' })).status).toBe(202);
    await until('the letter', () => sent.length === 1);
    expect(sent[0].subject).toContain('Blackrail');
    expect(sent[0].text).toContain('https://blackrail.example/avant-premiere/confirmer/');
    const answered = await at('/waitlist/confirm', { token: tokenOf(sent[0], 'confirmer') });
    expect(answered.status).toBe(200);
    /* the first to answer is the first founder, and a seat is gone */
    expect(await answered.json()).toMatchObject({ rank: 1, founder: true });
    expect((await at('/waitlist/confirm', { token: tokenOf(sent[0], 'confirmer') })).status).toBe(404);
    const seats = await fetch(`http://127.0.0.1:${server!.port}/waitlist/seats`, { headers: { origin: 'https://blackrail.example' } });
    expect(await seats.json()).toEqual({ left: 99, of: 100 });
    /* a page elsewhere writes nothing, and a machine filling the hidden field keeps nothing */
    expect((await at('/waitlist', { email: 'x@example.test' }, 'https://elsewhere.example')).status).toBe(403);
    expect((await at('/waitlist', { email: 'bot@example.test', website: 'spam' })).status).toBe(202);
    expect((await at('/waitlist', { email: 'nonsense' })).status).toBe(400);
    expect(sent).toHaveLength(1);
  });

  it('opens the book to the direction only, and posts a circular with its way out', async () => {
    server = await open();
    await at('/waitlist', { email: 'reader@example.test', lang: 'en' });
    await until('the letter', () => sent.length === 1);
    await at('/waitlist/confirm', { token: tokenOf(sent[0], 'confirmer') });

    const bob = new Guest('Bob');
    guests.push(bob);
    await bob.open(server.port);
    await bob.signUp();
    bob.send({ t: 'admin.book', rid: 90 });
    await bob.until('a refusal', () => bob.rejected.includes('not-allowed'));

    const ada = new Guest('Ada');
    guests.push(ada);
    await ada.open(server.port);
    await ada.signUp();
    expect(ada.me?.admin).toBe(true);
    const bookOf = async (rid: number): Promise<WaitBook> => {
      await ada.until(`rid ${rid}`, () => ada.frames.some((f) => f.t === 'admin.book' && f.rid === rid));
      const f = ada.frames.find((x) => x.t === 'admin.book' && x.rid === rid);
      if (!f || f.t !== 'admin.book') throw new Error('no book');
      return f.book;
    };
    ada.send({ t: 'admin.book', rid: 91 });
    const book = await bookOf(91);
    expect(book.entrants).toHaveLength(1);
    /* the country is read from the address when it is left, and only it is kept */
    expect(book.entrants[0].country).toBe('IN');
    expect(book.cap).toBe(80);

    ada.send({ t: 'admin.circular', rid: 92, subject: 'The trial opens', body: 'Your seat is ready.', audience: { lang: null, fresh: true, limit: null } });
    expect((await bookOf(92)).circulars[0]).toMatchObject({ total: 1 });
    await until('the circular letter', () => sent.some((m) => m.to === 'reader@example.test' && m.subject === 'The trial opens'));
    const circular = sent.find((m) => m.subject === 'The trial opens')!;
    expect(circular.text).toContain('Your seat is ready.');
    const leave = tokenOf(circular, 'retrait');
    expect(circular.headers?.['List-Unsubscribe']).toBe(`<https://office.blackrail.example/waitlist/leave?t=${leave}>`);

    /* the post's one-click way out: no page, a form for a body */
    const out = await fetch(`http://127.0.0.1:${server.port}/waitlist/leave?t=${leave}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    expect(out.status).toBe(200);
    ada.send({ t: 'admin.book', rid: 93 });
    const after = await bookOf(93);
    expect(after.entrants).toEqual([]);
    expect(after.circulars[0]).toMatchObject({ total: 1, sent: 1 });
  });
});
