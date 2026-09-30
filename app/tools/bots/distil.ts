/* ------------------------------------------------------------------ */
/* The machines learn which moves are worth a thought.                 */
/*                                                                     */
/*   play  — the search plays itself and writes down, at every turn,   */
/*           the table, how each move read, and the one it played      */
/*   fit   — a network is trained to say the same, and packed into     */
/*           src/game/policy-weights.ts                                */
/*   check — the network alone, with no search at all, plays the       */
/*           search: if it holds its own, the naming carries the       */
/*           knowledge and a tree can be built on it                   */
/*   families — where the two part ways, by family of move             */
/*   duel  — a search guided by the ranker against the plain one, same  */
/*           budget: does narrowing the breadth buy any points at all   */
/*   prune — what a search would keep and lose by looking only at the  */
/*           moves the ranker puts first: the measure that decides     */
/*           whether a tree can be built on it                         */
/*   loop  — play, fit, check, and again                               */
/*                                                                     */
/*   sh tools/bots/distil.sh loop   (GAMES, ITERATIONS, EPOCHS,        */
/*                                   STRENGTH, BUDGET, WORKERS)        */
/*                                                                     */
/* This is the cheap way to find out whether a move's name is enough   */
/* to learn from, before spending weeks on a search that thinks in     */
/* trees. A policy that plays near the search it copied says yes.      */
/* ------------------------------------------------------------------ */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { applyAction, fallbackAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { FEATURES, features, forwardAll, pack, unpack } from '@/game/net';
import type { Net } from '@/game/net';
import { ACTIONS, DEVELOP_ONE_AT, DEVELOP_TWO_AT, LINK_ONE_AT, LINK_TWO_AT, LOAN_AT, PASS_AT, SCOUT_AT, SELL_ALL_AT, actionIndex, priors } from '@/game/policy';
import { chooseBotAction, legalActions, searchTurn } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';

const GAMES = Number(process.env.GAMES ?? 120);
const ITERATIONS = Number(process.env.ITERATIONS ?? 1);
const EPOCHS = Number(process.env.EPOCHS ?? 40);
const STRENGTH = Number(process.env.STRENGTH ?? 1);
const DEPTH = Number(process.env.DEPTH ?? 0) as 0 | 1 | 2;
/** the teacher's thinking time: past a second it tries every pair of actions */
const BUDGET = Number(process.env.BUDGET ?? 1500);
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, cpus().length - 4));
const CHECK_GAMES = Number(process.env.CHECK_GAMES ?? 24);
const HIDDEN = (process.env.HIDDEN ?? '128,96').split(',').map(Number);
/** how sharply the search's reading turns into a wish to play a move, in points */
const TEMP = Number(process.env.TEMP ?? 3);
/** how much of the target is the move actually played, the rest the reading */
const CHOSEN = Number(process.env.CHOSEN ?? 0.5);
const PATIENCE = Number(process.env.PATIENCE ?? 6);
/** names the guided search keeps, and how far past the turn it then looks */
const GUIDED = Number(process.env.GUIDED ?? 8);
const GUIDED_DEPTH = Number(process.env.GUIDED_DEPTH ?? DEPTH) as 0 | 1 | 2;
/** whether the ranker narrows the turn's second action as well as its first */
const GUIDED_PAIRS = (process.env.GUIDED_PAIRS ?? '1') !== '0';
/** how many deals the duel plays; each is played twice, guided and plain */
const DUEL_GAMES = Number(process.env.DUEL_GAMES ?? CHECK_GAMES);
const DECAY = Number(process.env.DECAY ?? 1e-5);

/** moves kept per position: the rest read too badly to be worth the room */
const KEPT = 16;
/** words of 32 bits holding which names were legal */
const MASK_WORDS = Math.ceil(ACTIONS / 32);
const CHOSEN_AT = FEATURES;
const MASK_AT = CHOSEN_AT + 1;
const KEPT_AT = MASK_AT + MASK_WORDS;
const ROW = KEPT_AT + KEPT * 2;

const DATA_DIR = resolve('tools/bots/policy-data');
const LOG = resolve('tools/bots/distil.log');
const COLORS = ['red', 'yellow', 'purple', 'teal'] as const;
const PERSONAS = ['watt', 'bright', 'owen', 'peel'] as const;

