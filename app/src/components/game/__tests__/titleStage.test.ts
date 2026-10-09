import { describe, expect, it } from 'vitest';
import { BOARD_CAP_MS, UNFRAMED_MS, boardStage, trackProgress } from '../titleStage';
import type { TitleStage } from '../titleStage';

const ORDER: TitleStage[] = ['reading', 'pressing', 'engraving', 'ready'];

describe('the title card lays its line', () => {
  it('only ever goes forward, within a stretch and from one to the next', () => {
    for (const stage of ORDER.slice(0, 3)) {
      let last = -1;
      for (let ms = 0; ms <= 20000; ms += 250) {
        const p = trackProgress(stage, ms);
        expect(p).toBeGreaterThanOrEqual(last);
        last = p;
      }
    }
    /* a stretch never reaches the next one's first sleeper */
    for (let i = 0; i < ORDER.length - 1; i++) {
      expect(trackProgress(ORDER[i], 60000)).toBeLessThanOrEqual(trackProgress(ORDER[i + 1], 0));
    }
  });

  it('lays the whole line once the table is set, and none of it before', () => {
    expect(trackProgress('ready', 0)).toBe(1);
    expect(trackProgress('reading', 0)).toBeGreaterThan(0);
    expect(trackProgress('engraving', 1e9)).toBeLessThan(1);
    expect(trackProgress('reading', -500)).toBe(trackProgress('reading', 0));
  });
});

describe('the title card reads the board', () => {
  it('waits on the press until the canvas stands', () => {
    expect(boardStage({ waited: 900, canvasFor: null, framed: null })).toBe('pressing');
    expect(boardStage({ waited: 900, canvasFor: null, framed: false })).toBe('pressing');
  });

  it('engraves until the minimap is framed against the board', () => {
    expect(boardStage({ waited: 2000, canvasFor: 300, framed: false })).toBe('engraving');
    expect(boardStage({ waited: 2000, canvasFor: 300, framed: true })).toBe('ready');
  });

  it('gives a board with no minimap a little while, not forever', () => {
    expect(boardStage({ waited: 2000, canvasFor: UNFRAMED_MS - 1, framed: null })).toBe('engraving');
    expect(boardStage({ waited: 2000, canvasFor: UNFRAMED_MS, framed: null })).toBe('ready');
  });

  it('never holds the table behind the card past the cap', () => {
    expect(boardStage({ waited: BOARD_CAP_MS, canvasFor: null, framed: null })).toBe('ready');
    expect(boardStage({ waited: BOARD_CAP_MS, canvasFor: 100, framed: false })).toBe('ready');
  });
});
