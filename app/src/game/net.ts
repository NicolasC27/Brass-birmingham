/* ------------------------------------------------------------------ */
/* BLACKRAIL — the learned reading of the board.                       */
/*                                                                     */
/* A small network, trained by tools/bots/learn.ts on positions the    */
/* machines reach playing each other, says how far ahead a seat will   */
/* be when the era is scored: the Canal Era's points while it lasts,   */
/* the game's once the rails are laid. The search reads the board      */
/* through it alongside the hand-written evaluation.                   */
/*                                                                     */
/* Everything here runs in the browser and in Node alike: the features */
/* are plain numbers drawn from the state, the network a few dense     */
/* layers with tanh, its weights a base64 string in net-weights.ts.    */
/* ------------------------------------------------------------------ */

import { INDUSTRIES, MARKET_MAX, MERCHANTS, MERCHANT_BY_ID, incomeLevel } from './data';
import { merchantDemand, merchantOpen, networkTowns, projectEraScores, reachable } from './engine';
import { NET_B64 } from './net-weights';
import type { GameState, IndustryType } from './types';

const INDUSTRY_ORDER: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];

/** a seat's block of features */
const SEAT_FEATURES = 29;
const GLOBAL_FEATURES = 7;
/** own seat, the leading rival, the rivals on average, then the table */
export const FEATURES = SEAT_FEATURES * 3 + GLOBAL_FEATURES;

/** rounds per era, as the engine deals them */
const ROUNDS: Record<2 | 3 | 4, number> = { 2: 10, 3: 9, 4: 8 };

function seatBlock(s: GameState, j: number, proj: ReturnType<typeof projectEraScores>, out: Float32Array, at: number): void {
  const p = s.players[j];
  const towns = networkTowns(s, j);
  let market = 0;
  for (const n of towns) {
    if ([...reachable(s, n, s.era, null)].some((x) => merchantOpen(s, x))) {
      market = 1;
      break;
    }
  }
  out[at + 0] = p.vp / 50;
  out[at + 1] = p.money / 40;
  out[at + 2] = incomeLevel(p.income) / 30;
  out[at + 3] = p.loans / 3;
  out[at + 4] = proj[j].links / 20;
  out[at + 5] = proj[j].tiles / 40;
  out[at + 6] = proj[j].pending / 40;
  out[at + 7] = towns.size / 15;
  out[at + 8] = market;
  out[at + 9] = p.hand.length / 8;
  let coal = 0;
  let iron = 0;
  let beer = 0;
  let served = 0;
  let nearly = 0;
  let links = 0;
  for (const [key, t] of Object.entries(s.tiles)) {
    if (t.owner !== j) continue;
    const k = INDUSTRY_ORDER.indexOf(t.industry);
    if (t.flipped) out[at + 10 + k] += 1 / 3;
    else {
      out[at + 16 + k] += 1 / 3;
      if (t.industry === 'coal') coal += t.cubes;
      else if (t.industry === 'iron') iron += t.cubes;
      else if (t.industry === 'brewery') beer += t.cubes;
      else {
        const town = key.split(':')[0];
        const reach = reachable(s, town, s.era, null);
        if (MERCHANTS.some((m) => merchantOpen(s, m.id) && reach.has(m.id) && merchantDemand(s, m.id).includes(t.industry))) served += 1;
        else if (MERCHANTS.some((m) => merchantOpen(s, m.id) && merchantDemand(s, m.id).includes(t.industry) && [...reach].some((n) => !MERCHANT_BY_ID[n]))) nearly += 1;
      }
    }
  }
  for (const l of Object.values(s.links)) if (l.owner === j) links += 1;
  out[at + 22] = coal / 8;
  out[at + 23] = iron / 8;
  out[at + 24] = beer / 4;
  out[at + 25] = served / 3;
  out[at + 26] = nearly / 3;
  out[at + 27] = links / 8;
  let stack = 0;
  for (const ind of INDUSTRY_ORDER) {
    const next = p.stacks[ind][0];
    if (next) stack += INDUSTRIES[ind][next - 1].vp;
  }
  out[at + 28] = stack / 40;
}

