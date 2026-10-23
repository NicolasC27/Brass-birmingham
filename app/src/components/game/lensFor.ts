import { LINKS, MERCHANTS } from '@/game/data';
import { buildTargets, linkTargets, merchantDemand, merchantOpen, reachable, sellTargets, tileKey } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import type { HudLens, Lens } from '@/game/store';
import type { GameState, IndustryType, LinkDef } from '@/game/types';
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
/** the refusal of a link out of the reader's reach: no network touches it */
const OUT_OF_REACH = 'Link must touch your network';

const townOf = (key: string): string => key.split(':')[0];
const unique = (keys: string[]): string[] => [...new Set(keys)];
const ends = (l: LinkDef): string[] => [l.a, l.b, ...(l.alsoConnects ? [l.alsoConnects] : [])];
const ofEra = (g: GameState, l: LinkDef): boolean => (g.era === 'canal' ? l.canal : l.rail);

/** the first of these by the score, the board's order breaking a tie */
function bestOf<X>(xs: readonly X[], score: (x: X) => number): X | undefined {
  let best: X | undefined;
  for (const x of xs) if (best === undefined || score(x) > score(best)) best = x;
  return best;
}

/** how many links still to lay, at the fewest, from each place of the map
 *  to a merchant who buys `industry`: a link laid, by anyone, costs
 *  nothing — a sale runs along any player's links — and a free one of
 *  the era costs one. A place no link can bring to a buyer is left out */
export function linksToBuyer(g: GameState, industry: IndustryType): Map<string, number> {
  const dist = new Map<string, number>();
  for (const m of MERCHANTS) if (merchantOpen(g, m.id) && merchantDemand(g, m.id).includes(industry)) dist.set(m.id, 0);
  const links = LINKS.filter((l) => ofEra(g, l)).map((l) => ({ ends: ends(l), cost: g.links[l.id] ? 0 : 1 }));
  /* a few dozen links: relaxed until nothing moves */
  for (let moved = true; moved; ) {
    moved = false;
    for (const l of links) {
      const near = Math.min(...l.ends.map((x) => dist.get(x) ?? Infinity));
      if (near === Infinity) continue;
      for (const x of l.ends) {
        if ((dist.get(x) ?? Infinity) > near + l.cost) {
          dist.set(x, near + l.cost);
          moved = true;
        }
      }
    }
  }
  return dist;
}

/** the links the reader could lay that bring a works of theirs, unsold
 *  and with no buyer at the end of the links laid, one link nearer to
 *  one: the missing canal, when a single one will do — the first of the
 *  way, when more are wanted. Only a link that touches the reader's
 *  network: another's is theirs to lay */
export function missingLinks(g: GameState, me: number): string[] {
  const layable = new Set(linkTargets(g, me).filter((x) => x.reason !== OUT_OF_REACH).map((x) => x.link.id));
  const out: string[] = [];
  for (const [key, tile] of Object.entries(g.tiles)) {
    if (tile.owner !== me || tile.flipped || !WORKS.includes(tile.industry)) continue;
    const dist = linksToBuyer(g, tile.industry);
    const town = townOf(key);
    const d = dist.get(town);
    if (d === undefined || d === 0) continue;
    const here = reachable(g, town, g.era, null);
    for (const l of LINKS) {
      if (!layable.has(l.id) || out.includes(l.id)) continue;
      const e = ends(l);
      if (e.some((x) => here.has(x)) && e.some((x) => !here.has(x) && dist.get(x) === d - 1)) out.push(l.id);
    }
  }
  return out;
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
  /* a move being chosen: its own places are lit, by the board */
  const choosing = !!card && !!verb;
  const mine = (pred: (t: GameState['tiles'][string]) => boolean) => Object.entries(g.tiles).filter(([, t]) => t.owner === me && pred(t)).map(([k]) => k);
  /* the lesson's tiles where the card chosen builds them: the hand rung
     until a card is chosen, the verb until it is Build */
  const sites = (inds: readonly string[], score: (t: BuildTarget, all: readonly BuildTarget[]) => number): Lens | null => {
    if (!card) return { hud: 'hand' };
    if (verb !== 'build') return { hud: 'build' };
    const all = buildTargets(g, me, card).filter((t) => t.valid && inds.includes(t.industry));
    return places(all, (t) => score(t, all));
  };
  /* a works where the links laid already run to its buyer — else where
     one more link would; the cheapest of them for the camera */
  const works = (): Lens | null => {
    const near = new Map<string, Map<string, number>>();
    const dist = (t: BuildTarget) => {
      if (!near.has(t.industry)) near.set(t.industry, linksToBuyer(g, t.industry));
      return near.get(t.industry)!.get(t.town) ?? Infinity;
    };
    let nearest: number | null = null;
    return sites(WORKS, (t, all) => {
      nearest ??= Math.min(...all.map(dist));
      return (dist(t) === nearest && nearest <= 1 ? 1 : 0) - t.total / 1000;
    });
  };
  /* the canal that is missing toward a buyer: Network rung, the canal lit */
  const toBuyer = (): Lens | null => {
    const links = missingLinks(g, me);
    if (!links.length) return null;
    if (choosing && verb !== 'network' && verb !== 'sell') return { hud: 'network' };
    const hud: HudLens | undefined = !card ? 'hand' : verb === 'network' ? undefined : 'network';
    return { links, at: links[0], ...(hud ? { hud } : {}) };
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
      return works();
    case 'market':
      return { hud: 'market' };
    case 'beer': {
      /* read as a sale is being chosen: the sale's own places stay lit */
      if (verb === 'sell') return null;
      const keys = Object.entries(g.tiles).filter(([, t]) => t.industry === 'brewery' && !t.flipped).map(([k]) => k);
      return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
    }
    case 'sell': {
      /* the works that will sell — never one that will not */
      const ok = unique(sellTargets(g, me).filter((x) => x.valid).map((x) => tileKey(x.town, x.slot)));
      if (!ok.length) return toBuyer() ?? (verb === 'sell' ? null : { hud: card ? 'sell' : 'hand' });
      if (verb && verb !== 'sell') return card ? { hud: 'sell' } : null;
      const hud: HudLens | undefined = !card ? 'hand' : verb ? undefined : 'sell';
      return { slots: ok, at: townOf(ok[0]), ...(hud ? { hud } : {}) };
    }
    case 'flipped': {
      const keys = mine((t) => t.flipped);
      return keys.length ? { slots: keys, at: keys[0].split(':')[0] } : null;
    }
    case 'reach':
      /* a works built where its buyer is linked, or the link to lay */
      return card && verb === 'build' ? works() : toBuyer();
    case 'loan':
      return { hud: 'loan' };
    case 'develop':
      return { hud: 'develop' };
    default:
      return null;
  }
}

