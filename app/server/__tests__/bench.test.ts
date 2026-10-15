import { afterEach, describe, expect, it } from 'vitest';
import { replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chunks, playTo, presetOf, scenarioSetup } from '@/admin/scenario';
import type { ServerMessage } from '@/online/protocol';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, post } from './guest';

/* ------------------------------------------------------------------ */
/* The test bench's way in: a whole stretch of a game at home's log    */
/* handed over at once. Only an office started with DEV_LETTERS=1      */
/* hears it, only from this machine with nothing forwarded, and every  */
/* move is still read by the engine before it is written.              */
/* ------------------------------------------------------------------ */

const SEED = 31;
const SETUP = scenarioSetup({ seats: 3, owner: 0, name: 'Ada', personas: ['wedgwood', 'watt'] });
/** a log up to the middle of the canal, played by the machines */
const LOG = playTo(SETUP, SEED, presetOf('canal-mid')!, 0).actions;

describe('the test bench on the office', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const was = process.env.DEV_LETTERS;

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
    if (was === undefined) delete process.env.DEV_LETTERS;
    else process.env.DEV_LETTERS = was;
  });

  /** an office with the bench open or shut; a house that forgets either way */
  const open = async (bench: boolean) => {
    if (bench) process.env.DEV_LETTERS = '1';
    else delete process.env.DEV_LETTERS;
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, editionEvery: 0, file: ':memory:' });
  };

  /** a guest at the far end with a game at home dealt */
  const dealt = async (headers?: Record<string, string>): Promise<{ g: Guest; code: string }> => {
    const g = new Guest('Ada');
    guests.push(g);
    await g.open(server!.port, headers);
    await g.asGuest();
    g.send({ t: 'home.open', rid: 1, name: 'Banc d’essai', seed: SEED, setup: SETUP });
    await g.until('the deal', () => !!g.dealt);
    return { g, code: g.dealt!.code };
  };

  /** the office's answer to request `rid` */
  const answer = async (g: Guest, rid: number): Promise<ServerMessage> => {
    const of = () => g.frames.find((f) => (f.t === 'done' || f.t === 'refused') && f.rid === rid);
    await g.until(`the answer to ${rid}`, () => !!of());
    return of()!;
  };

  /** the moves the office holds for this game */
  const held = async (g: Guest, code: string, rid: number): Promise<GameAction[]> => {
    g.save = null;
    g.send({ t: 'home.load', rid, code });
    await g.until('the save', () => !!g.save);
    return g.save!.actions;
  };

  it('takes a log whole, in slices, every move read by the engine', async () => {
    await open(true);
    const { g, code } = await dealt();
    let rid = 10;
    for (const [k, part] of chunks(LOG, 40).entries()) {
      g.send({ t: 'dev.home.play', rid: ++rid, code, from: k * 40, actions: part });
      expect((await answer(g, rid)).t).toBe('done');
    }
    const actions = await held(g, code, 99);
    expect(actions).toEqual(LOG);
    const s = replay(SETUP, SEED, actions);
    expect(s.era).toBe('canal');
    expect(s.round).toBeGreaterThanOrEqual(4);
  });

  it('stops at the first move that does not stand, and keeps the ones before', async () => {
    await open(true);
    const { g, code } = await dealt();
    const bad: GameAction[] = [...LOG.slice(0, 5), { kind: 'build', card: 'no-such-card', town: 'birmingham', slot: 0, industry: 'coal' }, ...LOG.slice(6, 10)];
    g.send({ t: 'dev.home.play', rid: 20, code, from: 0, actions: bad });
    const r = await answer(g, 20);
    expect(r.t).toBe('refused');
    expect(r.t === 'refused' && r.error).toMatch(/move 5/);
    expect(await held(g, code, 21)).toEqual(LOG.slice(0, 5));
    /* out of step is out of step, as for one move alone */
    g.send({ t: 'dev.home.play', rid: 22, code, from: 2, actions: LOG.slice(5, 6) });
    expect((await answer(g, 22)).t).toBe('refused');
  });

  it('is shut without DEV_LETTERS=1, even for a house that forgets', async () => {
    await open(false);
    const { g, code } = await dealt();
    g.send({ t: 'dev.home.play', rid: 30, code, from: 0, actions: LOG.slice(0, 4) });
    expect((await answer(g, 30)).t).toBe('refused');
    expect(await held(g, code, 31)).toEqual([]);
  });

  it('is shut to a socket that came through a proxy', async () => {
    await open(true);
    for (const headers of [{ 'x-forwarded-for': '203.0.113.9' }, { 'x-real-ip': '203.0.113.9' }] as Record<string, string>[]) {
      const { g, code } = await dealt(headers);
      g.send({ t: 'dev.home.play', rid: 40, code, from: 0, actions: LOG.slice(0, 4) });
      expect((await answer(g, 40)).t).toBe('refused');
      expect(await held(g, code, 41)).toEqual([]);
    }
  });

  it('refuses a slice too long for one frame, and a game that is not the caller’s', async () => {
    await open(true);
    const { g, code } = await dealt();
    g.send({ t: 'dev.home.play', rid: 50, code, from: 0, actions: Array.from({ length: 201 }, () => LOG[0]) });
    expect((await answer(g, 50)).t).toBe('refused');
    const other = await dealt();
    other.g.send({ t: 'dev.home.play', rid: 51, code, from: 0, actions: LOG.slice(0, 3) });
    expect((await answer(other.g, 51)).t).toBe('refused');
    expect(await held(g, code, 52)).toEqual([]);
  });
});
