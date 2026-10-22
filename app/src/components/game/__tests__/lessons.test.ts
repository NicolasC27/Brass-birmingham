import { beforeEach, describe, expect, it } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { applyAction, fallbackAction, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { buildTargets, canLoan, linkTargets, newGame, sellTargets } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { LAST_LESSON, LESSON_IDS, back, cheapestWorks, deedOf, detourOf, due, forward, freshProgress, lessonIndex, mayLater, optionalNow, pass, progressAt, readProgress, reread, saveProgress, see, setAside, settle, wayOn } from '../lessons';
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

/** the order the old indices counted in: the loan came after the sale */
const V1 = ['welcome', 'board', 'goal', 'money', 'mat', 'matRead', 'hand', 'coal', 'botTurn', 'payday', 'link', 'iron', 'develop', 'works', 'market', 'beer', 'sell', 'flipped', 'loan', 'eraEnd', 'plan', 'tips', 'onward'];

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
/** the works the hand builds now, each with the card that builds it */
const worksAt = (g: GameState) => g.players[0].hand.flatMap((c) => buildTargets(g, 0, c).filter((x) => x.valid && ['cotton', 'manufacturer', 'pottery'].includes(x.industry)).map((x) => ({ card: c.id, x })));
/** an action of the reader's that is no lesson's deed: a pass, paid with
 *  a card no works of the hand needs */
const idle = (g: GameState): GameState => {
  const needed = new Set(worksAt(g).map((w) => w.card));
  const card = g.players[0].hand.find((c) => !needed.has(c.id)) ?? g.players[0].hand[0];
  return play(g, { kind: 'pass', card: card.id });
};
/** the machine's turn played through, plainly */
const theirs = (g: GameState): GameState => {
  let s = g;
  while (s.phase === 'action' && s.players[s.current].isBot) s = play(s, fallbackAction(s, s.current));
  return s;
};

/** round 2 of the guided table, a mine of the reader's standing: her turn
 *  is played, and the reader's two actions close the round */
const round2 = (): GameState => theirs(mine(guided()));

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

  it('reads a tile by opening its sheet on the mat, by hover or by tap', () => {
    const g = guided();
    let p = upTo('matRead');
    expect(due(p, ctx(g, { mat: 0 }))).toMatchObject({ id: 'matRead', mode: 'do' });
    p = see(p, 'matRead', ctx(g, { mat: 0 }));
    p = settle(p, ctx(g, { mat: 0, sheet: true }));
    expect(p.passed.at(-1)).toBe('matRead');
    expect(due(p, ctx(g, { mat: 0, sheet: true }))).toMatchObject({ id: 'hand', mode: 'do' });
    /* a sheet read before its lesson came up: a page that says so */
    expect(due(upTo('matRead'), ctx(g, { sheet: true }))).toMatchObject({ id: 'matRead', mode: 'already' });
    /* no move ever reads a sheet: the coach's grades are not the lesson's */
    expect(deedOf(ctx(g), ctx(mine(g)))).toBe('coal');
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
    /* the first payday still waits on round 2, and the loan is shown undone */
    let p = { ...upTo('loan'), passed: upTo('loan').passed.filter((id) => id !== 'payday') };
    expect(due(p, ctx(g))).toMatchObject({ id: 'loan', mode: 'do' });
    p = see(p, 'loan', ctx(g));
    /* round 2 brings payday up; a loan taken while it is read */
    const r2 = { ...g, round: 2 };
    expect(due(p, ctx(r2))).toMatchObject({ id: 'payday', mode: 'read' });
    const borrowed = { ...r2, players: r2.players.map((x, i) => (i === 0 ? { ...x, loans: 1 } : x)) };
    p = settle(p, ctx(borrowed));
    expect(p.passed.at(-1)).toBe('loan');
    expect(due(p, ctx(borrowed))).toMatchObject({ id: 'payday' });
  });

  it('keeps a page waiting on the game in its place, however far the reader reads', () => {
    const g = guided();
    /* the sale skipped: what a flipped tile is waits for the first sale */
    let p = upTo('sell');
    p = pass(p, 'sell');
    expect(due(p, ctx(g))).toMatchObject({ id: 'eraEnd' });
    for (const id of LESSON_IDS.slice(lessonIndex('eraEnd'), -1)) p = pass(p, id);
    /* nothing due: the guide rests, the first lesson to come named */
    expect(due(p, ctx(g))).toEqual({ id: 'flipped', index: lessonIndex('flipped'), mode: 'idle' });
    const sold = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, stats: { ...x.stats, sold: 1 } } : x)) };
    expect(due(p, ctx(sold))).toMatchObject({ id: 'flipped', index: lessonIndex('flipped'), mode: 'read' });
    /* payday in the first round: the canal is taught meanwhile, payday is not lost */
    const q = upTo('payday');
    expect(due(q, ctx(g))).toMatchObject({ id: 'link' });
    expect(due(q, ctx({ ...g, round: 2 }))).toMatchObject({ id: 'payday' });
  });

  it('keeps the closing word for the final ledger', () => {
    const g = guided();
    const p = { ...freshProgress('GWE5'), passed: LESSON_IDS.filter((id) => id !== LAST_LESSON) };
    expect(LAST_LESSON).toBe('onward');
    /* while the game is played, the guide rests until its end */
    expect(due(p, ctx(g))).toEqual({ id: LAST_LESSON, index: lessonIndex(LAST_LESSON), mode: 'idle' });
    expect(due(p, ctx({ ...g, phase: 'game-over' }))).toMatchObject({ id: LAST_LESSON, mode: 'read' });
  });

  it('is finished once every lesson is passed', () => {
    const p = { ...freshProgress('GWE5'), passed: [...LESSON_IDS] };
    expect(due(p, ctx(guided()))).toEqual({ id: null, index: LESSON_IDS.length, mode: 'finished' });
  });
});

