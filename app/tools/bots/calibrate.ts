/* ------------------------------------------------------------------ */
/* Calibrating the analysis's chance of winning.                       */
/*                                                                     */
/* The analysis turns the judge's lead into a chance with a logistic   */
/* whose width grows with the rounds still to play. Its two constants  */
/* were guesses. This plays tables of machines of uneven strength,     */
/* notes at every position each seat's lead and the rounds left, and   */
/* at the end who won — one row per seat and position. fit.mjs then    */
/* finds the width that makes "70 %" win seven times in ten.           */
/*                                                                     */
/*   GAMES=200 WORKERS=4 BUDGET=60 OUT=/tmp/calibrate.jsonl \          */
/*     sh tools/bots/calibrate.sh                                      */
/* ------------------------------------------------------------------ */

import { appendFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { applyAction, fallbackAction } from '@/game/actions';
import { edgeOf, roundsLeft } from '@/game/analysis';
import { newGame } from '@/game/engine';
import { chooseBotAction } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';

const GAMES = Number(process.env.GAMES ?? 200);
const BUDGET = Number(process.env.BUDGET ?? 60);
const OUT = process.env.OUT ?? 'tools/bots/data/calibrate.jsonl';
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, Math.min(GAMES, cpus().length - 2)));
/** seats at every table, or a mix of two to four when unset */
const SEATS = process.env.SEATS ? Number(process.env.SEATS) : null;

const COLORS = ['brass', 'oxblood', 'verdigris', 'indigo'] as const;
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

/** a small deterministic generator, so a seed names its table */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const setup = (n: number): SetupPayload =>
  ({
    players: Array.from({ length: n }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  }) as SetupPayload;

interface Row {
  edge: number;
  left: number;
  era: 'canal' | 'rail';
  won: 0 | 1;
  seats: number;
  seed: number;
}

function play(seed: number): Row[] {
  const r = rng(seed);
  const draw = r();
  const n = SEATS ?? (draw < 0.4 ? 2 : draw < 0.75 ? 3 : 4);
  /* uneven tables: each seat its own strength, so the positions run from
     even games to routs */
  const strengths = Array.from({ length: n }, () => 0.3 + 0.7 * r());
  let s: GameState = newGame(setup(n), seed);
  const seen: { edge: number[]; left: number; era: 'canal' | 'rail' }[] = [];
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const a = chooseBotAction(s, seat, { strength: strengths[seat], budgetMs: BUDGET }) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
    if (s.phase === 'action') seen.push({ edge: s.players.map((_, i) => edgeOf(s, i)), left: roundsLeft(s), era: s.era });
  }
  const top = Math.max(...s.players.map((p) => p.vp));
  const out: Row[] = [];
  for (const p of seen) p.edge.forEach((edge, i) => out.push({ edge: Math.round(edge * 10) / 10, left: p.left, era: p.era, won: s.players[i].vp >= top ? 1 : 0, seats: n, seed }));
  return out;
}

if (!isMainThread) {
  const { seeds } = workerData as { seeds: number[] };
  for (const seed of seeds) {
    const rows = play(seed);
    parentPort!.postMessage(rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  }
  parentPort!.postMessage(null);
} else {
  const seeds = Array.from({ length: GAMES }, (_, g) => 910000 + g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const started = Date.now();
  let games = 0;
  void Promise.all(
    slices.map(
      (x) =>
        new Promise<void>((ok, fail) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: x } });
          w.on('message', (chunk: string | null) => {
            if (chunk === null) return ok();
            appendFileSync(OUT, chunk);
            games += 1;
            if (games % 10 === 0) console.log(`${games}/${GAMES} games, ${Math.round((Date.now() - started) / 1000)}s`);
          });
          w.once('error', fail);
        }),
    ),
  ).then(() => console.log(`done: ${games} games in ${Math.round((Date.now() - started) / 1000)}s → ${OUT}`));
}
