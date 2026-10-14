/* Where the goods of a move being prepared come from. Once a card, an
   action and a place are chosen, and before the move is confirmed, the
   board shows each cube of coal, iron or beer at the mine, the works, the
   brewery or the merchant's barrel that gives it, and the bill of the
   move at the place it is burnt or drunk. Coal, and beer where a way
   exists, travel by the canals and railways: their thread carries the
   route they take over the links already laid, town by town, so the
   board can run the goods along it. Iron asks no connection and has no
   route: its works alone is marked. The cubes bought at the exchange are
   priced on the bill. The sources named in the hand (a mine, a works, a
   brewery, a barrel) are read here exactly as the move will be sent, so
   what the board shows is the move the office will receive. */

import { LINKS, MERCHANT_BY_ID, NODE_POS, TOWN_BY_ID } from '@/game/data';
import { doubleLinkPlan, tileKey, withCoal, withIron, withLinkCoal } from '@/game/engine';
import type { BeerSource, BuildTarget, LinkTarget, SellTarget, SupplyPlan } from '@/game/engine';
import { developPlans } from '@/game/store';
import type { Era, GameState, IndustryType, LinkDef, Verb } from '@/game/types';
import { townChrome } from '@/components/game/townChrome';
import { routeFor } from '@/components/game/routePaths';
import { barrelAt } from './merchantRow';

export type Stuff = 'coal' | 'iron' | 'beer';

/** what the source of a thread is, which sets how far short of it the
 *  thread starts: a card on the board, or a barrel at a merchant's */
export type SourceKind = 'tile' | 'barrel';

/** cubes carried from a place on the board to the place they are spent,
 *  both in the board's display units */
export interface Thread {
  resource: Stuff;
  amount: number;
  from: [number, number];
  source: SourceKind;
  /** the source's own key (a slot, or `merchant:<id>:<barrel>`) */
  key: string;
  to: [number, number];
  /** the place it lands on is a card (a slot) rather than the middle of a route */
  onTile: boolean;
  /** the way the goods travel, from the source to the place, over the
   *  links already laid (and those the move lays); null when they do not
   *  travel on the map — iron, or beer from a brewery no link reaches */
  route: [number, number][] | null;
}

/** cubes bought at the exchange for a place on the board */
export interface Purchase {
  resource: 'coal' | 'iron';
  amount: number;
  cost: number;
  to: [number, number];
  onTile: boolean;
}

/** cubes taken from a works for a move with no place on the board (a
 *  development takes its iron to the player's mat): the source alone */
export interface Draw {
  resource: Stuff;
  amount: number;
  at: [number, number];
  key: string;
}

export interface Provenance {
  threads: Thread[];
  market: Purchase[];
  draws: Draw[];
}

/** the part of the table's selection a provenance is read from */
export interface PlanPicks {
  verb: Verb | null;
  buildPick: BuildTarget | null;
  buildCoal?: (string | null)[];
  buildIron?: string | null;
  linkPick: LinkTarget | null;
  secondLinkPick: LinkTarget | null;
  linkCoal?: (string | null)[];
  linkBeer?: string | null;
  sellPicks: SellTarget[];
  sellBeer?: Record<string, (string | null)[]>;
  developPick: IndustryType[];
  developIron: (string | null)[];
  hoverKey: string | null;
}

/** the candidates on offer, for the one under the pointer */
export interface PlanOffers {
  targets: readonly BuildTarget[];
  links: readonly LinkTarget[];
  sales: readonly SellTarget[];
}

export const EMPTY_PROVENANCE: Provenance = { threads: [], market: [], draws: [] };

/** a slot's card on the board, where it is drawn */
export function slotAt(key: string): [number, number] | null {
  const [town, slot] = key.split(':');
  const def = TOWN_BY_ID[town];
  const pos = def ? townChrome(def).slots[Number(slot)] : undefined;
  return pos ? [pos.x, pos.y] : null;
}

/** where the goods of a plan are spent: the point on the board, and what
 *  a route to it must reach — a town (a card's), or either end of a link
 *  being laid (the route then runs on along it to its middle); `extra`
 *  are the links the move lays before these goods are drunk */
export interface Dest {
  at: [number, number];
  onTile: boolean;
  town?: string;
  link?: LinkDef;
  extra?: LinkDef[];
}

/** the links laid in `era`, as a node's neighbours: the link that joins
 *  them, for each (the Kidderminster–Worcester canal also reaches the
 *  farm brewery from either end, as the engine counts it) */
function laidAdjacency(g: GameState, era: Era, extra: LinkDef[]): Map<string, { to: string; def: LinkDef }[]> {
  const adj = new Map<string, { to: string; def: LinkDef }[]>();
  const add = (a: string, b: string, def: LinkDef) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, def });
  };
  const join = (def: LinkDef) => {
    add(def.a, def.b, def);
    add(def.b, def.a, def);
    if (def.alsoConnects) {
      for (const end of [def.a, def.b]) {
        add(end, def.alsoConnects, def);
        add(def.alsoConnects, end, def);
      }
    }
  };
  for (const def of LINKS) if (g.links[def.id] && (era === 'canal' ? def.canal : def.rail)) join(def);
  for (const def of extra) join(def);
  return adj;
}

