import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { getBoardOptions, setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { LESSON_IDS, freshProgress, letPlayOn, progressAt, saveProgress } from '@/components/game/lessons';
import { TUTORIAL_KEY, TUTORIAL_SEED, guidedTable, startTutorial } from '../quickplay';

/* the office deals the guided table its code; nothing leaves this test */
vi.mock('../home', async (load) => ({ ...(await load<typeof import('../home')>()), openHomeGame: async () => ({ code: 'NEW1' }) }));

/* the guided game goes with the table it was opened at, by its code — not
   with every table dealt the same seed */

let store: Map<string, string>;
beforeEach(() => {
  store = stubStorage();
});

describe('the guided table', () => {
  it('is the one whose code the guide was opened at', () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(guidedTable('GWE5', TUTORIAL_SEED)).toBe(true);
    /* another table of the same deal is a table like any other */
    expect(guidedTable('QK7P', TUTORIAL_SEED)).toBe(false);
  });

  it('is no table once the guide is left', () => {
    expect(guidedTable('GWE5', TUTORIAL_SEED)).toBe(false);
  });

  it('is taken up once from the seed it was remembered by', () => {
    store.set('brassworks.tutorial.v1', String(TUTORIAL_SEED));
    /* a table of another deal opened first does not take it */
    expect(guidedTable('QK7P', 81)).toBe(false);
    expect(store.get('brassworks.tutorial.v1')).toBe(String(TUTORIAL_SEED));
    expect(guidedTable('GWE5', TUTORIAL_SEED)).toBe(true);
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(store.has('brassworks.tutorial.v1')).toBe(false);
    /* from then on, only that table */
    expect(guidedTable('ZZ12', TUTORIAL_SEED)).toBe(false);
  });
});

describe('a fresh guided game', () => {
  it('opens on its first page, in the open and held', async () => {
    /* the last guided table: read far, folded, the machine let play on */
    saveProgress(letPlayOn({ ...freshProgress('OLD1'), passed: LESSON_IDS.slice(0, 12) }, true));
    setBoardOption('guideFolded', true);
    store.set(MINI_KEY, 'coal');
    expect(await startTutorial()).toBe('NEW1');
    expect(store.get(TUTORIAL_KEY)).toBe('NEW1');
    expect(getBoardOptions().guideFolded).toBe(false);
    expect(store.has(MINI_KEY)).toBe(false);
    expect(progressAt('NEW1')).toEqual(freshProgress('NEW1'));
    expect(progressAt('NEW1').playOn).toBeUndefined();
  });
});
