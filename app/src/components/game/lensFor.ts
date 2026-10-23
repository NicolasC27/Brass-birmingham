import { buildTargets, tileKey } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import type { Lens } from '@/game/store';
import type { GameState } from '@/game/types';
import type { LessonCtx } from './lessons';
import { forgesFrom } from './lessonWords';

/* ------------------------------------------------------------------ */
/* What each lesson of the guide lights on the table: the slots it is   */
/* about on the map, or the part of the HUD it names — and where the    */
/* camera should come. The board dims the rest; the halo rings the HUD  */
/* part. Computed from the state, so a lesson that says "build a mine"  */
/* lights the very places a mine may go right now — the ones its advice */
/* would take lit first, the others still lit, weaker: the lens guides, */
/* it forbids nothing.                                                  */
/* ------------------------------------------------------------------ */

const WORKS: readonly string[] = ['cotton', 'manufacturer', 'pottery'];

const unique = (keys: string[]): string[] => [...new Set(keys)];

/** the first of these by the score, the board's order breaking a tie */
function bestOf<X>(xs: readonly X[], score: (x: X) => number): X | undefined {
  let best: X | undefined;
  for (const x of xs) if (best === undefined || score(x) > score(best)) best = x;
  return best;
}

/** the places a card builds the lesson's tiles on, those the advice
 *  would take first scoring above nought: the first lit strongest, and
 *  the camera sent to the best of them */
function places(targets: readonly BuildTarget[], score: (t: BuildTarget) => number): Lens | null {
  if (!targets.length) return null;
  const slots = unique(targets.map((t) => tileKey(t.town, t.slot)));
  const first = unique(targets.filter((t) => score(t) > 0).map((t) => tileKey(t.town, t.slot)));
  const best = bestOf(targets, score)!;
  return { slots, ...(first.length && first.length < slots.length ? { first } : {}), at: best.town };
}

export function lensFor(stepId: string | null | undefined, c: LessonCtx): Lens | null {
  const { g, me } = c;
  if (!stepId || me < 0 || !g.players[me]) return null;
  const card = c.sel ? (g.players[me].hand.find((x) => x.id === c.sel) ?? null) : null;
  const verb = c.verb ?? null;
  const mine = (pred: (t: GameState['tiles'][string]) => boolean) => Object.entries(g.tiles).filter(([, t]) => t.owner === me && pred(t)).map(([k]) => k);
  /* the lesson's tiles where the card chosen builds them: the hand rung
     until a card is chosen, the verb until it is Build */
  const sites = (inds: readonly string[], score: (t: BuildTarget, all: readonly BuildTarget[]) => number): Lens | null => {
    if (!card) return { hud: 'hand' };
    if (verb !== 'build') return { hud: 'build' };
    const all = buildTargets(g, me, card).filter((t) => t.valid && inds.includes(t.industry));
    return places(all, (t) => score(t, all));
  };
  switch (stepId) {
    case 'goal':
      return { hud: 'vp' };
    case 'mat':
    case 'matRead':
      return { hud: 'mat' };
    case 'hand':
      return { hud: 'hand' };
    case 'coal':
      /* a mine from which a canal leads to a town with a forge slot first */
      return sites(['coal'], (t) => forgesFrom(g, me, t.town).length);
    case 'iron':
      /* a forge whose coal comes off the board, not from the market */
      return sites(['iron'], (t) => (t.coalPlan.sources.some((x) => x.kind === 'market') ? 0 : 1) - t.total / 1000);
    case 'botTurn':
      return { hud: 'rail-bot' };
    case 'payday':
      return { hud: 'income' };
    case 'link':
      return card && verb === 'network' ? null : { hud: 'network' };
    case 'works':
      return sites(WORKS, () => 0);
    case 'market':
      return { hud: 'market' };
    case 'beer': {
      /* read as a sale is being chosen: the sale's own places stay lit */
      if (verb === 'sell') return null;
      const keys = Object.entries(g.tiles).filter(([, t]) => t.industry === 'brewery' && !t.flipped).map(([k]) => k);
      return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
    }
    case 'sell': {
      if (!card) return { hud: 'hand' };
      if (verb !== 'sell') return { hud: 'sell' };
      const keys = mine((t) => WORKS.includes(t.industry) && !t.flipped);
      return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
    }
    case 'flipped': {
      const keys = mine((t) => t.flipped);
      return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
    }
    case 'loan':
      return { hud: 'loan' };
    case 'develop':
      return { hud: 'develop' };
    default:
      return null;
  }
}

