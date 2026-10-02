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
import type { MatchResult } from './arena';

const GAMES = Number(process.env.GAMES ?? 200);
const ITERATIONS = Number(process.env.ITERATIONS ?? 3);
const EPOCHS = Number(process.env.EPOCHS ?? 30);
const STRENGTH = Number(process.env.STRENGTH ?? 0.6);
/** how long the machines think while filling the record. Naming it matters:
 *  left unsaid the search caps itself at 300 ms, and every position the
 *  network has ever learned from was reached by a player five times weaker
 *  than the one the app ships. A network cannot outgrow its teacher.
 *
 *  What a position is worth is not a property of the position: it is what
 *  the rest of the game makes of it. Written down at 300 ms the label says
 *  how far ahead a weak player would finish, and the network learns to
 *  read a board the way a weak player reads it, however many positions it
 *  is shown. Six hundred is where the dial starts looking a round ahead,
 *  and the record is worth about twice what it costs. */
const PLAY_BUDGET = Number(process.env.PLAY_BUDGET ?? 600);
/** whether the machines see every second rail the rules allow while filling
 *  the record, or only those glued to the first link they lay.
 *
 *  The search offers the wide menu only above a budget of a second, and the
 *  record is written at six hundred milliseconds, so the player who writes
 *  it has been choosing from 44 of every 100 legal double rails — measured
 *  over 2 400 rail-era positions. That is not a shallower search but a
 *  blind spot in the moves themselves: the record simply never holds those
 *  positions, so nothing learns to read them. It costs four per cent of the
 *  time at this budget, the search being bounded by the clock either way. */
const PLAY_WIDE = (process.env.PLAY_WIDE ?? '0') !== '0';
/** rounds the machines look past their turn while filling the record */
const PLAY_DEPTH = Number(process.env.PLAY_DEPTH ?? 1) as 0 | 1 | 2;
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
const TARGET = (process.env.TARGET ?? 'own-mix') as 'canal' | 'game' | 'mix' | 'own-canal' | 'own-game' | 'own-mix';
const MIX = Number(process.env.MIX ?? 0.5);
/** a sample: the features, the canal-era lead and the game's lead (points / POINTS),
 *  the seats at the table and how many later positions of this seat follow in the era */
/* A row: the features, then the era's lead and the game's, the seats at the
 * table, how many of this seat's positions still follow in the era, and last
 * the seat's OWN scores. The leads were all a row held for a long time, from
 * when the machines played to widen a gap; they play for their own score now
 * (measured +4.6 points at three seats, +2.9 at four against a table that
 * blocks), so the network has to be able to learn that quantity too. */
const ROW = FEATURES + 6;
/** A record is only readable by a reading of the same shape. Change the
 *  features and every row already written means something else — the same
 *  bytes, cut in the wrong places — so the shape is written into the name
 *  and a record of another shape is left where it lies rather than read as
 *  gibberish. Nothing is deleted: an older reading can still find its own. */
const STAMP = `positions-${FEATURES}f-`;
const OWN_CANAL_AT = FEATURES + 4;
const OWN_GAME_AT = FEATURES + 5;
/** a seat's own score hovers around this, so the target is taken from here */
const OWN_CENTRE = Number(process.env.OWN_CENTRE ?? 120);

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
    const a = chooseBotAction(s, seat, { strength: STRENGTH, depth: PLAY_DEPTH, budgetMs: PLAY_BUDGET, wideSecond: PLAY_WIDE || undefined, opening: openings[seat] ?? undefined }) ?? fallbackAction(s, seat);
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
      out[at + OWN_CANAL_AT] = (canalScores[seat] - OWN_CENTRE) / POINTS;
      out[at + OWN_GAME_AT] = (finalScores[seat] - OWN_CENTRE) / POINTS;
      at += ROW;
    }
  }
  return { rows: out, canal: canalScores.reduce((a, b) => a + b, 0) / players };
}

/** the network the machines play with: the last one fitted, else the one shipped */
let netText: string | null = NET_B64;

/** the tables the machines train at: half of four, a quarter each of three and two */
const tableOf = (seed: number): number => [4, 4, 3, 2][seed % 4];

/** what a playing worker says: one word per game, then its whole slice */
type Note = { kind: 'played' } | { kind?: undefined; buffer: ArrayBuffer; canal: number };

