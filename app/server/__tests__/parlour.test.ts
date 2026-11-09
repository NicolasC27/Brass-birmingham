import { afterEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@/online/protocol';
import { HALL, friendRoom, tableRoom } from '@/online/parlour';
import type { Line, Unread } from '@/online/parlour';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, OPTIONS, post } from './guest';

/* ------------------------------------------------------------------ */
/* The parlour over the wire: the hall for every member, a room for    */
/* two friends, a room for a table's seats — who hears a line, who may */
/* say one, what is left unread, and the direction's silence.          */
/* ------------------------------------------------------------------ */

const heard = (g: Guest): Line[] => g.frames.filter((f): f is Extract<ServerMessage, { t: 'said' }> => f.t === 'said').map((f) => f.line);
const pages = (g: Guest) => g.frames.filter((f): f is Extract<ServerMessage, { t: 'lines' }> => f.t === 'lines');
const unread = (g: Guest): Unread[] | null => {
  const last = [...g.frames].reverse().find((f): f is Extract<ServerMessage, { t: 'unread' }> => f.t === 'unread');
  return last ? last.rooms : null;
};
const refusals = (g: Guest, rid: number) => g.frames.filter((f): f is Extract<ServerMessage, { t: 'refused' }> => f.t === 'refused' && f.rid === rid).map((f) => f.error);

