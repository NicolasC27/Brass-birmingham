import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { FULL_LESSON_IDS, LESSON_IDS } from '@/components/game/lessons';
import { TRAIL_CAP, TRAIL_MS } from '@/online/guideTrail';
import type { GuideFunnel, TrailEvent } from '@/online/guideTrail';
import { Store } from '../store';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, post } from './guest';

/* The guided game's trail at the office: kept under the table's own
   random id and nothing else, a table's worth at most, let go after its
   days, summed up for the direction alone — and taken from a socket no
   faster than a guided game could say it. */

const ev = (e: Partial<TrailEvent> = {}): TrailEvent => ({ id: '0123456789abcdef', kind: 'shown', lesson: 'coal', round: 1, at: 0, s: 0, view: 'desktop', lang: 'fr', version: '1.4.0', seed: 3, ...e });
/** a table's id, one per number */
const idOf = (n: number) => n.toString(16).padStart(16, '0');
const DAY = 24 * 60 * 60 * 1000;

describe('the trail in the register', () => {
  it('keeps a table’s events, as many as a guided game could say', () => {
    const store = new Store(':memory:');
    expect(store.keepTrail([ev(), ev({ kind: 'passed', how: 'deed', at: 1, s: 30 })])).toBe(2);
    const many = Array.from({ length: TRAIL_CAP + 20 }, (_, i) => ev({ id: idOf(7), s: i }));
    expect(store.keepTrail(many)).toBe(TRAIL_CAP);
    expect(store.keepTrail([ev({ id: idOf(7) })])).toBe(0);
    /* another table has its own room */
    expect(store.keepTrail([ev({ id: idOf(8) })])).toBe(1);
    const f = store.guideFunnel(LESSON_IDS);
    expect(f.tables).toBe(3);
    expect(f.events).toBe(2 + TRAIL_CAP + 1);
    const coal = f.lessons.find((l) => l.id === 'coal')!;
    expect(coal).toMatchObject({ shown: 3, deed: 1, actions: 1, seconds: 30 });
    store.close();
  });

  it('lets the trail go after its days, with the rest of what the law lets go', () => {
    const store = new Store(':memory:');
    const now = Date.now();
    store.keepTrail([ev({ id: idOf(1) })], now - TRAIL_MS - 1000);
    store.keepTrail([ev({ id: idOf(2) })], now - TRAIL_MS + DAY);
    store.sweepPrivacy(now);
    const f = store.guideFunnel(LESSON_IDS, {}, now);
    expect(f.tables).toBe(1);
    expect(f.lessons.find((l) => l.id === 'coal')!.shown).toBe(1);
    store.close();
  });

  it('notes the day an event came in, not its moment', () => {
    const store = new Store(':memory:');
    const at = Date.UTC(2026, 10, 4, 9, 44, 17, 250);
    store.keepTrail([ev()], at);
    store.keepTrail([ev({ kind: 'passed', how: 'deed', at: 1, s: 30 })], at + 3 * 60 * 60 * 1000);
    const f = store.guideFunnel(LESSON_IDS, {}, at + DAY);
    expect([f.from, f.to]).toEqual([Date.UTC(2026, 10, 4), Date.UTC(2026, 10, 4)]);
    /* the time on a lesson is the table's own count, not the office's */
    expect(f.lessons.find((l) => l.id === 'coal')).toMatchObject({ seconds: 30 });
    store.close();
  });

  it('keeps the second lesson’s mark, and sums each course apart', () => {
    const store = new Store(':memory:');
    store.keepTrail([ev({ id: idOf(1), lesson: 'welcome' })]);
    store.keepTrail([ev({ id: idOf(2), lesson: 'fullWelcome', course: 'full' }), ev({ id: idOf(2), kind: 'left', lesson: 'railChoice', course: 'full' })]);
    expect(store.guideFunnel(LESSON_IDS).tables).toBe(1);
    const f = store.guideFunnel(FULL_LESSON_IDS, { course: 'full' });
    expect(f).toMatchObject({ tables: 1, left: 1 });
    expect(f.lessons.find((l) => l.id === 'railChoice')!.left).toBe(1);
    store.close();
  });

  it('reads the funnel back in the guide’s order, filtered by screen or deal', () => {
    const store = new Store(':memory:');
    store.keepTrail([ev({ id: idOf(1), lesson: 'welcome' }), ev({ id: idOf(1), kind: 'finished', lesson: 'coal', how: 'played', vp: [44, 40], at: 38, s: 1800, round: 10 })]);
    store.keepTrail([ev({ id: idOf(2), lesson: 'welcome', view: 'tablet-portrait', seed: 395 })]);
    const f = store.guideFunnel(LESSON_IDS);
    expect(f.lessons.map((l) => l.id)).toEqual([...LESSON_IDS]);
    expect(f).toMatchObject({ tables: 2, played: 1, wins: 1, gap: 4 });
    expect(store.guideFunnel(LESSON_IDS, { view: 'tablet-portrait' }).tables).toBe(1);
    /* a deal read alone over one table: its count, not its game */
    expect(store.guideFunnel(LESSON_IDS, { seed: 3 })).toMatchObject({ tables: 1, thin: true, played: 0, lessons: [] });
    store.close();
  });
});

