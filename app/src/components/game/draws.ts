import { cloneState } from '@/game/clone';
import { COSTS, INDUSTRIES, MERCHANT_BY_ID, TOWN_BY_ID } from '@/game/data';
import { applySell, doubleLinkPlan, marketSaleOnBuild, planSaleBeer, tileKey, withCoal, withIron, withLinkCoal } from '@/game/engine';
import type { BeerSource, BuildTarget, LinkTarget, SellTarget, SupplyPlan } from '@/game/engine';
import { developPlans } from '@/game/store';
import type { GameState, IndustryType, Verb } from '@/game/types';
import { money } from '@/i18n';
import { tileMark } from './levelMark';

/* ------------------------------------------------------------------ */
/* The waybill of a move: what it draws from the table, cube by cube,   */
/* set in the banner as stamped tokens — the coal, the iron and the     */
/* beer, each from the siding it leaves: the reader's own works, a      */
/* rival's, the exchange, or a merchant's barrel. Read on the plan the  */
/* move will actually run, with the mines and works the reader named.   */
/* ------------------------------------------------------------------ */

export type DrawResource = 'coal' | 'iron' | 'beer';
export type DrawSource = 'own' | 'rival' | 'market' | 'merchant';

export interface Draw {
  resource: DrawResource;
  source: DrawSource;
  /** cubes or barrels drawn from this one siding */
  n: number;
  /** pounds paid to the exchange for them (market only) */
  cost: number;
  /** the seat that owns the works (own and rival) */
  owner?: number;
  town?: string;
  merchant?: string;
}

/** a new mine joined to a merchant, or any new iron works, sells on the
 *  spot what the market can take */
export interface DrawSale {
  resource: 'coal' | 'iron';
  n: number;
  gain: number;
}

/** the reader's picks, as the store holds them */
export interface DrawPicks {
  verb: Verb | null;
  selectedCardId?: string | null;
  buildPick: BuildTarget | null;
  buildIron?: string | null;
  buildCoal?: (string | null)[];
  linkPick: LinkTarget | null;
  secondLinkPick: LinkTarget | null;
  linkBeer?: string | null;
  linkCoal?: (string | null)[];
  sellPicks: SellTarget[];
  sellBeer?: Record<string, (string | null)[]>;
  developPick: IndustryType[];
  developIron: (string | null)[];
}

export interface Waybill {
  draws: Draw[];
  sale: DrawSale | null;
}

const ownerOf = (game: GameState, town: string, slot: number): number | undefined => game.tiles[tileKey(town, slot)]?.owner;

function fromSupply(game: GameState, actor: number, plan: SupplyPlan, out: Draw[]) {
  for (const src of plan.sources) {
    if (src.kind === 'market') out.push({ resource: src.resource, source: 'market', n: src.amount, cost: src.cost });
    else {
      const owner = ownerOf(game, src.town!, src.slot!);
      out.push({ resource: src.resource, source: owner === actor ? 'own' : 'rival', n: src.amount, cost: 0, owner, town: src.town });
    }
  }
}

function fromBeer(game: GameState, actor: number, sources: BeerSource[], out: Draw[]) {
  for (const b of sources) {
    if (b.kind === 'merchant') out.push({ resource: 'beer', source: 'merchant', n: 1, cost: 0, merchant: b.merchant });
    else {
      const owner = ownerOf(game, b.town!, b.slot!);
      out.push({ resource: 'beer', source: owner === actor ? 'own' : 'rival', n: 1, cost: 0, owner, town: b.town });
    }
  }
}

/** the same resource from the same siding is one token, however many
 *  cubes it gives; the order is the order the move draws them in */
export function mergeDraws(draws: Draw[]): Draw[] {
  const out: Draw[] = [];
  for (const d of draws) {
    const same = out.find((x) => x.resource === d.resource && x.source === d.source && x.owner === d.owner && x.town === d.town && x.merchant === d.merchant);
    if (same) {
      same.n += d.n;
      same.cost += d.cost;
    } else out.push({ ...d });
  }
  return out;
}

/** what the move the reader has set up will draw, token by token */
export function planDraws(game: GameState, actor: number, picks: DrawPicks): Waybill {
  const out: Draw[] = [];
  let sale: DrawSale | null = null;
  switch (picks.verb) {
    case 'build': {
      if (!picks.buildPick) break;
      const t = withIron(game, actor, withCoal(game, actor, picks.buildPick, picks.buildCoal), picks.buildIron);
      fromSupply(game, actor, t.coalPlan, out);
      fromSupply(game, actor, t.ironPlan, out);
      if (t.industry === 'coal' || t.industry === 'iron') {
        const s = marketSaleOnBuild(game, t.town, t.industry, t.level);
        if (s.sold) sale = { resource: t.industry, n: s.sold, gain: s.earned };
      }
      break;
    }
    case 'network': {
      if (!picks.linkPick) break;
      const first = withLinkCoal(game, actor, picks.linkPick, picks.linkCoal?.[0]);
      fromSupply(game, actor, first.coalPlan, out);
      if (picks.secondLinkPick) {
        const dbl = doubleLinkPlan(game, actor, first, picks.secondLinkPick.link, picks.linkBeer, picks.linkCoal?.[1]);
        fromSupply(game, actor, dbl.coal2, out);
        fromBeer(game, actor, dbl.beer, out);
      }
      break;
    }
    case 'develop':
      for (const plan of developPlans(game, picks.developIron.slice(0, picks.developPick.length))) fromSupply(game, actor, plan, out);
      break;
    case 'sell': {
      /* each tile drinks what the ones before it left: the sales are run,
         in order, on a copy of the table */
      const sales = picks.sellPicks.filter((x) => x.valid);
      if (!sales.length) break;
      const mut = cloneState(game);
      const card = mut.players[actor]?.hand.find((c) => c.id === picks.selectedCardId);
      for (const t of sales) {
        const key = tileKey(t.town, t.slot);
        const named = picks.sellBeer?.[key] ?? [];
        const need = INDUSTRIES[t.tile.industry][t.tile.level - 1]?.beerToSell ?? 0;
        const beer = planSaleBeer(mut, actor, t.town, t.merchant, t.tile.industry, need, named);
        fromBeer(mut, actor, beer.sources, out);
        if (card) applySell(mut, actor, card, [t], [named]);
      }
      break;
    }
    default:
      break;
  }
  return { draws: mergeDraws(out), sale };
}

