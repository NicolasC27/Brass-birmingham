/* ------------------------------------------------------------------ */
/* The arena: machines against machines, headless, seat by seat.       */
/*                                                                     */
/* A match seats one subject against a field of three (or fewer) and   */
/* rotates the subject's chair game after game, so that turn order     */
/* favours nobody. The subject and the field may read the board with   */
/* different weights; everyone plays at the same strength and depth,   */
/* so only the reading is on trial.                                    */
/*                                                                     */
/* Every match reports the spread of what it measured. A deal of cards */
/* decides a great deal in this game, so a match of a few dozen games  */
/* tells two equal readings apart about as well as a coin does: the    */
/* spread is what says whether a figure is a finding or a shuffle.     */
/*                                                                     */
/* `paired` goes further and plays each deal twice, once with the      */
/* subject at the table and once with the field alone. The subject's   */
/* chair is then read against what that same chair made of that same   */
/* deal with nobody new in it, and the deal's own luck falls out of    */
/* the difference. One extra game per deal buys it.                    */
/* ------------------------------------------------------------------ */

import { applyAction, fallbackAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { chooseBotAction, currentEvalMode, setEvalMode, setWeights } from '@/game/search';
import type { EvalMode, SearchOptions } from '@/game/search';
import { activeNet, setNet, unpackBrain } from '@/game/net';
import type { Brain } from '@/game/net';
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
  /** the packed network each side reads with; the one in force when absent, none when null */
  subjectNet?: string | null;
  fieldNet?: string | null;
  /** the field's strength when it differs from the subject's */
  fieldStrength?: number;
  /** the field's whole search when it differs by more than strength — a
   *  subject given longer to think must not hand the same to the table */
  fieldSearch?: SearchOptions;
  /** stop at the canal scoring: wins and points are the Canal Era's */
  canalOnly?: boolean;
  /** play every deal once more with the field alone, and read the subject
   *  against that. Costs one game in every `players + 1`, and cancels the
   *  luck of the deal rather than waiting for it to average out. */
  paired?: boolean;
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
  /** the sum of the margins and of their squares, so that slices played on
   *  different threads can be added up and still yield a spread */
  diffSum: number;
  diffSq: number;
  /** how far the average margin might be from the truth: a gap smaller
   *  than twice this is not a gap, only a different set of deals */
  spread: number;
  /** the same for the share of games won */
  winSpread: number;
  /** with `paired`: the subject's margin less the one the same chair posted
   *  on the same deal with the field alone, and how far that might be out.
   *
   *  Counted by the deal, not by the game. The chairs of one deal are read
   *  against a single game of the field alone, so they rise and fall with
   *  it together and are not four separate answers; averaging them into one
   *  keeps the spread honest rather than flattering. */
  edge: number | null;
  edgeSum: number;
  edgeSq: number;
  edgeSpread: number | null;
  /** how many deals were played twice — the count `edgeSum` is a sum of */
  pairs: number;
}

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

