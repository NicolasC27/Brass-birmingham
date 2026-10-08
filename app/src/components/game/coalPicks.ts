import { COSTS, INDUSTRIES } from '@/game/data';
import { coalChoices, planCoalFrom, tileKey } from '@/game/engine';
import type { BuildTarget, LinkTarget, SupplyPlan } from '@/game/engine';
import type { GameState, LinkDef } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The coal of a build or a rail link, a cube at a time. Among the     */
/* nearest connected mines the choice is the player's (§5.3): the one  */
/* about to run dry is often the one they want, since its owner's      */
/* income moves when it flips. The picker only shows when there is a   */
/* choice to make — two mines or more at the nearest distance.         */
/* ------------------------------------------------------------------ */

export type CoalChoice = ReturnType<typeof coalChoices>[number];

export interface CoalCube {
  /** the mines this cube may come from, once the cubes before it are drawn */
  choices: CoalChoice[];
  /** the mine it comes from as the table stands (named or the engine's own) */
  drawn: string | null;
}

/** each cube of a plan, by the tile it comes from, or 'market' */
function cubesOf(plan: SupplyPlan): string[] {
  const out: string[] = [];
  for (const src of plan.sources) {
    const key = src.kind === 'tile' ? tileKey(src.town!, src.slot!) : 'market';
    for (let i = 0; i < src.amount; i++) out.push(key);
  }
  return out;
}

function reservedBy(plan: SupplyPlan, into = new Map<string, number>()): Map<string, number> {
  for (const src of plan.sources) {
    const k = src.kind === 'tile' ? tileKey(src.town!, src.slot!) : `market:${src.resource}`;
    into.set(k, (into.get(k) ?? 0) + src.amount);
  }
  return into;
}

/** `needed` cubes for `town`, each with the mines it may come from; null
 *  when there is nothing to choose (no coal, or a single nearest mine) */
function cubesFor(g: GameState, town: string, needed: number, named: (string | null)[], extra: LinkDef[] = [], reserved: Map<string, number> = new Map()): CoalCube[] | null {
  if (needed <= 0 || coalChoices(g, town, extra, reserved).length < 2) return null;
  const drawn = cubesOf(planCoalFrom(g, town, needed, named, extra, reserved));
  const out: CoalCube[] = [];
  for (let k = 0; k < needed; k++) {
    const before = planCoalFrom(g, town, k, named.slice(0, k), extra, reserved);
    const choices = coalChoices(g, town, extra, reservedBy(before, new Map(reserved)));
    out.push({ choices, drawn: drawn[k] ?? null });
  }
  return out;
}

/** the coal cubes of a picked build, or null when no choice is to be made */
export function buildCoalCubes(g: GameState, pick: BuildTarget, named: (string | null)[]): CoalCube[] | null {
  if (!pick.valid) return null;
  const need = INDUSTRIES[pick.industry][pick.level - 1]?.coal ?? 0;
  return cubesFor(g, pick.town, need, named);
}

/** the cube of each rail link picked (0 the first, 1 the second), or null
 *  for a link with nothing to choose; the canal burns no coal */
export function linkCoalCubes(g: GameState, first: LinkTarget, second: LinkTarget | null, named: (string | null)[]): [CoalCube | null, CoalCube | null] {
  if (g.era !== 'rail') return [null, null];
  const one = cubesFor(g, first.link.a, COSTS.railCoal, [named[0] ?? null], [first.link])?.[0] ?? null;
  if (!second) return [one, null];
  /* the second link draws once the first has taken its cube */
  const taken = reservedBy(planCoalFrom(g, first.link.a, COSTS.railCoal, [named[0] ?? null], [first.link]));
  const two = cubesFor(g, second.link.a, COSTS.railCoal, [named[1] ?? null], [first.link, second.link], taken)?.[0] ?? null;
  return [one, two];
}
