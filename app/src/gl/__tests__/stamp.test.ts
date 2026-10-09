import { describe, expect, it } from 'vitest';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { STAMP_IMPACT_S, STAMP_MAX, STAMP_S, freshPieces, inkBloom, stampPose } from '../stamp';

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'oxblood', type: 'human' },
    { name: 'Bob', color: 'verdigris', type: 'bot', difficulty: 'foreman' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const table = (): GameState => newGame(SETUP, 7);

describe('the printer\'s stamp', () => {
  it('keeps the whole gesture between a quarter and a third of a second', () => {
    expect(STAMP_S).toBeGreaterThanOrEqual(0.25);
    expect(STAMP_S).toBeLessThanOrEqual(0.35);
    expect(STAMP_IMPACT_S).toBeLessThan(STAMP_S);
  });

  it('falls from above, presses a touch in, springs back and settles at its size', () => {
    const start = stampPose(0);
    expect(start.scale).toBeGreaterThan(1);
    expect(start.alpha).toBeLessThan(1);
    const impact = stampPose(STAMP_IMPACT_S);
    expect(impact.scale).toBeLessThan(1);
    expect(impact.alpha).toBe(1);
    const samples = Array.from({ length: 61 }, (_, i) => stampPose((i / 60) * STAMP_S));
    /* never more than a very light press either way */
    for (const p of samples) {
      expect(p.scale).toBeGreaterThan(0.95);
      expect(p.scale).toBeLessThan(1.11);
    }
    /* the spring goes a hair over its size after the press */
    expect(Math.max(...samples.filter((_, i) => i / 60 > STAMP_IMPACT_S / STAMP_S).map((p) => p.scale))).toBeGreaterThan(1);
    expect(stampPose(STAMP_S)).toEqual({ scale: 1, alpha: 1 });
    expect(stampPose(5)).toEqual({ scale: 1, alpha: 1 });
  });

  it('moves without a jump from one phase to the next', () => {
    for (let t = 0; t < STAMP_S; t += 0.002) expect(Math.abs(stampPose(t + 0.002).scale - stampPose(t).scale)).toBeLessThan(0.02);
  });

  it('squeezes its ink out only once the block meets the paper, and lets it dry', () => {
    expect(inkBloom(STAMP_IMPACT_S / 2).wet).toBe(0);
    const early = inkBloom(STAMP_IMPACT_S + 0.01);
    const late = inkBloom(STAMP_S - 0.01);
    expect(early.wet).toBeGreaterThan(late.wet);
    expect(late.spread).toBeGreaterThan(early.spread);
    expect(inkBloom(STAMP_S).wet).toBe(0);
  });
});

describe('what the press strikes', () => {
  it('strikes nothing on a table it sees for the first time, or the same table again', () => {
    const s = table();
    expect(freshPieces(null, s)).toEqual({ tiles: [], links: [] });
    expect(freshPieces(s, s)).toEqual({ tiles: [], links: [] });
  });

  it('strikes a new tile, a tile built over and a new link', () => {
    const before = table();
    before.tiles['stoke:0'] = { owner: 0, industry: 'coal', level: 1, flipped: false, cubes: 2 };
    const after = structuredClone(before);
    after.tiles['dudley:0'] = { owner: 1, industry: 'iron', level: 1, flipped: false, cubes: 4 };
    after.tiles['stoke:0'] = { owner: 1, industry: 'coal', level: 2, flipped: false, cubes: 3 };
    after.links['birmingham--walsall'] = { owner: 1, era: 'canal' };
    const fresh = freshPieces(before, after);
    expect(fresh.tiles.sort()).toEqual(['dudley:0', 'stoke:0']);
    expect(fresh.links).toEqual(['birmingham--walsall']);
  });

  it('does not strike a tile that only changed its cubes or turned over', () => {
    const before = table();
    before.tiles['stoke:0'] = { owner: 0, industry: 'coal', level: 1, flipped: false, cubes: 2 };
    const after = structuredClone(before);
    after.tiles['stoke:0'] = { ...after.tiles['stoke:0'], cubes: 0, flipped: true };
    expect(freshPieces(before, after)).toEqual({ tiles: [], links: [] });
  });

  it('strikes nothing when the table goes back a move', () => {
    const later = table();
    later.tiles['stoke:0'] = { owner: 1, industry: 'coal', level: 2, flipped: false, cubes: 3 };
    later.actions = [{ kind: 'pass', card: 'x' }];
    const earlier = structuredClone(later);
    earlier.tiles['stoke:0'] = { owner: 0, industry: 'coal', level: 1, flipped: false, cubes: 2 };
    earlier.actions = [];
    expect(freshPieces(later, earlier)).toEqual({ tiles: [], links: [] });
  });

  it('stays still when a whole table arrives at once', () => {
    const before = table();
    const after = structuredClone(before);
    for (let i = 0; i <= STAMP_MAX; i++) after.links[`l${i}`] = { owner: 0, era: 'canal' };
    expect(freshPieces(before, after)).toEqual({ tiles: [], links: [] });
  });
});
