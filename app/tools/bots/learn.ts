/* ------------------------------------------------------------------ */
/* The machines learn by playing each other.                           */
/*                                                                     */
/*   play  — every core plays games of four machines; every position   */
/*           of every seat is written down with how far ahead that     */
/*           seat ended when the era was scored                        */
/*   fit   — a network is trained on everything written down so far    */
/*           and packed into src/game/net-weights.ts                   */
/*   check — the network's reading plays the hand-written one          */
/*   loop  — play, fit, check, and again                               */
/*                                                                     */
/*   sh tools/bots/learn.sh loop     (GAMES, ITERATIONS, EPOCHS,       */
/*                                    STRENGTH, PLAY_BUDGET,           */
/*                                    PLAY_DEPTH, WORKERS in the env)  */
/*                                                                     */
/* The target is the Canal Era's points while the canals are open —   */
/* own score less the best rival's when the era is scored — and the   */
/* game's points once the rails are laid.                              */
/* ------------------------------------------------------------------ */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { applyAction, fallbackAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { FEATURES, GLOBAL_ERA, features, forward, loadNet, packBrain, unpackBrain } from '@/game/net';
import { NET_B64 } from '@/game/net-weights';
import type { Brain, Net } from '@/game/net';
import { chooseBotAction, setEvalMode, setWeights } from '@/game/search';
import { OPENINGS } from '@/game/openings';
import type { Opening } from '@/game/openings';
import type { GameState, SetupPayload } from '@/game/types';
import { TRAINED } from '@/game/weights';
import type { Weights } from '@/game/weights';
import { playMatch } from './arena';

const GAMES = Number(process.env.GAMES ?? 200);
const ITERATIONS = Number(process.env.ITERATIONS ?? 3);
const EPOCHS = Number(process.env.EPOCHS ?? 30);
const STRENGTH = Number(process.env.STRENGTH ?? 0.6);
/** how long the machines think while filling the record. Naming it matters:
 *  left unsaid the search caps itself at 300 ms, and every position the
 *  network has ever learned from was reached by a player five times weaker
 *  than the one the app ships. A network cannot outgrow its teacher. */
const PLAY_BUDGET = Number(process.env.PLAY_BUDGET ?? 300);
/** rounds the machines look past their turn while filling the record */
const PLAY_DEPTH = Number(process.env.PLAY_DEPTH ?? 0) as 0 | 1 | 2;
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, cpus().length - 1));
const CHECK_GAMES = Number(process.env.CHECK_GAMES ?? 48);
/** how long the expert thinks on the yardstick: what the app gives it */
const YARDSTICK_BUDGET = Number(process.env.YARDSTICK_BUDGET ?? 1500);
/** the check is split over this many workers */
const CHECK_WORKERS = 8;
/** the fit reads at most this many of the latest positions */
const FIT_ROWS = Number(process.env.FIT_ROWS ?? 800000);
/** how much of the field plays a style of its own while games are written down */
const EXPLORE = Number(process.env.EXPLORE ?? 0.5);
const HIDDEN = (process.env.HIDDEN ?? '128,64').split(',').map(Number);
/** how many networks make a brain */
const NETS = Number(process.env.NETS ?? 3);
/** the target leans on the last brain's reading this many of the seat's positions later, by this much */
const TD_STEPS = 8;
const TD_WEIGHT = Number(process.env.TD ?? 0.5);
/** weight decay, and how many epochs without a better held-out error before stopping */
const DECAY = 1e-4;
const PATIENCE = 6;
const POINTS = 30;
const DATA_DIR = resolve('tools/bots/data');
const NET_FILE = resolve('src/game/net-weights.ts');
const LOG_FILE = resolve('tools/bots/learning.log');
/** what the network learns to read: the Canal Era's points, the game's, or a mix of both */
const TARGET = (process.env.TARGET ?? 'canal') as 'canal' | 'game' | 'mix';
const MIX = Number(process.env.MIX ?? 0.5);
/** a sample: the features, the canal-era lead and the game's lead (points / POINTS),
 *  the seats at the table and how many later positions of this seat follow in the era */
const ROW = FEATURES + 4;

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

