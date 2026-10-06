import { beforeEach, describe, expect, it } from 'vitest';
import type { Kept } from '../analysisKeep';
import { analysisKey, isWhole, keepAnalysis, readKept, sweep } from '../analysisKeep';

const reading = (c: number) => ({ chance: c, low: c - 0.02, high: c + 0.02, passes: 3 });
const kept = (): Omit<Kept, 'moves'> => ({
  seats: { 0: [reading(0.512345), reading(0.4876543)], 1: [reading(0.4987654), reading(0.5012346)] },
  verdicts: { 0: { 0: { at: 0, round: 1, era: 'canal', roads: [{ action: { kind: 'pass' }, chance: 0.4123456 }], mine: 0.4123456, best: 0.5123456, loss: 0.1, grade: 'mistake' } } },
  roads: { 0: { '0|': [{ action: { kind: 'pass' }, chance: 0.333333 }] } },
  total: 12,
  done: 12,
});

describe('an analysis kept', () => {
  beforeEach(() => sweep(0));

  it('comes back as it was written, to the point it is shown at', () => {
    const key = analysisKey('abcd', 7);
    keepAnalysis(key, 30, kept());
    const back = readKept(key, 30);
    expect(back).not.toBeNull();
    expect(back!.total).toBe(12);
    /* every figure it set out to make has landed: the panel need not read again */
    expect(isWhole(back, 30)).toBe(true);
    expect(isWhole({ ...back!, done: 5 }, 30)).toBe(false);
    /* a position carries a reading per seat, kept for all of them at once */
    expect(back!.seats[0]).toHaveLength(2);
    expect(back!.seats[0][0].chance).toBeCloseTo(0.5123, 6);
    expect(back!.seats[0][1].chance).toBeCloseTo(0.4877, 6);
    expect(back!.verdicts[0][0].grade).toBe('mistake');
    expect(back!.roads[0]['0|'][0].chance).toBeCloseTo(0.3333, 6);
    /* a seat never read has no verdicts of its own */
    expect(back!.verdicts[1]).toBeUndefined();
    /* the table and the deal each name their own entry */
    expect(readKept(analysisKey('abcd', 8), 30)).toBeNull();
  });

  it('serves a longer game, never a shorter one, and never another judge', () => {
    const key = analysisKey('abcd', 7);
    keepAnalysis(key, 30, kept());
    /* a reading of the first thirty moves still reads the first thirty moves
       of a game that has since played on */
    expect(readKept(key, 31)?.moves).toBe(30);
    /* but never a game shorter than what was read */
    expect(readKept(key, 29)).toBeNull();
    /* another judge reads on another scale: another entry entirely */
    expect(readKept(analysisKey('abcd', 7, 'quick'), 30)).toBeNull();
  });

  it('holds a handful of games, the least recently read going first', () => {
    for (let g = 0; g < 12; g++) keepAnalysis(analysisKey(`t${g}`, 1), 30, kept());
    /* the last eight written are the ones still held */
    expect(readKept(analysisKey('t11', 1), 30)).not.toBeNull();
    expect(readKept(analysisKey('t4', 1), 30)).not.toBeNull();
    expect(readKept(analysisKey('t3', 1), 30)).toBeNull();
    expect(readKept(analysisKey('t0', 1), 30)).toBeNull();
  });
});
