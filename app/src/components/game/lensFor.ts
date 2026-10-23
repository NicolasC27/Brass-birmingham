import { buildTargets, tileKey } from '@/game/engine';
import type { Lens } from '@/game/store';
import type { GameState } from '@/game/types';
import type { LessonCtx } from './lessons';

/* ------------------------------------------------------------------ */
/* What each lesson of the guide lights on the table: the slots it is   */
/* about on the map, or the part of the HUD it names — and where the    */
/* camera should come. The board dims the rest; the halo rings the HUD  */
/* part. Computed from the state, so a lesson that says "build a mine"  */
/* lights the very places a mine may go right now.                      */
/* ------------------------------------------------------------------ */

const WORKS = new Set(['cotton', 'manufacturer', 'pottery']);

export function lensFor(stepId: string | null | undefined, c: LessonCtx): Lens | null {
  const { g, me } = c;
  if (!stepId || me < 0 || !g.players[me]) return null;
  const card = c.sel ? (g.players[me].hand.find((x) => x.id === c.sel) ?? null) : null;
  const verb = c.verb ?? null;
  const mine = (pred: (t: GameState['tiles'][string]) => boolean) => Object.entries(g.tiles).filter(([, t]) => t.owner === me && pred(t)).map(([k]) => k);
  const sites = (pred: (industry: string) => boolean): Lens | null => {
    if (!card) return { hud: 'hand' };
    if (verb !== 'build') return { hud: 'build' };
    const keys = [...new Set(buildTargets(g, me, card).filter((t) => t.valid && pred(t.industry)).map((t) => tileKey(t.town, t.slot)))];
    return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
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
      return sites((i) => i === 'coal');
    case 'iron':
      return sites((i) => i === 'iron');
    case 'botTurn':
      return { hud: 'rail-bot' };
    case 'payday':
      return { hud: 'income' };
    case 'link':
      return card && verb === 'network' ? null : { hud: 'network' };
    case 'works':
      return sites((i) => WORKS.has(i));
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
      const keys = mine((t) => WORKS.has(t.industry) && !t.flipped);
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