function log(line: string): void {
  console.log(line);
  try {
    appendFileSync(LOG, `${line}\n`);
  } catch {
    /* the log is a courtesy, not a requirement */
  }
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

const setupFor = (players: number): SetupPayload =>
  ({
    players: Array.from({ length: players }, (_, k) => ({ name: `P${k}`, color: COLORS[k], type: 'bot', persona: PERSONAS[k] })),
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  }) as SetupPayload;

/* ================================ play ============================= */

/** one game the search plays against itself, every turn written down */
function playOne(seed: number, players: number): { rows: Float32Array; turns: number } {
  let s: GameState = newGame(setupFor(players), seed);
  const kept: number[][] = [];
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const found = searchTurn(s, seat, { strength: STRENGTH, depth: DEPTH, budgetMs: BUDGET, rank: true });
    const action: GameAction = found?.action ?? fallbackAction(s, seat);
    const chosen = actionIndex(action);
    if (found?.ranked && chosen >= 0) {
      const x = features(s, seat);
      const row = new Array<number>(ROW).fill(0);
      for (let k = 0; k < FEATURES; k++) row[k] = x[k];
      row[CHOSEN_AT] = chosen;
      /* which names were on offer at all: the moves the engine accepted */
      const mask = new Uint32Array(MASK_WORDS);
      for (const r of found.ranked) {
        const at = actionIndex(r.action);
        if (at >= 0) mask[at >>> 5] |= 1 << (at & 31);
      }
      /* the best reading of each name: several moves may carry one */
      const best = new Map<number, number>();
      for (const r of found.ranked) {
        const at = actionIndex(r.action);
        if (at < 0) continue;
        const cur = best.get(at);
        if (cur === undefined || r.score > cur) best.set(at, r.score);
      }
      const top = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEPT);
      for (const [k, [at, score]] of top.entries()) {
        row[KEPT_AT + k * 2] = at;
        row[KEPT_AT + k * 2 + 1] = score;
      }
      /* the unused slots say so, a name of -1 no reading can claim */
      for (let k = top.length; k < KEPT; k++) row[KEPT_AT + k * 2] = -1;
      kept.push(row.map((v, k) => (k >= MASK_AT && k < KEPT_AT ? mask[k - MASK_AT] : v)));
    }
    s = applyAction(s, seat, action).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  const out = new Float32Array(kept.length * ROW);
  const asInts = new Uint32Array(out.buffer);
  for (const [r, row] of kept.entries()) {
    for (let k = 0; k < ROW; k++) {
      if (k >= MASK_AT && k < KEPT_AT) asInts[r * ROW + k] = row[k];
      else out[r * ROW + k] = row[k];
    }
  }
  return { rows: out, turns: kept.length };
}

const tableOf = (seed: number): number => [4, 4, 3, 2][seed % 4];

function runWorker(seeds: number[]): Promise<{ buffer: ArrayBuffer; turns: number }> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { job: 'play', seeds } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
}

/** a slice of a duel, played on its own core */
function runDuelWorker(seeds: number[]): Promise<{ wins: number; diff: number; diffSq: number; edgeSum: number; edgeSq: number; games: number }> {
  return new Promise((ok, fail) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { job: 'duel', seeds, guided: GUIDED, guidedDepth: GUIDED_DEPTH } });
    worker.once('message', ok);
    worker.once('error', fail);
  });
}

async function play(tag: string): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const seeds = Array.from({ length: GAMES }, (_, g) => 500000 + Number(tag) * 10000 + g);
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
  writeFileSync(resolve(DATA_DIR, `moves-${tag}.f32`), all);
  const turns = results.reduce((a, r) => a + r.turns, 0);
  log(`play ${tag}: ${GAMES} games, ${turns} turns written down, ${Math.round((Date.now() - started) / 1000)} s`);
}

/* ================================ fit ============================== */

