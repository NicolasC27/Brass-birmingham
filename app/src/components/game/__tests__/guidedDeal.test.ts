import { describe, expect, it } from 'vitest';
import { TOWNS } from '@/game/data';
import { tutorialSetup } from '@/game/quickplay';
import type { GameState, SetupPayload } from '@/game/types';
import { dealMisses, dealtAs } from '../guidedDeal';

/* What a deal must hold for the guided game to be dealt it, read on the
   guided deal — seed 3, dealt as the office deals it — doctored to lack
   one thing at a time */

const ME = 0;
const deal = (seed: number): GameState => dealtAs(tutorialSetup() as unknown as SetupPayload, seed);

describe('what a deal may lack', () => {
  const doctored = (): GameState => structuredClone(deal(3));

  it('nothing, on the deal the guide was written on', () => {
    expect(dealMisses(deal(3), ME)).toEqual([]);
  });

  it('the reader first to play', () => {
    const g = doctored();
    g.order = [1, 0];
    expect(dealMisses(g, ME)).toEqual(['first']);
  });

  it('a coal card, and a forge card', () => {
    const g = doctored();
    g.players[ME].hand = g.players[ME].hand.filter((c) => !(c.kind === 'industry' && (c.industry === 'coal' || c.industry === 'iron')));
    expect(dealMisses(g, ME)).toEqual(['coalCard', 'forgeCard']);
  });

  it('a mine a canal away from a forge town', () => {
    const g = doctored();
    /* the machine's mines, full, on every coal slot of the board */
    for (const town of TOWNS)
      town.slots.forEach((slot, i) => {
        if (slot.allows.includes('coal')) g.tiles[`${town.id}:${i}`] = { owner: 1, industry: 'coal', level: 1, flipped: false, cubes: 2 };
      });
    expect(dealMisses(g, ME)).toEqual(['coalSlot']);
  });

  it('a works in hand, and a buyer for it', () => {
    const g = doctored();
    g.merchantTiles = Object.fromEntries(Object.entries(g.merchantTiles).map(([m, tiles]) => [m, tiles.map(() => 'blank' as const)]));
    expect(dealMisses(g, ME)).toEqual(['buyers']);
    g.players[ME].hand = g.players[ME].hand.filter((c) => c.kind === 'industry' && c.industry !== 'pottery');
    expect(dealMisses(g, ME)).toEqual(['works']);
  });
});
