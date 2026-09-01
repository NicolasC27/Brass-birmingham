/* ------------------------------------------------------------------ */
/* BRASSWORKS — game data: Midlands board, industries, decks, market.  */
/* Values follow game.md §13 (approximate Brass: Birmingham table).    */
/* Geography: AUTHENTIC Roxley board (research/board-data.md) —        */
/* 20 towns + 2 farm breweries, 5 edge merchants, 39 era-tagged links, */
/* normalized to a 3200×1800 16:9 world (authentic 1600×1100 layout    */
/* ×2.0 / ×1.6364 — v13 "maximum air": everything ×1.25 from v11 so    */
/* clusters read as small islands in open country). Remaining           */
/* (merchant tile mix, merchant availability by player count, market   */
/* sizes, fixed turn order) are tagged with the beta ribbon pattern.   */
/* ------------------------------------------------------------------ */

import type {
  Card,
  IndustryLevel,
  IndustryType,
  LinkDef,
  Merchant,
  MerchantTile,
  Resource,
  Town,
} from './types';

/* ------------------------- industry tables ------------------------ */

/* Official Brass: Birmingham player-mat tiles (brass/game-data.md §3).
 * Rows are the tile LEVELS in mat order; `count` = tiles of that level per
 * player; `links` = link icons (VP each adjacent Link tile scores);
 * `incomeDelta` = SPACES on the progress track; `cubes` = coal/iron placed
 * on build (breweries: 1 barrel in the Canal Era, 2 in the Rail Era);
 * `eras` = when the tile may be built; `noDevelop` = lightbulb tiles. */