/** one game played out, `subject` reading with its own weights */
export function playGame(seed: number, players: number, subject: number, subjectWeights: Weights, fieldWeights: Weights, search: SearchOptions, modes: [EvalMode, EvalMode] = [currentEvalMode(), currentEvalMode()], nets: [Brain | null, Brain | null] = [activeNet(), activeNet()], fieldSearch: SearchOptions = search, canalOnly = false): GameState {
  const setup: SetupPayload = {
    players: Array.from({ length: players }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
  let s = newGame(setup, seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      if (canalOnly) break;
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    setWeights(seat === subject ? subjectWeights : fieldWeights);
    setNet(seat === subject ? nets[0] : nets[1]);
    setEvalMode(seat === subject ? modes[0] : modes[1]);
    const a = chooseBotAction(s, seat, seat === subject ? search : fieldSearch) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s;
}

/** the standard error of a mean, from the count, the sum and the sum of
 *  squares: how far the average of these games might be from the average
 *  of every game that could have been dealt */
const errorOf = (n: number, sum: number, sq: number): number => {
  if (n < 2) return 0;
  const mean = sum / n;
  const variance = Math.max(0, (sq - n * mean * mean) / (n - 1));
  return Math.sqrt(variance / n);
};

export function playMatch(o: MatchOptions): MatchResult {
  let wins = 0;
  let diff = 0;
  let canal = 0;
  let canalField = 0;
  let vp = 0;
  let diffSum = 0;
  let diffSq = 0;
  let edgeSum = 0;
  let edgeSq = 0;
  let pairs = 0;
  /* the deal being played, gathered until its chairs are all in */
  let dealEdge = 0;
  let dealGames = 0;
  const closeDeal = (): void => {
    if (dealGames === 0) return;
    const mean = dealEdge / dealGames;
    edgeSum += mean;
    edgeSq += mean * mean;
    pairs += 1;
    dealEdge = 0;
    dealGames = 0;
  };
  const netOf = (text: string | null | undefined): Brain | null => (text === undefined ? activeNet() : text ? unpackBrain(text) : null);
  const nets: [Brain | null, Brain | null] = [netOf(o.subjectNet), netOf(o.fieldNet)];
  const modes: [EvalMode, EvalMode] = [o.subjectMode ?? currentEvalMode(), o.fieldMode ?? currentEvalMode()];
  const fieldSearch = o.fieldSearch ?? (o.fieldStrength === undefined ? o.search : { ...o.search, strength: o.fieldStrength });
  /* what every chair made of a deal with the field alone at the table: the
     subject's own chair is read against its own line of this, so the deal
     is asked the same question twice and answers it once for nothing */
  const marginsOf = (s: GameState): number[] => {
    const points = o.canalOnly ? (s.canalScores ?? s.players.map(() => 0)) : s.players.map((p) => p.vp);
    return points.map((v, k) => v - Math.max(...points.filter((_, j) => j !== k)));
  };
  const control = (seed: number): number[] => marginsOf(playGame(seed, o.players, -1, o.field, o.field, fieldSearch, [modes[1], modes[1]], [nets[1], nets[1]], fieldSearch, !!o.canalOnly));

  let lastDeal = -1;
  let lastControl: number[] | null = null;
  for (let g = 0; g < o.games; g++) {
    const subject = g % o.players;
    /* unpaired, every game is a fresh deal. Paired, a deal is worth one
       game in each chair, since the control game takes its luck away */
    const deal = o.paired ? Math.floor(g / o.players) : g;
    const seed = o.seed + deal;
    if (o.paired && deal !== lastDeal) {
      closeDeal();
      lastControl = control(seed);
      lastDeal = deal;
    }
    const held = o.paired ? lastControl : null;
    const s = playGame(seed, o.players, subject, o.subject, o.field, o.search, modes, nets, fieldSearch, !!o.canalOnly);
    const points = o.canalOnly ? (s.canalScores ?? s.players.map(() => 0)) : s.players.map((p) => p.vp);
    const others = points.filter((_, k) => k !== subject);
    const winner = o.canalOnly ? points.indexOf(Math.max(...points)) : s.winner;
    if (winner === subject) wins += 1;
    const margin = points[subject] - Math.max(...others);
    diff += margin;
    diffSum += margin;
    diffSq += margin * margin;
    if (held) {
      dealEdge += margin - (held[subject] ?? 0);
      dealGames += 1;
    }
    vp += points[subject];
    const cs = s.canalScores ?? [];
    canal += cs[subject] ?? 0;
    canalField += cs.filter((_, k) => k !== subject).reduce((a, b) => a + b, 0) / Math.max(1, o.players - 1);
  }
  closeDeal();
  const share = wins / Math.max(1, o.games);
  return {
    games: o.games,
    wins,
    diff: diff / o.games,
    canal: canal / o.games,
    canalField: canalField / o.games,
    vp: vp / o.games,
    diffSum,
    diffSq,
    spread: errorOf(o.games, diffSum, diffSq),
    winSpread: o.games < 2 ? 0 : Math.sqrt((share * (1 - share)) / o.games),
    edge: o.paired && pairs > 0 ? edgeSum / pairs : null,
    edgeSum,
    edgeSq,
    edgeSpread: o.paired ? errorOf(pairs, edgeSum, edgeSq) : null,
    pairs,
  };
}
