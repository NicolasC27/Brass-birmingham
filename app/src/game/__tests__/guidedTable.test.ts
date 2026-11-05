import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { getBoardOptions, setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { FULL_LESSON_IDS, LESSON_IDS, freshProgress, letPlayOn, progressAt, saveProgress } from '@/components/game/lessons';
import { SETUP_STORAGE_KEY } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import type { HomeTable } from '../home';
import { FULL_DEALT_KEY, FULL_KEY, FULL_SEEDS, TUTORIAL_DEALT_KEY, TUTORIAL_KEY, TUTORIAL_SEEDS, drawTutorialSeed, guidedCourse, guidedResume, guidedTable, lastTutorialSeed, openGuided, quickSetup, resumeOf, startFullLesson, startQuickGame, startTutorial } from '../quickplay';

/* the office deals the guided table its code — or keeps the line quiet,
   when a test says so — and reads out its register, which the mirror
   holds once `known`; nothing leaves this test */
const office = vi.hoisted(() => ({
  open: null as (() => Promise<{ code: string }>) | null,
  /** the seeds the office was asked to deal */
  dealt: [] as (number | undefined)[],
  known: true,
  register: [] as HomeTable[],
  reread: null as (() => Promise<HomeTable[]>) | null,
}));
vi.mock('../home', async (load) => ({
  ...(await load<typeof import('../home')>()),
  openHomeGame: (seed?: number) => {
    office.dealt.push(seed);
    return office.open ? office.open() : Promise.resolve({ code: 'NEW1' });
  },
  homeKnown: () => office.known,
  homeSnapshot: () => office.register,
  refreshHome: () => (office.reread ? office.reread() : Promise.resolve(office.register)),
}));

/* the guided game goes with the table it was opened at, by its code — not
   with every table dealt the same seed. OLD_SEED is the one deal it was
   remembered by before its code was kept */
const OLD_SEED = 3;

let store: Map<string, string>;
beforeEach(() => {
  store = stubStorage();
  office.open = null;
  office.dealt = [];
  office.known = true;
  office.register = [];
  office.reread = null;
});

const table = (code: string, over?: boolean): HomeTable => ({ code, name: 'Soho', startedAt: 0, updatedAt: 0, era: 'canal', round: 4, seats: [], ...(over ? { over } : {}) });

describe('the guided table', () => {
  it('is the one whose code the guide was opened at', () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(guidedTable('GWE5', OLD_SEED)).toBe(true);
    /* another table of the same deal is a table like any other */
    expect(guidedTable('QK7P', OLD_SEED)).toBe(false);
  });

  it('is no table once the guide is left', () => {
    expect(guidedTable('GWE5', OLD_SEED)).toBe(false);
  });

  it('is taken up once from the seed it was remembered by', () => {
    store.set('brassworks.tutorial.v1', String(OLD_SEED));
    /* a table of another deal opened first does not take it */
    expect(guidedTable('QK7P', 81)).toBe(false);
    expect(store.get('brassworks.tutorial.v1')).toBe(String(OLD_SEED));
    expect(guidedTable('GWE5', OLD_SEED)).toBe(true);
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(store.has('brassworks.tutorial.v1')).toBe(false);
    /* from then on, only that table */
    expect(guidedTable('ZZ12', OLD_SEED)).toBe(false);
  });

  it('stays bound through a quick game', async () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(await startQuickGame()).toBe('NEW1');
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(guidedTable('NEW1', OLD_SEED)).toBe(false);
  });
});

/* the evening course's « resume »: the guided table left unfinished, not a
   new deal that starts the lessons over */
