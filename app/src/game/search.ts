/* ------------------------------------------------------------------ */
/* BLACKRAIL — the machines' brain: a bot plays its whole turn out      */
/* before choosing. Every legal action is tried on a copy of the table, */
/* and after each the second action of the turn; the turn that leaves   */
/* the best-looking table is the one played. "Best-looking" is a static */
/* reading of the board: points banked, points still to come and how    */
/* likely they are, income and cash weighted by how much game is left,  */
/* less the same reading for the strongest rival.                       */
/*                                                                      */
/* The four characters share this brain and read the board alike: none  */
/* is tied to a trade, each plays whatever the table calls for.         */
/*                                                                      */
/* How well it thinks is a dial, not a menu: the strength sets how many */
/* turns it follows, how long it may take and how much noise blurs its  */
/* judgement, and it follows the player across the table — the cote     */
/* online, the form at home — and eases when the machine runs away      */
/* with the game.                                                       */
/*                                                                      */
/* At the top of the dial the machine looks past its own turn: the best */
/* turns found are played on, the rivals answering as the heuristic     */
/* would with hands drawn at random from the cards nobody has seen, its */
/* own next turn taken greedily, the rivals answering once more — and   */
/* the table is judged there, one or two rounds ahead (N+1, N+2).       */
/*                                                                      */
/* The search only ever reads its own hand and what lies face up on the */
/* table: the deck and the rivals' cards it does not know are drawn     */
/* afresh before every look ahead. It is bounded by a time budget so    */
/* the server never stalls for a machine's turn; when the budget runs   */
/* out it plays the best turn found so far, and when anything goes      */
/* wrong the heuristic bot takes over.                                  */
/* ------------------------------------------------------------------ */

import { applyAction, botAction, fallbackAction } from './actions';
import { cloneState } from './clone';
import type { GameAction } from './actions';
import { chooseBotMove } from './bot';
import { BOT_SKILL, INCOME_PAYOUT, INDUSTRIES, LINKS, MERCHANTS, MERCHANT_BY_ID, TOWNS, incomeLevel } from './data';
import { beerSources, buildTargets, canLoan, canScout, developOptions, developTwice, doubleLinkPlan, ironSources, isWild, linkTargets, merchantDemand, merchantOpen, networkTowns, projectEraScores, reachable, sellTargets } from './engine';
import type { BuildTarget, SellTarget } from './engine';
import type { BotPersona, Card, GameState, IndustryType } from './types';
import { FEATURES, activeNet, features, think } from './net';
import { activePolicy, keepBest } from './policy';
import { openingAction } from './openings';
import type { Opening } from './openings';
import { TRAINED } from './weights';
import type { Weights } from './weights';

export interface SearchOptions {
  /** how long the search may take, in ms */
  budgetMs?: number;
  /** how many first actions are followed by their second, at most */
  beam?: number;
  /** how well the machine plays, 0 (a beginner) to 1 (its best) */
  strength?: number;
  /** an opening the machine follows while it lasts, then the search plays on */
  opening?: Opening;
  /** rounds looked past this turn (0, 1 or 2); the strength sets it when absent */
  depth?: 0 | 1 | 2;
  /** also hand back how every move read, for a learner to be taught from */
  rank?: boolean;
  /** look only at the moves the ranker puts among its best this many names */
  guided?: number;
  /** narrow the turn's second action too, not only its first */
  guidedPairs?: boolean;
  /** how many first actions of a turn played out in the look-ahead are
   *  followed by their best second. Zero leaves the old greedy walk, which
   *  models a future self more short-sighted than the machine really is */
  planBeam?: number;
  /** spend the turn's second action before walking on. A turn whose second
   *  action does not strictly beat the first is recorded with an action
   *  unspent, and the walk then stops at once — so that candidate is judged
   *  a whole round earlier than the ones that spent both. On by default */
  finishTurn?: boolean;
  /** offer every second rail the rules allow, not only those glued to the
   *  first. Three times the choices on a family worth a tenth of the actions,
   *  but the breadth of a turn goes from 33 moves to 51 and the pair search
   *  costs the square of that */
  wideSecond?: boolean;
  /** rival actions played before the table is read. The default six is
   *  exactly one round at four seats, and since next round's order is
   *  least-spent-first a cheap turn can buy itself an extra own turn that
   *  an expensive one does not get */
  lookTurns?: number;
}

export interface SearchResult {
  action: GameAction;
  /** the evaluation of the best turn found */
  score: number;
  /** positions looked at */
  nodes: number;
  /** the time it took, in ms */
  ms: number;
  /** every move and how the table read right after it, unblurred, when asked */
  ranked?: { action: GameAction; score: number }[];
}

