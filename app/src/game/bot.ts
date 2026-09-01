/* ------------------------------------------------------------------ */
/* BRASSWORKS — heuristic bots for the official economy. Not random:    */
/* they sell whenever beer allows, raise mines and works that pay cash  */
/* into the markets, only build goods a connected merchant will buy,    */
/* lay links toward merchants and coal, develop canal-only tiles away   */
/* in the Rail Era, and borrow once — never into a payday spiral.       */
/* ------------------------------------------------------------------ */

import { BOT_SKILL, INCOME_PAYOUT, INDUSTRIES, INDUSTRY_LABEL, LINKS, MARKET_MAX, MERCHANTS, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel, marketSellPrice } from './data';
import {
  buildTargets,
  canLoan,
  canScout,
  developOptions,
  isWild,
  linkTargets,
  merchantDemand,
  merchantOpen,
  networkTowns,
  reachable,
  sellTargets,
  townConnectedToPlayer,
} from './engine';
import type { BuildTarget, LinkTarget, SellTarget } from './engine';
import type { Card, GameState, IndustryType, PlayerState } from './types';

export interface BotMove {
  kind: 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout';
  card?: Card;
  build?: BuildTarget;
  link?: LinkTarget;
  develop?: IndustryType[];
  /** one card sells every queued tile */
  sell?: SellTarget[];
  scoutCards?: string[];
  /** human-readable reasoning, posted to the ledger flavor line */
  note: string;
}

const GOODS: IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

function skillOf(p: PlayerState) {
  return BOT_SKILL[p.difficulty] ?? BOT_SKILL.industrialist;
}

function jitter(p: PlayerState, rand: () => number) {
  return (rand() - 0.5) * 2 * skillOf(p).jitter;
}