function loadSamples(): Float32Array {
  if (!existsSync(DATA_DIR)) return new Float32Array(0);
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('moves-') && f.endsWith('.f32'))
    .map((f) => ({ f, at: statSync(resolve(DATA_DIR, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .map((x) => x.f);
  const parts: Float32Array[] = [];
  for (const f of files) {
    const bytes = readFileSync(resolve(DATA_DIR, f));
    parts.push(new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
  }
  const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

/** what the network should wish for at one position: mostly the search's
 *  reading of every name, partly the name it actually played */
function targetOf(data: Float32Array, r: number, out: Float32Array): void {
  out.fill(0);
  let top = -Infinity;
  for (let k = 0; k < KEPT; k++) {
    const at = data[r * ROW + KEPT_AT + k * 2];
    if (at < 0) break;
    top = Math.max(top, data[r * ROW + KEPT_AT + k * 2 + 1]);
  }
  let sum = 0;
  for (let k = 0; k < KEPT; k++) {
    const at = data[r * ROW + KEPT_AT + k * 2];
    if (at < 0) break;
    const w = Math.exp((data[r * ROW + KEPT_AT + k * 2 + 1] - top) / TEMP);
    out[at] += w;
    sum += w;
  }
  if (sum > 0) for (let k = 0; k < ACTIONS; k++) out[k] *= (1 - CHOSEN) / sum;
  out[data[r * ROW + CHOSEN_AT]] += CHOSEN;
}

/** a dense network trained by Adam on the cross-entropy of the names on
 *  offer: illegal names are left out of the softmax and never taught */
function fit(data: Float32Array, seed: number): Net {
  const asInts = new Uint32Array(data.buffer);
  const n = Math.floor(data.length / ROW);
  if (n < 100) throw new Error(`only ${n} turns written down: play first`);
  const rand = mulberry(seed);
  const mean = new Float32Array(FEATURES);
  const scale = new Float32Array(FEATURES);
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) mean[k] += data[r * ROW + k] / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < FEATURES; k++) scale[k] += (data[r * ROW + k] - mean[k]) ** 2 / n;
  for (let k = 0; k < FEATURES; k++) scale[k] = Math.max(1e-3, Math.sqrt(scale[k]));

  /* a tenth of the turns is held out, in slices spread over the record so
     that every table size is in both parts; on a small record, every tenth */
  const SLICE = Math.max(100, Math.floor(n / 40));
  const learn: number[] = [];
  const held: number[] = [];
  const sliced = n >= SLICE * 10;
  for (let r = 0; r < n; r++) ((sliced ? Math.floor(r / SLICE) % 10 === 9 : r % 10 === 9) ? held : learn).push(r);
  const cut = learn.length;

  const sizes = [FEATURES, ...HIDDEN, ACTIONS];
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
  const acts = sizes.map((z) => new Float32Array(z));
  const grads = sizes.map((z) => new Float32Array(z));
  const gW = W.map((w) => new Float32Array(w.length));
  const gB = B.map((b) => new Float32Array(b.length));
  const BATCH = 256;
  const LR = 7e-4;
  const B1 = 0.9;
  const B2 = 0.999;
  let step = 0;
  const want = new Float32Array(ACTIONS);
  const prob = new Float32Array(ACTIONS);
  const legal: number[] = [];

  const forwardTo = (r: number): void => {
    for (let k = 0; k < FEATURES; k++) acts[0][k] = (data[r * ROW + k] - mean[k]) / scale[k];
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
  };
  /** the softmax over the names on offer, into `prob`; `legal` lists them */
  const soften = (r: number): void => {
    legal.length = 0;
    for (let word = 0; word < MASK_WORDS; word++) {
      const bits = asInts[r * ROW + MASK_AT + word];
      for (let b = 0; b < 32; b++) if (bits & (1 << b)) legal.push(word * 32 + b);
    }
    const out = acts[W.length];
    let top = -Infinity;
    for (const k of legal) top = Math.max(top, out[k]);
    let sum = 0;
    prob.fill(0);
    for (const k of legal) {
      const p = Math.exp(out[k] - top);
      prob[k] = p;
      sum += p;
    }
    for (const k of legal) prob[k] /= sum;
  };
  /** how often the network's favourite is the one the search played, and
   *  how often it is among its three best */
  const agreement = (rows: number[]): { one: number; three: number; loss: number } => {
    let one = 0;
    let three = 0;
    let loss = 0;
    for (const r of rows) {
      forwardTo(r);
      soften(r);
      const played = data[r * ROW + CHOSEN_AT];
      loss -= Math.log(Math.max(1e-9, prob[played]));
      let better = 0;
      for (const k of legal) if (prob[k] > prob[played]) better += 1;
      if (better === 0) one += 1;
      if (better < 3) three += 1;
    }
    const m = Math.max(1, rows.length);
    return { one: one / m, three: three / m, loss: loss / m };
  };

  log(`fit: ${n} turns, ${cut} to learn from, ${held.length} held out; ${sizes.join('×')}`);
  const order = [...learn];
  const sample = learn.filter((_, k) => k % 7 === 0).slice(0, 8000);
  let bestLoss = Infinity;
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
        forwardTo(r);
        soften(r);
        targetOf(data, r, want);
        grads[W.length].fill(0);
        for (const k of legal) grads[W.length][k] = (prob[k] - want[k]) / rows;
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
    const now = agreement(held);
    if (now.loss < bestLoss) {
      bestLoss = now.loss;
      bestEpoch = epoch;
      keptW = W.map((w) => Float32Array.from(w));
      keptB = B.map((b) => Float32Array.from(b));
    }
    if (epoch === 1 || epoch % 5 === 0 || epoch === EPOCHS || epoch - bestEpoch >= PATIENCE) {
      const mine = agreement(sample);
      log(`fit: epoch ${epoch}, plays the search's move ${(mine.one * 100).toFixed(1)}% learning, ${(now.one * 100).toFixed(1)}% held out (top three ${(now.three * 100).toFixed(1)}%), loss ${now.loss.toFixed(3)}`);
    }
    if (epoch - bestEpoch >= PATIENCE) {
      log(`fit: no better ranking of the held-out turns for ${PATIENCE} epochs — keeping epoch ${bestEpoch}`);
      break;
    }
  }
  return { sizes, weights: keptW, biases: keptB, mean, scale, points: 1 };
}

function writePolicy(policy: Net): void {
  const text = pack(policy);
  writeFileSync(
    resolve('src/game/policy-weights.ts'),
    `/** the move ranker, trained by tools/bots/distil.ts — empty until one is */\nexport const POLICY_B64 =\n  '${text}';\n`,
  );
  log(`fit: policy written, ${policy.sizes.join('×')}, ${Math.round(text.length / 1024)} KB`);
}

/* =============================== check ============================= */

/** the policy alone, no search: the best-ranked move on offer */
function policyMove(policy: Net, s: GameState, i: number): GameAction | null {
  const legal = legalActions(s, i);
  if (!legal.length) return null;
  const p = priors(policy, features(s, i), legal);
  let best = 0;
  for (let k = 1; k < legal.length; k++) if (p[k] > p[best]) best = k;
  return legal[best];
}

/** one game where `subject` is ranked by the policy and the rest searched */
function playCheck(policy: Net, seed: number, players: number, subject: number): GameState {
  let s: GameState = newGame(setupFor(players), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const a = (seat === subject ? policyMove(policy, s, seat) : chooseBotAction(s, seat, { strength: STRENGTH, depth: DEPTH, budgetMs: BUDGET })) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s;
}

function check(policy: Net): void {
  const started = Date.now();
  let wins = 0;
  let diff = 0;
  let played = 0;
  for (let g = 0; g < CHECK_GAMES; g++) {
    const players = tableOf(g);
    const subject = g % players;
    const s = playCheck(policy, 900000 + g, players, subject);
    const scores = s.players.map((p) => p.vp);
    const rivals = Math.max(...scores.filter((_, k) => k !== subject));
    if (scores[subject] > rivals) wins += 1;
    diff += scores[subject] - rivals;
    played += 1;
  }
  const par = CHECK_GAMES / 3;
  log(
    `check: the policy alone wins ${wins}/${played} against the search it copied (par about ${par.toFixed(0)}), ${(diff / played).toFixed(1)} points on the best rival, ${Math.round((Date.now() - started) / 1000)} s`,
  );
}

/* ============================== families =========================== */

/** which family of move a name belongs to */
function family(at: number): string {
  if (at < LINK_ONE_AT) return 'build';
  if (at < LINK_TWO_AT) return 'link';
  if (at < SELL_ALL_AT) return 'double link';
  if (at < DEVELOP_ONE_AT) return 'sell';
  if (at < DEVELOP_TWO_AT) return 'develop';
  if (at < LOAN_AT) return 'develop twice';
  if (at === LOAN_AT) return 'loan';
  if (at === SCOUT_AT) return 'scout';
  if (at === PASS_AT) return 'pass';
  return '?';
}

/** where the ranker and the search part ways: a family it never gets right
 *  points at the naming, a family it gets right but for the wrong town at
 *  a want of turns to learn from */
function families(policy: Net, data: Float32Array): void {
  const asInts = new Uint32Array(data.buffer);
  const n = Math.floor(data.length / ROW);
  const SLICE = Math.max(100, Math.floor(n / 40));
  const sliced = n >= SLICE * 10;
  const held: number[] = [];
  for (let r = 0; r < n; r++) if (sliced ? Math.floor(r / SLICE) % 10 === 9 : r % 10 === 9) held.push(r);
  const seen = new Map<string, { n: number; one: number; three: number }>();
  const instead = new Map<string, number>();
  const x = new Float32Array(FEATURES);
  let one = 0;
  let three = 0;
  for (const r of held) {
    for (let k = 0; k < FEATURES; k++) x[k] = data[r * ROW + k];
    const out = forwardAll(policy, x);
    const legal: number[] = [];
    for (let w = 0; w < MASK_WORDS; w++) {
      const bits = asInts[r * ROW + MASK_AT + w];
      for (let b = 0; b < 32; b++) if (bits & (1 << b)) legal.push(w * 32 + b);
    }
    if (!legal.length) continue;
    const played = data[r * ROW + CHOSEN_AT];
    let better = 0;
    let top = legal[0];
    for (const k of legal) {
      if (out[k] > out[played]) better += 1;
      if (out[k] > out[top]) top = k;
    }
    const fam = family(played);
    const cur = seen.get(fam) ?? { n: 0, one: 0, three: 0 };
    cur.n += 1;
    if (better === 0) {
      cur.one += 1;
      one += 1;
    }
    if (better < 3) {
      cur.three += 1;
      three += 1;
    }
    seen.set(fam, cur);
    if (better > 0) {
      const key = `${fam} → ${family(top)}`;
      instead.set(key, (instead.get(key) ?? 0) + 1);
    }
  }
  const m = Math.max(1, held.length);
  log(`families: ${held.length} turns held out of ${n}; the search's move comes first ${((one / m) * 100).toFixed(1)}% of the time, in the first three ${((three / m) * 100).toFixed(1)}%`);
  log('  family          share   first   in three');
  for (const [fam, v] of [...seen.entries()].sort((a, b) => b[1].n - a[1].n)) {
    log(`  ${fam.padEnd(14)} ${((v.n / m) * 100).toFixed(1).padStart(5)}%  ${((v.one / v.n) * 100).toFixed(1).padStart(5)}%  ${((v.three / v.n) * 100).toFixed(1).padStart(8)}%`);
  }
  log('  what it wants instead:');
  for (const [k, c] of [...instead.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) log(`  ${((c / m) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

/* ================================ duel ============================= */

/** one game where `subject` searches only the moves the ranker puts first
 *  and the rest search everything, both on the same clock */
function playDuel(seed: number, players: number, subject: number): GameState {
  let s: GameState = newGame(setupFor(players), seed);
  let guard = 0;
  while (s.phase !== 'game-over' && guard++ < 5000) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const seat = s.current;
    const o =
      seat === subject
        ? { strength: STRENGTH, depth: GUIDED_DEPTH, budgetMs: BUDGET, guided: GUIDED, guidedPairs: GUIDED_PAIRS }
        : { strength: STRENGTH, depth: DEPTH, budgetMs: BUDGET };
    const a = chooseBotAction(s, seat, o) ?? fallbackAction(s, seat);
    s = applyAction(s, seat, a).state ?? applyAction(s, seat, fallbackAction(s, seat)).state!;
  }
  return s;
}

/** what every chair made of a finished game, each against its best rival */
const marginsOf = (s: GameState): number[] => {
  const scores = s.players.map((p) => p.vp);
  return scores.map((v, k) => v - Math.max(...scores.filter((_, j) => j !== k)));
};

/** a slice of games: their wins, their margin, and — since the deal decides
 *  so much of a game here — the same deal played again with nobody guided,
 *  so that the guided chair is read against what that chair made of those
 *  same cards on its own. The luck of the shuffle asks the same question
 *  twice and falls out of the difference. */
function duelSlice(seeds: number[]): { wins: number; diff: number; diffSq: number; edgeSum: number; edgeSq: number; games: number } {
  let wins = 0;
  let diff = 0;
  let diffSq = 0;
  let edgeSum = 0;
  let edgeSq = 0;
  for (const seed of seeds) {
    const players = tableOf(seed);
    const subject = seed % players;
    const s = playDuel(900000 + seed, players, subject);
    const margin = marginsOf(s)[subject];
    if (margin > 0) wins += 1;
    diff += margin;
    diffSq += margin * margin;
    const alone = marginsOf(playDuel(900000 + seed, players, -1));
    const e = margin - alone[subject];
    edgeSum += e;
    edgeSq += e * e;
  }
  return { wins, diff, diffSq, edgeSum, edgeSq, games: seeds.length };
}

/** the guided search against the plain one, the subject seat rotating, every
 *  core playing its own slice. Twenty-four games cannot separate two settings
 *  ten points apart: the margin's spread over a game is that wide on its own. */
/** the standard error of a mean, measured rather than assumed: the spread
 *  used to be written in as thirty points a game, which was a guess, and a
 *  generous one — the margins actually run about twenty apart */
const errorOf = (n: number, sum: number, sq: number): number => {
  if (n < 2) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1)) / n);
};

async function duel(): Promise<void> {
  const started = Date.now();
  const seeds = Array.from({ length: DUEL_GAMES }, (_, g) => g);
  const slices = Array.from({ length: WORKERS }, (_, w) => seeds.filter((_, k) => k % WORKERS === w)).filter((x) => x.length);
  const parts = await Promise.all(slices.map((x) => runDuelWorker(x)));
  const wins = parts.reduce((a, r) => a + r.wins, 0);
  const diff = parts.reduce((a, r) => a + r.diff, 0);
  const diffSq = parts.reduce((a, r) => a + r.diffSq, 0);
  const edgeSum = parts.reduce((a, r) => a + r.edgeSum, 0);
  const edgeSq = parts.reduce((a, r) => a + r.edgeSq, 0);
  const games = parts.reduce((a, r) => a + r.games, 0);
  const mean = diff / games;
  const edge = edgeSum / games;
  log(
    `duel: the search guided to ${GUIDED} names${GUIDED_PAIRS ? '' : ' (first action only)'} at depth ${GUIDED_DEPTH} against the plain one at depth ${DEPTH}, ${BUDGET} ms each — ${edge >= 0 ? '+' : ''}${edge.toFixed(2)} ± ${errorOf(games, edgeSum, edgeSq).toFixed(2)} points on the same deals (${mean.toFixed(1)} ± ${errorOf(games, diff, diffSq).toFixed(1)} unpaired), ${wins}/${games} won, ${Math.round((Date.now() - started) / 1000)} s`,
  );
}

/* =============================== prune ============================= */

/** How much of the search survives if it only ever looks at the moves the
 *  ranker puts first. This, and not whether the ranker can play a game on
 *  its own, is what says a tree can be built on it: a prior's job is to
 *  narrow the breadth without throwing the right move away. */
function prune(policy: Net, data: Float32Array): void {
  const asInts = new Uint32Array(data.buffer);
  const n = Math.floor(data.length / ROW);
  const SLICE = Math.max(100, Math.floor(n / 40));
  const sliced = n >= SLICE * 10;
  const held: number[] = [];
  for (let r = 0; r < n; r++) if (sliced ? Math.floor(r / SLICE) % 10 === 9 : r % 10 === 9) held.push(r);
  const KS = [1, 3, 5, 8, 12, 16];
  const covered = KS.map(() => 0);
  const lost = KS.map(() => 0);
  const worst = KS.map(() => 0);
  let legalTotal = 0;
  let turns = 0;
  const x = new Float32Array(FEATURES);
  for (const r of held) {
    for (let k = 0; k < FEATURES; k++) x[k] = data[r * ROW + k];
    const out = forwardAll(policy, x);
    const legal: number[] = [];
    for (let w = 0; w < MASK_WORDS; w++) {
      const bits = asInts[r * ROW + MASK_AT + w];
      for (let b = 0; b < 32; b++) if (bits & (1 << b)) legal.push(w * 32 + b);
    }
    if (!legal.length) continue;
    turns += 1;
    legalTotal += legal.length;
    const ranked = [...legal].sort((a, b) => out[b] - out[a]);
    const played = data[r * ROW + CHOSEN_AT];
    const read = new Map<number, number>();
    let floor = Infinity;
    for (let k = 0; k < KEPT; k++) {
      const at = data[r * ROW + KEPT_AT + k * 2];
      if (at < 0) break;
      const v = data[r * ROW + KEPT_AT + k * 2 + 1];
      read.set(at, v);
      floor = Math.min(floor, v);
    }
    const best = data[r * ROW + KEPT_AT + 1];
    for (const [i, K] of KS.entries()) {
      const top = ranked.slice(0, K);
      if (top.includes(played)) covered[i] += 1;
      /* the best the search could still find among what was kept; a name
         it never read is at best as good as the worst one it did */
      let reach = -Infinity;
      for (const at of top) reach = Math.max(reach, read.get(at) ?? floor);
      const gap = best - reach;
      lost[i] += gap;
      worst[i] = Math.max(worst[i], gap);
    }
  }
  const m = Math.max(1, turns);
  const breadth = legalTotal / m;
  log(`prune: ${turns} turns held out, ${breadth.toFixed(1)} names on offer per turn`);
  log('  kept   the move survives   breadth   points given up (mean / worst)');
  for (const [i, K] of KS.entries()) {
    log(`  ${String(K).padStart(4)}   ${((covered[i] / m) * 100).toFixed(1).padStart(15)}%   ${(breadth / K).toFixed(1).padStart(6)}x   ${(lost[i] / m).toFixed(2).padStart(12)} / ${worst[i].toFixed(1)}`);
  }
}

/** the policy last written, unpacked */
function readPolicy(): Net {
  const text = readFileSync(resolve('src/game/policy-weights.ts'), 'utf8').match(/'([A-Za-z0-9+/=]+)'/)?.[1];
  if (!text) throw new Error('no policy trained yet: fit first');
  return unpack(text);
}

/* ================================ main ============================= */

if (!isMainThread && (workerData as { job?: string }).job === 'duel') {
  const { seeds } = workerData as { seeds: number[] };
  parentPort!.postMessage(duelSlice(seeds));
} else if (!isMainThread) {
  const { seeds } = workerData as { seeds: number[] };
  const parts: Float32Array[] = [];
  let turns = 0;
  for (const seed of seeds) {
    const r = playOne(seed, tableOf(seed));
    parts.push(r.rows);
    turns += r.turns;
  }
  const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  parentPort!.postMessage({ buffer: all.buffer, turns }, [all.buffer]);
} else {
  const what = process.argv[2] ?? 'loop';
  const tag = (): string => String(Math.floor(Math.random() * 90000) + 10000);
  const run = async (): Promise<void> => {
    if (what === 'play') await play(tag());
    else if (what === 'fit') writePolicy(fit(loadSamples(), 11));
    else if (what === 'check') check(readPolicy());
    else if (what === 'families') families(readPolicy(), loadSamples());
    else if (what === 'prune') prune(readPolicy(), loadSamples());
    else if (what === 'duel') await duel();
    else if (what === 'loop') {
      for (let k = 1; k <= ITERATIONS; k++) {
        log(`--- iteration ${k} of ${ITERATIONS}`);
        await play(tag());
        const data = loadSamples();
        const policy = fit(data, 11 + k);
        writePolicy(policy);
        families(policy, data);
        prune(policy, data);
        check(policy);
      }
    } else throw new Error(`unknown command ${what}`);
  };
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
