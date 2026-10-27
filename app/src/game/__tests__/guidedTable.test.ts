import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { getBoardOptions, setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { LESSON_IDS, freshProgress, letPlayOn, progressAt, saveProgress } from '@/components/game/lessons';
import { SETUP_STORAGE_KEY } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import type { HomeTable } from '../home';
import { TUTORIAL_KEY, TUTORIAL_SEED, guidedResume, guidedTable, quickSetup, resumeOf, startQuickGame, startTutorial } from '../quickplay';

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

  it('stays bound through a quick game', async () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(await startQuickGame()).toBe('NEW1');
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(guidedTable('NEW1', TUTORIAL_SEED)).toBe(false);
  });
});

/* the evening course's « resume »: the guided table left unfinished, not a
   new deal that starts the lessons over */
describe('the guided table to resume', () => {
  const table = (code: string, over?: boolean): HomeTable => ({ code, name: 'Soho', startedAt: 0, updatedAt: 0, era: 'canal', round: 4, seats: [], ...(over ? { over } : {}) });

  it('is the table the guide is bound to, while it is still played', () => {
    expect(resumeOf('GWE5', [table('QK7P'), table('GWE5')])).toBe('GWE5');
  });

  it('is none when no table is bound, the register lost it, or it is played out', () => {
    expect(resumeOf(null, [table('GWE5')])).toBeNull();
    expect(resumeOf('GWE5', [table('QK7P')])).toBeNull();
    expect(resumeOf('GWE5', [table('GWE5', true)])).toBeNull();
    expect(resumeOf('GWE5', [])).toBeNull();
  });

  it('is read from the table the browser keeps the guide at', () => {
    expect(guidedResume([table('GWE5')])).toBeNull();
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(guidedResume([table('GWE5')])).toBe('GWE5');
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

  it('leaves the player’s own table form alone', async () => {
    /* the player's table: three machines, a full game */
    const mine: StoredSetup = {
      players: [
        { name: 'Ada', color: 'steel', type: 'human' },
        { name: 'Watt', color: 'brass', type: 'bot', persona: 'watt' },
        { name: 'Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
        { name: 'Boulton', color: 'oxblood', type: 'bot', persona: 'boulton' },
      ],
      options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
    };
    store.set(SETUP_STORAGE_KEY, JSON.stringify(mine));
    await startTutorial();
    expect(JSON.parse(store.get(SETUP_STORAGE_KEY)!)).toEqual(mine);
    /* and play now dresses that table, not the guided one */
    expect(quickSetup().players.map((p) => p.name)).toEqual(['Ada', 'Watt', 'Arkwright', 'Boulton']);
    expect(quickSetup().options.eraLength).toBe('standard');
  });
});