describe('reading back', () => {
  it('walks the history and never passes anything, the loan detour included', () => {
    const g = guided();
    const broke = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    const c = ctx(broke);
    /* round 2, the forge short of money: the loan is taught first */
    const p = upTo('iron');
    const d = due(p, c);
    expect(d).toMatchObject({ id: 'iron', mode: 'do' });
    expect(detourOf(p, d, c, true, true)).toBe('loan');
    const before = JSON.stringify(p);
    /* Back, Back, Next, Next: the live lesson again */
    const b1 = back(p, null);
    expect(b1).toEqual({ id: 'link', at: lessonIndex('link') });
    const b2 = back(p, b1);
    expect(b2).toEqual({ id: 'payday', at: lessonIndex('payday') });
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
    const p = upTo('iron');
    const r = reread(p, 'loan');
    expect(r).toEqual({ id: 'loan', at: p.passed.length });
    expect(forward(p, r)).toBeNull();
    expect(back(p, r)).toEqual({ id: 'link', at: p.passed.length - 1 });
    expect(reread(p, 'coal')).toEqual({ id: 'coal', at: lessonIndex('coal') });
  });

  it('takes no detour once the loan is taught, taken, or not the want', () => {
    const g = guided();
    const c = ctx(g);
    const p = upTo('iron');
    const d = due(p, c);
    expect(detourOf(p, d, c, false, true)).toBeNull();
    expect(detourOf(p, d, c, true, false)).toBeNull();
    expect(detourOf(pass(p, 'loan'), d, c, true, true)).toBeNull();
    const borrowed = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, loans: 1 } : x)) };
    expect(detourOf(p, due(p, ctx(borrowed)), ctx(borrowed), true, true)).toBeNull();
    /* the loan itself due: it is the lesson, not a detour */
    const q = upTo('loan');
    expect(detourOf(q, due(q, c), c, true, true)).toBeNull();
    /* the works come after the loan: no detour leads back to it */
    const w = upTo('works');
    expect(detourOf(w, due(w, c), c, true, true)).toBeNull();
  });

  it('teaches the loan before the works, and detours to it from the mine, the canal and the forge', () => {
    const g = guided();
    const c = ctx(g);
    expect(lessonIndex('loan')).toBe(lessonIndex('works') - 1);
    expect(due(pass(upTo('develop'), 'develop'), c)).toMatchObject({ id: 'loan', mode: 'do' });
    /* a deed before the loan short of money: the loan comes first */
    for (const id of ['coal', 'link', 'iron']) {
      const p = upTo(id);
      expect(detourOf(p, due(p, c), c, true, true)).toBe('loan');
    }
  });
});

