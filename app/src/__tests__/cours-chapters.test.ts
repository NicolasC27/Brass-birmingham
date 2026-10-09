import { describe, expect, it } from 'vitest';
import { getChapters } from '@/components/rules/rulesData';
import { CHAPTER_IDS, CHAPTER_OF } from '@/platform/cours';

/* the evening course sends a recurring miss back to a chapter of the rules:
   its list of ids is the rules page's own, in the same order */
describe('the chapters of the evening course', () => {
  it('are the rules page chapters', () => {
    expect([...CHAPTER_IDS]).toEqual(getChapters().map((c) => c.id));
  });

  it('send every miss to a chapter that exists', () => {
    for (const chapter of Object.values(CHAPTER_OF)) expect(CHAPTER_IDS).toContain(chapter);
  });
});
