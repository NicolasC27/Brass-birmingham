import { afterEach, describe, expect, it } from 'vitest';
import {
  APRON_Y,
  BLEED_X,
  BLEED_Y,
  FIT_PAD_BOTTOM,
  MAX_K,
  MIN_K,
  PAINT_H,
  PAINT_W,
  WORLD_H,
  WORLD_W,
  clampPan,
  fitScale,
  fitView,
  minK,
  playArea,
  setFitReserve,
  worldToScreen,
  zoomAt,
} from '@/components/game/boardView';
import type { View } from '@/components/game/boardView';
import { Camera } from '../camera';

afterEach(() => setFitReserve(FIT_PAD_BOTTOM));

/** the painting's rectangle on screen: left, top, right, bottom */
const painting = (v: View, w: number, h: number): [number, number, number, number] => {
  const [l, t] = worldToScreen(-BLEED_X, -BLEED_Y, v, w, h);
  const [r, b] = worldToScreen(WORLD_W + BLEED_X, WORLD_H + BLEED_Y, v, w, h);
  return [l, t, r, b];
};

/* the frames the table is played on: desktops (the browser's own bars
   taken off the height), the guide's lane open or folded, and tablets */
const FRAMES: [number, number][] = [
  [1440, 900], [1066, 900], [1396, 900], [1440, 790],
  [1280, 800], [946, 800], [1920, 1080], [1500, 1080], [1876, 950],
  [2560, 1440], [2140, 1440], [3440, 1440], [1024, 768], [768, 1024],
];
/* the hand's strip: gone, at rest, on a pinned income track */
const RESERVES = [FIT_PAD_BOTTOM, 216, 232];

describe('the least zoom covers the frame with the painting', () => {
  it('is the cover scale over the fit, on a frame narrower than the painting', () => {
    setFitReserve(216);
    /* 1440×900 with the guide's lane open: the fit is held by the width,
       and the painting alone would leave a band of black under it */
    const k = minK(1066, 900);
    expect(fitScale(1066, 900) * k).toBeCloseTo(900 / PAINT_H, 9);
    expect(k).toBeGreaterThan(1.15);
  });

  it('is the cover scale over the fit, on a frame wider than the painting', () => {
    setFitReserve(216);
    /* a wide window the browser's bars have made shorter: the black stood
       down both sides */
    const k = minK(1876, 950);
    expect(fitScale(1876, 950) * k).toBeCloseTo(1876 / PAINT_W, 9);
    expect(k).toBeGreaterThan(1.1);
  });

  it('never goes under the fit, nor past the ceiling', () => {
    setFitReserve(216);
    /* on a large screen the fit covers the frame already */
    expect(minK(2560, 1440)).toBe(MIN_K);
    expect(minK(40000, 300)).toBe(MAX_K);
    expect(minK(0, 0)).toBe(MIN_K);
  });

  it('follows the hand: a taller strip lowers the fit and raises the floor', () => {
    setFitReserve(FIT_PAD_BOTTOM);
    const loose = minK(1440, 900);
    setFitReserve(232);
    expect(minK(1440, 900)).toBeGreaterThan(loose);
  });
});

describe('the pan never brings the painting inside the frame', () => {
  it('on every frame, at every zoom and pan asked of it', () => {
    for (const r of RESERVES) {
      setFitReserve(r);
      for (const [w, h] of FRAMES) {
        for (const k of [0.5, 1, minK(w, h), 1.4, 2, MAX_K, 9]) {
          for (const [x, y] of [[0, 0], [1e6, 1e6], [-1e6, -1e6], [1e6, -1e6], [-1e6, 1e6]]) {
            const v = clampPan({ k, x, y }, w, h);
            expect(v.k).toBeGreaterThanOrEqual(minK(w, h) - 1e-9);
            expect(v.k).toBeLessThanOrEqual(MAX_K);
            const [pl, pt, pr, pb] = painting(v, w, h);
            const s = fitScale(w, h) * v.k;
            expect(pl).toBeLessThanOrEqual(1e-6);
            expect(pr).toBeGreaterThanOrEqual(w - 1e-6);
            expect(pt).toBeLessThanOrEqual(1e-6);
            /* the south may rise over the apron, never past it */
            expect(pb + APRON_Y * s).toBeGreaterThanOrEqual(h - 1e-6);
          }
        }
      }
    }
  });

  it('rises past the southern edge only as far as the hand asks', () => {
    setFitReserve(216);
    const [w, h] = [1066, 900];
    const v = clampPan({ k: 1, x: 0, y: -1e6 }, w, h);
    const [, south] = worldToScreen(0, WORLD_H, v, w, h);
    /* the world's southern edge stands on the hand, no higher */
    expect(south).toBeCloseTo(h - 216, 6);
    const [, , , pb] = painting(v, w, h);
    expect(pb).toBeLessThan(h);
  });

  it('keeps the rise inside the bleed when the painting is deep enough', () => {
    setFitReserve(216);
    /* close in, the bleed alone clears the hand */
    const v = clampPan({ k: 2.5, x: 0, y: -1e6 }, 1440, 900);
    const [, , , pb] = painting(v, 1440, 900);
    expect(pb).toBeGreaterThanOrEqual(900 - 1e-6);
  });

  it('a zoom out stops at the floor and keeps the frame covered', () => {
    setFitReserve(216);
    const [w, h] = [1876, 950];
    let v = fitView(w, h);
    for (let i = 0; i < 20; i++) v = zoomAt(v, 300, 200, 0.7, w, h);
    expect(v.k).toBeCloseTo(minK(w, h), 9);
    const [pl, pt, pr] = painting(v, w, h);
    expect(pl).toBeLessThanOrEqual(1e-6);
    expect(pr).toBeGreaterThanOrEqual(w - 1e-6);
    expect(pt).toBeLessThanOrEqual(1e-6);
  });
});

