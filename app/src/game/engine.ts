/* ------------------------------------------------------------------ */
/* BLACKRAIL — pure game engine. No React, no side effects beyond     */
/* the values it returns. Zustand store wraps these reducers.          */
/*                                                                      */
/* Rules follow the official Brass: Birmingham rulebook as compiled in  */
/* brass/game-data.md. Remaining approximations (all UI-side choices,   */
/* not rule changes) are marked APPROX below.                           */
/* ------------------------------------------------------------------ */

import {
  COSTS,
  HAND_SIZE,
  INCOME_MAX,
  INCOME_PAYOUT,
  INDUSTRIES,
  INDUSTRIES_IN_ORDER,
  INDUSTRY_LABEL,
  LINKS,
  LOAN_AMOUNT,
  MARKET_MAX,
  MERCHANTS,
  MERCHANT_BY_ID,
  MERCHANT_TILE_POOL,
  PLAYER_COLORS,
  START_INCOME_SPACE,
  START_MONEY,
  TOWNS,
  TOWN_BY_ID,
  WILD_CARDS_EACH,
  breweryBarrels,
  buildDeck,
  eraRounds,
  freshStacks,
  incomeLevel,
  loanLanding,
  marketBuyPrice,
  marketSellPrice,
  merchantTileBuys,
  rng,
  shuffle,
  startMarket,
  personaFor,
  setBoard,
  activeBoard,
} from './data';
import { cloneState } from './clone';
import type {
  Card,
  Era,
  GameState,
  IndustryType,
  LedgerEntry,
  LinkDef,
  MerchantTile,
  PlayerState,
  Resource,
  SetupPayload,
  TileState,
} from './types';

export const ENGINE_VERSION = 6;
export { eraRounds };

/** the edition of the rules this engine plays. Edition 1 burnt a card per
 *  seat again at the rail deal and let a sale go through on the tiles its
 *  beer reached; a log written under it still replays under it, and every
 *  game dealt from now on is played under this one */
export const RULES_EDITION = 2;

/** the game was dealt under the first edition: the rail deal burns a card,
 *  and a sale short of beer sells what it can */
const firstEdition = (s: GameState): boolean => (s.rules ?? RULES_EDITION) < 2;

/* ============================ setup ================================ */

export function defaultSetup(): SetupPayload {
  return {
    players: [
      { name: 'You', color: 'brass', type: 'human' },
      { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
      { name: 'Miss Arkwright', color: 'verdigris', type: 'bot', persona: 'arkwright' },
    ],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
}

/** deal 8 cards to each player. At the opening deal one more goes face down
 *  and begins each discard (§4.3); the rail era's deal is the 8 and nothing
 *  else (§5.13) — a card burnt there is an action lost to that seat */
function dealHands(s: GameState, opener: boolean) {
  for (const p of s.players) {
    p.hand = s.deck.splice(0, HAND_SIZE);
    if (!opener) continue;
    const faceDown = s.deck.shift();
    if (faceDown) s.discard.push(faceDown);
  }
}

export function newGame(setup: SetupPayload, seed = Math.floor(Math.random() * 1e9)): GameState {
  /* the board first: every table dealt below — the towns, the links, the
     merchants, the deck — is read off whichever board this game stands on */
  setBoard(setup.options.map);
  const rand = rng(seed);
  const players: PlayerState[] = setup.players.map((p) => ({
    name: p.name,
    color: p.color,
    isBot: p.type === 'bot',
    persona: personaFor(p),
    ...(p.minutes !== undefined ? { minutes: p.minutes } : {}),
    money: START_MONEY,
    income: START_INCOME_SPACE,
    vp: 0,
    loans: 0,
    spent: 0,
    hand: [],
    stacks: freshStacks(),
    stats: { built: 0, links: 0, sold: 0, loans: 0, developed: 0 },
    incomeHistory: [START_INCOME_SPACE],
  }));
  const n = players.length;

  /* merchant tiles: shuffle the pool for this table size, one per open slot */
  const pool = shuffle(MERCHANT_TILE_POOL[Math.max(2, Math.min(4, n)) as 2 | 3 | 4], rand);
  const merchantTiles: Record<string, MerchantTile[]> = {};
  const merchantBeer: Record<string, number> = {};
  for (const m of MERCHANTS) {
    if (n < m.minPlayers) continue;
    merchantTiles[m.id] = pool.splice(0, m.slots);
    /* a barrel beside every tile that is not blank: it belongs to that tile */
    merchantTiles[m.id].forEach((t, i) => {
      if (t !== 'blank') merchantBeer[`${m.id}:${i}`] = 1;
    });
  }

  /* character tiles shuffled → opening turn order */
  const order = shuffle(players.map((_, i) => i), rand);

  const state: GameState = {
    version: ENGINE_VERSION,
    board: activeBoard().id,
    ...(setup.options.rules !== undefined && setup.options.rules < RULES_EDITION ? { rules: setup.options.rules } : {}),
    seed,
    era: 'canal',
    round: 1,
    eraLength: setup.options.eraLength,
    marketTemper: setup.options.marketTemper,
    fidelity: setup.options.fidelity,
    timerMinutes: setup.options.timerMinutes,
    assist: !!setup.options.assist,
    players,
    order,
    turnPos: 0,
    current: order[0],
    actionsLeft: 1, // first canal round: one action only
    tiles: {},
    links: {},
    market: startMarket(setup.options.marketTemper),
    deck: buildDeck(n, seed),
    discard: [],
    wildLeft: { location: WILD_CARDS_EACH, industry: WILD_CARDS_EACH },
    merchantTiles,
    merchantBeer,
    merchantBonusTaken: {},
    ledger: [],
    ledgerSeq: 0,
    phase: 'action',
    fxSeq: 0,
    history: [],
    actions: [],
  };
  dealHands(state, true);
  log(state, undefined, 'system', `The table is set — ${players.map((p) => p.name).join(', ')}. The Canal Era begins.`, undefined, 'setup', { names: players.map((p) => p.name).join(', ') });
  return state;
}

/* ============================ helpers ============================== */

export function log(s: GameState, player: number | undefined, verb: LedgerEntry['verb'], text: string, region?: string, key?: string, vars?: Record<string, string | number>) {
  s.ledger.push({ id: s.ledgerSeq++, round: s.round, era: s.era, player, verb, text, region, at: s.actions.length, ...(key ? { key, vars } : {}) });
  if (s.ledger.length > 200) s.ledger = s.ledger.slice(-200);
}

export function tileKey(town: string, slot: number) {
  return `${town}:${slot}`;
}

export function slotXY(town: string, slot: number): [number, number] {
  const t = TOWN_BY_ID[town];
  const sp = t.slots[slot];
  return [sp.x, sp.y];
}

export const isWild = (c: Card) => c.kind === 'wild-location' || c.kind === 'wild-industry';

function eraOk(def: LinkDef, era: Era) {
  return era === 'canal' ? def.canal : def.rail;
}

/** industries a merchant currently buys (from its dealt tiles) */
export function merchantDemand(s: GameState, merchantId: string): IndustryType[] {
  const tiles = s.merchantTiles[merchantId] ?? [];
  const out: IndustryType[] = [];
  for (const ind of ['cotton', 'manufacturer', 'pottery'] as IndustryType[]) {
    if (tiles.some((t) => merchantTileBuys(t, ind))) out.push(ind);
  }
  return out;
}

/** beer barrel slots printed next to a merchant = its non-blank tiles */
export function merchantBarrelSlots(s: GameState, merchantId: string): number {
  return (s.merchantTiles[merchantId] ?? []).filter((t) => t !== 'blank').length;
}
/** the barrel's key in the state: it stands beside one merchant tile */
export const barrelKey = (merchantId: string, slot: number): string => `${merchantId}:${slot}`;
/** the slots of a merchant whose tile buys `industry` (any tile, when none is
 *  named) and still keep their barrel — a barrel is drunk only by a sale to
 *  the tile it stands beside */
export function merchantBarrelsFor(s: GameState, merchantId: string, industry?: IndustryType): number[] {
  return (s.merchantTiles[merchantId] ?? [])
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => t !== 'blank' && (industry === undefined || t === 'all' || (t as string) === industry) && (s.merchantBeer[barrelKey(merchantId, i)] ?? 0) > 0)
    .map(({ i }) => i);
}
/** the barrels still standing at a merchant, over all its tiles */
export function merchantBeerLeft(s: GameState, merchantId: string): number {
  return (s.merchantTiles[merchantId] ?? []).reduce((n, _, i) => n + (s.merchantBeer[barrelKey(merchantId, i)] ?? 0), 0);
}

export const merchantOpen = (s: GameState, merchantId: string) => merchantId in s.merchantTiles;

/** adjacency of built links; `extra` = links about to be placed (rail coal check) */
function transportAdj(s: GameState, era: Era, owner: number | null, extra: LinkDef[] = []): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  const addDef = (def: LinkDef) => {
    add(def.a, def.b);
    add(def.b, def.a);
    // farm brewery (south): the Kidderminster⇄Worcester link dual-connects it
    if (def.alsoConnects) {
      add(def.a, def.alsoConnects);
      add(def.alsoConnects, def.a);
      add(def.b, def.alsoConnects);
      add(def.alsoConnects, def.b);
    }
  };
  for (const def of LINKS) {
    const built = s.links[def.id];
    if (!built) continue;
    if (owner !== null && built.owner !== owner) continue;
    if (!eraOk(def, era)) continue;
    addDef(def);
  }
  for (const def of extra) addDef(def);
  return adj;
}

