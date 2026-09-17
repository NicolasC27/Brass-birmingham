/* ------------------------------------------------------------------ */
/* noise — tiny dependency-free deterministic noise toolkit for the    */
/* procedural map. Everything is seeded (mulberry32); no Math.random   */
/* anywhere, so the generated terrain is bit-stable between reloads.   */
/* ------------------------------------------------------------------ */

/** clamp `v` into [lo, hi] */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** clamp `v` into [0, 1] */
export const clamp01 = (v: number): number => clamp(v, 0, 1);

/** linear interpolation from a to b */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** smooth Hermite ramp from 0 (at e0) to 1 (at e1) */
export function smoothstep(e0: number, e1: number, v: number): number {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** mulberry32 PRNG: one 32-bit seed → uniform floats in [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Noise2D = (x: number, y: number) => number;

/* simplex 2D (Gustavson's layout), gradient table shuffled by the seed */
const GRAD: readonly [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** seeded simplex noise, output roughly in [-1, 1] */
export function createSimplex2D(seed: number): Noise2D {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  /* Fisher–Yates with the seeded PRNG */
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (x: number, y: number): number => {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD[perm[ii + perm[jj]] & 7];
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    /* empirical bound: 70 keeps the output inside [-1, 1] */
    return clamp(70 * n, -1, 1);
  };
}

/** bounded fractal Brownian motion over a simplex field, output in [-1, 1] */
export function fbm2(noise: Noise2D, x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm === 0 ? 0 : sum / norm;
}
