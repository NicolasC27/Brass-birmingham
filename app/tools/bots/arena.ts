/* ------------------------------------------------------------------ */
/* The arena: machines against machines, headless, seat by seat.       */
/*                                                                     */
/* A match seats one subject against a field of three (or fewer) and   */
/* rotates the subject's chair game after game, so that turn order     */
/* favours nobody. The subject and the field may read the board with   */
/* different weights; everyone plays at the same strength and depth,   */
/* so only the reading is on trial.                                    */
/* ------------------------------------------------------------------ */

import { applyAction, fallbackAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { chooseBotAction, currentEvalMode, setEvalMode, setWeights } from '@/game/search';
import type { EvalMode, SearchOptions } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';
import type { Weights } from '@/game/weights';

export interface MatchOptions {
  games: number;
  players: number;
  /** the first seed; game g plays seed + g */
  seed: number;
  subject: Weights;
  field: Weights;
  search: SearchOptions;
  /** how each side reads the board; the mode in force when absent */
  subjectMode?: EvalMode;
  fieldMode?: EvalMode;
}

export interface MatchResult {
  games: number;
  wins: number;
  /** the subject's points less the best rival's, on average */
  diff: number;
  /** the subject's canal-era points, and the field's on average */
  canal: number;
  canalField: number;
  vp: number;
}

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

/** one game played out, `subject` reading with its own weights */
export function playGame(seed: number, players: number, subject: number, subjectWeights: Weights, fieldWeights: Weights, search: SearchOptions, modes: [EvalMode, EvalMode] = [currentEvalMode(), currentEvalMode()]): GameState {
  const setup: SetupPayload = {
    players: Array.from({ length: players }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
  let s = newGame(setup, seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    setWeights(seat === subject ? subjectWeights : fieldWeights);
    setEvalMode(seat === subject ? modes[0] : modes[1]);
    const a = chooseBotAction(s, seat, search) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s;
}

export function playMatch(o: MatchOptions): MatchResult {
  let wins = 0;
  let diff = 0;
  let canal = 0;
  let canalField = 0;
  let vp = 0;
  for (let g = 0; g < o.games; g++) {
    const subject = g % o.players;
    const s = playGame(o.seed + g, o.players, subject, o.subject, o.field, o.search, [o.subjectMode ?? currentEvalMode(), o.fieldMode ?? currentEvalMode()]);
    const points = s.players.map((p) => p.vp);
    const others = points.filter((_, k) => k !== subject);
    if (s.winner === subject) wins += 1;
    diff += points[subject] - Math.max(...others);
    vp += points[subject];
    const cs = s.canalScores ?? [];
    canal += cs[subject] ?? 0;
    canalField += cs.filter((_, k) => k !== subject).reduce((a, b) => a + b, 0) / Math.max(1, o.players - 1);
  }
  return { games: o.games, wins, diff: diff / o.games, canal: canal / o.games, canalField: canalField / o.games, vp: vp / o.games };
}
