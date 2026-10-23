import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload, TileState, Verb } from '@/game/types';
import { lensFor } from '../lensFor';

/* The lens of each lesson, on the guided game's deal (seed 3, two seats):
   Shrewsbury buys cotton, by Coalbrookdale; Oxford buys everything, by
   Birmingham and Redditch; Gloucester manufactured goods, by Redditch and
   Worcester. It lights the places a lesson is about, the ones its advice
   would take first strongest, and steps aside for a move being chosen */

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

const tile = (owner: number, industry: TileState['industry'], extra: Partial<TileState> = {}): TileState => ({ owner, industry, level: 1, flipped: false, cubes: 0, ...extra });
const ctx = (g: GameState, sel: string | null = null, verb: Verb | null = null, mat: number | null = null) => ({ g, me: 0, sel, mat, verb });
const coalCard = (g: GameState) => g.players[0].hand.find((c) => c.kind === 'industry' && c.industry === 'coal')!.id;

describe('the lens of the lesson on coal', () => {
  it('rings the hand, then Build, then lights where the card builds a mine', () => {
    const g = table();
    expect(lensFor('coal', ctx(g))).toEqual({ hud: 'hand' });
    expect(lensFor('coal', ctx(g, coalCard(g)))).toEqual({ hud: 'build' });
    expect(lensFor('coal', ctx(g, coalCard(g), 'network'))).toEqual({ hud: 'build' });
  });

  it('lights first the mines a canal leads from to a town with a forge slot', () => {
    const g = table();
    const lens = lensFor('coal', ctx(g, coalCard(g), 'build'))!;
    /* every place the card builds a mine stays lit */
    expect(lens.slots).toContain('coalbrookdale:2');
    expect(lens.slots).toContain('nuneaton:1');
    expect(lens.slots).toContain('redditch:0');
    /* the dead ends come after: no canal from them reaches a forge */
    expect(lens.first).not.toContain('coalbrookdale:2');
    expect(lens.first).not.toContain('nuneaton:1');
    expect(lens.first).not.toContain('redditch:0');
    expect(lens.first).toEqual(expect.arrayContaining(['belper:1', 'wolverhampton:1', 'dudley:0', 'kidderminster:0']));
    expect(lens.first!.length).toBe(lens.slots!.length - 3);
  });

  it('sends the camera to the mine with the most forges in reach, not the first on the board', () => {
    const g = table();
    /* Wolverhampton: Walsall, Coalbrookdale and Dudley by one canal each */
    expect(lensFor('coal', ctx(g, coalCard(g), 'build'))!.at).toBe('wolverhampton');
  });
});

describe('the lens of the lesson on beer', () => {
  it('lights the breweries, and leaves a sale being chosen its own places', () => {
    const g = table();
    g.tiles['stone:0'] = tile(1, 'brewery', { cubes: 1 });
    const card = g.players[0].hand[0].id;
    expect(lensFor('beer', ctx(g, card))).toEqual({ slots: ['stone:0'], at: 'stone' });
    expect(lensFor('beer', ctx(g, card, 'build'))).toEqual({ slots: ['stone:0'], at: 'stone' });
    expect(lensFor('beer', ctx(g, card, 'sell'))).toBeNull();
  });
});