/** BFS: link-distance from `start` over built links (any owner unless given) */
export function linkDistances(s: GameState, start: string, era: Era, owner: number | null = null, extra: LinkDef[] = []): Map<string, number> {
  const adj = transportAdj(s, era, owner, extra);
  const dist = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift()!;
    for (const m of adj.get(n) ?? []) {
      if (!dist.has(m)) {
        dist.set(m, dist.get(n)! + 1);
        queue.push(m);
      }
    }
  }
  return dist;
}

/** nodes reachable from `start` using built links (owner filter optional) */
export function reachable(s: GameState, start: string, era: Era, owner: number | null, extra: LinkDef[] = []): Set<string> {
  return new Set(linkDistances(s, start, era, owner, extra).keys());
}

/** the player's NETWORK: locations holding one of their tiles or adjacent to one of their links */
export function networkTowns(s: GameState, player: number): Set<string> {
  const out = new Set<string>();
  for (const [key, t] of Object.entries(s.tiles)) {
    if (t.owner === player) out.add(key.split(':')[0]);
  }
  for (const [id, l] of Object.entries(s.links)) {
    if (l.owner === player) {
      const def = LINKS.find((d) => d.id === id)!;
      out.add(def.a);
      out.add(def.b);
      if (def.alsoConnects) out.add(def.alsoConnects);
    }
  }
  return out;
}

/** a player with nothing on the board may build/link anywhere */
export function hasPresence(s: GameState, player: number): boolean {
  return Object.values(s.tiles).some((t) => t.owner === player) || Object.values(s.links).some((l) => l.owner === player);
}

export function townConnectedToPlayer(s: GameState, player: number, town: string): boolean {
  if (!hasPresence(s, player)) return true;
  return networkTowns(s, player).has(town);
}

/** is any merchant location (open or not — the coal-market icon is printed) reachable? */
function merchantReachable(reach: Iterable<string>): boolean {
  for (const n of reach) if (MERCHANT_BY_ID[n]) return true;
  return false;
}

/* -------------------------- supply planning ------------------------ */

export interface SupplySource {
  kind: 'tile' | 'market';
  resource: Resource;
  town?: string;
  slot?: number;
  amount: number;
  cost: number; // total coins paid to market
  price?: number; // per-cube market price chip
}

export interface SupplyPlan {
  sources: SupplySource[];
  totalCost: number;
  shortage: number; // >0 means impossible
  /** why the market could not be used (coal: no merchant connection) */
  marketBlocked?: boolean;
}

const emptyPlan = (): SupplyPlan => ({ sources: [], totalCost: 0, shortage: 0 });

/**
 * COAL for a build/link at `town`: the nearest CONNECTED unflipped mines
 * first (link distance, any owner), then the coal market — only if a
 * merchant location is connected. IRON: any unflipped iron works on the
 * board, then the iron market; no connection needed.
 * `extra` = link tiles about to be placed (they count for the rail coal check).
 * `reserved` = cubes already claimed by an earlier plan in the same action.
 */
export function planSupply(s: GameState, town: string, resource: Resource, needed: number, extra: LinkDef[] = [], reserved: Map<string, number> = new Map()): SupplyPlan {
  const plan = emptyPlan();
  if (needed <= 0) return plan;

  const dist = resource === 'coal' ? linkDistances(s, town, s.era, null, extra) : null;
  const candidates: { key: string; town: string; slot: number; cubes: number; d: number }[] = [];
  for (const [key, tile] of Object.entries(s.tiles)) {
    if (tile.flipped || tile.industry !== resource) continue;
    const cubes = tile.cubes - (reserved.get(key) ?? 0);
    if (cubes <= 0) continue;
    const [tId, slotStr] = key.split(':');
    if (resource === 'iron') candidates.push({ key, town: tId, slot: Number(slotStr), cubes, d: 0 });
    else if (dist!.has(tId)) candidates.push({ key, town: tId, slot: Number(slotStr), cubes, d: dist!.get(tId)! });
  }
  /* ties in distance are the player's to break (§5.3): an action that names
     no mine gets the engine's — nearest, then largest stock. `planCoalFrom`
     takes the player's names */
  candidates.sort((a, b) => a.d - b.d || b.cubes - a.cubes);

  let left = needed;
  for (const c of candidates) {
    if (left <= 0) break;
    const take = Math.min(left, c.cubes);
    plan.sources.push({ kind: 'tile', resource, town: c.town, slot: c.slot, amount: take, cost: 0 });
    left -= take;
  }

  if (left > 0) {
    const marketOk = resource === 'iron' || merchantReachable(dist!.keys());
    if (!marketOk) plan.marketBlocked = true;
    else {
      const bought = plan.sources.filter((x) => x.kind === 'market' && x.resource === resource).length;
      let marketCount = s.market[resource] - (reserved.get(`market:${resource}`) ?? 0) - bought;
      while (left > 0) {
        const price = marketBuyPrice(resource, marketCount);
        plan.sources.push({ kind: 'market', resource, amount: 1, cost: price, price });
        plan.totalCost += price;
        marketCount -= 1;
        left -= 1;
      }
    }
  }
  plan.shortage = left;
  return plan;
}

/** cubes claimed by a plan, keyed like `reserved` above */
function reserveFrom(plan: SupplyPlan, reserved: Map<string, number>) {
  for (const src of plan.sources) {
    const k = src.kind === 'tile' ? tileKey(src.town!, src.slot!) : `market:${src.resource}`;
    reserved.set(k, (reserved.get(k) ?? 0) + src.amount);
  }
}

/** the mines a cube of coal for `town` may come from right now: the
 *  connected ones with coal left that stand nearest, all at one distance.
 *  Among them the choice is the player's (§5.3); empty once no connected
 *  mine has a cube to give, and the market's turn has come */
export function coalChoices(s: GameState, town: string, extra: LinkDef[] = [], reserved: Map<string, number> = new Map()): { key: string; town: string; slot: number; owner: number; cubes: number; d: number }[] {
  const dist = linkDistances(s, town, s.era, null, extra);
  const out: ReturnType<typeof coalChoices> = [];
  for (const [key, tile] of Object.entries(s.tiles)) {
    if (tile.flipped || tile.industry !== 'coal') continue;
    const at = key.split(':')[0];
    const cubes = tile.cubes - (reserved.get(key) ?? 0);
    if (cubes <= 0 || !dist.has(at)) continue;
    out.push({ key, town: at, slot: Number(key.split(':')[1]), owner: tile.owner, cubes, d: dist.get(at)! });
  }
  const near = Math.min(...out.map((c) => c.d));
  return out.filter((c) => c.d === near);
}

/** coal for `town`, a cube at a time, from the mines the player named.
 *  A name holds only while that mine is among the nearest with coal left —
 *  once it runs dry the next cube is the next nearest's (§5.3). A cube left
 *  unnamed, or named wrongly, is drawn as `planSupply` would draw it */
export function planCoalFrom(s: GameState, town: string, needed: number, from: (string | null)[] = [], extra: LinkDef[] = [], reserved: Map<string, number> = new Map()): SupplyPlan {
  if (!from.some(Boolean)) return planSupply(s, town, 'coal', needed, extra, reserved);
  const own = new Map(reserved);
  const plan = emptyPlan();
  for (let k = 0; k < needed; k++) {
    const name = from[k];
    const pick = name ? coalChoices(s, town, extra, own).find((c) => c.key === name) : undefined;
    const one: SupplyPlan = pick ? { sources: [{ kind: 'tile', resource: 'coal', town: pick.town, slot: pick.slot, amount: 1, cost: 0 }], totalCost: 0, shortage: 0 } : planSupply(s, town, 'coal', 1, extra, own);
    plan.sources.push(...one.sources);
    plan.totalCost += one.totalCost;
    if (one.shortage > 0) {
      plan.shortage = needed - k;
      if (one.marketBlocked) plan.marketBlocked = true;
      break;
    }
    reserveFrom(one, own);
  }
  return plan;
}

/* ------------------------------ beer ------------------------------- */

export interface BeerSource {
  kind: 'merchant' | 'brewery';
  merchant?: string;
  town?: string;
  slot?: number;
}

/**
 * Beer for a sale at `town` through merchant `merchantId` (or for a double
 * rail, merchantId = null and `town` = an endpoint of the second link):
 *  1. the merchant's own barrel(s) — triggers the merchant bonus (sale only)
 *  2. your own unflipped breweries, anywhere
 *  3. opponents' unflipped breweries connected to `town`
 * APPROX: the engine drinks the merchant barrel first (it carries the bonus).
 */
