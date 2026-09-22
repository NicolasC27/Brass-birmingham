/* ------------------------------------------------------------------ */
/* Weighing one change against another, with enough games to tell.     */
/*                                                                     */
/* A game's score swings by fifteen or twenty points on the deal, so a */
/* two-dozen-game cell cannot separate settings five points apart —    */
/* and five points is the size of everything worth arguing about here. */
/* This bench splits every cell over the cores and prints the spread   */
/* that chance alone accounts for, so a reading either clears it or is */
/* reported as undecided rather than dressed up as a finding.          */
/*                                                                     */
/*   TRIALS='name:weight=value,...;name:...' GAMES=96 SEATS=3,4 \      */
/*     sh tools/bots/trial.sh                                          */
/*                                                                     */
/* A trial names weights to override (stack=0.8) and search options    */
/* (planBeam=12, depth=2) and an opening (opening=goods-engine).       */
/* Everything unnamed is left                                          */
/* as it ships.                                                        */
/* ------------------------------------------------------------------ */

import { appendFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { INDUSTRIES } from '@/game/data';
import { loadNet, unpackBrain } from '@/game/net';
import { NET_B64 } from '@/game/net-weights';
import type { EvalMode, SearchOptions } from '@/game/search';
import { DEFAULTS, TRAINED } from '@/game/weights';
import type { Weights } from '@/game/weights';
import { playGame } from './arena';

const GAMES = Number(process.env.GAMES ?? 96);
const SEATS = (process.env.SEATS ?? '3,4').split(',').map(Number);
const BUDGET = Number(process.env.BUDGET ?? 1500);
const RIVAL = Number(process.env.RIVAL ?? 0);
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, cpus().length - 2));
const LOG_FILE = resolve('tools/bots/trial.log');

const SEARCH_KEYS = new Set(['planBeam', 'budgetMs', 'depth', 'guided', 'beam', 'strength']);
/** search options that name something rather than measure it */
const WORD_KEYS = new Set(['opening']);
/** how the subject reads the board: 'hand', 'net' or 'blend' */
const MODE_KEY = 'reads';

interface Trial {
  name: string;
  weights: Partial<Weights>;
  search: SearchOptions;
  /** how the subject reads the board; the blend of hand and net when absent */
  reads?: EvalMode;
  /** how many of the brain's networks are consulted; all of them when absent */
  brainNets?: number;
}

/** "the mat worth a lot:stack=0.8,planBeam=12" */
function parseTrials(text: string): Trial[] {
  return text.split(';').filter(Boolean).map((chunk) => {
    const [name, rest] = chunk.split(':');
    const t: Trial = { name: name.trim(), weights: {}, search: {} };
    for (const pair of (rest ?? '').split(',').filter(Boolean)) {
      const [k, v] = pair.split('=');
      const key = k.trim();
      if (key === MODE_KEY) {
        t.reads = v.trim() as EvalMode;
        continue;
      }
      if (key === 'brainNets') {
        t.brainNets = Number(v);
        continue;
      }
      if (WORD_KEYS.has(key)) {
        (t.search as Record<string, string>)[key] = v.trim();
        continue;
      }
      const value = Number(v);
      if (SEARCH_KEYS.has(key)) (t.search as Record<string, number>)[key] = value;
      else (t.weights as Record<string, number>)[key] = value;
    }
    return t;
  });
}

const TRIALS = parseTrials(process.env.TRIALS ?? 'as it stands:');

interface Slice {
  /** the seed of each game, so that two settings can be set side by side */
  seeds: number[];
  points: number[];
  wins: number;
  goods: Record<string, number>;
}

function run(trial: Trial, players: number, seeds: number[]): Slice {
  const whole = unpackBrain(NET_B64);
  const brain = trial.brainNets ? { nets: whole.nets.slice(0, trial.brainNets) } : whole;
  const subject: Weights = { ...TRAINED, rival: RIVAL, ...trial.weights };
  const field: Weights = { ...DEFAULTS };
  const search: SearchOptions = { strength: 1, budgetMs: BUDGET, depth: 2, ...trial.search };
  const reads: EvalMode = trial.reads ?? 'blend';
  const points: number[] = [];
  let wins = 0;
  const goods: Record<string, number> = {};
  for (const seed of seeds) {
    const seat = seed % players;
    const s = playGame(seed, players, seat, subject, field, search, [reads, 'hand'], [brain, null], { strength: 0.3 }, false);
    points.push(s.players[seat].vp);
    if (s.winner === seat) wins += 1;
    for (const t of Object.values(s.tiles)) {
      if (t.owner !== seat || !t.flipped) continue;
      if (INDUSTRIES[t.industry][t.level - 1].beerToSell > 0) goods[t.industry] = (goods[t.industry] ?? 0) + 1;
    }
  }
  return { seeds, points, wins, goods };
}