describe('the trail over the wire', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const g of guests.splice(0)) g.close();
    await server?.close();
    server = null;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const open = (file = ':memory:') => serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, editionEvery: 0, circularEvery: 0, file, admins: ['ada@example.test'] });
  const seat = async (name: string, how: 'guest' | 'signup' | 'none' = 'guest'): Promise<Guest> => {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    if (how === 'guest') await g.asGuest();
    if (how === 'signup') await g.signUp();
    return g;
  };
  /** every frame before this one read: the office answers in order */
  const settled = async (g: Guest) => {
    const n = g.trace.filter((t) => t === 'pong').length;
    g.send({ t: 'ping' });
    await g.until('the pong', () => g.trace.filter((t) => t === 'pong').length > n);
  };
  const funnelOf = async (g: Guest, rid: number, filter?: { view?: 'desktop'; seed?: number; course?: 'full' }): Promise<GuideFunnel> => {
    g.send({ t: 'admin.guide', rid, filter });
    await g.until(`rid ${rid}`, () => g.frames.some((f) => f.t === 'admin.guide' && f.rid === rid));
    const f = g.frames.find((x) => x.t === 'admin.guide' && x.rid === rid);
    if (!f || f.t !== 'admin.guide') throw new Error('no funnel');
    return f.funnel;
  };

  it('keeps what a guest’s guided table says, checked, and none of the guest', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-trail-'));
    dirs.push(dir);
    const file = path.join(dir, 'office.db');
    server = await open(file);
    const reader = await seat('Reader');
    reader.send({ t: 'guide.trail', events: [ev(), ev({ kind: 'passed', how: 'next', at: 1, s: 12 }), { ...ev(), kind: 'clicked' } as unknown as TrailEvent, { ...ev(), code: 'QUJA', account: reader.id } as unknown as TrailEvent] });
    await settled(reader);
    expect(server.store.guideFunnel(LESSON_IDS).events).toBe(3);
    /* the register holds the events and nothing that names the reader */
    const db = new DatabaseSync(file);
    const cols = (db.prepare('pragma table_info(guide_trail)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(['id', 'trail', 'kind', 'lesson', 'how', 'vpMine', 'vpTheirs', 'round', 'actions', 'secs', 'screen', 'lang', 'version', 'seed', 'seen', 'course']);
    const dump = JSON.stringify(db.prepare('select * from guide_trail').all());
    expect(dump).not.toContain(reader.id);
    expect(dump).not.toContain('QUJA');
    db.close();
  });

  it('takes no more than a socket may say, and nothing from a stranger', async () => {
    server = await open();
    const stranger = await seat('Stranger', 'none');
    stranger.send({ t: 'guide.trail', events: [ev()] });
    await stranger.until('the refusal', () => stranger.rejected.includes('sign-in-first'));
    expect(server.store.guideFunnel(LESSON_IDS).events).toBe(0);
    const reader = await seat('Reader');
    /* three frames of forty at once: a hundred go in, then one a second */
    for (let f = 0; f < 3; f++) reader.send({ t: 'guide.trail', events: Array.from({ length: 40 }, (_, i) => ev({ id: idOf(f + 1), s: i })) });
    await settled(reader);
    expect(server.store.guideFunnel(LESSON_IDS).events).toBe(100);
    /* a frame of more than forty is cut to forty */
    const other = await seat('Other');
    other.send({ t: 'guide.trail', events: Array.from({ length: 60 }, (_, i) => ev({ id: idOf(9), s: i })) });
    await settled(other);
    expect(server.store.guideFunnel(LESSON_IDS, {}).events).toBe(140);
  });

  it('sums it up for the direction and for no one else', async () => {
    server = await open();
    const reader = await seat('Reader');
    reader.send({ t: 'guide.trail', events: [ev({ lesson: 'welcome' }), ev({ kind: 'finished', lesson: 'coal', how: 'played', vp: [41, 38], round: 10, at: 38, s: 2000 })] });
    await settled(reader);
    reader.send({ t: 'admin.guide', rid: 70 });
    await reader.until('a refusal', () => reader.rejected.includes('not-allowed'));
    const ada = await seat('Ada', 'signup');
    expect(ada.me?.admin).toBe(true);
    const f = await funnelOf(ada, 71);
    expect(f).toMatchObject({ tables: 1, played: 1, wins: 1, gap: 3, days: 180 });
    expect(f.lessons[0]).toMatchObject({ id: LESSON_IDS[0], shown: 1 });
    /* no table's own story comes back: counts only */
    expect(JSON.stringify(f)).not.toContain('0123456789abcdef');
    expect((await funnelOf(ada, 72, { seed: 395 })).tables).toBe(0);
    /* the second lesson's funnel, in its own lessons' order */
    reader.send({ t: 'guide.trail', events: [ev({ id: idOf(5), lesson: 'fullWelcome', course: 'full' })] });
    await settled(reader);
    const full = await funnelOf(ada, 73, { course: 'full' });
    expect(full.tables).toBe(1);
    expect(full.lessons.map((l) => l.id)).toEqual([...FULL_LESSON_IDS]);
    expect((await funnelOf(ada, 74)).tables).toBe(1);
  });
});