/** crude PRNG per move so bots are deterministic-ish within a state */
function moveRand(s: GameState): () => number {
  let x = (s.seed ^ (s.ledgerSeq * 2654435761)) >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** cash a fresh mine/works would earn by selling its cubes into the market */
function marketCash(s: GameState, industry: IndustryType, cubes: number): { cash: number; sold: number } {
  if (industry !== 'coal' && industry !== 'iron') return { cash: 0, sold: 0 };
  let count = s.market[industry];
  let cash = 0;
  let sold = 0;
  while (sold < cubes && count < MARKET_MAX[industry]) {
    cash += marketSellPrice(industry, count);
    count += 1;
    sold += 1;
  }
  return { cash, sold };
}

const merchantLinked = (s: GameState, town: string): boolean => [...reachable(s, town, s.era, null)].some((n) => !!MERCHANT_BY_ID[n]);

/** is there an open merchant buying `industry` reachable from `town`? */
function served(s: GameState, town: string, industry: IndustryType): boolean {
  const reach = reachable(s, town, s.era, null);
  return MERCHANTS.some((m) => merchantOpen(s, m.id) && reach.has(m.id) && merchantDemand(s, m.id).includes(industry));
}

/** an open merchant buying `industry` one unbuilt link away from what `town` reaches */
function nearlyServed(s: GameState, town: string, industry: IndustryType): boolean {
  const reach = reachable(s, town, s.era, null);
  return LINKS.some((d) => {
    if (s.links[d.id] || !(s.era === 'canal' ? d.canal : d.rail)) return false;
    const [m, other] = MERCHANT_BY_ID[d.a] ? [d.a, d.b] : MERCHANT_BY_ID[d.b] ? [d.b, d.a] : [null, null];
    return !!m && reach.has(other!) && merchantOpen(s, m) && merchantDemand(s, m).includes(industry);
  });
}

/** own tiles with income on the way: goods a merchant will buy, works nearly drained */
function flipsPending(s: GameState, i: number): number {
  return Object.entries(s.tiles).filter(([key, x]) => {
    if (x.owner !== i || x.flipped) return false;
    if (INDUSTRIES[x.industry][x.level - 1].beerToSell > 0) return served(s, key.split(':')[0], x.industry);
    return x.industry === 'iron' && x.cubes <= 2;
  }).length;
}

/** can any open merchant be reached from the player's network? */
function merchantAccess(s: GameState, i: number): boolean {
  const nt = networkTowns(s, i);
  return [...nt].some((n) => [...reachable(s, n, s.era, null)].some((x) => merchantOpen(s, x)));
}

/** link icons a Link tile at `node` would score right now */
function iconsAt(s: GameState, node: string): number {
  if (MERCHANT_BY_ID[node]) return 2;
  let n = 0;
  for (const [key, t] of Object.entries(s.tiles)) if (key.split(':')[0] === node) n += INDUSTRIES[t.industry][t.level - 1].links;
  return n;
}

/** the card we can best spare: fewest build uses, wilds last */
function spareCard(s: GameState, i: number, hand: Card[]): Card | undefined {
  let best: { card: Card; v: number } | null = null;
  for (const card of hand) {
    const uses = buildTargets(s, i, card).filter((t) => t.valid).length;
    const v = uses + (isWild(card) ? 100 : 0);
    if (!best || v < best.v) best = { card, v };
  }
  return best?.card;
}

function scoreBuild(s: GameState, i: number, t: BuildTarget, rand: () => number): number {
  const p = s.players[i];
  const sk = skillOf(p);
  const lv = INDUSTRIES[t.industry][t.level - 1];
  const goods = lv.beerToSell > 0;
  let v = 0;
  let cash = 0;
  v += lv.incomeDelta * 2.5; // spaces on the progress track, paid every round once flipped
  v += lv.vp * 1.2;

  if (t.industry === 'coal' || t.industry === 'iron') {
    // cash straight from the market — the Canal Era's real income
    const est = t.industry === 'iron' || merchantLinked(s, t.town) ? marketCash(s, t.industry, lv.cubes) : { cash: 0, sold: 0 };
    cash = est.cash;
    const sold = est.sold;
    v += cash * 1.3;
    if (sold > 0 && sold === lv.cubes) v += 4; // a full sell-out flips it at once
    // scarcity: everyone will drink from this — but a mine nobody draws on never flips
    if (t.industry === 'coal') {
      const onBoard = Object.values(s.tiles).filter((x) => x.industry === 'coal' && !x.flipped && x.cubes > 0).length;
      v += s.market.coal <= 5 ? 6 : s.market.coal <= 9 ? 2 : 0;
      if (sold === 0 && onBoard >= 2) v -= 9;
    }
    if (t.industry === 'iron') v += s.market.iron <= 4 ? 5 : s.market.iron <= 7 ? 2 : 0;
  }
  if (t.industry === 'brewery') {
    const thirsty = Object.values(s.tiles).filter((x) => x.owner === i && !x.flipped && INDUSTRIES[x.industry][x.level - 1].beerToSell > 0).length;
    const hasBeer = Object.values(s.tiles).some((x) => x.owner === i && x.industry === 'brewery' && !x.flipped && x.cubes > 0);
    v += thirsty * 5 + (hasBeer ? -6 : 2) + 2 * lv.links;
  }
  if (goods) {
    // goods need a buyer: connected now, or one canal link away (we lay it next)
    if (served(s, t.town, t.industry)) v += 8 * sk.sellUrgency;
    else if (nearlyServed(s, t.town, t.industry) && p.money - t.total >= 3) v += 2 * sk.sellUrgency;
    else return -Infinity;
    const beerAround = Object.values(s.tiles).some((x) => x.industry === 'brewery' && !x.flipped && x.cubes > 0) || Object.values(s.merchantBeer).some((b) => b > 0);
    v += beerAround ? 3 : -4;
    if (lv.beerToSell >= 2) v -= 3;
  }
  // link icons feed every neighbouring link at scoring
  v += lv.links * 1.5;
  // canal-only tiles vanish at the sweep: only worth it if they flip this era
  if (s.era === 'canal' && !lv.eras.includes('rail')) v -= 2;
  // consuming our OWN cubes walks our mines/works toward their flip
  for (const src of [...t.coalPlan.sources, ...t.ironPlan.sources]) {
    if (src.kind !== 'tile') continue;
    const tile = s.tiles[`${src.town}:${src.slot}`];
    if (tile?.owner === i) v += 2.5 * src.amount + (tile.cubes <= src.amount ? 4 : 0);
  }
  // money: keep the next negative payday covered, plus £3 for a canal link
  const reserve = Math.max(0, -INCOME_PAYOUT[p.income]) + 3;
  v -= t.total * 0.45 * (sk.supplyPenalty / 5);
  if (p.money - t.total < reserve) v -= cash > 0 ? 3 : 9;
  v -= (t.coalPlan.totalCost + t.ironPlan.totalCost) * 0.3;
  if (townConnectedToPlayer(s, i, t.town)) v += 1.5 * sk.networkBias;
  return v + jitter(p, rand);
}

function scoreLink(s: GameState, i: number, t: LinkTarget, rand: () => number): number {
  const p = s.players[i];
  const sk = skillOf(p);
  const nt = networkTowns(s, i);
  const unsold = Object.entries(s.tiles).filter(([, x]) => x.owner === i && !x.flipped && INDUSTRIES[x.industry][x.level - 1].beerToSell > 0);
  let v = 0;
  for (const node of [t.link.a, t.link.b]) {
    v += iconsAt(s, node) * 1.6; // guaranteed VP at scoring
    const merch = MERCHANT_BY_ID[node];
    if (merch && merchantOpen(s, merch.id)) {
      // does this open a market for goods we hold?
      const demand = merchantDemand(s, merch.id);
      const opens = unsold.some(([key, x]) => demand.includes(x.industry) && !reachable(s, key.split(':')[0], s.era, null).has(merch.id));
      const first = !MERCHANTS.some((m) => merchantOpen(s, m.id) && [...nt].some((n) => reachable(s, n, s.era, null).has(m.id)));
      v += opens ? 9 * sk.sellUrgency : first ? 6 : 2;
    }
    const town = TOWN_BY_ID[node];
    if (town && !nt.has(node)) {
      v += 1.5 * sk.networkBias;
      const mineThere = Object.entries(s.tiles).some(([k, x]) => !x.flipped && x.cubes > 0 && (x.industry === 'coal' || x.industry === 'iron') && k.split(':')[0] === node);
      if (mineThere) v += 3;
    }
  }
  v -= t.total * 0.5;
  if (p.money - t.total < Math.max(0, -INCOME_PAYOUT[p.income])) v -= 5;
  if (nt.size === 0) v += 3;
  return v + jitter(p, rand);
}

/** choose the bot's next action. Returns null only when a pass is all that's left. */
export function chooseBotMove(s: GameState, i: number): BotMove | null {
  const p = s.players[i];
  const rand = moveRand(s);
  const sk = skillOf(p);
  const lvl = incomeLevel(p.income);
  if (!p.hand.length) return null;

  /* 1 — sell everything that can be sold: one card, every tile, best merchant each */
  const sells = sellTargets(s, i).filter((t) => t.valid);
  if (sells.length) {
    const byTile = new Map<string, SellTarget>();
    const bonus = (x: SellTarget) => (x.beer.some((b) => b.kind === 'merchant') ? 1 : 0);
    for (const t of sells) {
      const key = `${t.town}:${t.slot}`;
      const cur = byTile.get(key);
      if (!cur || bonus(t) > bonus(cur)) byTile.set(key, t);
    }
    const picks = [...byTile.values()];
    return { kind: 'sell', card: spareCard(s, i, p.hand)!, sell: picks, note: `${p.name} ships goods to ${MERCHANT_BY_ID[picks[0].merchant].name}` };
  }

  /* 2 — no road to a market yet? the first link toward an open merchant comes before anything else */
  if (!merchantAccess(s, i) && p.money >= 3) {
    const toMerchant = linkTargets(s, i).filter((t) => t.valid && [t.link.a, t.link.b].some((n) => merchantOpen(s, n)));
    if (toMerchant.length) {
      const best = toMerchant.sort((a, b) => scoreLink(s, i, b, rand) - scoreLink(s, i, a, rand))[0];
      return { kind: 'network', card: spareCard(s, i, p.hand)!, link: best, note: `${p.name} opens a road to ${MERCHANT_BY_ID[merchantOpen(s, best.link.a) ? best.link.a : best.link.b].name}` };
    }
  }

  /* 2b — Rail Era: canal-only tiles block the mat — develop them away (1 iron each) */
  if (s.era === 'rail') {
    const stale = developOptions(s, i).filter((d) => d.valid && !INDUSTRIES[d.industry][d.level - 1].eras.includes('rail'));
    if (stale.length) {
      const pick = stale.slice(0, 2);
      const cost = pick.reduce((a, d) => a + d.iron.totalCost, 0);
      if (cost <= p.money) return { kind: 'develop', card: spareCard(s, i, p.hand)!, develop: pick.map((d) => d.industry), note: `${p.name} retools for the age of steam` };
    }
  }

  /* 3 — best build among cards in hand */
  let bestBuild: { card: Card; t: BuildTarget; v: number } | null = null;
  for (const card of p.hand) {
    for (const t of buildTargets(s, i, card)) {
      if (!t.valid) continue;
      const v = scoreBuild(s, i, t, rand) - (isWild(card) ? 3 : 0);
      if (v === -Infinity) continue;
      if (!bestBuild || v > bestBuild.v) bestBuild = { card, t, v };
    }
  }

  /* 4 — network extension */
  let bestLink: { t: LinkTarget; v: number } | null = null;
  for (const t of linkTargets(s, i)) {
    if (!t.valid) continue;
    const v = scoreLink(s, i, t, rand);
    if (!bestLink || v > bestLink.v) bestLink = { t, v };
  }

  const buildScore = bestBuild?.v ?? -Infinity;
  const linkScore = bestLink?.v ?? -Infinity;
  const buildMove = (): BotMove => ({ kind: 'build', card: bestBuild!.card, build: bestBuild!.t, note: `${p.name} raises a ${INDUSTRY_LABEL[bestBuild!.t.industry]} in ${TOWN_BY_ID[bestBuild!.t.town].name}` });
  if (bestBuild && buildScore >= linkScore && buildScore > 0) return buildMove();
  if (bestLink && linkScore > 0) {
    return { kind: 'network', card: spareCard(s, i, p.hand)!, link: bestLink.t, note: `${p.name} extends the network` };
  }

  /* 5 — loan: £30 for 3 income levels. Two early loans are the classic
     canal opening (flips climb back fast); later only down to level −3,
     and never while sitting on cash */
  const floor = s.era === 'canal' && s.round <= 4 && flipsPending(s, i) >= 2 ? -6 : -3;
  const opening = s.era === 'canal' && s.round <= 2 && p.loans === 0;
  if (canLoan(s, i).ok && lvl - 3 >= floor && (p.money < 8 || (opening && p.money < 20))) {
    return { kind: 'loan', note: `${p.name} visits the moneylenders` };
  }

  /* 6 — anything positive-ish beats passing (passing still burns a card) */
  if (bestBuild && buildScore > -6) return buildMove();
  if (bestLink) {
    return { kind: 'network', card: spareCard(s, i, p.hand)!, link: bestLink.t, note: `${p.name} lays a quiet stretch of line` };
  }

  /* 7 — develop toward better tiles when iron is cheap */
  const devs = developOptions(s, i).filter((d) => d.valid && d.iron.totalCost <= Math.max(0, p.money - 4));
  if (devs.length) {
    const pick = devs.find((d) => GOODS.includes(d.industry)) ?? devs[0];
    return { kind: 'develop', card: spareCard(s, i, p.hand)!, develop: [pick.industry], note: `${p.name} retools the works` };
  }

  /* 8 — scout to cycle a dead hand (never while holding a wild card) */
  if (canScout(s, i).ok && p.hand.length >= 3 + (sk.jitter > 3 ? 0 : 1)) {
    const uses = (c: Card) => buildTargets(s, i, c).filter((t) => t.valid).length;
    const discards = [...p.hand].sort((a, b) => uses(a) - uses(b)).slice(0, 3);
    return { kind: 'scout', scoutCards: discards.map((c) => c.id), note: `${p.name} sends scouts upcountry` };
  }
  return null;
}
