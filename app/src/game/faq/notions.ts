/* ------------------------------------------------------------------ */
/* The notions of the game: one plate in the guide's case for every    */
/* thing a reader can ask about — an industry, an action, a resource,  */
/* a moment of the game, a lever of the table itself. Each tongue sets */
/* the same plates (fr.ts, en.ts, es.ts, de.ts); this file holds what  */
/* they share: the ids, their order, how hard a word pulls.            */
/* ------------------------------------------------------------------ */

/** every notion, the more particular first: a tie between two goes to
 *  the one written higher, so "la mine" is the mine before it is coal */
export const NOTION_IDS = [
  /* the industries */
  'coalMine', 'ironWorks', 'brewery', 'farmBrewery', 'cotton', 'manufacturer', 'pottery', 'works',
  /* what the industries make, and where it is bought */
  'coal', 'iron', 'beer', 'market',
  /* the actions */
  'build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass',
  /* the two eras and what ends them */
  'canal', 'rail', 'links', 'eras', 'firstRound', 'eraEnd', 'scoring', 'ties', 'gameEnd', 'initiation',
  /* money and its tracks */
  'merchants', 'income', 'shortfall', 'money', 'turnOrder', 'actions',
  /* the tiles */
  'flip', 'levels', 'overbuild', 'mat', 'towns', 'vp',
  /* the cards */
  'cards', 'wild', 'hand', 'players',
  /* the table itself */
  'undo', 'confirm', 'prepare', 'ledger', 'notebook', 'marketPanel', 'minimap', 'keys', 'settings', 'aid', 'machines', 'overview', 'rules',
] as const;

export type NotionId = (typeof NOTION_IDS)[number];

/** the four ways a question is put, each with its own telling of a notion */
export type Asked = 'what' | 'how' | 'cost' | 'gain' | 'whyNot';

/** a notion, in one tongue */
export interface NotionText {
  /** its name, as it reads after "did you mean": "les mines de charbon" */
  topic: string;
  /** the words and phrases that point at it, in any case and accent */
  words: string[];
  /** what it is and what it is for — every notion has this one */
  what: string;
  /** how it is done */
  how?: string;
  /** what it costs */
  cost?: string;
  /** what it brings in */
  gain?: string;
  /** why the table refuses it */
  whyNot?: string;
  /** a short game's own tellings, where the plain ones speak of the full
   *  game: money that counts at the close, points that come from it, the
   *  rounds of the one era, links and barrels that stay */
  short?: Partial<Record<Asked, string>>;
}

/** the cue phrases that tell how a question is put */
export type Cues = Record<Exclude<Asked, 'what'>, string[]>;

/** one tongue of the guide's case */
export interface Tongue {
  notions: Record<NotionId, NotionText>;
  /** words that carry no notion: articles, pronouns, the verbs of asking */
  stop: string[];
  /** how the question is put, tried in the order of `Asked` below */
  cues: Cues;
  /** shorthand a reader types, set right before anything is matched */
  alias: Record<string, string>;
  /** the line that leads the closest notions when nothing matched */
  near: string;
  /** words by which a reader speaks of their own seat: "mon", "j", "my" */
  self: string[];
  /** words that ask what a thing is or is for: "quoi", "sert", "explain" */
  define: string[];
  /** words that ask where: a question of the board as it stands, even put
   *  in a single word of the matter ("où construire") */
  where: string[];
}

/** a word for a generic deed pulls less than a word for a thing: "build a
 *  mine" is about the mine, "sell a mill" is about selling */
export const PULL: Partial<Record<NotionId, number>> = {
  build: 0.9,
  /* the works are the three tiles that sell: a word for all of them pulls
     less than the name of one, or than "work" asked of a thing */
  works: 0.9,
  sell: 1.05,
  develop: 1.05,
  loan: 1.05,
  overbuild: 1.1,
  flip: 1.05,
  actions: 0.8,
  towns: 0.9,
  cards: 0.95,
  overview: 0.9,
  rules: 0.6,
};

/** a short game plays the canal era alone and closes on the initiation's
 *  count: what the full game's notions say of the era's end, the scoring
 *  and the end of the game, it tells with the initiation — the rounds
 *  themselves have a short telling of their own */
export const SHORT_TOLD: Partial<Record<NotionId, NotionId>> = {
  eraEnd: 'initiation',
  scoring: 'initiation',
  gameEnd: 'initiation',
};

/** the written answers true of the full game alone — the sweep, the
 *  change of era, money worth nothing at the end, a tile scoring again at
 *  the rail's count, barrels set back for it — and the notion a short
 *  game tells in their place; the others hold for both lengths */
