import { describe, expect, it } from 'vitest';
import { FLAKES, STORM_BLOW, STORM_EVERY, STORM_RISE, gust, snowDensity, storm } from '../snow';

/* ------------------------------------------------------------------ */
/* the snow's pure parts: how hard the wind blows, and how much of the  */
/* sheet is seen as the evening comes                                   */
/* ------------------------------------------------------------------ */

describe('the wind over the frozen ground', () => {
  it('never drops to nothing and never tears the sheet', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 600; t += 0.25) {
      const g = gust(t);
      lo = Math.min(lo, g);
      hi = Math.max(hi, g);
    }
    expect(lo).toBeGreaterThanOrEqual(0.6);
    expect(hi).toBeLessThanOrEqual(1.9);
    /* it does gust: well past its lull */
    expect(hi - lo).toBeGreaterThan(0.6);
  });
});

describe('the snow seen', () => {
  it('is a third of the sheet by day and all of it by night', () => {
    expect(Math.floor(FLAKES * snowDensity(0))).toBeLessThan(FLAKES / 2);
    expect(snowDensity(1)).toBe(1);
    expect(snowDensity(0.5)).toBeGreaterThan(snowDensity(0));
    expect(snowDensity(2)).toBe(1);
    expect(snowDensity(-1)).toBe(snowDensity(0));
  });
});

describe('the storm', () => {
  it('comes once a cycle, rises, blows a minute and drops, and is nothing the rest of the time', () => {
    const start = STORM_EVERY - 2 * STORM_RISE - STORM_BLOW;
    expect(storm(0)).toBe(0);
    expect(storm(start - 1)).toBe(0);
    expect(storm(start + STORM_RISE / 2)).toBeGreaterThan(0.3);
    expect(storm(start + STORM_RISE / 2)).toBeLessThan(0.7);
    expect(storm(start + STORM_RISE + 1)).toBe(1);
    expect(storm(start + STORM_RISE + STORM_BLOW - 1)).toBe(1);
    expect(storm(STORM_EVERY - 1)).toBeLessThan(0.1);
    expect(storm(STORM_EVERY + 5)).toBe(0);
    /* most of the cycle is calm */
    let calm = 0;
    for (let t = 0; t < STORM_EVERY; t++) if (storm(t) === 0) calm++;
    expect(calm / STORM_EVERY).toBeGreaterThan(0.65);
  });
});
