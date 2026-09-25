import { applyAction, fallbackAction, setupOf } from './actions';
import { eraRounds, newGame } from './engine';
import type { GameAction } from './actions';
import { chooseBotAction, evaluate, worthTrying } from './search';
import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* The analysis — a finished game read move by move, the way a chess    */
/* game is: every position on the board, an estimated chance of winning */
/* at each, the moves the reader played graded against the machine's    */
/* best, and at any of their turns the other roads: what else could have */
/* been played there, and where each would have left them.             */
/* ------------------------------------------------------------------ */

/** every position of the game: positions[k] is the table after k actions */
export function positionsOf(g: GameState): GameState[] {
  const setup = setupFrom(g);
  const out: GameState[] = [setup];
  let s = setup;
  for (const a of g.actions) {
    const r = applyAction(s, s.current, a);
    /* a vote is cast on anyone's turn, in the voter's name */
    const next = r.state ?? (a.kind === 'concede' ? applyAction(s, a.player, a).state : null);
    if (!next) break;
    s = next;
    out.push(s);
  }
  return out;
}

/** how many points ahead of the best rival the judge sees this seat, in the judge's units */
export function edgeOf(s: GameState, me: number): number {
  const mine = evaluate(s, me);
  let best = -Infinity;
  s.players.forEach((_, i) => {
    if (i !== me) best = Math.max(best, evaluate(s, i));
  });
  return best === -Infinity ? 0 : mine - best;
}

/** the rounds still to be played after this one, both eras counted */
export function roundsLeft(s: GameState): number {
  const perEra = eraRounds(s.players.length);
  const eras = s.eraLength === 'short' ? 1 : 2;
  const played = (s.era === 'rail' ? perEra : 0) + s.round;
  return Math.max(0, eras * perEra - played);
}

/** the chance of winning the judge gives this seat here, 0 to 1: a logistic
    on the edge, wider while the game is young — the same lead is worth less
    with eighteen rounds to play than with one */
export function winChance(s: GameState, me: number): number {
  if (s.phase === 'game-over') {
    const top = Math.max(...s.players.map((p) => p.vp));
    return s.players[me].vp >= top ? 1 : 0;
  }
  const spread = 8 * Math.sqrt(1 + roundsLeft(s) / 3);
  return 1 / (1 + Math.exp(-edgeOf(s, me) / spread));
}

export type Quality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
/** a move graded on what it left on the table against the machine's best */
export function qualityOf(gap: number): Quality {
  if (gap <= 0.5) return 'best';
  if (gap < 2) return 'good';
  if (gap < 6) return 'inaccuracy';
  if (gap < 15) return 'mistake';
  return 'blunder';
}

export interface Road {
  action: GameAction;
  /** the table after it */
  after: GameState;
  chance: number;
}

/** the other roads from a position of the reader's: the moves worth trying
 *  there, each played out one step and weighed, the best first */
export function roadsFrom(s: GameState, me: number, keep = 8, played?: GameAction): Road[] {
  if (s.phase !== 'action' || s.current !== me) return [];
  /* every legal move, one road per distinct move — two cards that build the
     same tile in the same place are the same road */
  const seen = new Map<string, Road>();
  for (const action of worthTrying(s, me)) {
    const key = sameRoad(action);
    if (seen.has(key)) continue;
    const after = applyAction(s, me, action).state;
    if (after) seen.set(key, { action, after, chance: winChance(after, me) });
  }
  const roads = [...seen.values()].sort((a, b) => b.chance - a.chance);
  const top = roads.slice(0, keep);
  /* the move actually played always sits among them, however it ranks */
  if (played) {
    const key = sameRoad(played);
    if (!top.some((r) => sameRoad(r.action) === key)) {
      const it = roads.find((r) => sameRoad(r.action) === key);
      if (it) top.push(it);
    }
  }
  return top;
}

/** a move stripped of the card it was paid with and of the slot and source
    the engine would pick alike: what it does on the board */
export function sameRoad(a: GameAction): string {
  const rest: Record<string, unknown> = { ...a };
  for (const k of ['card', 'slot', 'ironFrom', 'beerFrom']) delete rest[k];
  return JSON.stringify(rest);
}

/* the setup a game began from, as the store keeps it on the state */
function setupFrom(g: GameState): GameState {
  return newGame(setupOf(g), g.seed);
}

/** a move of the machine's while a branch is followed on */
export interface Followed {
  seat: number;
  action: GameAction;
}

/** the machine plays every seat from here for a few moves, so a branch shows
    where it leads rather than only the table the move leaves */
export function followOn(s: GameState, moves: number, budgetMs = 40): { moves: Followed[]; after: GameState } {
  const played: Followed[] = [];
  let cur = s;
  let guard = 0;
  while (played.length < moves && cur.phase !== 'game-over' && guard++ < moves * 3) {
    if (cur.phase === 'scoring-canal') {
      const next = applyAction(cur, cur.current, { kind: 'begin-rail' }).state;
      if (!next) break;
      cur = next;
      continue;
    }
    const seat = cur.current;
    const action = chooseBotAction(cur, seat, { strength: 0.8, budgetMs }) ?? fallbackAction(cur, seat);
    const next = applyAction(cur, seat, action).state ?? applyAction(cur, seat, fallbackAction(cur, seat)).state;
    if (!next) break;
    played.push({ seat, action });
    cur = next;
  }
  return { moves: played, after: cur };
}
