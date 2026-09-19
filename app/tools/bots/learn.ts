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
/*                                    STRENGTH, WORKERS in the env)    */
/*                                                                     */
/* The target is the Canal Era's points while the canals are open —   */
/* own score less the best rival's when the era is scored — and the   */
/* game's points once the rails are laid.                              */
/* ------------------------------------------------------------------ */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { applyAction, fallbackAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { FEATURES, GLOBAL_ERA, features, loadNet, pack } from '@/game/net';
import { NET_B64 } from '@/game/net-weights';
import type { Net } from '@/game/net';
import { chooseBotAction, setEvalMode } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';
import { TRAINED } from '@/game/weights';
import { playMatch } from './arena';

const GAMES = Number(process.env.GAMES ?? 200);
const ITERATIONS = Number(process.env.ITERATIONS ?? 3);
const EPOCHS = Number(process.env.EPOCHS ?? 30);
const STRENGTH = Number(process.env.STRENGTH ?? 0.6);
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, cpus().length - 1));
const CHECK_GAMES = Number(process.env.CHECK_GAMES ?? 24);
const HIDDEN = [64, 32];
/** weight decay, and how many epochs without a better held-out error before stopping */
const DECAY = 1e-4;
const PATIENCE = 5;
const POINTS = 30;
const DATA_DIR = resolve('tools/bots/data');
const NET_FILE = resolve('src/game/net-weights.ts');
const LOG_FILE = resolve('tools/bots/learning.log');
/** what the network learns to read: the Canal Era's points, the game's, or a mix of both */
const TARGET = (process.env.TARGET ?? 'canal') as 'canal' | 'game' | 'mix';
const MIX = Number(process.env.MIX ?? 0.5);
/** a sample: the features, then the canal-era lead and the game's lead (points / POINTS) */
const ROW = FEATURES + 2;

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
const PERSONAS = ['boulton', 'wedgwood', 'arkwright', 'watt'] as const;

const log = (line: string) => {
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
};

/* =============================== play ============================== */

/** one game of four machines, every position of every seat written down */
function playOne(seed: number, players: number): { rows: Float32Array; canal: number } {
  const setup: SetupPayload = {
    players: Array.from({ length: players }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
  let s: GameState = newGame(setup, seed);
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
    const a = chooseBotAction(s, seat, { strength: STRENGTH, depth: 0 }) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  const lead = (scores: number[], j: number) => scores[j] - Math.max(...scores.filter((_, k) => k !== j));
  const canalScores = s.canalScores ?? s.players.map(() => 0);
  const finalScores = s.players.map((p) => p.vp);
  const out = new Float32Array((canal.length + rail.length) * ROW);
  let at = 0;
  for (const { x, seat } of [...canal, ...rail]) {
    out.set(x, at);
    out[at + FEATURES] = lead(canalScores, seat) / POINTS;
    out[at + FEATURES + 1] = lead(finalScores, seat) / POINTS;
    at += ROW;
  }
  return { rows: out, canal: canalScores.reduce((a, b) => a + b, 0) / players };
}

/** the network the machines play with: the last one fitted, else the one shipped */
let netText: string | null = NET_B64;

function runWorker(seeds: number[], players: number): Promise<{ buffer: ArrayBuffer; canal: number }> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds, players, net: netText } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
}

