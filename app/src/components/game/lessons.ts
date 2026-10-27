import { marketBuyPrice } from '@/game/data';
import { buildTargets, eraRounds, ironSources, sellTargets } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import type { GameState, Verb } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The lessons of the guided game, and how far the reader has come.     */
/*                                                                      */
/* A lesson is a record kept by its id: a page to read, or a deed to do */
/* on the table. A deed passes its lesson once it holds after the       */
/* lesson was shown undone; a deed done beforehand leaves the lesson a  */
/* page to read, with a word that it is already done. A page waiting on */
/* the game keeps its place until its time comes, however far the       */
/* reader reads on, and a lesson set aside comes back the next round.   */
/* A page the move being prepared calls for cuts in as it is called and */
/* keeps its turn until read; never called, it comes in its place.      */
/*                                                                      */
/* The progress is kept by id, for the one table the guided game is     */
/* played at, and a lesson passed stays passed: undoing a move does not */
/* teach it again. The functions here are pure; the guide settles the   */
/* progress while it renders and writes it down from an effect.         */
/* ------------------------------------------------------------------ */

/** what a lesson may point at on the screen */
export type Show = 'mat' | 'market' | 'vp' | 'ledger';

/** what a lesson reads: the table, the reader's seat, the card chosen in
 *  the hand, the seat whose mat is open, whether a tile's sheet has been
 *  opened on a mat, the verb chosen and the build being prepared */
export interface LessonCtx {
  g: GameState;
  me: number;
  sel: string | null;
  mat: number | null;
  sheet?: boolean;
  verb?: Verb | null;
  pick?: BuildTarget | null;
}

/** when a deed was first shown undone, or a page called for by the
 *  table: the action it came up at, and the round */
export interface Sight {
  at: number;
  round: number;
}

export interface Lesson {
  id: string;
  /** the deed the lesson asks for, read off the table — and, once shown
   *  undone, off what was played since (seen); none for a page */
  done?: (c: LessonCtx, seen?: Sight) => boolean;
  /** a lesson that only makes sense once this holds: it waits in its place */
  when?: (c: LessonCtx) => boolean;
  /** a deed the reader may pass as things stand */
  optional?: (c: LessonCtx) => boolean;
  /** a deed the reader may set aside until the next round, once they have
   *  played an action since it came up */
  deferrable?: boolean;
  /** an aim with many ways to it rather than one move asked for: the
   *  coach grades the move that meets it */
  aim?: boolean;
  /** a page whose time, once come, will not wait behind a lesson due
   *  before it: it is given first */
  urgent?: boolean;
  /** a page the table calls for: once this holds on the reader's turn,
   *  it cuts in as an urgent one does, and keeps its turn until read —
   *  whatever became of what called it. Never called, it comes in its
   *  place, the latest it may come */
  cue?: (c: LessonCtx) => boolean;
  show?: Show;
}

const WORKS = ['cotton', 'manufacturer', 'pottery'];
const built = (c: LessonCtx, industries: string[]) => Object.values(c.g.tiles).some((t) => t.owner === c.me && industries.includes(t.industry));

/** what the cheapest works the hand allows would cost: a build only the
 *  purse stands in the way of counts; null when the hand allows none at
 *  all, whatever the purse */
export function cheapestWorks(g: GameState, me: number): number | null {
  const p = g.players[me];
  const costs = p.hand.flatMap((card) => buildTargets(g, me, card)).filter((x) => WORKS.includes(x.industry) && (x.valid || x.total > p.money)).map((x) => x.total);
  return costs.length ? Math.min(...costs) : null;
}

/** the reader's actions played since this action of the table, each
 *  counted once however many lines of the log it wrote */
export const playedSince = (c: LessonCtx, at: number): number =>
  new Set(c.g.ledger.filter((e) => e.player === c.me && (e.at ?? -1) >= at && e.verb !== 'system' && e.verb !== 'score').map((e) => e.at)).size;

/** a works of the reader's flipped — which a sale alone does: any of
 *  their works, to any merchant who buys its goods, by whoever's links,
 *  with whatever beer. The sales are counted, so a works swept off the
 *  board at an era's end still counts */
const worksFlipped = (c: LessonCtx): boolean => c.g.players[c.me].stats.sold > 0;
/** a works of the reader's on the board, not sold yet: something to sell */
const unsoldWorks = (c: LessonCtx): boolean => Object.values(c.g.tiles).some((t) => t.owner === c.me && WORKS.includes(t.industry) && !t.flipped);
/** a works of the reader's, not sold yet, that links join to a merchant
 *  buying its goods — whoever laid them */
