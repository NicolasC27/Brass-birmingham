/* Supply ghost-line geometry: where coal/iron would come from when a build
   or rail is being planned (game.md §7.3 — supply visibility). */

import { TOWNS } from './data';
import type { SupplyPlan } from './engine';

export interface PlanGhost {
  /** board-space endpoints for tile sources */
  tileSources: { x: number; y: number; resource: string; amount: number }[];
  /** cubes drawn from the market */
  market: { resource: string; amount: number; cost: number }[];
  /** target slot */
  at: [number, number];
}

export function ghostFromPlan(at: [number, number], ...plans: SupplyPlan[]): PlanGhost {
  const g: PlanGhost = { tileSources: [], market: [], at };
  for (const plan of plans) {
    for (const src of plan.sources) {
      if (src.kind === 'tile') {
        const town = TOWNS.find((t) => t.id === src.town);
        const sp = town?.slots[src.slot!];
        if (sp) g.tileSources.push({ x: sp.x, y: sp.y, resource: src.resource, amount: src.amount });
      } else {
        const m = g.market.find((x) => x.resource === src.resource);
        if (m) {
          m.amount += 1;
          m.cost += src.cost;
        } else {
          g.market.push({ resource: src.resource, amount: 1, cost: src.cost });
        }
      }
    }
  }
  return g;
}