const log = (line: string) => {
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
};

/* =============================== play ============================== */

/** a style: the reading nudged at random, so that the games written down
 *  show what different appetites lead to — loans, developments, links,
 *  cash, and how much a rival's standing weighs */
function style(seed: number): Weights {
  const rand = mulberry(seed);
  const w: Weights = { ...TRAINED };
  const nudge = (k: keyof Weights, lo: number, hi: number) => {
    w[k] = +(lo + (hi - lo) * rand()).toFixed(3);
  };
  nudge('earlyLoan', 0, 16);
  nudge('stack', 0.02, 0.6);
  nudge('linkIcons', 0.1, 0.8);
  nudge('cashSlope', 0.2, 0.7);
  nudge('rival', 0.3, 1);
  nudge('incomeOnFlip', 0.4, 1.4);
  nudge('goodsServed', 0.5, 0.9);
  nudge('developed', 0, 6);
  nudge('tempo', 0, 3);
  nudge('weakLink', 0, 4);
  nudge('railReady', 0, 6);
  return w;
}

/** the openings strong players swear by, imposed on a styled seat while
 *  they last, so that the record shows where they lead */
const EXPLORE_OPENINGS: (Opening | null)[] = [...OPENINGS, null];

/** one game of four machines, every position of every seat written down;
 *  some seats play a style of their own, so the record shows more than one way */
function playOne(seed: number, players: number): { rows: Float32Array; canal: number } {
  const styles = Array.from({ length: players }, (_, k) => (mulberry(seed * 7 + k)() < EXPLORE ? style(seed * 13 + k) : TRAINED));
  const openings: (Opening | null)[] = Array.from({ length: players }, (_, k) => (styles[k] === TRAINED ? null : EXPLORE_OPENINGS[Math.floor(mulberry(seed * 17 + k)() * EXPLORE_OPENINGS.length)]));
  const setup: SetupPayload = {
    players: Array.from({ length: players }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
  let s: GameState = newGame(setup, seed);
  /* the whole game: the Canal Era's positions and the rails' */
  const canal: { x: Float32Array; seat: number }[] = [];
  const rail: { x: Float32Array; seat: number }[] = [];
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    for (let j = 0; j < players; j++) (s.era === 'canal' ? canal : rail).push({ x: features(s, j), seat: j });
    const seat = s.current;
    setWeights(styles[seat]);
    const a = chooseBotAction(s, seat, { strength: STRENGTH, depth: PLAY_DEPTH, budgetMs: PLAY_BUDGET, opening: openings[seat] ?? undefined }) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  const lead = (scores: number[], j: number) => scores[j] - Math.max(...scores.filter((_, k) => k !== j));
  const canalScores = s.canalScores ?? s.players.map(() => 0);
  const finalScores = s.players.map((p) => p.vp);
  const out = new Float32Array((canal.length + rail.length) * ROW);
  let at = 0;
  for (const block of [canal, rail]) {
    const perSeat = block.length / players;
    for (const [k, { x, seat }] of block.entries()) {
      out.set(x, at);
      out[at + FEATURES] = lead(canalScores, seat) / POINTS;
      out[at + FEATURES + 1] = lead(finalScores, seat) / POINTS;
      out[at + FEATURES + 2] = players;
      out[at + FEATURES + 3] = perSeat - 1 - Math.floor(k / players);
      at += ROW;
    }
  }
  return { rows: out, canal: canalScores.reduce((a, b) => a + b, 0) / players };
}

/** the network the machines play with: the last one fitted, else the one shipped */
let netText: string | null = NET_B64;

/** the tables the machines train at: half of four, a quarter each of three and two */
const tableOf = (seed: number): number => [4, 4, 3, 2][seed % 4];

function runWorker(seeds: number[]): Promise<{ buffer: ArrayBuffer; canal: number }> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds, net: netText } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
}

