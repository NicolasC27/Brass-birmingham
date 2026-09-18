/* ------------------------------------------------------------------ */
/* BLACKRAIL — core game types (game.md §13 data snapshot)            */
/* ------------------------------------------------------------------ */

import type { GameAction } from './actions';

export type IndustryType = 'coal' | 'iron' | 'brewery' | 'cotton' | 'manufacturer' | 'pottery';

export type Resource = 'coal' | 'iron';

export type Era = 'canal' | 'rail';

export interface IndustryLevel {
  level: number;
  /** money cost to build */
  cost: number;
  coal: number;
  iron: number;
  /** beer needed to sell/flip (0 = flips immediately when condition met) */
  beerToSell: number;
  incomeDelta: number;
  vp: number;
  /** resource units printed on the tile (coal mines / iron works; breweries
   *  get 1 barrel in the Canal Era and 2 in the Rail Era regardless) */
  cubes: number;
  /** link icons: VP granted to each adjacent Link tile at era scoring */
  links: number;
  /** tiles of this level on a player mat */
  count: number;
  eras: Era[];
  /** lightbulb tiles (Pottery I & III) cannot be removed by Develop */
  noDevelop?: boolean;
}

export interface SlotPos {
  /** industries allowed in this socket */
  allows: IndustryType[];
  x: number;
  y: number;
}

export interface Town {
  id: string;
  name: string;
  x: number;
  y: number;
  /** farm brewery: single brewery socket, industry cards only */
  farm?: boolean;
  slots: SlotPos[];
}

export interface Merchant {
  id: string;
  name: string;
  x: number;
  y: number;
  /** printed merchant-tile slots (authentic board §3) */
  slots: number;
  /** the merchant only opens at this many players (Warrington 3, Nottingham 4) */
  minPlayers: number;
  /** bonus granted each time one of its beer barrels is drunk */
  bonus: { vp?: number; income?: number; money?: number; develop?: boolean };
  /** short label for the bonus chit (board rendering) */
  bonusLabel: string;
}

/** one of the 9 shuffled merchant tiles; `all` buys cotton, goods and pottery */
export type MerchantTile = 'blank' | 'cotton' | 'manufacturer' | 'pottery' | 'all';

export interface LinkDef {
  id: string;
  a: string; // node id (town or merchant)
  b: string;
  canal: boolean;
  rail: boolean;
  /** polyline through board space for pretty engraving */
  path?: [number, number][];
  /** official rule: the Kidderminster⇄Worcester link also connects both
      towns to the south Farm Brewery (no second link tile allowed) */
  alsoConnects?: string;
}

/* ------------------------- runtime state -------------------------- */

export interface Card {
  id: string;
  kind: 'location' | 'industry' | 'wild-location' | 'wild-industry';
  town?: string;
  industry?: IndustryType;
  /** the double Cotton + Manufactured-goods card: usable as either industry */
  industry2?: IndustryType;
}

export interface TileState {
  owner: number;
  industry: IndustryType;
  level: number;
  flipped: boolean;
  /** resource cubes sitting on the tile (coal/iron/beer stock) */
  cubes: number;
}

export interface LinkState {
  owner: number;
  era: Era;
}

/** the four characters a machine can be — each with a trade of its own */
export type BotPersona = 'boulton' | 'wedgwood' | 'watt' | 'arkwright';

export interface PlayerState {
  name: string;
  color: string; // token id: brass | oxblood | verdigris | steel
  isBot: boolean;
  persona: BotPersona;
  /** this seat's own candle (null = none), when it differs from the table's */
  minutes?: number | null;
  money: number;
  /** SPACE on the progress track (0–99); the level it pays = incomeLevel(space) */
  income: number;
  vp: number;
  /** money spent this round — decides next round's turn order (least first) */
  spent: number;
  loans: number;
  hand: Card[];
  /** industry levels remaining per type, ascending (index 0 = next buildable) */
  stacks: Record<IndustryType, number[]>;
  stats: { built: number; links: number; sold: number; loans: number; developed: number };
  incomeHistory: number[];
}

export interface MarketState {
  coal: number; // cubes sitting in the market tray
  iron: number;
}

export type Verb = 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout' | 'pass';