const DEFAULT_BUDGET_MS = 300;
const MAX_BEAM = 8;
const MIN_BEAM = 2;
/** with this much time every first is followed by every second */
const EXHAUSTIVE_MS = 1000;
/** otherwise the firsts within this much of the best are followed, up to a cap */
const BEAM_SLACK = 6;
const BEAM_CAP = 14;
/** how many of the best turns are looked ahead from */
const LOOKAHEAD_TURNS_KEPT = 4;
/** turns played on when looking ahead, and hands drawn for each */
/* Rival actions played before the table is read. Six was exactly one round
   at four seats, and since next round's order is least-spent-first a cheap
   turn bought itself an extra own turn that an expensive one did not get.
   Far enough now that every candidate is read after the same round. */
const LOOKAHEAD_TURNS = 24;
const LOOKAHEAD_DEALS = 2;
/** what the look ahead weighs against the table as it stands after the turn */
const LOOKAHEAD_WEIGHT = 0.7;
/** below this budget there is no room to look ahead at all */
const MIN_LOOKAHEAD_MS = 250;
/** Mr Watt is the expert: full strength, no easing, whoever he faces */
export const EXPERT: BotPersona = 'watt';
export const isExpert = (s: GameState, i: number): boolean => s.players[i].persona === EXPERT;

/** the machine never plays below this, whatever the table calls for */
export const FLOOR_STRENGTH = 0.3;

/** how the board is read: by hand, by the learned network, or both together */
export type EvalMode = 'hand' | 'net' | 'blend';
let evalMode: EvalMode = activeNet() ? 'blend' : 'hand';
export function setEvalMode(mode: EvalMode): void {
  evalMode = activeNet() ? mode : 'hand';
}
export const currentEvalMode = (): EvalMode => evalMode;

/** the reading in force: the trained one, unless a trainer sets another */
let weights: Weights = TRAINED;
export function setWeights(w: Weights): void {
  weights = w;
}
export const currentWeights = (): Weights => weights;

/* rounds per era, as the engine deals them (brass/game-data.md) */
const ROUNDS: Record<2 | 3 | 4, number> = { 2: 10, 3: 9, 4: 8 };

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/* ============================ legal moves =========================== */

/** A card is spared for every move that is not a build — a loan, a link, a
 *  sale, a scout, a pass — which is some seventeen discards a game. It was
 *  ranked by the builds it allows RIGHT NOW, and a target counts as allowed
 *  only if the purse covers it this instant. So the card named worthless, and
 *  thrown away, was often the one naming the expensive high-scoring builds
 *  one is saving up for. What a card is worth is what it will ever unlock. */
function cardWorth(card: Card, uses: Map<string, BuildTarget[]>, later: Map<string, number>): number {
  return (uses.get(card.id)?.length ?? 0) + (later.get(card.id) ?? 0) + (isWild(card) ? 100 : 0);
}

/** a build this card names that only the purse forbids */
const onlyMoney = (t: BuildTarget): boolean => !t.valid && !!t.reason?.startsWith('Needs £');

/** every action worth trying for the player to act: each build once, with
 *  the card best spared for it; every link, single or double; the sales,
 *  all at once and one by one; the developments; a loan, a scout, a pass */
