/* Where the goods of a move being prepared come from. Once a card, an
   action and a place are chosen, and before the move is confirmed, the
   board draws an arrow from each mine, works, brewery or merchant's
   barrel that gives coal, iron or beer to the place it is burnt or
   drunk, and from the exchange's tray for the cubes bought there. The
   sources named in the hand (a mine, a works, a brewery, a barrel) are
   read here exactly as the move will be sent, so what the board shows is
   the move the office will receive. */

import { MERCHANT_BY_ID, TOWN_BY_ID } from '@/game/data';
import { doubleLinkPlan, tileKey, withCoal, withIron, withLinkCoal } from '@/game/engine';
import type { BeerSource, BuildTarget, LinkTarget, SellTarget, SupplyPlan } from '@/game/engine';
import { developPlans } from '@/game/store';
import type { GameState, IndustryType, LinkDef, Verb } from '@/game/types';
import { townChrome } from '@/components/game/townChrome';
import { routeFor } from '@/components/game/routePaths';
import { barrelAt } from './merchantRow';

export type Stuff = 'coal' | 'iron' | 'beer';

/** what the source of a thread is: a card on the board, or a barrel at
 *  a merchant's */
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

/** where the goods of a plan are spent: the point on the board, a card
 *  or the middle of a link being laid */
interface Dest {
  at: [number, number];
  onTile: boolean;
}

/** gather the cubes of one plan into threads, purchases and draws */
function lay(out: Provenance, plan: SupplyPlan, dest: Dest | null): void {
  for (const src of plan.sources) {
    if (src.kind === 'tile' && src.town !== undefined && src.slot !== undefined) {
      const key = tileKey(src.town, src.slot);
      const from = slotAt(key);
      if (!from) continue;
      if (dest) addThread(out, { resource: src.resource as Stuff, amount: src.amount, from, source: 'tile', key, to: dest.at, onTile: dest.onTile });
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

/** a brewery's beer, or a merchant's barrel, as a place on the board */
function beerFrom(src: BeerSource, merchant: string): { from: [number, number]; key: string; source: SourceKind } | null {
  if (src.kind === 'brewery' && src.town !== undefined && src.slot !== undefined) {
    const key = tileKey(src.town, src.slot);
    const from = slotAt(key);
    return from ? { from, key, source: 'tile' } : null;
  }
  const m = MERCHANT_BY_ID[src.merchant ?? merchant];
  if (!m || src.slot === undefined) return null;
  return { from: barrelAt(m, src.slot), key: `merchant:${m.id}:${src.slot}`, source: 'barrel' };
}

/** a barrel of beer drunk at `dest`: its thread */
function addBeer(out: Provenance, src: BeerSource, merchant: string, dest: Dest): void {
  const at = beerFrom(src, merchant);
  if (at) addThread(out, { resource: 'beer', amount: 1, ...at, to: dest.at, onTile: dest.onTile });
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
      const dest: Dest = { at: to, onTile: true };
      lay(out, t.coalPlan, dest);
      lay(out, t.ironPlan, dest);
    }
    return out;
  }

  if (st.verb === 'network') {
    const mid = (link: LinkDef): Dest => ({ at: routeFor(link, g.era).mid as [number, number], onTile: false });
    const first = st.linkPick?.valid ? withLinkCoal(g, actor, st.linkPick, st.linkCoal?.[0]) : null;
    /* the second of a double: the one picked, or a candidate under the pointer */
    const second = first ? (st.secondLinkPick ?? (st.hoverKey && st.hoverKey !== first.link.id ? offers.links.find((x) => x.valid && x.link.id === st.hoverKey) : undefined)) : undefined;
    if (first) {
      lay(out, first.coalPlan, mid(first.link));
      if (second && g.era === 'rail') {
        const dbl = doubleLinkPlan(g, actor, first, second.link, st.secondLinkPick ? st.linkBeer : null, st.secondLinkPick ? st.linkCoal?.[1] : null);
        const to = mid(second.link);
        lay(out, dbl.coal2, to);
        for (const b of dbl.beer) addBeer(out, b, '', to);
      }
      return out;
    }
    const hovered = st.hoverKey ? offers.links.find((x) => x.valid && x.link.id === st.hoverKey) : undefined;
    if (hovered) lay(out, hovered.coalPlan, mid(hovered.link));
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
      for (const b of saleBeer(t, st.sellBeer?.[key])) addBeer(out, b, t.merchant, { at: to, onTile: true });
    }
    return out;
  }

  if (st.verb === 'develop' && st.developPick.length) {
    /* the iron goes to the player's mat, off the board: its sources alone */
    for (const plan of developPlans(g, st.developIron)) lay(out, plan, null);
  }
  return out;
}