export const FULL_GAME: Record<string, NotionId> = {
  eraEnd: 'initiation',
  sweepLevelOne: 'initiation',
  eraEndOrder: 'initiation',
  keepMoneyBetweenEras: 'initiation',
  linksSweptAtEraEnd: 'initiation',
  reshuffleBetweenEras: 'initiation',
  merchantRearmEra: 'initiation',
  scoring: 'initiation',
  gameEndTie: 'ties',
  tileVpNumber: 'vp',
  merchantBonus: 'merchants',
};

/** the written answers of faq.ts, filed under the notion each belongs to */
export const FAQ_NOTION: Record<string, NotionId> = {
  ironSells: 'ironWorks',
  coalSells: 'coalMine',
  flipMine: 'flip',
  flipWorks: 'flip',
  ironWhere: 'iron',
  coalWhere: 'coal',
  marketPrice: 'market',
  beer: 'beer',
  merchantBonus: 'merchants',
  sellHow: 'sell',
  buildCard: 'cards',
  network: 'network',
  linkCost: 'network',
  linkScore: 'links',
  loan: 'loan',
  develop: 'develop',
  scout: 'scout',
  income: 'income',
  order: 'turnOrder',
  actions: 'actions',
  hand: 'hand',
  eraEnd: 'eraEnd',
  scoring: 'vp',
  railBeer: 'brewery',
  farmBrewery: 'farmBrewery',
  deckSize: 'hand',
  faceDownCard: 'hand',
  wildDiscard: 'wild',
  scoutWithWild: 'scout',
  firstBuildAnywhere: 'firstRound',
  locationCardTown: 'cards',
  merchantGoods: 'merchants',
  sellMany: 'sell',
  doubleRailBarrel: 'rail',
  coalOrder: 'coal',
  ironConnection: 'iron',
  marketEmpty: 'market',
  marketFillTiming: 'market',
  developLowest: 'develop',
  developTwoCost: 'develop',
  passCost: 'pass',
  spendOrder: 'turnOrder',
  canalSecondLink: 'canal',
  refillEight: 'hand',
  wildBuildReach: 'wild',
  cottonCard: 'cards',
  wildPilesLeft: 'wild',
  sellConnection: 'sell',
  rivalBeer: 'beer',
  developIronCost: 'develop',
  matColumn: 'levels',
  cottonCost: 'cotton',
  manufacturerCost: 'manufacturer',
  coalCubes: 'coalMine',
  ironBars: 'ironWorks',
  potteryCost: 'pottery',
  breweryBarrels: 'brewery',
  flipRules: 'flip',
  tileIncomeNumber: 'income',
  tileLinkIcon: 'links',
  matEraIcon: 'levels',
  tileSlotIcons: 'towns',
  overbuildTile: 'overbuild',
  oneTilePerPlace: 'towns',
  tileRemovedFate: 'overbuild',
  matTileCounts: 'mat',
  tileVpNumber: 'vp',
  sweepLevelOne: 'eraEnd',
  potteryFreeTiles: 'pottery',
  progressBands: 'income',
  markersStart: 'income',
  spacesVsLevels: 'income',
  flipNoRaise: 'income',
  roundEndOrder: 'eras',
  paydayShortfall: 'shortfall',
  noTileSale: 'shortfall',
  characterTileMoney: 'turnOrder',
  eraEndOrder: 'eraEnd',
  linkVpDetail: 'links',
  unflippedVp: 'flip',
  reshuffleBetweenEras: 'eraEnd',
  gameEndTie: 'ties',
  initiationBonus: 'initiation',
  roundsPerEra: 'eras',
  startingPurse: 'money',
  incomeCeiling: 'income',
  lastRoundNoPayday: 'gameEnd',
  merchantRearmEra: 'merchants',
  emptyDeckPlay: 'hand',
  keepMoneyBetweenEras: 'eraEnd',
  boardTowns: 'towns',
  biggestTowns: 'towns',
  doubleIconSlot: 'towns',
  slotIconsMeaning: 'towns',
  merchantPlaces: 'merchants',
  merchantTileVsPlace: 'merchants',
  allGoodsMerchant: 'merchants',
  merchantCoalIcon: 'market',
  farmBreweryCards: 'farmBrewery',
  farmBreweryLinks: 'farmBrewery',
  whatIsALink: 'links',
  linkToMerchant: 'links',
  canalOnlyRoute: 'canal',
  railOnlyRoutes: 'rail',
  oneLinkPerRoute: 'links',
  whereToLayLink: 'network',
  connectedMeaning: 'links',
  rivalMineLinks: 'coal',
  potteryPlaces: 'pottery',
  linkTileStock: 'links',
  linksSweptAtEraEnd: 'eraEnd',
};
