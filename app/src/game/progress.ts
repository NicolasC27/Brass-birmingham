import { LOSS, sameRoad } from './analysis';
import type { Verdict } from './analysis';
import type { GameAction } from './actions';
import { PLAN_FAINT, planOf } from './plan';
import type { PlanId } from './plan';
import type { Grade } from './review';
import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* The sheet of progress. Every game the judge has read through leaves */
/* one line on it: how the seat's moves were graded, what they cost on */
/* average, the plan they added up to, and the motifs of its misses —  */
/* what kind of move was played when what kind was better. Game after  */
/* game the desk draws the line, and the review names what keeps       */
/* coming back. Kept in this browser, a hundred games at most.         */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.progress.v1';
const MOST = 100;

/** the motifs a miss may fall under: what was played against what was better */
export type Motif = 'singleRail' | 'loanOverBuild' | 'passed' | 'buildOverDevelop' | 'developOverBuild' | 'sellLate' | 'buildOverLink' | 'linkOverBuild' | 'wrongTown' | 'wrongIndustry';

export const MOTIFS: Motif[] = ['singleRail', 'loanOverBuild', 'passed', 'buildOverDevelop', 'developOverBuild', 'sellLate', 'buildOverLink', 'linkOverBuild', 'wrongTown', 'wrongIndustry'];

/** one game on the sheet */
export interface Played {
  /** table, deal and seat: one line per game read */
  id: string;
  /** when the reading ended */
  at: number;
  table: string;
  seed: number;
  seat: number;
  players: number;
  vp: number;
  /** 1 for the winner */
  rank: number;
  /** the seat's turns graded */
  moves: number;
  /** the mean loss per move, in points of chance */
  lost: number;
  by: Record<Grade, number>;
  plan: PlanId | null;
  planScore: number;
  motifs: Partial<Record<Motif, number>>;
}

/** the motif of one miss, from the move played and the road read best */
export function motifOf(played: GameAction, better: GameAction): Motif | null {
  if (sameRoad(played) === sameRoad(better)) return null;
  if (played.kind === 'pass' || played.kind === 'scout') return 'passed';
  if (played.kind === 'network' && !played.second && better.kind === 'network' && better.second) return 'singleRail';
  if (played.kind === 'loan' && better.kind === 'build') return 'loanOverBuild';
  if (played.kind === 'build' && better.kind === 'develop') return 'buildOverDevelop';
  if (played.kind === 'develop' && better.kind === 'build') return 'developOverBuild';
  if (played.kind !== 'sell' && better.kind === 'sell') return 'sellLate';
  if (played.kind === 'build' && better.kind === 'network') return 'buildOverLink';
  if (played.kind === 'network' && better.kind === 'build') return 'linkOverBuild';
  if (played.kind === 'build' && better.kind === 'build') return better.town !== played.town ? 'wrongTown' : better.industry !== played.industry ? 'wrongIndustry' : null;
  return null;
}

/** the motifs of a seat's misses in one game, counted */
export function motifsOf(game: GameState, verdicts: Record<number, Verdict>): Partial<Record<Motif, number>> {
  const out: Partial<Record<Motif, number>> = {};
  for (const v of Object.values(verdicts)) {
    if (v.loss <= LOSS.good) continue;
    const played = game.actions[v.at];
    const better = v.roads[0]?.action;
    if (!played || !better) continue;
    const m = motifOf(played, better);
    if (m) out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

const readAll = (): Played[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Played[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/** the games on the sheet, the latest first */
export const listProgress = (): Played[] => readAll().sort((a, b) => b.at - a.at);

/** a game read through: its line written, an older line of the same game replaced */
export function recordProgress(game: GameState, table: string, seat: number, verdicts: Record<number, Verdict>): Played | null {
  if (game.phase !== 'game-over') return null;
  const list = Object.values(verdicts);
  if (!list.length) return null;
  const by = { top: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 } as Record<Grade, number>;
  let lost = 0;
  for (const v of list) {
    by[v.grade] += 1;
    lost += v.loss;
  }
  const plan = planOf(game, seat);
  const vps = game.players.map((p) => p.vp);
  const rank = 1 + vps.filter((vp) => vp > vps[seat]).length;
  const line: Played = {
    id: `${table}:${game.seed}:${seat}`,
    at: Date.now(),
    table,
    seed: game.seed,
    seat,
    players: game.players.length,
    vp: vps[seat],
    rank,
    moves: list.length,
    lost: Math.round((1000 * lost) / list.length) / 10,
    by,
    plan: plan.best.score < PLAN_FAINT ? null : plan.best.id,
    planScore: Math.round(plan.best.score * 100),
    motifs: motifsOf(game, verdicts),
  };
  const kept = readAll().filter((p) => p.id !== line.id);
  kept.push(line);
  kept.sort((a, b) => b.at - a.at);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept.slice(0, MOST)));
  } catch {
    /* the shelf is full: the sheet waits for the next game */
  }
  return line;
}

/** the motifs that keep coming back over the last games, the most frequent
    first: a motif counts when it turned up in at least two games */
export function recurring(list: Played[], last = 10): { motif: Motif; games: number; times: number }[] {
  const recent = list.slice(0, last);
  const seen = new Map<Motif, { games: number; times: number }>();
  for (const p of recent) {
    for (const [m, n] of Object.entries(p.motifs) as [Motif, number][]) {
      if (!n) continue;
      const e = seen.get(m) ?? { games: 0, times: 0 };
      e.games += 1;
      e.times += n;
      seen.set(m, e);
    }
  }
  return [...seen.entries()]
    .filter(([, e]) => e.games >= 2 || e.times >= 3)
    .map(([motif, e]) => ({ motif, ...e }))
    .sort((a, b) => b.times - a.times);
}
