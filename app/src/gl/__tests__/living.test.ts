import { describe, expect, it } from 'vitest';
import type { Card, GameState, IndustryType, TileState } from '@/game/types';
import { DUSK_PLAYING, DUSK_SCORING, EVENING, FLIP_MAX, admitCrossing, duskLevel, duskTint, freshFlips, plumeFor, roundsLeft, trafficCap, trafficLinks, vehicleFor } from '../living';

const card: Card = { id: 'c', kind: 'location', town: 'birmingham' };
const cards = (n: number): Card[] => Array.from({ length: n }, () => card);

/** a table with `deck` cards to draw and `hands` in the seats' hands */
const table = (deck: number, hands: number[], phase: GameState['phase'] = 'action') => ({
  phase,
  deck: cards(deck),
  players: hands.map((h) => ({ hand: cards(h) })) as GameState['players'],
});

const tile = (industry: IndustryType, flipped = false, owner = 0, level = 1): TileState => ({ owner, industry, level, flipped, cubes: 0 });

describe('what the works breathe', () => {
  it('pits and furnaces smoke, breweries steam, mills haze, kilns glow', () => {
    expect(plumeFor('coal', false).kind).toBe('soot');
    expect(plumeFor('iron', false).kind).toBe('soot');
    expect(plumeFor('brewery', false).kind).toBe('steam');
    expect(plumeFor('cotton', false).kind).toBe('haze');
    expect(plumeFor('manufacturer', false).kind).toBe('haze');
    expect(plumeFor('pottery', false).kind).toBe('kiln');
  });

  it('soot is dark, steam and haze are pale', () => {
    const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
    expect(lum(plumeFor('coal', false).tint)).toBeLessThan(80);
    for (const i of ['brewery', 'cotton', 'manufacturer', 'pottery'] as const) expect(lum(plumeFor(i, false).tint)).toBeGreaterThan(200);
  });

  it('a kiln glows at its crown and a furnace at its mouth; the rest do not', () => {
    expect(plumeFor('pottery', false).glow).not.toBeNull();
    expect(plumeFor('iron', false).glow).not.toBeNull();
    for (const i of ['coal', 'brewery', 'cotton', 'manufacturer'] as const) expect(plumeFor(i, false).glow).toBeNull();
  });

  it('a works turned over keeps breathing, only calmer', () => {
    for (const i of ['coal', 'iron', 'brewery', 'cotton', 'manufacturer', 'pottery'] as const) {
      const busy = plumeFor(i, false);
      const calm = plumeFor(i, true);
      expect(calm.kind).toBe(busy.kind);
      expect(calm.count).toBeGreaterThan(0);
      expect(calm.count).toBeLessThan(busy.count);
      expect(calm.alpha).toBeLessThan(busy.alpha);
      expect(calm.glowAlpha).toBeLessThanOrEqual(busy.glowAlpha);
    }
  });
});

describe('traffic on what was built', () => {
  it('runs on the links of the era the table is in, and on no other', () => {
    const links = { a: { owner: 0, era: 'canal' as const }, b: { owner: 1, era: 'rail' as const }, c: { owner: 1, era: 'rail' as const } };
    expect(trafficLinks({ era: 'rail', links })).toEqual(['b', 'c']);
    expect(trafficLinks({ era: 'canal', links })).toEqual(['a']);
    expect(trafficLinks({ era: 'rail', links: {} })).toEqual([]);
  });

  it('a barge in the canal era, a train in the rail', () => {
    expect(vehicleFor('canal')).toBe('barge');
    expect(vehicleFor('rail')).toBe('train');
  });

  it('nothing runs with the traffic off, or on no line at all', () => {
    expect(trafficCap('none', 20)).toBe(0);
    expect(trafficCap('light', 0)).toBe(0);
    expect(trafficCap('busy', 0)).toBe(0);
  });

  it('a light trickle grows with the network, never past a few at a time', () => {
    let last = 0;
    for (let n = 1; n <= 40; n++) {
      const cap = trafficCap('light', n);
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeGreaterThanOrEqual(last);
      expect(cap).toBeLessThanOrEqual(4);
      last = cap;
    }
    expect(trafficCap('light', 1)).toBe(1);
    expect(trafficCap('light', 30)).toBe(4);
  });

  it('the busy parade is never thinner than the trickle, and kept to a dozen', () => {
    for (let n = 1; n <= 40; n++) {
      expect(trafficCap('busy', n)).toBeGreaterThanOrEqual(trafficCap('light', n));
      expect(trafficCap('busy', n)).toBeLessThanOrEqual(12);
    }
    /* a small network still has both its vehicles out on every line */
    expect(trafficCap('busy', 3)).toBe(6);
  });

  it('a crossing waits for room on the lines; a maiden voyage never waits', () => {
    expect(admitCrossing(2, 3, false)).toBe(true);
    expect(admitCrossing(3, 3, false)).toBe(false);
    expect(admitCrossing(9, 3, true)).toBe(true);
    expect(admitCrossing(0, 0, false)).toBe(false);
  });
});