async function play(tag: string): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const seeds = Array.from({ length: GAMES }, (_, g) => 100000 + Number(tag) * 10000 + g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const started = Date.now();
  const results = await Promise.all(slices.map((x) => runWorker(x, 4)));
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

function loadSamples(): Float32Array {
  if (!existsSync(DATA_DIR)) return new Float32Array(0);
  const files = readdirSync(DATA_DIR).filter((f) => f.startsWith('positions-') && f.endsWith('.f32')).sort();
  const parts = files.map((f) => {
    const bytes = readFileSync(resolve(DATA_DIR, f));
    return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  });
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

/** a dense network trained by Adam on squared error */
function fit(): Net {
  const data = loadSamples();
  const n = Math.floor(data.length / ROW);
  if (n < 100) throw new Error(`only ${n} positions written down: play first`);
  const rand = mulberry(7);
  /* the target of each row: in the Canal Era the era's lead, the game's lead, or a mix;
     once the rails are laid the two are the same number */
  const target = (r: number): number => {
    const canal = data[r * ROW + FEATURES];
    const game = data[r * ROW + FEATURES + 1];
    const inCanal = data[r * ROW + FEATURES - GLOBAL_ERA] === 0;
    if (!inCanal) return game;
    if (TARGET === 'canal') return canal;
    if (TARGET === 'game') return game;
    return MIX * canal + (1 - MIX) * game;
  };
  /* normalisation */
  const mean = new Float32Array(FEATURES);
  const scale = new Float32Array(FEATURES);
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) mean[k] += data[r * ROW + k] / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) scale[k] += ((data[r * ROW + k] - mean[k]) ** 2) / n;
  for (let k = 0; k < FEATURES; k++) scale[k] = Math.max(1e-3, Math.sqrt(scale[k]));
  /* the last tenth of the positions is held out */
  const cut = Math.floor(n * 0.9);
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
  const BATCH = 256;
  const LR = 1e-3;
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
  const rmse = (from: number, to: number): number => {
    let se = 0;
    for (let r = from; r < to; r++) {
      const d = forwardTo(r) - target(r);
      se += d * d;
    }
    return Math.sqrt(se / Math.max(1, to - from)) * POINTS;
  };
  let base = 0;
  for (let r = cut; r < n; r++) base += (target(r) * POINTS) ** 2;
  log(`fit (${TARGET}): ${n} positions, ${cut} to learn from, ${n - cut} held out; guessing zero misses by ${Math.sqrt(base / (n - cut)).toFixed(2)} points`);
  const order = Array.from({ length: cut }, (_, k) => k);
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
    const held = rmse(cut, n);
    if (held < bestHeld) {
      bestHeld = held;
      bestEpoch = epoch;
      keptW = W.map((w) => Float32Array.from(w));
      keptB = B.map((b) => Float32Array.from(b));
    }
    if (epoch === 1 || epoch % 5 === 0 || epoch === EPOCHS || epoch - bestEpoch >= PATIENCE) log(`fit: epoch ${epoch}, misses by ${rmse(0, Math.min(cut, 20000)).toFixed(2)} points learning, ${held.toFixed(2)} held out`);
    if (epoch - bestEpoch >= PATIENCE) {
      log(`fit: no better reading of the held-out positions for ${PATIENCE} epochs — keeping epoch ${bestEpoch} (${bestHeld.toFixed(2)})`);
      break;
    }
  }
  return { sizes, weights: keptW, biases: keptB, mean, scale, points: POINTS };
}

function writeNet(net: Net): void {
  const packed = pack(net);
  netText = packed;
  const lines = packed.match(/.{1,120}/g) ?? [];
  const body = lines.map((l) => `  '${l}',`).join('\n');
  writeFileSync(
    NET_FILE,
    `/* written by tools/bots/learn.ts — the network the machines last learned; null until one has been */\nexport const NET_B64: string | null = [\n${body}\n].join('');\n`,
  );
  log(`fit: network written, ${net.sizes.join('×')}, ${Math.round(packed.length / 1024)} KB`);
}

/* =============================== check ============================= */

/** the learned reading against the hand-written one, everyone at the same strength */
async function check(tag: string): Promise<void> {
  const result = await new Promise<{ wins: number; games: number; diff: number; canal: number; canalField: number }>((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { check: true, seed: 900000 + Number(tag) * 100, net: netText } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
  log(`check ${tag}: the network wins ${result.wins}/${result.games} (par ${(result.games / 4).toFixed(0)}), ${result.diff.toFixed(1)} points on the best rival, canal ${result.canal.toFixed(1)} vs ${result.canalField.toFixed(1)}`);
}

/* =============================== main ============================== */

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'loop';
  const tag = (k: number) => String(Date.now() % 100000 + k);
  if (mode === 'play') await play(tag(0));
  else if (mode === 'fit') writeNet(fit());
  else if (mode === 'check') await check(tag(0));
  else {
    for (let k = 1; k <= ITERATIONS; k++) {
      log(`--- iteration ${k} of ${ITERATIONS}`);
      await play(tag(k));
      writeNet(fit());
      await check(tag(k));
    }
  }
  log('--- done');
}

if (isMainThread) {
  void main();
} else if ((workerData as { check?: boolean }).check) {
  const { seed, net } = workerData as { seed: number; net: string | null };
  loadNet(net);
  const r = playMatch({ games: CHECK_GAMES, players: 4, seed, subject: TRAINED, field: TRAINED, search: { strength: STRENGTH, depth: 0 }, subjectMode: 'blend', fieldMode: 'hand' });
  parentPort!.postMessage(r);
} else {
  const { seeds, players, net } = workerData as { seeds: number[]; players: number; net: string | null };
  /* the machines play with what they know so far: the last network, if any */
  loadNet(net);
  setEvalMode('blend');
  const parts = seeds.map((seed) => playOne(seed, players));
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