describe('the guided table to resume', () => {
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

/* the course's button: back to the table left unfinished, never a new
   deal over it — not even before the register has come in */
describe('the guided table opened', () => {
  const halfway = { ...freshProgress('GWE5'), passed: LESSON_IDS.slice(0, 8) };
  beforeEach(() => {
    store.set(TUTORIAL_KEY, 'GWE5');
    saveProgress(halfway);
    /* a deal would show: the office is not to be asked for one */
    office.open = () => Promise.reject(new Error('dealt'));
  });

  it('is the table left unfinished', async () => {
    office.register = [table('QK7P'), table('GWE5')];
    expect(await openGuided()).toBe('GWE5');
    expect(progressAt('GWE5')).toEqual(halfway);
  });

  it('is read from the office first when the register has not come in', async () => {
    office.known = false;
    office.reread = () => Promise.resolve([table('GWE5')]);
    expect(await openGuided()).toBe('GWE5');
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
  });

  it('is a new one when the register, read, has it no longer or played out', async () => {
    office.open = null;
    office.known = false;
    office.reread = () => Promise.resolve([table('GWE5', true)]);
    expect(await openGuided()).toBe('NEW1');
    expect(store.get(TUTORIAL_KEY)).toBe('NEW1');
  });

  it('is a new one when asked to start over', async () => {
    office.open = null;
    office.register = [table('GWE5')];
    expect(await openGuided(true)).toBe('NEW1');
    expect(progressAt('NEW1')).toEqual(freshProgress('NEW1'));
  });

  it('deals nothing over the table while the office does not answer', async () => {
    office.known = false;
    office.reread = () => Promise.reject(new Error('offline'));
    await expect(openGuided()).rejects.toThrow('offline');
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(progressAt('GWE5')).toEqual(halfway);
  });
});

/* each guided game is dealt one of the checked deals, and never the one
   the reader played last: starting over is another game */
describe('the guided deal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is any of the list but the last one', () => {
    for (const last of [null, ...TUTORIAL_SEEDS]) {
      const drawn = new Set(Array.from({ length: 100 }, (_, i) => drawTutorialSeed(last, () => i / 100)));
      expect([...drawn].sort((a, b) => a - b)).toEqual([...TUTORIAL_SEEDS].sort((a, b) => a - b).filter((s) => s !== last));
    }
    /* a roll at its very top still draws one */
    expect(TUTORIAL_SEEDS).toContain(drawTutorialSeed(null, () => 0.9999999));
  });

  it('is written down once the office has dealt it, and never dealt twice running', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const written: number[] = [];
    for (let i = 0; i < 4; i++) {
      await startTutorial();
      written.push(Number(store.get(TUTORIAL_DEALT_KEY)));
    }
    expect(office.dealt).toEqual(written);
    for (const seed of written) expect(TUTORIAL_SEEDS).toContain(seed);
    for (let i = 1; i < written.length; i++) expect(written[i]).not.toBe(written[i - 1]);
  });

  it('comes from the whole list to a newcomer', () => {
    expect(lastTutorialSeed()).toBeNull();
  });

  it('is not the one deal of old, to a reader of the guide from then', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    store.set(TUTORIAL_KEY, 'GWE5');
    expect(lastTutorialSeed()).toBe(OLD_SEED);
    await startTutorial();
    expect(office.dealt).toEqual([TUTORIAL_SEEDS.find((s) => s !== OLD_SEED)]);
    /* nor to one who left the guide, and kept only the course's marks */
    store.clear();
    saveProgress({ ...freshProgress('OLD1'), passed: ['welcome'] });
    expect(lastTutorialSeed()).toBe(OLD_SEED);
  });

  it('stays the last one while the office does not answer', async () => {
    const last = TUTORIAL_SEEDS[2];
    store.set(TUTORIAL_DEALT_KEY, String(last));
    office.open = () => Promise.reject(new Error('offline'));
    await expect(startTutorial()).rejects.toThrow('offline');
    expect(store.get(TUTORIAL_DEALT_KEY)).toBe(String(last));
    expect(office.dealt).toHaveLength(1);
    expect(office.dealt[0]).not.toBe(last);
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

  it('wipes nothing of the last one before the office has dealt it', async () => {
    const last = letPlayOn({ ...freshProgress('OLD1'), passed: LESSON_IDS.slice(0, 12) }, true);
    saveProgress(last);
    store.set(TUTORIAL_KEY, 'OLD1');
    store.set(MINI_KEY, 'coal');
    setBoardOption('guideFolded', true);
    let deal: (t: { code: string }) => void = () => undefined;
    office.open = () => new Promise((ok) => (deal = ok));
    const started = startTutorial();
    await Promise.resolve();
    expect(progressAt('OLD1')).toEqual(last);
    expect(store.get(TUTORIAL_KEY)).toBe('OLD1');
    deal({ code: 'NEW1' });
    expect(await started).toBe('NEW1');
    expect(progressAt('NEW1')).toEqual(freshProgress('NEW1'));
  });

  it('keeps the last one whole when the office does not answer', async () => {
    const last = { ...freshProgress('OLD1'), passed: LESSON_IDS.slice(0, 12) };
    saveProgress(last);
    store.set(TUTORIAL_KEY, 'OLD1');
    store.set(MINI_KEY, 'coal');
    setBoardOption('guideFolded', true);
    office.open = () => Promise.reject(new Error('offline'));
    await expect(startTutorial()).rejects.toThrow('offline');
    expect(progressAt('OLD1')).toEqual(last);
    expect(store.get(TUTORIAL_KEY)).toBe('OLD1');
    expect(store.get(MINI_KEY)).toBe('coal');
    expect(getBoardOptions().guideFolded).toBe(true);
  });
});

