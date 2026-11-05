import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { buildTargets, newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { TRAIL_BATCH } from '@/online/guideTrail';
import type { TrailEvent } from '@/online/guideTrail';
import { LESSON_IDS, closed, freshProgress, lessonIndex, letPlayOn, pass, see, setAside } from '../lessons';
import type { LessonCtx, Progress } from '../lessons';
import { TRAIL_GAP_MS, TRAIL_HELD, TRAIL_OFF_KEY, TRAIL_WAIT_MS, freshRecord, passedHow, recordOf, setTrailOff, stepsOf, trailOff, trailPost, viewOf } from '../guideTrail';
import type { Sight, Step, TrailRecord } from '../guideTrail';

/* the guided game's trail as the browser writes it: what the guide says
   once and only once, how a lesson was passed, and the post that carries
   it a few events at a time — or not at all, once the reader says no */

function guided(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}
const ctx = (g: GameState, ui: Partial<Omit<LessonCtx, 'g' | 'me'>> = {}): LessonCtx => ({ g, me: 0, sel: null, mat: null, ...ui });
const upTo = (id: string): Progress => ({ ...freshProgress('GWE5'), passed: LESSON_IDS.slice(0, lessonIndex(id)) });
const play = (g: GameState, a: GameAction): GameState => {
  const r = applyAction(g, g.current, a);
  if (!r.state) throw new Error(r.error);
  return r.state;
};
const mine = (g: GameState): GameState => {
  const at = g.players[0].hand.flatMap((c) => buildTargets(g, 0, c).filter((x) => x.valid && x.industry === 'coal').map((x) => ({ card: c.id, x })))[0];
  return play(g, { kind: 'build', card: at.card, town: at.x.town, slot: at.x.slot, industry: 'coal' });
};
/** the game played out, both seats playing plainly */
const playedOut = (g: GameState): GameState => {
  let s = g;
  for (let i = 0; i < 400 && s.phase === 'action'; i++) s = play(s, fallbackAction(s, s.current));
  if (s.phase === 'scoring-canal') s = applyAction(s, 0, { kind: 'begin-rail' }).state!;
  return s;
};

const ID = 'feedfacecafebeef';
const draw = () => ID;
/** a sight of the guided table GWE5, the lesson `shown` in view */
const at = (c: LessonCtx, p: Progress, shown: string | null, more: Partial<Sight> = {}): Sight => ({ table: 'GWE5', tutorial: true, c, p, shown, mode: 'read', from: null, ...more });
/** what is said, shortly: kind, lesson and how */
const said = (steps: Step[]) => steps.map((e) => [e.kind, e.lesson, e.how ?? ''].join(' ').trim());

beforeEach(() => {
  stubStorage();
});

describe('the screen', () => {
  it('is a desk under a mouse, a tablet under a finger, or something smaller', () => {
    expect(viewOf(1440, 900, false)).toBe('desktop');
    expect(viewOf(768, 1024, false)).toBe('desktop');
    expect(viewOf(1180, 820, true)).toBe('tablet-landscape');
    expect(viewOf(768, 1024, true)).toBe('tablet-portrait');
    expect(viewOf(390, 844, true)).toBe('touch');
  });
});

describe('how a lesson was passed', () => {
  it('reads its deed, Next or Skip off the table and the progress', () => {
    const g = guided();
    /* a page is read on from */
    expect(passedHow(upTo('board'), 'welcome', ctx(g))).toBe('next');
    /* a deed shown undone, then done */
    const seen = see(upTo('coal'), 'coal', ctx(g));
    expect(passedHow(seen, 'coal', ctx(mine(g)))).toBe('deed');
    /* done before it came up: a page that says so, read on from */
    expect(passedHow(upTo('coal'), 'coal', ctx(mine(g)))).toBe('next');
    /* still undone: skipped — unless the deed may wait, as the loan may
       while the purse pays for the works */
    expect(passedHow(seen, 'coal', ctx(g))).toBe('skip');
    expect(passedHow(upTo('loan'), 'loan', ctx(g))).toBe('next');
    const poor = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 2 } : x)) };
    expect(passedHow(upTo('loan'), 'loan', ctx(poor))).toBe('skip');
  });
});