describe('the loan that can wait', () => {
  it('may be passed while the purse pays for the cheapest works the hand allows', () => {
    const g = guided();
    const purse = (money: number, s: GameState = g): GameState => ({ ...s, players: s.players.map((x, i) => (i === 0 ? { ...x, money } : x)) });
    /* a cotton mill on a location card, £12: the cheapest works of the deal */
    expect(cheapestWorks(g, 0)).toBe(12);
    expect(optionalNow('loan', ctx(g))).toBe(true);
    expect(optionalNow('loan', ctx(purse(12)))).toBe(true);
    /* a pound short, and the works still counts: the loan is the lesson */
    expect(cheapestWorks(purse(11), 0)).toBe(12);
    expect(optionalNow('loan', ctx(purse(11)))).toBe(false);
    /* a hand that builds no works at all: the loan cannot wait on one */
    const bare = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, hand: [] } : x)) };
    expect(cheapestWorks(bare, 0)).toBeNull();
    expect(optionalNow('loan', ctx(bare))).toBe(false);
    /* the other deeds are never to be passed so */
    expect(optionalNow('works', ctx(g))).toBe(false);
    expect(optionalNow('welcome', ctx(g))).toBe(false);
  });

  it('stays the lesson due until it is passed or taken', () => {
    const g = guided();
    const p = pass(upTo('develop'), 'develop');
    /* a spare loan is a deed all the same: Next passes it, a loan does too */
    expect(due(p, ctx(g))).toMatchObject({ id: 'loan', mode: 'do' });
    expect(due(pass(p, 'loan'), ctx(g))).toMatchObject({ id: 'works', mode: 'do' });
    const borrowed = play(g, { kind: 'loan', card: g.players[0].hand[0].id });
    expect(settle(see(p, 'loan', ctx(g)), ctx(borrowed)).passed.at(-1)).toBe('loan');
  });

  it('is no longer one to wait for once a loan is taken, however full the purse', () => {
    const borrowed = play(guided(), { kind: 'loan', card: guided().players[0].hand[0].id });
    expect(borrowed.players[0].money).toBeGreaterThanOrEqual(cheapestWorks(borrowed, 0)!);
    expect(optionalNow('loan', ctx(borrowed))).toBe(false);
  });
});

