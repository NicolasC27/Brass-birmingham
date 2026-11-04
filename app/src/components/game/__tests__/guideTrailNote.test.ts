import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { SetupPayload } from '@/game/types';
import type { TrailEvent } from '@/online/guideTrail';
import { LESSON_IDS, freshProgress, lessonIndex } from '../lessons';

/* the trail as the guide notes it in a browser: here one whose storage
   refuses to keep the record — the visit's own record holds, and nothing
   is said twice nor under a second id */

const office = vi.hoisted(() => ({ frames: [] as TrailEvent[][] }));
vi.mock('@/online/net', () => ({ ONLINE_URL: 'ws://office', onlineWire: () => ({ trail: (events: TrailEvent[]) => void office.frames.push(events) }) }));

/** the module as a page loads it, with its own memory of the record —
 *  then the page's window, for the screen the events name */
const page = async () => {
  vi.resetModules();
  const m = await import('../guideTrail');
  Object.defineProperty(globalThis, 'window', { value: { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }) }, configurable: true });
  return m;
};

const game = newGame(
  withEdition({
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload),
  3,
);
const c = { g: game, me: 0, sel: null, mat: null };
const p = { ...freshProgress('GWE5'), passed: LESSON_IDS.slice(0, lessonIndex('coal')) };
const said = () => office.frames.flat().map((e) => `${e.kind} ${e.lesson} ${e.id}`);

/** the guide notes the table, and everything waiting has time to leave */
const note = (leftGuide: (typeof import('../guideTrail'))['leftGuide']) => {
  leftGuide('GWE5', c, p, 'coal');
  vi.advanceTimersByTime(60_000);
};

beforeEach(() => {
  vi.useFakeTimers();
  office.frames = [];
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, 'window');
});

describe('a browser that will not keep the record', () => {
  it('keeps this visit’s own: the old one is not read back', async () => {
    const { TRAIL_KEY, leftGuide } = await page();
    const store = stubStorage();
    /* an old record of the same table, from before the storage filled up */
    store.set(TRAIL_KEY, JSON.stringify({ code: 'GWE5', id: '00000000000000aa', t0: 0, said: p.passed.map((l) => `passed:${l}`), reached: 'hand', last: 'coal', playOn: false }));
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    note(leftGuide);
    expect(said()).toEqual(['left coal 00000000000000aa']);
    /* the guide noted again: the stale record in the storage is not
       read back, so what was said is not said again */
    note(leftGuide);
    note(leftGuide);
    expect(said()).toEqual(['left coal 00000000000000aa']);
  });

  it('draws the table’s id once, with no record to read back', async () => {
    const { leftGuide } = await page();
    stubStorage();
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    note(leftGuide);
    note(leftGuide);
    const ids = office.frames.flat().map((e) => e.id);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{16}$/);
  });
});
