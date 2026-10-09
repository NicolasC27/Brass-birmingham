import { describe, expect, it } from 'vitest';
import { MERCHANTS } from '@/game/data';
import { MT, MT_GAP, ROW_SCALE, barrelAt, rowLift, rowSlotX, rowWidth } from '../merchantRow';

describe('a merchant\'s row', () => {
  it('lays its tiles evenly, centred on the node, the medallion to the right', () => {
    for (const n of [1, 2, 3]) {
      expect(rowSlotX(n, 0)).toBeCloseTo(-rowWidth(n) / 2 + MT / 2);
      if (n > 1) expect(rowSlotX(n, 1) - rowSlotX(n, 0)).toBe(MT + MT_GAP);
    }
  });

  it('stands each barrel at its tile\'s foot, in the world where the press draws it', () => {
    for (const m of MERCHANTS) {
      for (let i = 0; i < m.slots; i++) {
        const [x, y] = barrelAt(m, i);
        expect(x).toBeCloseTo(m.x + (rowSlotX(m.slots, i) + MT / 2 - 6) * ROW_SCALE);
        expect(y).toBeCloseTo(m.y - rowLift(m) + (MT / 2 + 2) * ROW_SCALE);
      }
    }
  });

  it('lifts only the southern rows clear of the hand', () => {
    expect(rowLift({ y: 1600 })).toBe(34);
    expect(rowLift({ y: 400 })).toBe(0);
  });
});
