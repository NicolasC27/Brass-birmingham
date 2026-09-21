/* ------------------------------------------------------------------ */
/* The machines train for points.                                      */
/*                                                                     */
/* The older trainer (train.ts) breeds a reading of the board that     */
/* wins matches against copies of itself. That is the right goal for   */
/* a bot meant to beat a player, and the wrong one for a bot measured  */
/* by the score it posts: a seat can win by forty while scoring a      */
/* hundred and twenty, where another scores a hundred and sixty.       */
/*                                                                     */
/* This one breeds for the score itself — the expert's own final       */
/* points against a weak table, at three seats and at four, the two    */
/* tables the target is set on. An evolution of one parent and a       */
/* handful of children, each child judged on exactly the same games    */
/* as its parent so that the luck of the deal cancels out. The weak    */
/* table is held at the hand-written defaults for good, so that a      */
/* score means the same thing from one run to the next.                */
/*                                                                     */
/*   sh tools/bots/aim.sh      (GENERATIONS, GAMES, BUDGET, SEED,      */
/*                              CHALLENGERS, SEATS in the env)         */
/*                                                                     */
/* The winner is written into src/game/weights.ts as TRAINED, every    */
/* generation into tools/bots/aim.log.                                 */
/* ------------------------------------------------------------------ */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { loadNet, unpackBrain } from '@/game/net';
import { NET_B64 } from '@/game/net-weights';
import { DEFAULTS, TRAINED } from '@/game/weights';
import type { Weights } from '@/game/weights';
import { playGame } from './arena';

const GENERATIONS = Number(process.env.GENERATIONS ?? 40);
/** games at each table size, per candidate */
const GAMES = Number(process.env.GAMES ?? 12);
/** the tables the target is set on */
const SEATS = (process.env.SEATS ?? '3,4').split(',').map(Number);
/** the expert's thinking time while breeding; the winner is judged again at 1500 */
const BUDGET = Number(process.env.BUDGET ?? 400);
const CHALLENGERS = Number(process.env.CHALLENGERS ?? Math.max(2, Math.min(7, cpus().length - 2)));
const SEED = Number(process.env.SEED ?? 20260921);
/** how far a mutation moves a weight: a log-normal step */
const STEP = Number(process.env.STEP ?? 0.25);
/** points a child must add before it takes over, on top of its parent */
const MARGIN = Number(process.env.MARGIN ?? 1.5);

const WEIGHTS_FILE = resolve('src/game/weights.ts');
const LOG_FILE = resolve('tools/bots/aim.log');

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a child: about half the weights nudged, each by a log-normal step. A
 *  weight sitting at zero would never move again, so it is given a floor */
function mutate(w: Weights, rand: () => number): Weights {
  const out = { ...w };
  for (const key of Object.keys(out) as (keyof Weights)[]) {
    if (rand() < 0.5) continue;
    const g = rand() + rand() + rand() - 1.5;
    const from = out[key] === 0 ? 0.05 : out[key];
    out[key] = +(from * Math.exp(STEP * g)).toFixed(4);
  }
  return out;
}

function writeWeights(w: Weights): void {
  const src = readFileSync(WEIGHTS_FILE, 'utf8');
  const body = (Object.keys(DEFAULTS) as (keyof Weights)[]).map((k) => `  ${k}: ${w[k]},`).join('\n');
  writeFileSync(WEIGHTS_FILE, src.replace(/export const TRAINED: Weights = [^;]*;/s, `export const TRAINED: Weights = {\n${body}\n};`));
}

interface Score {
  /** the seat's own final points, averaged over every game */
  points: number;
  /** per table size, for the log */
  bySeats: number[];
  wins: number;
  games: number;
}

/** one candidate played over the same games as everyone else this generation */
function judge(w: Weights, seed: number): Score {
  const brain = unpackBrain(NET_B64);
  /* the table the score is posted against never moves: were it the reading
     being bred, every generation would face a different opponent and the
     numbers of one run would mean nothing beside another's */
  const weak: Weights = { ...DEFAULTS };
  let points = 0;
  let wins = 0;
  let games = 0;
  const bySeats: number[] = [];
  for (const players of SEATS) {
    let sum = 0;
    for (let g = 0; g < GAMES; g++) {
      const seat = g % players;
      const s = playGame(
        seed + g,
        players,
        seat,
        w,
        weak,
        { strength: 1, budgetMs: BUDGET, depth: 2 },
        ['blend', 'hand'],
        [brain, null],
        { strength: 0.3 },
        false,
      );
      sum += s.players[seat].vp;
      if (s.winner === seat) wins += 1;
      games += 1;
    }
    bySeats.push(sum / GAMES);
    points += sum;
  }
  return { points: points / Math.max(1, games), bySeats, wins, games };
}

function runOne(w: Weights, seed: number): Promise<Score> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { w, seed } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
}

async function evolve(): Promise<void> {
  let parent: Weights = { ...TRAINED };
  const rand = mulberry(SEED);
  const log = (line: string) => {
    console.log(line);
    appendFileSync(LOG_FILE, line + '\n');
  };
  log(`--- aiming ${new Date().toISOString()}: ${GENERATIONS} generations × ${CHALLENGERS} children × ${GAMES} games at ${SEATS.join(' and ')} seats, thinking ${BUDGET} ms`);
  for (let g = 1; g <= GENERATIONS; g++) {
    /* every candidate of a generation plays the same games: the deal's
       luck then falls on parent and children alike and cancels out */
    const seed = SEED + g * 1000;
    const children = Array.from({ length: CHALLENGERS }, () => mutate(parent, rand));
    const started = Date.now();
    const [base, ...scores] = await Promise.all([parent, ...children].map((w) => runOne(w, seed)));
    log(`gen ${g}: the parent scores ${base.points.toFixed(1)} (${base.bySeats.map((x) => x.toFixed(0)).join(' / ')}), ${base.wins}/${base.games} won`);
    let best = -1;
    scores.forEach((r, k) => {
      const gain = r.points - base.points;
      const ok = gain >= MARGIN;
      log(`gen ${g} child ${k + 1}: ${r.points.toFixed(1)} (${r.bySeats.map((x) => x.toFixed(0)).join(' / ')}), ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}${ok ? ' ✓' : ''}`);
      if (ok && (best < 0 || r.points > scores[best].points)) best = k;
    });
    if (best >= 0) {
      parent = children[best];
      writeWeights(parent);
      log(`gen ${g}: child ${best + 1} takes over at ${scores[best].points.toFixed(1)} points — ${JSON.stringify(parent)}`);
    } else log(`gen ${g}: the parent holds`);
    log(`gen ${g} took ${Math.round((Date.now() - started) / 1000)} s`);
  }
  log('--- done');
}

if (isMainThread) {
  loadNet(NET_B64);
  void evolve();
} else {
  const { w, seed } = workerData as { w: Weights; seed: number };
  loadNet(NET_B64);
  parentPort!.postMessage(judge(w, seed));
}
