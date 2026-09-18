/* ------------------------------------------------------------------ */
/* BLACKRAIL — the magnate: a bot that plays its whole turn out before  */
/* choosing. Every legal action is tried on a copy of the table, and     */
/* after each the second action of the turn; the turn that leaves the    */
/* best-looking table is the one played. "Best-looking" is a static      */
/* reading of the board: points banked, points still to come and how     */
/* likely they are, income and cash weighted by how much game is left,   */
/* less the same reading for the strongest rival.                        */
/*                                                                       */
/* The search only ever reads its own hand and what lies face up on the  */
/* table: no deck, no rival's cards. It is bounded by a time budget so    */
/* the server never stalls for a machine's turn; when the budget runs    */
/* out it plays the best turn found so far, and when anything goes wrong */
/* the heuristic bot takes over.                                         */
/* ------------------------------------------------------------------ */

import { applyAction, botAction } from './actions';
import type { GameAction } from './actions';
import { chooseBotMove } from './bot';
import { INCOME_PAYOUT, INDUSTRIES, LINKS, MERCHANTS, MERCHANT_BY_ID, incomeLevel } from './data';
import { buildTargets, canLoan, canScout, developOptions, developTwice, doubleLinkPlan, isWild, linkTargets, merchantDemand, merchantOpen, networkTowns, projectEraScores, reachable, sellTargets } from './engine';
import type { BuildTarget, SellTarget } from './engine';
import type { Card, GameState, IndustryType } from './types';

export interface SearchOptions {
  /** how long the search may take, in ms */
  budgetMs?: number;
  /** how many first actions are followed by their second, at most */
  beam?: number;
}

export interface SearchResult {
  action: GameAction;
  /** the evaluation of the best turn found */
  score: number;
  /** positions looked at */
  nodes: number;
  /** the time it took, in ms */
  ms: number;
}

const DEFAULT_BUDGET_MS = 300;
const MAX_BEAM = 8;
const MIN_BEAM = 2;

/* rounds per era, as the engine deals them (brass/game-data.md) */
const ROUNDS: Record<2 | 3 | 4, number> = { 2: 10, 3: 9, 4: 8 };

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* ============================ legal moves =========================== */

/** how much a card is worth keeping: the builds it allows, wilds above all */
function cardWorth(card: Card, uses: Map<string, BuildTarget[]>): number {
  return (uses.get(card.id)?.length ?? 0) + (isWild(card) ? 100 : 0);
}

/** every action worth trying for the player to act: each build once, with
 *  the card best spared for it; every link, single or double; the sales,
 *  all at once and one by one; the developments; a loan, a scout, a pass */
