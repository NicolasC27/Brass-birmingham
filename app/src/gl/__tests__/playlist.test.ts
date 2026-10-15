import { describe, expect, it } from 'vitest';
import { BUBBLE_AFTER_S, LIFE, LIFE_GAP, TUNES, TUNE_FIRST, TUNE_PAUSE, VOICE_GAP, bubbleSpan, lifeAt, nextOf, spanOf, tuneOf, voiceAt } from '../playlist';
import type { Chance, Life } from '../playlist';

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
  it('give the canal four tunes and the rail three of its own', () => {
    expect(TUNES.canal.map((t) => t.name)).toEqual(['music-canal-iv', 'music-canal-vii', 'music-canal-vi', 'music-canal-ii']);
    expect(TUNES.rail.map((t) => t.name)).toEqual(['music-rail-iv', 'music-rail-ii', 'music-rail-v']);
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

  it('find a tune in its own era only, and loop none of them', () => {
    expect(tuneOf('canal', 'music-canal-iv')).toEqual({ name: 'music-canal-iv' });
    expect(tuneOf('rail', 'music-canal-iv')).toBeUndefined();
    /* the canal's old air, a loop heard twice over, is retired, and so
       are the pieces that played their strains twice running */
    for (const gone of ['music-canal', 'music-canal-v']) expect(tuneOf('canal', gone)).toBeUndefined();
    for (const gone of ['music-rail-i', 'music-rail-iii']) expect(tuneOf('rail', gone)).toBeUndefined();
    for (const era of ['canal', 'rail'] as const) for (const t of TUNES[era]) expect(Object.keys(t)).toEqual(['name']);
  });
});

describe('each era’s life', () => {
  it('gives the canal its waterway and the rail its trains and works, none shared', () => {
    expect(LIFE.canal).toEqual(['life-horse', 'life-lock', 'life-forge', 'life-bell', 'life-geese']);
    expect(LIFE.rail).toEqual(['life-whistle', 'life-passing', 'life-couple', 'life-depart', 'life-hammer', 'life-steam']);
    expect(LIFE.canal.filter((n) => (LIFE.rail as readonly string[]).includes(n))).toEqual([]);
  });

  it('spaces its events 40 s to 120 s apart, never the same twice running, and plays every one', () => {
    for (const era of ['canal', 'rail'] as const) {
      const chance = seeded(era === 'canal' ? 5 : 9);
      let last: Life | null = null;
      const heard = new Set<Life>();
      for (let i = 0; i < 300; i++) {
        const gap = spanOf(LIFE_GAP, chance);
        expect(gap).toBeGreaterThanOrEqual(40);
        expect(gap).toBeLessThan(120);
        const next: Life = nextOf<Life>(LIFE[era], last, chance);
        expect(next).not.toBe(last);
        heard.add(next);
        last = next;
      }
      expect(heard.size).toBe(LIFE[era].length);
    }
  });

  it('waits for a moment of the game to be over', () => {
    expect(lifeAt(1000, 0)).toBe(1000);
    expect(lifeAt(1000, 4000)).toBe(4000);
    expect(lifeAt(5000, 4000)).toBe(5000);
  });
});

describe('the townsfolk’s pace', () => {
  const S = 1000;
  it('keeps to its plan when nothing stirs', () => {
    expect(voiceAt(100 * S, 0, null, 5)).toBe(100 * S);
  });

  it('answers a stir within seconds once the last voice is a minute behind', () => {
    /* the last voice ended at 0, the next planned at 150 s, a stir at 70 s */
    expect(voiceAt(150 * S, 0, 70 * S, 5)).toBe(75 * S);
  });

  it('never speaks sooner than a minute after the last voice, stir or not', () => {
    /* a stir 20 s after the last voice: it waits for the minute */
    expect(voiceAt(150 * S, 0, 20 * S, 5)).toBe(VOICE_GAP[0] * S);
  });

  it('never later than planned', () => {
    expect(voiceAt(62 * S, 0, 60 * S, 8)).toBe(62 * S);
  });

  it('keeps the bubble up a moment after the voice', () => {
    expect(BUBBLE_AFTER_S).toBe(1.5);
    expect(bubbleSpan(2.4)).toBeCloseTo(3.9);
  });
});
