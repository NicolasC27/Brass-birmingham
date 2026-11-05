import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { TOWNS } from '@/game/data';
import { buildTargets, newGame } from '@/game/engine';
import { legalActions } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';
import {
  FULL_LESSON_IDS,
  LESSON_IDS,
  closed,
  courseOf,
  deedOf,
  detourOf,
  doubleInReach,
  due,
  freshProgress,
  lastOf,
  lessonIndex,
  pass,
  progressAt,
  readLearnt,
  readProgress,
  saveProgress,
  see,
  setAside,
  settle,
  wayOn,
} from '../lessons';
import type { LessonCtx, Progress } from '../lessons';
import { blockedBy } from '../tableAnswers';
import { trIn } from '@/i18n';

const t = (k: string, v?: Record<string, string | number>) => trIn('fr', k, v);

/* the second lesson: a full game against Wedgwood, its canal played
   freely and its rail era taught once the reader chooses to go on */

function full(seed = 3): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), seed);
}

const ctx = (g: GameState, ui: Partial<Omit<LessonCtx, 'g' | 'me'>> = {}): LessonCtx => ({ g, me: 0, sel: null, mat: null, ...ui });
const play = (g: GameState, a: GameAction): GameState => {
  const r = applyAction(g, g.current, a);
  if (!r.state) throw new Error(r.error);
  return r.state;
};
/** every seat plays its plainest move until `stop` holds */
const plainly = (g: GameState, stop: (s: GameState) => boolean): GameState => {
  let s = g;
  while (s.phase === 'action' && !stop(s)) s = play(s, fallbackAction(s, s.current));
  return s;
};
/** the canal played out plainly to its count */
const counted = (): GameState => plainly(full(), () => false);
/** and the rail era begun, the reader to play */
const railed = (): GameState => plainly(play(counted(), { kind: 'begin-rail' }), (s) => s.current === 0);
/** the lessons before this one passed, in order */
const upTo = (id: string, code = 'RAIL'): Progress => ({ ...freshProgress(code, 'full'), passed: FULL_LESSON_IDS.slice(0, lessonIndex(id)) });

beforeEach(() => {
  stubStorage();
});

describe('the two courses', () => {
  it('keep their lessons apart: no id is both', () => {
    expect(FULL_LESSON_IDS.filter((id) => LESSON_IDS.includes(id))).toEqual([]);
    expect(courseOf('coal')).toBe('short');
    expect(courseOf('rails')).toBe('full');
    expect(courseOf('nope')).toBeNull();
    expect(lastOf('short')).toBe('onward');
    expect(lastOf('full')).toBe('fullOnward');
  });

  it('leave the first lesson as it was', () => {
    expect(LESSON_IDS).toEqual(['welcome', 'board', 'goal', 'mat', 'matRead', 'hand', 'coal', 'botTurn', 'payday', 'link', 'iron', 'develop', 'loan', 'market', 'works', 'beer', 'sell', 'flipped', 'eraEnd', 'onYourOwn', 'plan', 'tips', 'reach', 'linkWorth', 'barrel', 'levelTwo', 'lastRounds', 'onward']);
    expect(freshProgress('GWE5')).toEqual({ v: 2, code: 'GWE5', passed: [], later: {}, seen: {} });
  });

  it('start the second with the machine playing on', () => {
    expect(freshProgress('RAIL', 'full')).toEqual({ v: 2, course: 'full', code: 'RAIL', passed: [], later: {}, seen: {}, playOn: true });
  });
});

describe('the canal of the second lesson', () => {
  it('asks no deed: a welcome, then the guide rests until the canal closes', () => {
    let g = full();
    let p = freshProgress('RAIL', 'full');
    expect(due(p, ctx(g))).toEqual({ id: 'fullWelcome', index: 0, mode: 'read' });
    p = pass(p, 'fullWelcome');
    for (;;) {
      const d = due(p, ctx(g));
      expect(d.mode).not.toBe('do');
      if (g.round >= 9) {
        expect(d).toMatchObject({ id: 'canalClose', mode: 'read' });
        break;
      }
      expect(d).toMatchObject({ id: 'canalClose', mode: 'idle' });
      g = play(g, fallbackAction(g, g.current));
    }
  });

  it('lets the canal close pass with the canal, read or not', () => {
    const g = railed();
    const p = pass(freshProgress('RAIL', 'full'), 'fullWelcome');
    /* the choice was made at the count: the rail lessons follow, never the canal's last word */
    expect(due(pass(p, 'railChoice'), ctx(g))).toMatchObject({ id: 'sweep', mode: 'read' });
  });
});

