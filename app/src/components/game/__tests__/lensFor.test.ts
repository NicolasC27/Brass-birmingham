import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { lensFor } from '../lensFor';

/* the lesson on beer lights the breweries — unless a sale is being
   chosen, which is what called for the page: the sale's places stay lit */

function table(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  const g = newGame(withEdition(setup), 3);
  g.tiles['stone:0'] = { owner: 1, industry: 'brewery', level: 1, flipped: false, cubes: 1 };
  return g;
}

describe('the lens of the lesson on beer', () => {
  it('lights the breweries, and leaves a sale being chosen its own places', () => {
    const g = table();
    const card = g.players[0].hand[0].id;
    expect(lensFor('beer', g, 0, card, null)).toEqual({ slots: ['stone:0'], town: 'stone' });
    expect(lensFor('beer', g, 0, card, 'build')).toEqual({ slots: ['stone:0'], town: 'stone' });
    expect(lensFor('beer', g, 0, card, 'sell')).toBeNull();
  });
});
