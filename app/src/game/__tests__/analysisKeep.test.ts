import { beforeEach, describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION } from '../analysis';
import type { Kept } from '../analysisKeep';
import { analysisKey, keepAnalysis, readKept } from '../analysisKeep';

/* a shelf of this browser's own, since the tests run outside one */
class Shelf {
  map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const shelf = new Shelf();
Object.defineProperty(globalThis, 'localStorage', { value: shelf, configurable: true });

const reading = (c: number) => ({ chance: c, low: c - 0.02, high: c + 0.02, passes: 3 });
const kept = (): Omit<Kept, 'moves'> => ({
  seats: { 0: [reading(0.512345), reading(0.4876543)], 1: [reading(0.4987654), reading(0.5012346)] },
  verdicts: { 0: { 0: { at: 0, round: 1, era: 'canal', roads: [{ action: { kind: 'pass' }, chance: 0.4123456 }], mine: 0.4123456, best: 0.5123456, loss: 0.1, grade: 'mistake' } } },
  roads: { 0: { '0|': [{ action: { kind: 'pass' }, chance: 0.333333 }] } },
  total: 12,
});

describe('an analysis kept', () => {
  beforeEach(() => shelf.map.clear());

  it('comes back as it was written, to the point it is shown at', () => {
    const key = analysisKey('abcd', 7);
    keepAnalysis(key, 30, kept());
    const back = readKept(key, 30);
    expect(back).not.toBeNull();
    expect(back!.total).toBe(12);
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

  it('is thrown away when the judge changed, and serves a longer game', () => {
    const key = analysisKey('abcd', 7);
    keepAnalysis(key, 30, kept());
    /* a reading of the first thirty moves still reads the first thirty moves
       of a game that has since played on */
    expect(readKept(key, 31)?.moves).toBe(30);
    /* but never a game shorter than what was read */
    expect(readKept(key, 29)).toBeNull();
    const raw = JSON.parse(shelf.getItem(key)!);
    expect(raw.v).toBe(ANALYSIS_VERSION);
    shelf.setItem(key, JSON.stringify({ ...raw, v: ANALYSIS_VERSION + 1 }));
    expect(readKept(key, 30)).toBeNull();
    shelf.setItem(key, 'not a reading at all');
    expect(readKept(key, 30)).toBeNull();
  });

  it('keeps a handful of games, the least recently read going first', () => {
    for (let g = 0; g < 12; g++) keepAnalysis(analysisKey(`t${g}`, 1), 30, kept());
    expect(shelf.length).toBe(8);
    /* the last games written are the ones still there */
    expect(readKept(analysisKey('t11', 1), 30)).not.toBeNull();
    expect(readKept(analysisKey('t0', 1), 30)).toBeNull();
  });
});