export function legalActions(s: GameState, i: number, o: SearchOptions = {}): GameAction[] {
  const p = s.players[i];
  const w = weights;
  if (s.phase !== 'action' || s.current !== i || !p.hand.length) return [];
  const out: GameAction[] = [];
  const uses = new Map<string, BuildTarget[]>();
  const later = new Map<string, number>();
  for (const card of p.hand) {
    const all = buildTargets(s, i, card);
    uses.set(card.id, all.filter((t) => t.valid));
    later.set(card.id, w.cardLater ? w.cardLater * all.filter(onlyMoney).length : 0);
  }
  const byWorth = [...p.hand].sort((a, b) => cardWorth(a, uses, later) - cardWorth(b, uses, later));
  const spare = byWorth[0];

  /* builds: one entry per slot and industry, paid with the cheapest card */
  const builds = new Map<string, { card: Card; t: BuildTarget }>();
  for (const card of byWorth) {
    for (const t of uses.get(card.id) ?? []) {
      const key = `${t.town}:${t.slot}:${t.industry}`;
      if (!builds.has(key)) builds.set(key, { card, t });
    }
  }
  /* A build draws iron from whichever works one names. Only one naming can
     change anything: one's own works holding exactly the cubes the build
     wants, which empties it and turns it over for its points. Every other
     source costs the same and leaves the board where it was, so the engine's
     nearest is kept and the search is spared a branch it cannot use. */
  const ownWorksToFlip = ironSources(s).filter((w) => w.owner === i);
  for (const { card, t } of builds.values()) {
    out.push({ kind: 'build', card: card.id, town: t.town, slot: t.slot, industry: t.industry });
    const wanted = INDUSTRIES[t.industry][t.level - 1].iron;
    if (!wanted) continue;
    for (const w of ownWorksToFlip) {
      if (w.cubes !== wanted) continue;
      const named = { kind: 'build' as const, card: card.id, town: t.town, slot: t.slot, industry: t.industry, ironFrom: w.key };
      if (applyAction(s, i, named).state) out.push(named);
    }
  }

  /* links: every single, and in the Rail Era every double that holds */
  const links = linkTargets(s, i).filter((t) => t.valid);
  for (const first of links) {
    out.push({ kind: 'network', card: spare.id, link: first.link.id });
    if (s.era !== 'rail') continue;
    /* The second rail must touch the network as it stands once the first is
       laid — the first's ends count, but the two need not meet. Offering only
       the ones glued to the first showed the machine a third of its legal
       double rails (1.5 of 4.6 a first link), on a family it spends a tenth
       of its actions. */
    const ends = new Set([first.link.a, first.link.b, first.link.alsoConnects].filter(Boolean));
    const mine = networkTowns(s, i);
    for (const def of LINKS) {
      if (def.id === first.link.id || s.links[def.id] || !def.rail) continue;
      /* Every second rail the rules allow is worth +1.9 points at four seats,
         but finding them means checking a plan for fifteen candidates a first
         link instead of three, and that work is not bounded by the clock: at a
         sixty-millisecond budget a move took 1244 ms. So it is offered only
         where there is time to use it. The bench hands numbers, and 0 is not
         false in this language. */
      const wide = o.wideSecond === undefined ? (o.budgetMs ?? 0) >= EXHAUSTIVE_MS : !!o.wideSecond;
      if (!ends.has(def.a) && !ends.has(def.b) && (!wide || (!mine.has(def.a) && !mine.has(def.b)))) continue;
      if (!doubleLinkPlan(s, i, first, def).valid) continue;
      out.push({ kind: 'network', card: spare.id, link: first.link.id, second: def.id });
      /* and, where one of our own breweries would empty paying for it, the
         naming that turns it over for its points */
      for (const b of beerSources(s, i, first.link, def)) {
        if (!b.own || b.cubes !== 1) continue;
        const named: GameAction = { kind: 'network', card: spare.id, link: first.link.id, second: def.id, beerFrom: b.key };
        if (applyAction(s, i, named).state) out.push(named);
      }
    }
  }

  /* sales: everything at once, the merchant with a barrel first; then each
     tile on its own with each of its buyers, in case beer is better kept */
  const sales = sellTargets(s, i).filter((t) => t.valid);
  if (sales.length) {
    const byTile = new Map<string, SellTarget>();
    const barrel = (x: SellTarget) => (x.beer.some((b) => b.kind === 'merchant') ? 1 : 0);
    for (const t of sales) {
      const key = `${t.town}:${t.slot}`;
      const cur = byTile.get(key);
      if (!cur || barrel(t) > barrel(cur)) byTile.set(key, t);
    }
    const all = [...byTile.values()];
    out.push({ kind: 'sell', card: spare.id, sales: all.map((t) => ({ town: t.town, slot: t.slot, merchant: t.merchant })) });
    if (all.length > 1 || sales.length > 1) {
      for (const t of sales) out.push({ kind: 'sell', card: spare.id, sales: [{ town: t.town, slot: t.slot, merchant: t.merchant }] });
    }
  }

  /* developments: each industry once, and twice where the mat allows —
     with the engine's iron, and with a cube from one's own works, which
     walks that works toward its flip */
  const ownWorks = ironSources(s).filter((w) => w.owner === i);
  for (const d of developOptions(s, i)) {
    if (!d.valid) continue;
    out.push({ kind: 'develop', card: spare.id, industries: [d.industry] });
    for (const w of ownWorks) out.push({ kind: 'develop', card: spare.id, industries: [d.industry], ironFrom: [w.key] });
    /* the second tile wants a second iron, whose price only the engine knows */
    if (!developTwice(s, i, d.industry)) continue;
    const twice: GameAction = { kind: 'develop', card: spare.id, industries: [d.industry, d.industry] };
    if (applyAction(s, i, twice).state) out.push(twice);
    for (const w of ownWorks) {
      if (w.cubes < 2) continue;
      const own: GameAction = { kind: 'develop', card: spare.id, industries: [d.industry, d.industry], ironFrom: [w.key, w.key] };
      if (applyAction(s, i, own).state) out.push(own);
    }
  }

  if (canLoan(s, i).ok) out.push({ kind: 'loan', card: spare.id });
  if (canScout(s, i).ok) out.push({ kind: 'scout', cards: byWorth.slice(0, 3).map((c) => c.id) });
  out.push({ kind: 'pass', card: spare.id });
  return out;
}

/** the moves a search bothers with: all of them, or — when a ranker is
 *  loaded and a narrower look is asked for — those it puts first. The
 *  ranker is consulted before any move is played out, which is where the
 *  saving is: the engine never sees the moves it threw away. */
export function worthTrying(s: GameState, i: number, names?: number, o: SearchOptions = {}): GameAction[] {
  const all = legalActions(s, i, o);
  if (!names || all.length <= names) return all;
  const policy = activePolicy(FEATURES);
  return policy ? keepBest(policy, features(s, i), all, names) : all;
}

