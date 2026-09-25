/* ------------------------------------------------------------------ */
/* The review — what a finished game says about how it was played.     */
/*                                                                     */
/* Nothing here is an opinion: the log is replayed from its seed and    */
/* every figure is read off the table as it stood. Where the points     */
/* came from, what an action was worth, what never flipped, who opened  */
/* each round. The machine's own reading of the moves is a separate     */
/* matter, and lives in the worker beside this file.                    */
/* ------------------------------------------------------------------ */

import { actorOf, applyAction } from './actions';
import type { GameAction } from './actions';
import { INDUSTRIES, incomeLevel } from './data';
import { newGame } from './engine';
import type { Era, GameState, IndustryType, SetupPayload, Verb } from './types';

/** a tile of one's own the game ended with, still face up */
export interface Idle {
  industry: IndustryType;
  level: number;
  town: string;
  vp: number;
}

export interface SeatReview {
  seat: number;
  name: string;
  bot: boolean;
  vp: number;
  /** actions actually taken, and what each one was worth in points */
  actions: number;
  perAction: number;
  /** where the points came from, era by era */
  canal: { tiles: number; links: number };
  rail: { tiles: number; links: number } | null;
  /** the initiation game's closing books, when it was one */
  close: number;
  /** what was never flipped, and what it would have been worth */
  idle: Idle[];
  idleVp: number;
  /** level-1 tiles the sweep took unflipped at the canal's end */
  swept: Idle[];
  sweptVp: number;
  /** money spent in each round, and the rounds opened first */
  spent: number[];
  opened: number;
  /** where the seat stood when the books closed */
  money: number;
  income: number;
  /** actions by kind */
  byKind: Record<Verb, number>;
}

export interface Review {
  seats: SeatReview[];
  /** the table at the close of every round */
  rounds: { era: Era; round: number; vp: number[]; income: number[]; money: number[] }[];
  /** what the game was worth in actions, for the points-per-action bar */
  actionsTotal: number;
  short: boolean;
}

const KINDS: Verb[] = ['build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass'];

const tilesOf = (s: GameState, seat: number, only?: (t: { level: number; flipped: boolean }) => boolean): Idle[] =>
  Object.entries(s.tiles)
    .filter(([, t]) => t.owner === seat && !t.flipped && (!only || only(t)))
    .map(([key, t]) => ({ industry: t.industry, level: t.level, town: key.split(':')[0], vp: INDUSTRIES[t.industry][t.level - 1].vp }));

/** replay a finished game and read off what it says */
export function reviewGame(setup: SetupPayload, seed: number, actions: GameAction[]): Review {
  let s = newGame(setup, seed);
  const n = s.players.length;
  const blank = (): Record<Verb, number> => Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Verb, number>;
  const byKind = s.players.map(blank);
  const spent: number[][] = s.players.map(() => []);
  const opened = s.players.map(() => 0);
  const rounds: Review['rounds'] = [];
  /* what the sweep is about to take, captured while it is still on the board */
  let swept: Idle[][] = s.players.map(() => []);
  let canalSplit: { links: number; tiles: number }[] | null = null;

  let round = s.round;
  let era: Era = s.era;
  opened[s.order[0]] += 1;
  for (const a of actions) {
    const seat = actorOf(s, a);
    if (seat >= 0 && a.kind !== 'begin-rail' && a.kind !== 'concede' && a.kind !== 'resign') byKind[seat][a.kind as Verb] += 1;
    /* the canal era is scored by the action that ends it; the sweep waits
       for the next one, so this is the moment the doomed tiles are read */
    const wasCanal = s.era === 'canal' && !s.canalScores;
    const r = applyAction(s, seat < 0 ? s.current : seat, a);
    if (!r.state) continue;
    s = r.state;
    if (wasCanal && s.canalScores) {
      swept = s.players.map((_, i) => tilesOf(s, i, (t) => t.level === 1));
      canalSplit = s.canalSplit ?? null;
    }
    if (s.round !== round || s.era !== era) {
      const last = s.lastSpent ?? s.players.map(() => 0);
      s.players.forEach((_, i) => spent[i].push(last[i] ?? 0));
      const snap = s.history[s.history.length - 1];
      if (snap) rounds.push({ era: snap.era, round: snap.round, vp: [...snap.vp], income: [...snap.income], money: [...snap.money] });
      if (s.phase === 'action') opened[s.order[0]] += 1;
      round = s.round;
      era = s.era;
    }
  }

  const short = s.eraLength === 'short';
  const railSplit = s.finalSplit ?? null;
  const acted = s.players.map((_, i) => actions.filter((a) => a.kind !== 'begin-rail' && actorOf(s, a) === i).length);
  const seats: SeatReview[] = s.players.map((p, i) => {
    const idle = tilesOf(s, i);
    const canal = canalSplit?.[i] ?? { tiles: 0, links: 0 };
    const rail = railSplit?.[i] ?? null;
    /* the close of an initiation game is what the era scores do not explain */
    const scored = (s.canalScores?.[i] ?? 0) + (s.finalScores?.[i] ?? 0);
    const takenActions = Math.max(1, byKind[i] ? KINDS.reduce((sum, k) => sum + byKind[i][k], 0) : acted[i]);
    return {
      seat: i,
      name: p.name,
      bot: p.isBot,
      vp: p.vp,
      actions: takenActions,
      perAction: Math.round((p.vp / takenActions) * 10) / 10,
      canal: { tiles: canal.tiles, links: canal.links },
      rail: rail ? { tiles: rail.tiles, links: rail.links } : null,
      close: p.vp - scored,
      idle,
      idleVp: idle.reduce((sum, t) => sum + t.vp, 0),
      swept: swept[i] ?? [],
      sweptVp: (swept[i] ?? []).reduce((sum, t) => sum + t.vp, 0),
      spent: spent[i],
      opened: opened[i],
      money: p.money,
      income: incomeLevel(p.income),
      byKind: byKind[i],
    };
  });
  return { seats, rounds, actionsTotal: seats.reduce((sum, x) => sum + x.actions, 0) / Math.max(1, n), short };
}