export const INDUSTRIES: Record<IndustryType, IndustryLevel[]> = {
  cotton: [
    { level: 1, cost: 12, coal: 0, iron: 0, beerToSell: 1, incomeDelta: 5, vp: 5, links: 1, cubes: 0, count: 3, eras: ['canal'] },
    { level: 2, cost: 14, coal: 1, iron: 0, beerToSell: 1, incomeDelta: 4, vp: 5, links: 2, cubes: 0, count: 2, eras: ['canal', 'rail'] },
    { level: 3, cost: 16, coal: 1, iron: 1, beerToSell: 1, incomeDelta: 3, vp: 9, links: 1, cubes: 0, count: 3, eras: ['canal', 'rail'] },
    { level: 4, cost: 18, coal: 1, iron: 1, beerToSell: 1, incomeDelta: 2, vp: 12, links: 1, cubes: 0, count: 3, eras: ['canal', 'rail'] },
  ],
  manufacturer: [
    { level: 1, cost: 8, coal: 1, iron: 0, beerToSell: 1, incomeDelta: 5, vp: 3, links: 2, cubes: 0, count: 1, eras: ['canal'] },
    { level: 2, cost: 10, coal: 0, iron: 1, beerToSell: 1, incomeDelta: 1, vp: 5, links: 1, cubes: 0, count: 2, eras: ['canal', 'rail'] },
    { level: 3, cost: 12, coal: 2, iron: 0, beerToSell: 1, incomeDelta: 4, vp: 4, links: 0, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 4, cost: 8, coal: 0, iron: 1, beerToSell: 1, incomeDelta: 6, vp: 3, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 5, cost: 16, coal: 1, iron: 0, beerToSell: 2, incomeDelta: 2, vp: 8, links: 2, cubes: 0, count: 2, eras: ['canal', 'rail'] },
    { level: 6, cost: 20, coal: 0, iron: 0, beerToSell: 1, incomeDelta: 6, vp: 7, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 7, cost: 16, coal: 1, iron: 1, beerToSell: 1, incomeDelta: 4, vp: 9, links: 0, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 8, cost: 20, coal: 0, iron: 2, beerToSell: 1, incomeDelta: 1, vp: 11, links: 1, cubes: 0, count: 2, eras: ['canal', 'rail'] },
  ],
  coal: [
    { level: 1, cost: 5, coal: 0, iron: 0, beerToSell: 0, incomeDelta: 4, vp: 1, links: 2, cubes: 2, count: 1, eras: ['canal'] },
    { level: 2, cost: 7, coal: 0, iron: 0, beerToSell: 0, incomeDelta: 7, vp: 2, links: 1, cubes: 3, count: 2, eras: ['canal', 'rail'] },
    { level: 3, cost: 8, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 6, vp: 3, links: 1, cubes: 4, count: 2, eras: ['canal', 'rail'] },
    { level: 4, cost: 10, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 5, vp: 4, links: 1, cubes: 5, count: 2, eras: ['canal', 'rail'] },
  ],
  iron: [
    { level: 1, cost: 5, coal: 1, iron: 0, beerToSell: 0, incomeDelta: 3, vp: 3, links: 1, cubes: 4, count: 1, eras: ['canal'] },
    { level: 2, cost: 7, coal: 1, iron: 0, beerToSell: 0, incomeDelta: 3, vp: 5, links: 1, cubes: 4, count: 1, eras: ['canal', 'rail'] },
    { level: 3, cost: 9, coal: 1, iron: 0, beerToSell: 0, incomeDelta: 2, vp: 7, links: 1, cubes: 5, count: 1, eras: ['canal', 'rail'] },
    { level: 4, cost: 12, coal: 1, iron: 0, beerToSell: 0, incomeDelta: 1, vp: 9, links: 1, cubes: 6, count: 1, eras: ['canal', 'rail'] },
  ],
  pottery: [
    { level: 1, cost: 17, coal: 0, iron: 1, beerToSell: 1, incomeDelta: 5, vp: 10, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'], noDevelop: true },
    { level: 2, cost: 0, coal: 1, iron: 0, beerToSell: 1, incomeDelta: 1, vp: 1, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 3, cost: 22, coal: 2, iron: 0, beerToSell: 2, incomeDelta: 5, vp: 11, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'], noDevelop: true },
    { level: 4, cost: 0, coal: 1, iron: 0, beerToSell: 1, incomeDelta: 1, vp: 1, links: 1, cubes: 0, count: 1, eras: ['canal', 'rail'] },
    { level: 5, cost: 24, coal: 2, iron: 0, beerToSell: 2, incomeDelta: 5, vp: 20, links: 1, cubes: 0, count: 1, eras: ['rail'] },
  ],
  brewery: [
    { level: 1, cost: 5, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 4, vp: 4, links: 2, cubes: 1, count: 2, eras: ['canal'] },
    { level: 2, cost: 7, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 5, vp: 5, links: 2, cubes: 1, count: 2, eras: ['canal', 'rail'] },
    { level: 3, cost: 9, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 5, vp: 7, links: 2, cubes: 1, count: 2, eras: ['canal', 'rail'] },
    { level: 4, cost: 9, coal: 0, iron: 1, beerToSell: 0, incomeDelta: 5, vp: 9, links: 2, cubes: 1, count: 1, eras: ['rail'] },
  ],
};

/** a fresh player mat: every level repeated `count` times, lowest first */
export function freshStacks(): Record<IndustryType, number[]> {
  const out = {} as Record<IndustryType, number[]>;
  for (const ind of Object.keys(INDUSTRIES) as IndustryType[]) {
    out[ind] = INDUSTRIES[ind].flatMap((lv) => Array.from({ length: lv.count }, () => lv.level));
  }
  return out;
}

/** barrels a brewery receives on build: 1 in the Canal Era, 2 in the Rail Era */
export const breweryBarrels = (era: 'canal' | 'rail'): number => (era === 'canal' ? 1 : 2);

export const INDUSTRY_LABEL: Record<IndustryType, string> = {
  coal: 'Coal Mine',
  iron: 'Iron Works',
  brewery: 'Brewery',
  cotton: 'Cotton Mill',
  manufacturer: 'Manufactory',
  pottery: 'Pottery',
};

export const INDUSTRY_ICON: Record<IndustryType, string> = {
  coal: '/icon-coal.svg',
  iron: '/icon-iron.svg',
  brewery: '/icon-brewery.svg',
  cotton: '/icon-cotton.svg',
  manufacturer: '/icon-manufacture.svg',
  pottery: '/icon-pottery.svg',
};

/* ------------------ towns (20) + farm breweries (2) ---------------- */
/* Authentic Roxley geography (research/board-data.md §1, §5).         */
/* Literal coordinates below = location centres on the ORIGINAL        */
/* 1600×1100 canvas; they are scaled to the 3200×1800 world by SX/SY.  */
/* Industry spaces in board order (left-to-right, top-to-bottom);      */
/* sockets are laid out around the medallion by SLOT_LAYOUT.           */

/** world upscale: 1600×1100 → 3200×1800 (v13: maximum air — ×2.0/×1.6364,
 * i.e. ×1.25 on both axes from the v11 2560×1440 world; every inter-town
 * distance grows 25% while clusters shrink, brassforge-style spacing) */
const SX = 3200 / 1600;
const SY = 1800 / 1100;
const wx = (x: number): number => Math.round(x * SX);
const wy = (y: number): number => Math.round(y * SY);

/** socket offsets per town slot-count (sockets are 64×44, medallion r=22) */
const SLOT_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, -70]],
  2: [[-74, -26], [74, 26]],
  3: [[0, -78], [-78, 34], [78, 34]],
  4: [[-44, -78], [44, -78], [-82, 34], [82, 34]],
};

