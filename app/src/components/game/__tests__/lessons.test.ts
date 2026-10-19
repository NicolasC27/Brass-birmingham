import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { buildTargets, linkTargets, newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { LAST_LESSON, LESSON_IDS, back, detourOf, due, forward, freshProgress, lessonIndex, mayLater, pass, progressAt, readProgress, reread, saveProgress, see, setAside, settle } from '../lessons';
import type { LessonCtx, Progress } from '../lessons';

/* the lessons of the guided game, played on the guided table itself: you
   against Wedgwood, the canal era only, the deal of seed 3 */

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
/** every lesson before this one passed, in order */
const upTo = (id: string, code: string | null = 'GWE5'): Progress => ({ ...freshProgress(code), passed: LESSON_IDS.slice(0, lessonIndex(id)) });
const play = (g: GameState, a: GameAction): GameState => {
  const r = applyAction(g, g.current, a);
  if (!r.state) throw new Error(r.error);
  return r.state;
};
/** the reader's first mine, wherever the hand first allows one */
const mine = (g: GameState): GameState => {
  const at = g.players[0].hand.flatMap((c) => buildTargets(g, 0, c).filter((x) => x.valid && x.industry === 'coal').map((x) => ({ card: c.id, x })))[0];
  return play(g, { kind: 'build', card: at.card, town: at.x.town, slot: at.x.slot, industry: 'coal' });
};
/** the machine's turn played through, plainly */
const theirs = (g: GameState): GameState => {
  let s = g;
  while (s.phase === 'action' && s.players[s.current].isBot) s = play(s, fallbackAction(s, s.current));
  return s;
};

beforeEach(() => {
  stubStorage();
});

describe('the lesson due', () => {
  it('comes in order, a page passed by reading on', () => {
    const g = guided();
    let p = freshProgress('GWE5');
    expect(due(p, ctx(g))).toEqual({ id: 'welcome', index: 0, mode: 'read' });
    p = pass(p, 'welcome');
    expect(due(p, ctx(g))).toMatchObject({ id: 'board', mode: 'read' });
    /* passing twice changes nothing */
    expect(pass(p, 'welcome')).toBe(p);
  });

  it('shows a deed done beforehand as a page, which Next passes', () => {
    const g = guided();
    /* a card chosen while matRead was read: the hand is not skipped unread */
    const card = g.players[0].hand[0].id;
    let p = upTo('hand');
    const c = ctx(g, { sel: card });
    expect(due(p, c)).toMatchObject({ id: 'hand', mode: 'already' });
    /* on show, it is not a deed seen undone: nothing passes it but Next */
    expect(see(p, 'hand', c)).toBe(p);
    expect(settle(p, c)).toBe(p);
    p = pass(p, 'hand');
    expect(due(p, c)).toMatchObject({ id: 'coal', mode: 'do' });
    /* the mat opened before its lesson: the same */
    expect(due(upTo('mat'), ctx(g, { mat: 0 }))).toMatchObject({ id: 'mat', mode: 'already' });
    /* a mine built before the lesson on mines, on the real table */
    expect(due(upTo('coal'), ctx(mine(g)))).toMatchObject({ id: 'coal', mode: 'already' });
  });

  it('passes a deed seen undone as soon as it is done, and for good', () => {
    const g = guided();
    let p = upTo('coal');
    expect(due(p, ctx(g))).toMatchObject({ id: 'coal', mode: 'do' });
    p = see(p, 'coal', ctx(g));
    expect(p.seen.coal).toEqual({ at: 0, round: 1 });
    const built = mine(g);
    p = settle(p, ctx(built));
    expect(p.passed.at(-1)).toBe('coal');
    expect(due(p, ctx(built))).toMatchObject({ id: 'botTurn', mode: 'read' });
    /* the mine undone: the lesson is not taught again */
    expect(due(p, ctx(g))).toMatchObject({ id: 'botTurn' });
    /* settled twice, the same progress */
    expect(settle(p, ctx(built))).toBe(p);
  });

  it('sees no deed on her turn: a canal built under payday is read as done', () => {
    const g = guided();
    /* botTurn read: the canal is due while she plays her first turn, and
       the guide says no more than whose turn it is */
    let p = upTo('payday');
    const hers = mine(g);
    expect(hers.players[hers.current].isBot).toBe(true);
    expect(due(p, ctx(hers))).toMatchObject({ id: 'link', mode: 'do' });
    expect(see(p, 'link', ctx(hers))).toBe(p);
    /* round 2 opens on payday, the reader first; a canal built meanwhile */
    const r2 = theirs(hers);
    expect(r2.round).toBe(2);
    expect(r2.current).toBe(0);
    expect(due(p, ctx(r2))).toMatchObject({ id: 'payday', mode: 'read' });
    const canal = linkTargets(r2, 0).find((x) => x.valid)!;
    const linked = play(r2, { kind: 'network', card: r2.players[0].hand[0].id, link: canal.link.id });
    expect(settle(p, ctx(linked))).toBe(p);
    /* payday read on: the canal lesson is a page, not skipped unread */
    p = pass(p, 'payday');
    expect(due(p, ctx(linked))).toMatchObject({ id: 'link', mode: 'already' });
    p = pass(p, 'link');
    expect(due(p, ctx(linked))).toMatchObject({ id: 'iron', mode: 'do' });
  });

  it('passes a deed seen while another lesson is on show', () => {
    const g = guided();
    /* the sale skipped, flipped waits and the loan is shown undone */
    let p = pass(upTo('sell'), 'sell');
    expect(due(p, ctx(g))).toMatchObject({ id: 'loan', mode: 'do' });
    p = see(p, 'loan', ctx(g));
    /* a first sale brings flipped up; a loan taken while it is read */
    const sold = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, stats: { ...x.stats, sold: 1 } } : x)) };
    expect(due(p, ctx(sold))).toMatchObject({ id: 'flipped', mode: 'read' });
    const borrowed = { ...sold, players: sold.players.map((x, i) => (i === 0 ? { ...x, loans: 1 } : x)) };
    p = settle(p, ctx(borrowed));
    expect(p.passed.at(-1)).toBe('loan');
    expect(due(p, ctx(borrowed))).toMatchObject({ id: 'flipped' });
  });

  it('keeps a page waiting on the game in its place, however far the reader reads', () => {
    const g = guided();
    /* the sale skipped: what a flipped tile is waits for the first sale */
    let p = upTo('sell');
    p = pass(p, 'sell');
    expect(due(p, ctx(g))).toMatchObject({ id: 'loan' });
    for (const id of ['loan', 'eraEnd', 'plan', 'tips']) p = pass(p, id);
    expect(due(p, ctx(g))).toMatchObject({ id: 'onward' });
    const sold = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, stats: { ...x.stats, sold: 1 } } : x)) };
    expect(due(p, ctx(sold))).toMatchObject({ id: 'flipped', index: lessonIndex('flipped'), mode: 'read' });
    /* payday in the first round: the canal is taught meanwhile, payday is not lost */
    const q = upTo('payday');
    expect(due(q, ctx(g))).toMatchObject({ id: 'link' });
    expect(due(q, ctx({ ...g, round: 2 }))).toMatchObject({ id: 'payday' });
  });

  it('is finished once every lesson is passed', () => {
    const p = { ...freshProgress('GWE5'), passed: [...LESSON_IDS] };
    expect(due(p, ctx(guided()))).toEqual({ id: null, index: LESSON_IDS.length, mode: 'finished' });
    expect(LAST_LESSON).toBe('onward');
  });
});

