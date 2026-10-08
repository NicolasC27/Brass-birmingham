import { describe, expect, it } from 'vitest';
import { CARD_MAX, CARD_MIN, CARD_PEEK, fanMeasure } from '../handFan';

describe('the hand is measured on its room', () => {
  it('lays eight cards side by side when the room holds them', () => {
    /* 1440 wide: the fan is given about 736px */
    const m = fanMeasure(8, 736);
    expect(m.step).toBeGreaterThanOrEqual(0);
    expect(m.card).toBeGreaterThanOrEqual(CARD_MIN);
    expect(8 * m.card + 7 * m.step).toBeLessThanOrEqual(736);
  });

  it('overlaps by exactly what the room lacks', () => {
    /* 1024 wide: about 411px for eight cards */
    const m = fanMeasure(8, 411);
    expect(m.card).toBe(CARD_MIN);
    expect(8 * m.card + 7 * m.step).toBeLessThanOrEqual(411);
    expect(8 * m.card + 7 * (m.step + 1)).toBeGreaterThan(411);
  });

  it('never hides more of a card than its peek', () => {
    const m = fanMeasure(8, 100);
    expect(m.card + m.step).toBeGreaterThanOrEqual(CARD_PEEK);
  });

  it('never grows a card past the widest', () => {
    expect(fanMeasure(3, 900).card).toBe(CARD_MAX);
  });
});