function runWorker(seeds: number[], tick: () => void): Promise<{ buffer: ArrayBuffer; canal: number }> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds, net: netText } });
    worker.on('message', (m: Note) => {
      if (m.kind === 'played') tick();
      else ok(m);
    });
    worker.once('error', fail);
  });
}

async function play(tag: string): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const seeds = Array.from({ length: GAMES }, (_, g) => 100000 + Number(tag) * 10000 + g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const started = Date.now();
  let done = 0;
  /* a line every twentieth of the way, and never more than one a minute */
  const step = Math.max(1, Math.floor(GAMES / 20));
  let spoke = 0;
  const tick = (): void => {
    done += 1;
    const now = Date.now();
    if (done % step !== 0 || now - spoke < 60000) return;
    spoke = now;
    const per = (now - started) / done;
    log(`play ${tag}: ${done} of ${GAMES} games, about ${Math.round(((GAMES - done) * per) / 60000)} min left`);
  };
  const results = await Promise.all(slices.map((x) => runWorker(x, tick)));
  const total = results.reduce((a, r) => a + r.buffer.byteLength, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const r of results) {
    all.set(new Uint8Array(r.buffer), at);
    at += r.buffer.byteLength;
  }
  const file = resolve(DATA_DIR, `${STAMP}${tag}.f32`);
  writeFileSync(file, all);
  const rows = total / 4 / ROW;
  const canal = results.reduce((a, r) => a + r.canal, 0) / results.length;
  log(`play ${tag}: ${GAMES} games, ${rows} positions, mean canal-era points ${canal.toFixed(1)}, ${Math.round((Date.now() - started) / 1000)} s`);
}

/* ================================ fit ============================== */

/** the latest positions written down, newest files first, up to FIT_ROWS */
function loadSamples(): Float32Array {
  if (!existsSync(DATA_DIR)) return new Float32Array(0);
  const strangers = readdirSync(DATA_DIR).filter((f) => f.endsWith('.f32') && !f.startsWith(STAMP)).length;
  if (strangers) console.warn(`${strangers} record${strangers > 1 ? 's were' : ' was'} written for a different reading and left unread: this one wants ${FEATURES} features`);
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(STAMP) && f.endsWith('.f32'))
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
  /* A cap that says nothing reads as a count of everything there is. This
     one held at eight hundred thousand while two million sat unread beside
     it, and a run that fills the record is then filling a queue whose front
     falls off — the oldest positions leave the fit as the newest arrive,
     without a word. */
  const onDisk = files.reduce((a, f) => a + statSync(resolve(DATA_DIR, f)).size / 4 / ROW, 0);
  if (rows < onDisk) console.warn(`FIT_ROWS holds this fit to the newest ${Math.round(rows).toLocaleString('en')} positions of ${Math.round(onDisk).toLocaleString('en')} on disk`);
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
    const own = TARGET.startsWith('own-');
    const canal = data[r * ROW + (own ? OWN_CANAL_AT : FEATURES)];
    const game = data[r * ROW + (own ? OWN_GAME_AT : FEATURES + 1)];
    const inCanal = data[r * ROW + FEATURES - GLOBAL_ERA] === 0;
    if (!inCanal) return game;
    if (TARGET === 'canal' || TARGET === 'own-canal') return canal;
    if (TARGET === 'game' || TARGET === 'own-game') return game;
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
/** how many of the last features to hide from the fit.
 *
 *  A feature is only worth what it adds, and the only way to know is to
 *  train the same record twice, once with it and once without, and let
 *  the two play. Anything else compares a network to one trained on a
 *  different record, which answers a different question.
 *
 *  Hiding a feature is not merely leaving it out of the fit. A column
 *  held at nought has no spread, so its scale falls to the floor of a
 *  thousandth and its weights keep whatever they were first given; the
 *  network then meets the real number at the table, divides it by that
 *  thousandth and takes a value of three quarters as a hundred. The
 *  control is not blind, it is blinded — and it loses, which reads as
 *  the feature being worth thirty points when it is worth nothing of
 *  the sort. So the weights on a hidden feature are set to nought and
 *  its scale to one, and the network truly cannot tell it apart. */
const BLIND = Number(process.env.BLIND ?? 0);

/** a network that genuinely ignores the last `BLIND` features, whatever
 *  value they take: no weight reaches them, and the scale that would have
 *  magnified them is put back to one */