describe('reading back', () => {
  it('walks the history and never passes anything, the loan detour included', () => {
    const g = guided();
    const broke = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    const c = ctx(broke);
    /* round 3, the works lesson short of money: the loan is taught first */
    const p = upTo('works');
    const d = due(p, c);
    expect(d).toMatchObject({ id: 'works', mode: 'do' });
    expect(detourOf(p, d, c, true, true)).toBe('loan');
    const before = JSON.stringify(p);
    /* Back, Back, Next, Next: the live lesson again */
    const b1 = back(p, null);
    expect(b1).toEqual({ id: 'develop', at: lessonIndex('develop') });
    const b2 = back(p, b1);
    expect(b2).toEqual({ id: 'iron', at: lessonIndex('iron') });
    expect(forward(p, b2)).toEqual(b1);
    expect(forward(p, b1)).toBeNull();
    /* nothing was passed or lost on the way */
    expect(JSON.stringify(p)).toBe(before);
    expect(due(p, c)).toEqual(d);
    expect(detourOf(p, d, c, true, true)).toBe('loan');
    /* the first lesson has nothing behind it */
    expect(back(p, { id: 'welcome', at: 0 })).toBeNull();
    expect(back(freshProgress('GWE5'), null)).toBeNull();
  });

  it('opens a lesson not yet passed out of turn, and comes back from it', () => {
    const p = upTo('works');
    const r = reread(p, 'loan');
    expect(r).toEqual({ id: 'loan', at: p.passed.length });
    expect(forward(p, r)).toBeNull();
    expect(back(p, r)).toEqual({ id: 'develop', at: p.passed.length - 1 });
    expect(reread(p, 'iron')).toEqual({ id: 'iron', at: lessonIndex('iron') });
  });

  it('takes no detour once the loan is taught, taken, or not the want', () => {
    const g = guided();
    const c = ctx(g);
    const p = upTo('works');
    const d = due(p, c);
    expect(detourOf(p, d, c, false, true)).toBeNull();
    expect(detourOf(p, d, c, true, false)).toBeNull();
    expect(detourOf(pass(p, 'loan'), d, c, true, true)).toBeNull();
    const borrowed = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, loans: 1 } : x)) };
    expect(detourOf(p, due(p, ctx(borrowed)), ctx(borrowed), true, true)).toBeNull();
    /* the loan itself due: it is the lesson, not a detour */
    const q = upTo('loan');
    expect(detourOf(q, due(q, c), c, true, true)).toBeNull();
  });
});

