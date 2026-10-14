import { describe, expect, it } from 'vitest';
import { LIFE, LIFE_GAP, TUNES, TUNE_FIRST, TUNE_PAUSE, lifeAt, nextOf, spanOf, tuneLength, tuneOf } from '../playlist';
import type { Chance } from '../playlist';

/** a seeded chance (mulberry32), so a long run is the same every time */
const seeded = (seed: number): Chance => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const always = (v: number): Chance => () => v;

describe('the playlists', () => {
  it('give the canal three tunes and the rail two of its own', () => {
    expect(TUNES.canal.map((t) => t.name)).toEqual(['music-canal', 'music-canal-ii', 'music-canal-iii']);
    expect(TUNES.rail.map((t) => t.name)).toEqual(['music-rail-i', 'music-rail-ii']);
  });

  it('never play the same tune twice in a row, and play every one', () => {
    for (const era of ['canal', 'rail'] as const) {
      const names = TUNES[era].map((t) => t.name);
      const chance = seeded(era === 'canal' ? 7 : 11);
      let last: string | null = null;
      const heard = new Set<string>();
      for (let i = 0; i < 500; i++) {
        const next: string = nextOf(names, last, chance);
        expect(next).not.toBe(last);
        heard.add(next);
        last = next;
      }
      expect([...heard].sort()).toEqual([...names].sort());
    }
  });

  it('draw evenly among the others, whatever the chance says at its edges', () => {
    const names = ['a', 'b', 'c'];
    expect(nextOf(names, 'a', always(0))).toBe('b');
    expect(nextOf(names, 'a', always(0.999999))).toBe('c');
    /* a chance of exactly 1 (never from Math.random) still names a tune */
    expect(nextOf(names, 'c', always(1))).toBe('b');
    /* the first of all may be any */
    expect(nextOf(names, null, always(0))).toBe('a');
    /* a playlist of one plays it again rather than nothing */
    expect(nextOf(['solo'], 'solo', always(0.5))).toBe('solo');
  });

  it('leave the ambience alone 45 s to 150 s between two tunes, and begin within seconds', () => {
    const chance = seeded(3);
    for (let i = 0; i < 500; i++) {
      const pause = spanOf(TUNE_PAUSE, chance);
      expect(pause).toBeGreaterThanOrEqual(45);
      expect(pause).toBeLessThan(150);
      const first = spanOf(TUNE_FIRST, chance);
      expect(first).toBeGreaterThanOrEqual(4);
      expect(first).toBeLessThan(10);
    }
    expect(spanOf(TUNE_PAUSE, always(0))).toBe(45);
    expect(spanOf(TUNE_PAUSE, always(0.5))).toBe(97.5);
  });

  it('hear the canal’s first air twice over, and the others through once', () => {
    const first = tuneOf('canal', 'music-canal')!;
    expect(tuneLength(first, 68.6)).toBeCloseTo(137.07, 2);
    expect(tuneLength(tuneOf('canal', 'music-canal-ii')!, 97.6)).toBe(97.6);
    expect(tuneOf('rail', 'music-canal')).toBeUndefined();
    /* every tune is heard for a minute and a half to three minutes */
    expect(tuneLength(first, 68.6) / 60).toBeGreaterThanOrEqual(1.5);
    expect(tuneLength(first, 68.6) / 60).toBeLessThanOrEqual(3);
  });
});

describe('the rail’s life', () => {
  it('spaces its events 40 s to 120 s apart, never the same twice running', () => {
    const chance = seeded(5);
    let last: (typeof LIFE)[number] | null = null;
    for (let i = 0; i < 300; i++) {
      const gap = spanOf(LIFE_GAP, chance);
      expect(gap).toBeGreaterThanOrEqual(40);
      expect(gap).toBeLessThan(120);
      const next: (typeof LIFE)[number] = nextOf(LIFE, last, chance);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('waits for a moment of the game to be over', () => {
    expect(lifeAt(1000, 0)).toBe(1000);
    expect(lifeAt(1000, 4000)).toBe(4000);
    expect(lifeAt(5000, 4000)).toBe(5000);
  });
});
