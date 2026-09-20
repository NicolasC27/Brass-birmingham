/* ------------------------------------------------------------------ */
/* The openings strong players swear by, as scripts read off the       */
/* table: while the opening lasts, the first rule whose condition      */
/* holds names the kind of action to play, and the best-reading legal  */
/* action of that kind is played; when no rule holds, or the table     */
/* allows nothing of the kind, the search plays on its own.            */
/*                                                                     */
/* Canal Era — an iron works turned into developments then a level-2   */
/* mill sold; a brewery in reach of the merchants then goods sold; a   */
/* development, an iron works, two links; two loans paired with        */
/* builds; pottery when a card allows. Rail Era — double rails first,   */
/* whatever the opening.                                               */
/* ------------------------------------------------------------------ */

import { applyAction } from './actions';
import type { GameAction } from './actions';
import type { GameState, IndustryType } from './types';

export type Opening = 'iron-battery' | 'beer-anchor' | 'flex-rails' | 'loans' | 'pottery';
export const OPENINGS: Opening[] = ['iron-battery', 'beer-anchor', 'flex-rails', 'loans', 'pottery'];

/** how many canal rounds an opening lasts, and how many rail rounds the double-rail rule does */
const CANAL_ROUNDS = 4;
const RAIL_ROUNDS = 2;

type Rule = { when: (s: GameState, seat: number) => boolean; play: (a: GameAction) => boolean };

const own = (s: GameState, seat: number, industry: IndustryType) => Object.values(s.tiles).filter((t) => t.owner === seat && t.industry === industry);
const goods = (s: GameState, seat: number) => Object.values(s.tiles).filter((t) => t.owner === seat && !t.flipped && ['cotton', 'manufacturer', 'pottery'].includes(t.industry));
const nextLevel = (s: GameState, seat: number, industry: IndustryType) => s.players[seat].stacks[industry][0] ?? 9;
const build = (...inds: string[]) => (a: GameAction) => a.kind === 'build' && inds.includes(a.industry);
const is = (k: GameAction['kind']) => (a: GameAction) => a.kind === k;
const double = (a: GameAction) => a.kind === 'network' && !!a.second;

const CANAL: Record<Opening, Rule[]> = {
  'iron-battery': [
    { when: (s, i) => s.players[i].stats.links === 0, play: is('network') },
    { when: (s, i) => own(s, i, 'iron').length === 0, play: build('iron') },
    { when: (s, i) => own(s, i, 'iron').some((t) => !t.flipped && t.cubes > 0) && nextLevel(s, i, 'cotton') < 2, play: is('develop') },
    { when: (s, i) => nextLevel(s, i, 'cotton') >= 2 && goods(s, i).length === 0, play: build('cotton', 'manufacturer') },
    { when: (s, i) => goods(s, i).length > 0, play: is('sell') },
  ],
  'beer-anchor': [
    { when: (s, i) => own(s, i, 'brewery').length === 0, play: build('brewery') },
    { when: (s, i) => goods(s, i).length === 0, play: build('cotton', 'manufacturer') },
    { when: (s, i) => goods(s, i).length > 0, play: is('sell') },
  ],
  'flex-rails': [
    { when: (s, i) => s.players[i].stats.developed === 0, play: is('develop') },
    { when: (s, i) => own(s, i, 'iron').length === 0, play: build('iron') },
    { when: (s, i) => s.players[i].stats.links < 2, play: is('network') },
  ],
  loans: [
    { when: (s, i) => s.players[i].loans < 2 && s.players[i].money < 20, play: is('loan') },
    { when: () => true, play: is('build') },
  ],
  pottery: [
    { when: (s, i) => goods(s, i).length > 0, play: is('sell') },
    { when: () => true, play: build('pottery') },
  ],
};
const RAIL: Rule[] = [{ when: () => true, play: double }];

/** the opening's action, or null when the opening is over, no rule holds,
 *  or the table allows nothing of the kind; `read` scores a table after
 *  an action, the best-reading candidate is played */
export function openingAction(s: GameState, seat: number, opening: Opening, legal: GameAction[], read: (after: GameState) => number): GameAction | null {
  const rules = s.era === 'canal' ? (s.round <= CANAL_ROUNDS ? CANAL[opening] : []) : s.round <= RAIL_ROUNDS ? RAIL : [];
  const rule = rules.find((r) => r.when(s, seat));
  if (!rule) return null;
  let best: { a: GameAction; v: number } | null = null;
  for (const a of legal) {
    if (!rule.play(a)) continue;
    const r = applyAction(s, seat, a);
    if (!r.state) continue;
    const v = read(r.state);
    if (!best || v > best.v) best = { a, v };
  }
  return best?.a ?? null;
}
