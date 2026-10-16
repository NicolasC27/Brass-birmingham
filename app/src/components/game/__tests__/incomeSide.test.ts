import { describe, expect, it } from 'vitest';
import { FILET_H, FILET_W, TRACK_H, TRACK_W, getBoardOptions, hudInsets, leftTrackTop } from '../boardOptions';
import type { BoardOptions } from '../boardOptions';
import { leftSheetStyle } from '../useLayer';
import { REVIEW_CURVE_H } from '../guideKeys';
import { TIP_GAP, TIP_MARGIN, placeTip } from '../tooltipPlace';
import { FLAG_GAP, FLAG_PLATE_H, FLAG_PLATE_MARGIN, FLAG_SPACE, crossedTo, fanLength, flagSpec, incomeLeaders, incomeSpot, levelSpan, payFigure, payWords, plateWidth, rungs, spreadFlags, underFlags } from '../incomeFlags';
import { INCOME_MAX, incomeLevel } from '@/game/data';
import { LANGS, money } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The income track along the bottom or down the left edge: the room   */
/* the HUD leaves it, where it starts, and the plates it opens staying */
/* on the screen.                                                       */
/* ------------------------------------------------------------------ */

const opts = (incomeSide: BoardOptions['incomeSide'], incomePinned = false): BoardOptions => ({ ...getBoardOptions(), incomeSide, incomePinned });