const linkedWorks = (c: LessonCtx): boolean => sellTargets(c.g, c.me).length > 0;
/** a merchant's barrel drunk by a sale of the reader's; a sale logged
 *  before the log counted barrels tells by its bonus */
const drankBarrel = (c: LessonCtx): boolean =>
  c.g.ledger.some((e) => {
    const v = e.vars ?? {};
    return e.player === c.me && e.key === 'sell' && (v.barrels !== undefined ? Number(v.barrels) > 0 : !!(v.bonusVp || v.bonusMoney || v.bonusIncome || v.bonusDevelop));
  });
/** a barrel still standing at a merchant of this table */
const barrelsLeft = (c: LessonCtx): boolean => Object.values(c.g.merchantBeer).some((n) => n > 0);

/** the second half of the era, or the rail's: advice for the rounds left
 *  is given when they are the rounds left */
const halfway = (c: LessonCtx): boolean => c.g.era === 'rail' || c.g.round >= Math.ceil(eraRounds(c.g.players.length) / 2);

/** the game's last two rounds: the rail's, or a short game's canal */
const closing = (c: LessonCtx): boolean => (c.g.era === 'rail' || c.g.eraLength === 'short') && c.g.round >= eraRounds(c.g.players.length) - 1;

/** an iron the reader could take now: a forge's on the board, whoever's —
 *  iron ships freely — or the market's, at a price the purse pays */
const ironInReach = (c: LessonCtx): boolean => ironSources(c.g).length > 0 || c.g.players[c.me].money >= marketBuyPrice('iron', c.g.market.iron);
/** the build being prepared buys a cube of its coal or its iron at the market */
const buysAtMarket = (c: LessonCtx): boolean => !!c.pick && [...c.pick.coalPlan.sources, ...c.pick.ironPlan.sources].some((x) => x.kind === 'market');

/** no loan taken yet, and the purse already pays for the next works: the
 *  loan can wait. Once one is taken there is nothing left to wait for */
const worksPaid = (c: LessonCtx): boolean => {
  const p = c.g.players[c.me];
  const need = cheapestWorks(c.g, c.me);
  return p.loans === 0 && need !== null && p.money >= need;
};

