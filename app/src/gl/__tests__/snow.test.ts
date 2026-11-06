import { describe, expect, it } from 'vitest';
import { FLAKES, gust, snowDensity } from '../snow';

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