/* the second lesson: a full game at a table of its own, bound by its code
   beside the first lesson's, dealt from its own list — and the first
   lesson's table and record never touched by it */
describe('the second lesson\u2019s table', () => {
  it('is dealt from its own list, for a full game, and bound apart from the first lesson\u2019s', async () => {
    const first = { ...freshProgress('GWE5'), passed: LESSON_IDS.slice(0, 8) };
    saveProgress(first);
    store.set(TUTORIAL_KEY, 'GWE5');
    office.open = () => Promise.resolve({ code: 'RAIL' });
    expect(await startFullLesson()).toBe('RAIL');
    expect(FULL_SEEDS).toContain(office.dealt[0]);
    expect(store.get(FULL_KEY)).toBe('RAIL');
    expect(store.get(FULL_DEALT_KEY)).toBe(String(office.dealt[0]));
    expect(progressAt('RAIL', 'full')).toEqual(freshProgress('RAIL', 'full'));
    /* the first lesson's, as they were */
    expect(store.get(TUTORIAL_KEY)).toBe('GWE5');
    expect(progressAt('GWE5')).toEqual(first);
    expect(lastTutorialSeed()).toBe(3);
  });

  it('names the course of each table, and none for another', () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    store.set(FULL_KEY, 'RAIL');
    expect(guidedCourse('GWE5', 3)).toBe('short');
    expect(guidedCourse('RAIL', FULL_SEEDS[0])).toBe('full');
    expect(guidedCourse('QK7P', 3)).toBeNull();
  });

  it('is taken up where it was left, the first lesson\u2019s table left alone', async () => {
    store.set(TUTORIAL_KEY, 'GWE5');
    store.set(FULL_KEY, 'RAIL');
    const halfway = { ...freshProgress('RAIL', 'full'), passed: FULL_LESSON_IDS.slice(0, 4) };
    saveProgress(halfway);
    office.register = [table('GWE5'), table('RAIL')];
    office.open = () => Promise.reject(new Error('dealt'));
    expect(guidedResume(office.register, 'full')).toBe('RAIL');
    expect(await openGuided(false, 'full')).toBe('RAIL');
    expect(await openGuided()).toBe('GWE5');
    expect(progressAt('RAIL', 'full')).toEqual(halfway);
  });

  it('never deals twice running the same deal of its list', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const written: number[] = [];
    for (let i = 0; i < 3; i++) {
      await startFullLesson();
      written.push(Number(store.get(FULL_DEALT_KEY)));
    }
    for (const seed of written) expect(FULL_SEEDS).toContain(seed);
    for (let i = 1; i < written.length; i++) expect(written[i]).not.toBe(written[i - 1]);
    /* the first lesson's last deal is not the second's */
    expect(store.has(TUTORIAL_DEALT_KEY)).toBe(false);
    expect(drawTutorialSeed(null, () => 0, FULL_SEEDS)).toBe(FULL_SEEDS[0]);
    vi.restoreAllMocks();
  });
});
