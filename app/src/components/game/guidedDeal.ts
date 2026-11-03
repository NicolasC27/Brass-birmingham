import { withEdition } from '@/game/actions';
import { INDUSTRIES, MERCHANTS, TOWN_BY_ID } from '@/game/data';
import { RULES_EDITION, buildTargets, merchantDemand, merchantOpen, newGame } from '@/game/engine';
import type { GameState, IndustryType, SetupPayload } from '@/game/types';
import { forgesFrom } from './lessonWords';

/* ------------------------------------------------------------------ */
/* What a deal must hold for the guided game to be dealt it. The guide  */
/* reads the rest off the table — the forge towns, the buyers, the      */
/* tiles on the mat — but its first lessons take a few things of the    */
/* deal for granted: the machine plays after the reader, the lesson on  */
/* coal opens on a coal card and a mine a canal away from a forge town, */
/* the canal is paid so as to keep the forge card, and the lesson on    */
/* works names a buyer for every works the hand builds. The deals that  */
/* hold them, and that a reader following the lessons plays through     */
/* (app/tools/guide/deals.ts), are the ones quickplay deals from.       */
/* ------------------------------------------------------------------ */

/** what a deal may lack of what the first lessons take for granted */
export type DealMiss = 'first' | 'coalCard' | 'forgeCard' | 'coalSlot' | 'works' | 'buyers';

const WORKS: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

/** a table at home as the office deals it: under the edition of the rules
 *  the browser names, today's when it names none */
export function dealtAs(setup: SetupPayload, seed: number): GameState {
  return newGame(withEdition({ ...setup, options: { ...setup.options, rules: setup.options.rules ?? RULES_EDITION } }), seed);
}

/** the works the reader's hand builds a first tile of: an industry card
 *  its own, a location card those its town has a slot for — of the tiles
 *  the era builds */
export function worksInHand(g: GameState, me: number): IndustryType[] {
  const hand = g.players[me].hand;
  return WORKS.filter(
    (w) =>
      INDUSTRIES[w][0].eras.includes(g.era) &&
      hand.some((c) => (c.kind === 'location' ? !!c.town && !!TOWN_BY_ID[c.town]?.slots.some((s) => s.allows.includes(w)) : c.kind === 'industry' && (c.industry === w || c.industry2 === w))),
  );
}

/** what the deal lacks for the guided game — nothing, for a deal it may
 *  be dealt: the reader first to play (the machine plays after you), a
 *  coal card and a forge card in hand, a mine the coal card builds a
 *  canal away from a forge town, and a buyer at this table for each
 *  works the hand builds, one at least */
export function dealMisses(g: GameState, me: number): DealMiss[] {
  const hand = g.players[me].hand;
  const card = (industry: IndustryType) => hand.find((c) => c.kind === 'industry' && c.industry === industry);
  const coal = card('coal');
  const works = worksInHand(g, me);
  const misses: DealMiss[] = [];
  if (g.order[0] !== me) misses.push('first');
  if (!coal) misses.push('coalCard');
  if (!card('iron')) misses.push('forgeCard');
  if (coal && !buildTargets(g, me, coal).some((t) => t.valid && t.industry === 'coal' && forgesFrom(g, me, t.town).length > 0)) misses.push('coalSlot');
  if (!works.length) misses.push('works');
  if (works.some((w) => !MERCHANTS.some((m) => merchantOpen(g, m.id) && merchantDemand(g, m.id).includes(w)))) misses.push('buyers');
  return misses;
}