export interface LedgerEntry {
  id: number;
  round: number;
  era: Era;
  player?: number;
  verb: 'build' | 'network' | 'develop' | 'sell' | 'loan' | 'scout' | 'score' | 'system' | 'pass';
  text: string;
  /** board region to flash when clicked */
  region?: string;
  /** the entry as a key of game.log.* and its facts — the client says it in its own language */
  key?: string;
  vars?: Record<string, string | number>;
  /** the index in the log of the action this entry belongs to (the state
   *  before it is `actions.slice(0, at)`) */
  at?: number;
}

export type Phase =
  | 'action' // picking card / verb / target
  | 'scoring-canal' // end of canal era ceremony
  | 'game-over';

export interface GameState {
  /** bumped whenever the state shape changes — stale saves are dropped */
  version: number;
  seed: number;
  era: Era;
  round: number;
  eraLength: 'short' | 'standard';
  marketTemper: 'calm' | 'standard' | 'volatile';
  fidelity: 'core' | 'approx';
  timerMinutes: number | null;
  /** the table plays with beginner assistance (a house rule) */
  assist?: boolean;
  players: PlayerState[];
  /** player indices in this round's turn order (least money spent first) */
  order: number[];
  /** position in `order` of the player to act */
  turnPos: number;
  /** = order[turnPos] — the player to act */
  current: number;
  actionsLeft: number;
  /** map key `${town}:${slotIdx}` -> tile */
  tiles: Record<string, TileState>;
  links: Record<string, LinkState>;
  market: MarketState;
  deck: Card[];
  discard: Card[];
  /** wild cards left in the two face-up piles */
  wildLeft: { location: number; industry: number };
  /** merchant tiles dealt at setup, one per printed slot (absent = merchant closed) */
  merchantTiles: Record<string, MerchantTile[]>;
  merchantBeer: Record<string, number>;
  /** every barrel at this merchant has been drunk (UI: "claimed") */
  merchantBonusTaken: Record<string, boolean>;
  ledger: LedgerEntry[];
  ledgerSeq: number;
  phase: Phase;
  /** last confirmed action id, bumped to trigger board FX */
  fxSeq: number;
  lastFx?: {
    kind: 'build' | 'link' | 'sell' | 'develop';
    at: [number, number];
    linkId?: string;
    player: number;
  };
  canalScores?: number[];
  finalScores?: number[];
  winner?: number;
  /** seats that have voted to abandon the game — unanimity among the
   *  humans folds the table */
  concessions?: number[];
  /** the game ended by the table's own vote, not by the last card */
  abandoned?: boolean;
  /** one snapshot per completed round (after payday / era scoring) */
  history: RoundSnapshot[];
  /** what each player spent in the round just ended — it decided this round's order */
  lastSpent?: number[];
  /** every accepted action since setup — with the seed, the whole game */
  actions: GameAction[];
}

export interface RoundSnapshot {
  era: Era;
  round: number;
  vp: number[];
  /** income LEVEL per player (what a payday pays) */
  income: number[];
  money: number[];
}

/* ------------------------- persistence ---------------------------- */

export interface SetupPayload {
  players: {
    name: string;
    color: string;
    type: 'human' | 'bot';
    persona?: BotPersona;
    /** what a bot was before it had a character: kept so old logs replay */
    difficulty?: string;
    minutes?: number | null;
  }[];
  options: {
    eraLength: 'short' | 'standard';
    marketTemper: 'calm' | 'standard' | 'volatile';
    timerMinutes: number | null;
    fidelity: 'core' | 'approx';
    assist?: boolean;
  };
}

export interface FinalPayload {
  players: {
    name: string;
    color: string;
    vp: number;
    income: number;
    links: number;
    industries: number;
  }[];
  eras: { name: 'Canal' | 'Rail'; scores: number[] }[];
  winnerIndex: number;
  timeline: string[];
  history: RoundSnapshot[];
  /** the whole game, replayable: seed, setup and the action log */
  seed?: number;
  setup?: SetupPayload;
  actions?: GameAction[];
}

export const SETUP_KEY = 'brassworks.setup.v1';
export const RESUME_KEY = 'brassworks.resume.v1';
export const FINAL_KEY = 'brassworks.final.v1';
