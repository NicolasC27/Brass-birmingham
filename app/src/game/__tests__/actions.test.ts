import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction, humanActionIndices, replay, setupOf, undoLastHuman } from '../actions';
import type { GameAction } from '../actions';
import { chooseBotMove } from '../bot';
import { INDUSTRIES } from '../data';
import { newGame, serialize } from '../engine';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* The engine as the online server will use it: a seed, a log of      */
/* actions, and nothing else. Four bots play whole games; every        */
/* accepted action goes through applyAction, and the log replayed from */
/* the seed must land on the very same state.                          */
/* ------------------------------------------------------------------ */

const SEATS: SetupPayload['players'] = [
  { name: 'Ada', color: 'oxblood', type: 'bot', difficulty: 'magnate' },
  { name: 'Bob', color: 'verdigris', type: 'bot', difficulty: 'industrialist' },
  { name: 'Cy', color: 'brass', type: 'bot', difficulty: 'foreman' },
  { name: 'Di', color: 'steel', type: 'bot', difficulty: 'industrialist' },
];
const setup = (n: number, eraLength: 'short' | 'standard' = 'standard'): SetupPayload => ({
  players: SEATS.slice(0, n),
  options: { eraLength, marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
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