async function play(tag: string): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const seeds = Array.from({ length: GAMES }, (_, g) => 100000 + Number(tag) * 10000 + g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const started = Date.now();
  const results = await Promise.all(slices.map((x) => runWorker(x)));
  const total = results.reduce((a, r) => a + r.buffer.byteLength, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const r of results) {
    all.set(new Uint8Array(r.buffer), at);
    at += r.buffer.byteLength;
  }
  const file = resolve(DATA_DIR, `positions-${tag}.f32`);
  writeFileSync(file, all);
  const rows = total / 4 / ROW;
  const canal = results.reduce((a, r) => a + r.canal, 0) / results.length;
  log(`play ${tag}: ${GAMES} games, ${rows} positions, mean canal-era points ${canal.toFixed(1)}, ${Math.round((Date.now() - started) / 1000)} s`);
}

/* ================================ fit ============================== */

/** the latest positions written down, newest files first, up to FIT_ROWS */
function loadSamples(): Float32Array {
  if (!existsSync(DATA_DIR)) return new Float32Array(0);
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('positions-') && f.endsWith('.f32'))
    .map((f) => ({ f, at: statSync(resolve(DATA_DIR, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .map((x) => x.f);
  const parts: Float32Array[] = [];
  let rows = 0;
  for (const f of files) {
    if (rows >= FIT_ROWS) break;
    const bytes = readFileSync(resolve(DATA_DIR, f));
    const p = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
    parts.push(p);
    rows += p.length / ROW;
  }
  const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

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

/** a dense network trained by Adam on squared error; the target is the
 *  era's outcome, leaned toward what `previous` read a few positions later */
function fit(data: Float32Array, seed: number, previous: Brain | null): Net {
  const n = Math.floor(data.length / ROW);
  if (n < 100) throw new Error(`only ${n} positions written down: play first`);
  const rand = mulberry(seed);
  /* the last brain's reading of each position, for the TD target */
  const boot = new Float32Array(n);
  if (previous) {
    const x = new Float32Array(FEATURES);
    for (let r = 0; r < n; r++) {
      x.set(data.subarray(r * ROW, r * ROW + FEATURES));
      let sum = 0;
      for (const net of previous.nets) sum += forward(net, x);
      boot[r] = sum / previous.nets.length / POINTS;
    }
  }
  /* the target of each row: in the Canal Era the era's lead, the game's lead, or a mix;
     once the rails are laid the two are the same number */
  const outcome = (r: number): number => {
    const canal = data[r * ROW + FEATURES];
    const game = data[r * ROW + FEATURES + 1];
    const inCanal = data[r * ROW + FEATURES - GLOBAL_ERA] === 0;
    if (!inCanal) return game;
    if (TARGET === 'canal') return canal;
    if (TARGET === 'game') return game;
    return MIX * canal + (1 - MIX) * game;
  };
  const target = (r: number): number => {
    const z = outcome(r);
    if (!previous) return z;
    const players = data[r * ROW + FEATURES + 2];
    const ahead = data[r * ROW + FEATURES + 3];
    if (ahead < TD_STEPS) return z;
    return (1 - TD_WEIGHT) * z + TD_WEIGHT * boot[r + players * TD_STEPS];
  };
  /* normalisation */
  const mean = new Float32Array(FEATURES);
  const scale = new Float32Array(FEATURES);
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) mean[k] += data[r * ROW + k] / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) scale[k] += ((data[r * ROW + k] - mean[k]) ** 2) / n;
  for (let k = 0; k < FEATURES; k++) scale[k] = Math.max(1e-3, Math.sqrt(scale[k]));
  /* a tenth of the positions is held out, in slices spread over the whole
     record so that every table and every style is in both parts */
  const SLICE = Math.max(100, Math.floor(n / 40));
  const heldOut = (r: number): boolean => Math.floor(r / SLICE) % 10 === 9;
  const learn: number[] = [];
  const held: number[] = [];
  for (let r = 0; r < n; r++) (heldOut(r) ? held : learn).push(r);
  const cut = learn.length;
  const sizes = [FEATURES, ...HIDDEN, 1];
  const W: Float32Array[] = [];
  const B: Float32Array[] = [];
  for (let l = 0; l + 1 < sizes.length; l++) {
    const w = new Float32Array(sizes[l] * sizes[l + 1]);
    const lim = Math.sqrt(6 / (sizes[l] + sizes[l + 1]));
    for (let k = 0; k < w.length; k++) w[k] = (rand() * 2 - 1) * lim;
    W.push(w);
    B.push(new Float32Array(sizes[l + 1]));
  }
  const mW = W.map((w) => new Float32Array(w.length));
  const vW = W.map((w) => new Float32Array(w.length));
  const mB = B.map((b) => new Float32Array(b.length));
  const vB = B.map((b) => new Float32Array(b.length));
  const acts: Float32Array[] = sizes.map((z) => new Float32Array(z));
  const grads: Float32Array[] = sizes.map((z) => new Float32Array(z));
  const gW = W.map((w) => new Float32Array(w.length));
  const gB = B.map((b) => new Float32Array(b.length));
  const BATCH = 512;
  const LR = 5e-4;
  const B1 = 0.9;
  const B2 = 0.999;
  let step = 0;
  const x = new Float32Array(FEATURES);
  const forwardTo = (r: number): number => {
    for (let k = 0; k < FEATURES; k++) x[k] = (data[r * ROW + k] - mean[k]) / scale[k];
    acts[0].set(x);
    for (let l = 0; l < W.length; l++) {
      const nIn = sizes[l];
      const nOut = sizes[l + 1];
      const last = l === W.length - 1;
      for (let o = 0; o < nOut; o++) {
        let sum = B[l][o];
        const row = o * nIn;
        for (let k = 0; k < nIn; k++) sum += W[l][row + k] * acts[l][k];
        acts[l + 1][o] = last ? sum : Math.tanh(sum);
      }
    }
    return acts[W.length][0];
  };
  const rmse = (rows: number[]): number => {
    let se = 0;
    for (const r of rows) {
      const d = forwardTo(r) - target(r);
      se += d * d;
    }
    return Math.sqrt(se / Math.max(1, rows.length)) * POINTS;
  };
  let base = 0;
  for (const r of held) base += (target(r) * POINTS) ** 2;
  log(`fit (${TARGET}): ${n} positions, ${cut} to learn from, ${held.length} held out; guessing zero misses by ${Math.sqrt(base / Math.max(1, held.length)).toFixed(2)} points`);
  const order = [...learn];
  const sample = learn.filter((_, k) => k % 5 === 0).slice(0, 20000);
  /* the network of the epoch that read the held-out positions best */
  let bestHeld = Infinity;
  let bestEpoch = 0;
  let keptW = W.map((w) => Float32Array.from(w));
  let keptB = B.map((b) => Float32Array.from(b));
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    for (let b = 0; b < cut; b += BATCH) {
      for (const g of gW) g.fill(0);
      for (const g of gB) g.fill(0);
      const rows = Math.min(BATCH, cut - b);
      for (let q = 0; q < rows; q++) {
        const r = order[b + q];
        const y = forwardTo(r);
        grads[W.length][0] = (2 * (y - target(r))) / rows;
        for (let l = W.length - 1; l >= 0; l--) {
          const nIn = sizes[l];
          const nOut = sizes[l + 1];
          grads[l].fill(0);
          for (let o = 0; o < nOut; o++) {
            const d = grads[l + 1][o];
            if (d === 0) continue;
            gB[l][o] += d;
            const row = o * nIn;
            for (let k = 0; k < nIn; k++) {
              gW[l][row + k] += d * acts[l][k];
              grads[l][k] += d * W[l][row + k];
            }
          }
          if (l > 0) for (let k = 0; k < nIn; k++) grads[l][k] *= 1 - acts[l][k] * acts[l][k];
        }
      }
      step += 1;
      const c1 = 1 - Math.pow(B1, step);
      const c2 = 1 - Math.pow(B2, step);
      for (let l = 0; l < W.length; l++) {
        const adam = (p: Float32Array, g: Float32Array, m: Float32Array, v: Float32Array, decay: boolean) => {
          for (let k = 0; k < p.length; k++) {
            m[k] = B1 * m[k] + (1 - B1) * g[k];
            v[k] = B2 * v[k] + (1 - B2) * g[k] * g[k];
            p[k] -= (LR * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + 1e-8) + (decay ? LR * DECAY * p[k] : 0);
          }
        };
        adam(W[l], gW[l], mW[l], vW[l], true);
        adam(B[l], gB[l], mB[l], vB[l], false);
      }
    }
    const heldNow = rmse(held);
    if (heldNow < bestHeld) {
      bestHeld = heldNow;
      bestEpoch = epoch;
      keptW = W.map((w) => Float32Array.from(w));
      keptB = B.map((b) => Float32Array.from(b));
    }
    if (epoch === 1 || epoch % 5 === 0 || epoch === EPOCHS || epoch - bestEpoch >= PATIENCE) log(`fit: epoch ${epoch}, misses by ${rmse(sample).toFixed(2)} points learning, ${heldNow.toFixed(2)} held out`);
    if (epoch - bestEpoch >= PATIENCE) {
      log(`fit: no better reading of the held-out positions for ${PATIENCE} epochs — keeping epoch ${bestEpoch} (${bestHeld.toFixed(2)})`);
      break;
    }
  }
  return { sizes, weights: keptW, biases: keptB, mean, scale, points: POINTS };
}

/** a brain of NETS networks, each from its own start, on the same positions */
function fitBrain(): Brain {
  const data = loadSamples();
  const previous = netText ? unpackBrain(netText) : null;
  const nets: Net[] = [];
  for (let k = 0; k < NETS; k++) {
    log(`fit: network ${k + 1} of ${NETS}`);
    nets.push(fit(data, 7 + 4 * k, previous));
  }
  return { nets };
}

function writeNet(brain: Brain): string {
  const packed = packBrain(brain);
  const lines = packed.match(/.{1,120}/g) ?? [];
  const body = lines.map((l) => `  '${l}',`).join('\n');
  writeFileSync(
    NET_FILE,
    `/* written by tools/bots/learn.ts — the network the machines last learned; null until one has been */\nexport const NET_B64: string | null = [\n${body}\n].join('');\n`,
  );
  log(`fit: brain written, ${brain.nets.length} × ${brain.nets[0].sizes.join('×')}, ${Math.round(packed.length / 1024)} KB`);
  return packed;
}

/** the packed network back into net-weights.ts as it was */
function restoreNet(packed: string | null): void {
  if (packed) {
    const lines = packed.match(/.{1,120}/g) ?? [];
    writeFileSync(NET_FILE, `/* written by tools/bots/learn.ts — the network the machines last learned; null until one has been */\nexport const NET_B64: string | null = [\n${lines.map((l) => `  '${l}',`).join('\n')}\n].join('');\n`);
  } else writeFileSync(NET_FILE, `/* written by tools/bots/learn.ts — the network the machines last learned; null until one has been */\nexport const NET_B64: string | null = null;\n`);
}

/* =============================== check ============================= */

/** the new reading against the one it would replace — the last network, or
 *  the hand-written reading when there is none — everyone at the same
 *  strength; the newcomer stays only if it wins more than its share */
async function check(tag: string, fresh: string, previous: string | null): Promise<boolean> {
  type Slice = { wins: number; games: number; diff: number; canal: number; canalField: number };
  const per = Math.max(1, Math.round(CHECK_GAMES / CHECK_WORKERS));
  const slices = await Promise.all(
    Array.from({ length: CHECK_WORKERS }, (_, k) =>
      new Promise<Slice>((ok, fail) => {
        const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { check: true, games: per, seed: 900000 + Number(tag) * 100 + k * per, net: fresh, previous } });
        worker.once('message', ok);
        worker.once('error', fail);
      }),
    ),
  );
  const games = slices.reduce((a, s) => a + s.games, 0);
  const result: Slice = {
    games,
    wins: slices.reduce((a, s) => a + s.wins, 0),
    diff: slices.reduce((a, s) => a + s.diff * s.games, 0) / games,
    canal: slices.reduce((a, s) => a + s.canal * s.games, 0) / games,
    canalField: slices.reduce((a, s) => a + s.canalField * s.games, 0) / games,
  };
  /* the Canal Era first: more points there, without losing the game for it */
  /* the whole game is the contest: more than its share of wins, no points lost on the best rival, and no Canal Era given away */
  const share = result.wins / result.games;
  const keep = (share >= 0.33 || (share >= 0.29 && result.diff >= 0)) && result.canal >= result.canalField - 3;
  log(`check ${tag}: the new network wins ${result.wins}/${result.games} (par ${(result.games / 4).toFixed(0)}) against ${previous ? 'the last one' : 'the hand-written reading'}, ${result.diff.toFixed(1)} points on the best rival, canal ${result.canal.toFixed(1)} vs ${result.canalField.toFixed(1)}${keep ? ' — kept' : ' — the last one stays'}`);
  /* the yardsticks report on their own time: the next games need not wait */
  if (keep) void yardstick(tag, fresh);
  return keep;
}