function blinded(net: Net): Net {
  if (BLIND <= 0) return net;
  const from = FEATURES - BLIND;
  for (let o = 0; o < net.sizes[1]; o += 1) net.weights[0].fill(0, o * FEATURES + from, (o + 1) * FEATURES);
  for (let k = from; k < FEATURES; k += 1) {
    net.mean[k] = 0;
    net.scale[k] = 1;
  }
  return net;
}

function fitBrain(): Brain {
  const data = loadSamples();
  if (BLIND > 0) {
    const rows = Math.floor(data.length / ROW);
    for (let r = 0; r < rows; r += 1) data.fill(0, r * ROW + FEATURES - BLIND, r * ROW + FEATURES);
    log(`fit: the last ${BLIND} of ${FEATURES} features are hidden from this fit`);
  }
  const previous = netText ? unpackBrain(netText) : null;
  const nets: Net[] = [];
  for (let k = 0; k < NETS; k++) {
    log(`fit: network ${k + 1} of ${NETS}`);
    nets.push(blinded(fit(data, 7 + 4 * k, previous)));
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
  /* the analysis turns a lead into a chance of winning through a logistic
     whose width was fitted against the reading that was in force then. A
     fresh reading moves the leads it is fitted to, so the review's grades
     and the panel in the game drift until it is fitted again. */
  log('fit: the chance of winning is fitted to a reading, not to this one — run tools/bots/calibrate.sh before this brain is shipped');
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

/* A network replaces the one before it only when the games say so, and
 * saying so is harder than it looks. A deal of cards decides a great
 * deal here, so forty-eight games tell two equal readings apart about as
 * well as a coin does: at the old bar of a third of the games won, one
 * neutral network in ten walked through the gate on luck alone, and a
 * loop that adopts noise wanders instead of climbing.
 *
 * So the check plays each deal twice — once with the newcomer at the
 * table, once with the field alone — and reads the newcomer's chair
 * against what that same chair made of that same deal with nobody new
 * in it. The deal's own luck falls out of the difference.
 *
 * Then it stops when it knows, and not before. After every block it asks
 * whether the edge it has measured clears zero by more than the spread
 * allows for — either way — and it keeps dealing while the answer is
 * neither. An easy case is settled in one block, a close one is given as
 * many as the cap allows, and one the games never decide leaves the
 * incumbent in place, because a reading that could not be shown to help
 * has not helped. */

/** how many spreads the edge must clear zero by before a network is adopted.
 *
 *  Not the 1.645 of a single look. The check looks after every block and
 *  stops as soon as it can, and a test that may stop early at eight points
 *  along the way crosses a 1.645 bound seventeen times in a hundred on a
 *  network that is no better at all — worse than the flat bar it replaces.
 *  At 2.33 the same eight looks come to about one in twenty, which is what
 *  a promotion is meant to mean. */
const BOUND = Number(process.env.BOUND ?? 2.33);
/** the most games a single check may spend before it gives up deciding.
 *  Eight blocks; past it the incumbent keeps its seat, because a reading
 *  that could not be shown to help has not helped. */
const CHECK_MAX = Number(process.env.CHECK_MAX ?? CHECK_GAMES * 8);

/** how far the average of these deals might be from the average of every
 *  deal that could have been dealt */
const errorOf = (n: number, sum: number, sq: number): number => {
  if (n < 2) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1)) / n);
};

async function block(tag: string, fresh: string, previous: string | null, at: number, games: number): Promise<MatchResult[]> {
  const per = Math.max(1, Math.round(games / CHECK_WORKERS));
  return Promise.all(
    Array.from({ length: CHECK_WORKERS }, (_, k) =>
      new Promise<MatchResult>((ok, fail) => {
        const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { check: true, games: per, seed: 900000 + Number(tag) * 10000 + (at + k * per) * 4, net: fresh, previous } });
        worker.once('message', ok);
        worker.once('error', fail);
      }),
    ),
  );
}

/** the new reading against the one it would replace — the last network, or
 *  the hand-written reading when there is none — everyone at the same
 *  strength; the newcomer stays only once the games have said it is better */
