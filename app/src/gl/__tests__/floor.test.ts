import { describe, expect, it } from 'vitest';
import { RIBBON_MAX_SCALE, fitScale } from '@/components/game/boardView';
import { FIGURE_MIN_SCREEN, SEAL_MIN_SCREEN, flooredScale } from '../floor';

/* the opening view of a 1440×900 table: the whole map at the fit */
const OPENING = fitScale(1440, 900);
const px = (size: number, s: number, scale: number) => size * s * scale;

describe('the marks on a card keep a floor on screen', () => {
  it('a turned card’s score reads at the figure floor at the opening view', () => {
    const score = { size: 15, px: FIGURE_MIN_SCREEN, base: 1 };
    expect(OPENING).toBeCloseTo(0.45, 2);
    /* drawn at 6.8 px before the floor */
    expect(px(15, OPENING, 1)).toBeLessThan(7);
    expect(px(15, OPENING, flooredScale(OPENING, score))).toBeGreaterThanOrEqual(FIGURE_MIN_SCREEN - 1e-9);
  });

  it('the stock figure grows to the ribbons’ ceiling, never past it', () => {
    const stock = { size: 12.5, px: FIGURE_MIN_SCREEN, base: 1 };
    const k = flooredScale(OPENING, stock);
    expect(k).toBe(RIBBON_MAX_SCALE);
    expect(px(12.5, OPENING, k)).toBeGreaterThan(8); // was 5.6 px
  });

  it('a mark is never drawn smaller than it is made, however close the camera', () => {
    const level = { size: 9, px: FIGURE_MIN_SCREEN, base: 1 };
    for (const s of [0.2, 0.45, 0.9, 1.35, 3]) expect(flooredScale(s, level)).toBeGreaterThanOrEqual(1);
    /* once the figure clears its floor by itself, it is left as drawn */
    for (const s of [1.2, 1.35, 3]) expect(flooredScale(s, level)).toBe(1);
  });

  it('the level plaque is held under its neighbour’s reach', () => {
    expect(flooredScale(0.3, { size: 9, px: FIGURE_MIN_SCREEN, base: 1, max: 1.25 })).toBe(1.25);
  });

  it('colour-blind mode seats the seal larger at every zoom', () => {
    const plain = { size: 9, px: SEAL_MIN_SCREEN, base: 1 };
    const larger = { ...plain, base: 1.35 };
    for (const s of [OPENING, 1, 2, 3]) {
      expect(flooredScale(s, larger)).toBeGreaterThanOrEqual(1.35);
      expect(flooredScale(s, larger)).toBeGreaterThanOrEqual(flooredScale(s, plain));
    }
  });
});
