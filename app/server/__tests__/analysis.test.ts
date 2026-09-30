import { afterEach, describe, expect, it } from 'vitest';
import type { SetupPayload } from '@/game/types';
import type { Reading, Verdict } from '@/game/analysis';
import type { Facts, ReadingPart } from '@/game/analysisMerge';
import type { ServerMessage } from '@/online/protocol';
import { CLAIM_MS, Readings, isJudge, isVersion } from '../analysis';
import { serve } from '../index';
import type { Serving } from '../index';
import { Store } from '../store';
import { Guest, OPTIONS, post } from './guest';

/* ------------------------------------------------------------------ */
/* The office's copy of a reading: what it keeps, what it believes and */
/* how it shares the game out between the readers of a table.          */
/* ------------------------------------------------------------------ */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Bob', color: 'oxblood', type: 'human' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const facts: Facts = { moves: 20, seats: 2 };
const id = (judge: 'quick' | 'long' | 'deep' = 'long', v = 6) => ({ code: 'AB12', seed: 7, judge, v }) as const;

const reading = (c: number, passes = 1): Reading => ({ chance: c, low: c - 0.02, high: c + 0.02, passes });
const verdict = (at: number): Verdict => ({ at, round: 1, era: 'canal', roads: [{ action: { kind: 'pass' }, chance: 0.5 }], mine: 0.48, best: 0.5, loss: 0.02, grade: 'good' });
const slice = (lo: number, hi: number): ReadingPart => ({
  moves: facts.moves,
  seats: Object.fromEntries(Array.from({ length: hi - lo }, (_, i) => [lo + i, [reading(0.5), reading(0.5)]])),
});

/** a register of its own, in memory, with one game on the record */
function office(now: () => number = Date.now) {
  const store = new Store(':memory:');
  store.openGame('AB12', 7, SETUP, ['a-1', 'a-2']);
  for (let i = 0; i < facts.moves; i++) store.appendMove('AB12', i, { kind: 'pass' });
  return { store, readings: new Readings(store, now) };
}

