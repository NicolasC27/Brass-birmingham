import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, OPTIONS, post } from './guest';

/* the alpha: the tables open only to the members the direction has let in */
describe('the alpha', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  async function open(admins: string[] = []) {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-alpha-'));
    dirs.push(dir);
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, file: path.join(dir, 'test.db'), admins });
    return server;
  }

  async function arrive(name: string): Promise<Guest> {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    await g.signUp();
    return g;
  }

  it('keeps a verified member out of the tables until the direction lets them in', async () => {
    await open(['nico@example.test']);
    const nico = await arrive('Nico');
    const ada = await arrive('Ada');
    expect(nico.me?.alpha).toBe(true);
    expect(nico.me?.admin).toBe(true);
    expect(ada.me?.alpha).toBe(false);

    /* a table, a game at home: refused */
    ada.send({ t: 'create', rid: 1, options: OPTIONS });
    await ada.until('the refusal', () => ada.rejected.length === 1);
    expect(ada.rejected).toEqual(['no-alpha']);
    ada.send({ t: 'home.open', rid: 2, name: 'Mill', seed: 1, setup: { players: [{ name: 'Ada', color: 'brass', type: 'human' }, { name: 'Cy', color: 'oxblood', type: 'bot', persona: 'wedgwood' }], options: OPTIONS } });
    await ada.until('the second refusal', () => ada.rejected.length === 2);
    expect(ada.rejected[1]).toBe('no-alpha');

    /* the direction opens the door: the member is told at once, and seated */
    nico.send({ t: 'admin.members', rid: 3 });
    await nico.until('the register', () => nico.frames.some((f) => f.t === 'admin.members'));
    const members = nico.frames.find((f) => f.t === 'admin.members')!;
    expect(members.t === 'admin.members' && members.members.map((m) => [m.name, m.alpha])).toEqual([['Ada', false], ['Nico', true]]);
    nico.send({ t: 'admin.alpha', rid: 4, id: ada.id, on: true });
    await ada.until('the door', () => ada.me?.alpha === true);
    ada.send({ t: 'create', rid: 5, options: OPTIONS });
    await ada.until('a seat', () => !!ada.table);
    expect(ada.table?.hostId).toBe(ada.id);

    /* not of the direction: no register, no key */
    ada.send({ t: 'admin.alpha', rid: 6, id: nico.id, on: false });
    await ada.until('the third refusal', () => ada.rejected.length === 3);
  });

  it('is open to every verified member once the line is open', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-alpha-'));
    dirs.push(dir);
    server = await serve({ port: 0, alphaOpen: true, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, file: path.join(dir, 'test.db') });
    const ada = await arrive('Ada');
    expect(ada.me?.alpha).toBe(true);
    ada.send({ t: 'create', rid: 1, options: OPTIONS });
    await ada.until('a seat', () => !!ada.table);
  });
});