describe('what the guide says', () => {
  it('draws an id for a guided table, and says each thing once', () => {
    const g = guided();
    let p = freshProgress('GWE5');
    const a = stepsOf(null, at(ctx(g), p, 'welcome'), 1_000, draw);
    expect(a.record).toMatchObject({ code: 'GWE5', id: ID, t0: 1_000, last: 'welcome', reached: 'welcome' });
    expect(said(a.steps)).toEqual(['shown welcome']);
    expect(a.steps[0]).toEqual({ id: ID, kind: 'shown', lesson: 'welcome', round: 1, at: 0, s: 0, seed: 3 });
    /* the same sight again: nothing more, the record as it was */
    const again = stepsOf(a.record, at(ctx(g), p, 'welcome'), 5_000, draw);
    expect(again.steps).toEqual([]);
    expect(again.record).toBe(a.record);
    /* read on: the page passed, then the next one shown, the seconds counted */
    p = pass(p, 'welcome');
    const b = stepsOf(a.record, at(ctx(g), p, 'board'), 21_400, draw);
    expect(said(b.steps)).toEqual(['passed welcome next', 'shown board']);
    expect(b.steps.map((e) => e.s)).toEqual([20, 20]);
  });

  it('says nothing at a plain table, and draws anew for a new guided one', () => {
    const g = guided();
    const r = stepsOf(null, at(ctx(g), freshProgress('GWE5'), 'welcome'), 0, draw).record;
    const plain = stepsOf(r, { ...at(ctx(g), freshProgress(null), null), table: 'PL4Y', tutorial: false }, 0, draw);
    expect(plain).toEqual({ record: r, steps: [] });
    const next = stepsOf(r, { ...at(ctx(g), freshProgress('NEW1'), 'welcome'), table: 'NEW1' }, 0, () => '0000000000000001');
    expect(next.record).toMatchObject({ code: 'NEW1', id: '0000000000000001' });
    expect(said(next.steps)).toEqual(['shown welcome']);
    /* nor anything without a table or a game */
    expect(stepsOf(r, { ...at(ctx(g), freshProgress(null), 'welcome'), table: null }, 0, draw).steps).toEqual([]);
  });

  it('takes a table begun before the trail as it stands: what was passed is not said again', () => {
    const g = guided();
    const p = setAside(see(upTo('coal'), 'coal', ctx(g)), 'coal', ctx(g));
    const first = stepsOf(null, at(ctx(g), p, 'botTurn'), 0, draw);
    expect(said(first.steps)).toEqual(['shown botTurn']);
    expect(first.record!.reached).toBe('botTurn');
    expect(freshRecord('GWE5', upTo('link'), 0, ID).reached).toBe(LESSON_IDS[lessonIndex('link') - 1]);
  });

  it('tells a deed done, a page already done, a lesson set aside and the detour to the loan', () => {
    const g = guided();
    let p = see(upTo('coal'), 'coal', ctx(g));
    let r = stepsOf(null, at(ctx(g), p, 'coal', { mode: 'do' }), 0, draw).record;
    /* short of money, the loan first */
    const d = stepsOf(r, at(ctx(g), p, 'loan', { mode: 'do', from: 'coal' }), 0, draw);
    expect(said(d.steps)).toEqual(['detour coal', 'shown loan']);
    r = d.record;
    /* the mine built: the lesson passes by its deed */
    const built = mine(g);
    p = pass(p, 'coal');
    const e = stepsOf(r, at(ctx(built), p, 'botTurn'), 0, draw);
    expect(said(e.steps)).toEqual(['passed coal deed', 'shown botTurn']);
    expect(e.steps[0].at).toBe(1);
    r = e.record;
    /* a deed done before it came up */
    expect(said(stepsOf(r, at(ctx(built), p, 'link', { mode: 'already' }), 0, draw).steps)).toEqual(['already link']);
    /* set aside, then again a round later: each time */
    const q = setAside(p, 'link', ctx(built));
    const f = stepsOf(r, at(ctx(built), q, null), 0, draw);
    expect(said(f.steps)).toEqual(['later link']);
    expect(stepsOf(f.record, at(ctx(built), q, null), 0, draw).steps).toEqual([]);
    const later = { ...built, round: 2 };
    expect(said(stepsOf(f.record, at(ctx(later), { ...q, later: { link: 2 } }, null), 0, draw).steps)).toEqual(['later link']);
  });

  it('tells the machine let play on and held again, and the guide left', () => {
    const g = guided();
    const p = upTo('coal');
    let r = stepsOf(null, at(ctx(g), p, 'coal'), 0, draw).record;
    const on = stepsOf(r, at(ctx(g), letPlayOn(p, true), 'coal'), 0, draw);
    expect(said(on.steps)).toEqual(['playOn coal on']);
    r = on.record;
    expect(stepsOf(r, at(ctx(g), letPlayOn(p, true), 'coal'), 0, draw).steps).toEqual([]);
    const off = stepsOf(r, at(ctx(g), p, 'coal'), 0, draw);
    expect(said(off.steps)).toEqual(['playOn coal off']);
    const left = stepsOf(off.record, at(ctx(g), p, null, { left: 'coal' }), 0, draw);
    expect(said(left.steps)).toEqual(['left coal']);
    /* the guide gone, nothing of the lessons is said: only the end, to come */
    expect(stepsOf(left.record, { ...at(ctx(g), freshProgress(null), 'hand'), tutorial: false }, 0, draw).steps).toEqual([]);
  });

  it('tells the game played out with both scores and how far the guide came, and not what the final ledger passes', () => {
    const g = guided();
    const p = pass(upTo('coal'), 'coal');
    const r = stepsOf(null, at(ctx(g), p, 'botTurn'), 0, draw).record!;
    const over = playedOut(g);
    expect(over.phase).toBe('game-over');
    const end = closed(p, ctx(over));
    const e = stepsOf(r, at(ctx(over), end, null), 0, draw);
    expect(said(e.steps)).toEqual(['finished botTurn played']);
    expect(e.steps[0].vp).toEqual([over.players[0].vp, over.players[1].vp]);
    expect(e.record!.said).toContain('passed:onward');
    expect(stepsOf(e.record, at(ctx(over), end, null), 0, draw).steps).toEqual([]);
    /* the guide left, the game played out all the same; or given up */
    const gone = { ...r, said: [...r.said, 'left'] };
    expect(said(stepsOf(gone, { ...at(ctx(over), freshProgress(null), null), tutorial: false }, 0, draw).steps)).toEqual(['finished botTurn played']);
    expect(said(stepsOf(r, at(ctx({ ...over, abandoned: true }), p, null), 0, draw).steps)).toEqual(['finished botTurn abandoned']);
    /* a table played out before the trail began, opened again: no news */
    const old = stepsOf(null, at(ctx(over), end, null), 0, draw);
    expect(old.steps).toEqual([]);
    expect(old.record!.said).toContain('finished');
  });

  it('tells a deed the last action did, on the ledger it opens', () => {
    const g = guided();
    const p = see(upTo('coal'), 'coal', ctx(g));
    const r = stepsOf(null, at(ctx(g), p, null), 0, draw).record;
    expect(r!.reached).toBe('hand');
    /* the mine was the game's last action: the era's scoring comes next */
    const q = pass(p, 'coal');
    const scoring: GameState = { ...mine(g), phase: 'scoring-canal' };
    const e = stepsOf(r, at(ctx(scoring), q, null), 0, draw);
    expect(said(e.steps)).toEqual(['passed coal deed']);
    expect(e.record!.reached).toBe('coal');
    /* then the final ledger: what it passes itself goes unsaid, and the
       game ends as far as the mine */
    const over: GameState = { ...scoring, phase: 'game-over' };
    const end = stepsOf(e.record, at(ctx(over), closed(q, ctx(over)), null), 0, draw);
    expect(said(end.steps)).toEqual(['finished coal played']);
  });

  it('marks the second lesson’s events with its course, and tells its choice at the canal’s count', () => {
    const g = { ...guided(), eraLength: 'standard' as const };
    const p = freshProgress('RAIL', 'full');
    const first = stepsOf(null, { ...at(ctx(g), p, 'fullWelcome'), table: 'RAIL' }, 0, draw);
    expect(said(first.steps)).toEqual(['shown fullWelcome']);
    expect(first.steps.every((e) => e.course === 'full')).toBe(true);
    /* the first lesson's say nothing of a course */
    expect(stepsOf(null, at(ctx(guided()), upTo('coal'), 'coal'), 0, draw).steps.every((e) => !('course' in e))).toBe(true);
    /* at the count, the lesson left there: said, with its course */
    const count: GameState = { ...g, phase: 'scoring-canal' };
    const left = stepsOf(first.record, { ...at(ctx(count), pass(p, 'fullWelcome'), null, { left: 'railChoice' }), table: 'RAIL' }, 0, draw);
    expect(said(left.steps)).toEqual(['passed fullWelcome next', 'left railChoice']);
    expect(left.steps.every((e) => e.course === 'full')).toBe(true);
  });

  it('reads its record back, and not a stranger’s', () => {
    const r: TrailRecord = { code: 'GWE5', id: ID, t0: 5, said: ['shown:welcome'], reached: 'welcome', last: 'welcome', playOn: false };
    expect(recordOf(JSON.stringify(r))).toEqual(r);
    for (const junk of [null, '', '{', '[]', JSON.stringify({ ...r, id: 'QUJA' }), JSON.stringify({ ...r, said: 'x' })]) expect(recordOf(junk)).toBeNull();
  });
});