/** how far an industry's slots are used up across the whole board, 0 to 1.
 *  Counted once a turn rather than once a tile: the board does not move
 *  between two readings of the same position. */
let scarceAt = '';
const scarceOf: Partial<Record<IndustryType, number>> = {};
function scarcity(s: GameState, industry: IndustryType): number {
  const stamp = `${Object.keys(s.tiles).length}:${s.era}:${s.round}`;
  if (scarceAt !== stamp) {
    scarceAt = stamp;
    for (const ind of Object.keys(scarceOf) as IndustryType[]) delete scarceOf[ind];
  }
  const known = scarceOf[industry];
  if (known !== undefined) return known;
  let total = 0;
  let taken = 0;
  for (const town of TOWNS) {
    for (const [k, slot] of town.slots.entries()) {
      if (!slot.allows.includes(industry)) continue;
      total += 1;
      if (s.tiles[`${town.id}:${k}`]) taken += 1;
    }
  }
  const out = total ? taken / total : 0;
  scarceOf[industry] = out;
  return out;
}

/* ============================ evaluation ============================ */

/** paydays still to come for everyone at the table: one per round but the
 *  game's last, this era's and the Rail Era's when it is still ahead */
function paydaysLeft(s: GameState): number {
  const per = ROUNDS[Math.min(4, Math.max(2, s.players.length)) as 2 | 3 | 4];
  const railToCome = s.era === 'canal' && s.eraLength === 'standard' ? per : 0;
  return Math.max(0, per - s.round + railToCome);
}

function roundsTotal(s: GameState): number {
  const per = ROUNDS[Math.min(4, Math.max(2, s.players.length)) as 2 | 3 | 4];
  return s.eraLength === 'standard' ? per * 2 : per;
}

/** is there an open merchant buying `industry` reachable from `town`? */
function served(s: GameState, town: string, industry: IndustryType): boolean {
  const reach = reachable(s, town, s.era, null);
  return MERCHANTS.some((m) => merchantOpen(s, m.id) && reach.has(m.id) && merchantDemand(s, m.id).includes(industry));
}

/** does any merchant lie on the network `town` belongs to? */
const merchantLinked = (s: GameState, town: string): boolean => [...reachable(s, town, s.era, null)].some((n) => !!MERCHANT_BY_ID[n]);

/** the same, one unbuilt link away */
function nearlyServed(s: GameState, town: string, industry: IndustryType): boolean {
  const reach = reachable(s, town, s.era, null);
  return LINKS.some((d) => {
    if (s.links[d.id] || !(s.era === 'canal' ? d.canal : d.rail)) return false;
    const [m, other] = MERCHANT_BY_ID[d.a] ? [d.a, d.b] : MERCHANT_BY_ID[d.b] ? [d.b, d.a] : [null, null];
    return !!m && reach.has(other!) && merchantOpen(s, m) && merchantDemand(s, m).includes(industry);
  });
}

/** what a seat is worth, in points, as the table stands; one's own seat
 *  (`own`) also counts the room it has to move */
