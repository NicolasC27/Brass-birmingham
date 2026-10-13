import { describe, expect, it } from 'vitest';
import { keep } from '../backup';

describe('the drawer of copies', () => {
  it('keeps one a day for a week, one a week for a month, and the newest', () => {
    const names: string[] = [];
    /* four copies a day for sixty days */
    for (let d = 0; d < 60; d++) for (const h of ['00', '06', '12', '18']) names.push(`brassworks-${new Date(Date.UTC(2026, 6, 1 + d)).toISOString().slice(0, 10).replace(/-/g, '')}T${h}0000.db`);
    const kept = keep([...names, 'backups.log'], 7, 4);
    expect(kept.has(names[names.length - 1])).toBe(true);
    expect(kept.size).toBeLessThanOrEqual(11);
    expect(kept.size).toBeGreaterThanOrEqual(8);
    expect([...kept].every((n) => n > 'brassworks-20260801')).toBe(true);
  });
});
