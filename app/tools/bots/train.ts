/* ------------------------------------------------------------------ */
/* The machines train by playing themselves.                           */
/*                                                                     */
/* An evolution of the reading of the board, one weight vector at a    */
/* time: each generation mutates the incumbent into a handful of       */
/* challengers, each challenger plays a match against three incumbents */
/* in a worker of its own, and the best challenger that wins more than */
/* its share — and by a margin — becomes the incumbent. The winner is  */
/* written into src/game/weights.ts as TRAINED, and every generation   */
/* into tools/bots/training.log.                                       */
/*                                                                     */
/*   sh tools/bots/train.sh            (GENERATIONS, GAMES, STRENGTH,  */
/*                                      CHALLENGERS, SEED in the env)  */
/* ------------------------------------------------------------------ */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { DEFAULTS, TRAINED } from '@/game/weights';
import type { Weights } from '@/game/weights';
import { playMatch } from './arena';
import type { MatchResult } from './arena';

const GENERATIONS = Number(process.env.GENERATIONS ?? 12);
const GAMES = Number(process.env.GAMES ?? 32);
const CHALLENGERS = Number(process.env.CHALLENGERS ?? Math.max(2, Math.min(7, cpus().length - 1)));
const STRENGTH = Number(process.env.STRENGTH ?? 0.6);
const SEED = Number(process.env.SEED ?? 20260918);
const PLAYERS = 4;
/** how far a mutation moves a weight: a log-normal step */
const STEP = 0.25;
/** a challenger must win more than its share, and by this many points */
/** the screen is a screen, not a verdict: it lets through anything that
 *  read better than the incumbent on the same cards and leaves the deciding
 *  to the confirmation. A share of games won was asked for here too, and on
 *  thirty-two games it is a coarse enough statistic to have turned away a
 *  challenger six points to the good. */
/** The bar a challenger must clear, in points on the best rival, read on
 *  the same deals the incumbent played.
 *
 *  It used to be read on the raw margin, which no seat at a four-handed
 *  table ever posts above nought: a seat's points less the best of three
 *  rivals sits about twelve under by the shape of the statistic alone, so
 *  asking for one or better asked for a thirteen-point swing and no
 *  challenger in the whole of the log ever took over. Paired against the
 *  incumbent on the same cards the figure means what it says. */
const MARGIN = Number(process.env.MARGIN ?? 0);
/** how many spreads the winner must clear the bar by before its weights are
 *  written down. The screen looks at every challenger, so the best of seven
 *  is flattering on its own; the winner is played again on fresh deals and
 *  must hold up there. */
const BOUND = Number(process.env.BOUND ?? 1.645);
/** the games the winner of a screen is asked to survive before it is kept */
const CONFIRM = Number(process.env.CONFIRM ?? GAMES * 3);
/* run from app/: the bundle lives in tools/bots/dist, the sources do not */
const WEIGHTS_FILE = resolve('src/game/weights.ts');
const LOG_FILE = resolve('tools/bots/training.log');

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

/** a challenger: about half the weights nudged, each by a log-normal step */
function mutate(w: Weights, rand: () => number): Weights {
  const out = { ...w };
  for (const key of Object.keys(out) as (keyof Weights)[]) {
    if (rand() < 0.5) continue;
    const g = rand() + rand() + rand() - 1.5;
    out[key] = +(out[key] * Math.exp(STEP * g)).toFixed(4);
  }
  return out;
}

function writeWeights(w: Weights): void {
  const src = readFileSync(WEIGHTS_FILE, 'utf8');
  const body = (Object.keys(DEFAULTS) as (keyof Weights)[]).map((k) => `  ${k}: ${w[k]},`).join('\n');
  const next = src.replace(/export const TRAINED: Weights = [^;]*;/s, `export const TRAINED: Weights = {\n${body}\n};`);
  writeFileSync(WEIGHTS_FILE, next);
}

function runChallenger(challenger: Weights, incumbent: Weights, seed: number, games = GAMES): Promise<MatchResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { challenger, incumbent, seed, games } });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

async function train(): Promise<void> {
  let incumbent: Weights = { ...TRAINED };
  const rand = mulberry(SEED);
  const log = (line: string) => {
    console.log(line);
    appendFileSync(LOG_FILE, line + '\n');
  };
  log(`--- training ${new Date().toISOString()}: ${GENERATIONS} generations × ${CHALLENGERS} challengers × ${GAMES} games at strength ${STRENGTH}`);
  for (let g = 1; g <= GENERATIONS; g++) {
    const seed = SEED + g * 1000;
    const challengers = Array.from({ length: CHALLENGERS }, () => mutate(incumbent, rand));
    const started = Date.now();
    const results = await Promise.all(challengers.map((c) => runChallenger(c, incumbent, seed)));
    /* the screen: every challenger on the same deals as every other, read
       against what the incumbent made of those same deals on its own */
    let best = -1;
    results.forEach((r, k) => {
      const edge = r.edge ?? 0;
      const ok = edge > MARGIN;
      log(`gen ${g} challenger ${k + 1}: ${r.wins}/${r.games} wins, ${edge >= 0 ? '+' : ''}${edge.toFixed(2)} ± ${(r.edgeSpread ?? 0).toFixed(2)} on the same deals, canal ${r.canal.toFixed(1)} vs ${r.canalField.toFixed(1)}${ok ? ' ✓' : ''}`);
      if (ok && (best < 0 || edge > (results[best].edge ?? 0))) best = k;
    });
    if (best < 0) {
      log(`gen ${g}: nothing came through the screen, the incumbent holds`);
      log(`gen ${g} took ${Math.round((Date.now() - started) / 1000)} s`);
      continue;
    }
    /* the best of seven is flattering on its own, so it plays again on
       deals it has not seen and must clear the bar there too */
    const again = await runChallenger(challengers[best], incumbent, seed + 500000, CONFIRM);
    const edge = again.edge ?? 0;
    const spread = again.edgeSpread ?? 0;
    /* a spread read off two or three deals is not a spread: below eight the
       confirmation cannot tell anything and says so rather than guessing */
    const proved = again.pairs >= 8 && edge - BOUND * spread > MARGIN;
    log(`gen ${g}: challenger ${best + 1} again over ${again.pairs} fresh deals — ${edge >= 0 ? '+' : ''}${edge.toFixed(2)} ± ${spread.toFixed(2)}`);
    if (proved) {
      incumbent = challengers[best];
      writeWeights(incumbent);
      log(`gen ${g}: challenger ${best + 1} takes over — ${JSON.stringify(incumbent)}`);
    } else {
      log(`gen ${g}: it did not hold up, the incumbent holds`);
    }
    log(`gen ${g} took ${Math.round((Date.now() - started) / 1000)} s`);
  }
  log('--- done');
}

if (isMainThread) {
  void train();
} else {
  const { challenger, incumbent, seed, games } = workerData as { challenger: Weights; incumbent: Weights; seed: number; games: number };
  const result = playMatch({ games: games ?? GAMES, players: PLAYERS, seed, subject: challenger, field: incumbent, search: { strength: STRENGTH }, paired: true });
  parentPort!.postMessage(result);
}