/** the expert at full strength against a weak table, two and four seats:
 *  the Canal Era points a player will actually see it make */
async function yardstick(tag: string, net: string): Promise<void> {
  await Promise.all(
    [2, 3, 4].map(async (players) => {
      const r = await new Promise<{ canal: number; canalField: number; wins: number; games: number; vp: number }>((ok, fail) => {
        const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { yardstick: true, players, seed: 700000 + Number(tag) * 10, net } });
        worker.once('message', ok);
        worker.once('error', fail);
      });
      log(`yardstick ${tag}: the expert at ${players} against a weak table — ${r.canal.toFixed(1)} Canal Era points (rivals ${r.canalField.toFixed(1)}), ${r.vp.toFixed(0)} final, ${r.wins}/${r.games} games won`);
    }),
  );
}

/* =============================== main ============================== */

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'loop';
  const tag = (k: number) => String(Date.now() % 100000 + k);
  if (mode === 'play') await play(tag(0));
  else if (mode === 'fit') netText = writeNet(fitBrain());
  else if (mode === 'check') await check(tag(0), netText ?? '', null);
  else {
    for (let k = 1; k <= ITERATIONS; k++) {
      log(`--- iteration ${k} of ${ITERATIONS}`);
      await play(tag(k));
      const fresh = writeNet(fitBrain());
      if (await check(tag(k), fresh, netText)) netText = fresh;
      else restoreNet(netText);
    }
  }
  log('--- done');
}