/** the shortest way over laid links from node `from` to any of `ends`:
 *  the nodes passed and the link taken to each; null when none leads there */
export function wayBetween(g: GameState, from: string, ends: readonly string[], extra: LinkDef[] = []): { nodes: string[]; links: LinkDef[] } | null {
  if (ends.includes(from)) return { nodes: [from], links: [] };
  const adj = laidAdjacency(g, g.era, extra);
  const back = new Map<string, { prev: string; def: LinkDef }>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift()!;
    for (const { to, def } of adj.get(n) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      back.set(to, { prev: n, def });
      if (ends.includes(to)) {
        const nodes = [to];
        const links: LinkDef[] = [];
        for (let at = to; at !== from; ) {
          const step = back.get(at)!;
          links.unshift(step.def);
          nodes.unshift(step.prev);
          at = step.prev;
        }
        return { nodes, links };
      }
      queue.push(to);
    }
  }
  return null;
}

/** a link's drawn route, run from node `a` toward node `b` */
function leg(def: LinkDef, a: string, b: string, era: Era): [number, number][] {
  const pa = NODE_POS[a];
  const pb = NODE_POS[b];
  /* a step to or from the farm brewery a canal only passes near */
  if (a !== def.a && a !== def.b) return pa && pb ? [pa, pb] : [];
  if (b !== def.a && b !== def.b) return pa && pb ? [pa, pb] : [];
  const pts = routeFor(def, era).pts;
  return a === def.a ? [...pts] : [...pts].reverse();
}

/** the drawn way from a source (its node, and the point it is drawn at)
 *  to a destination, over laid links; null when no way leads there */
export function routeTo(g: GameState, node: string, from: [number, number], dest: Dest): [number, number][] | null {
  const ends = dest.link ? [dest.link.a, dest.link.b] : dest.town ? [dest.town] : [];
  if (!ends.length) return null;
  const way = wayBetween(g, node, ends, dest.extra ?? []);
  if (!way) return null;
  const pts: [number, number][] = [from];
  way.links.forEach((def, i) => pts.push(...leg(def, way.nodes[i], way.nodes[i + 1], g.era)));
  if (dest.link) {
    /* on along the link being laid, from the end reached to its middle */
    const end = way.nodes[way.nodes.length - 1];
    const along = leg(dest.link, end, end === dest.link.a ? dest.link.b : dest.link.a, g.era);
    pts.push(...along.slice(0, Math.ceil(along.length / 2)));
  }
  pts.push(dest.at);
  return pts;
}

/** gather the cubes of one plan into threads, purchases and draws */
function lay(g: GameState, out: Provenance, plan: SupplyPlan, dest: Dest | null): void {
  for (const src of plan.sources) {
    if (src.kind === 'tile' && src.town !== undefined && src.slot !== undefined) {
      const key = tileKey(src.town, src.slot);
      const from = slotAt(key);
      if (!from) continue;
      /* coal goes by the network; iron is fetched from anywhere */
      const route = dest && src.resource === 'coal' ? routeTo(g, src.town, from, dest) : null;
      if (dest) addThread(out, { resource: src.resource as Stuff, amount: src.amount, from, source: 'tile', key, to: dest.at, onTile: dest.onTile, route });
      else addDraw(out, { resource: src.resource as Stuff, amount: src.amount, at: from, key });
    } else if (src.kind === 'market' && dest && (src.resource === 'coal' || src.resource === 'iron')) {
      const to = dest.at;
      const same = out.market.find((m) => m.resource === src.resource && m.to[0] === to[0] && m.to[1] === to[1]);
      if (same) {
        same.amount += src.amount;
        same.cost += src.cost;
      } else out.market.push({ resource: src.resource, amount: src.amount, cost: src.cost, to, onTile: dest.onTile });
    }
  }
}

/** the count engraved on each thread's source: a source feeding several
 *  places (a mine giving a cube to each rail of a double) carries one plate
 *  with its whole draw, on its first thread; the others carry none (null) */
export function sourceCounts(threads: readonly Thread[]): (number | null)[] {
  const total = new Map<string, number>();
  for (const t of threads) total.set(`${t.key}|${t.resource}`, (total.get(`${t.key}|${t.resource}`) ?? 0) + t.amount);
  const told = new Set<string>();
  return threads.map((t) => {
    const k = `${t.key}|${t.resource}`;
    if (told.has(k)) return null;
    told.add(k);
    return total.get(k) ?? t.amount;
  });
}

function addThread(out: Provenance, t: Thread): void {
  const same = out.threads.find((x) => x.key === t.key && x.resource === t.resource && x.to[0] === t.to[0] && x.to[1] === t.to[1]);
  if (same) same.amount += t.amount;
  else out.threads.push({ ...t });
}

function addDraw(out: Provenance, d: Draw): void {
  const same = out.draws.find((x) => x.key === d.key && x.resource === d.resource);
  if (same) same.amount += d.amount;
  else out.draws.push({ ...d });
}

/** a brewery's beer, or a merchant's barrel, as a place on the board,
 *  and the node the barrel is rolled from */