export function planBeer(
  s: GameState,
  player: number,
  town: string,
  merchantId: string | null,
  needed: number,
  extra: LinkDef[] = [],
  reserved: Map<string, number> = new Map(),
  industry?: IndustryType,
): { sources: BeerSource[]; shortage: number } {
  const sources: BeerSource[] = [];
  let left = needed;
  if (merchantId) {
    /* the merchant's barrels: only those beside a tile that buys what is sold */
    for (const slot of merchantBarrelsFor(s, merchantId, industry)) {
      if (left <= 0) break;
      if ((reserved.get(`beer:${barrelKey(merchantId, slot)}`) ?? 0) > 0) continue;
      sources.push({ kind: 'merchant', merchant: merchantId, slot });
      left -= 1;
    }
  }
  if (left <= 0) return { sources, shortage: 0 };
  const reach = reachable(s, town, s.era, null, extra);
  const breweries = Object.entries(s.tiles)
    .filter(([, t]) => t.industry === 'brewery' && !t.flipped)
    .map(([key, t]) => ({ key, t, town: key.split(':')[0], slot: Number(key.split(':')[1]), own: t.owner === player }))
    .filter((b) => b.own || reach.has(b.town))
    .sort((a, b) => Number(b.own) - Number(a.own));
  for (const b of breweries) {
    let avail = b.t.cubes - (reserved.get(b.key) ?? 0);
    while (left > 0 && avail > 0) {
      sources.push({ kind: 'brewery', town: b.town, slot: b.slot });
      avail -= 1;
      left -= 1;
    }
    if (left <= 0) break;
  }
  return { sources, shortage: left };
}

/* ============================ validation =========================== */

export interface BuildTarget {
  town: string;
  slot: number;
  industry: IndustryType;
  level: number;
  cost: number;
  coalPlan: SupplyPlan;
  ironPlan: SupplyPlan;
  total: number;
  valid: boolean;
  reason?: string;
  /** replacing an existing tile (overbuild) */
  overbuild?: boolean;
}

/** may `card` be used to build `industry` in `town`? */
function cardAllows(s: GameState, playerIdx: number, card: Card, town: string, industry: IndustryType): { ok: boolean; reason?: string } {
  const t = TOWN_BY_ID[town];
  switch (card.kind) {
    case 'location':
      return card.town === town ? { ok: true } : { ok: false, reason: `This card builds in ${card.town} only` };
    case 'wild-location':
      return t.farm ? { ok: false, reason: 'Farm breweries take industry cards only' } : { ok: true };
    case 'industry':
      if (card.industry !== industry && card.industry2 !== industry) return { ok: false, reason: `This card builds ${[card.industry, card.industry2].filter(Boolean).join(' or ')} only` };
      return townConnectedToPlayer(s, playerIdx, town) ? { ok: true } : { ok: false, reason: 'Not in your network' };
    default:
      return townConnectedToPlayer(s, playerIdx, town) ? { ok: true } : { ok: false, reason: 'Not in your network' };
  }
}

/** coal/iron cubes of `resource` anywhere (board tiles + market) */
function resourceAnywhere(s: GameState, resource: Resource): boolean {
  if (s.market[resource] > 0) return true;
  return Object.values(s.tiles).some((t) => t.industry === resource && !t.flipped && t.cubes > 0);
}