function worth(s: GameState, j: number, proj: ReturnType<typeof projectEraScores>, frac: number, paydays: number, own: boolean, w: Weights): number {
  const p = s.players[j];
  let v = p.vp + proj[j].links + proj[j].tiles;
  /* cash and the cash to come, worth less as the game runs out */
  const rate = w.cashFloor + w.cashSlope * frac;
  const level = incomeLevel(p.income);
  /* a flipped tile of the Canal Era that survives the sweep scores twice */
  const again = s.era === 'canal' && s.eraLength === 'standard';
  /* beer somewhere on the table: a brewery with barrels, or a merchant's */
  const beerAround = Object.values(s.tiles).some((x) => x.industry === 'brewery' && !x.flipped && x.cubes > 0) || Object.values(s.merchantBeer).some((b) => b > 0);
  /* what one's own beer may serve: the goods one holds unsold; a second
     brewery with barrels waits on the same sales as the first */
  const goodsTile = (x: { industry: IndustryType; level: number; flipped: boolean }) => !x.flipped && INDUSTRIES[x.industry][x.level - 1].beerToSell > 0;
  const ownGoods = Object.values(s.tiles).filter((x) => x.owner === j && goodsTile(x)).length;
  const ownBreweries = Object.values(s.tiles).filter((x) => x.owner === j && x.industry === 'brewery' && !x.flipped && x.cubes > 0).length;
  for (const [key, t] of Object.entries(s.tiles)) {
    if (t.owner !== j) continue;
    const lv = INDUSTRIES[t.industry][t.level - 1];
    /* a level-1 mill or brewery is a tile spent off the mat for little: the
       strong players develop those away instead of building them */
    if (w.lowTile && t.level === 1 && (lv.beerToSell > 0 || t.industry === 'brewery')) v -= w.lowTile * frac;
    /* and a slot nobody else can have now is worth more than a plentiful one */
    if (w.scarceSlot) v += w.scarceSlot * scarcity(s, t.industry) * frac;
    const twice = again && lv.eras.includes('rail') ? 1 : 0;
    if (t.flipped) {
      v += lv.vp * twice;
      continue;
    }
    const town = key.split(':')[0];
    /* what the flip is worth: the points, and the income it moves the
       marker to, paid every payday still to come */
    const gain = lv.vp * (1 + twice) + (incomeLevel(p.income + lv.incomeDelta) - level) * paydays * rate * w.incomeOnFlip;
    let chance: number;
    if (lv.beerToSell > 0) chance = served(s, town, t.industry) ? (beerAround ? w.goodsServed : w.goodsNoBeer) : nearlyServed(s, town, t.industry) ? w.goodsNearly : w.goodsFar;
    else if (t.industry === 'brewery') {
      /* barrels go with sales: one's own goods anywhere, anyone's goods on this network */
      const reach = reachable(s, town, s.era, null);
      const near = Object.entries(s.tiles).filter(([k, x]) => x.owner !== j && goodsTile(x) && reach.has(k.split(':')[0])).length;
      chance = Math.min(0.75, w.breweryBase + w.breweryOwnGoods * Math.min(2, ownGoods) + w.breweryNear * Math.min(3, near)) * (ownBreweries > 1 ? w.brewerySecond : 1);
    }
    /* iron ships anywhere and one may drain one's own works by developing */
    else if (t.industry === 'iron') chance = w.ironBase + w.ironDrain * (1 - t.cubes / Math.max(1, lv.cubes));
    /* coal only travels along links: a mine on the way to a merchant empties faster */
    else chance = w.coalBase + w.coalDrain * (1 - t.cubes / Math.max(1, lv.cubes)) + (merchantLinked(s, town) ? w.coalMerchant : 0);
    /* the fewer rounds left, the less likely the flip */
    chance *= Math.min(1, w.chanceFloor + frac);
    v += gain * Math.min(1, chance);
    /* an unflipped tile still lends its link icons */
    v += lv.links * w.linkIcons;
  }
  const stream = INCOME_PAYOUT[p.income] * paydays;
  /* A pound is only worth what one gets to spend. Past what the actions
     still to come could lay out, it is dead weight — which is why a loan
     taken late looks like a gain to a reading that counts every pound
     alike, and why a seat ends the game sitting on money. */
  const purse = p.money + stream;
  const spendable = paydays * 2 * w.cashPerAction;
  v += Math.min(purse, spendable) * rate + Math.max(0, purse - spendable) * rate * w.idleCash;
  /* a negative income is a threat to the tiles themselves */
  if (level < 0) v -= (-level) * w.negIncome;
  /* once the deck is out, every card in hand is one more action */
  if (s.deck.length === 0) v += p.hand.length * w.handAtEnd;
  if (!own) return v;
  /* room to move: the towns one may build in, and a market for goods */
  const towns = networkTowns(s, j);
  v += towns.size * w.towns * frac;
  const market = [...towns].some((n) => [...reachable(s, n, s.era, null)].some((x) => merchantOpen(s, x)));
  if (!market) v -= w.noMarket * frac;
  /* a mat developed early: the next tiles survive the sweep and score twice */
  if (s.era === 'canal') for (const ind of Object.keys(p.stacks) as IndustryType[]) if ((p.stacks[ind][0] ?? 0) >= 2) v += w.developed * frac;
  /* a canal that scores less than four icons is an action spent for little */
  if (w.weakLink && s.era === 'canal') {
    for (const [id, l] of Object.entries(s.links)) {
      if (l.owner !== j) continue;
      const def = LINKS.find((d) => d.id === id);
      if (!def) continue;
      let icons = 0;
      for (const end of [def.a, def.b]) {
        if (MERCHANT_BY_ID[end]) icons += 2;
        else for (const [key, t] of Object.entries(s.tiles)) if (key.split(':')[0] === end) icons += INDUSTRIES[t.industry][t.level - 1].links;
      }
      if (icons < 4) v -= w.weakLink;
    }
  }
  /* the rails are coming: cash for two double rails and a barrel of one's own */
  if (w.railReady && s.era === 'canal' && s.eraLength === 'standard' && paydays <= ROUNDS[Math.min(4, Math.max(2, s.players.length)) as 2 | 3 | 4] + 1) {
    if (p.money >= 30) v += w.railReady;
    if (Object.values(s.tiles).some((t) => t.owner === j && t.industry === 'brewery' && !t.flipped && t.cubes > 0)) v += w.railReady;
  }
  /* next round's order goes to whoever spent least: seats one would move ahead of */
  if (w.tempo) for (let k = 0; k < s.players.length; k++) if (k !== j && s.players[k].spent > p.spent) v += w.tempo;
  /* the canal opening: two loans early buy the tiles that pay for themselves */
  if (s.era === 'canal' && s.round <= 3) v += w.earlyLoan * Math.min(2, p.loans);
  /* the next tile of each industry: the higher, the better the builds ahead */
  for (const ind of Object.keys(p.stacks) as IndustryType[]) {
    const next = p.stacks[ind][0];
    if (next) v += INDUSTRIES[ind][next - 1].vp * w.stack * frac;
  }
  return v;
}

