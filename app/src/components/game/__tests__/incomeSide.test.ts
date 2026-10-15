import { describe, expect, it } from 'vitest';
import { FILET_H, FILET_W, TRACK_H, TRACK_W, getBoardOptions, hudInsets, leftTrackTop } from '../boardOptions';
import type { BoardOptions } from '../boardOptions';
import { leftSheetStyle } from '../useLayer';
import { REVIEW_CURVE_H } from '../guideKeys';
import { TIP_GAP, TIP_MARGIN, placeTip } from '../tooltipPlace';

/* ------------------------------------------------------------------ */
/* The income track along the bottom or down the left edge: the room   */
/* the HUD leaves it, where it starts, and the plates it opens staying */
/* on the screen.                                                       */
/* ------------------------------------------------------------------ */

const opts = (incomeSide: BoardOptions['incomeSide']): BoardOptions => ({ ...getBoardOptions(), incomeSide });

describe('the room the HUD leaves the income track', () => {
  it('along the bottom: the filet is counted at the foot, the left is a plain margin', () => {
    const i = hudInsets(opts('bottom'), false);
    expect(i.bottom).toBe(FILET_H + 8);
    expect(i.left).toBe(12);
  });

  it('down the left edge: the HUD stands clear of the filet and nearly all of the open ruler', () => {
    const i = hudInsets(opts('left'), false);
    expect(i.bottom).toBe(12);
    expect(i.left).toBeGreaterThan(FILET_W + 8);
    /* the ruler reaches over the lantern's lane only (16 px), not the rings */
    expect(TRACK_W - i.left).toBeGreaterThanOrEqual(0);
    expect(TRACK_W - i.left).toBeLessThan(16);
  });

  it('counts the VP track at the top and the analysis at the right on either side', () => {
    for (const side of ['bottom', 'left'] as const) {
      expect(hudInsets(opts(side), true).top).toBe(TRACK_H + 8);
      expect(hudInsets(opts(side), false).top).toBe(8);
      expect(hudInsets(opts(side), false, 300).right).toBe(312);
    }
  });
});

describe('where the left track starts', () => {
  it('at the very top when nothing holds it, under the VP track when it is shown', () => {
    expect(leftTrackTop(hudInsets(opts('left'), false))).toBe(0);
    expect(leftTrackTop(hudInsets(opts('left'), true))).toBe(TRACK_H);
  });

  it('under the curve of a game being read', () => {
    expect(leftTrackTop({ top: REVIEW_CURVE_H + 8 })).toBe(REVIEW_CURVE_H);
  });
});

describe('a sheet of the left edge', () => {
  it('stands at the HUD inset, beside the track rather than over it', () => {
    const left = hudInsets(opts('left'), false).left;
    expect(leftSheetStyle(88, left).left).toBe(left);
    expect(leftSheetStyle(88, 12).maxHeight).toBe('calc(100% - 192px)');
  });
});

describe('a tooltip plate', () => {
  const vw = 1440;
  const vh = 900;
  const plate = { w: 260, h: 110 };

  it('centres on its anchor when there is room', () => {
    const at = placeTip('top', { x: 700, y: 870, w: 20, h: 20 }, plate, vw, vh);
    expect(at.left).toBe(710 - 130);
    expect(at.bottom).toBe(vh - 870 + TIP_GAP);
  });

  it('slides back inside the screen at an end of a track', () => {
    expect(placeTip('top', { x: 40, y: 870, w: 16, h: 16 }, plate, vw, vh).left).toBe(TIP_MARGIN);
    expect(placeTip('top', { x: 1420, y: 870, w: 16, h: 16 }, plate, vw, vh).left).toBe(vw - TIP_MARGIN - 260);
    /* down the left edge: a bracket at the top or the foot */
    expect(placeTip('right', { x: 0, y: 2, w: 52, h: 30 }, plate, vw, vh).top).toBe(TIP_MARGIN);
    expect(placeTip('right', { x: 0, y: 870, w: 52, h: 30 }, plate, vw, vh).top).toBe(vh - TIP_MARGIN - 110);
  });

  it('centres on the part of a bracket that shows, and parts from it by the gap asked', () => {
    /* a bracket half above the screen's top: centred on 0..200, not -200..200 */
    const at = placeTip('right', { x: 0, y: -200, w: 52, h: 400 }, plate, vw, vh, 31);
    expect(at.top).toBe(100 - 55);
    expect(at.left).toBe(52 + 31);
  });

  it('is laid by the middle alone before it has been measured', () => {
    expect(placeTip('bottom', { x: 100, y: 10, w: 20, h: 20 }, null, vw, vh)).toEqual({ left: 110, top: 30 + TIP_GAP });
  });
});