describe('the choice at the canal’s count', () => {
  it('is the lesson due at the count, and asked first in the rail when it was not made', () => {
    const at = counted();
    expect(at.phase).toBe('scoring-canal');
    const p = pass(pass(freshProgress('RAIL', 'full'), 'fullWelcome'), 'canalClose');
    expect(due(p, ctx(at))).toMatchObject({ id: 'railChoice', mode: 'read' });
    expect(due(p, ctx(railed()))).toMatchObject({ id: 'railChoice', mode: 'read' });
  });

  it('opens the rail era’s lessons once made: the sweep, then the plan', () => {
    const g = railed();
    let p = upTo('sweep');
    expect(due(p, ctx(g))).toMatchObject({ id: 'sweep', mode: 'read' });
    p = pass(p, 'sweep');
    expect(due(p, ctx(g))).toMatchObject({ id: 'railPlan', mode: 'read' });
  });
});

describe('the rail lessons', () => {
  it('ask for a brewery as a deed that waits, with the table\'s reason when none is within a build', () => {
    const g = railed();
    const p = upTo('railBrewery');
    const d = due(p, ctx(g));
    expect(d).toMatchObject({ id: 'railBrewery', mode: 'do' });
    const builds = g.players[0].hand.some((c) => buildTargets(g, 0, c).some((x) => x.valid && x.industry === 'brewery'));
    const seen = see(p, 'railBrewery', ctx(g));
    expect(!!seen.seen.railBrewery).toBe(true);
    const block = blockedBy('railBrewery', g, 0, t);
    expect(block === null).toBe(builds);
    /* in reach: Later once played past; out of reach: Later at once, never a trap */
    if (builds) expect(wayOn(seen, 'railBrewery', ctx(play(g, fallbackAction(g, 0))))).toBe('later');
    else expect(wayOn(seen, 'railBrewery', ctx(g), true)).toBe('later');
    /* a brewery I still heading the mat: the era refuses it, and says so */
    const early = structuredClone(g);
    early.players[0].stacks.brewery = [1, 1, 2, 2, 3, 3, 4];
    early.players[0].money = 60;
    const why = blockedBy('railBrewery', early, 0, t);
    expect(why).not.toBeNull();
    expect(why!.money).toBe(false);
  });

  it('pass the rail by any rail laid, and the double by two at once', () => {
    const g = railed();
    const single = legalActions(g, 0).find((a) => a.kind === 'network' && !a.second);
    expect(single).toBeDefined();
    const p = see(upTo('rails'), 'rails', ctx(g));
    const after = play(g, single!);
    const q = settle(p, ctx(after));
    expect(q.passed).toContain('rails');
    expect(deedOf(ctx(g), ctx(after), 'full')).toBe('rails');
    /* the first lesson knows no rail as a deed of its own */
    expect(deedOf(ctx(g), ctx(after))).not.toBe('rails');
  });

  it('says a double rail is within reach exactly when the rules offer one', () => {
    const g = railed();
    expect(doubleInReach(ctx(full()))).toBe(false);
    const offered = (s: GameState) => legalActions(s, 0, { wideSecond: true }).some((a) => a.kind === 'network' && !!a.second);
    expect(doubleInReach(ctx(g))).toBe(offered(g));
    /* a purse and a brewery of the reader's with its barrels: the rules offer one */
    const rich = structuredClone(g);
    rich.players[0].money = 60;
    const slot = TOWNS.flatMap((t) => t.slots.map((s, i) => ({ town: t.id, i, s }))).find((x) => x.s.allows.includes('brewery') && !rich.tiles[`${x.town}:${x.i}`])!;
    rich.tiles[`${slot.town}:${slot.i}`] = { owner: 0, industry: 'brewery', level: 2, flipped: false, cubes: 2 };
    expect(doubleInReach(ctx(rich))).toBe(offered(rich));
    expect(doubleInReach(ctx(rich))).toBe(true);
    /* and none left to drink: none */
    rich.tiles[`${slot.town}:${slot.i}`].cubes = 0;
    for (const t of Object.values(rich.tiles)) if (t.industry === 'brewery') t.cubes = 0;
    expect(doubleInReach(ctx(rich))).toBe(false);
  });

  it('lets a double rail out of reach wait, the table saying why', () => {
    const g = railed();
    const p = see(upTo('doubleRail'), 'doubleRail', ctx(g));
    expect(due(p, ctx(g))).toMatchObject({ id: 'doubleRail', mode: 'do' });
    expect(doubleInReach(ctx(g))).toBe(false);
    const block = blockedBy('doubleRail', g, 0, t);
    expect(block).not.toBeNull();
    expect(block!.text).toContain('15');
    expect(wayOn(p, 'doubleRail', ctx(g), true)).toBe('later');
    /* set aside, it comes back the next round in its place */
    const q = setAside(p, 'doubleRail', ctx(g));
    expect(due(q, ctx(g)).id).not.toBe('doubleRail');
    const next = plainly(g, (s) => s.round > g.round && s.current === 0);
    expect(due(q, ctx(next)).id).toBe('doubleRail');
  });

  it('call the page on the era’s tiles as the reader chooses Build, not before the plan', () => {
    const g = railed();
    const early = upTo('railPlan');
    expect(settle(early, ctx(g, { verb: 'build' })).seen.railTiles).toBeUndefined();
    const p = setAside(upTo('rails'), 'rails', ctx(g));
    const q = settle(p, ctx(g, { verb: 'build' }));
    expect(q.seen.railTiles).toBeDefined();
    expect(due(q, ctx(g, { verb: 'build' }))).toMatchObject({ id: 'railTiles', mode: 'read' });
  });

  it('never detour to the loan: the second lesson teaches none', () => {
    const g = railed();
    const p = upTo('rails');
    expect(detourOf(p, due(p, ctx(g)), ctx(g), true, true)).toBeNull();
  });
});