describe('the light goes as an era draws to its close', () => {
  it('counts the rounds left in cards still to be played', () => {
    expect(roundsLeft(table(0, [2, 2]))).toBe(1);
    expect(roundsLeft(table(8, [8, 8]))).toBe(6);
    expect(roundsLeft(table(0, [1, 0, 2]))).toBe(0.5);
  });

  it('full day while more than two rounds are left: the rail era opens on a new day', () => {
    expect(duskLevel(table(40, [8, 8]))).toBe(0);
    expect(duskLevel(table(0, [8, 8]))).toBe(0);
    expect(duskLevel(table(0, [4, 4]))).toBe(0);
  });

  it('deepens card by card through the last two rounds, to its deepest on the last card', () => {
    let last = -1;
    /* two seats, eight cards left between them: the last card played is the table's last */
    for (let left = 8; left >= 0; left--) {
      const hands = [Math.ceil(left / 2), Math.floor(left / 2)];
      const d = duskLevel(table(0, hands));
      expect(d).toBeGreaterThan(last);
      last = d;
    }
    expect(last).toBeCloseTo(DUSK_PLAYING, 6);
    /* the last round is already well into the evening */
    expect(duskLevel(table(0, [2, 2]))).toBeGreaterThan(0.4);
  });

  it('a deeper dusk over the canal scoring, night once the game is over', () => {
    expect(duskLevel(table(0, [0, 0], 'scoring-canal'))).toBe(DUSK_SCORING);
    expect(DUSK_SCORING).toBeGreaterThan(DUSK_PLAYING);
    expect(duskLevel(table(0, [0, 0], 'game-over'))).toBe(1);
  });

  it('tints the ground white by day, to the evening at night, darker as it goes', () => {
    expect(duskTint(0)).toBe(0xffffff);
    expect(duskTint(1)).toBe(EVENING);
    expect(duskTint(-1)).toBe(0xffffff);
    expect(duskTint(2)).toBe(EVENING);
    const sum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    let last = Infinity;
    for (let d = 0; d <= 1.0001; d += 0.1) {
      expect(sum(duskTint(d))).toBeLessThanOrEqual(last);
      last = sum(duskTint(d));
    }
    /* an evening is a cool one: the blue holds best */
    expect(EVENING & 255).toBeGreaterThan((EVENING >> 16) & 255);
  });

  it('stays within the day and the night', () => {
    for (let deck = 0; deck < 30; deck += 3) for (let h = 0; h <= 8; h++) {
      const d = duskLevel(table(deck, [h, h, h]));
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });
});

describe('a tile turned over', () => {
  const base = { tiles: { 'birmingham:0': tile('cotton'), 'dudley:1': tile('coal') }, actions: [] as GameState['actions'] };
  const step = (tiles: Record<string, TileState>, back = false) => ({ tiles, actions: (back ? [] : [{}]) as GameState['actions'] });

  it('flares when it turns, not when it is laid', () => {
    expect(freshFlips(base, step({ ...base.tiles, 'dudley:1': tile('coal', true) }))).toEqual(['dudley:1']);
    expect(freshFlips(base, step({ ...base.tiles, 'stone:0': tile('brewery', true) }))).toEqual([]);
  });

  it('a works built over (another owner or level) is struck, not flared', () => {
    expect(freshFlips(base, step({ ...base.tiles, 'dudley:1': tile('coal', true, 1, 2) }))).toEqual([]);
  });

  it('nothing on the first sight of a table, going back in time, or a table being set', () => {
    expect(freshFlips(null, step(base.tiles))).toEqual([]);
    const flipped = { tiles: { 'dudley:1': tile('coal', true) }, actions: [{}] as GameState['actions'] };
    expect(freshFlips(flipped, step({ 'dudley:1': tile('coal', false) }, true))).toEqual([]);
    const many: Record<string, TileState> = {};
    const turned: Record<string, TileState> = {};
    for (let i = 0; i <= FLIP_MAX; i++) {
      many[`t${i}:0`] = tile('coal');
      turned[`t${i}:0`] = tile('coal', true);
    }
    expect(freshFlips({ tiles: many, actions: [] }, step(turned))).toEqual([]);
  });
});