function beerFrom(src: BeerSource, merchant: string): { from: [number, number]; key: string; source: SourceKind; node: string } | null {
  if (src.kind === 'brewery' && src.town !== undefined && src.slot !== undefined) {
    const key = tileKey(src.town, src.slot);
    const from = slotAt(key);
    return from ? { from, key, source: 'tile', node: src.town } : null;
  }
  const m = MERCHANT_BY_ID[src.merchant ?? merchant];
  if (!m || src.slot === undefined) return null;
  return { from: barrelAt(m, src.slot), key: `merchant:${m.id}:${src.slot}`, source: 'barrel', node: m.id };
}

/** a barrel of beer drunk at `dest`: its thread, on the way to it where one
 *  exists (a merchant's always, since a sale needs the merchant reached) */
function addBeer(g: GameState, out: Provenance, src: BeerSource, merchant: string, dest: Dest): void {
  const at = beerFrom(src, merchant);
  if (!at) return;
  const { node, ...rest } = at;
  addThread(out, { resource: 'beer', amount: 1, ...rest, to: dest.at, onTile: dest.onTile, route: routeTo(g, node, at.from, dest) });
}

/** a sale's beer as the move will send it: each barrel it needs, from the
 *  source named in the hand (`merchant:<barrel>` or a brewery's slot), or
 *  the engine's own choice where none is named */
export function saleBeer(t: SellTarget, named: (string | null)[] = []): BeerSource[] {
  return t.beer.map((dflt, k) => {
    const name = named[k];
    if (!name) return dflt;
    const [head, tail] = name.split(':');
    if (head === 'merchant') return { kind: 'merchant', merchant: t.merchant, slot: Number(tail) };
    return { kind: 'brewery', town: head, slot: Number(tail) };
  });
}

/** every thread, purchase and draw of the move being prepared on `g` by
 *  `actor`: the picks made, or the candidate under the pointer */
export function provenance(g: GameState, actor: number, st: PlanPicks, offers: PlanOffers): Provenance {
  const out: Provenance = { threads: [], market: [], draws: [] };
  if (actor < 0 || !g.players[actor]) return out;

  if (st.verb === 'build') {
    let t: BuildTarget | null | undefined = null;
    if (st.buildPick?.valid) t = withIron(g, actor, withCoal(g, actor, st.buildPick, st.buildCoal), st.buildIron);
    else if (st.hoverKey) t = offers.targets.find((x) => x.valid && tileKey(x.town, x.slot) === st.hoverKey);
    const to = t ? slotAt(tileKey(t.town, t.slot)) : null;
    if (t && to) {
      const dest: Dest = { at: to, onTile: true, town: t.town };
      lay(g, out, t.coalPlan, dest);
      lay(g, out, t.ironPlan, dest);
    }
    return out;
  }

  if (st.verb === 'network') {
    const mid = (link: LinkDef, extra: LinkDef[] = []): Dest => ({ at: routeFor(link, g.era).mid as [number, number], onTile: false, link, extra });
    const first = st.linkPick?.valid ? withLinkCoal(g, actor, st.linkPick, st.linkCoal?.[0]) : null;
    /* the second of a double: the one picked, or a candidate under the pointer */
    const second = first ? (st.secondLinkPick ?? (st.hoverKey && st.hoverKey !== first.link.id ? offers.links.find((x) => x.valid && x.link.id === st.hoverKey) : undefined)) : undefined;
    if (first) {
      lay(g, out, first.coalPlan, mid(first.link));
      if (second && g.era === 'rail') {
        const dbl = doubleLinkPlan(g, actor, first, second.link, st.secondLinkPick ? st.linkBeer : null, st.secondLinkPick ? st.linkCoal?.[1] : null);
        /* the second rail is fed over the first, laid a moment before */
        const to = mid(second.link, [first.link]);
        lay(g, out, dbl.coal2, to);
        for (const b of dbl.beer) addBeer(g, out, b, '', to);
      }
      return out;
    }
    const hovered = st.hoverKey ? offers.links.find((x) => x.valid && x.link.id === st.hoverKey) : undefined;
    if (hovered) lay(g, out, hovered.coalPlan, mid(hovered.link));
    return out;
  }

  if (st.verb === 'sell') {
    const picks = [...st.sellPicks];
    const hovered = st.hoverKey && !picks.some((x) => tileKey(x.town, x.slot) === st.hoverKey) ? offers.sales.find((x) => x.valid && tileKey(x.town, x.slot) === st.hoverKey) : undefined;
    if (hovered) picks.push(hovered);
    for (const t of picks) {
      const key = tileKey(t.town, t.slot);
      const to = slotAt(key);
      if (!to) continue;
      for (const b of saleBeer(t, st.sellBeer?.[key])) addBeer(g, out, b, t.merchant, { at: to, onTile: true, town: t.town });
    }
    return out;
  }

  if (st.verb === 'develop' && st.developPick.length) {
    /* the iron goes to the player's mat, off the board: its sources alone */
    for (const plan of developPlans(g, st.developIron)) lay(g, out, plan, null);
  }
  return out;
}