/** the lessons, in the order the guide gives them */
export const LESSONS: readonly Lesson[] = [
  { id: 'welcome' },
  { id: 'board' },
  /* the points, and the purse and the income that buy them: one lesson */
  { id: 'goal', show: 'vp' },
  { id: 'mat', show: 'mat', done: (c) => c.mat !== null },
  /* read by doing: a tile's sheet opened on the mat, by hover or by tap */
  { id: 'matRead', show: 'mat', done: (c) => !!c.sheet },
  { id: 'hand', done: (c) => c.sel !== null },
  /* not to be set aside: in the first round the mine is the reader's one
     action, so "Later" could come no sooner than the round after — and
     the canal and the forge that follow are read off that mine. A mine
     the table does not allow may be skipped (the guide's Skip); one it
     allows that the reader will not build keeps the lesson on show round
     after round — on purpose: a mine costs little, and without one the
     lessons after it would speak of nothing */
  { id: 'coal', done: (c) => built(c, ['coal']) },
  /* read while the table waits: her turn comes once it has been read */
  { id: 'botTurn' },
  /* its page sends the reader to the ledger: a button opens it, for a
     tablet has no key */
  { id: 'payday', show: 'ledger', when: (c) => c.g.round >= 2 },
  { id: 'link', done: (c) => Object.values(c.g.links).some((l) => l.owner === c.me), deferrable: true },
  /* a forge, not "a forge or a brewery": a brewery costs as much but
     burns an iron, not a coal, so the mine and the canal the two lessons
     before laid for a forge would feed nothing, and what a forge teaches
     — its bars sold to the market, the iron left for developing — would
     go untaught. The lessons on developing and on beer would read true
     either way; the chain before them would not */
  { id: 'iron', done: (c) => built(c, ['iron']), deferrable: true },
  /* read once an iron is within reach — the forge's just built, as a
     rule; with none it waits, at the latest for the second half, whose
     advice is to develop. Develop chosen as a move calls for it at once */
  { id: 'develop', when: (c) => ironInReach(c) || halfway(c), cue: (c) => c.verb === 'develop' },
  /* a mine, a canal and a forge leave the purse too thin for a works:
     the loan is taught before it, not met as a detour on the way — a
     purse that already pays for one may pass it, and a reader who wants
     none sets it aside like any deed */
  { id: 'loan', done: (c) => c.g.players[c.me].loans > 0, optional: worksPaid, deferrable: true },
  /* read as a build being prepared buys at the market — the forge's coal,
     often; else before the works, whose coal and iron may come from it */
  { id: 'market', show: 'market', cue: buysAtMarket },
  { id: 'works', done: (c) => built(c, WORKS), deferrable: true },
  /* read the first time the reader chooses Sell with a works to sell —
     Sell tried with none is no sale, and would spend the page on nothing —
     else as the sale comes up */
  { id: 'beer', cue: (c) => c.verb === 'sell' && unsoldWorks(c) },
  /* the first works flipped, whichever it is — the one the lesson on
     works built, or another. The move is a sale all the same: the
     lesson's to teach, not an aim for the coach to grade */
  { id: 'sell', done: worksFlipped, deferrable: true },
  { id: 'flipped', when: worksFlipped },
  { id: 'eraEnd' },
  /* the second half: a turn's worth of actions played with no word from
     the guide — the reader's own round */
  { id: 'onYourOwn', done: (c, s) => !!s && playedSince(c, s.at) >= 2, aim: true },
  /* the plan for the rounds left and the habits, once they are the rounds
     left: ahead of the aims, which a reader may leave open all game, so
     they cut in when their time comes rather than wait behind them */
  { id: 'plan', when: halfway },
  { id: 'tips', when: halfway },
  /* then aims, met in the reader's own way and set aside like any deed: a
     works within reach of its buyer, by whoever's links; a merchant's
     barrel drunk — with none left standing, one to pass */
  { id: 'reach', done: linkedWorks, deferrable: true, aim: true },
  { id: 'barrel', done: drankBarrel, optional: (c) => !barrelsLeft(c), deferrable: true, aim: true },
  /* what each last action should do: it comes when they are the last,
     before an aim still open */
  { id: 'lastRounds', when: closing, urgent: true },
  /* the closing word, told on the final ledger and passed there: the
     game is played to its end with the guide beside it */
  { id: 'onward', when: (c) => c.g.phase === 'game-over' },
];

export const LESSON_IDS: readonly string[] = LESSONS.map((l) => l.id);
/** the last lesson: the closing word of the final ledger */
export const LAST_LESSON = LESSON_IDS[LESSON_IDS.length - 1];

export const lessonIndex = (id: string): number => LESSON_IDS.indexOf(id);
export const lessonOf = (id: string): Lesson | undefined => LESSONS[lessonIndex(id)];
/** a deed the reader may pass as the table stands */
export const optionalNow = (id: string, c: LessonCtx): boolean => !!lessonOf(id)?.optional?.(c);

/* ------------------------------ progress ----------------------------- */

export interface Progress {
  v: 2;
  /** the table the guided game is played at */
  code: string | null;
  /** the lessons passed, in the order they were: the reader's history */
  passed: string[];
  /** the lessons set aside, by the round they were set aside in */
  later: Record<string, number>;
  /** the deeds shown undone, and the pages the table called for, by the
   *  action and the round they first came up at */
  seen: Record<string, Sight>;
  /** the machine let play on: its moves no longer wait to be read, only
   *  a page not read yet holds it (guideHold.ts). Kept with the table's
   *  lessons, so a fresh guided game starts held again */
  playOn?: true;
}

export const freshProgress = (code: string | null): Progress => ({ v: 2, code, passed: [], later: {}, seen: {} });

/** the round, counted across the eras: a lesson set aside in the last
 *  round of the canal comes back in the first of the rail */
export const roundOf = (g: GameState): number => (g.era === 'rail' ? 100 : 0) + g.round;

/** a deed that holds after its lesson was shown undone: as good as passed */
const earned = (p: Progress, l: Lesson, c: LessonCtx): boolean => !!l.done && !!p.seen[l.id] && l.done(c, p.seen[l.id]);
/** set aside, and the round it was set aside in not over yet */
export const asideNow = (p: Progress, id: string, g: GameState): boolean => p.later[id] !== undefined && roundOf(g) <= p.later[id];
const aside = (p: Progress, id: string, c: LessonCtx): boolean => asideNow(p, id, c.g);
/** the first lesson set aside and not passed */
const heldBack = (p: Progress, c: LessonCtx): number => LESSONS.findIndex((l) => !p.passed.includes(l.id) && aside(p, l.id, c));
/** the last round of the game: no payday follows it, and no round for a
 *  lesson set aside to come back in */