if (!isMainThread) {
  const { trial, players, seeds } = workerData as { trial: Trial; players: number; seeds: number[] };
  loadNet(NET_B64);
  parentPort!.postMessage(run(trial, players, seeds));
} else {
  const log = (line: string) => {
    console.log(line);
    try {
      appendFileSync(LOG_FILE, line + '\n');
    } catch {
      /* the log is a courtesy */
    }
  };
  const seeds = Array.from({ length: GAMES }, (_, g) => 800000 + g);
  const jobs: { trial: Trial; players: number; seeds: number[] }[] = [];
  const perCell = Math.max(1, Math.floor(WORKERS / (TRIALS.length * SEATS.length)));
  for (const trial of TRIALS) {
    for (const players of SEATS) {
      const slices = Array.from({ length: perCell }, (_, w) => seeds.filter((_, k) => k % perCell === w)).filter((x) => x.length);
      for (const s of slices) jobs.push({ trial, players, seeds: s });
    }
  }
  const started = Date.now();
  log(`--- trial ${new Date().toISOString()}: ${GAMES} games a cell, seats ${SEATS.join(' and ')}, thinking ${BUDGET} ms, rival ${RIVAL}, ${jobs.length} workers`);
  void Promise.all(
    jobs.map(
      (j) =>
        new Promise<Slice>((ok, fail) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: j });
          w.once('message', ok);
          w.once('error', fail);
        }),
    ),
  ).then((slices) => {
    log('  seats  setting                     points   won      against the first        goods flipped');
    /* every setting played the same games, so the honest comparison is game
       by game: the deal's luck falls on both and cancels, which sees a gain
       half the size of what the raw averages could ever separate */
    const byGame = new Map<string, Map<number, number>>();
    for (const trial of TRIALS) {
      for (const players of SEATS) {
        const mine = slices.filter((_, k) => jobs[k].trial === trial && jobs[k].players === players);
        const m = new Map<number, number>();
        for (const s of mine) s.seeds.forEach((seed, k) => m.set(seed, s.points[k]));
        byGame.set(`${trial.name}|${players}`, m);
      }
    }
    for (const trial of TRIALS) {
      for (const players of SEATS) {
        const mine = slices.filter((_, k) => jobs[k].trial === trial && jobs[k].players === players);
        const pts = mine.flatMap((s) => s.points);
        const wins = mine.reduce((a, s) => a + s.wins, 0);
        const goods: Record<string, number> = {};
        for (const s of mine) for (const [k, v] of Object.entries(s.goods)) goods[k] = (goods[k] ?? 0) + v;
        const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
        let verdict = '';
        if (trial !== TRIALS[0]) {
          const here = byGame.get(`${trial.name}|${players}`)!;
          const there = byGame.get(`${TRIALS[0].name}|${players}`)!;
          const diffs: number[] = [];
          for (const [seed, v] of here) if (there.has(seed)) diffs.push(v - there.get(seed)!);
          const gap = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
          const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - gap) ** 2, 0) / Math.max(1, diffs.length - 1));
          const err = 2 * (sd / Math.sqrt(Math.max(1, diffs.length)));
          verdict = `${gap >= 0 ? '+' : ''}${gap.toFixed(1)} ± ${err.toFixed(1)} ${Math.abs(gap) > err ? 'real   ' : 'undecided'}`;
        }
        const g = Object.entries(goods).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / pts.length).toFixed(1)}`).join(', ') || 'none';
        log(`  ${players}      ${trial.name.padEnd(26)} ${mean.toFixed(1).padStart(6)}   ${String(wins + '/' + pts.length).padEnd(7)}  ${verdict.padEnd(22)}   ${g}`);
      }
    }
    log(`  ${Math.round((Date.now() - started) / 1000)} s`);
  });
}