describe('the office’s copy of a reading', () => {
  it('keeps nothing until a reader posts, then hands back what it holds', () => {
    const { readings } = office();
    expect(readings.read(id())).toBeNull();
    expect(readings.add(id(), 's-1', { ...slice(0, 4), total: 40 }, facts)).not.toBeNull();
    const held = readings.read(id())!;
    expect(Object.keys(held.seats).length).toBe(4);
    expect(held.total).toBe(40);
    expect(held.done).toBe(4);
  });

  it('is one copy per table, per deal, per judge and per version', () => {
    const { readings } = office();
    readings.add(id('long'), 's-1', slice(0, 4), facts);
    expect(readings.read(id('long'))).not.toBeNull();
    /* another judge reads on another scale, another version by other rules */
    expect(readings.read(id('quick'))).toBeNull();
    expect(readings.read(id('long', 7))).toBeNull();
    expect(readings.read({ ...id('long'), seed: 8 })).toBeNull();
    expect(isJudge('long')).toBe(true);
    expect(isJudge('hasty')).toBe(false);
    expect(isVersion(6)).toBe(true);
    expect(isVersion(0)).toBe(false);
    expect(isVersion(1.5)).toBe(false);
  });

  it('turns away what does not measure up to the game it holds', () => {
    const { readings } = office();
    /* a position past the end of the game, and a figure that is not a chance */
    expect(readings.add(id(), 's-1', { moves: 4, seats: { 40: [reading(0.5), reading(0.5)] } }, facts)).toBeNull();
    expect(readings.add(id(), 's-1', { moves: 4, seats: { 2: [reading(3), reading(0.5)] } }, facts)).toBeNull();
    expect(readings.add(id(), 's-1', 'nothing like a reading', facts)).toBeNull();
    expect(readings.read(id())).toBeNull();
  });

  it('stays on the register, so a restart hands the reading back', () => {
    const { store, readings } = office();
    readings.add(id(), 's-1', slice(0, 6), facts);
    const again = new Readings(store);
    expect(Object.keys(again.read(id())!.seats).length).toBe(6);
  });

  it('shares the game out: one stretch each, and none twice', () => {
    const { readings } = office();
    const first = readings.claim(id(), 's-1', 8, facts);
    const second = readings.claim(id(), 's-2', 8, facts);
    expect(first).toEqual({ lo: 0, hi: 8 });
    expect(second).toEqual({ lo: 8, hi: 16 });
    expect(readings.readers(id())).toBe(2);
    /* a third reader takes what is left, and a fourth has nothing to read */
    expect(readings.claim(id(), 's-3', 8, facts)).toEqual({ lo: 16, hi: 21 });
    expect(readings.claim(id(), 's-4', 8, facts)).toEqual({ lo: 0, hi: 0 });
  });

  it('gives back a stretch nobody has read, and skips the positions read', () => {
    let now = 1000;
    const { readings } = office(() => now);
    readings.claim(id(), 's-1', 8, facts);
    readings.add(id(), 's-1', slice(0, 8), facts);
    /* the reader who took the rest goes quiet: a minute and a half later
       their stretch is free again, and the positions already read are not */
    readings.claim(id(), 's-2', 13, facts);
    now += CLAIM_MS + 1;
    expect(readings.readers(id())).toBe(0);
    expect(readings.claim(id(), 's-3', 13, facts)).toEqual({ lo: 8, hi: 21 });
  });

  it('frees at once what a reader who has gone had taken', () => {
    const { readings } = office();
    expect(readings.claim(id(), 's-1', 21, facts)).toEqual({ lo: 0, hi: 21 });
    expect(readings.claim(id(), 's-2', 21, facts)).toEqual({ lo: 0, hi: 0 });
    readings.release('s-1');
    expect(readings.claim(id(), 's-2', 21, facts)).toEqual({ lo: 0, hi: 21 });
  });

  it('holds the stretch of a reader who keeps posting', () => {
    let now = 1000;
    const { readings } = office(() => now);
    readings.claim(id(), 's-1', 21, facts);
    now += CLAIM_MS - 1000;
    readings.add(id(), 's-1', { moves: facts.moves, verdicts: [{ seat: 0, at: 2, passes: 2, verdict: verdict(2) }] }, facts);
    now += 2000;
    /* the post said the reader is still at work: nobody else gets the stretch */
    expect(readings.claim(id(), 's-2', 21, facts)).toEqual({ lo: 0, hi: 0 });
    expect(readings.readers(id())).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* And the same over the wire: a table, two accounts and a spectator,  */
/* all reading the one game.                                           */
/* ------------------------------------------------------------------ */

describe('a reading shared over the wire', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  const seen = <T extends ServerMessage['t']>(g: Guest, t: T) => g.frames.filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[];

  /** a table of two, the game begun and a few moves played */
  async function begun() {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const [host, guest, watcher] = [new Guest('Ada'), new Guest('Bob'), new Guest('Cy')];
    guests.push(host, guest, watcher);
    for (const g of guests) await g.open(server.port);
    for (const g of guests) await g.signUp();
    host.send({ t: 'create', rid: 10, options: OPTIONS });
    await host.until('the table', () => !!host.table);
    const code = host.table!.code;
    guest.send({ t: 'join', rid: 11, code });
    await guest.until('a chair', () => !!guest.table);
    await host.until('the guest', () => host.table!.seats.length === 2);
    guest.send({ t: 'table', code, table: { ...guest.table!, seats: guest.table!.seats.map((s) => (s.id === guest.id ? { ...s, ready: true } : s)) } });
    await host.until('the guest to be ready', () => host.table!.seats.some((s) => s.id === guest.id && s.ready));
    host.send({ t: 'table', code, table: { ...host.table!, seats: host.table!.seats.map((s) => (s.id === host.id ? { ...s, ready: true } : s)), status: 'starting' } });
    await host.until('the game', () => !!host.view);
    /* a move or two, so the game has positions to read */
    for (let i = 0; i < 2; i++) {
      const g = [host, guest].find((x) => x.view!.state.phase === 'action' && x.view!.state.current === x.view!.seat)!;
      const at = g.view!.state.actions.length;
      g.send({ t: 'act', code, action: { kind: 'pass' } });
      await g.until('the move to land', () => g.view!.state.actions.length > at);
    }
    watcher.send({ t: 'watch', code });
    await watcher.until('the game as a spectator', () => !!watcher.view);
    return { host, guest, watcher, code };
  }

  it('hands the office’s copy to every reader of the table, players and spectators', async () => {
    const { host, guest, watcher, code } = await begun();
    const moves = host.view!.state.actions.length;
    host.send({ t: 'analysis.post', code, v: 6, judge: 'long', part: { moves, seats: { 0: [reading(0.5), reading(0.5)] }, total: 12 } });
    /* what one reader posts reaches the others as it lands */
    await guest.until('the figures', () => seen(guest, 'analysis.add').length > 0);
    await watcher.until('the figures', () => seen(watcher, 'analysis.add').length > 0);
    expect(seen(host, 'analysis.add').length).toBe(0);
    /* and whoever asks is handed the whole of it */
    watcher.send({ t: 'analysis.get', rid: 40, code, v: 6, judge: 'long' });
    await watcher.until('the reading', () => seen(watcher, 'analysis').length > 0);
    const held = seen(watcher, 'analysis')[0].reading!;
    expect(Object.keys(held.seats).length).toBe(1);
    expect(held.total).toBe(12);
  });

  it('keeps a reading by judge and by version, and believes no figure it cannot check', async () => {
    const { host, guest, code } = await begun();
    const moves = host.view!.state.actions.length;
    host.send({ t: 'analysis.post', code, v: 6, judge: 'long', part: { moves, seats: { 0: [reading(0.5), reading(0.5)] } } });
    await guest.until('the figures', () => seen(guest, 'analysis.add').length > 0);
    /* another judge is another reading, and an empty one */
    guest.send({ t: 'analysis.get', rid: 41, code, v: 6, judge: 'quick' });
    await guest.until('the other judge', () => seen(guest, 'analysis').length > 0);
    expect(seen(guest, 'analysis')[0].reading).toBeNull();
    /* a chance of three and a position past the end never reach the table */
    host.send({ t: 'analysis.post', code, v: 6, judge: 'long', part: { moves, seats: { 1: [reading(3), reading(0.5)] } } });
    host.send({ t: 'analysis.post', code, v: 6, judge: 'long', part: { moves: moves + 40, seats: {} } });
    host.send({ t: 'analysis.get', rid: 42, code, v: 6, judge: 'long' });
    await host.until('the reading', () => seen(host, 'analysis').length > 0);
    expect(Object.keys(seen(host, 'analysis')[0].reading!.seats)).toEqual(['0']);
    /* the office answered the ask that came after them: had either figure
       been believed, the table would have heard of it by now */
    await guest.until('a breath', () => false, 40).catch(() => {});
    expect(seen(guest, 'analysis.add').length).toBe(1);
  });

  it('hands out a stretch of the game to each reader, and none to a stranger', async () => {
    const { host, guest, watcher, code } = await begun();
    host.send({ t: 'analysis.claim', rid: 50, code, v: 6, judge: 'long', want: 2 });
    await host.until('a stretch', () => seen(host, 'analysis.slice').length > 0);
    const first = seen(host, 'analysis.slice')[0];
    expect(first.lo).toBe(0);
    expect(first.hi).toBe(2);
    guest.send({ t: 'analysis.claim', rid: 51, code, v: 6, judge: 'long', want: 2 });
    await guest.until('a stretch', () => seen(guest, 'analysis.slice').length > 0);
    expect(seen(guest, 'analysis.slice')[0].lo).toBe(2);
    expect(seen(guest, 'analysis.slice')[0].readers).toBe(2);
    /* a socket that follows no table is told nothing at all */
    watcher.send({ t: 'leave', code });
    watcher.send({ t: 'analysis.claim', rid: 52, code, v: 6, judge: 'long', want: 2 });
    await watcher.until('the refusal', () => seen(watcher, 'analysis.slice').length > 0);
    expect(seen(watcher, 'analysis.slice')[0]).toMatchObject({ lo: 0, hi: 0, readers: 0 });
  });
});