type Space = IndustryType[];

const TOWN_DEFS: { id: string; name: string; x: number; y: number; spaces: Space[]; farm?: boolean }[] = [
  // Derbyshire (teal) — location cards only at 4 players
  // v12: Belper 92 → 100 (+11px world) so its cluster clears the top edge
  { id: 'belper', name: 'Belper', x: 1074, y: 100, spaces: [['cotton', 'manufacturer'], ['coal'], ['pottery']] },
  { id: 'derby', name: 'Derby', x: 1083, y: 261, spaces: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']] },
  // Staffordshire (blue) — cards at 3–4 players
  { id: 'leek', name: 'Leek', x: 843, y: 87, spaces: [['cotton', 'manufacturer'], ['cotton', 'coal']] },
  { id: 'stoke', name: 'Stoke-on-Trent', x: 698, y: 156, spaces: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']] },
  { id: 'stone', name: 'Stone', x: 590, y: 280, spaces: [['cotton', 'brewery'], ['manufacturer', 'coal']] },
  { id: 'uttoxeter', name: 'Uttoxeter', x: 870, y: 266, spaces: [['manufacturer', 'brewery'], ['cotton', 'brewery']] },
  // West Midlands (maroon)
  { id: 'stafford', name: 'Stafford', x: 689, y: 385, spaces: [['manufacturer', 'brewery'], ['pottery']] },
  { id: 'burton', name: 'Burton-on-Trent', x: 996, y: 417, spaces: [['manufacturer', 'coal'], ['brewery']] },
  { id: 'cannock', name: 'Cannock', x: 762, y: 500, spaces: [['manufacturer', 'coal'], ['coal']] },
  { id: 'tamworth', name: 'Tamworth', x: 1023, y: 564, spaces: [['cotton', 'coal'], ['cotton', 'coal']] },
  { id: 'walsall', name: 'Walsall', x: 822, y: 614, spaces: [['iron', 'manufacturer'], ['manufacturer', 'brewery']] },
  // Black Country (brown)
  { id: 'wolverhampton', name: 'Wolverhampton', x: 657, y: 591, spaces: [['manufacturer'], ['manufacturer', 'coal']] },
  { id: 'coalbrookdale', name: 'Coalbrookdale', x: 510, y: 619, spaces: [['iron', 'brewery'], ['iron'], ['coal']] },
  { id: 'dudley', name: 'Dudley', x: 704, y: 729, spaces: [['coal'], ['iron']] },
  { id: 'kidderminster', name: 'Kidderminster', x: 629, y: 839, spaces: [['cotton', 'coal'], ['cotton']] },
  { id: 'worcester', name: 'Worcester', x: 652, y: 985, spaces: [['cotton'], ['cotton']] },
  // Birmingham region (purple)
  { id: 'birmingham', name: 'Birmingham', x: 913, y: 756, spaces: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']] },
  { id: 'coventry', name: 'Coventry', x: 1130, y: 784, spaces: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']] },
  { id: 'nuneaton', name: 'Nuneaton', x: 1119, y: 669, spaces: [['manufacturer', 'brewery'], ['cotton', 'coal']] },
  { id: 'redditch', name: 'Redditch', x: 886, y: 894, spaces: [['manufacturer', 'coal'], ['iron']] },
  // Farm breweries — single brewery socket, industry cards only
  { id: 'farm-n', name: 'Farm Brewery', x: 580, y: 477, spaces: [['brewery']], farm: true },
  // v12: farm-s (535,917) → (500,930): its wide ribbon quasi-touched both
  // Kidderminster (4px) and Worcester (4px); shifted SW into open country
  { id: 'farm-s', name: 'Farm Brewery', x: 500, y: 930, spaces: [['brewery']], farm: true },
];

export const TOWNS: Town[] = TOWN_DEFS.map((d) => {
  const layout = SLOT_LAYOUT[d.spaces.length];
  return {
    id: d.id,
    name: d.name,
    x: wx(d.x),
    y: wy(d.y),
    farm: d.farm,
    slots: d.spaces.map((allows, i) => ({
      allows,
      x: wx(d.x + layout[i][0]),
      y: wy(d.y + layout[i][1]),
    })),
  };
});

/* --------------------------- merchants (5) ------------------------ */
/* Authentic edge merchants (research/board-data.md §3).               */
/* Demand is NOT printed here: the 9 official merchant tiles are        */
/* shuffled at setup (merchantTilePool) and dealt one per slot; every   */
/* non-blank tile brings one beer barrel. Warrington opens at 3+        */
/* players, Nottingham at 4 (game-data.md §1.3).                        */

export const MERCHANTS: Merchant[] = [
  {
    id: 'm-warrington',
    name: 'Warrington',
    x: wx(551),
    y: wy(119),
    slots: 2,
    minPlayers: 3,
    bonus: { money: 5 },
    bonusLabel: '£5',
  },
  {
    id: 'm-nottingham',
    name: 'Nottingham',
    x: wx(1243),
    y: wy(197),
    slots: 2,
    minPlayers: 4,
    bonus: { vp: 3 },
    bonusLabel: '+3 VP',
  },
  {
    id: 'm-shrewsbury',
    name: 'Shrewsbury',
    x: wx(354),
    y: wy(632),
    slots: 1,
    minPlayers: 2,
    bonus: { vp: 4 },
    bonusLabel: '+4 VP',
  },
  {
    id: 'm-oxford',
    name: 'Oxford',
    x: wx(1152),
    y: wy(944),
    slots: 2,
    minPlayers: 2,
    bonus: { income: 2 },
    bonusLabel: '+2 income',
  },
  {
    id: 'm-gloucester',
    name: 'Gloucester',
    // v12: 1040 → 1024 (−21px world) so the sign + barrels clear the bottom edge
    x: wx(872),
    y: wy(1024),
    slots: 2,
    minPlayers: 2,
    bonus: { develop: true },
    bonusLabel: 'Develop',
  },
];

/* ------------------------------ links ------------------------------ */
/* 39 printed link spaces (research/board-data.md §2):                 */
/* 30 both-era, 8 rail-only, 1 canal-only (Burton-on-Trent ⇄ Walsall). */

const L = (
  a: string,
  b: string,
  opts: { canal?: boolean; rail?: boolean; path?: [number, number][]; alsoConnects?: string } = {},
): LinkDef => ({
  id: `${a}--${b}`,
  a,
  b,
  canal: opts.canal ?? true,
  rail: opts.rail ?? true,
  path: opts.path,
  alsoConnects: opts.alsoConnects,
});

export const LINKS: LinkDef[] = [
  /* --- both eras (30) --- */
  L('m-warrington', 'stoke'),
  L('stoke', 'leek'),
  L('belper', 'derby'),
  L('derby', 'm-nottingham'),
  L('derby', 'burton'),
  L('stoke', 'stone'),
  L('stone', 'stafford'),
  L('stone', 'burton'),
  L('stafford', 'cannock'),
  L('cannock', 'farm-n'),
  L('cannock', 'wolverhampton'),
  L('cannock', 'walsall'),
  L('burton', 'tamworth'),
  L('tamworth', 'nuneaton'),
  L('tamworth', 'birmingham'),
  L('coventry', 'birmingham'),
  L('birmingham', 'm-oxford', { path: [[wx(913), wy(756)], [wx(1060), wy(828)], [wx(1152), wy(944)]] }),
  L('redditch', 'm-oxford'),
  L('redditch', 'm-gloucester'),
  L('birmingham', 'walsall'),
  L('walsall', 'wolverhampton'),
  L('wolverhampton', 'coalbrookdale'),
  L('coalbrookdale', 'm-shrewsbury'),
  L('coalbrookdale', 'kidderminster'),
  L('wolverhampton', 'dudley'),
  L('birmingham', 'dudley'),
  L('dudley', 'kidderminster'),
  // rules: this one link also connects Kidderminster AND Worcester to farm-s
  L('kidderminster', 'worcester', { alsoConnects: 'farm-s' }),
  L('birmingham', 'worcester', { path: [[wx(913), wy(756)], [wx(760), wy(880)], [wx(652), wy(985)]] }),
  L('worcester', 'm-gloucester'),
  /* --- rail only (8) --- */
  L('leek', 'belper', { canal: false }),
  L('derby', 'uttoxeter', { canal: false }),
  L('uttoxeter', 'stone', { canal: false }),
  L('burton', 'cannock', { canal: false }),
  L('tamworth', 'walsall', { canal: false }),
  L('nuneaton', 'coventry', { canal: false }),
  L('nuneaton', 'birmingham', { canal: false }),
  L('birmingham', 'redditch', { canal: false }),
  /* --- canal only (1) --- */
  L('burton', 'walsall', { rail: false, path: [[wx(996), wy(417)], [wx(930), wy(500)], [wx(822), wy(614)]] }),
];

/* --------------------------- node lookup --------------------------- */

export const NODE_POS: Record<string, [number, number]> = Object.fromEntries([
  ...TOWNS.map((t) => [t.id, [t.x, t.y] as [number, number]]),
  ...MERCHANTS.map((m) => [m.id, [m.x, m.y] as [number, number]]),
]);

export const TOWN_BY_ID: Record<string, Town> = Object.fromEntries(TOWNS.map((t) => [t.id, t]));
export const MERCHANT_BY_ID: Record<string, Merchant> = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));

/* the 9 merchant tiles (game-data.md §1.3, variant S4 for the 3–4p additions).
 * `all` buys cotton, manufactured goods AND pottery; `blank` buys nothing
 * and has no beer barrel. */
export const MERCHANT_TILE_POOL: Record<2 | 3 | 4, MerchantTile[]> = {
  2: ['blank', 'blank', 'cotton', 'manufacturer', 'all'],
  3: ['blank', 'blank', 'cotton', 'manufacturer', 'all', 'pottery', 'manufacturer'],
  4: ['blank', 'blank', 'cotton', 'manufacturer', 'all', 'pottery', 'manufacturer', 'all', 'cotton'],
};

export const merchantTileBuys = (tile: MerchantTile, industry: IndustryType): boolean =>
  tile === 'all' ? industry === 'cotton' || industry === 'manufacturer' || industry === 'pottery' : tile === industry;

/* ----------------------------- market ------------------------------ */

/* two physical spaces per price: coal £1–£7 ×2 (14 spaces, £8 fallback),
 * iron £1–£5 ×2 (10 spaces, £6 fallback) */
export const MARKET_MAX: Record<Resource, number> = { coal: 14, iron: 10 };

/** buy price for the next cube when `count` cubes remain in the tray
 *  (cubes fill from the DEAREST end; space s from the cheap end costs ⌈s/2⌉) */
export function marketBuyPrice(resource: Resource, count: number): number {
  if (count <= 0) return resource === 'coal' ? 8 : 6;
  return Math.ceil((MARKET_MAX[resource] - count + 1) / 2);
}

/** coins received per cube when selling to the market (empty tray pays most) */
export function marketSellPrice(resource: Resource, count: number): number {
  if (count >= MARKET_MAX[resource]) return 0;
  return Math.max(1, Math.ceil((MARKET_MAX[resource] - count) / 2));
}

/** opening stock (official: 13 coal — one £1 space empty; 8 iron — both £1
 *  spaces empty). "Market temper" is a house rule that only moves the
 *  opening stock; there is NO periodic refill in Brass: Birmingham —
 *  markets only fill when a mine or iron works is built. */
export function startMarket(temper: 'calm' | 'standard' | 'volatile'): Record<Resource, number> {
  if (temper === 'calm') return { coal: 14, iron: 10 };
  if (temper === 'volatile') return { coal: 11, iron: 6 };
  return { coal: 13, iron: 8 };
}

/* ----------------------------- income ------------------------------ */

export const INCOME_MAX = 99;
/** a loan costs 3 income LEVELS (not spaces) */
export const LOAN_INCOME_HIT = 3;
/** the physical progress track has 100 SPACES (0–99); each space shows a
 *  coin = the income LEVEL it pays (game-data.md §5.11):
 *   spaces 0–10  → levels −10…0   (1 space per level)
 *   spaces 11–30 → levels 1…10    (2 spaces per level)
 *   spaces 31–60 → levels 11…20   (3 spaces per level)
 *   spaces 61–96 → levels 21…29   (4 spaces per level)
 *   spaces 97–99 → level 30       (ceiling)
 *  Industry income moves the marker by SPACES; a loan drops it by LEVELS. */
export function incomeLevel(space: number): number {
  const sp = Math.max(0, Math.min(INCOME_MAX, space));
  if (sp <= 10) return sp - 10;
  if (sp <= 30) return Math.ceil((sp - 10) / 2);
  if (sp <= 60) return 10 + Math.ceil((sp - 30) / 3);
  if (sp <= 96) return 20 + Math.ceil((sp - 60) / 4);
  return 30;
}
/** highest space of a level (where a loan drop lands) */
export function levelTopSpace(level: number): number {
  const l = Math.max(-10, Math.min(30, level));
  if (l <= 0) return l + 10;
  if (l <= 10) return 10 + l * 2;
  if (l <= 20) return 30 + (l - 10) * 3;
  if (l <= 29) return 60 + (l - 20) * 4;
  return 99;
}
/** payday £ per space (negative below space 10 — you pay the bank) */
export const INCOME_PAYOUT: number[] = Array.from({ length: INCOME_MAX + 1 }, (_, sp) => incomeLevel(sp));
/** where a loan sends the marker (−3 LEVELS), or null when it would sink below −10 */
export function loanLanding(space: number): number | null {
  const lvl = incomeLevel(space) - LOAN_INCOME_HIT;
  return lvl < -10 ? null : levelTopSpace(lvl);
}

export const LOAN_AMOUNT = 30;
/** payday amounts can be NEGATIVE below income level 10 — format them right */
export const fmtPay = (n: number): string => (n < 0 ? `−£${-n}` : `£${n}`);

export const COSTS = {
  canalLink: 3,
  railLink: 5,
  railCoal: 1,
  /** rail era only: two links for £15 + 1 coal each + 1 beer from a brewery */
  doubleRail: 15,
  doubleRailBeer: 1,
};
export const START_MONEY = 17;
export const START_INCOME_SPACE = 10; // = level £0
export const WILD_CARDS_EACH = 4; // 4 wild location + 4 wild industry in two face-up piles

/* ------------------------------ deck ------------------------------- */

/** deterministic PRNG (mulberry32) */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Official deck (game-data.md §4.2): location cards per town by player
 * count, industry cards (cotton + manufactured goods share ONE double
 * card). Totals 40 / 54 / 64 for 2 / 3 / 4 players. Wild cards live in
 * their own piles (see WILD_CARDS_EACH), never in the draw deck. */
const LOCATION_CARDS: Record<string, [number, number, number]> = {
  stafford: [2, 2, 2],
  burton: [2, 2, 2],
  cannock: [2, 2, 2],
  tamworth: [1, 1, 1],
  walsall: [1, 1, 1],
  coalbrookdale: [3, 3, 3],
  dudley: [2, 2, 2],
  kidderminster: [2, 2, 2],
  wolverhampton: [2, 2, 2],
  worcester: [2, 2, 2],
  birmingham: [3, 3, 3],
  coventry: [3, 3, 3],
  nuneaton: [1, 1, 1],
  redditch: [1, 1, 1],
  leek: [0, 2, 2],
  stoke: [0, 3, 3],
  stone: [0, 2, 2],
  uttoxeter: [0, 1, 2],
  belper: [0, 0, 2],
  derby: [0, 0, 3],
};
const INDUSTRY_CARDS: { industry: IndustryType; industry2?: IndustryType; n: [number, number, number] }[] = [
  { industry: 'iron', n: [4, 4, 4] },
  { industry: 'coal', n: [2, 2, 3] },
  { industry: 'pottery', n: [2, 2, 3] },
  { industry: 'brewery', n: [5, 5, 5] },
  { industry: 'cotton', industry2: 'manufacturer', n: [0, 6, 8] },
];

export function buildDeck(playerCount: number, seed: number): Card[] {
  const idx = Math.max(0, Math.min(2, playerCount - 2)) as 0 | 1 | 2;
  const cards: Card[] = [];
  let n = 0;
  const id = () => `c${seed.toString(36)}-${n++}`;
  for (const [town, counts] of Object.entries(LOCATION_CARDS)) {
    for (let i = 0; i < counts[idx]; i++) cards.push({ id: id(), kind: 'location', town });
  }
  for (const def of INDUSTRY_CARDS) {
    for (let i = 0; i < def.n[idx]; i++) cards.push({ id: id(), kind: 'industry', industry: def.industry, industry2: def.industry2 });
  }
  return shuffle(cards, rng(seed));
}

/** rounds per era follow from the deck: 10 / 9 / 8 for 2 / 3 / 4 players */
export const eraRounds = (playerCount: number): number => (playerCount <= 2 ? 10 : playerCount === 3 ? 9 : 8);

export const HAND_SIZE = 8;

/* ------------------------- player colors --------------------------- */

/** `vivid` = the same hue pushed for tiny marks on dark art (minimap) */
export const PLAYER_COLORS: Record<string, { hex: string; vivid: string; label: string; shape: string }> = {
  brass: { hex: '#C9A45C', vivid: '#FFD36A', label: 'Brass', shape: 'circle' },
  oxblood: { hex: '#9E3B30', vivid: '#FF5F4C', label: 'Oxblood', shape: 'square' },
  verdigris: { hex: '#3F7A55', vivid: '#4EE38F', label: 'Verdigris', shape: 'diamond' },
  steel: { hex: '#4E6E8E', vivid: '#5EB9FF', label: 'Steel Blue', shape: 'triangle' },
};

export const BOT_FLAVOR = [
  'studies the market…',
  'counts the coal…',
  'eyes the potteries…',
  'weighs a loan…',
  'traces the towpath…',
  'polishes the ledger…',
];

/** rough valuation weights per bot difficulty (used by bot.ts) */
export const BOT_SKILL = {
  foreman: { supplyPenalty: 2, networkBias: 1, sellUrgency: 0.6, jitter: 4 },
  industrialist: { supplyPenalty: 5, networkBias: 2, sellUrgency: 1, jitter: 2 },
  magnate: { supplyPenalty: 8, networkBias: 3, sellUrgency: 1.4, jitter: 0.5 },
} as const;
