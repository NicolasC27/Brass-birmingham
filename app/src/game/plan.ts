import { applyAction, setupOf } from './actions';
import { newGame } from './engine';
import type { Era, GameState, IndustryType } from './types';

/* ------------------------------------------------------------------ */
/* The plan a seat played.                                             */
/*                                                                     */
/* A game read move by move says what each move cost; it never says    */
/* what the player was trying to do. The strategy guide names five     */
/* plans the game is won with — beer and rails, cotton at the top of   */
/* the market, pottery, the big boxes, cotton at the bottom — each a   */
/* handful of things done or not done by the end. So the moves are     */
/* counted into those same things, every plan scored on how much of it */
/* was carried out, and the closest named: not a grade, a mirror.      */
/*                                                                     */
/* Nothing here reads the future or the other seats' hands: it counts  */
/* what was played, after the game, and says it back.                  */
/* ------------------------------------------------------------------ */

/** the plans of the guide, by the names it gives them */
export type PlanId = 'bric' | 'bigCotton' | 'pottery' | 'bigBox' | 'lowCotton';

/** the names the guide gives them, kept in its own tongue: they are what the
    tables call these plans, in every language */
export const PLAN_NAMES: Record<PlanId, string> = {
  bric: 'BRIC',
  bigCotton: 'Big Cotton',
  pottery: 'Pottery',
  bigBox: 'Big Box',
  lowCotton: 'Low Cotton',
};

/** under this, the moves say nothing clear enough to name a plan */
export const PLAN_FAINT = 0.2;

/** the things a plan is made of, each counted from the moves */
export type GoalId =
  | 'manufacturers'
  | 'ironWorks'
  | 'ironTop'
  | 'breweries'
  | 'doubleRails'
  | 'rails'
  | 'cottonHigh'
  | 'cottonLow'
  | 'fewCanals'
  | 'coalMines'
  | 'potteryLow'
  | 'potteryHigh'
  | 'boxesHigh'
  | 'develops';

/** what a seat did, counted */
export interface Deeds {
  /** every tile built: what it was, how high, in which era, and whether it was sold */
  built: { industry: IndustryType; level: number; era: Era; sold: boolean }[];
  /** the links laid, and which were a rail doubled with another in one action */
  links: { era: Era; double: boolean }[];
  loans: number;
  develops: number;
  /** industries developed away, level by level */
  developed: number;
  actions: number;
  /** the tiles never turned over, level 1 apart from coal and iron */
  lowLeft: number;
  vp: number;
  income: number;
}

const HIGH = 3;

/** every move of one seat, counted into the things the plans are made of */
export function deedsOf(g: GameState, me: number): Deeds {
  const setup = newGame(setupOf(g), g.seed);
  let s = setup;
  const built: Deeds['built'] = [];
  const links: Deeds['links'] = [];
  let loans = 0;
  let develops = 0;
  let developed = 0;
  let actions = 0;
  /* a tile is named by its place, so a sale can find what it turned over */
  const byPlace = new Map<string, { industry: IndustryType; level: number; era: Era; sold: boolean }>();
  for (const a of g.actions) {
    const seat = a.kind === 'concede' ? a.player : s.current;
    const r = applyAction(s, s.current, a);
    const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
    if (!next) break;
    if (seat === me) {
      if (a.kind !== 'concede' && a.kind !== 'resign' && a.kind !== 'begin-rail') actions += 1;
      switch (a.kind) {
        case 'build': {
          const place = `${a.town}:${a.slot}`;
          const tile = next.tiles[place];
          if (tile && tile.owner === me) {
            const made = { industry: tile.industry, level: tile.level, era: s.era, sold: tile.flipped };
            built.push(made);
            byPlace.set(place, made);
          }
          break;
        }
        case 'network':
          links.push({ era: s.era, double: !!a.second });
          break;
        case 'sell':
          for (const sale of a.sales) {
            const made = byPlace.get(`${sale.town}:${sale.slot}`);
            if (made) made.sold = true;
          }
          break;
        case 'loan':
          loans += 1;
          break;
        case 'develop':
          develops += 1;
          developed += a.industries.length;
          break;
        default:
          break;
      }
    }
    s = next;
  }
  /* what was left standing: a low tile never turned over is a plan half done */
  let lowLeft = 0;
  for (const tile of Object.values(s.tiles)) {
    if (tile.owner !== me || tile.flipped || tile.level > 1) continue;
    if (tile.industry === 'coal' || tile.industry === 'iron') continue;
    lowLeft += 1;
  }
  return { built, links, loans, develops, developed, actions, lowLeft, vp: s.players[me]?.vp ?? 0, income: s.players[me]?.income ?? 0 };
}

const sold = (d: Deeds, industry: IndustryType, from = 1, era?: Era) => d.built.filter((b) => b.industry === industry && b.level >= from && b.sold && (!era || b.era === era)).length;
const madeOf = (d: Deeds, industry: IndustryType, from = 1, era?: Era) => d.built.filter((b) => b.industry === industry && b.level >= from && (!era || b.era === era)).length;