describe('a lesson set aside', () => {
  it('comes back in its place the next round', () => {
    const g3 = { ...guided(), round: 3 };
    let p = see(upTo('works'), 'works', ctx(g3));
    p = setAside(p, 'works', ctx(g3));
    expect(due(p, ctx(g3))).toMatchObject({ id: 'market' });
    p = pass(p, 'market');
    expect(due(p, ctx(g3))).toMatchObject({ id: 'beer' });
    expect(due(p, ctx({ ...g3, round: 4 }))).toMatchObject({ id: 'works', mode: 'do' });
    /* done meanwhile, it passes all the same: it was seen undone */
    const done = { ...g3, tiles: { 'x:0': { owner: 0, industry: 'pottery' } } } as unknown as GameState;
    expect(settle(p, ctx(done)).passed).toContain('works');
    /* passed, it is no longer set aside */
    expect(pass(p, 'works').later).toEqual({});
    /* no lesson of today's allows it yet */
    expect(mayLater(p, 'works', ctx(g3))).toBe(false);
  });
});

describe('the progress on the disk', () => {
  it('keeps the place over a reload', () => {
    const g = guided();
    const p = see(upTo('coal'), 'coal', ctx(g));
    saveProgress(p);
    expect(readProgress()).toEqual(p);
    const back1 = progressAt('GWE5');
    expect(back1).toEqual(p);
    /* the same object while nothing is written, for a render to subscribe to */
    expect(progressAt('GWE5')).toBe(back1);
    expect(due(back1, ctx(g))).toMatchObject({ id: 'coal', mode: 'do' });
    expect(settle(back1, ctx(mine(g))).passed.at(-1)).toBe('coal');
  });

  it('takes up the old indices once', () => {
    const store = stubStorage();
    const g = guided();
    /* read to the first payday, which waited on round 2 */
    store.set('brassworks.tutorial.step', '9');
    store.set('brassworks.tutorial.reached', '9');
    const p = progressAt('GWE5');
    expect(p.code).toBe('GWE5');
    expect(p.passed).toEqual(LESSON_IDS.slice(0, 9));
    expect(due(p, ctx(g))).toMatchObject({ id: 'link' });
    expect(due(p, ctx({ ...g, round: 2 }))).toMatchObject({ id: 'payday' });
    saveProgress(p);
    expect(store.has('brassworks.tutorial.step')).toBe(false);
    expect(store.has('brassworks.tutorial.reached')).toBe(false);
    expect(readProgress()).toEqual(p);
  });

  it('reads the old indices past a waiting page without losing it', () => {
    const store = stubStorage();
    const g = guided();
    /* flipped waited for a sale; the loan, done beforehand, was read past */
    store.set('brassworks.tutorial.step', '19');
    store.set('brassworks.tutorial.reached', '17');
    const p = progressAt('GWE5');
    expect(p.passed).toEqual(LESSON_IDS.slice(0, 17));
    expect(p.passed).not.toContain('flipped');
    const borrowed = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, loans: 1 } : x)) };
    const q = settle(p, ctx(borrowed));
    expect(q.passed.at(-1)).toBe('loan');
    expect(due(q, ctx(borrowed))).toMatchObject({ id: 'eraEnd' });
  });

  it('starts afresh at a second guided table', () => {
    const p = upTo('works', 'AAAA');
    saveProgress(p);
    expect(progressAt('BBBB')).toEqual(freshProgress('BBBB'));
    expect(progressAt('AAAA')).toEqual(p);
  });

  it('keeps only the lessons it knows, once each', () => {
    const store = stubStorage();
    store.set('brassworks.tutorial.progress', JSON.stringify({ v: 2, code: 'GWE5', passed: ['welcome', 'nope', 'welcome', 'board'], later: { nope: 3, works: 2 }, seen: { coal: { at: 1, round: 1 }, bad: 1 } }));
    expect(readProgress()).toEqual({ v: 2, code: 'GWE5', passed: ['welcome', 'board'], later: { works: 2 }, seen: { coal: { at: 1, round: 1 } } });
    store.set('brassworks.tutorial.progress', '{not json');
    expect(readProgress()).toBeNull();
  });
});
