import { describe, expect, it } from 'vitest';
import { decode, encode } from '../protocol';
import type { ClientMessage } from '../protocol';
import { STALE_MS, TRAIL_DAYS, eventOf, filterOf, funnelOf, median } from '../guideTrail';
import type { TrailEvent, TrailRow } from '../guideTrail';

/* The guided game's trail as it travels and as it is summed up: what the
   office takes from a browser, and the funnel the direction reads. */

const ID = '0123456789abcdef';
const ev = (e: Partial<TrailEvent> = {}): TrailEvent => ({ id: ID, kind: 'shown', lesson: 'coal', round: 1, at: 0, s: 0, view: 'desktop', lang: 'fr', version: '1.4.0', seed: 3, ...e });

describe('an event of the trail', () => {
  it('travels in a frame and is taken as it was sent', () => {
    const sent: ClientMessage = { t: 'guide.trail', events: [ev(), ev({ kind: 'passed', how: 'deed', at: 2, s: 40 }), ev({ kind: 'finished', lesson: 'lastRounds', how: 'played', vp: [41, 38], round: 10, at: 38 })] };
    const got = decode<ClientMessage>(encode(sent));
    if (got?.t !== 'guide.trail') throw new Error('not a trail');
    expect(got.events.map(eventOf)).toEqual(sent.events);
  });

  it('keeps its own fields and nothing else', () => {
    const e = eventOf({ ...ev(), account: 'a-1', code: 'QUJA', email: 'x@example.test' });
    expect(e).toEqual(ev());
    expect(Object.keys(e!)).not.toContain('code');
  });

  it('turns down anything a guided table does not say', () => {
    const bad: unknown[] = [
      null,
      'shown',
      { ...ev(), id: 'QUJA' },
      { ...ev(), id: 'a-1234567890abcdef' },
      { ...ev(), kind: 'clicked' },
      { ...ev(), lesson: 'coal; drop table' },
      { ...ev(), lesson: 'x'.repeat(25) },
      /* a pass says how, a shown lesson says nothing more */
      { ...ev(), kind: 'passed' },
      { ...ev(), kind: 'passed', how: 'magic' },
      { ...ev(), how: 'deed' },
      { ...ev(), kind: 'playOn', how: 'yes' },
      /* the end carries two scores, and only the end */
      { ...ev(), kind: 'finished', how: 'played' },
      { ...ev(), kind: 'finished', how: 'played', vp: [40] },
      { ...ev(), kind: 'finished', how: 'played', vp: [40, -1] },
      { ...ev(), vp: [1, 2] },
      { ...ev(), round: -1 },
      { ...ev(), at: 1.5 },
      { ...ev(), s: TRAIL_DAYS * 24 * 3600 + 1 },
      { ...ev(), seed: '3' },
      { ...ev(), view: 'phone' },
      { ...ev(), lang: 'it' },
      { ...ev(), version: '' },
      { ...ev(), version: 'a b' },
    ];
    for (const b of bad) expect(eventOf(b), JSON.stringify(b)).toBeNull();
    expect(eventOf(ev({ kind: 'left', lesson: '' }))).not.toBeNull();
    expect(eventOf(ev({ kind: 'playOn', how: 'off' }))).not.toBeNull();
    expect(eventOf(ev({ kind: 'finished', how: 'abandoned', vp: [0, 12] }))).not.toBeNull();
  });

  it('reads a filter, and drops what is not one', () => {
    expect(filterOf({ view: 'tablet-portrait', seed: 395 })).toEqual({ view: 'tablet-portrait', seed: 395 });
    expect(filterOf({ view: 'phone', seed: -3 })).toEqual({});
    expect(filterOf(null)).toEqual({});
  });
});