if (isMainThread) {
  void main();
} else if ((workerData as { yardstick?: boolean }).yardstick) {
  const { players, seed, net } = workerData as { players: number; seed: number; net: string };
  loadNet(net);
  const weak: Weights = { ...TRAINED };
  /* the expert as it ships, which names its own thinking time, against a
     table left at the dial's own pace — the yardstick used to let the
     search cap the expert to 300 ms and so measured a bot nobody plays */
  const r = playMatch({
    games: 6,
    players,
    seed,
    subject: TRAINED,
    field: weak,
    search: { strength: 1, budgetMs: YARDSTICK_BUDGET },
    subjectMode: 'blend',
    fieldMode: 'hand',
    subjectNet: net,
    fieldNet: null,
    fieldSearch: { strength: 0.3 },
  });
  parentPort!.postMessage(r);
} else if ((workerData as { check?: boolean }).check) {
  const { seed, net, previous, games } = workerData as { seed: number; net: string; previous: string | null; games: number };
  loadNet(net);
  const r = playMatch({ games, players: 4, seed, subject: TRAINED, field: TRAINED, search: { strength: STRENGTH, depth: 0 }, subjectMode: 'blend', fieldMode: previous ? 'blend' : 'hand', subjectNet: net, fieldNet: previous });
  parentPort!.postMessage(r);
} else {
  const { seeds, net } = workerData as { seeds: number[]; net: string | null };
  /* the machines play with what they know so far: the last network, if any */
  loadNet(net);
  setEvalMode('blend');
  const parts = seeds.map((seed) => playOne(seed, tableOf(seed)));
  const total = parts.reduce((a, p) => a + p.rows.length, 0);
  const all = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    all.set(p.rows, at);
    at += p.rows.length;
  }
  const canal = parts.reduce((a, p) => a + p.canal, 0) / Math.max(1, parts.length);
  parentPort!.postMessage({ buffer: all.buffer, canal }, [all.buffer]);
}