export function legalActions(s: GameState, i: number): GameAction[] {
  const p = s.players[i];
  if (s.phase !== 'action' || s.current !== i || !p.hand.length) return [];
  const out: GameAction[] = [];
  const uses = new Map<string, BuildTarget[]>();
  for (const card of p.hand) uses.set(card.id, buildTargets(s, i, card).filter((t) => t.valid));
  const byWorth = [...p.hand].sort((a, b) => cardWorth(a, uses) - cardWorth(b, uses));
  const spare = byWorth[0];

  /* builds: one entry per slot and industry, paid with the cheapest card */
  const builds = new Map<string, { card: Card; t: BuildTarget }>();
  for (const card of byWorth) {
    for (const t of uses.get(card.id) ?? []) {
      const key = `${t.town}:${t.slot}:${t.industry}`;
      if (!builds.has(key)) builds.set(key, { card, t });
    }
  }
  for (const { card, t } of builds.values()) out.push({ kind: 'build', card: card.id, town: t.town, slot: t.slot, industry: t.industry });

  /* links: every single, and in the Rail Era every double that holds */
  const links = linkTargets(s, i).filter((t) => t.valid);
  for (const first of links) {
    out.push({ kind: 'network', card: spare.id, link: first.link.id });
    if (s.era !== 'rail') continue;
    const ends = new Set([first.link.a, first.link.b, first.link.alsoConnects].filter(Boolean));
    for (const def of LINKS) {
      if (def.id === first.link.id || s.links[def.id] || !def.rail) continue;
      if (!ends.has(def.a) && !ends.has(def.b)) continue;
      if (doubleLinkPlan(s, i, first, def).valid) out.push({ kind: 'network', card: spare.id, link: first.link.id, second: def.id });
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

  /* developments: each industry once, and twice where the mat allows */
  for (const d of developOptions(s, i)) {
    if (!d.valid) continue;
    out.push({ kind: 'develop', card: spare.id, industries: [d.industry] });
    /* the second tile wants a second iron, whose price only the engine knows */
    const twice: GameAction = { kind: 'develop', card: spare.id, industries: [d.industry, d.industry] };
    if (developTwice(s, i, d.industry) && applyAction(s, i, twice).state) out.push(twice);
  }

  if (canLoan(s, i).ok) out.push({ kind: 'loan', card: spare.id });
  if (canScout(s, i).ok) out.push({ kind: 'scout', cards: byWorth.slice(0, 3).map((c) => c.id) });
  out.push({ kind: 'pass', card: spare.id });
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

/** the same, one unbuilt link away */
function nearlyServed(s: GameState, town: string, industry: IndustryType): boolean {
  const reach = reachable(s, town, s.era, null);
  return LINKS.some((d) => {
    if (s.links[d.id] || !(s.era === 'canal' ? d.canal : d.rail)) return false;
    const [m, other] = MERCHANT_BY_ID[d.a] ? [d.a, d.b] : MERCHANT_BY_ID[d.b] ? [d.b, d.a] : [null, null];
    return !!m && reach.has(other!) && merchantOpen(s, m) && merchantDemand(s, m).includes(industry);
  });
}

/** what a seat is worth, in points, as the table stands */
function worth(s: GameState, j: number, proj: ReturnType<typeof projectEraScores>, frac: number, paydays: number, own: boolean): number {
  const p = s.players[j];
  let v = p.vp + proj[j].links + proj[j].tiles;
  /* a flipped tile of the Canal Era that survives the sweep scores twice */
  const again = s.era === 'canal' && s.eraLength === 'standard';
  for (const [key, t] of Object.entries(s.tiles)) {
    if (t.owner !== j) continue;
    const lv = INDUSTRIES[t.industry][t.level - 1];
    const twice = again && lv.eras.includes('rail') ? 1 : 0;
    if (t.flipped) {
      v += lv.vp * twice;
      continue;
    }
    const town = key.split(':')[0];
    let chance: number;
    if (lv.beerToSell > 0) chance = served(s, town, t.industry) ? 0.7 : nearlyServed(s, town, t.industry) ? 0.35 : 0.1;
    else if (t.industry === 'brewery') chance = 0.6;
    else chance = 0.35 + 0.6 * (1 - t.cubes / Math.max(1, lv.cubes));
    /* the fewer rounds left, the less likely the flip */
    chance *= Math.min(1, 0.3 + frac);
    v += lv.vp * (1 + twice) * chance;
    /* an unflipped tile still lends its link icons */
    v += lv.links * 0.3;
  }
  /* cash and the cash to come, worth less as the game runs out */
  const rate = 0.05 + 0.4 * frac;
  const level = incomeLevel(p.income);
  const stream = INCOME_PAYOUT[p.income] * paydays;
  v += (p.money + stream) * rate;
  /* a negative income is a threat to the tiles themselves */
  if (level < 0) v -= (-level) * 1.5;
  if (!own) return v;
  /* room to move: the towns one may build in, and a market for goods */
  const towns = networkTowns(s, j);
  v += towns.size * 0.6 * frac;
  const market = [...towns].some((n) => [...reachable(s, n, s.era, null)].some((x) => merchantOpen(s, x)));
  if (!market) v -= 4 * frac;
  /* the next tile of each industry: the higher, the better the builds ahead */
  for (const ind of Object.keys(p.stacks) as IndustryType[]) {
    const next = p.stacks[ind][0];
    if (next) v += INDUSTRIES[ind][next - 1].vp * 0.08 * frac;
  }
  return v;
}

/** the table as seen from seat `i`: our worth less the strongest rival's */
export function evaluate(s: GameState, i: number): number {
  const proj = projectEraScores(s);
  const frac = paydaysLeft(s) / roundsTotal(s);
  const paydays = paydaysLeft(s);
  const mine = worth(s, i, proj, frac, paydays, true);
  let rival = -Infinity;
  for (let j = 0; j < s.players.length; j++) {
    if (j === i) continue;
    rival = Math.max(rival, worth(s, j, proj, frac, paydays, false));
  }
  return rival === -Infinity ? mine : mine - rival;
}

/* ============================== search ============================== */

interface Candidate {
  action: GameAction;
  state: GameState;
  score: number;
}

/** the best turn from here: the first action, chosen with the second in mind */
export function searchTurn(s: GameState, i: number, o: SearchOptions = {}): SearchResult | null {
  const budget = o.budgetMs ?? DEFAULT_BUDGET_MS;
  const start = now();
  let nodes = 0;
  const firsts: Candidate[] = [];
  for (const action of legalActions(s, i)) {
    const r = applyAction(s, i, action);
    if (!r.state) continue;
    nodes += 1;
    firsts.push({ action, state: r.state, score: evaluate(r.state, i) });
  }
  if (!firsts.length) return null;
  firsts.sort((a, b) => b.score - a.score);
  const done = (best: Candidate): SearchResult => ({ action: best.action, score: best.score, nodes, ms: now() - start });
  /* the turn ends with this action: nothing more to look at */
  if (s.actionsLeft <= 1) return done(firsts[0]);

  /* how many firsts the budget lets us follow */
  const elapsed = now() - start;
  const perNode = Math.max(0.05, elapsed / nodes);
  const beam = Math.max(MIN_BEAM, Math.min(MAX_BEAM, o.beam ?? Math.floor((budget - elapsed) / (perNode * Math.max(1, firsts.length)))));

  let best: Candidate | null = null;
  for (const [k, first] of firsts.slice(0, beam).entries()) {
    /* the budget is spent: the rest of the beam goes unread */
    if (k > 0 && now() - start > budget) break;
    let total = first.score;
    const s1 = first.state;
    if (s1.phase === 'action' && s1.current === i) {
      let bestSecond = -Infinity;
      for (const action of legalActions(s1, i)) {
        const r = applyAction(s1, i, action);
        if (!r.state) continue;
        nodes += 1;
        bestSecond = Math.max(bestSecond, evaluate(r.state, i));
      }
      if (bestSecond > -Infinity) total = bestSecond;
    }
    if (!best || total > best.score) best = { action: first.action, state: s1, score: total };
  }
  return done(best ?? firsts[0]);
}

/* ============================= dispatch ============================= */

/** the action a machine plays at seat `i`: the magnate searches its turn,
 *  the others follow the heuristic; the heuristic also stands in when the
 *  search finds nothing or fails (null = nothing playable at all) */
export function chooseBotAction(s: GameState, i: number, o: SearchOptions = {}): GameAction | null {
  const p = s.players[i];
  if (p.difficulty === 'magnate') {
    try {
      const r = searchTurn(s, i, o);
      if (r) return r.action;
    } catch (e) {
      console.error('the magnate lost its train of thought:', e);
    }
  }
  return botAction(chooseBotMove(s, i));
}
