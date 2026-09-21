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

import { INDUSTRIES, LINKS, MARKET_MAX, MERCHANTS, MERCHANT_BY_ID, TOWN_BY_ID, incomeLevel, marketSellPrice } from './data';
import { merchantDemand, merchantOpen, networkTowns, projectEraScores, reachable } from './engine';
import { NET_B64 } from './net-weights';
import type { GameState, IndustryType } from './types';

const INDUSTRY_ORDER: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery'];

/** a seat's block of features */
const SEAT_FEATURES = 52;
const GLOBAL_FEATURES = 10;
/** own seat, the leading rival, the rivals on average, then the table */
export const FEATURES = SEAT_FEATURES * 3 + GLOBAL_FEATURES;
/** where the era flag sits, counted back from the end of the features */
export const GLOBAL_ERA = GLOBAL_FEATURES;

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
  for (const [k, ind] of INDUSTRY_ORDER.entries()) {
    const next = p.stacks[ind][0];
    const vp = next ? INDUSTRIES[ind][next - 1].vp : 0;
    stack += vp;
    /* the next tile of each industry, what it would score */
    out[at + 29 + k] = vp / 12;
  }
  out[at + 28] = stack / 40;
  /* around one's links: icons already there and empty slots that may yet bring some */
  let icons = 0;
  let room = 0;
  for (const [id, l] of Object.entries(s.links)) {
    if (l.owner !== j) continue;
    const def = LINKS.find((d) => d.id === id);
    if (!def) continue;
    for (const end of [def.a, def.b]) {
      if (MERCHANT_BY_ID[end]) {
        icons += 2;
        continue;
      }
      const town = TOWN_BY_ID[end];
      if (!town) continue;
      let built = 0;
      for (const [key, t] of Object.entries(s.tiles)) {
        if (key.split(':')[0] !== end) continue;
        built += 1;
        icons += INDUSTRIES[t.industry][t.level - 1].links;
      }
      room += Math.max(0, town.slots.length - built);
    }
  }
  out[at + 35] = icons / 20;
  out[at + 36] = room / 10;
  /* goods that could sell right now: a buyer connected and beer somewhere for it */
  const beerAround = beer > 0 || Object.values(s.merchantBeer).some((b) => b > 0) || Object.values(s.tiles).some((x) => x.industry === 'brewery' && !x.flipped && x.cubes > 0);
  out[at + 37] = beerAround ? served / 3 : 0;
  /* the level of the next tile of each industry, and the tiles on the board that will outlive the canals */
  let lasting = 0;
  for (const [k, ind] of INDUSTRY_ORDER.entries()) out[at + 38 + k] = (p.stacks[ind][0] ?? 0) / 4;
  for (const t of Object.values(s.tiles)) if (t.owner === j && t.level >= 2) lasting += 1;
  out[at + 44] = lasting / 6;
  /* room to build in one's network: empty slots for goods, coal, iron and beer */
  let goodsRoom = 0;
  let coalRoom = 0;
  let ironRoom = 0;
  let beerRoom = 0;
  for (const town of towns) {
    const def = TOWN_BY_ID[town];
    if (!def) continue;
    for (const [k, slot] of def.slots.entries()) {
      if (s.tiles[`${town}:${k}`]) continue;
      if (slot.allows.some((ind) => ind === 'cotton' || ind === 'manufacturer' || ind === 'pottery')) goodsRoom += 1;
      if (slot.allows.includes('coal')) coalRoom += 1;
      if (slot.allows.includes('iron')) ironRoom += 1;
      if (slot.allows.includes('brewery')) beerRoom += 1;
    }
  }
  out[at + 45] = goodsRoom / 8;
  out[at + 46] = coalRoom / 4;
  out[at + 47] = ironRoom / 3;
  out[at + 48] = beerRoom / 4;
  /* buyers on one's network: merchants taking cotton, goods and pottery */
  const seen = new Set<string>();
  for (const town of towns) for (const n of reachable(s, town, s.era, null)) if (MERCHANT_BY_ID[n] && merchantOpen(s, n)) seen.add(n);
  let cottonBuyers = 0;
  let goodsBuyers = 0;
  let potteryBuyers = 0;
  for (const m of seen) {
    const demand = merchantDemand(s, m);
    if (demand.includes('cotton')) cottonBuyers += 1;
    if (demand.includes('manufacturer')) goodsBuyers += 1;
    if (demand.includes('pottery')) potteryBuyers += 1;
  }
  out[at + 49] = cottonBuyers / 3;
  out[at + 50] = goodsBuyers / 3;
  out[at + 51] = potteryBuyers / 3;
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
  /* the table's beer on the merchants, and what the market pays for coal and iron now */
  out[g + 7] = Object.values(s.merchantBeer).reduce((a, b) => a + b, 0) / 6;
  out[g + 8] = marketSellPrice('coal', s.market.coal) / 7;
  out[g + 9] = marketSellPrice('iron', s.market.iron) / 5;
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

/** several networks trained on the same positions from different starts:
 *  their mean is steadier than any one of them */
export interface Brain {
  nets: Net[];
}

/** the brain's answer: the mean of its networks' */
export function think(brain: Brain, x: Float32Array): number {
  let sum = 0;
  for (const net of brain.nets) sum += forward(net, x);
  return sum / brain.nets.length;
}

/** the network's answer: points ahead (positive) or behind at the era's scoring */
export function forward(net: Net, x: Float32Array): number {
  return forwardAll(net, x)[0] * net.points;
}

/** the whole of the last layer, raw: one number for a network that reads the
 *  table, one per move for a network that ranks them */
export function forwardAll(net: Net, x: Float32Array): Float32Array {
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
  return cur;
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
/** a brain as one string: its networks packed, joined by a bar */
export const packBrain = (brain: Brain): string => brain.nets.map(pack).join('|');
export const unpackBrain = (text: string): Brain => ({ nets: text.split('|').filter(Boolean).map(unpack) });

/** a brain is only as good as the features it was trained on: one packed
 *  for another set of features is left aside rather than misread */
function fitting(brain: Brain | null): Brain | null {
  if (brain && brain.nets.some((net) => net.sizes[0] !== FEATURES)) {
    console.warn(`a brain for ${brain.nets[0].sizes[0]} features cannot read ${FEATURES}: reading by hand`);
    return null;
  }
  return brain && brain.nets.length ? brain : null;
}
let active: Brain | null = fitting(NET_B64 ? unpackBrain(NET_B64) : null);
export const activeNet = (): Brain | null => active;
export function loadNet(text: string | null): void {
  active = fitting(text ? unpackBrain(text) : null);
}
/** an already unpacked brain takes over (an arena seating two of them) */
export function setNet(brain: Brain | null): void {
  active = brain;
}
