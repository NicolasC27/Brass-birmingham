import { afterEach, describe, expect, it } from 'vitest';
import { FIT_PAD_BOTTOM, WORLD_H, clampPan, fitScale, fitView, screenToWorld, setFitReserve, worldToScreen } from '../boardView';

afterEach(() => setFitReserve(FIT_PAD_BOTTOM));

describe('the board is framed on the room the hand leaves', () => {
  it('fits the world into the height above the hand', () => {
    setFitReserve(225);
    /* 1440×900: the hand's 225px come off the height the world fits in */
    expect(fitScale(1440, 900)).toBeCloseTo((900 - 225) / WORLD_H, 6);
  });

  it('keeps the whole map above the hand at the fitted view, where the room allows it', () => {
    /* 1920×1080: the painting covering the frame leaves the world room above the hand */
    setFitReserve(225);
    const v = fitView(1920, 1080);
    const [, north] = worldToScreen(0, 0, v, 1920, 1080);
    const [, south] = worldToScreen(0, WORLD_H, v, 1920, 1080);
    expect(north).toBeGreaterThanOrEqual(-0.5);
    expect(south).toBeLessThanOrEqual(1080 - 225 + 0.5);
  });

  it('pulls a centred map up out from under the hand', () => {
    setFitReserve(225);
    const v = clampPan({ k: 1, x: 0, y: 0 }, 1920, 1080);
    const [, south] = worldToScreen(0, WORLD_H, v, 1920, 1080);
    expect(south).toBeLessThanOrEqual(1080 - 225 + 0.5);
  });

  it('keeps screen and world exact inverses under the reserve', () => {
    setFitReserve(225);
    const v = { k: 1.7, x: -120, y: 60 };
    const [sx, sy] = worldToScreen(812, 944, v, 1024, 768);
    const [wx, wy] = screenToWorld(sx, sy, v, 1024, 768);
    expect(wx).toBeCloseTo(812, 6);
    expect(wy).toBeCloseTo(944, 6);
  });
});
