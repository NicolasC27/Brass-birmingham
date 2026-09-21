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
/*   loop  — play, fit, check, and again                               */
/*                                                                     */
/*   sh tools/bots/distil.sh loop   (GAMES, ITERATIONS, EPOCHS,        */
/*                                   STRENGTH, WORKERS in the env)     */
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
import { FEATURES, features, pack, unpack } from '@/game/net';
import type { Net } from '@/game/net';
import { ACTIONS, actionIndex, priors } from '@/game/policy';
import { chooseBotAction, legalActions, searchTurn } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';

const GAMES = Number(process.env.GAMES ?? 120);
const ITERATIONS = Number(process.env.ITERATIONS ?? 1);
const EPOCHS = Number(process.env.EPOCHS ?? 40);
const STRENGTH = Number(process.env.STRENGTH ?? 1);
const DEPTH = Number(process.env.DEPTH ?? 0) as 0 | 1 | 2;
const WORKERS = Number(process.env.WORKERS ?? Math.max(1, cpus().length - 4));
const CHECK_GAMES = Number(process.env.CHECK_GAMES ?? 24);
const HIDDEN = (process.env.HIDDEN ?? '128,96').split(',').map(Number);
/** how sharply the search's reading turns into a wish to play a move, in points */
const TEMP = Number(process.env.TEMP ?? 3);
/** how much of the target is the move actually played, the rest the reading */
const CHOSEN = Number(process.env.CHOSEN ?? 0.5);
const PATIENCE = Number(process.env.PATIENCE ?? 6);
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
    const found = searchTurn(s, seat, { strength: STRENGTH, depth: DEPTH, rank: true });
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
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds } });
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
    const a = (seat === subject ? policyMove(policy, s, seat) : chooseBotAction(s, seat, { strength: STRENGTH, depth: DEPTH })) ?? fallbackAction(s, seat);
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

/* ================================ main ============================= */

if (!isMainThread) {
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
    else if (what === 'check') {
      const text = readFileSync(resolve('src/game/policy-weights.ts'), 'utf8').match(/'([A-Za-z0-9+/=]+)'/)?.[1];
      if (!text) throw new Error('no policy trained yet: fit first');
      check(unpack(text));
    } else if (what === 'loop') {
      for (let k = 1; k <= ITERATIONS; k++) {
        log(`--- iteration ${k} of ${ITERATIONS}`);
        await play(tag());
        const policy = fit(loadSamples(), 11 + k);
        writePolicy(policy);
        check(policy);
      }
    } else throw new Error(`unknown command ${what}`);
  };
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