async function check(tag: string, fresh: string, previous: string | null): Promise<boolean> {
  let games = 0;
  let wins = 0;
  let edgeSum = 0;
  let edgeSq = 0;
  /* the test counts deals, not games: the chairs of one deal share a single
     game of the field alone and are one answer between them */
  let deals = 0;
  let diffSum = 0;
  let diffSq = 0;
  let soloSum = 0;
  let soloSq = 0;
  let soloDeals = 0;
  let canal = 0;
  let canalField = 0;
  let verdict: 'kept' | 'refused' | null = null;
  while (games < CHECK_MAX && !verdict) {
    const slices = await block(tag, fresh, previous, games, CHECK_GAMES);
    for (const r of slices) {
      games += r.games;
      wins += r.wins;
      edgeSum += r.edgeSum;
      edgeSq += r.edgeSq;
      deals += r.pairs;
      diffSum += r.diffSum;
      diffSq += r.diffSq;
      soloSum += r.soloSum;
      soloSq += r.soloSq;
      soloDeals += r.deals;
      canal += r.canal * r.games;
      canalField += r.canalField * r.games;
    }
    const mean = edgeSum / Math.max(1, deals);
    const err = errorOf(deals, edgeSum, edgeSq);
    if (deals >= 8 && err > 0) {
      if (mean - BOUND * err > 0) verdict = 'kept';
      else if (mean + BOUND * err < 0) verdict = 'refused';
    }
  }
  const edge = edgeSum / Math.max(1, deals);
  const spread = errorOf(deals, edgeSum, edgeSq);
  /* the same games read two other ways, so the record shows what holding
     the deal bought: against the rest of its own table, which costs no
     extra game and is honest but wider, and on the best rival, which is
     the old yardstick and sits a dozen points under nought by its shape */
  const solo = soloSum / Math.max(1, soloDeals);
  const wide = errorOf(soloDeals, soloSum, soloSq);
  const raw = errorOf(games, diffSum, diffSq);
  /* the Canal Era must not be sold to win the rail one */
  const held = canal / Math.max(1, games) >= canalField / Math.max(1, games) - 3;
  const keep = verdict === 'kept' && held;
  const why = verdict === null ? 'the games never decided' : verdict === 'refused' ? 'no better' : held ? 'better' : 'better, but the canal era was given away';
  log(
    `check ${tag}: ${games} games over ${deals} deals against ${previous ? 'the last one' : 'the hand-written reading'} — ${edge >= 0 ? '+' : ''}${edge.toFixed(2)} ± ${spread.toFixed(2)} points on the same deals (${solo >= 0 ? '+' : ''}${solo.toFixed(2)} ± ${wide.toFixed(2)} against its own table, ${(diffSum / Math.max(1, games)).toFixed(1)} ± ${raw.toFixed(1)} on the best rival), ${wins} won, canal ${(canal / Math.max(1, games)).toFixed(1)} vs ${(canalField / Math.max(1, games)).toFixed(1)} — ${why}${keep ? ', kept' : ', the last one stays'}`,
  );
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
  /* the mismatch that used to be silent: a record written by a player the
     app never fields teaches a reading the app can never use */
  if (!PLAY_WIDE) log('note: the record is written from the narrow menu of second rails — about 44 in 100 of those the rules allow (PLAY_WIDE=1 offers them all, for four per cent of the time)');
  if (PLAY_BUDGET < YARDSTICK_BUDGET) log(`note: the record is written at ${PLAY_BUDGET} ms and depth ${PLAY_DEPTH}, the expert ships at ${YARDSTICK_BUDGET} ms — the network learns from a weaker player than the one it will serve`);
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
  /* each deal played twice, the newcomer's chair read against the same
     chair on the same deal with the field alone: the luck of the cards
     answers the same question in both games and cancels */
  const r = playMatch({ games, players: 4, seed, subject: TRAINED, field: TRAINED, search: { strength: STRENGTH, depth: 0 }, subjectMode: 'blend', fieldMode: previous ? 'blend' : 'hand', subjectNet: net, fieldNet: previous, paired: true });
  parentPort!.postMessage(r);
} else {
  const { seeds, net } = workerData as { seeds: number[]; net: string | null };
  /* the machines play with what they know so far: the last network, if any */
  loadNet(net);
  setEvalMode('blend');
  /* a word after every game: filling the record takes hours, and a run
     that says nothing until the end cannot be told from one that hung */
  const parts = seeds.map((seed) => {
    const one = playOne(seed, tableOf(seed));
    parentPort!.postMessage({ kind: 'played' });
    return one;
  });
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
