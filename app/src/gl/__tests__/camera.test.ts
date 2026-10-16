import { afterEach, describe, expect, it } from 'vitest';
import { BLEED_X, BLEED_Y, FIT_PAD_BOTTOM, WORLD_W, clampPan, fitView, setFitReserve, worldToScreen } from '@/components/game/boardView';
import { Camera } from '../camera';

const frame = { w: 1024, h: 768 };
const camera = () => new Camera(() => frame);

afterEach(() => {
  frame.w = 1024;
  frame.h = 768;
  setFitReserve(FIT_PAD_BOTTOM);
});

describe('the camera frames the board on the room the hand leaves', () => {
  it('opens on the fit view, not on the centre of the canvas', () => {
    setFitReserve(220);
    const cam = camera();
    expect(cam.view).toEqual(fitView(1024, 768));
    expect(cam.target).toEqual(fitView(1024, 768));
    /* the painting covers the frame: no black at the sides nor the top */
    const [west, north] = worldToScreen(-BLEED_X, -BLEED_Y, cam.view, 1024, 768);
    const [east] = worldToScreen(WORLD_W + BLEED_X, 0, cam.view, 1024, 768);
    expect(west).toBeLessThanOrEqual(1e-6);
    expect(north).toBeLessThanOrEqual(1e-6);
    expect(east).toBeGreaterThanOrEqual(1024 - 1e-6);
  });

  it('a frame with no size yet is framed on its first tick', () => {
    frame.w = 0;
    frame.h = 0;
    const cam = camera();
    frame.w = 1440;
    frame.h = 900;
    cam.tick(16);
    expect(cam.view).toEqual(fitView(1440, 900));
  });

  it('the fit key flies to the fit view', () => {
    setFitReserve(220);
    const cam = camera();
    cam.flyTo(2600, 300, 2.5);
    cam.fit();
    expect(cam.target).toEqual(fitView(1024, 768));
  });
});

describe('the camera is held back when the frame changes', () => {
  it('a wider frame pulls a view at the edge back inside the bleed', () => {
    /* a frame fitted on its height: widening it keeps the scale and
       narrows the room to pan (the guide's lane folded, say) */
    frame.w = 1600;
    const cam = camera();
    cam.nudge(1, 0); // the reader has moved it: a new frame only holds it
    const edge = clampPan({ k: 3, x: 1e6, y: 0 }, 1600, 768);
    cam.view = { ...edge };
    cam.target = { ...edge };
    frame.w = 2000;
    cam.reclamp(true);
    const held = clampPan(edge, 2000, 768);
    expect(held.x).toBeLessThan(edge.x);
    expect(cam.view.x).toBeCloseTo(held.x, 6);
    expect(cam.target.x).toBeCloseTo(held.x, 6);
  });

  it('the hand coming up moves the target, and the chase carries the view there', () => {
    const cam = camera();
    cam.zoomStep(1.35);
    for (let i = 0; i < 200; i++) cam.tick(16);
    const before = { ...cam.view };
    const aim = { ...cam.target };
    setFitReserve(260);
    cam.reclamp();
    expect(cam.target).toEqual(clampPan(aim, 1024, 768));
    expect(cam.view).toEqual(before);
    for (let i = 0; i < 120; i++) cam.tick(16);
    expect(cam.view.y).toBeCloseTo(cam.target.y, 1);
  });
});
