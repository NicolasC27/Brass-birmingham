import { beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '@/game/engine';
import type { Rivalry } from '@/game/rivalry';
import type { GameState, SetupPayload } from '@/game/types';
import { stubStorage } from './storage';
import { paper } from '../papers';
import { noteSpoken, rivalWordFor } from '../rivals';

/* ------------------------------------------------------------------ */
/* A rival speaks once a game, as it opens: a table read again is not  */
/* greeted twice, and the next game hears another line.                */
/* ------------------------------------------------------------------ */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Mr Watt', color: 'steel', type: 'bot', persona: 'watt' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const NOW = Date.UTC(2026, 8, 20);
const WATT: Rivalry = { persona: 'watt', games: 3, won: 1, lost: 2, streak: -1, last: { code: 'OLD', at: NOW - 1000, map: 'midlands', won: false, vp: 120, theirs: 140 } };

describe('a rival at the table', () => {
  let g: GameState;
  beforeEach(() => {
    stubStorage();
    g = newGame(SETUP, 7);
  });

  it('is the character with the most history, at its own seat', () => {
    const said = rivalWordFor(g, 'G1', [WATT], { now: NOW, random: () => 0 });
    expect(said?.word).toMatchObject({ persona: 'watt', key: 'gloat', vars: { name: 'Ada', vp: 120, theirs: 140 } });
    expect(g.players[said!.seat].persona).toBe('watt');
  });

  it('speaks once a game, and not the same line at the next', () => {
    const first = rivalWordFor(g, 'G1', [WATT], { now: NOW, random: () => 0 })!;
    noteSpoken('G1', first.word);
    expect(rivalWordFor(g, 'G1', [WATT], { now: NOW, random: () => 0 })).toBeNull();
    const next = rivalWordFor(g, 'G2', [WATT], { now: NOW, random: () => 0 })!;
    expect(next.word.key).not.toBe(first.word.key);
    expect(paper<{ spoken: string[] }>('rivals', { spoken: [] }).spoken).toEqual(['G1']);
  });

  it('says nothing once the game is under way', () => {
    expect(rivalWordFor({ ...g, round: 2 }, 'G1', [WATT], { now: NOW })).toBeNull();
    expect(rivalWordFor({ ...g, era: 'rail' }, 'G1', [WATT], { now: NOW })).toBeNull();
  });

  it('greets a player no character at the table has met', () => {
    expect(rivalWordFor(g, 'G1', [], { now: NOW })?.word).toMatchObject({ persona: 'watt', key: 'first' });
  });
});