export const lastRound = (g: GameState): boolean => g.round >= eraRounds(g.players.length) && (g.era === 'rail' || g.eraLength === 'short');

/** a page's cue, heard on the reader's own turn once the hand is taught:
 *  the pages before it tell of the table, not of a move, and a page called
 *  for would cut in ahead of them. What the reader chooses on hers,
 *  preparing a move ahead, calls for nothing yet */
const heard = (p: Progress, l: Lesson, c: LessonCtx): boolean =>
  !!l.cue && p.passed.includes('hand') && c.g.phase === 'action' && c.g.current === c.me && l.cue(c);
/** a page the table calls for now, or called for once and not read yet */
const called = (p: Progress, l: Lesson, c: LessonCtx): boolean => !!l.cue && (!!p.seen[l.id] || heard(p, l, c));

/** every deed seen undone that now holds, passed — in the lessons' order —
 *  and every page the table calls for now, noted: it keeps its turn until
 *  read. The same progress when nothing moved */
export function settle(p: Progress, c: LessonCtx): Progress {
  const now = LESSONS.filter((l) => !p.passed.includes(l.id) && earned(p, l, c)).map((l) => l.id);
  const q = now.reduce((q, id) => pass(q, id), p);
  const calls = LESSONS.filter((l) => !q.passed.includes(l.id) && !q.seen[l.id] && heard(q, l, c));
  if (!calls.length) return q;
  const at: Sight = { at: c.g.actions.length, round: roundOf(c.g) };
  return { ...q, seen: { ...q.seen, ...Object.fromEntries(calls.map((l) => [l.id, at])) } };
}

/** how the lesson due is given: a page to read, a deed to do, a deed done
 *  beforehand (a page, with a word that it is done), nothing due now but
 *  a lesson still to come (idle: the one set aside, which comes back next
 *  round, else the first waiting on its time), or nothing left */
export type Mode = 'read' | 'do' | 'already' | 'idle' | 'finished';

export interface Due {
  id: string | null;
  index: number;
  mode: Mode;
}

/** the lesson due: the first not passed, not set aside, and not waiting
 *  on the game — a page whose time has come and will not wait before
 *  it, or one the table called for. Nothing due, the guide rests until
 *  the next one comes, the last of all on the final ledger */
export function due(p: Progress, c: LessonCtx): Due {
  const left = (l: Lesson): boolean => !p.passed.includes(l.id) && !earned(p, l, c);
  const open = (l: Lesson): boolean => left(l) && !aside(p, l.id, c) && (!l.when || l.when(c) || called(p, l, c));
  const urgent = LESSONS.findIndex((l) => (l.urgent || called(p, l, c)) && open(l));
  const i = urgent >= 0 ? urgent : LESSONS.findIndex(open);
  if (i >= 0) {
    const l = LESSONS[i];
    if (!l.done) return { id: l.id, index: i, mode: 'read' };
    return { id: l.id, index: i, mode: l.done(c, p.seen[l.id]) ? 'already' : 'do' };
  }
  const held = heldBack(p, c);
  const next = held >= 0 ? held : LESSONS.findIndex(left);
  if (next >= 0) return { id: LESSONS[next].id, index: next, mode: 'idle' };
  return { id: null, index: LESSONS.length, mode: 'finished' };
}

/** a deed on show, noted while it is still undone: doing it now passes it.
 *  Only on the reader's own turn — on the machine's the guide says no more
 *  than whose turn it is, and a deed done under the next page is read as done */
export function see(p: Progress, id: string, c: LessonCtx): Progress {
  const l = lessonOf(id);
  if (!l?.done || p.seen[id] || l.done(c) || aside(p, id, c)) return p;
  if (c.g.phase !== 'action' || c.g.current !== c.me) return p;
  return { ...p, seen: { ...p.seen, [id]: { at: c.g.actions.length, round: roundOf(c.g) } } };
}

/** the machine let play on, or held for the reader's reading again */
export function letPlayOn(p: Progress, on: boolean): Progress {
  if (!!p.playOn === on) return p;
  const q = { ...p };
  if (on) q.playOn = true;
  else delete q.playOn;
  return q;
}