/* ----------------------------- words ------------------------------ */

type Say = (key: string, vars?: Record<string, string | number>) => string;

const townName = (id: string | undefined) => (id ? (TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id) : '');

/** one token, as a sentence: "1 coal from Mr Watt's mine at Walsall" */
export function drawText(d: Draw, game: GameState, t: Say): string {
  const what = t(`game.bandeau.res.${d.resource}`, { n: d.n });
  const works = t(`game.bandeau.works.${d.resource}`);
  switch (d.source) {
    case 'own':
      return t('game.bandeau.own', { what, works, town: townName(d.town) });
    case 'rival':
      return t('game.bandeau.rival', { what, works, town: townName(d.town), owner: d.owner === undefined ? '' : (game.players[d.owner]?.name ?? '') });
    case 'market':
      return t('game.bandeau.market', { what, n: d.n, price: money(d.cost) });
    case 'merchant':
      return t('game.bandeau.merchant', { what, merchant: townName(d.merchant) });
  }
}

export function saleText(s: DrawSale, t: Say): string {
  return t('game.bandeau.sale', { what: t(`game.bandeau.res.${s.resource}`, { n: s.n }), gain: money(s.gain) });
}

/** the whole waybill, one sentence: the tokens joined as a list */
export function waybillText(w: Waybill, game: GameState, t: Say): string {
  return [...w.draws.map((d) => drawText(d, game, t)), ...(w.sale ? [saleText(w.sale, t)] : [])].join(', ');
}

/* ------------------------------ head ------------------------------ */

export interface Head {
  /** the works and the place, or the line and its ends */
  what: string;
  /** the price of the tile or of the line itself, before any cube */
  price: number | null;
  /** every sale named, when the head names only the first */
  full?: string;
}

/** the head of the banner's line once the move is ready: what is laid,
 *  and where — never the verb, which has its own chip, nor the cubes,
 *  which have their tokens */
export function moveHead(game: GameState, actor: number, picks: DrawPicks, t: Say): Head | null {
  switch (picks.verb) {
    case 'build': {
      const b = picks.buildPick;
      if (!b) return null;
      return { what: `${tileMark(t(`game.industry.${b.industry}`), b.level)} · ${townName(b.town)}`, price: INDUSTRIES[b.industry][b.level - 1]?.cost ?? b.cost };
    }
    case 'network': {
      const a = picks.linkPick;
      if (!a) return null;
      const s = picks.secondLinkPick;
      if (!s) return { what: `${townName(a.link.a)} ⇄ ${townName(a.link.b)}`, price: a.cost };
      /* two rails that share a town read as one line through it */
      const ends = [a.link.a, a.link.b];
      const shared = ends.find((x) => x === s.link.a || x === s.link.b);
      const what = shared
        ? `${townName(ends.find((x) => x !== shared))} ⇄ ${townName(shared)} ⇄ ${townName(s.link.a === shared ? s.link.b : s.link.a)}`
        : `${townName(a.link.a)} ⇄ ${townName(a.link.b)} + ${townName(s.link.a)} ⇄ ${townName(s.link.b)}`;
      return { what, price: COSTS.doubleRail };
    }
    case 'develop': {
      if (!picks.developPick.length) return null;
      const p = game.players[actor];
      const depth: Partial<Record<IndustryType, number>> = {};
      const list = picks.developPick.map((ind) => {
        const at = depth[ind] ?? 0;
        depth[ind] = at + 1;
        return tileMark(t(`game.industry.${ind}`), p?.stacks[ind][at] ?? 0);
      });
      return { what: list.join(' + '), price: null };
    }
    case 'sell': {
      const sales = picks.sellPicks.filter((x) => x.valid);
      if (!sales.length) return null;
      const one = (x: SellTarget) => `${tileMark(t(`game.industry.${x.tile.industry}`), x.tile.level)} → ${townName(x.merchant)}`;
      if (sales.length === 1) return { what: one(sales[0]), price: null };
      return { what: `${one(sales[0])} +${sales.length - 1}`, price: null, full: sales.map(one).join(' · ') };
    }
    default:
      return null;
  }
}