describe('a lesson set aside', () => {
  it('is offered once an action was played past it, and comes back in its place the next round', () => {
    const r2 = round2();
    expect(r2.round).toBe(2);
    let p = upTo('works');
    expect(due(p, ctx(r2))).toMatchObject({ id: 'works', mode: 'do' });
    p = see(p, 'works', ctx(r2));
    /* on show, nothing played yet: the deed is the reader's to try first */
    expect(mayLater(p, 'works', ctx(r2))).toBe(false);
    const played = idle(r2);
    expect(played.current).toBe(0);
    expect(mayLater(p, 'works', ctx(played))).toBe(true);
    p = setAside(p, 'works', ctx(played));
    /* the lessons after it go on meanwhile */
    expect(due(p, ctx(played))).toMatchObject({ id: 'market', mode: 'read' });
    p = pass(pass(p, 'market'), 'beer');
    expect(due(p, ctx(played))).toMatchObject({ id: 'sell', mode: 'do' });
    /* set aside, it is neither seen again nor offered to set aside again */
    expect(see(p, 'works', ctx(played))).toBe(p);
    expect(mayLater(p, 'works', ctx(played))).toBe(false);
    /* nor passed: the evening course does not count it */
    expect(p.passed).not.toContain('works');
    /* the round played out: it comes back before the sale, a deed to do */
    const r3 = theirs(idle(played));
    expect(r3.round).toBe(3);
    expect(due(p, ctx(r3))).toMatchObject({ id: 'works', index: lessonIndex('works'), mode: 'do' });
    /* seen anew, it passes once done; played past already, it may wait
       again at once */
    p = see(p, 'works', ctx(r3));
    expect(p.seen.works).toEqual({ at: r3.actions.length, round: 3 });
    expect(mayLater(p, 'works', ctx(r3))).toBe(true);
    /* passed, it is no longer set aside */
    expect(pass(p, 'works').later).toEqual({});
  });

  it('comes back as a page that says so when its deed was done meanwhile', () => {
    const r2 = round2();
    let p = see(upTo('works'), 'works', ctx(r2));
    const played = idle(r2);
    p = setAside(p, 'works', ctx(played));
    /* the works built with the second action, the lesson set aside: the
       round is the reader's to close, and she opens the next one */
    const w = worksAt(played)[0];
    const built = play(played, { kind: 'build', card: w.card, town: w.x.town, slot: w.x.slot, industry: w.x.industry });
    expect(built.round).toBe(3);
    /* not passed unread, since it was set aside before it was done: it
       comes back in its place as a page that says it is done */
    expect(settle(p, ctx(built))).toBe(p);
    expect(due(p, ctx(built))).toMatchObject({ id: 'works', mode: 'already' });
    /* a page to read: nothing to see, and nothing to set aside */
    const r3 = theirs(built);
    expect(see(p, 'works', ctx(r3))).toBe(p);
    expect(mayLater(p, 'works', ctx(r3))).toBe(false);
    expect(due(pass(p, 'works'), ctx(r3))).toMatchObject({ id: 'market' });
  });

  it('is offered on the deeds from the canal on, and turns to Skip in the last round', () => {
    const r2 = round2();
    const after = idle(r2);
    for (const id of ['link', 'iron', 'loan', 'works', 'sell']) expect(mayLater(see(upTo(id), id, ctx(r2)), id, ctx(after))).toBe(true);
    /* the mine is the first round's one action, and the lessons after it
       are read off it: it does not wait */
    const q = see(upTo('coal'), 'coal', ctx(guided()));
    expect(q.seen.coal).toBeDefined();
    expect(mayLater(q, 'coal', ctx(after))).toBe(false);
    /* a page never waits: it is read on from */
    expect(mayLater(upTo('develop'), 'develop', ctx(after))).toBe(false);
    /* no round after the last for it to come back in: it is skipped */
    const works = see(upTo('works'), 'works', ctx(r2));
    expect(wayOn(works, 'works', ctx({ ...after, round: 9 }))).toBe('later');
    expect(wayOn(works, 'works', ctx({ ...after, round: 10 }))).toBe('skip');
    expect(mayLater(works, 'works', ctx({ ...after, round: 10 }))).toBe(false);
    /* a full game's canal era is not the last: the rail's first round is next */
    expect(wayOn(works, 'works', ctx({ ...after, round: 10, eraLength: 'standard' }))).toBe('later');
    expect(wayOn(works, 'works', ctx({ ...after, round: 10, eraLength: 'standard', era: 'rail' }))).toBe('skip');
    /* before an action is played past it, there is no way on but the deed */
    expect(wayOn(works, 'works', ctx(r2))).toBeNull();
  });

  it('leaves nothing to read while only a lesson set aside is left', () => {
    const r2 = round2();
    const played = idle(r2);
    /* every lesson passed but the loan, set aside, and the closing one */
    let p = see({ ...freshProgress('GWE5'), passed: LESSON_IDS.filter((id) => id !== 'loan' && id !== LAST_LESSON) }, 'loan', ctx(r2));
    p = setAside(p, 'loan', ctx(played));
    /* the note is idle — a mode that neither teaches nor holds the
       machine — and names the lesson set aside, not the closing word */
    const d = due(p, ctx(played));
    expect(d).toEqual({ id: 'loan', index: lessonIndex('loan'), mode: 'idle' });
    expect(see(p, 'loan', ctx(played))).toBe(p);
    /* the round over, the loan is the lesson due again */
    const r3 = theirs(idle(played));
    expect(due(p, ctx(r3))).toMatchObject({ id: 'loan', mode: 'do' });
    /* passed, the guide rests until the final ledger */
    expect(due(pass(p, 'loan'), ctx(played))).toMatchObject({ id: LAST_LESSON, mode: 'idle' });
  });
});