/** the lesson passed: read on from, done, or skipped */
export function pass(p: Progress, id: string): Progress {
  if (p.passed.includes(id)) return p;
  const later = { ...p.later };
  delete later[id];
  return { ...p, passed: [...p.passed, id], later };
}

/** the lesson set aside until the next round; it comes back in its place
 *  as if new: shown undone, it is seen again — done meanwhile, it comes
 *  back as a page that says so, not passed unread */
export function setAside(p: Progress, id: string, c: LessonCtx): Progress {
  const seen = { ...p.seen };
  delete seen[id];
  return { ...p, later: { ...p.later, [id]: roundOf(c.g) }, seen };
}

/** the way on from a deed that allows it, still undone, once the reader
 *  has played an action since it first came up — back from a round set
 *  aside, it was played past already, and one the table does not allow
 *  now (blocked) has nothing to try first: Later, which brings it back
 *  next round in its place, or Skip in the last round, with no round
 *  after it to come back in. Null while the deed is still the reader's
 *  to try */
export function wayOn(p: Progress, id: string, c: LessonCtx, blocked = false): 'later' | 'skip' | null {
  const l = lessonOf(id);
  const s = p.seen[id];
  if (!l?.deferrable || !l.done || l.done(c, s) || aside(p, id, c)) return null;
  const past = blocked || p.later[id] !== undefined || (!!s && playedSince(c, s.at) > 0);
  if (!past) return null;
  return lastRound(c.g) ? 'skip' : 'later';
}

/** "Later" is offered on the deed on show (see wayOn) */
export const mayLater = (p: Progress, id: string, c: LessonCtx, blocked = false): boolean => wayOn(p, id, c, blocked) === 'later';

/** the lesson a move did the deed of: the first whose deed did not hold
 *  before the move and holds after it. At the guided table that move is
 *  the lesson's, not the coach's to grade — passed or not: a deed taken
 *  back and done again is the lesson's still, though the lesson stays
 *  passed. The deeds are firsts, so this spares a move or two a lesson;
 *  an aim is met in the reader's own way, and graded like any move */
export function deedOf(before: LessonCtx, after: LessonCtx): string | null {
  return LESSONS.find((l) => l.done && !l.aim && !l.done(before) && l.done(after))?.id ?? null;
}

const LOAN_AT = lessonIndex('loan');

/** the lesson shown in place of the one due: when money is what its deed
 *  lacks (moneyShort) and the loan is still to be taught, the loan comes
 *  first, and the lesson due comes back after it. A loan set aside is not
 *  wanted this round: no detour leads to it */
export function detourOf(p: Progress, d: Due, c: LessonCtx, moneyShort: boolean, loanOk: boolean): string | null {
  if (!moneyShort || !loanOk || d.mode !== 'do' || d.id === null || d.index >= LOAN_AT) return null;
  if (p.passed.includes('loan') || LESSONS[LOAN_AT].done!(c) || aside(p, 'loan', c)) return null;
  return 'loan';
}

/* ------------------------------ reading back ------------------------- */

/** a lesson read again, and its place in the history — past its end for
 *  a lesson not passed yet (the one the sheet of progress points at) */
export interface Review {
  id: string;
  at: number;
}

/** Back: the lesson passed before this one, or null when there is none */
export function back(p: Progress, r: Review | null): Review | null {
  const at = (r ? r.at : p.passed.length) - 1;
  return at >= 0 && at < p.passed.length ? { id: p.passed[at], at } : null;
}

/** Next while reading back: the lesson passed after this one, or the live
 *  lesson again (null) — it never passes anything */
export function forward(p: Progress, r: Review | null): Review | null {
  if (!r) return null;
  const at = r.at + 1;
  return at < p.passed.length ? { id: p.passed[at], at } : null;
}

/** a lesson opened out of turn, read back from its place in the history */
export function reread(p: Progress, id: string): Review {
  const at = p.passed.indexOf(id);
  return { id, at: at >= 0 ? at : p.passed.length };
}

/* ------------------------------- the disk ---------------------------- */

/** the progress, one record for the guided table */
export const PROGRESS_KEY = 'brassworks.tutorial.progress';
/** before the lessons had ids: the index read past and the first lesson
 *  not passed, counted in the order of V1_ORDER */
const STEP_KEY = 'brassworks.tutorial.step';
const REACH_KEY = 'brassworks.tutorial.reached';
/** the order those indices counted in, kept as it was whatever the
 *  lessons become */