/** the table as seen from seat `i`: our worth less the strongest rival's */
export function evaluate(s: GameState, i: number, w: Weights = weights): number {
  const proj = projectEraScores(s);
  const paydays = paydaysLeft(s);
  const frac = paydays / roundsTotal(s);
  const mine = worth(s, i, proj, frac, paydays, true, w);
  /* the rivals' worth is read only if it counts for anything: the machines
     play for their own score now, so at a four-seat table this spares three
     readings of the board out of four */
  let hand = mine;
  if (w.rival) {
    let rival = -Infinity;
    for (let j = 0; j < s.players.length; j++) {
      if (j === i) continue;
      rival = Math.max(rival, worth(s, j, proj, frac, paydays, false, w));
    }
    if (rival !== -Infinity) hand = mine - rival * w.rival;
  }
  const net = activeNet();
  if (evalMode === 'hand' || !net) return hand;
  /* the projection is already made: the features need not make it again */
  const learned = think(net, features(s, i, proj));
  return evalMode === 'net' ? learned : hand + learned;
}

/* ============================== search ============================== */

interface Candidate {
  action: GameAction;
  state: GameState;
  score: number;
}

/** a whole turn played out: the first action, the table after the second, its reading */
interface Turn {
  first: GameAction;
  after: GameState;
  score: number;
}