/** the table as seat `i` sees it, in numbers the network was trained on */
export function features(s: GameState, i: number): Float32Array {
  const out = new Float32Array(FEATURES);
  const proj = projectEraScores(s);
  seatBlock(s, i, proj, out, 0);
  /* the leading rival: most points on the table now */
  let lead = -1;
  let best = -Infinity;
  const rivals: number[] = [];
  for (let j = 0; j < s.players.length; j++) {
    if (j === i) continue;
    rivals.push(j);
    const v = s.players[j].vp + proj[j].total;
    if (v > best) {
      best = v;
      lead = j;
    }
  }
  if (lead >= 0) seatBlock(s, lead, proj, out, SEAT_FEATURES);
  /* the rivals on average */
  if (rivals.length) {
    const tmp = new Float32Array(FEATURES);
    for (const j of rivals) {
      tmp.fill(0);
      seatBlock(s, j, proj, tmp, 0);
      for (let k = 0; k < SEAT_FEATURES; k++) out[SEAT_FEATURES * 2 + k] += tmp[k] / rivals.length;
    }
  }
  const per = ROUNDS[Math.min(4, Math.max(2, s.players.length)) as 2 | 3 | 4];
  const railToCome = s.era === 'canal' && s.eraLength === 'standard' ? per : 0;
  const g = SEAT_FEATURES * 3;
  out[g + 0] = s.era === 'rail' ? 1 : 0;
  out[g + 1] = Math.max(0, per - s.round + railToCome) / (s.eraLength === 'standard' ? per * 2 : per);
  out[g + 2] = s.round / 10;
  out[g + 3] = s.players.length / 4;
  out[g + 4] = s.market.coal / MARKET_MAX.coal;
  out[g + 5] = s.market.iron / MARKET_MAX.iron;
  out[g + 6] = s.deck.length / 60;
  return out;
}

/* ============================= the net ============================= */

export interface Net {
  /** layer sizes: features, hidden…, 1 */
  sizes: number[];
  /** per layer: weights (out × in, row-major) then biases */
  weights: Float32Array[];
  biases: Float32Array[];
  /** feature normalisation */
  mean: Float32Array;
  scale: Float32Array;
  /** what one unit of output means, in points */
  points: number;
}

/** the network's answer: points ahead (positive) or behind at the era's scoring */
export function forward(net: Net, x: Float32Array): number {
  let cur = new Float32Array(x.length);
  for (let k = 0; k < x.length; k++) cur[k] = (x[k] - net.mean[k]) / net.scale[k];
  for (let l = 0; l < net.weights.length; l++) {
    const nIn = net.sizes[l];
    const nOut = net.sizes[l + 1];
    const w = net.weights[l];
    const b = net.biases[l];
    const next = new Float32Array(nOut);
    const last = l === net.weights.length - 1;
    for (let o = 0; o < nOut; o++) {
      let sum = b[o];
      const row = o * nIn;
      for (let k = 0; k < nIn; k++) sum += w[row + k] * cur[k];
      next[o] = last ? sum : Math.tanh(sum);
    }
    cur = next;
  }
  return cur[0] * net.points;
}

/* ------------------------- packing the weights --------------------- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let k = 0; k < bytes.length; k += 3) {
    const a = bytes[k];
    const b = k + 1 < bytes.length ? bytes[k + 1] : 0;
    const c = k + 2 < bytes.length ? bytes[k + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (k + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (k + 2 < bytes.length ? B64[c & 63] : '=');
  }
  return out;
}

function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let k = 0; k + 3 < clean.length + 1; k += 4) {
    const a = B64.indexOf(clean[k]);
    const b = B64.indexOf(clean[k + 1]);
    const c = k + 2 < clean.length ? B64.indexOf(clean[k + 2]) : -1;
    const d = k + 3 < clean.length ? B64.indexOf(clean[k + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0 && o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

/** the net as one string: sizes, points, then every array in order */
export function pack(net: Net): string {
  const head = [net.sizes.length, ...net.sizes, net.points];
  const parts: Float32Array[] = [Float32Array.from(head), net.mean, net.scale];
  for (let l = 0; l < net.weights.length; l++) parts.push(net.weights[l], net.biases[l]);
  const total = parts.reduce((a, p) => a + p.length, 0);
  const all = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return toBase64(new Uint8Array(all.buffer));
}

export function unpack(text: string): Net {
  const bytes = fromBase64(text);
  const all = new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4));
  let at = 0;
  const take = (n: number): Float32Array => {
    const out = all.slice(at, at + n);
    at += n;
    return out;
  };
  const depth = all[at++];
  const sizes: number[] = [];
  for (let k = 0; k < depth; k++) sizes.push(all[at++]);
  const points = all[at++];
  const mean = take(sizes[0]);
  const scale = take(sizes[0]);
  const weights: Float32Array[] = [];
  const biases: Float32Array[] = [];
  for (let l = 0; l + 1 < sizes.length; l++) {
    weights.push(take(sizes[l] * sizes[l + 1]));
    biases.push(take(sizes[l + 1]));
  }
  return { sizes, weights, biases, mean, scale, points };
}

/** the network in force: the one shipped, until a learner loads a fresher one */
let active: Net | null = NET_B64 ? unpack(NET_B64) : null;
export const activeNet = (): Net | null => active;
export function loadNet(text: string | null): void {
  active = text ? unpack(text) : null;
}