describe('the funnel', () => {
  const NOW = 1_000_000_000_000;
  const ORDER = ['welcome', 'coal', 'link', 'loan', 'works'];
  /** one table's story: its events, each seen at `seen` */
  const table = (id: string, events: Partial<TrailEvent>[], seen = NOW - 60_000, extra: Partial<TrailEvent> = {}): TrailRow[] => events.map((e) => ({ ...ev({ id, ...extra, ...e }), seen }));

  const rows = [
    /* played out on a desk, the coal done by its deed, the canal skipped */
    ...table('a000000000000001', [
      { kind: 'shown', lesson: 'welcome', s: 0 },
      { kind: 'passed', lesson: 'welcome', how: 'next', s: 20 },
      { kind: 'shown', lesson: 'coal', at: 0, s: 20 },
      { kind: 'passed', lesson: 'coal', how: 'deed', at: 1, s: 80 },
      { kind: 'shown', lesson: 'link', at: 2, s: 90 },
      { kind: 'later', lesson: 'link', at: 3, s: 120 },
      { kind: 'passed', lesson: 'link', how: 'skip', at: 6, s: 300 },
      { kind: 'playOn', lesson: 'link', how: 'on', s: 310 },
      { kind: 'finished', lesson: 'link', how: 'played', vp: [40, 35], s: 900 },
    ]),
    /* played out on a tablet, lost */
    ...table(
      'a000000000000002',
      [
        { kind: 'shown', lesson: 'welcome', s: 0 },
        { kind: 'passed', lesson: 'welcome', how: 'next', s: 40 },
        { kind: 'shown', lesson: 'coal', at: 0, s: 40 },
        { kind: 'detour', lesson: 'coal', at: 0, s: 41 },
        { kind: 'shown', lesson: 'loan', at: 0, s: 41 },
        { kind: 'passed', lesson: 'loan', how: 'deed', at: 1, s: 70 },
        { kind: 'passed', lesson: 'coal', how: 'deed', at: 3, s: 140 },
        { kind: 'finished', lesson: 'loan', how: 'played', vp: [30, 36], s: 1200 },
      ],
      NOW - 60_000,
      { view: 'tablet-landscape', seed: 395 },
    ),
    /* the guide left on the canal */
    ...table('a000000000000003', [
      { kind: 'shown', lesson: 'welcome', s: 0 },
      { kind: 'passed', lesson: 'welcome', how: 'next', s: 10 },
      { kind: 'already', lesson: 'coal', s: 10 },
      { kind: 'passed', lesson: 'coal', how: 'next', s: 15 },
      { kind: 'shown', lesson: 'link', s: 15 },
      { kind: 'left', lesson: 'link', s: 30 },
    ]),
    /* gone quiet on the coal days ago */
    ...table('a000000000000004', [{ kind: 'shown', lesson: 'welcome', s: 0 }, { kind: 'passed', lesson: 'welcome', how: 'next', s: 5 }, { kind: 'shown', lesson: 'coal', s: 5 }], NOW - 2 * STALE_MS),
    /* still at it, an hour ago: not let go */
    ...table('a000000000000005', [{ kind: 'shown', lesson: 'welcome', s: 0 }], NOW - 3_600_000),
  ];

  it('counts every lesson in the guide’s order, how it was passed and where readers left', () => {
    const f = funnelOf(rows, ORDER, NOW);
    expect(f.lessons.map((l) => l.id)).toEqual(ORDER);
    const at = (id: string) => f.lessons.find((l) => l.id === id)!;
    expect(at('welcome')).toMatchObject({ shown: 5, next: 4, deed: 0, skip: 0 });
    expect(at('coal')).toMatchObject({ shown: 4, deed: 2, next: 1, already: 1, detour: 1, stopped: 1 });
    expect(at('link')).toMatchObject({ shown: 2, skip: 1, later: 1, left: 1, closing: 1 });
    expect(at('loan')).toMatchObject({ shown: 1, deed: 1, closing: 1 });
    expect(at('works').shown).toBe(0);
    expect(f).toMatchObject({ tables: 5, played: 2, abandoned: 0, left: 1, stopped: 1, playOn: 1, wins: 1, ties: 0, gap: -0.5 });
    expect(f.events).toBe(rows.length);
  });

  it('times a lesson from shown to passed, in actions and in seconds, as a median', () => {
    const f = funnelOf(rows, ORDER, NOW);
    const coal = f.lessons.find((l) => l.id === 'coal')!;
    /* a: 1 action, 60 s; b: 3 actions, 100 s; c: 0 and 5 s */
    expect(coal.actions).toBe(1);
    expect(coal.seconds).toBe(60);
    expect(median([])).toBeNull();
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('splits the tables by screen and by deal, and reads one of them alone', () => {
    const f = funnelOf(rows, ORDER, NOW);
    expect(f.views.map((v) => [v.key, v.tables, v.played, v.wins])).toEqual([
      ['desktop', 4, 1, 1],
      ['tablet-landscape', 1, 1, 0],
    ]);
    expect(f.seeds.map((v) => [v.key, v.tables])).toEqual([
      ['3', 4],
      ['395', 1],
    ]);
    const tab = funnelOf(rows, ORDER, NOW, { view: 'tablet-landscape' });
    expect(tab.tables).toBe(1);
    expect(tab.lessons.find((l) => l.id === 'loan')!.shown).toBe(1);
    expect(tab.lessons.find((l) => l.id === 'link')!.shown).toBe(0);
    /* the splits stay whole under a filter */
    expect(tab.views).toEqual(f.views);
    expect(funnelOf(rows, ORDER, NOW, { seed: 7 }).tables).toBe(0);
  });

  it('takes a table’s screen from most of its events, and lists a lesson the order no longer holds', () => {
    const turned = [...table('b000000000000001', [{ lesson: 'welcome' }, { lesson: 'coal', view: 'tablet-portrait' }, { lesson: 'goalOld', view: 'tablet-portrait' }])];
    const f = funnelOf(turned, ORDER, NOW);
    expect(f.views.map((v) => v.key)).toEqual(['tablet-portrait']);
    expect(f.lessons.map((l) => l.id)).toEqual([...ORDER, 'goalOld']);
    expect(f.from).toBe(NOW - 60_000);
  });

  it('is empty, not broken, with nothing kept', () => {
    const f = funnelOf([], ORDER, NOW);
    expect(f).toMatchObject({ tables: 0, events: 0, gap: null, from: null, to: null, views: [], seeds: [] });
    expect(f.lessons.every((l) => l.shown === 0 && l.actions === null)).toBe(true);
  });
});