describe('the opening view frames the play area on the room above the hand', () => {
  const MIDLANDS = playArea([
    { x: 1000, y: 142 },
    { x: 2260, y: 1612 },
    { x: 708, y: 900 },
    { x: 2486, y: 1676 },
  ]);

  it('pads the places and stays inside the world', () => {
    expect(MIDLANDS.x0).toBe(578);
    expect(MIDLANDS.x1).toBe(2616);
    expect(MIDLANDS.y0).toBe(22);
    expect(MIDLANDS.y1).toBe(WORLD_H);
    expect(playArea([])).toEqual({ x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H });
  });

  it('is closer than the old fit on a narrow frame, and covers it', () => {
    setFitReserve(216);
    for (const [w, h] of FRAMES) {
      const v = fitView(w, h, MIDLANDS);
      expect(v.k).toBeGreaterThanOrEqual(minK(w, h) - 1e-9);
      const [pl, pt, pr] = painting(v, w, h);
      expect(pl).toBeLessThanOrEqual(1e-6);
      expect(pr).toBeGreaterThanOrEqual(w - 1e-6);
      expect(pt).toBeLessThanOrEqual(1e-6);
      /* every town and merchant is on screen, west to east — but on a
         portrait tablet, where the cover is closer than the area allows:
         the area then runs off both sides alike, the pan reaching either */
      const [west] = worldToScreen(MIDLANDS.x0, 0, v, w, h);
      const [east] = worldToScreen(MIDLANDS.x1, 0, v, w, h);
      if (w > h) {
        expect(west).toBeGreaterThanOrEqual(-1e-6);
        expect(east).toBeLessThanOrEqual(w + 1e-6);
      } else expect(west).toBeCloseTo(w - east, 6);
    }
    /* the guide's lane open at 1440×900: the area, not the world, fills the width */
    expect(fitView(1066, 900, MIDLANDS).k).toBeGreaterThan(1.15);
  });

  it('keeps the play area above the hand where the room allows it', () => {
    setFitReserve(216);
    const v = fitView(1920, 1080, MIDLANDS);
    const [, north] = worldToScreen(0, MIDLANDS.y0, v, 1920, 1080);
    const [, south] = worldToScreen(0, MIDLANDS.y1, v, 1920, 1080);
    expect(north).toBeGreaterThanOrEqual(-0.5);
    expect(south).toBeLessThanOrEqual(1080 - 216 + 0.5);
  });
});

describe('the camera keeps the frame covered as it changes', () => {
  const frame = { w: 1440, h: 900 };
  afterEach(() => {
    frame.w = 1440;
    frame.h = 900;
  });

  it('frames the play area again while the reader has not moved it', () => {
    setFitReserve(216);
    const area = { x0: 578, y0: 22, x1: 2616, y1: WORLD_H };
    const cam = new Camera(() => frame, area);
    expect(cam.view).toEqual(fitView(1440, 900, area));
    /* the guide's lane opens: the frame narrows, the camera frames again */
    frame.w = 1066;
    cam.reclamp(true);
    expect(cam.view).toEqual(fitView(1066, 900, area));
    expect(cam.target).toEqual(fitView(1066, 900, area));
  });

  it('only holds a view the reader moved, zoomed to the new floor', () => {
    setFitReserve(216);
    frame.w = 1876;
    frame.h = 1080;
    const cam = new Camera(() => frame);
    cam.zoomStep(1 / 1.35);
    for (let i = 0; i < 200; i++) cam.tick(16);
    /* a shorter window: the floor rises, the view with it */
    frame.h = 950;
    cam.reclamp(true);
    expect(cam.view.k).toBeCloseTo(minK(1876, 950), 9);
    const [pl, pt, pr] = painting(cam.view, 1876, 950);
    expect(pl).toBeLessThanOrEqual(1e-6);
    expect(pr).toBeGreaterThanOrEqual(1876 - 1e-6);
    expect(pt).toBeLessThanOrEqual(1e-6);
  });

  it('the fit key frames the play area again', () => {
    setFitReserve(216);
    const cam = new Camera(() => frame);
    cam.flyTo(2600, 300, 2.5);
    cam.fit();
    expect(cam.target).toEqual(fitView(1440, 900));
    /* and the frame changing afterwards frames it again */
    frame.w = 1066;
    cam.reclamp();
    expect(cam.target).toEqual(fitView(1066, 900));
  });
});
