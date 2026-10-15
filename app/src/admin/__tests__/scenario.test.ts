import { describe, expect, it } from 'vitest';
import { replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { PRESETS, chunks, flippedTiles, lastTurnStart, playTo, presetOf, progressOf, scenarioSetup } from '../scenario';
import type { Chooser, Preset } from '../scenario';

/* ------------------------------------------------------------------ */
/* The test bench's scenarios: each preset stops where it says, on a   */
/* log the engine replays from the seed — the log the office will read */
/* move by move.                                                       */
/* ------------------------------------------------------------------ */

const SEED = 4242;
const three = scenarioSetup({ seats: 3, owner: 1, name: 'Nicolas', personas: ['wedgwood', 'watt'] });
const preset = (id: string): Preset => presetOf(id)!;

describe('the table of a scenario', () => {
  it('seats the owner where asked and the machines around him', () => {
    expect(three.players.map((p) => p.type)).toEqual(['bot', 'human', 'bot']);
    expect(three.players.map((p) => p.persona)).toEqual(['wedgwood', undefined, 'watt']);
    expect(three.players[1].name).toBe('Nicolas');
    expect(three.players.map((p) => p.color)).toEqual(['brass', 'oxblood', 'verdigris']);
    /* dealt under today's rules, named, as the office writes a deal down */
    expect(three.options.rules).toBeGreaterThanOrEqual(2);
  });

  it('keeps the seats and the owner within the table', () => {
    const s = scenarioSetup({ seats: 9, owner: 7, name: 'N', personas: ['boulton', 'watt', 'arkwright'] });
    expect(s.players).toHaveLength(4);
    expect(s.players[3].type).toBe('human');
  });
});

describe('the play forward', () => {
  /** the log stands: it replays from the seed to the very position */
  const stands = (actions: GameAction[], phase: string) => {
    const again = replay(three, SEED, actions);
    expect(again.phase).toBe(phase);
    return again;
  };

  it('stops at the owner’s first turn of the canal', () => {
    const r = playTo(three, SEED, preset('canal-start'), 1);
    expect(r.reached).toBe(true);
    expect(r.state.era).toBe('canal');
    expect(r.state.current).toBe(1);
    expect(r.state.round).toBe(1);
    stands(r.actions, 'action');
  });

  it('stops half way through the canal with tiles and links on the board', () => {
    const r = playTo(three, SEED, preset('canal-mid'), 1);
    expect(r.reached).toBe(true);
    expect(r.state.era).toBe('canal');
    expect(r.state.round).toBeGreaterThanOrEqual(4);
    expect(Object.keys(r.state.tiles).length).toBeGreaterThan(0);
    expect(Object.keys(r.state.links).length).toBeGreaterThan(0);
    expect(r.state.current).toBe(1);
    /* at the start of his turn: nobody has moved since the last seat */
    const before = replay(three, SEED, r.actions.slice(0, -1));
    expect(before.current === 1 && before.round === r.state.round).toBe(false);
  });

  it('stops at the ceremony, or at the owner’s last turn before it', () => {
    const ceremony = playTo(three, SEED, preset('canal-ceremony'), 1);
    expect(ceremony.state.phase).toBe('scoring-canal');
    stands(ceremony.actions, 'scoring-canal');

    const before = playTo(three, SEED, preset('canal-scoring'), 1);
    expect(before.reached).toBe(true);
    expect(before.state.phase).toBe('action');
    expect(before.state.era).toBe('canal');
    expect(before.state.current).toBe(1);
    /* the ceremony's log begins with this one: the same game, a few moves short */
    expect(ceremony.actions.slice(0, before.actions.length)).toEqual(before.actions);
    expect(ceremony.actions.length - before.actions.length).toBeLessThanOrEqual(3 * 2);
  });

  it('opens the rail era, and stops late in it with tiles turned', () => {
    const start = playTo(three, SEED, preset('rail-start'), 1);
    expect(start.state.era).toBe('rail');
    expect(start.state.current).toBe(1);
    expect(start.actions.some((a) => a.kind === 'begin-rail')).toBe(true);

    const late = playTo(three, SEED, preset('rail-late'), 1);
    expect(late.reached).toBe(true);
    expect(late.state.era).toBe('rail');
    expect(late.state.deck).toHaveLength(0);
    expect(flippedTiles(late.state)).toBeGreaterThanOrEqual(3);
    stands(late.actions, 'action');
  });

  it('plays a game out, or stops at the owner’s last turn of it', () => {
    const over = playTo(three, SEED, preset('game-over'), 1);
    expect(over.reached).toBe(true);
    stands(over.actions, 'game-over');

    const last = playTo(three, SEED, preset('rail-last'), 1);
    expect(last.reached).toBe(true);
    expect(last.state.phase).toBe('action');
    expect(last.state.current).toBe(1);
    expect(over.actions.slice(0, last.actions.length)).toEqual(last.actions);
  });

  it('reaches every preset at two and at four seats, whoever the owner is', () => {
    for (const [seats, owner] of [
      [2, 0],
      [4, 3],
    ] as const) {
      const setup = scenarioSetup({ seats, owner, name: 'N', personas: ['boulton', 'arkwright', 'watt'] });
      for (const p of PRESETS) {
        const r = playTo(setup, 77, p, owner);
        expect(r.reached, `${seats} seats, ${p.id}`).toBe(true);
      }
    }
  });

  it('falls back on a legal move when the chooser offers nothing', () => {
    const idle: Chooser = () => null;
    const r = playTo(three, SEED, preset('canal-mid'), 1, idle);
    /* scouting and passing all the way: the canal ends before any tile is laid */
    expect(r.reached).toBe(false);
    expect(Object.keys(r.state.tiles)).toHaveLength(0);
  });
});

describe('the pieces of the bench', () => {
  it('finds the start of the owner’s last turn', () => {
    const t = (seat: number, round: number) => ({ seat, era: 'canal', round });
    expect(lastTurnStart([t(0, 1), t(1, 1), t(0, 2), t(0, 2), t(1, 2), t(1, 2)], 1)).toBe(4);
    /* last in one round and first in the next: two turns, not one */
    expect(lastTurnStart([t(1, 2), t(1, 2), t(1, 3), t(1, 3), t(0, 3)], 1)).toBe(2);
    expect(lastTurnStart([t(0, 1)], 1)).toBe(-1);
  });

  it('measures the way through a game', () => {
    const s = playTo(three, SEED, preset('rail-start'), 1).state;
    expect(progressOf(s, 9)).toBeGreaterThanOrEqual(0.5);
    expect(progressOf({ ...s, phase: 'game-over' }, 9)).toBe(1);
  });

  it('slices a log for the wire', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 3)).toEqual([]);
  });
});