describe('the close of the second lesson', () => {
  it('passes its own closing word and the pages never called, not the first lesson’s', () => {
    const g = railed();
    const p = upTo('railEnd');
    const q = closed(p, ctx(g));
    expect(q.passed).toContain('fullOnward');
    expect(q.passed).toContain('railTiles');
    expect(q.passed).not.toContain('onward');
    expect(q.passed.every((id) => courseOf(id) === 'full')).toBe(true);
  });
});

describe('the two records on the disk', () => {
  it('are kept side by side: the second never touches the first', () => {
    const first: Progress = { ...freshProgress('GWE5'), passed: LESSON_IDS.slice(0, 10) };
    saveProgress(first);
    const second = pass(freshProgress('RAIL', 'full'), 'fullWelcome');
    saveProgress(second);
    expect(readProgress()).toEqual(first);
    expect(readProgress('full')).toEqual(second);
    expect(progressAt('GWE5')).toEqual(first);
    expect(progressAt('RAIL', 'full')).toEqual(second);
    /* each table reads its own course, and a fresh one at another */
    expect(progressAt('RAIL')).toEqual(freshProgress('RAIL'));
    expect(progressAt('OTHR', 'full')).toEqual(freshProgress('OTHR', 'full'));
    /* the course's marks hold the lessons of both */
    expect(readLearnt()).toEqual(expect.arrayContaining([...first.passed, 'fullWelcome']));
  });

  it('keeps only the second lesson’s ids in its record', () => {
    const store = stubStorage();
    store.set('brassworks.tutorial.full.progress', JSON.stringify({ v: 2, course: 'full', code: 'RAIL', passed: ['fullWelcome', 'coal', 'sweep'], later: { rails: 101, works: 2 }, seen: {}, playOn: true }));
    expect(readProgress('full')).toEqual({ v: 2, course: 'full', code: 'RAIL', passed: ['fullWelcome', 'sweep'], later: { rails: 101 }, seen: {}, playOn: true });
    /* a record of the other course, under either key, is not one */
    store.set('brassworks.tutorial.progress', JSON.stringify({ v: 2, course: 'full', code: 'RAIL', passed: [], later: {}, seen: {} }));
    expect(readProgress()).toBeNull();
  });
});
