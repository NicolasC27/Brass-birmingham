import { describe, expect, it } from 'vitest';
import { holdFor } from '../guideHold';
import type { Reading } from '../guideHold';

/** nothing on show: the guide at rest, a deed to do */
const quiet: Reading = { plate: false, news: false, page: 'do', review: false, coach: false };
const at = (r: Partial<Reading>): Reading => ({ ...quiet, ...r });

describe("the guide's hold on the machine", () => {
  it('waits on the plate, the news, a page, a lesson read back and the coach', () => {
    expect(holdFor(quiet)).toBeNull();
    expect(holdFor(at({ plate: true }))).toBe('plate');
    expect(holdFor(at({ news: true }))).toBe('news');
    expect(holdFor(at({ page: 'read' }))).toBe('page');
    expect(holdFor(at({ page: 'already' }))).toBe('page');
    expect(holdFor(at({ review: true }))).toBe('review');
    expect(holdFor(at({ coach: true }))).toBe('coach');
  });

  it('names first what the note shows first', () => {
    const all = at({ plate: true, news: true, page: 'read', review: true, coach: true });
    expect(holdFor(all)).toBe('plate');
    expect(holdFor({ ...all, plate: false })).toBe('news');
    expect(holdFor({ ...all, plate: false, news: false })).toBe('page');
    expect(holdFor({ ...all, plate: false, news: false, page: 'do' })).toBe('review');
  });

  it('holds for nothing while a deed is to do, the guide rests or is done', () => {
    for (const page of ['do', 'idle', 'finished', null] as const) expect(holdFor(at({ page }))).toBeNull();
  });
});