describe('the post', () => {
  const event = (n: number): TrailEvent => ({ id: ID, kind: 'shown', lesson: 'coal', round: 1, at: n, s: n, view: 'desktop', lang: 'fr', version: 'test', seed: 3 });
  let frames: { at: number; events: TrailEvent[] }[] = [];
  /** the line, up or down */
  let up = true;
  const send = (events: TrailEvent[]) => {
    if (up) frames.push({ at: Date.now(), events });
    return up;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    up = true;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gathers a lesson’s events a while before they leave together', () => {
    const post = trailPost(send, () => false);
    post.push(event(1));
    post.push(event(2));
    vi.advanceTimersByTime(TRAIL_WAIT_MS - 1);
    expect(frames).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(frames.map((f) => f.events.length)).toEqual([2]);
    expect(post.waiting).toBe(0);
  });

  it('sends a full frame at once, and never two within the gap the office asks', () => {
    const post = trailPost(send, () => false);
    for (let i = 0; i < 2 * TRAIL_BATCH + 10; i++) post.push(event(i));
    expect(frames.map((f) => f.events.length)).toEqual([TRAIL_BATCH]);
    vi.advanceTimersByTime(10 * TRAIL_GAP_MS);
    expect(frames.map((f) => f.events.length)).toEqual([TRAIL_BATCH, TRAIL_BATCH, 10]);
    for (let i = 1; i < frames.length; i++) expect(frames[i].at - frames[i - 1].at).toBeGreaterThanOrEqual(TRAIL_GAP_MS);
    /* the end of the story wants out now: it goes at once — or, a frame
       gone a moment ago, once the gap is over */
    post.push(event(99));
    post.flush();
    expect(frames).toHaveLength(4);
    post.push(event(100));
    post.flush();
    expect(frames).toHaveLength(4);
    vi.advanceTimersByTime(TRAIL_GAP_MS);
    expect(frames).toHaveLength(5);
  });

  it('sends a frame at once as the page goes — one, not a burst', () => {
    const post = trailPost(send, () => false);
    for (let i = 0; i < TRAIL_BATCH + 10; i++) post.push(event(i));
    expect(frames.map((f) => f.events.length)).toEqual([TRAIL_BATCH]);
    /* the page put away within the gap: the rest goes at once all the same */
    post.drain();
    expect(frames.map((f) => f.events.length)).toEqual([TRAIL_BATCH, 10]);
    for (let i = 0; i < 3 * TRAIL_BATCH; i++) post.push(event(i));
    vi.advanceTimersByTime(TRAIL_GAP_MS);
    const before = frames.length;
    post.drain();
    expect(frames).toHaveLength(before + 1);
    /* and if the page comes back, the rest in its time */
    expect(post.waiting).toBeGreaterThan(0);
    vi.advanceTimersByTime(10 * TRAIL_GAP_MS);
    expect(post.waiting).toBe(0);
  });

  it('keeps only so much while the line is down, and sends it once it is up', () => {
    const post = trailPost(send, () => false);
    up = false;
    for (let i = 0; i < TRAIL_HELD + 100; i++) post.push(event(i));
    vi.advanceTimersByTime(3 * TRAIL_WAIT_MS);
    post.drain();
    expect(frames).toEqual([]);
    /* the newest kept */
    expect(post.waiting).toBe(TRAIL_HELD);
    up = true;
    vi.advanceTimersByTime(TRAIL_WAIT_MS + 10 * TRAIL_GAP_MS);
    const all = frames.flatMap((f) => f.events);
    expect(all).toHaveLength(TRAIL_HELD);
    expect(all[0].at).toBe(100);
    expect(all.at(-1)!.at).toBe(TRAIL_HELD + 99);
    for (let i = 1; i < frames.length; i++) expect(frames[i].at - frames[i - 1].at).toBeGreaterThanOrEqual(TRAIL_GAP_MS);
    expect(post.waiting).toBe(0);
  });

  it('sends nothing once the reader says no, nor what was waiting', () => {
    let shut = false;
    const post = trailPost(send, () => shut);
    post.push(event(1));
    shut = true;
    post.push(event(2));
    vi.advanceTimersByTime(TRAIL_WAIT_MS);
    post.drain();
    expect(frames).toEqual([]);
    expect(post.waiting).toBe(0);
  });
});

describe('the reader’s word', () => {
  it('is kept in the browser, and stops the post', () => {
    vi.useFakeTimers();
    const frames: TrailEvent[][] = [];
    const post = trailPost((e) => frames.push(e) > 0, trailOff);
    expect(trailOff()).toBe(false);
    setTrailOff(true);
    expect(localStorage.getItem(TRAIL_OFF_KEY)).toBe('1');
    expect(trailOff()).toBe(true);
    post.push({ id: ID, kind: 'shown', lesson: 'coal', round: 1, at: 0, s: 0, view: 'desktop', lang: 'fr', version: 'test', seed: 3 });
    vi.advanceTimersByTime(TRAIL_WAIT_MS);
    expect(frames).toEqual([]);
    setTrailOff(false);
    expect(localStorage.getItem(TRAIL_OFF_KEY)).toBeNull();
    expect(trailOff()).toBe(false);
    vi.useRealTimers();
  });
});
