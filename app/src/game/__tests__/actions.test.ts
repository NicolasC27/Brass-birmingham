import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction, humanActionIndices, replay, setupOf, undoLastHuman } from '../actions';
import type { GameAction } from '../actions';
import { chooseBotMove } from '../bot';
import { INDUSTRIES } from '../data';
import { buildTargets, newGame, serialize, withIron } from '../engine';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* The engine as the online server will use it: a seed, a log of      */
/* actions, and nothing else. Four bots play whole games; every        */
/* accepted action goes through applyAction, and the log replayed from */
/* the seed must land on the very same state.                          */
/* ------------------------------------------------------------------ */

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'bot', persona: 'watt' },
  { name: 'Bob', color: 'verdigris', type: 'bot', persona: 'boulton' },
  { name: 'Cy', color: 'brass', type: 'bot', persona: 'wedgwood' },
  { name: 'Di', color: 'steel', type: 'bot', persona: 'boulton' },
];
const setup = (n: number, eraLength: 'short' | 'standard' = 'standard'): SetupPayload => ({
  players: SEATS.slice(0, n),
  options: { eraLength, marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

const HUMANS: SetupPayload['players'] = [
  { name: 'Nico', color: 'brass', type: 'human' },
  { name: 'Eve', color: 'oxblood', type: 'human' },
  { name: 'Cy', color: 'verdigris', type: 'bot', persona: 'wedgwood' },
];

describe('abandoning the game', () => {
  const s0 = newGame({ players: HUMANS, options: setup(2).options }, 7);
  /* seats 0 and 1 are the humans, 2 the bot — whoever is to act */
  const yes = (s: GameState, player: number) => applyAction(s, player, { kind: 'concede', player, vote: 'yes' });

  it("is a vote cast on anyone's turn, in one's own name", () => {
    expect(yes(s0, 0).state).not.toBeNull();
    expect(yes(s0, 1).state).not.toBeNull();
    expect(applyAction(s0, 0, { kind: 'concede', player: 1, vote: 'yes' }).state).toBeNull();
    expect(yes(s0, 2).state).toBeNull();
  });

  it('folds the table only when every human agrees, and a refusal clears it', () => {
    const one = yes(s0, 1).state!;
    expect(one.phase).toBe('action');
    expect(one.concessions).toEqual([1]);
    expect(one.current).toBe(s0.current); // a vote is not a turn
    const refused = applyAction(one, 0, { kind: 'concede', player: 0, vote: 'no' }).state!;
    expect(refused.concessions).toEqual([]);
    expect(refused.phase).toBe('action');
    const both = yes(one, 0).state!;
    expect(both.phase).toBe('game-over');
    expect(both.abandoned).toBe(true);
    expect(both.winner).toBeDefined();
    /* the log replays, votes included, and votes are never undo points */
    expect(serialize(replay(setupOf(both), both.seed, both.actions))).toBe(serialize(both));
    expect(humanActionIndices(setupOf(both), both.seed, both.actions)).toEqual([]);
  });
});

describe('leaving the table', () => {
  const s0 = newGame({ players: HUMANS, options: setup(2).options }, 7);
  const leave = (s: GameState, player: number) => applyAction(s, player, { kind: 'resign', player });
  const move = (s: GameState): GameState => applyAction(s, s.current, botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current)).state!;

  it("hands the chair to a machine, in one's own name, and the game goes on", () => {
    const left = leave(s0, 1).state!;
    expect(left.phase).toBe('action');
    expect(left.players[1]).toMatchObject({ isBot: true, resigned: true });
    expect(left.current).toBe(s0.current); // leaving is not a turn
    expect(applyAction(s0, 0, { kind: 'resign', player: 1 }).state).toBeNull();
    expect(leave(s0, 2).state).toBeNull(); // a machine does not leave
    expect(leave(left, 1).state).toBeNull(); // nor does anyone leave twice
    /* the log replays: the setup remembers the chair was a human's at the deal */
    expect(setupOf(left).players[1].type).toBe('human');
    expect(serialize(replay(setupOf(left), left.seed, left.actions))).toBe(serialize(left));
    expect(humanActionIndices(setupOf(left), left.seed, left.actions)).toEqual([]);
  });

  it('lets the machine play the chair it was handed', () => {
    let s = s0;
    while (s.players[s.current].isBot) s = move(s);
    const seat = s.current;
    const left = leave(s, seat).state!;
    expect(left.current).toBe(seat);
    const played = move(left);
    expect(played.actions.length).toBe(left.actions.length + 1);
    expect(serialize(replay(setupOf(played), played.seed, played.actions))).toBe(serialize(played));
  });

  it('abandons the game once nobody human is left, or once those left had all voted to fold', () => {
    const one = leave(s0, 1).state!;
    const none = leave(one, 0).state!;
    expect(none.phase).toBe('game-over');
    expect(none.abandoned).toBe(true);
    const voted = applyAction(s0, 0, { kind: 'concede', player: 0, vote: 'yes' }).state!;
    const folded = leave(voted, 1).state!;
    expect(folded.phase).toBe('game-over');
    expect(folded.abandoned).toBe(true);
    expect(folded.concessions).toEqual([0]);
  });
});

/** bots play until the game is over (or a generous cap) */
function selfPlay(s0: GameState, cap = 600): GameState {
  let s = s0;
  for (let i = 0; i < cap && s.phase !== 'game-over'; i++) {
    if (s.phase === 'scoring-canal') {
      const r = applyAction(s, s.current, { kind: 'begin-rail' });
      if (!r.state) throw new Error(r.error);
      s = r.state;
      continue;
    }
    const wanted = botAction(chooseBotMove(s, s.current));
    let r = wanted ? applyAction(s, s.current, wanted) : { state: null };
    if (!r.state) r = applyAction(s, s.current, fallbackAction(s, s.current));
    if (!r.state) throw new Error(`turn ${i}: ${r.error}`);
    s = r.state;
  }
  return s;
}

/** what two states must agree on (the ledger keeps only its last 200 lines,
 *  which is fine — it is rebuilt identically anyway) */
const fingerprint = (s: GameState) => serialize(s);

describe('action log', () => {
  it('replays a full four-player game from its seed to the same state', () => {
    for (const seed of [1, 7, 42, 1234, 98765]) {
      const end = selfPlay(newGame(setup(4), seed));
      expect(end.phase).toBe('game-over');
      expect(end.actions.length).toBeGreaterThan(40);
      const again = replay(setupOf(end), seed, end.actions);
      expect(fingerprint(again)).toBe(fingerprint(end));
    }
  });

  it('replays two- and three-player games, standard and canal-only', () => {
    for (const [n, era, seed] of [
      [2, 'standard', 3],
      [3, 'standard', 11],
      [3, 'short', 5],
      [2, 'short', 8],
    ] as const) {
      const end = selfPlay(newGame(setup(n, era), seed));
      expect(end.phase).toBe('game-over');
      expect(fingerprint(replay(setupOf(end), seed, end.actions))).toBe(fingerprint(end));
    }
  });

  it('never mutates the state it is given', () => {
    const s = newGame(setup(4), 42);
    const before = serialize(s);
    const wanted = botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current);
    const r = applyAction(s, s.current, wanted);
    expect(r.state).not.toBeNull();
    expect(serialize(s)).toBe(before);
  });

  it('refuses out-of-turn, unknown-card and impossible actions without touching the state', () => {
    const s = newGame(setup(4), 42);
    const before = serialize(s);
    const other = (s.current + 1) % 4;
    const bad: [number, GameAction][] = [
      [other, { kind: 'pass' }],
      [s.current, { kind: 'build', card: 'no-such-card', town: 'birmingham', slot: 0, industry: 'cotton' }],
      [s.current, { kind: 'network', card: s.players[s.current].hand[0].id, link: 'no-such-link' }],
      [s.current, { kind: 'sell', card: s.players[s.current].hand[0].id, sales: [{ town: 'birmingham', slot: 0, merchant: 'm-oxford' }] }],
      [s.current, { kind: 'scout', cards: ['a', 'b', 'c'] }],
      [s.current, { kind: 'begin-rail' }],
    ];
    for (const [who, a] of bad) {
      const r = applyAction(s, who, a);
      expect(r.state).toBeNull();
      expect(r.error).toBeTruthy();
    }
    expect(serialize(s)).toBe(before);
  });

  it('keeps the table honest: money, stacks and cards add up all game long', () => {
    let s = newGame(setup(4), 7);
    /* the deal also lays face-down openers in the discard: they count too */
    const deckSize = s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
    for (let i = 0; i < 400 && s.phase !== 'game-over'; i++) {
      if (s.phase === 'scoring-canal') {
        s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
        continue;
      }
      const wanted = botAction(chooseBotMove(s, s.current));
      const r = (wanted && applyAction(s, s.current, wanted).state) || applyAction(s, s.current, fallbackAction(s, s.current)).state!;
      s = r;
      for (const p of s.players) {
        expect(p.money).toBeGreaterThanOrEqual(0);
        for (const [ind, stack] of Object.entries(p.stacks)) {
          const total = INDUSTRIES[ind as keyof typeof INDUSTRIES].reduce((a, l) => a + l.count, 0);
          expect(stack.length).toBeLessThanOrEqual(total);
          for (let k = 1; k < stack.length; k++) expect(stack[k]).toBeGreaterThanOrEqual(stack[k - 1]);
        }
      }
      if (s.era === 'canal') {
        const real = (c: { kind: string }) => c.kind === 'location' || c.kind === 'industry';
        const cards = s.deck.filter(real).length + s.discard.filter(real).length + s.players.reduce((a, p) => a + p.hand.filter(real).length, 0);
        expect(cards).toBe(deckSize);
      }
      for (const t of Object.values(s.tiles)) expect(t.cubes).toBeGreaterThanOrEqual(0);
    }
  });

  it('undoes the human\'s last action together with the bots\' replies', () => {
    const table: SetupPayload = { ...setup(4), players: setup(4).players.map((p, i) => (i === 0 ? { ...p, type: 'human' as const } : p)) };
    let s = newGame(table, 21);
    /* twelve turns, the human choosing like a bot would */
    for (let i = 0; i < 12; i++) {
      const wanted = botAction(chooseBotMove(s, s.current));
      s = ((wanted && applyAction(s, s.current, wanted).state) || applyAction(s, s.current, fallbackAction(s, s.current)).state)!;
    }
    const marks = humanActionIndices(setupOf(s), s.seed, s.actions);
    expect(marks.length).toBeGreaterThan(0);
    const at = marks[marks.length - 1].at;
    const back = undoLastHuman(s, marks)!;
    expect(back.actions.length).toBe(at);
    /* it is the human's turn again, on the very state they acted from */
    expect(back.phase).toBe('action');
    expect(back.players[back.current].isBot).toBe(false);
    /* identical but for the board FX, which undo deliberately suppresses */
    const strip = (g: GameState) => serialize({ ...g, fxSeq: 0, lastFx: undefined });
    expect(strip(back)).toBe(strip(replay(setupOf(s), s.seed, s.actions.slice(0, at))));
    /* undoing again steps back to the previous human action */
    const again = undoLastHuman(back, marks.slice(0, -1));
    if (marks.length > 1) expect(again!.actions.length).toBe(marks[marks.length - 2].at);
    else expect(again).toBeNull();
  });
});

describe('developing', () => {
  const s0 = newGame({ players: HUMANS, options: setup(2).options }, 11);
  const me = s0.current;
  const card = s0.players[me].hand[0];

  it('retires the same industry twice, the top tile then the one beneath', () => {
    const before = [...s0.players[me].stacks.cotton];
    const r = applyAction(s0, me, { kind: 'develop', card: card.id, industries: ['cotton', 'cotton'], ironFrom: ['market', 'market'] });
    expect(r.state).not.toBeNull();
    expect(r.state!.players[me].stacks.cotton).toEqual(before.slice(2));
    expect(r.state!.players[me].money).toBeLessThan(s0.players[me].money);
  });

  it('takes its iron from the works it names', () => {
    const s = structuredClone(s0);
    s.tiles['coalbrookdale:1'] = { owner: 1 - me, industry: 'iron', level: 1, flipped: false, cubes: 2 };
    const r = applyAction(s, me, { kind: 'develop', card: card.id, industries: ['cotton'], ironFrom: ['coalbrookdale:1'] });
    expect(r.state).not.toBeNull();
    expect(r.state!.tiles['coalbrookdale:1'].cubes).toBe(1);
    expect(r.state!.players[me].money).toBe(s.players[me].money);
  });
});

describe('the iron of a build', () => {
  it('comes from the works the player names, and from the nearest otherwise', () => {
    const s = newGame(setup(4), 42);
    const me = s.current;
    /* two iron works on the board, one of them mine; a brewery takes one iron */
    s.tiles['coalbrookdale:0'] = { owner: me, industry: 'iron', level: 1, flipped: false, cubes: 4 };
    s.tiles['dudley:0'] = { owner: (me + 1) % 4, industry: 'iron', level: 1, flipped: false, cubes: 4 };
    s.players[me].hand = [{ id: 'wild-1', kind: 'wild-location' }];
    s.players[me].money = 30;
    const t = buildTargets(s, me, s.players[me].hand[0]).find((x) => x.valid && x.industry === 'brewery')!;
    expect(t).toBeDefined();
    const mine = withIron(s, me, t, 'coalbrookdale:0');
    expect(mine.ironPlan.sources[0]).toMatchObject({ kind: 'tile', town: 'coalbrookdale', amount: 1 });
    expect(mine.total).toBe(t.total);
    /* the market is not a choice while a works holds iron */
    expect(withIron(s, me, t, 'market').ironPlan.sources[0].kind).toBe('tile');
    /* a dry or unknown works leaves the engine's nearest */
    expect(withIron(s, me, t, 'no:such').ironPlan).toEqual(t.ironPlan);
    /* played, the build takes its cube from the named works */
    const r = applyAction(s, me, { kind: 'build', card: 'wild-1', town: t.town, slot: t.slot, industry: 'brewery', ironFrom: 'coalbrookdale:0' });
    expect(r.state).not.toBeNull();
    expect(r.state!.tiles['coalbrookdale:0'].cubes).toBe(3);
    expect(r.state!.tiles['dudley:0'].cubes).toBe(4);
  });
});
