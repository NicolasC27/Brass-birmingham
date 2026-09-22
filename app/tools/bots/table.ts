/* ------------------------------------------------------------------ */
/* The yardstick that matches the goal.                                */
/*                                                                     */
/* The old yardstick sat the expert at a table of weak machines and    */
/* read its score. That number confounds two things: how well the bot  */
/* plays, and how badly the others do. It climbs when the opposition   */
/* falls apart, which is not progress.                                 */
/*                                                                     */
/* This one seats four of the same reading at one table and reports    */
/* every score. Nothing is handed to anybody: the slots, the coal, the */
/* merchants and the beer are contested by equals, so the numbers say  */
/* only how well the game is played. It is not a zero-sum split —      */
/* a table that plays better flips more tiles and higher ones, so the  */
/* whole table's total rises with its skill.                           */
/*                                                                     */
/*   sh tools/bots/table.sh      (GAMES, PLAYERS, BUDGET, DEPTH,       */
/*                                PLAN_BEAM, WORKERS in the env)       */
/* ------------------------------------------------------------------ */

import { appendFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { applyAction, fallbackAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { loadNet } from '@/game/net';
import { NET_B64 } from '@/game/net-weights';
import { chooseBotAction, setEvalMode, setWeights } from '@/game/search';
import { TRAINED } from '@/game/weights';
import type { GameState, SetupPayload } from '@/game/types';

const GAMES = Number(process.env.GAMES ?? 24);
const PLAYERS = Number(process.env.PLAYERS ?? 4);
const BUDGET = Number(process.env.BUDGET ?? 1500);
const DEPTH = Number(process.env.DEPTH ?? 2) as 0 | 1 | 2;
const PLAN_BEAM = Number(process.env.PLAN_BEAM ?? 0);
/** how much the strongest rival's worth counts against one's own. The bench
 *  in trial.ts reads the board with this at zero while this yardstick has
 *  always read it at one, so the two were never measuring the same goal */
const RIVAL = process.env.RIVAL === undefined ? null : Number(process.env.RIVAL);
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, Math.min(GAMES, cpus().length - 2)));
const LOG_FILE = resolve('tools/bots/table.log');

const COLORS = ['red', 'yellow', 'purple', 'teal'] as const;
/* the four the engine knows; 'bright', 'owen' and 'peel' were never personas,
   and naming the expert first would have exempted seat zero from the dial and,
   at three seats, handed it an opening book the others do not follow */
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

const setup = (n: number): SetupPayload =>
  ({
    players: Array.from({ length: n }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  }) as SetupPayload;

function play(seed: number): number[] {
  let s: GameState = newGame(setup(PLAYERS), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const a = chooseBotAction(s, seat, { strength: 1, budgetMs: BUDGET, depth: DEPTH, planBeam: PLAN_BEAM }) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s.players.map((p) => p.vp);
}

if (!isMainThread) {
  const { seeds } = workerData as { seeds: number[] };
  loadNet(NET_B64);
  setEvalMode('blend');
  if (RIVAL !== null) setWeights({ ...TRAINED, rival: RIVAL });
  parentPort!.postMessage(seeds.map(play));
} else {
  const log = (line: string) => {
    console.log(line);
    try {
      appendFileSync(LOG_FILE, line + '\n');
    } catch {
      /* the log is a courtesy */
    }
  };
  const seeds = Array.from({ length: GAMES }, (_, g) => 760000 + g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const started = Date.now();
  void Promise.all(
    slices.map(
      (x) =>
        new Promise<number[][]>((ok, fail) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: x } });
          w.once('message', ok);
          w.once('error', fail);
        }),
    ),
  ).then((parts) => {
    const games = parts.flat();
    const all = games.flat();
    const ranked = games.map((g) => [...g].sort((a, b) => b - a));
    const at = (k: number) => ranked.reduce((a, g) => a + g[k], 0) / ranked.length;
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    /* how far the winner's average could be off by chance alone */
    const spread = Math.sqrt(ranked.reduce((a, g) => a + (g[0] - at(0)) ** 2, 0) / Math.max(1, ranked.length - 1)) / Math.sqrt(ranked.length);
    const seatsOver = (n: number) => ((all.filter((x) => x >= n).length / all.length) * 100).toFixed(0);
    const tablesOver = (n: number) => ((games.filter((g) => g.every((x) => x >= n)).length / games.length) * 100).toFixed(0);
    log(`--- table ${new Date().toISOString()}: ${games.length} games, ${PLAYERS} of one reading, thinking ${BUDGET} ms, depth ${DEPTH}${PLAN_BEAM ? `, planning ${PLAN_BEAM}` : ''}, rival ${RIVAL === null ? TRAINED.rival : RIVAL}`);
    log(`  winner        ${at(0).toFixed(1)} ± ${(2 * spread).toFixed(1)}`);
    const place = ['', 'second', 'third', 'last'];
    for (let k = 1; k < PLAYERS; k++) log(`  ${(k === PLAYERS - 1 ? 'last' : place[k]).padEnd(12)}  ${at(k).toFixed(1)}`);
    log(`  table mean    ${mean.toFixed(1)}, table total ${(mean * PLAYERS).toFixed(0)}`);
    log(`  lowest ${Math.min(...all)}, highest ${Math.max(...all)}`);
    log(`  seats at 120+ ${seatsOver(120)}%, 140+ ${seatsOver(140)}%, 160+ ${seatsOver(160)}%`);
    log(`  whole tables at 120+ ${tablesOver(120)}%, 140+ ${tablesOver(140)}%`);
    log(`  ${Math.round((Date.now() - started) / 1000)} s`);
  });
}