export function buildTargets(s: GameState, playerIdx: number, card: Card): BuildTarget[] {
  const p = s.players[playerIdx];
  const out: BuildTarget[] = [];
  const push = (town: string, slot: number, industry: IndustryType) => {
    const stack = p.stacks[industry];
    const level = stack[0];
    const t: BuildTarget = {
      town, slot, industry, level: level ?? 0, cost: 0,
      coalPlan: emptyPlan(), ironPlan: emptyPlan(),
      total: 0, valid: true,
    };
    const fail = (reason: string) => { t.valid = false; t.reason = reason; out.push(t); };

    const allow = cardAllows(s, playerIdx, card, town, industry);
    if (!allow.ok) return fail(allow.reason!);
    if (!level) return fail(`No ${industry} tiles left`);
    const lv = INDUSTRIES[industry][level - 1];
    if (!lv.eras.includes(s.era)) return fail(`${industry} L${level} cannot be built in the ${s.era} era`);

    const key = tileKey(town, slot);
    const existing = s.tiles[key];
    if (existing) {
      // overbuild: same industry, higher level; opponents' only coal/iron with none left anywhere
      if (existing.industry !== industry) return fail('Occupied by another industry');
      if (existing.level >= level) return fail('Can only overbuild with a higher level');
      if (existing.owner !== playerIdx) {
        if (industry !== 'coal' && industry !== 'iron') return fail("Only mines and iron works may overbuild an opponent's tile");
        if (resourceAnywhere(s, industry)) return fail(`Opponent's tile can only be overbuilt once no ${industry} is left anywhere`);
      }
      t.overbuild = true;
    }
    // canal era: one industry tile per player per location
    if (s.era === 'canal') {
      const mine = Object.entries(s.tiles).some(([k, x]) => x.owner === playerIdx && k.split(':')[0] === town && k !== key);
      if (mine) return fail('Canal Era: one tile per location');
    }

    const reserved = new Map<string, number>();
    t.coalPlan = planSupply(s, town, 'coal', lv.coal, [], reserved);
    reserveFrom(t.coalPlan, reserved);
    t.ironPlan = planSupply(s, town, 'iron', lv.iron, [], reserved);
    if (t.coalPlan.shortage > 0) return fail(t.coalPlan.marketBlocked ? 'No connected coal — reach a mine or a merchant' : 'No coal left anywhere');
    if (t.ironPlan.shortage > 0) return fail('No iron available anywhere');
    t.cost = lv.cost;
    t.total = lv.cost + t.coalPlan.totalCost + t.ironPlan.totalCost;
    if (t.total > p.money) return fail(`Needs £${t.total} — you hold £${p.money}`);
    out.push(t);
  };

  /* every slot of the board, for each industry it takes: the card's own
     places come out valid, every other place says why it is not — so a
     click anywhere is answered with the reason, not a shrug */
  for (const town of TOWNS) town.slots.forEach((sp, i) => sp.allows.forEach((ind) => push(town.id, i, ind)));
  // keep every valid option (multi-industry sockets cycle on click);
  // dedupe failure rows per slot+industry
  const seen = new Set<string>();
  return out.filter((t) => {
    if (t.valid) return true;
    const k = tileKey(t.town, t.slot) + t.industry;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface LinkTarget {
  link: LinkDef;
  cost: number;
  coalPlan: SupplyPlan;
  total: number;
  valid: boolean;
  reason?: string;
}

/** single link targets. Rail: £5 + 1 coal connected to the link once placed. */
export function linkTargets(s: GameState, playerIdx: number): LinkTarget[] {
  const p = s.players[playerIdx];
  const nt = networkTowns(s, playerIdx);
  const anywhere = !hasPresence(s, playerIdx);
  return LINKS.filter((d) => eraOk(d, s.era) && !s.links[d.id]).map((def) => {
    const isRail = s.era === 'rail';
    const base = isRail ? COSTS.railLink : COSTS.canalLink;
    const coalPlan = isRail ? planSupply(s, def.a, 'coal', COSTS.railCoal, [def]) : emptyPlan();
    const total = base + coalPlan.totalCost;
    const t: LinkTarget = { link: def, cost: base, coalPlan, total, valid: true };
    if (!anywhere && !nt.has(def.a) && !nt.has(def.b) && !(def.alsoConnects && nt.has(def.alsoConnects))) {
      t.valid = false;
      t.reason = 'Link must touch your network';
    } else if (coalPlan.shortage > 0) {
      t.valid = false;
      t.reason = coalPlan.marketBlocked ? 'No connected coal for the locomotives' : 'No coal left anywhere';
    } else if (total > p.money) {
      t.valid = false;
      t.reason = `Needs £${total} — you hold £${p.money}`;
    }
    return t;
  });
}

export interface DoubleLinkPlan {
  coal2: SupplyPlan;
  beer: BeerSource[];
  total: number; // £15 + market coal for both links
  valid: boolean;
  reason?: string;
}

/** the rail-era double: a second link touching the network once the first is laid, £15 total + 1 coal each + 1 beer from a brewery */
/** the breweries a double rail may drink from: the player's own anywhere,
 *  another's when the second link, once laid, connects to it */
export function beerSources(s: GameState, playerIdx: number, first: LinkDef, second: LinkDef): { key: string; town: string; slot: number; owner: number; cubes: number; own: boolean }[] {
  const reach = reachable(s, second.a, s.era, null, [first, second]);
  return Object.entries(s.tiles)
    .filter(([, t]) => t.industry === 'brewery' && !t.flipped && t.cubes > 0)
    .map(([key, t]) => ({ key, town: key.split(':')[0], slot: Number(key.split(':')[1]), owner: t.owner, cubes: t.cubes, own: t.owner === playerIdx }))
    .filter((b) => b.own || reach.has(b.town))
    .sort((a, b) => Number(b.own) - Number(a.own) || a.town.localeCompare(b.town));
}

export function doubleLinkPlan(s: GameState, playerIdx: number, first: LinkTarget, second: LinkDef, beerFrom?: string | null, coalFrom?: string | null): DoubleLinkPlan {
  const p = s.players[playerIdx];
  const reserved = new Map<string, number>();
  reserveFrom(first.coalPlan, reserved);
  const coal2 = planCoalFrom(s, second.a, COSTS.railCoal, [coalFrom ?? null], [first.link, second], reserved);
  let beer = planBeer(s, playerIdx, second.a, null, COSTS.doubleRailBeer, [first.link, second]);
  /* the brewery the player named, when it is one the rules allow */
  const named = beerFrom ? beerSources(s, playerIdx, first.link, second).find((b) => b.key === beerFrom) : undefined;
  if (named) beer = { sources: [{ kind: 'brewery', town: named.town, slot: named.slot }], shortage: 0 };
  /* the second link must be a free rail of this era, touching the network
     as it stands once the first is laid — the first's own ends count, but
     the two need not touch each other */
  const nt = networkTowns(s, playerIdx);
  const ends = new Set([first.link.a, first.link.b, ...(first.link.alsoConnects ? [first.link.alsoConnects] : [])]);
  const touches = (id: string) => nt.has(id) || ends.has(id);
  const placeable = second.id !== first.link.id && eraOk(second, s.era) && !s.links[second.id] && (touches(second.a) || touches(second.b) || (!!second.alsoConnects && touches(second.alsoConnects)));
  const total = COSTS.doubleRail + first.coalPlan.totalCost + coal2.totalCost;
  const out: DoubleLinkPlan = { coal2, beer: beer.sources, total, valid: true };
  if (s.era !== 'rail') { out.valid = false; out.reason = 'Double links are a Rail Era option'; }
  else if (!placeable) { out.valid = false; out.reason = 'The second link must touch your network'; }
  else if (coal2.shortage > 0) { out.valid = false; out.reason = 'No connected coal for the second link'; }
  else if (beer.shortage > 0) { out.valid = false; out.reason = 'Needs 1 beer from a brewery (yours anywhere, or one connected to the second link)'; }
  else if (total > p.money) { out.valid = false; out.reason = `Needs £${total} — you hold £${p.money}`; }
  return out;
}

export interface SellTarget {
  town: string;
  slot: number;
  tile: TileState;
  merchant: string;
  beer: BeerSource[];
  valid: boolean;
  reason?: string;
}

/** why a tile will not sell: the beer it needs is nowhere to be drunk —
 *  alone, or after the tiles sold before it in the same action */
export const beerShort = (t: Pick<SellTarget, 'tile'>): string => `Needs ${INDUSTRIES[t.tile.industry][t.tile.level - 1].beerToSell} beer — a brewery of yours, one connected here, or the merchant's barrel`;

/** every own unflipped goods tile × every open merchant that buys it and is connected */
export function sellTargets(s: GameState, playerIdx: number): SellTarget[] {
  const out: SellTarget[] = [];
  for (const [key, tile] of Object.entries(s.tiles)) {
    if (tile.owner !== playerIdx || tile.flipped) continue;
    const lv = INDUSTRIES[tile.industry][tile.level - 1];
    if (lv.beerToSell <= 0) continue; // mines/works/breweries flip by emptying
    const town = key.split(':')[0];
    const slot = Number(key.split(':')[1]);
    const reach = reachable(s, town, s.era, null);
    for (const m of MERCHANTS) {
      if (!merchantOpen(s, m.id) || !reach.has(m.id)) continue;
      if (!merchantDemand(s, m.id).includes(tile.industry)) continue;
      const beer = planBeer(s, playerIdx, town, m.id, lv.beerToSell, [], new Map(), tile.industry);
      out.push({
        town, slot, tile, merchant: m.id, beer: beer.sources,
        valid: beer.shortage === 0,
        reason: beer.shortage > 0 ? beerShort({ tile }) : undefined,
      });
    }
  }
  return out;
}

export function developOptions(s: GameState, playerIdx: number): { industry: IndustryType; level: number; iron: SupplyPlan; valid: boolean; reason?: string }[] {
  const p = s.players[playerIdx];
  return INDUSTRIES_IN_ORDER
    .filter((ind) => p.stacks[ind].length > 0)
    .map((ind) => {
      const level = p.stacks[ind][0];
      const lv = INDUSTRIES[ind][level - 1];
      const iron = planSupply(s, 'birmingham', 'iron', 1); // iron ships freely
      const valid = !lv.noDevelop && iron.shortage === 0 && iron.totalCost <= p.money;
      return {
        industry: ind, level, iron, valid,
        /* the refusals the reader sees: each one is a key of the tongues */
        reason: lv.noDevelop ? 'Lightbulb tile — cannot be developed' : iron.shortage > 0 ? 'No iron available anywhere' : iron.totalCost > p.money ? 'Cannot afford the iron' : undefined,
      };
    });
}

export function canScout(s: GameState, playerIdx: number): { ok: boolean; reason?: string } {
  const p = s.players[playerIdx];
  if (p.hand.some(isWild)) return { ok: false, reason: 'You already hold a wild card' };
  if (p.hand.length < 3) return { ok: false, reason: 'Needs 3 cards to discard' };
  if (s.wildLeft.location <= 0 || s.wildLeft.industry <= 0) return { ok: false, reason: 'The wild piles are empty' };
  return { ok: true };
}

export function canLoan(s: GameState, playerIdx: number): { ok: boolean; reason?: string } {
  return loanLanding(s.players[playerIdx].income) === null ? { ok: false, reason: 'Income cannot sink below −£10' } : { ok: true };
}

/* ============================ mutations ============================ */

function spend(p: PlayerState, amount: number) {
  p.money -= amount;
  p.spent += amount;
}

/** move the income marker by SPACES (industry flips, Oxford bonus) */
function advanceIncome(s: GameState, playerIdx: number, spaces: number) {
  const p = s.players[playerIdx];
  p.income = Math.max(0, Math.min(INCOME_MAX, p.income + spaces));
  p.incomeHistory.push(p.income);
}

const FLIP_WHY = {
  empties: 'empties and flips',
  barrel: 'pours its last barrel and flips',
  market: 'sells out to the market and flips',
  merchant: 'sells to {merchant} and flips',
} as const;

function flipTile(s: GameState, key: string, why: keyof typeof FLIP_WHY, merchant?: string) {
  const tile = s.tiles[key];
  if (!tile || tile.flipped) return;
  tile.flipped = true;
  const lv = INDUSTRIES[tile.industry][tile.level - 1];
  advanceIncome(s, tile.owner, lv.incomeDelta);
  const owner = s.players[tile.owner];
  const said = FLIP_WHY[why].replace('{merchant}', merchant ?? '');
  log(s, tile.owner, 'score', `${owner.name}'s ${INDUSTRY_LABEL[tile.industry]} L${tile.level} ${said} (+${lv.incomeDelta} income)`, key.split(':')[0], 'flip', { name: owner.name, industry: tile.industry, level: tile.level, why, merchant: merchant ?? '', income: lv.incomeDelta });
}

function paySupply(s: GameState, p: PlayerState, plan: SupplyPlan) {
  for (const src of plan.sources) {
    if (src.kind === 'tile') {
      const key = tileKey(src.town!, src.slot!);
      const tile = s.tiles[key];
      tile.cubes -= src.amount;
      if (tile.cubes <= 0) {
        tile.cubes = 0;
        flipTile(s, key, 'empties');
      }
    } else {
      s.market[src.resource] = Math.max(0, s.market[src.resource] - src.amount);
      spend(p, src.cost);
    }
  }
}

/** what the merchants' barrels gave with the beer: their bonus alone. A
 *  brewery of the drinker's own that pours its last barrel on the way
 *  raises the income too, but as a flip, told on its own line */
interface BarrelBonus {
  said: string;
  vp: number;
  money: number;
  /** income spaces gained, as the merchant's sign counts them */
  income: number;
  develop: boolean;
  /** the merchants' barrels drunk: a barrel may give nothing it can
   *  show — a free development with none left to take, income at the
   *  top of the track — and is drunk all the same */
  barrels: number;
}

function drinkBeer(s: GameState, playerIdx: number, sources: BeerSource[]): BarrelBonus {
  const p = s.players[playerIdx];
  const bonus: BarrelBonus = { said: '', vp: 0, money: 0, income: 0, develop: false, barrels: 0 };
  for (const b of sources) {
    if (b.kind === 'brewery') {
      const key = tileKey(b.town!, b.slot!);
      const t = s.tiles[key];
      t.cubes -= 1;
      if (t.cubes <= 0) {
        t.cubes = 0;
        flipTile(s, key, 'barrel');
      }
    } else {
      const mid = b.merchant!;
      s.merchantBeer[barrelKey(mid, b.slot!)] = 0;
      bonus.barrels += 1;
      if (merchantBeerLeft(s, mid) === 0) s.merchantBonusTaken[mid] = true;
      const bn = MERCHANT_BY_ID[mid].bonus;
      if (bn.vp) { p.vp += bn.vp; bonus.vp += bn.vp; bonus.said += ` · +${bn.vp} VP`; }
      if (bn.income) {
        /* measured here, around the barrel's own step on the track, in
           spaces: two of them may stay within one level */
        const before = p.income;
        advanceIncome(s, playerIdx, bn.income);
        bonus.income += p.income - before;
        bonus.said += ` · +${bn.income} income`;
      }
      if (bn.money) { p.money += bn.money; bonus.money += bn.money; bonus.said += ` · £${bn.money}`; }
      if (bn.develop) {
        // Gloucester: remove one lowest-level tile from the mat, no iron, lightbulbs excluded
        let bestInd: IndustryType | null = null;
        for (const ind of INDUSTRIES_IN_ORDER) {
          const lvl = p.stacks[ind][0];
          if (!lvl || INDUSTRIES[ind][lvl - 1].noDevelop) continue;
          if (bestInd === null || lvl < p.stacks[bestInd][0]) bestInd = ind;
        }
        if (bestInd) {
          const lvl = p.stacks[bestInd].shift()!;
          p.stats.developed += 1;
          bonus.develop = true;
          bonus.said += ` · free develop (−${INDUSTRY_LABEL[bestInd]} L${lvl})`;
        }
      }
    }
  }
  return bonus;
}

/** discard from hand; wild cards go back to their pile instead */
function discardCard(s: GameState, p: PlayerState, cardId: string) {
  const i = p.hand.findIndex((c) => c.id === cardId);
  if (i < 0) return;
  const [card] = p.hand.splice(i, 1);
  if (card.kind === 'wild-location') s.wildLeft.location += 1;
  else if (card.kind === 'wild-industry') s.wildLeft.industry += 1;
  else s.discard.push(card);
}

/** a freshly built mine/works sells to its market straight away (dearest spaces first) */
function sellToMarket(s: GameState, playerIdx: number, key: string, resource: Resource): string {
  const tile = s.tiles[key];
  const p = s.players[playerIdx];
  let earned = 0;
  let sold = 0;
  while (tile.cubes > 0 && s.market[resource] < MARKET_MAX[resource]) {
    earned += marketSellPrice(resource, s.market[resource]);
    s.market[resource] += 1;
    tile.cubes -= 1;
    sold += 1;
  }
  if (!sold) return '';
  p.money += earned;
  if (tile.cubes <= 0) flipTile(s, key, 'market');
  return ` · ${sold} ${resource} to market for £${earned}`;
}

/** what a new mine or works would sell to the market on being built — the
 *  cubes that fit, at the tray's prices — without touching the state */
export function marketSaleOnBuild(s: GameState, town: string, industry: IndustryType, level: number): { sold: number; earned: number } {
  if (industry !== 'coal' && industry !== 'iron') return { sold: 0, earned: 0 };
  if (industry === 'coal' && !merchantReachable(reachable(s, town, s.era, null))) return { sold: 0, earned: 0 };
  let cubes = INDUSTRIES[industry][level - 1].cubes;
  let count = s.market[industry];
  let sold = 0;
  let earned = 0;
  while (cubes > 0 && count < MARKET_MAX[industry]) {
    earned += marketSellPrice(industry, count);
    count += 1;
    cubes -= 1;
    sold += 1;
  }
  return { sold, earned };
}

export function applyBuild(s: GameState, playerIdx: number, card: Card, target: BuildTarget): boolean {
  const p = s.players[playerIdx];
  if (!target.valid) return false;
  const level = p.stacks[target.industry].shift()!;
  const lv = INDUSTRIES[target.industry][level - 1];
  paySupply(s, p, target.coalPlan);
  paySupply(s, p, target.ironPlan);
  spend(p, lv.cost);
  const key = tileKey(target.town, target.slot);
  const replaced = s.tiles[key];
  s.tiles[key] = {
    owner: playerIdx,
    industry: target.industry,
    level,
    flipped: false,
    cubes: target.industry === 'brewery' ? breweryBarrels(s.era) : lv.cubes,
  };
  discardCard(s, p, card.id);
  p.stats.built += 1;
  s.fxSeq += 1;
  s.lastFx = { kind: 'build', at: slotXY(target.town, target.slot), player: playerIdx };
  const costBits = [`£${lv.cost}`];
  if (lv.coal) costBits.push(`coal ×${lv.coal}`);
  if (lv.iron) costBits.push(`iron ×${lv.iron}`);
  let extra = replaced ? ` (overbuilds ${s.players[replaced.owner].name}'s L${replaced.level})` : '';
  const before = p.money;
  const cubesBefore = s.tiles[key].cubes;
  if (target.industry === 'iron') extra += sellToMarket(s, playerIdx, key, 'iron');
  if (target.industry === 'coal' && merchantReachable(reachable(s, target.town, s.era, null))) extra += sellToMarket(s, playerIdx, key, 'coal');
  const saleN = cubesBefore - (s.tiles[key]?.cubes ?? 0);
  log(s, playerIdx, 'build', `${p.name} builds ${INDUSTRY_LABEL[target.industry]} L${level} in ${TOWN_BY_ID[target.town].name} (${costBits.join(' · ')})${extra}`, target.town, 'build', {
    name: p.name,
    industry: target.industry,
    level,
    town: TOWN_BY_ID[target.town].name,
    price: lv.cost,
    coal: lv.coal,
    iron: lv.iron,
    overName: replaced ? s.players[replaced.owner].name : '',
    overLevel: replaced?.level ?? 0,
    saleN,
    saleRes: target.industry,
    saleGain: p.money - before,
  });
  return true;
}

export function applyNetwork(s: GameState, playerIdx: number, card: Card, target: LinkTarget, second?: LinkTarget, beerFrom?: string | null, coalFrom?: string | null): boolean {
  const p = s.players[playerIdx];
  if (!target.valid) return false;
  const name = (id: string) => TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id;
  let extra = '';
  if (second) {
    const dbl = doubleLinkPlan(s, playerIdx, target, second.link, beerFrom, coalFrom);
    if (!dbl.valid) return false;
    paySupply(s, p, target.coalPlan);
    s.links[target.link.id] = { owner: playerIdx, era: s.era };
    paySupply(s, p, dbl.coal2);
    s.links[second.link.id] = { owner: playerIdx, era: s.era };
    drinkBeer(s, playerIdx, dbl.beer);
    spend(p, COSTS.doubleRail);
    p.stats.links += 2;
    extra = ` + ${name(second.link.a)} ⇄ ${name(second.link.b)} (double: £${COSTS.doubleRail}, 2 coal, 1 beer)`;
  } else {
    paySupply(s, p, target.coalPlan);
    spend(p, target.cost);
    s.links[target.link.id] = { owner: playerIdx, era: s.era };
    p.stats.links += 1;
  }
  discardCard(s, p, card.id);
  s.fxSeq += 1;
  s.lastFx = { kind: 'link', at: [0, 0], linkId: target.link.id, player: playerIdx };
  log(s, playerIdx, 'network', `${p.name} lays ${s.era === 'canal' ? 'a canal' : 'rail'} ${name(target.link.a)} ⇄ ${name(target.link.b)}${extra}`, target.link.a, 'network', {
    name: p.name,
    era: s.era,
    a: name(target.link.a),
    b: name(target.link.b),
    a2: second ? name(second.link.a) : '',
    b2: second ? name(second.link.b) : '',
    price: second ? COSTS.doubleRail : target.cost,
    /* the ids, for whoever waits on this link or on either of its ends */
    linkId: target.link.id,
    townA: target.link.a,
    townB: target.link.b,
    linkId2: second?.link.id ?? '',
    townA2: second?.link.a ?? '',
    townB2: second?.link.b ?? '',
  });
  return true;
}

/** the works on the board a development may take its iron from — any
 *  iron works with cubes, whoever owns it: iron ships freely */
export function ironSources(s: GameState): { key: string; town: string; slot: number; owner: number; cubes: number }[] {
  return Object.entries(s.tiles)
    .filter(([, t]) => t.industry === 'iron' && !t.flipped && t.cubes > 0)
    .map(([key, t]) => ({ key, town: key.split(':')[0], slot: Number(key.split(':')[1]), owner: t.owner, cubes: t.cubes }));
}

/** one cube of iron from a named works (its key), or the engine's own
 *  choice when none is named or the named one has run dry */
export function planIronFrom(s: GameState, from: string | null | undefined, reserved: Map<string, number>): SupplyPlan {
  if (from && from !== 'market') {
    const tile = s.tiles[from];
    if (tile && tile.industry === 'iron' && !tile.flipped && tile.cubes - (reserved.get(from) ?? 0) > 0) {
      const plan = emptyPlan();
      plan.sources.push({ kind: 'tile', resource: 'iron', town: from.split(':')[0], slot: Number(from.split(':')[1]), amount: 1, cost: 0 });
      return plan;
    }
  }
  /* the market only once no works on the board has a cube left to give */
  const onBoard = ironSources(s).some((src) => src.cubes - (reserved.get(src.key) ?? 0) > 0);
  if (from === 'market' && !onBoard) {
    const plan = emptyPlan();
    const count = s.market.iron - (reserved.get('market:iron') ?? 0);
    const price = marketBuyPrice('iron', count);
    plan.sources.push({ kind: 'market', resource: 'iron', amount: 1, cost: price, price });
    plan.totalCost = price;
    return plan;
  }
  return planSupply(s, 'birmingham', 'iron', 1, [], reserved);
}

/** the build target with its iron drawn from the works the reader named
 *  (or the market, once the board is dry): the rules let iron come from
 *  any works, so the choice is the player's — an empty name, a dry works
 *  or a target that takes no iron leave the engine's nearest choice */
export function withIron(s: GameState, playerIdx: number, t: BuildTarget, from: string | null | undefined): BuildTarget {
  if (!from || !t.valid) return t;
  const lv = INDUSTRIES[t.industry][t.level - 1];
  if (lv?.iron !== 1) return t;
  const reserved = new Map<string, number>();
  reserveFrom(t.coalPlan, reserved);
  const ironPlan = planIronFrom(s, from, reserved);
  if (ironPlan.shortage > 0) return t;
  const total = t.cost + t.coalPlan.totalCost + ironPlan.totalCost;
  const money = s.players[playerIdx].money;
  return { ...t, ironPlan, total, valid: total <= money, ...(total > money ? { reason: `Needs £${total} — you hold £${money}` } : {}) };
}

/** the build target with its coal drawn from the mines the reader named,
 *  a cube each: among the nearest connected mines the choice is the
 *  player's (§5.3), and a mine about to run dry is often the one they want
 *  — its owner's income moves when it flips. Nothing named, or a target
 *  that burns no coal, leaves the engine's own plan */
export function withCoal(s: GameState, playerIdx: number, t: BuildTarget, from: (string | null)[] | null | undefined): BuildTarget {
  if (!from?.some(Boolean) || !t.valid) return t;
  const lv = INDUSTRIES[t.industry][t.level - 1];
  if (!lv?.coal) return t;
  const coalPlan = planCoalFrom(s, t.town, lv.coal, from);
  if (coalPlan.shortage > 0) return t;
  const reserved = new Map<string, number>();
  reserveFrom(coalPlan, reserved);
  const ironPlan = planSupply(s, t.town, 'iron', lv.iron, [], reserved);
  const total = t.cost + coalPlan.totalCost + ironPlan.totalCost;
  const money = s.players[playerIdx].money;
  return { ...t, coalPlan, ironPlan, total, valid: total <= money, ...(total > money ? { reason: `Needs £${total} — you hold £${money}` } : {}) };
}

/** a rail link with its cube of coal drawn from the mine the reader named,
 *  when that mine is among the nearest; the canal burns none */
export function withLinkCoal(s: GameState, playerIdx: number, t: LinkTarget, from: string | null | undefined): LinkTarget {
  if (!from || !t.valid || s.era !== 'rail') return t;
  const coalPlan = planCoalFrom(s, t.link.a, COSTS.railCoal, [from], [t.link]);
  if (coalPlan.shortage > 0) return t;
  const total = t.cost + coalPlan.totalCost;
  const money = s.players[playerIdx].money;
  return { ...t, coalPlan, total, valid: total <= money, ...(total > money ? { reason: `Needs £${total} — you hold £${money}` } : {}) };
}

/** the tile a second development of the same industry would take: the
 *  one under the top of the stack, if it may be developed */
export function developTwice(s: GameState, playerIdx: number, ind: IndustryType): boolean {
  const next = s.players[playerIdx].stacks[ind][1];
  return !!next && !INDUSTRIES[ind][next - 1].noDevelop;
}

export function applyDevelop(s: GameState, playerIdx: number, card: Card, industries: IndustryType[], ironFrom: (string | null)[] = []): boolean {
  const p = s.players[playerIdx];
  if (industries.length < 1 || industries.length > 2) return false;
  const reserved = new Map<string, number>();
  const plans: SupplyPlan[] = [];
  /* the same industry twice takes the top tile and the one beneath it */
  const depth: Partial<Record<IndustryType, number>> = {};
  for (const [k, ind] of industries.entries()) {
    const at = depth[ind] ?? 0;
    depth[ind] = at + 1;
    const lvl = p.stacks[ind][at];
    if (!lvl || INDUSTRIES[ind][lvl - 1].noDevelop) return false;
    const iron = planIronFrom(s, ironFrom[k], reserved);
    if (iron.shortage > 0) return false;
    reserveFrom(iron, reserved);
    plans.push(iron);
  }
  if (plans.reduce((a, x) => a + x.totalCost, 0) > p.money) return false;
  industries.forEach((ind, k) => {
    paySupply(s, p, plans[k]);
    const level = p.stacks[ind].shift()!;
    log(s, playerIdx, 'develop', `${p.name} develops away ${INDUSTRY_LABEL[ind]} L${level} (iron ×1)`, undefined, 'develop', { name: p.name, industry: ind, level });
    p.stats.developed += 1;
  });
  discardCard(s, p, card.id);
  s.fxSeq += 1;
  s.lastFx = { kind: 'develop', at: [800, 550], player: playerIdx };
  return true;
}

/** sell one tile (beer plan recomputed against the live state) */
/** the beer a sale at `town` through `merchantId` may drink: the merchant's own
 *  barrel (its bonus with it), the player's breweries anywhere, another's
 *  the tile is connected to */
export function saleBeerSources(s: GameState, playerIdx: number, town: string, merchantId: string, industry: IndustryType): { key: string; kind: 'merchant' | 'brewery'; town?: string; slot?: number; owner?: number; cubes: number }[] {
  const out: ReturnType<typeof saleBeerSources> = [];
  for (const slot of merchantBarrelsFor(s, merchantId, industry)) out.push({ key: `merchant:${slot}`, kind: 'merchant', slot, cubes: 1 });
  const reach = reachable(s, town, s.era, null);
  for (const [key, t] of Object.entries(s.tiles)) {
    if (t.industry !== 'brewery' || t.flipped || t.cubes <= 0) continue;
    const at = key.split(':')[0];
    if (t.owner !== playerIdx && !reach.has(at)) continue;
    out.push({ key, kind: 'brewery', town: at, slot: Number(key.split(':')[1]), owner: t.owner, cubes: t.cubes });
  }
  return out.sort((a, b) => Number(b.kind === 'merchant') - Number(a.kind === 'merchant') || Number(b.owner === playerIdx) - Number(a.owner === playerIdx));
}

/** the beer plan of a sale with the sources the player named, each checked
 *  against what the rules allow; whatever is left unnamed the engine fills */
export function planSaleBeer(s: GameState, playerIdx: number, town: string, merchantId: string, industry: IndustryType, needed: number, beerFrom: (string | null)[] = []): { sources: BeerSource[]; shortage: number } {
  const allowed = new Map(saleBeerSources(s, playerIdx, town, merchantId, industry).map((b) => [b.key, b]));
  const reserved = new Map<string, number>();
  const sources: BeerSource[] = [];
  for (let k = 0; k < needed; k++) {
    const name = beerFrom[k];
    const b = name ? allowed.get(name) : undefined;
    if (!b) continue;
    const tag = b.kind === 'merchant' ? `beer:${barrelKey(merchantId, b.slot!)}` : b.key;
    if (b.cubes - (reserved.get(tag) ?? 0) <= 0) continue;
    reserved.set(tag, (reserved.get(tag) ?? 0) + 1);
    sources.push(b.kind === 'merchant' ? { kind: 'merchant', merchant: merchantId, slot: b.slot } : { kind: 'brewery', town: b.town, slot: b.slot });
  }
  if (sources.length >= needed) return { sources, shortage: 0 };
  const rest = planBeer(s, playerIdx, town, merchantId, needed - sources.length, [], reserved, industry);
  return { sources: [...sources, ...rest.sources], shortage: rest.shortage };
}

function sellOne(s: GameState, playerIdx: number, target: SellTarget, named: (string | null)[] = []): boolean {
  const p = s.players[playerIdx];
  const key = tileKey(target.town, target.slot);
  const tile = s.tiles[key];
  if (!tile || tile.owner !== playerIdx || tile.flipped) return false;
  const lv = INDUSTRIES[tile.industry][tile.level - 1];
  if (!merchantOpen(s, target.merchant) || !merchantDemand(s, target.merchant).includes(tile.industry)) return false;
  if (!reachable(s, target.town, s.era, null).has(target.merchant)) return false;
  const beer = planSaleBeer(s, playerIdx, target.town, target.merchant, target.tile.industry, lv.beerToSell, named);
  if (beer.shortage > 0) return false;
  /* beer drawn from another player's brewery: their loss to know about */
  const beerFrom = beer.sources
    .filter((b) => b.kind === 'brewery' && s.tiles[tileKey(b.town!, b.slot!)]?.owner !== playerIdx)
    .map((b) => `${s.tiles[tileKey(b.town!, b.slot!)].owner}:${b.town}`)
    .join(',');
  const bonus = drinkBeer(s, playerIdx, beer.sources);
  flipTile(s, key, 'merchant', MERCHANT_BY_ID[target.merchant].name);
  p.stats.sold += 1;
  s.fxSeq += 1;
  s.lastFx = { kind: 'sell', at: slotXY(target.town, target.slot), player: playerIdx };
  log(s, playerIdx, 'sell', `${p.name} sells ${INDUSTRY_LABEL[tile.industry]} L${tile.level} to ${MERCHANT_BY_ID[target.merchant].name} (${lv.beerToSell} beer${bonus.said})`, target.town, 'sell', {
    name: p.name,
    industry: tile.industry,
    level: tile.level,
    merchant: MERCHANT_BY_ID[target.merchant].name,
    merchantId: target.merchant,
    beer: lv.beerToSell,
    bonusVp: bonus.vp,
    bonusMoney: bonus.money,
    bonusIncome: bonus.income,
    bonusDevelop: bonus.develop ? 1 : 0,
    barrels: bonus.barrels,
    beerFrom,
  });
  return true;
}

/** Sell: one card, any number of tiles (each with its own beer) */
export function applySell(s: GameState, playerIdx: number, card: Card, targets: SellTarget | SellTarget[], beerFrom: (string | null)[][] = []): boolean {
  const list = Array.isArray(targets) ? targets : [targets];
  if (!list.length) return false;
  let sold = 0;
  list.forEach((t, i) => {
    if (sellOne(s, playerIdx, t, beerFrom[i] ?? [])) sold += 1;
  });
  /* a sale is begun only if every tile of it can drink its beer (§5.5):
     each tile drinks what the ones before it left, and one of them going
     dry refuses the whole action — never half of it, in silence */
  if (firstEdition(s) ? !sold : sold !== list.length) return false;
  discardCard(s, s.players[playerIdx], card.id);
  return true;
}

/** how many of these sales, taken in order, the beer reaches: each drinks
 *  what the ones before it left. Read on a copy — the table is not touched */
export function salesThatStand(s: GameState, playerIdx: number, targets: SellTarget[], beerFrom: (string | null)[][] = []): number {
  const mut = cloneState(s);
  let n = 0;
  for (const [i, t] of targets.entries()) {
    if (!sellOne(mut, playerIdx, t, beerFrom[i] ?? [])) break;
    n += 1;
  }
  return n;
}

export function applyLoan(s: GameState, playerIdx: number, card?: Card): boolean {
  const p = s.players[playerIdx];
  const landing = loanLanding(p.income);
  if (landing === null) return false;
  /* the purse it was taken from, for whoever explains the loan */
  const purse = p.money;
  p.money += LOAN_AMOUNT;
  const before = incomeLevel(p.income);
  p.income = landing;
  p.loans += 1;
  p.stats.loans += 1;
  p.incomeHistory.push(p.income);
  if (card) discardCard(s, p, card.id);
  else if (p.hand[0]) discardCard(s, p, p.hand[0].id); // APPROX: the engine discards the first card
  log(s, playerIdx, 'loan', `${p.name} borrows £${LOAN_AMOUNT} — income falls from level ${before} to ${incomeLevel(p.income)}`, undefined, 'loan', { name: p.name, amount: LOAN_AMOUNT, from: before, to: incomeLevel(p.income), purse });
  return true;
}

export function applyScout(s: GameState, playerIdx: number, cardIds: string[]): boolean {
  const p = s.players[playerIdx];
  if (cardIds.length !== 3 || !canScout(s, playerIdx).ok) return false;
  if (cardIds.some((id) => !p.hand.some((c) => c.id === id))) return false;
  for (const id of cardIds) discardCard(s, p, id);
  s.wildLeft.location -= 1;
  s.wildLeft.industry -= 1;
  const tag = `${s.ledgerSeq.toString(36)}`;
  p.hand.push({ id: `wild-loc-${tag}`, kind: 'wild-location' }, { id: `wild-ind-${tag}`, kind: 'wild-industry' });
  log(s, playerIdx, 'scout', `${p.name} scouts the territory — takes both wild cards`, undefined, 'scout', { name: p.name });
  return true;
}

/** passing still costs a card */
export function applyPass(s: GameState, playerIdx: number, cardId?: string, reason?: string): boolean {
  const p = s.players[playerIdx];
  const card = (cardId && p.hand.find((c) => c.id === cardId)) || p.hand[0];
  if (card) discardCard(s, p, card.id);
  log(s, playerIdx, 'pass', reason ?? `${p.name} passes${card ? ' and discards a card' : ''}.`, undefined, reason ? 'candle' : 'pass', { name: p.name, card: card ? 1 : 0 });
  return true;
}

/** a vote to abandon: every human must agree; one refusal clears the
 *  proposal. Bots never object. When the table folds the game is scored
 *  as it stands. */
export function applyConcede(s: GameState, playerIdx: number, vote: 'yes' | 'no'): void {
  const p = s.players[playerIdx];
  const humans = s.players.map((_, i) => i).filter((i) => !s.players[i].isBot);
  if (vote === 'no') {
    s.concessions = [];
    log(s, playerIdx, 'system', `${p.name} refuses to fold — the game goes on.`, undefined, 'refuse', { name: p.name });
    return;
  }
  const votes = new Set(s.concessions ?? []);
  votes.add(playerIdx);
  s.concessions = [...votes].sort((a, b) => a - b);
  if (humans.every((i) => votes.has(i))) {
    s.abandoned = true;
    log(s, playerIdx, 'system', `${p.name} folds too: the table abandons the game.`, undefined, 'fold', { name: p.name });
    finishGame(s);
    return;
  }
  log(s, playerIdx, 'system', `${p.name} proposes to abandon the game (${votes.size} of ${humans.length} agree).`, undefined, 'propose', { name: p.name, n: votes.size, h: humans.length });
}

/** a seat left for good: a machine takes the chair and plays it out. With
 *  nobody human left — or every human left having already voted to fold —
 *  the table abandons the game. */
export function applyResign(s: GameState, playerIdx: number): void {
  const p = s.players[playerIdx];
  p.isBot = true;
  p.resigned = true;
  const votes = (s.concessions ?? []).filter((i) => i !== playerIdx);
  s.concessions = votes;
  log(s, playerIdx, 'system', `${p.name} leaves the table — a machine takes the chair.`, undefined, 'resign', { name: p.name });
  const humans = s.players.map((_, i) => i).filter((i) => !s.players[i].isBot);
  if (humans.length === 0 || humans.every((i) => votes.includes(i))) {
    s.abandoned = true;
    log(s, playerIdx, 'system', 'Nobody is left to play: the table abandons the game.', undefined, 'deserted');
    finishGame(s);
  }
}

/* ========================== turn & era flow ======================== */

export function drawUp(s: GameState, p: PlayerState) {
  while (p.hand.length < HAND_SIZE && s.deck.length > 0) p.hand.push(s.deck.shift()!);
}

/** actions a player gets on their turn: 2 (1 in the first canal round), never more than cards in hand */
export function actionsFor(s: GameState, p: PlayerState): number {
  const base = s.era === 'canal' && s.round === 1 ? 1 : 2;
  return Math.min(base, p.hand.length);
}

const eraOver = (s: GameState) => s.deck.length === 0 && s.players.every((p) => p.hand.length === 0);

/** payday; negative income is paid, tiles sold off at half cost, then VP lost */
function payday(s: GameState) {
  for (const pl of s.players) {
    const pay = INCOME_PAYOUT[pl.income];
    pl.money += pay;
    if (pl.money >= 0) continue;
    const idx = s.players.indexOf(pl);
    // APPROX: the engine liquidates the cheapest tiles first
    const own = Object.entries(s.tiles)
      .filter(([, t]) => t.owner === idx)
      .map(([key, t]) => ({ key, t, value: Math.floor(INDUSTRIES[t.industry][t.level - 1].cost / 2) }))
      .sort((a, b) => a.value - b.value);
    for (const o of own) {
      if (pl.money >= 0) break;
      delete s.tiles[o.key];
      pl.money += o.value;
      log(s, idx, 'system', `${pl.name} sells off ${INDUSTRY_LABEL[o.t.industry]} L${o.t.level} for £${o.value} to cover the shortfall`, o.key.split(':')[0], 'sellOff', { name: pl.name, industry: o.t.industry, level: o.t.level, value: o.value });
    }
    if (pl.money < 0) {
      pl.vp -= -pl.money;
      log(s, idx, 'system', `${pl.name} is £${-pl.money} short — loses ${-pl.money} VP`, undefined, 'short', { name: pl.name, amount: -pl.money });
      pl.money = 0;
    }
  }
  log(s, undefined, 'system', 'Payday — the counting-houses settle up.', undefined, 'payday', {});
}

/** one line of the game's account book: where everyone stands after this round */
function snapshot(s: GameState) {
  s.history.push({
    era: s.era,
    round: s.round,
    vp: s.players.map((p) => p.vp),
    income: s.players.map((p) => incomeLevel(p.income)),
    money: s.players.map((p) => p.money),
  });
}

/** end of round: turn order by money spent (least first, ties keep order), payday, era check */
function endRound(s: GameState) {
  const sorted = [...s.order].sort((a, b) => s.players[a].spent - s.players[b].spent);
  s.order = sorted;
  s.lastSpent = s.players.map((p) => p.spent);
  for (const p of s.players) p.spent = 0;

  const over = eraOver(s);
  const lastRoundOfGame = over && (s.era === 'rail' || s.eraLength === 'short');
  if (!lastRoundOfGame) payday(s);

  if (over) {
    if (s.era === 'canal') {
      scoreEra(s, 'canal');
      snapshot(s);
      s.phase = 'scoring-canal';
      return;
    }
    scoreEra(s, 'rail');
    snapshot(s);
    finishGame(s);
    return;
  }
  snapshot(s);
  s.round += 1;
  s.turnPos = 0;
  s.current = s.order[0];
  s.actionsLeft = actionsFor(s, s.players[s.current]);
  skipEmptyHands(s);
}

/** players with no cards left take no turn */
function skipEmptyHands(s: GameState) {
  let guard = 0;
  while (s.actionsLeft === 0 && s.phase === 'action' && guard++ < s.players.length) {
    s.turnPos += 1;
    if (s.turnPos >= s.order.length) {
      endRound(s);
      return;
    }
    s.current = s.order[s.turnPos];
    s.actionsLeft = actionsFor(s, s.players[s.current]);
  }
}

/** call after each confirmed action; handles turn/round/era transitions */
export function advance(s: GameState): GameState {
  s.actionsLeft = Math.max(0, s.actionsLeft - 1);
  const p = s.players[s.current];
  if (s.actionsLeft > 0 && p.hand.length > 0) return s;

  drawUp(s, p);
  s.turnPos += 1;
  if (s.turnPos >= s.order.length) {
    endRound(s);
    return s;
  }
  s.current = s.order[s.turnPos];
  s.actionsLeft = actionsFor(s, s.players[s.current]);
  skipEmptyHands(s);
  return s;
}

/** the canal ceremony is over: sweep, re-arm, re-deal — or end a Canal-only game */
export function beginRailEra(s: GameState) {
  if (s.eraLength === 'short') {
    canalOnlyBonus(s);
    finishGame(s);
    return;
  }
  // the sweep: every level-1 tile leaves the board
  let removed = 0;
  for (const [key, tile] of Object.entries(s.tiles)) {
    if (tile.level === 1) {
      delete s.tiles[key];
      removed += 1;
    }
  }
  // merchants re-arm one barrel beside every tile that is not blank
  s.merchantBeer = {};
  for (const [id, tiles] of Object.entries(s.merchantTiles)) tiles.forEach((t, i) => { if (t !== 'blank') s.merchantBeer[barrelKey(id, i)] = 1; });
  s.merchantBonusTaken = {};
  // every discard (face-down openers included) becomes the rail deck
  const all = [...s.deck, ...s.discard];
  for (const p of s.players) all.push(...p.hand.splice(0));
  s.deck = shuffle(all, rng(s.seed + 77));
  s.discard = [];
  s.era = 'rail';
  s.round = 1;
  /* eight cards each and no more: the face-down openers went into the
     shuffle above, and none is laid aside again */
  dealHands(s, firstEdition(s));
  s.turnPos = 0;
  s.current = s.order[0];
  s.actionsLeft = actionsFor(s, s.players[s.current]);
  s.phase = 'action';
  log(s, undefined, 'system', `The sweep takes ${removed} level-1 works. Merchants restock their beer. THE RAIL ERA begins.`, undefined, 'sweep', { removed });
}

/** link icons of the tiles sitting at a node (merchant locations print 2) */
function linkIconsAt(s: GameState, node: string): number {
  if (MERCHANT_BY_ID[node]) return 2;
  let n = 0;
  for (const [key, t] of Object.entries(s.tiles)) {
    if (key.split(':')[0] === node) n += INDUSTRIES[t.industry][t.level - 1].links;
  }
  return n;
}

export interface EraProjection {
  links: number;
  tiles: number;
  /** unflipped tiles: what is still on the table */
  pending: number;
  total: number;
}

/** what each player would score if the era ended now (pure — no mutation) */
export function projectEraScores(s: GameState): EraProjection[] {
  return s.players.map((_, i) => {
    let links = 0;
    // link tiles: 1 VP per link icon in adjacent locations
    for (const [id, l] of Object.entries(s.links)) {
      if (l.owner !== i) continue;
      const def = LINKS.find((d) => d.id === id)!;
      links += linkIconsAt(s, def.a) + linkIconsAt(s, def.b);
      if (def.alsoConnects) links += linkIconsAt(s, def.alsoConnects);
    }
    let tiles = 0;
    let pending = 0;
    // flipped industry tiles score their printed VP
    for (const t of Object.values(s.tiles)) {
      if (t.owner !== i) continue;
      if (t.flipped) tiles += INDUSTRIES[t.industry][t.level - 1].vp;
      else pending += INDUSTRIES[t.industry][t.level - 1].vp;
    }
    return { links, tiles, pending, total: links + tiles };
  });
}

/** next round's turn order: least money spent first, ties keep today's order */
export function projectedOrder(s: GameState): number[] {
  return [...s.order].sort((a, b) => s.players[a].spent - s.players[b].spent);
}

export function scoreEra(s: GameState, era: Era): number[] {
  const projection = projectEraScores(s);
  const scores = projection.map((pr, i) => {
    s.players[i].vp += pr.total;
    return pr.total;
  });
  // link tiles come off the board after scoring
  s.links = {};
  if (era === 'canal') {
    s.canalScores = scores;
    /* the links leave the board with the era: the split cannot be read back */
    s.canalSplit = projection.map((pr) => ({ links: pr.links, tiles: pr.tiles, pending: pr.pending }));
  } else {
    s.finalScores = scores;
    s.finalSplit = projection.map((pr) => ({ links: pr.links, tiles: pr.tiles, pending: pr.pending }));
  }
  log(s, undefined, 'score', `${era === 'canal' ? 'Canal' : 'Rail'} Era scoring: ${scores.map((v, i) => `${s.players[i].name} +${v}`).join(' · ')}`, undefined, 'eraScore', { era, scores: scores.map((v, i) => `${s.players[i].name} +${v}`).join(' · ') });
  return scores;
}

/** Canal-only (beginner) game: +1 VP per £4 (max 15), + income level, level 2+ tiles score again */
function canalOnlyBonus(s: GameState) {
  s.players.forEach((p, i) => {
    let extra = Math.min(15, Math.floor(p.money / 4)) + incomeLevel(p.income);
    for (const t of Object.values(s.tiles)) if (t.owner === i && t.flipped && t.level >= 2) extra += INDUSTRIES[t.industry][t.level - 1].vp;
    p.vp += extra;
    log(s, i, 'score', `${p.name} closes the books: ${extra >= 0 ? '+' : ''}${extra} VP (money, income level, level 2+ works)`, undefined, 'books', { name: p.name, extra: `${extra >= 0 ? '+' : ''}${extra}` });
  });
}

export function finishGame(s: GameState) {
  s.phase = 'game-over';
  // ties: highest income level, then most money
  let best = 0;
  s.players.forEach((p, i) => {
    const b = s.players[best];
    if (p.vp > b.vp || (p.vp === b.vp && (incomeLevel(p.income) > incomeLevel(b.income) || (incomeLevel(p.income) === incomeLevel(b.income) && p.money > b.money)))) best = i;
  });
  s.winner = best;
  log(s, undefined, 'score', `${s.players[best].name} is Master of the Midlands with ${s.players[best].vp} VP!`, undefined, 'master', { name: s.players[best].name, vp: s.players[best].vp });
}

/* ========================== persistence ============================ */

/** the minutes this seat's candle burns — its own, else the table's; 0/null = none */
/** The victory-point track is worth its strip of screen once points are
 *  on the board: from the first bonus scored, the canal scoring, or the
 *  rail era. Before that it would be a row of zeros. */
export function vpTrackShown(s: GameState): boolean {
  return s.era === 'rail' || s.phase !== 'action' || s.players.some((p) => p.vp > 0);
}

export function candleMinutes(s: GameState, playerIdx: number): number | null {
  const own = s.players[playerIdx]?.minutes;
  return own === undefined ? s.timerMinutes : own;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string): GameState | null {
  try {
    const s = JSON.parse(raw) as GameState;
    /* v5 kept one count of barrels a merchant; v6 stands each beside its
       tile. An old register is read on: the barrels left go to the first
       tiles that are not blank */
    if (s.version === 5 && s.merchantTiles && s.merchantBeer) {
      const beer: Record<string, number> = {};
      for (const [id, tiles] of Object.entries(s.merchantTiles as Record<string, MerchantTile[]>)) {
        let left = Number((s.merchantBeer as Record<string, number>)[id] ?? 0);
        tiles.forEach((t, i) => {
          if (t === 'blank') return;
          beer[barrelKey(id, i)] = left > 0 ? 1 : 0;
          left -= 1;
        });
      }
      s.merchantBeer = beer;
      s.version = 6;
    }
    if (!s.players || !s.tiles || !s.ledger || s.version !== ENGINE_VERSION) return null;
    /* a game read off the shelf stands where it was played, not where the
       last game happened to leave the module */
    setBoard(s.board);
    return s;
  } catch {
    return null;
  }
}

export { PLAYER_COLORS };
