import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from './storage';
import { LAST_LESSON, LESSON_IDS, freshProgress, saveProgress } from '@/components/game/lessons';
import { LESSONS, lessonsRead } from '../cours';

/* the evening course reads the guide's own lessons, and marks a lesson
   read once the guide has passed it — by its id, not by how far down the
   list the reader once went */

let store: Map<string, string>;
beforeEach(() => {
  store = stubStorage();
});

describe('the lessons of the evening course', () => {
  it('are the guide’s own, in its order', () => {
    expect(LESSONS).toBe(LESSON_IDS);
  });

  it('count the lessons passed, in the course’s order', () => {
    expect(lessonsRead()).toEqual([]);
    saveProgress({ ...freshProgress('GWE5'), passed: ['welcome', 'board', 'sell', 'loan'] });
    /* whatever order they were passed in: the loan comes before the works */
    expect(lessonsRead()).toEqual(['welcome', 'board', 'loan', 'sell']);
  });

  it('count a guided game played to its end whole', () => {
    /* no sale was made and no barrel drunk: those pages never came */
    const passed = LESSON_IDS.filter((id) => id !== 'flipped' && id !== 'barrel');
    saveProgress({ ...freshProgress('GWE5'), passed });
    expect(lessonsRead()).toEqual(LESSON_IDS);
    /* short of the closing word, what was passed and no more */
    stubStorage();
    saveProgress({ ...freshProgress('GWE5'), passed: passed.filter((id) => id !== LAST_LESSON) });
    expect(lessonsRead()).toHaveLength(LESSON_IDS.length - 3);
  });

  it('keep their marks when a new guided table is dealt', () => {
    saveProgress({ ...freshProgress('GWE5'), passed: ['welcome', 'board', 'goal'] });
    /* the reader starts over: the new table's record is fresh */
    saveProgress(freshProgress('QK7P'));
    expect(lessonsRead()).toEqual(['welcome', 'board', 'goal']);
    saveProgress({ ...freshProgress('QK7P'), passed: ['welcome', 'board', 'goal', 'mat'] });
    expect(lessonsRead()).toEqual(['welcome', 'board', 'goal', 'mat']);
    /* a course once played to its end stays whole */
    saveProgress({ ...freshProgress('QK7P'), passed: [LAST_LESSON] });
    saveProgress(freshProgress('ZZ12'));
    expect(lessonsRead()).toEqual(LESSON_IDS);
  });

  it('take up the marks of a table recorded before the course kept its own', () => {
    /* written by an earlier build: the table's record alone */
    store.set('brassworks.tutorial.progress', JSON.stringify({ ...freshProgress('GWE5'), passed: ['welcome', 'board'] }));
    saveProgress(freshProgress('QK7P'));
    expect(lessonsRead()).toEqual(['welcome', 'board']);
  });

  it('read the old index once, until the guided table writes its record', () => {
    /* the first five of the old order: the lesson on money, which the
       goal took in, is no longer one to count */
    store.set('brassworks.tutorial.reached', '5');
    expect(lessonsRead()).toEqual(['welcome', 'board', 'goal', 'mat']);
  });
});