describe('the room the HUD leaves the income track', () => {
  it('along the bottom: the filet is counted at the foot, the left is a plain margin', () => {
    const i = hudInsets(opts('bottom'), false);
    expect(i.bottom).toBe(FILET_H + 8);
    expect(i.left).toBe(12);
  });

  it('down the left edge: the HUD stands clear of the filet and its pays, and nearly all of the open ruler', () => {
    const i = hudInsets(opts('left'), false);
    expect(i.bottom).toBe(12);
    expect(i.left).toBeGreaterThanOrEqual(FILET_W + 8);
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

describe('the room a pinned track takes', () => {
  it('along the bottom: the whole open ruler is kept, and a gap over it', () => {
    expect(hudInsets(opts('bottom', true), false).bottom).toBe(TRACK_H + 8);
    expect(hudInsets(opts('bottom', true), false).left).toBe(12);
  });

  it('down the left edge: the whole open ruler, the lantern’s lane no longer under it', () => {
    const i = hudInsets(opts('left', true), false);
    expect(i.left).toBe(TRACK_W + 8);
    expect(i.left).toBeGreaterThan(hudInsets(opts('left'), false).left);
    expect(i.bottom).toBe(12);
  });

  it('leaves the top and the right as they were', () => {
    for (const side of ['bottom', 'left'] as const) {
      expect(hudInsets(opts(side, true), true).top).toBe(hudInsets(opts(side), true).top);
      expect(hudInsets(opts(side, true), false, 300).right).toBe(312);
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

describe('the folded track at a glance', () => {
  /* flags never overprint: each begins after the last one ends, by the gap */
  const apart = (specs: ReturnType<typeof flagSpec>[], at: number[]) => {
    const boxes = specs.map((f, i) => ({ start: at[i] - f.lead, end: at[i] - f.lead + f.len })).sort((a, b) => a.start - b.start);
    return boxes.every((b, k) => k === 0 || b.start >= boxes[k - 1].end + FLAG_GAP - 1e-6);
  };

  it('leaves a flag on its rung when it has room', () => {
    const specs = [flagSpec('x', 100, 1, '£2'), flagSpec('x', 400, 1, '£15')];
    expect(spreadFlags(specs, FLAG_GAP, 0, 1000)).toEqual([100, 400]);
  });

  it('pushes neighbouring rungs apart, the cluster centred on them', () => {
    const specs = [flagSpec('x', 300, 1, '£10'), flagSpec('x', 312, 1, '£11'), flagSpec('x', 336, 2, '£11')];
    const at = spreadFlags(specs, FLAG_GAP, 0, 1000);
    expect(apart(specs, at)).toBe(true);
    /* the order along the track is kept */
    expect(at[0]).toBeLessThan(at[1]);
    expect(at[1]).toBeLessThan(at[2]);
    /* the pushes balance out: the cluster sits where its rungs are */
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const wants = specs.map((f) => f.at - f.lead);
    const starts = at.map((a, i) => a - specs[i].lead);
    const offs = [0, specs[0].len + FLAG_GAP, specs[0].len + specs[1].len + 2 * FLAG_GAP];
    expect(mean(starts.map((s, i) => s - offs[i]))).toBeCloseTo(mean(wants.map((w, i) => w - offs[i])), 6);
  });

  it('keeps a cluster inside the lane at either end', () => {
    const lo = [flagSpec('x', 2, 1, '−£10'), flagSpec('x', 8, 1, '−£9')];
    const at = spreadFlags(lo, FLAG_GAP, 0, 1000);
    expect(at[0] - lo[0].lead).toBeGreaterThanOrEqual(0);
    expect(apart(lo, at)).toBe(true);
    const hi = [flagSpec('x', 990, 1, '£29'), flagSpec('x', 996, 1, '£30')];
    const bt = spreadFlags(hi, FLAG_GAP, 0, 1000);
    expect(bt[1] - hi[1].lead + hi[1].len).toBeLessThanOrEqual(1000);
    expect(apart(hi, bt)).toBe(true);
  });

  it('stacks down the left edge by the tokens and the plate hung under them', () => {
    const specs = [flagSpec('y', 500, 1, '−10 £'), flagSpec('y', 504, 1, '−9 £'), flagSpec('y', 508, 3, '−8 £')];
    expect(specs[0].len).toBe(fanLength(1) + FLAG_SPACE + FLAG_PLATE_H);
    expect(specs[2].len).toBe(fanLength(3) + FLAG_SPACE + FLAG_PLATE_H);
    /* the rung is the middle of the tokens, not of the flag */
    expect(specs[2].lead).toBe(fanLength(3) / 2);
    const at = spreadFlags(specs, FLAG_GAP, 0, 800);
    expect(apart(specs, at)).toBe(true);
    expect(at[0]).toBeLessThan(at[1]);
  });

  it('keeps the plates inside the left lane at either end', () => {
    const top = [flagSpec('y', 3, 2, '30 £'), flagSpec('y', 9, 1, '30 £')];
    const at = spreadFlags(top, FLAG_GAP, 0, 800);
    expect(at[0] - top[0].lead).toBeGreaterThanOrEqual(0);
    const foot = [flagSpec('y', 790, 1, '−9 £'), flagSpec('y', 797, 1, '−10 £')];
    const bt = spreadFlags(foot, FLAG_GAP, 0, 800);
    expect(bt[1] - foot[1].lead + foot[1].len).toBeLessThanOrEqual(800);
    expect(apart(foot, bt)).toBe(true);
  });

  it('fits the widest pay in every language on a plate inside the left lane', () => {
    for (const l of LANGS) expect(plateWidth(money(-10, l))).toBeLessThanOrEqual(FILET_W - 2 * FLAG_PLATE_MARGIN);
  });

  it('leaves out a tens figure a flag stands over', () => {
    const specs = [flagSpec('y', 400, 1, '5 £')];
    const at = spreadFlags(specs, FLAG_GAP, 0, 800);
    expect(underFlags(specs, at, 400, 5)).toBe(true);
    /* under the plate as well as by the token */
    expect(underFlags(specs, at, 400 + fanLength(1) / 2 + FLAG_SPACE + FLAG_PLATE_H / 2, 5)).toBe(true);
    expect(underFlags(specs, at, 360, 5)).toBe(false);
    expect(underFlags(specs, at, 440, 5)).toBe(false);
  });

  it('gives a longer figure a longer flag along the bottom', () => {
    expect(flagSpec('x', 0, 1, '−10\u00a0£').len).toBeGreaterThan(flagSpec('x', 0, 1, '£2').len);
  });

  it('shares one flag between the seats of one rung', () => {
    expect(rungs([10, 12, 10, 3])).toEqual([
      { space: 10, seats: [0, 2] },
      { space: 12, seats: [1] },
      { space: 3, seats: [3] },
    ]);
  });

  it('names the leader, or leaders, and nobody while all stand level', () => {
    expect(incomeLeaders([10, 25, 12, 25])).toEqual([1, 3]);
    expect(incomeLeaders([10, 10, 10])).toEqual([]);
    expect(incomeLeaders([0, 0, 4])).toEqual([2]);
  });
});

describe('the rungs of the income track', () => {
  it('spans each level over its own spaces, the whole track covered once', () => {
    expect(levelSpan(-10)).toEqual({ from: 0, to: 0 });
    expect(levelSpan(0)).toEqual({ from: 10, to: 10 });
    expect(levelSpan(1)).toEqual({ from: 11, to: 12 });
    expect(levelSpan(5)).toEqual({ from: 19, to: 20 });
    expect(levelSpan(10)).toEqual({ from: 29, to: 30 });
    expect(levelSpan(11)).toEqual({ from: 31, to: 33 });
    expect(levelSpan(21)).toEqual({ from: 61, to: 64 });
    expect(levelSpan(29)).toEqual({ from: 93, to: 96 });
    expect(levelSpan(30)).toEqual({ from: 97, to: 99 });
    /* every space falls in the span of the level it pays, and in no other */
    for (let sp = 0; sp <= INCOME_MAX; sp++) {
      const { from, to } = levelSpan(incomeLevel(sp));
      expect(sp >= from && sp <= to).toBe(true);
    }
    for (let l = -10; l < 30; l++) expect(levelSpan(l + 1).from).toBe(levelSpan(l).to + 1);
  });

  it('tells where a marker stands and the spaces left to the next rung', () => {
    expect(incomeSpot(10)).toEqual({ level: 0, from: 10, to: 10, toNext: 1 });
    expect(incomeSpot(17)).toEqual({ level: 4, from: 17, to: 18, toNext: 2 });
    expect(incomeSpot(18)).toEqual({ level: 4, from: 17, to: 18, toNext: 1 });
    expect(incomeSpot(31).toNext).toBe(3);
    expect(incomeSpot(61).toNext).toBe(4);
    /* the ceiling: nowhere further to go */
    expect(incomeSpot(97)).toEqual({ level: 30, from: 97, to: 99, toNext: 0 });
    expect(incomeSpot(99).toNext).toBe(0);
    /* the spaces left always land the marker on the next rung's first space */
    for (let sp = 0; sp < 97; sp++) {
      const s = incomeSpot(sp);
      expect(incomeLevel(sp + s.toNext)).toBe(s.level + 1);
      expect(incomeLevel(sp + s.toNext - 1)).toBe(s.level);
    }
  });

  it('knows when a move crosses into another rung, and which', () => {
    /* inside a rung: the pay stays */
    expect(crossedTo(17, 18)).toBeNull();
    expect(crossedTo(31, 33)).toBeNull();
    /* over its edge: the new rung */
    expect(crossedTo(18, 19)).toBe(5);
    expect(crossedTo(10, 15)).toBe(3);
    expect(crossedTo(30, 36)).toBe(12);
    /* a loan goes the other way */
    expect(crossedTo(20, 14)).toBe(2);
    expect(crossedTo(10, 10)).toBeNull();
  });

  it('prints a rung’s pay signed, a rung that pays nothing as a quiet ±0', () => {
    for (const l of LANGS) {
      expect(payFigure(0, l)).toBe('±0');
      expect(payFigure(3, l)).toBe(`+${money(3, l)}`);
      expect(payFigure(-2, l)).toBe(money(-2, l));
      expect(payFigure(-2, l).startsWith('−')).toBe(true);
    }
    expect(payFigure(3, 'fr')).toBe('+3\u00a0£');
    expect(payFigure(3, 'en')).toBe('+£3');
    expect(payWords(0, 'fr')).toBe('0\u00a0£');
    expect(payWords(6, 'en')).toBe('+\u2060£6');
  });

  it('fits the widest signed pay on a plate inside the left lane', () => {
    for (const l of LANGS) for (const n of [-10, 30]) expect(plateWidth(payFigure(n, l))).toBeLessThanOrEqual(FILET_W - 2 * FLAG_PLATE_MARGIN);
  });
});