/** a die cast from the position itself: the same table, the same throws */
function diceFrom(s: GameState, i: number): () => number {
  let x = (s.seed ^ ((s.ledgerSeq + 1) * 2654435761) ^ (i * 40503)) >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** a rough bell from the dice: the sum of three throws, centred */
const bell = (dice: () => number) => () => dice() + dice() + dice() - 1.5;

/* ---------------------------- look ahead ---------------------------- */

/** the same table with every card nobody has seen — the deck and the
 *  rivals' hands — dealt afresh: what the machine may fairly assume */
export function determinize(s: GameState, i: number, rand: () => number): GameState {
  const c = cloneState(s);
  const pool: Card[] = [...c.deck];
  for (const [j, p] of c.players.entries()) if (j !== i) pool.push(...p.hand);
  for (let k = pool.length - 1; k > 0; k--) {
    const r = Math.floor(rand() * (k + 1));
    [pool[k], pool[r]] = [pool[r], pool[k]];
  }
  for (const [j, p] of c.players.entries()) if (j !== i) p.hand = pool.splice(0, p.hand.length);
  c.deck = pool;
  return c;
}

/** one move of the model of a rival: the heuristic at its sharpest */
function rivalMove(s: GameState, seat: number): GameState | null {
  const a = botAction(chooseBotMove(s, seat, BOT_SKILL.magnate)) ?? fallbackAction(s, seat);
  return applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state;
}

/** the rivals play on until seat `i` is to act again, the game ends, or
 *  the turns run out; the canal ceremony closes itself on the way */
function rivalsUntilMyTurn(s: GameState, i: number, turns: number): GameState {
  let cur = s;
  for (let n = 0; n < turns; n++) {
    if (cur.phase === 'scoring-canal') {
      cur = applyAction(cur, cur.current, { kind: 'begin-rail' }).state ?? cur;
      continue;
    }
    if (cur.phase !== 'action' || cur.current === i) break;
    const next = rivalMove(cur, cur.current);
    if (!next) break;
    cur = next;
  }
  return cur;
}

/** seat `i`'s own next turn, taken greedily on the static reading */
function greedyTurn(s: GameState, i: number): { state: GameState; nodes: number } {
  let cur = s;
  let nodes = 0;
  for (let k = 0; k < 2 && cur.phase === 'action' && cur.current === i; k++) {
    let best: Candidate | null = null;
    for (const action of legalActions(cur, i)) {
      const r = applyAction(cur, i, action);
      if (!r.state) continue;
      nodes += 1;
      const score = evaluate(r.state, i);
      if (!best || score > best.score) best = { action, state: r.state, score };
    }
    if (!best) break;
    cur = best.state;
  }
  return { state: cur, nodes };
}

/** the table `depth` rounds on from the end of our turn, as one deal of
 *  the unseen cards has it */
function lookAhead(after: GameState, i: number, depth: 1 | 2, rand: () => number, o: SearchOptions = {}): { score: number; nodes: number } {
  const planBeam = o.planBeam ?? 0;
  const turns = o.lookTurns ?? LOOKAHEAD_TURNS;
  const finish = o.finishTurn === undefined ? true : !!o.finishTurn;
  let cur = determinize(after, i, rand);
  let nodes = 0;
  /* the turn is finished before the rivals answer, so that every candidate
     is read at the same point of the game rather than one round apart */
  if (finish && cur.phase === 'action' && cur.current === i) {
    const rest = greedyTurn(cur, i);
    nodes += rest.nodes;
    cur = rest.state;
  }
  cur = rivalsUntilMyTurn(cur, i, turns);
  if (depth === 2 && cur.phase === 'action' && cur.current === i) {
    const mine = planBeam > 0 ? plannedTurn(cur, i, planBeam) : greedyTurn(cur, i);
    nodes += mine.nodes;
    cur = rivalsUntilMyTurn(mine.state, i, turns);
  }
  return { score: evaluate(cur, i), nodes };
}

/** The machine's own turn to come, played as the machine really plays it:
 *  the promising first actions each followed by their best second, the pair
 *  judged together. `greedyTurn` takes the best single action twice over,
 *  which models a future self more short-sighted than the present one — and
 *  so makes any move that needs following up look worse than it is. */
function plannedTurn(s: GameState, i: number, beam: number): { state: GameState; nodes: number } {
  let nodes = 0;
  const firsts: Candidate[] = [];
  for (const action of legalActions(s, i)) {
    const r = applyAction(s, i, action);
    if (!r.state) continue;
    nodes += 1;
    firsts.push({ action, state: r.state, score: evaluate(r.state, i) });
  }
  if (!firsts.length) return { state: s, nodes };
  firsts.sort((a, b) => b.score - a.score);
  let best = firsts[0];
  for (const first of firsts.slice(0, beam)) {
    const s1 = first.state;
    if (s1.phase !== 'action' || s1.current !== i) {
      if (first.score > best.score) best = first;
      continue;
    }
    let pair = first;
    for (const action of legalActions(s1, i)) {
      const r = applyAction(s1, i, action);
      if (!r.state) continue;
      nodes += 1;
      const score = evaluate(r.state, i);
      if (score > pair.score) pair = { action: first.action, state: r.state, score };
    }
    if (pair.score > best.score) best = pair;
  }
  return { state: best.state, nodes };
}

/** the table without its paperwork: the ledger, the history and the log
 *  are not read by the search and only make every copy dearer */
function bare(s: GameState): GameState {
  return { ...s, ledger: [], history: [], actions: [] };
}

/** the best turn from here: the first action, chosen with the second in mind */
export function searchTurn(full: GameState, i: number, o: SearchOptions = {}): SearchResult | null {
  const s = bare(full);
  const strength = clamp01(o.strength ?? 1);
  const dial = knobs(strength);
  /* A caller that names a budget means it, upwards as well as downwards:
     capping it against the dial silently turned every study of longer
     thinking into another study of 1500 ms. With no budget named, the
     modest default stands, so the table server plays as it always has. */
  const budget = o.budgetMs ?? Math.min(DEFAULT_BUDGET_MS, dial.budgetMs);
  const depth = o.depth ?? dial.depth;
  const dice = diceFrom(s, i);
  const blur = bell(dice);
  const start = now();
  let nodes = 0;
  const firsts: Candidate[] = [];
  const ranked: { action: GameAction; score: number }[] | undefined = o.rank ? [] : undefined;
  for (const action of worthTrying(s, i, o.guided, o)) {
    const r = applyAction(s, i, action);
    if (!r.state) continue;
    nodes += 1;
    const clean = evaluate(r.state, i);
    ranked?.push({ action, score: clean });
    firsts.push({ action, state: r.state, score: clean + dial.noise * blur() });
  }
  if (!firsts.length) return null;
  firsts.sort((a, b) => b.score - a.score);
  ranked?.sort((a, b) => b.score - a.score);
  const done = (best: Candidate): SearchResult => ({ action: best.action, score: best.score, nodes, ms: now() - start, ranked });
  /* the turn ends with this action, or the machine does not look further */
  if (s.actionsLeft <= 1 || !dial.second) return done(firsts[0]);

  /* which firsts are followed by their seconds: every one when there is
     time to try everything; otherwise those within reach of the best, as
     many as the dial and the budget allow */
  const elapsed = now() - start;
  const perNode = Math.max(0.05, elapsed / nodes);
  const affordable = Math.floor((budget - elapsed) / (perNode * Math.max(1, firsts.length)));
  const within = firsts.filter((f) => f.score >= firsts[0].score - BEAM_SLACK).length;
  const beam = o.beam ?? (budget >= EXHAUSTIVE_MS ? firsts.length : Math.max(MIN_BEAM, Math.min(dial.beam === MAX_BEAM ? BEAM_CAP : dial.beam, within, affordable)));

  /* every turn worth playing: each first of the beam with its best second */
  const turns: Turn[] = [];
  for (const [k, first] of firsts.slice(0, beam).entries()) {
    /* the budget is spent: the rest of the beam goes unread */
    if (k > 0 && now() - start > budget) break;
    let turn: Turn = { first: first.action, after: first.state, score: first.score };
    const s1 = first.state;
    if (s1.phase === 'action' && s1.current === i) {
      for (const action of worthTrying(s1, i, o.guidedPairs !== undefined && !o.guidedPairs ? 0 : o.guided, o)) {
        const r = applyAction(s1, i, action);
        if (!r.state) continue;
        nodes += 1;
        const score = evaluate(r.state, i) + dial.noise * blur();
        if (score > turn.score) turn = { first: first.action, after: r.state, score };
      }
    }
    turns.push(turn);
  }
  turns.sort((a, b) => b.score - a.score);
  /* nothing to look ahead for, or no time to: the turn as it reads now */
  if (depth === 0 || turns.length < 2 || budget < MIN_LOOKAHEAD_MS) return done({ action: turns[0].first, state: turns[0].after, score: turns[0].score });

  /* the best turns are played on: the rivals answer, and at N+2 so do we */
  let best: Turn | null = null;
  for (const [k, turn] of turns.slice(0, LOOKAHEAD_TURNS_KEPT).entries()) {
    if (k > 0 && now() - start > budget) break;
    let sum = 0;
    for (let d = 0; d < LOOKAHEAD_DEALS; d++) {
      const look = lookAhead(turn.after, i, depth, dice, o);
      nodes += look.nodes;
      sum += look.score;
    }
    const score = (1 - LOOKAHEAD_WEIGHT) * turn.score + LOOKAHEAD_WEIGHT * (sum / LOOKAHEAD_DEALS);
    if (!best || score > best.score) best = { ...turn, score };
  }
  const chosen = best ?? turns[0];
  return done({ action: chosen.first, state: chosen.after, score: chosen.score });
}

/* ============================= strength ============================= */

/** what a strength buys: time, breadth, a second look, rounds looked
 *  ahead, and how much blur */
export function knobs(strength: number): { budgetMs: number; beam: number; second: boolean; depth: 0 | 1 | 2; noise: number } {
  const s = clamp01(strength);
  const depth = s >= 0.9 ? 2 : s >= 0.75 ? 1 : 0;
  return {
    budgetMs: depth === 2 ? 1500 : depth === 1 ? 600 : Math.round(80 + 220 * s),
    beam: Math.round(MIN_BEAM + 1 + (MAX_BEAM - MIN_BEAM - 1) * s),
    second: s >= 0.35,
    depth,
    /* a little blur at the bottom of the dial: enough to vary the play,
       never enough to pass up a good turn for a bad one */
    noise: 6 * (1 - s) * (1 - s),
  };
}

/** a rough standing, for the machine to know whether it is running away */
function standing(s: GameState, j: number, proj: ReturnType<typeof projectEraScores>): number {
  return s.players[j].vp + proj[j].total + incomeLevel(s.players[j].income) * 0.5;
}

/** the strength a machine plays at right now: `base` for the player across
 *  the table, capped when the table plays with assistance, eased when the
 *  machine leads by a street and tightened when it trails */
export function adaptiveStrength(s: GameState, i: number, base: number): number {
  const humans = s.players.map((_, j) => j).filter((j) => !s.players[j].isBot);
  if (!humans.length) return clamp01(base);
  let level = clamp01(base);
  if (s.assist) level = Math.min(level, 0.5);
  const proj = projectEraScores(s);
  const lead = standing(s, i, proj) - Math.max(...humans.map((j) => standing(s, j, proj)));
  if (lead > 25) level -= 0.35;
  else if (lead > 12) level -= 0.2;
  else if (lead < -12) level += 0.15;
  /* eased, never foolish */
  return Math.max(FLOOR_STRENGTH, clamp01(level));
}

/* ============================= dispatch ============================= */

/** the action a machine plays at seat `i`, at the strength the table calls
 *  for; the heuristic stands in when the search finds nothing or fails
 *  (null = nothing playable at all) */
export function chooseBotAction(s: GameState, i: number, o: SearchOptions = {}): GameAction | null {
  /* the expert plays flat out, whoever sits across the table */
  const strength = isExpert(s, i) ? 1 : adaptiveStrength(s, i, o.strength ?? 1);
  /* No book. The pottery opening was blessed on eight games of canal-era
     points under an evaluation since replaced twice, and no bench ever sat
     the expert at three seats to check it again. Measured on the bot as it
     stands, ninety-six games a cell: −4.0 points at three seats and −5.5 at
     four, both clear of the spread. */
  const opening = o.opening;
  if (opening) {
    const scripted = openingAction(s, i, opening, legalActions(s, i), (after) => evaluate(after, i));
    if (scripted) return scripted;
  }
  try {
    const r = searchTurn(s, i, { ...o, strength });
    if (r) return r.action;
  } catch (e) {
    console.error(`${s.players[i].name} lost the thread:`, e);
  }
  const skill = strength < 0.34 ? BOT_SKILL.foreman : strength < 0.67 ? BOT_SKILL.industrialist : BOT_SKILL.magnate;
  return botAction(chooseBotMove(s, i, skill));
}