describe('the parlour', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  async function open() {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, editionEvery: 0, circularEvery: 0, file: ':memory:', admins: ['ada@example.test'] });
    return server;
  }

  async function arrive(name: string, verify = true): Promise<Guest> {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    await g.signUp(verify);
    return g;
  }

  /** two members, friends: the room they share */
  async function befriend(a: Guest, b: Guest): Promise<string> {
    a.send({ t: 'friend', rid: 101, name: b.name });
    await a.until('the asking', () => a.done.includes(101));
    b.send({ t: 'friend', rid: 102, name: a.name });
    await b.until('the accepting', () => b.done.includes(102));
    a.send({ t: 'desk', rid: 103 });
    await a.until('the desk', () => !!a.desk?.friends.some((f) => f.status === 'friends'));
    return a.desk!.friends.find((f) => f.account.name === b.name)!.id;
  }

  it('carries a line said in the hall to every member, and to no stranger', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const guest = await arrive('Cal', false);
    ada.send({ t: 'say', rid: 1, room: HALL, text: '  Good   morning, all.  ' });
    await bob.until('the line', () => heard(bob).length === 1);
    expect(heard(bob)[0]).toMatchObject({ room: HALL, from: { id: ada.id, name: 'Ada' }, text: 'Good morning, all.' });
    expect(heard(ada)).toHaveLength(1);
    expect(ada.done).toContain(1);
    /* an address that has not answered its letter neither hears nor speaks */
    guest.send({ t: 'say', rid: 2, room: HALL, text: 'Hello?' });
    await guest.until('the refusal', () => refusals(guest, 2).length === 1);
    expect(refusals(guest, 2)).toEqual(['verify-first']);
    expect(heard(guest)).toHaveLength(0);
    /* the hall is read back, oldest first */
    bob.send({ t: 'say', rid: 3, room: HALL, text: 'Morning.' });
    await ada.until('the answer', () => heard(ada).length === 2);
    ada.send({ t: 'lines', rid: 4, room: HALL });
    await ada.until('the page', () => pages(ada).length === 1);
    expect(pages(ada)[0].lines.map((l) => l.text)).toEqual(['Good morning, all.', 'Morning.']);
    expect(pages(ada)[0].more).toBe(false);
  });

  it('turns down an empty line, one too long, and a shower of them', async () => {
    await open();
    const ada = await arrive('Ada');
    ada.send({ t: 'say', rid: 1, room: HALL, text: '   ' });
    ada.send({ t: 'say', rid: 2, room: HALL, text: 'x'.repeat(281) });
    await ada.until('two refusals', () => refusals(ada, 1).length === 1 && refusals(ada, 2).length === 1);
    expect(refusals(ada, 1)).toEqual(['too-long']);
    expect(refusals(ada, 2)).toEqual(['too-long']);
    for (let i = 0; i < 6; i++) ada.send({ t: 'say', rid: 10 + i, room: HALL, text: `line ${i}` });
    await ada.until('the sixth turned down', () => refusals(ada, 15).length === 1);
    expect(heard(ada)).toHaveLength(5);
    expect(refusals(ada, 15)).toEqual(['refused']);
    /* a room the office does not keep */
    ada.send({ t: 'say', rid: 20, room: 'attic', text: 'anyone?' });
    await ada.until('the refusal', () => refusals(ada, 20).length === 1);
    expect(refusals(ada, 20)).toEqual(['not-found']);
  });

  it("keeps a friends' room to the two of them, for as long as the friendship lasts", async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const dan = await arrive('Dan');
    const room = friendRoom(await befriend(ada, bob));
    ada.send({ t: 'say', rid: 1, room, text: 'Between us.' });
    await bob.until('the line', () => heard(bob).length === 1);
    expect(heard(bob)[0]).toMatchObject({ room, text: 'Between us.' });
    expect(heard(dan)).toHaveLength(0);
    dan.send({ t: 'lines', rid: 2, room });
    await dan.until('the refusal', () => refusals(dan, 2).length === 1);
    expect(refusals(dan, 2)).toEqual(['not-found']);
    /* the friendship over, the room is closed to both */
    bob.send({ t: 'unfriend', rid: 3, id: room.slice('friend:'.length) });
    await bob.until('the parting', () => bob.done.includes(3));
    ada.send({ t: 'say', rid: 4, room, text: 'Still there?' });
    await ada.until('the refusal', () => refusals(ada, 4).length === 1);
    expect(refusals(ada, 4)).toEqual(['not-found']);
  });

  it('tells a member what was said while they were away, until they have read it', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const room = friendRoom(await befriend(ada, bob));
    const token = bob.token;
    bob.close();
    ada.send({ t: 'say', rid: 1, room, text: 'One.' });
    ada.send({ t: 'say', rid: 2, room, text: 'Two.' });
    await ada.until('both carried', () => ada.done.includes(2));
    /* back with the token: the office says what waits */
    const back = new Guest('Bob');
    guests.push(back);
    await back.open(server!.port);
    await back.signInWith(token);
    await back.until('the unread', () => unread(back) !== null);
    expect(unread(back)).toEqual([{ room, count: 2, at: heard(ada)[1].at }]);
    /* read up to the last line: nothing waits any more */
    back.send({ t: 'seen', room, at: heard(ada)[1].at });
    await back.until('the count cleared', () => unread(back)?.length === 0);
    /* what I said myself was never unread */
    back.send({ t: 'say', rid: 3, room, text: 'Three.' });
    await back.until('carried', () => back.done.includes(3));
    expect(server!.store.unreadOf(back.id, [room])).toEqual([]);
    expect(server!.store.unreadOf(ada.id, [room])).toEqual([{ room, count: 1, at: expect.any(Number) }]);
  });

  it("opens a table's room to its seats, and lets a watcher read it", async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const eve = await arrive('Eve');
    ada.send({ t: 'create', rid: 1, options: OPTIONS });
    await ada.until('the table', () => !!ada.table);
    const code = ada.table!.code;
    const room = tableRoom(code);
    /* not seated, not watching: the room is not Bob's */
    bob.send({ t: 'lines', rid: 2, room });
    await bob.until('the refusal', () => refusals(bob, 2).length === 1);
    expect(refusals(bob, 2)).toEqual(['not-found']);
    bob.send({ t: 'join', rid: 3, code });
    await bob.until('the seat', () => !!bob.table);
    bob.send({ t: 'say', rid: 4, room, text: 'Ready when you are.' });
    await ada.until('the line', () => heard(ada).length === 1);
    expect(heard(ada)[0]).toMatchObject({ room, from: { name: 'Bob' } });
    /* a watcher reads along, and hears what follows, but may not speak */
    eve.send({ t: 'watch', code });
    await eve.until('the table', () => !!eve.table);
    eve.send({ t: 'lines', rid: 5, room });
    await eve.until('the page', () => pages(eve).length === 1);
    expect(pages(eve)[0].lines.map((l) => l.text)).toEqual(['Ready when you are.']);
    eve.send({ t: 'say', rid: 6, room, text: 'From the gallery.' });
    await eve.until('the refusal', () => refusals(eve, 6).length === 1);
    expect(refusals(eve, 6)).toEqual(['refused']);
    ada.send({ t: 'say', rid: 7, room, text: 'Dealing.' });
    await eve.until('the line', () => heard(eve).length === 1);
  });

  it('lets a member report a line, and the direction silence its author', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    bob.send({ t: 'say', rid: 1, room: HALL, text: 'Something unkind.' });
    await ada.until('the line', () => heard(ada).length === 1);
    const line = heard(ada)[0];
    /* one's own line is nothing to report */
    bob.send({ t: 'report', rid: 2, id: line.id });
    await bob.until('the refusal', () => refusals(bob, 2).length === 1);
    ada.send({ t: 'report', rid: 3, id: line.id });
    await ada.until('the mark', () => ada.done.includes(3));
    const flags = server!.store.flags();
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ accountId: bob.id, kind: 'line' });
    expect(flags[0].detail).toContain('Something unkind.');
    /* the direction reads the report whole */
    ada.send({ t: 'admin.reports', rid: 30 });
    await ada.until('the reports', () => ada.frames.some((f) => f.t === 'admin.reports'));
    const reports = ada.frames.find((f): f is Extract<ServerMessage, { t: 'admin.reports' }> => f.t === 'admin.reports')!.reports;
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ id: flags[0].id, reporter: { id: ada.id, name: 'Ada' }, author: { id: bob.id, name: 'Bob' }, line: { id: line.id, room: HALL, text: 'Something unkind.' }, silencedUntil: 0 });
    /* Ada is of the direction: Bob is silenced for an hour, then let speak again */
    ada.send({ t: 'admin.silence', rid: 4, id: bob.id, hours: 1 });
    await ada.until('the silence', () => ada.done.includes(4));
    bob.send({ t: 'say', rid: 5, room: HALL, text: 'But—' });
    await bob.until('the refusal', () => refusals(bob, 5).length === 1);
    expect(refusals(bob, 5)).toEqual(['silenced']);
    ada.send({ t: 'admin.silence', rid: 6, id: bob.id, hours: 0 });
    await ada.until('the silence lifted', () => ada.done.includes(6));
    bob.send({ t: 'say', rid: 7, room: HALL, text: 'Sorry.' });
    await bob.until('carried', () => bob.done.includes(7));
    /* a member is not the direction */
    bob.send({ t: 'admin.silence', rid: 8, id: ada.id, hours: 1 });
    await bob.until('the refusal', () => refusals(bob, 8).length === 1);
    expect(refusals(bob, 8)).toEqual(['not-allowed']);
    /* the report put away */
    ada.send({ t: 'admin.dismiss', rid: 9, id: flags[0].id });
    await ada.until('the mark gone', () => ada.done.includes(9));
    expect(server!.store.reports()).toEqual([]);
  });

  it("shows a friend the table one is opening, until it fills or starts", async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    await befriend(ada, bob);
    ada.send({ t: 'create', rid: 1, options: OPTIONS });
    await ada.until('the table', () => !!ada.table);
    const code = ada.table!.code;
    await bob.until('the open table on the desk', () => bob.desk?.friends.some((f) => f.account.id === ada.id && f.open?.code === code) === true);
    expect(bob.desk!.friends.find((f) => f.account.id === ada.id)!.open).toEqual({ code, name: ada.table!.name });
    /* seated beside, the table is no longer one to join from the list */
    bob.send({ t: 'join', rid: 2, code });
    await bob.until('the seat', () => !!bob.table);
    bob.send({ t: 'desk', rid: 3 });
    await bob.until('the desk again', () => bob.frames.some((f) => f.t === 'desk' && f.rid === 3));
    expect(bob.desk!.friends.find((f) => f.account.id === ada.id)!.open).toEqual({ code, name: ada.table!.name });
  });

  it('lets what was said go with the member who closes their account', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    ada.send({ t: 'say', rid: 1, room: HALL, text: 'Goodbye.' });
    await bob.until('the line', () => heard(bob).length === 1);
    expect(server!.store.closeAccount(ada.id, 'a-good-long-password')).toBeNull();
    expect(server!.store.linesOf(HALL).lines).toEqual([]);
  });
});