describe('the loan, never a trap', () => {
  it('always leaves a way on: Next while the purse pays, Later once played past, no detour while set aside', () => {
    const r2 = round2();
    const purse = (money: number, s: GameState): GameState => ({ ...s, players: s.players.map((x, i) => (i === 0 ? { ...x, money } : x)) });
    let p = upTo('loan');
    /* the purse pays for the next works: the loan may be passed at once */
    expect(optionalNow('loan', ctx(r2))).toBe(true);
    /* a thin purse, and no loan wanted: once an action is played past it,
       it may wait for the next round */
    const thin = purse(4, r2);
    expect(optionalNow('loan', ctx(thin))).toBe(false);
    expect(canLoan(thin, 0).ok).toBe(true);
    p = see(p, 'loan', ctx(thin));
    expect(due(p, ctx(thin))).toMatchObject({ id: 'loan', mode: 'do' });
    expect(mayLater(p, 'loan', ctx(thin))).toBe(false);
    const played = idle(thin);
    expect(mayLater(p, 'loan', ctx(played))).toBe(true);
    const q = setAside(p, 'loan', ctx(played));
    expect(due(q, ctx(played))).toMatchObject({ id: 'works', mode: 'do' });
    /* a forge short of money with the loan set aside: no detour leads
       back to it — the forge's own lesson is shown, and its Skip */
    const f = setAside(upTo('iron'), 'loan', ctx(played));
    const broke = purse(0, played);
    expect(detourOf(upTo('iron'), due(upTo('iron'), ctx(broke)), ctx(broke), true, true)).toBe('loan');
    expect(detourOf(f, due(f, ctx(broke)), ctx(broke), true, true)).toBeNull();
    expect(due(f, ctx(broke))).toMatchObject({ id: 'iron', mode: 'do' });
  });

  it('leaves the works and the sale after it a way to wait, not Skip alone', () => {
    const r2 = round2();
    const thin = { ...r2, players: r2.players.map((x, i) => (i === 0 ? { ...x, money: 4 } : x)) };
    let p = see(upTo('loan'), 'loan', ctx(thin));
    const played = idle(thin);
    p = setAside(p, 'loan', ctx(played));
    /* the works come up at once, and the thin purse builds none */
    expect(due(p, ctx(played))).toMatchObject({ id: 'works', mode: 'do' });
    expect(worksAt(played)).toEqual([]);
    p = see(p, 'works', ctx(played));
    /* nothing played past it, but nothing to try either: it may wait at
       once, as the block's advice says — come back after payday */
    expect(wayOn(p, 'works', ctx(played))).toBeNull();
    expect(wayOn(p, 'works', ctx(played), true)).toBe('later');
    p = setAside(p, 'works', ctx(played));
    expect(p.passed).not.toContain('works');
    /* the sale, with no works to sell: the same */
    p = pass(pass(p, 'market'), 'beer');
    expect(due(p, ctx(played))).toMatchObject({ id: 'sell', mode: 'do' });
    expect(sellTargets(played, 0).some((x) => x.valid)).toBe(false);
    const sell = see(p, 'sell', ctx(played));
    expect(mayLater(sell, 'sell', ctx(played), true)).toBe(true);
    /* in the last round it is skipped, with no round to come back in */
    expect(wayOn(sell, 'sell', ctx({ ...played, round: 10 }), true)).toBe('skip');
    /* the mine never waits: blocked, it keeps the guide's Skip */
    expect(wayOn(see(upTo('coal'), 'coal', ctx(guided())), 'coal', ctx(guided()), true)).toBeNull();
    /* the round over, the loan and then the works come back in their place */
    const r3 = theirs(idle(played));
    expect(due(setAside(sell, 'sell', ctx(played)), ctx(r3))).toMatchObject({ id: 'loan', mode: 'do' });
    expect(due(pass(sell, 'loan'), ctx(r3))).toMatchObject({ id: 'works', mode: 'do' });
  });

  it('lets the lesson that led to the detour wait for the payday, not drop it', () => {
    const r2 = round2();
    const broke = { ...r2, players: r2.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    const p = upTo('link');
    expect(detourOf(p, due(p, ctx(broke)), ctx(broke), true, true)).toBe('loan');
    /* money is what stops the canal: it may wait at once, and the forge
       comes up meanwhile */
    expect(wayOn(p, 'link', ctx(broke), true)).toBe('later');
    const q = setAside(p, 'link', ctx(broke));
    expect(due(q, ctx(broke))).toMatchObject({ id: 'iron', mode: 'do' });
    expect(q.passed).not.toContain('link');
    /* after the payday it is the lesson due again, in its place */
    const r3 = theirs(idle(idle(broke)));
    expect(r3.round).toBe(3);
    expect(due(q, ctx(r3))).toMatchObject({ id: 'link', mode: 'do' });
    /* the last round has no payday to wait for, and the mine never waits:
       both are skipped from the detour */
    expect(wayOn(p, 'link', ctx({ ...broke, round: 10 }), true)).toBe('skip');
    const g = guided();
    const bare = { ...g, players: g.players.map((x, i) => (i === 0 ? { ...x, money: 0 } : x)) };
    const m = upTo('coal');
    expect(detourOf(m, due(m, ctx(bare)), ctx(bare), true, true)).toBe('loan');
    expect(wayOn(m, 'coal', ctx(bare), true)).toBeNull();
  });
});

describe('the reader\'s own round', () => {
  it('passes once a turn\'s worth of actions is played with no word from the guide', () => {
    const r2 = round2();
    let p = upTo('onYourOwn');
    expect(due(p, ctx(r2))).toMatchObject({ id: 'onYourOwn', mode: 'do' });
    /* never done beforehand: it counts from the moment it is shown */
    expect(due(p, ctx(idle(idle(r2))))).toMatchObject({ id: 'onYourOwn', mode: 'do' });
    p = see(p, 'onYourOwn', ctx(r2));
    const one = idle(r2);
    expect(settle(p, ctx(one))).toBe(p);
    const two = idle(one);
    expect(settle(p, ctx(two)).passed.at(-1)).toBe('onYourOwn');
    /* no move is its deed: the coach grades the round */
    expect(deedOf(ctx(one), ctx(two))).toBeNull();
  });
});

describe('the deed of a move', () => {
  it('names the lesson whose deed a move did, whatever the progress', () => {
    const g = guided();
    const built = mine(g);
    /* the mine the lesson asks for, before its lesson or after, and again
       once taken back: the progress is no part of it */
    expect(deedOf(ctx(g), ctx(built))).toBe('coal');
    /* a move after which a mine stands that stood already */
    expect(deedOf(ctx(built), ctx(built))).toBeNull();
    /* the first loan, whenever it is taken */
    const borrowed = play(g, { kind: 'loan', card: g.players[0].hand[0].id });
    expect(deedOf(ctx(g), ctx(borrowed))).toBe('loan');
    /* a move that is no lesson's deed */
    const scouted = play(g, fallbackAction(g, 0));
    expect(deedOf(ctx(g), ctx(scouted))).toBeNull();
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
    /* the lesson on money is the goal's now: a record of it is dropped */
    expect(p.passed).toEqual(V1.slice(0, 9).filter((id) => id !== 'money'));
    expect(p.passed).toEqual(LESSON_IDS.slice(0, 8));
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
    /* flipped waited for a sale; the loan, done beforehand, was read past —
       counted in the order the indices were written in, the loan last */
    store.set('brassworks.tutorial.step', '19');
    store.set('brassworks.tutorial.reached', '17');
    const p = progressAt('GWE5');
    expect(p.passed).toEqual(V1.slice(0, 17).filter((id) => id !== 'money'));
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
