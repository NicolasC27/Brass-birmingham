import { describe, expect, it } from 'vitest';
import { MERCHANTS, TOWNS } from '@/game/data';
import { buildTargets } from '@/game/engine';
import { FULL_SEEDS, TUTORIAL_SEEDS, fullSetup, tutorialSetup } from '@/game/quickplay';
import type { Card, GameState, SetupPayload } from '@/game/types';
import { dealMisses, dealtAs, fullMisses, worksInHand } from '../guidedDeal';
import { buyersOf, forgesFrom } from '../lessonWords';

/* The guided game's deals, dealt as the office deals them: each holds what
   the first lessons take for granted. How a game goes on each — the forge
   fed by the reader's own mine, a first sale by round 5, no lesson missed
   — is played out by app/tools/guide/deals.ts, too long for a test: an
   engine that deals otherwise fails here first, and the list is drawn
   again there */

const ME = 0;
const deal = (seed: number): GameState => dealtAs(tutorialSetup() as unknown as SetupPayload, seed);
const industry = (g: GameState, kind: string): Card | undefined => g.players[ME].hand.find((c) => c.kind === 'industry' && c.industry === kind);
/** who holds the merchants' tiles that buy */
const layout = (g: GameState): string => (['cotton', 'manufacturer', 'all'] as const).map((tile) => MERCHANTS.filter((m) => (g.merchantTiles[m.id] ?? []).includes(tile)).map((m) => m.id).join('+')).join(' ');

describe('the guided deals', () => {
  it('are a dozen or so, each once, with the merchants laid out each their own way', () => {
    expect(TUTORIAL_SEEDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(TUTORIAL_SEEDS).size).toBe(TUTORIAL_SEEDS.length);
    expect(new Set(TUTORIAL_SEEDS.map((s) => layout(deal(s)))).size).toBe(TUTORIAL_SEEDS.length);
  });

  describe.each(TUTORIAL_SEEDS)('seed %i', (seed) => {
    const g = deal(seed);

    it('seats the reader first: the machine plays after', () => {
      expect(g.players[ME].isBot).toBe(false);
      expect(g.order[0]).toBe(ME);
      expect(g.current).toBe(ME);
    });

    it('hands a coal card and a forge card', () => {
      expect(industry(g, 'coal')).toBeDefined();
      expect(industry(g, 'iron')).toBeDefined();
    });

    it('leaves a mine free where the lesson on coal sends it', () => {
      const places = buildTargets(g, ME, industry(g, 'coal')!).filter((x) => x.valid && x.industry === 'coal');
      expect(places.some((x) => forgesFrom(g, ME, x.town).length > 0)).toBe(true);
    });

    it('names a buyer for every works the hand builds', () => {
      const works = worksInHand(g, ME);
      expect(works.length).toBeGreaterThan(0);
      const buyers = buyersOf(g);
      for (const w of works) expect(buyers.some((b) => b.goods === 'all' || b.goods.includes(w))).toBe(true);
    });

    it('lacks nothing', () => {
      expect(dealMisses(g, ME)).toEqual([]);
    });
  });
});

describe('what a deal may lack', () => {
  const doctored = (): GameState => structuredClone(deal(TUTORIAL_SEEDS[0]));

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

/* the second lesson's deals: a full game, the canal the reader's own. How
   the rail goes on each — every lesson shown, none with no way on, the
   careful reader opening the rail as its plan says — is played out by
   app/tools/guide/deals.ts --full */
describe('the second lesson\u2019s deals', () => {
  const full = (seed: number): GameState => dealtAs(fullSetup() as unknown as SetupPayload, seed);

  it('are a list of their own, none of the first lesson\u2019s, each with its layout of the merchants', () => {
    expect(FULL_SEEDS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(FULL_SEEDS).size).toBe(FULL_SEEDS.length);
    expect(FULL_SEEDS.filter((s) => TUTORIAL_SEEDS.includes(s))).toEqual([]);
    expect(new Set(FULL_SEEDS.map((s) => layout(full(s)))).size).toBe(FULL_SEEDS.length);
  });

  it.each(FULL_SEEDS)('seed %i deals a full game the reader opens, with a works a merchant buys', (seed) => {
    const g = full(seed);
    expect(g.eraLength).toBe('standard');
    expect(g.players.map((p) => p.isBot)).toEqual([false, true]);
    expect(g.current).toBe(ME);
    expect(fullMisses(g, ME)).toEqual([]);
  });

  it('asks less of a deal than the first lesson does', () => {
    const g = structuredClone(full(FULL_SEEDS[0]));
    g.players[ME].hand = g.players[ME].hand.filter((c) => !(c.kind === 'industry' && (c.industry === 'coal' || c.industry === 'iron')));
    expect(fullMisses(g, ME)).toEqual(dealMisses(g, ME).filter((m) => m === 'first' || m === 'works' || m === 'buyers'));
    expect(fullMisses(g, ME)).not.toContain('coalCard');
    g.order = [1, 0];
    expect(fullMisses(g, ME)).toContain('first');
  });
});
