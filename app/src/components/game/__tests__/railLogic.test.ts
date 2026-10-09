import { describe, expect, it } from 'vitest';
import { RAIL_MODES, filetTicks, lanternStop, rankDrift, sanitizeRailMode, shownRailMode, spentShare } from '../railLogic';

describe('the players’ column', () => {
  it('opens on the medallions whatever was stored before', () => {
    expect(sanitizeRailMode('cards')).toBe('cards');
    expect(sanitizeRailMode('slip')).toBe('slip');
    expect(sanitizeRailMode('medals')).toBe('medals');
    expect(sanitizeRailMode('1')).toBe('medals');
    expect(sanitizeRailMode(null)).toBe('medals');
    expect(RAIL_MODES).toEqual(['medals', 'cards', 'slip']);
  });

  it('keeps the trimmed cards for a game read again, and never spreads them in the focus view', () => {
    expect(shownRailMode({ mode: 'slip', focus: false, reading: true })).toBe('cards');
    expect(shownRailMode({ mode: 'cards', focus: true, reading: false })).toBe('medals');
    expect(shownRailMode({ mode: 'slip', focus: true, reading: false })).toBe('slip');
    expect(shownRailMode({ mode: 'cards', focus: false, reading: false })).toBe('cards');
  });
});

describe('the ring of the medallion', () => {
  it('shows the part of the purse the round has taken', () => {
    expect(spentShare(0, 0)).toBe(0);
    expect(spentShare(0, 30)).toBe(0);
    expect(spentShare(10, 30)).toBe(0.25);
    expect(spentShare(12, 0)).toBe(1);
  });

  it('stays within the ring when the figures stray', () => {
    expect(spentShare(-5, 20)).toBe(0);
    expect(spentShare(8, -3)).toBe(1);
  });

  it('tells which way a seat moves in the next order', () => {
    expect(rankDrift(1, 3)).toBe('up');
    expect(rankDrift(4, 2)).toBe('down');
    expect(rankDrift(2, 2)).toBe('same');
  });
});

describe('the lantern of the turn', () => {
  it('stops at the seat to act, by its place in the order of play', () => {
    expect(lanternStop([2, 0, 3, 1], 3, false)).toBe(2);
    expect(lanternStop([2, 0, 3, 1], 2, false)).toBe(0);
  });

  it('goes out when the game is over or the seat is not in the order', () => {
    expect(lanternStop([0, 1], 1, true)).toBeNull();
    expect(lanternStop([0, 1], 5, false)).toBeNull();
  });
});

describe('the income filet', () => {
  it('is graduated every five spaces, the tens marked', () => {
    const ticks = filetTicks(99);
    expect(ticks).toHaveLength(20);
    expect(ticks[0]).toEqual({ space: 0, major: true });
    expect(ticks[1]).toEqual({ space: 5, major: false });
    expect(ticks.filter((k) => k.major).map((k) => k.space)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(ticks[ticks.length - 1].space).toBe(95);
  });
});