const V1_ORDER = ['welcome', 'board', 'goal', 'money', 'mat', 'matRead', 'hand', 'coal', 'botTurn', 'payday', 'link', 'iron', 'develop', 'works', 'market', 'beer', 'sell', 'flipped', 'loan', 'eraEnd', 'plan', 'tips', 'onward'];
/** the pages that waited on the game in that order: read past, they may
 *  never have been shown. The others were read, whatever they wait on now */
const V1_WAITED = ['payday', 'flipped'];

const known = (id: unknown): id is string => typeof id === 'string' && lessonIndex(id) >= 0;
const keep = <V>(o: unknown, ok: (v: unknown) => v is V): Record<string, V> =>
  Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => known(k) && ok(v))) as Record<string, V>;
const isRound = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSight = (v: unknown): v is Sight => !!v && typeof v === 'object' && isRound((v as { at: unknown }).at) && isRound((v as { round: unknown }).round);

/** a record read back, or null when it is not one */
function parse(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Progress> | null;
    if (!v || v.v !== 2 || !Array.isArray(v.passed)) return null;
    return { v: 2, code: typeof v.code === 'string' ? v.code : null, passed: [...new Set(v.passed.filter(known))], later: keep(v.later, isRound), seen: keep(v.seen, isSight), ...(v.playOn === true ? { playOn: true as const } : {}) };
  } catch {
    return null;
  }
}

/** the old indices read into a record: what lay below the first lesson
 *  not passed is passed; between it and the index read past, a page is
 *  passed, a deed is seen (it passes once it holds), and a page that
 *  waited on the game then keeps its place */
export function fromIndices(step: number, reached: number, code: string | null): Progress {
  const cut = (n: number) => Math.max(0, Math.min(V1_ORDER.length, Math.floor(Number.isFinite(n) ? n : 0)));
  const p = freshProgress(code);
  const r = cut(reached);
  p.passed = V1_ORDER.slice(0, r).filter(known);
  for (const id of V1_ORDER.slice(r, Math.max(r, cut(step)))) {
    const l = lessonOf(id);
    if (!l || V1_WAITED.includes(id)) continue;
    if (l.done) p.seen[id] = { at: 0, round: 0 };
    else p.passed.push(id);
  }
  return p;
}

/** the progress written in this visit, for a browser whose storage refuses it */
let kept: Progress | null = null;
const listeners = new Set<() => void>();

/** what this browser holds of the guided game: its record, or the old
 *  indices read into one; null when it was never begun */
export function readProgress(): Progress | null {
  try {
    const p = parse(localStorage.getItem(PROGRESS_KEY));
    if (p) return p;
    const step = localStorage.getItem(STEP_KEY);
    const reached = localStorage.getItem(REACH_KEY);
    if (step === null && reached === null) return null;
    return fromIndices(Number(step ?? 0), Number(reached ?? 0), null);
  } catch {
    /* no storage: what this visit wrote */
    return kept;
  }
}

/** what the disk holds for a table, as a key the last reading is kept by */
const shelfKey = (code: string | null): string => {
  try {
    return `${code}\n${[PROGRESS_KEY, STEP_KEY, REACH_KEY].map((k) => localStorage.getItem(k) ?? '').join('\n')}`;
  } catch {
    return `${code}\n`;
  }
};
let memo: { key: string; p: Progress } | null = null;

/** the progress at this table: its own record, the old indices taken up
 *  once, or a fresh start for a table that is not the one on record. The
 *  same object while nothing changes, so a render can subscribe to it */
export function progressAt(code: string): Progress {
  const key = shelfKey(code);
  if (memo?.key === key) return memo.p;
  const p = readProgress();
  const at = !p ? freshProgress(code) : p.code === code ? p : p.code === null ? { ...p, code } : freshProgress(code);
  memo = { key, p: at };
  return at;
}

/** write the progress down, and say so to whoever reads it */
export function saveProgress(p: Progress): void {
  kept = p;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    /* the old indices are read once, into the record */
    localStorage.removeItem(STEP_KEY);
    localStorage.removeItem(REACH_KEY);
  } catch {
    /* the record lives for this visit only */
  }
  /* read back as the very record written — even where the disk refused it,
     the next reading must not undo this one */
  memo = { key: shelfKey(p.code), p };
  for (const f of listeners) f();
}

/** hear every write of the progress */
export function onProgress(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}