/** how far each thing was carried, against what the guide asks for */
export function goalsOf(d: Deeds): Record<GoalId, { done: number; target: number }> {
  const canals = d.links.filter((l) => l.era === 'canal').length;
  return {
    manufacturers: { done: sold(d, 'manufacturer', 1, 'canal'), target: 2 },
    ironWorks: { done: madeOf(d, 'iron', 2), target: 2 },
    ironTop: { done: madeOf(d, 'iron', 4), target: 1 },
    breweries: { done: madeOf(d, 'brewery'), target: 3 },
    doubleRails: { done: d.links.filter((l) => l.double).length, target: 2 },
    rails: { done: d.links.filter((l) => l.era === 'rail').length, target: 6 },
    cottonHigh: { done: sold(d, 'cotton', HIGH), target: 3 },
    cottonLow: { done: d.built.filter((b) => b.industry === 'cotton' && b.level === 1 && b.sold).length, target: 3 },
    /* the one goal a smaller number carries: the guide wants two or three
       canals, no more — carried or not, there is nothing in between */
    fewCanals: { done: canals <= 3 ? 1 : 0, target: 1 },
    coalMines: { done: madeOf(d, 'coal'), target: 2 },
    potteryLow: { done: sold(d, 'pottery', 1, 'canal'), target: 2 },
    potteryHigh: { done: madeOf(d, 'pottery', 4), target: 1 },
    boxesHigh: { done: madeOf(d, 'manufacturer', 5), target: 2 },
    develops: { done: d.develops, target: 3 },
  };
}

/** the plans, each a handful of those things with what it leans on most.
    `core` is what the plan cannot exist without: a game with no cotton sold
    is not Big Cotton, whatever else it did right, so the core holds the
    score down rather than letting the common goals carry every plan */
export const PLANS: Record<PlanId, { goals: { goal: GoalId; weight: number }[]; core: GoalId[] }> = {
  bric: { core: ['breweries', 'ironWorks'], goals: [
    { goal: 'manufacturers', weight: 2 },
    { goal: 'ironWorks', weight: 2 },
    { goal: 'breweries', weight: 2 },
    { goal: 'doubleRails', weight: 1.5 },
    { goal: 'ironTop', weight: 1 },
  ] },
  bigCotton: { core: ['cottonHigh'], goals: [
    { goal: 'cottonHigh', weight: 3 },
    { goal: 'fewCanals', weight: 1 },
    { goal: 'coalMines', weight: 1.5 },
    { goal: 'rails', weight: 1 },
    { goal: 'breweries', weight: 1 },
  ] },
  pottery: { core: ['potteryLow', 'potteryHigh'], goals: [
    { goal: 'potteryLow', weight: 2.5 },
    { goal: 'potteryHigh', weight: 2 },
    { goal: 'coalMines', weight: 1 },
    { goal: 'ironWorks', weight: 1 },
    { goal: 'breweries', weight: 1 },
  ] },
  bigBox: { core: ['boxesHigh'], goals: [
    { goal: 'boxesHigh', weight: 3 },
    { goal: 'develops', weight: 2 },
    { goal: 'rails', weight: 1.5 },
    { goal: 'manufacturers', weight: 1 },
  ] },
  lowCotton: { core: ['cottonLow'], goals: [
    { goal: 'cottonLow', weight: 3 },
    { goal: 'fewCanals', weight: 1 },
    { goal: 'coalMines', weight: 1 },
    { goal: 'breweries', weight: 1.5 },
    { goal: 'doubleRails', weight: 1 },
  ] },
};

export interface PlanRead {
  id: PlanId;
  /** how much of the plan was carried out, 0 to 1 */
  score: number;
  goals: { id: GoalId; done: number; target: number; core: boolean }[];
}

/** the tips of the guide that can be counted, and what they came to here */
export interface TipRead {
  id: 'perAction' | 'lowLeft' | 'income';
  /** what the seat did, and what the guide asks for */
  value: number;
  want: number;
  /** met when the seat is on the right side of `want` */
  met: boolean;
}

/** the plan a seat played, the others it brushed against, and the guide's
    counted tips — read from the moves alone, after the game */
export function planOf(g: GameState, me: number): { best: PlanRead; all: PlanRead[]; tips: TipRead[]; deeds: Deeds } {
  const deeds = deedsOf(g, me);
  const goals = goalsOf(deeds);
  const all = (Object.keys(PLANS) as PlanId[])
    .map((id) => {
      const { goals: parts, core } = PLANS[id];
      const carried = (g: GoalId) => Math.min(1, goals[g].done / goals[g].target);
      const weight = parts.reduce((sum, p) => sum + p.weight, 0);
      const spread = parts.reduce((sum, p) => sum + p.weight * carried(p.goal), 0) / weight;
      const held = core.reduce((sum, g) => sum + carried(g), 0) / core.length;
      /* a seat that has not played carries no plan: the goals a small number
         satisfies would otherwise hand it a score for doing nothing */
      const score = deeds.actions === 0 ? 0 : spread * held;
      return { id, score, goals: parts.map((p) => ({ id: p.goal, ...goals[p.goal], core: core.includes(p.goal) })) };
    })
    .sort((a, b) => b.score - a.score);
  /* five points an action is what the guide asks of every action */
  const perAction = deeds.actions ? deeds.vp / deeds.actions : 0;
  const tips: TipRead[] = [
    { id: 'perAction', value: Math.round(perAction * 10) / 10, want: 5, met: perAction >= 5 },
    { id: 'lowLeft', value: deeds.lowLeft, want: 0, met: deeds.lowLeft === 0 },
    { id: 'income', value: deeds.income, want: 20, met: deeds.income >= 20 },
  ];
  return { best: all[0], all, tips, deeds };
}
