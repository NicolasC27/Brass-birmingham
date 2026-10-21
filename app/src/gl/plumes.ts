import { Container, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { TOWNS } from '@/game/data';
import type { GameState, IndustryType } from '@/game/types';
import { TILE_HALF, displayPosFor, townChrome } from '@/components/game/townChrome';
import { duskLevel, duskTint, plumeFor } from './living';
import type { Plume } from './living';

/* ------------------------------------------------------------------ */
/* plumes.ts — what the works breathe and how the light goes. Four     */
/* particle sheets drawn from one pool each, sized once and never      */
/* grown. Under the cards: the lamplit ground of a town at dusk. Over  */
/* the towns (their painted houses) and under their names: the columns */
/* of smoke, normal blend so soot reads dark on the plaster, rising    */
/* off the top edge of the cards so they never cross one, and the      */
/* first breath of a works just built; then the lamps (a furnace's     */
/* mouth, a kiln's crown, lit windows, the flare of a tile turned).    */
/* Every puff is a pure function of the clock: nothing is spawned,     */
/* nothing is freed, the ticker only writes numbers.                   */
/* ------------------------------------------------------------------ */

/** puffs the columns share, over the towns */
export const SMOKE_POOL = 380;
/** the lamplit ground of the towns at dusk, under the cards */
export const GLOW_POOL = 40;
/** lamps over the towns: furnace mouths and kiln crowns, windows, and the
 *  flares' flashes and sparks */
export const LAMP_POOL = 300;

/** build puffs in flight at once, and the puffs each squeezes out */
const STRIKES = 6;
const STRIKE_PUFFS = 8;
const STRIKE_S = 1.1;
/** flares in flight at once: a flash and its sparks */
const FLARES = 6;
const FLARE_SPARKS = 6;
const FLARE_S = 1.3;
/** a town's lit windows, at most */
const WINDOWS = 5;

/** the atlas' frames are this many pixels square */
const FRAME = 64;
/** the breeze bends every column the same way: east, a touch north */
const WIND = 0.55;

/** a soft painterly puff (three variants) and a round glow, on one sheet so
 *  every particle shares one texture source */
function atlas(): { puffs: Texture[]; glow: Texture } {
  const c = document.createElement('canvas');
  c.width = FRAME * 4;
  c.height = FRAME;
  const ctx = c.getContext('2d')!;
  /* a seeded scatter: the sheet is the same on every load */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let v = 0; v < 3; v++) {
    const ox = v * FRAME;
    /* a cloud is a few soft lobes crowded together, denser at the heart */
    for (let k = 0; k < 9; k++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * FRAME * 0.14;
      const x = ox + FRAME / 2 + Math.cos(a) * d;
      const y = FRAME / 2 + Math.sin(a) * d;
      /* every lobe stays inside its frame: no edge is ever cut */
      const r = FRAME * (0.22 + rnd() * 0.12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.62)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, 0, FRAME, FRAME);
    }
    /* a little tooth, the way a brush drags over the paper */
    const img = ctx.getImageData(ox, 0, FRAME, FRAME);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.round(img.data[i] * (0.8 + rnd() * 0.2));
    ctx.putImageData(img, ox, 0);
  }
  const gx = FRAME * 3 + FRAME / 2;
  const g = ctx.createRadialGradient(gx, FRAME / 2, 0, gx, FRAME / 2, FRAME / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(FRAME * 3, 0, FRAME, FRAME);
  const src = Texture.from(c).source;
  const frame = (i: number) => new Texture({ source: src, frame: new Rectangle(i * FRAME, 0, FRAME, FRAME) });
  return { puffs: [frame(0), frame(1), frame(2)], glow: frame(3) };
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};
/** a stable number in [0, 1) from a seed and an index */
const unit = (seed: number, i: number): number => (((seed ^ Math.imul(i + 1, 2654435761)) >>> 0) % 10007) / 10007;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Emitter {
  x: number;
  y: number;
  plume: Plume;
  /** the emitter's puffs are smoke[first .. first + n) */
  first: number;
  n: number;
  seed: number;
  /** its glow in the low sheet, or -1 */
  glow: number;
}

interface Town {
  x: number;
  y: number;
  /** the lit ground, in the low sheet */
  pool: number;
  poolSize: number;
  tiles: number;
  /** its windows are lamps[first .. first + n) */
  first: number;
  n: number;
  seed: number;
}

interface Burst {
  x: number;
  y: number;
  t0: number;
}

export interface Plumes {
  /** under the towns: smoke, build puffs, furnace and kiln glows, lit ground */
  low: Container;
  /** over the towns, under the names: lit windows and flares */
  high: Container;
  /** read the table again (called when the game changes, not every frame) */
  sync(game: GameState, busy: boolean): void;
  /** a works struck at `key`: its first breath at clock time `at` */
  strike(key: string, industry: IndustryType, at: number): void;
  /** a tile turned over at `key`: a warm flash and a few sparks */
  flare(key: string, at: number): void;
  /** `k` is the camera's zoom (1 = the whole table); `smoke` false keeps the
   *  columns still (traffic off, or motion reduced) */
  tick(t: number, dt: number, k: number, smoke: boolean): void;
  /** the dusk laid on the ground or held off it (a game read at night) */
  showDusk(on: boolean): void;
}

/** where a slot's card sits on the table */
function slotAt(key: string): [number, number] | null {
  const [townId, si] = key.split(':');
  const town = TOWNS.find((t) => t.id === townId);
  const sp = town?.slots[Number(si)];
  return sp ? displayPosFor(sp.x, sp.y) : null;
}

/** `ground` is the table's painted ground: the dusk tints it, and nothing
 *  else, at no cost to the frame (no sheet is laid over it) */
export function buildPlumes(reduced: boolean, ground: Container): Plumes {
  const { puffs, glow } = atlas();
  const low = new Container();
  const high = new Container();
  for (const c of [low, high]) c.eventMode = 'none';

  /* ---------------------------- the sheets --------------------------- */
  const sheet = (n: number, tex: (i: number) => Texture): { pc: ParticleContainer; ps: Particle[] } => {
    const pc = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, rotation: true, color: true, uvs: false } });
    const ps: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const p = new Particle({ texture: tex(i), anchorX: 0.5, anchorY: 0.5, alpha: 0, scaleX: 0, scaleY: 0 });
      ps.push(p);
      pc.addParticle(p);
    }
    return { pc, ps };
  };
  const smoke = sheet(SMOKE_POOL, (i) => puffs[i % 3]);
  const dust = sheet(STRIKES * STRIKE_PUFFS, (i) => puffs[i % 3]);
  const glows = sheet(GLOW_POOL, () => glow);
  const lamps = sheet(LAMP_POOL, () => glow);
  glows.pc.blendMode = 'add';
  lamps.pc.blendMode = 'add';
  low.addChild(glows.pc);
  high.addChild(smoke.pc, dust.pc, lamps.pc);

  /* the flares' reserve sits at the end of the lamps */
  const FLARE_FIRST = LAMP_POOL - FLARES * (1 + FLARE_SPARKS);
  const strikes: Burst[] = Array.from({ length: STRIKES }, () => ({ x: 0, y: 0, t0: -99 }));
  const flares: Burst[] = Array.from({ length: FLARES }, () => ({ x: 0, y: 0, t0: -99 }));
  let nextStrike = 0;
  let nextFlare = 0;
  /* the flares keep their gold */
  for (let s = 0; s < FLARES; s++) for (let i = 0; i <= FLARE_SPARKS; i++) lamps.ps[FLARE_FIRST + s * (1 + FLARE_SPARKS) + i].tint = i === 0 ? 0xffcf7a : 0xffe2a6;

  let emitters: Emitter[] = [];
  let towns: Town[] = [];
  let usedSmoke = 0;
  let usedGlow = 0;
  let usedLamp = 0;
  let key = '';
  let duskTarget = 0;
  let dusk = 0;
  let smokeWas = true;
  let duskShown = true;
  /** the tint last laid on the ground (-1: none yet) */
  let tinted = -1;

  const hide = (p: Particle) => {
    p.alpha = 0;
    p.scaleX = p.scaleY = 0;
  };

  const sync = (game: GameState, busy: boolean): void => {
    duskTarget = duskLevel(game);
    /* a table first seen is shown in its own light at once */
    if (reduced || !key) dusk = duskTarget;
    /* the works and the towns only change with a card laid, flipped or
       swept: the rest of the time nothing below runs */
    let k = busy ? 'b' : 'l';
    for (const id in game.tiles) k += `|${id}${game.tiles[id].industry[0]}${game.tiles[id].flipped ? 1 : 0}`;
    if (k === key) return;
    key = k;
    const list: { x: number; y: number; plume: Plume; seed: number }[] = [];
    const perTown = new Map<string, { xs: number; ys: number; n: number }>();
    for (const id in game.tiles) {
      const tile = game.tiles[id];
      const at = slotAt(id);
      const town = id.split(':')[0];
      const def = TOWNS.find((t) => t.id === town);
      if (!at || !def) continue;
      const seed = hash(id);
      /* the chimney stands at the top edge of the town's cards, over its
         own column (a card of the lower row a little aside), so the smoke
         climbs off the block and never crosses a card */
      let top = Infinity;
      for (const sl of townChrome(def).slots) top = Math.min(top, sl.y);
      const lower = at[1] > top + 1;
      list.push({ x: at[0] + (unit(seed, 0) - 0.5) * TILE_HALF * 0.5 + (lower ? TILE_HALF * 0.45 : 0), y: top - TILE_HALF - 4, plume: plumeFor(tile.industry, tile.flipped), seed });
      const tw = perTown.get(town) ?? { xs: 0, ys: 0, n: 0 };
      tw.xs += at[0];
      tw.ys += at[1];
      tw.n += 1;
      perTown.set(town, tw);
    }
    /* the columns share the sheet: a busy table breathes a little more,
       a crowded one gives each works fewer puffs rather than more sprites */
    const want = list.map((e) => Math.round(e.plume.count * (busy ? 1.3 : 1)));
    const room = SMOKE_POOL;
    const total = want.reduce((a, b) => a + b, 0);
    const fit = total > room ? room / total : 1;
    for (let i = 0; i < usedSmoke; i++) hide(smoke.ps[i]);
    for (let i = 0; i < usedGlow; i++) hide(glows.ps[i]);
    for (let i = 0; i < usedLamp; i++) hide(lamps.ps[i]);
    usedSmoke = 0;
    usedGlow = 0;
    usedLamp = 0;
    emitters = [];
    list.forEach((e, i) => {
      const n = Math.min(Math.max(2, Math.floor(want[i] * fit)), room - usedSmoke);
      if (n <= 0) return;
      const g = e.plume.glow !== null && usedLamp < FLARE_FIRST ? usedLamp++ : -1;
      if (g >= 0) {
        const p = lamps.ps[g];
        p.tint = e.plume.glow!;
        p.x = e.x;
        p.y = e.y - 5;
      }
      for (let i = 0; i < n; i++) smoke.ps[usedSmoke + i].tint = e.plume.tint;
      emitters.push({ ...e, first: usedSmoke, n, glow: g });
      usedSmoke += n;
    });
    towns = [];
    for (const [id, tw] of perTown) {
      const def = TOWNS.find((t) => t.id === id);
      if (!def || usedGlow >= GLOW_POOL) continue;
      const c = townChrome(def);
      const seed = hash(id);
      const n = Math.min(WINDOWS, 1 + tw.n, FLARE_FIRST - usedLamp);
      const town: Town = { x: tw.xs / tw.n, y: tw.ys / tw.n, pool: usedGlow++, poolSize: Math.max(c.blockW, c.blockH) * 2.4, tiles: tw.n, first: usedLamp, n: Math.max(0, n), seed };
      const pool = glows.ps[town.pool];
      pool.tint = 0xffb45a;
      pool.x = town.x;
      pool.y = town.y;
      /* the windows: lamps lit in the houses standing beside the cards,
         never on a card nor on the name, each at its own hour of the
         evening */
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const sl of c.slots) {
        x0 = Math.min(x0, sl.x - TILE_HALF);
        x1 = Math.max(x1, sl.x + TILE_HALF);
        y0 = Math.min(y0, sl.y - TILE_HALF);
        y1 = Math.max(y1, sl.y + TILE_HALF);
      }
      let placed = 0;
      for (let k2 = 0; placed < town.n && k2 < 24; k2++) {
        const right = unit(seed, k2 * 3 + 1) < 0.5;
        const out = 5 + unit(seed, k2 * 3 + 2) * 22;
        const x = right ? x1 + out : x0 - out;
        const y = y0 + 12 + unit(seed, k2 * 3 + 3) * (y1 - y0 - 14);
        if (Math.abs(x - c.ribbonCx) < c.ribbonW / 2 + 8 && Math.abs(y - c.ribbonCy) < 18) continue;
        const p = lamps.ps[town.first + placed];
        p.x = x;
        p.y = y;
        p.tint = unit(seed, k2 + 90) < 0.5 ? 0xffc86a : 0xffd98e;
        placed++;
      }
      town.n = placed;
      usedLamp += placed;
      towns.push(town);
    }
  };

  const strike = (k: string, industry: IndustryType, at: number): void => {
    if (reduced) return;
    const pos = slotAt(k);
    if (!pos) return;
    const s = nextStrike;
    nextStrike = (nextStrike + 1) % STRIKES;
    const b = strikes[s];
    b.x = pos[0];
    b.y = pos[1] - TILE_HALF - 2;
    b.t0 = at;
    /* the breath is the works' own: soot, steam or haze */
    const tint = plumeFor(industry, false).tint;
    for (let i = 0; i < STRIKE_PUFFS; i++) dust.ps[s * STRIKE_PUFFS + i].tint = tint;
  };
  const flare = (k: string, at: number): void => {
    if (reduced) return;
    const pos = slotAt(k);
    if (!pos) return;
    const b = flares[nextFlare];
    nextFlare = (nextFlare + 1) % FLARES;
    b.x = pos[0];
    b.y = pos[1];
    b.t0 = at;
  };

  const tick = (t: number, dt: number, k: number, smokeOn: boolean): void => {
    /* the light goes (or comes back) over a few seconds */
    dusk += (duskTarget - dusk) * Math.min(1, dt / 3);
    if (Math.abs(duskTarget - dusk) < 0.002) dusk = duskTarget;
    const tint = duskShown ? duskTint(dusk) : 0xffffff;
    if (tint !== tinted) {
      tinted = tint;
      ground.tint = tint;
    }

    /* the zoom: from far, half the puffs and fainter; close in, all of them */
    const near = clamp01((k - 1.1) / 0.7);
    const far = 0.7 + 0.3 * clamp01((k - 0.9) / 1.1);
    const still = reduced || !smokeOn;
    if (still) {
      if (smokeWas) for (let i = 0; i < usedSmoke; i++) hide(smoke.ps[i]);
    } else {
      for (const e of emitters) {
        const pl = e.plume;
        const L = pl.life;
        for (let i = 0; i < e.n; i++) {
          const p = smoke.ps[e.first + i];
          const lod = i % 2 === 0 ? 1 : near;
          if (lod <= 0) {
            p.alpha = 0;
            continue;
          }
          const clock = t + (i / e.n) * L + unit(e.seed, i) * (L / e.n) * 0.4;
          const cyc = Math.floor(clock / L);
          const q = (clock - cyc * L) / L;
          /* each trip of a puff leaves the chimney a hair off the last */
          const j = unit(e.seed + cyc, i) - 0.5;
          const rise = pl.rise * (1 - Math.pow(1 - q, 1.25));
          const bend = pl.rise * WIND * Math.pow(q, 1.4);
          const sway = Math.sin(t * 0.55 + e.seed + i * 2.1) * 5 * q;
          p.x = e.x + j * 5 + bend + sway;
          p.y = e.y - rise;
          const size = pl.size0 + (pl.size1 - pl.size0) * Math.pow(q, 0.8);
          p.scaleX = p.scaleY = size / FRAME;
          p.rotation = (e.seed % 7) + i * 1.7 + q * 0.9;
          /* shows itself at once, thins slowly, gone at the top */
          const env = q < 0.1 ? q / 0.1 : Math.pow(1 - (q - 0.1) / 0.9, 0.85);
          p.alpha = pl.alpha * env * lod * far;
        }
      }
    }
    smokeWas = !still;

    /* the glows: a furnace breathes, a kiln's crown holds; both stronger as
       the light goes */
    for (const e of emitters) {
      if (e.glow < 0) continue;
      const p = lamps.ps[e.glow];
      const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3 + (e.seed % 11));
      p.alpha = e.plume.glowAlpha * breath * (1 + dusk * 1.4);
      p.scaleX = p.scaleY = (22 + dusk * 10) / FRAME;
    }
    /* the towns at dusk: the ground round the cards lamplit, and window
       after window lit as the era closes */
    for (const tw of towns) {
      const pool = glows.ps[tw.pool];
      pool.alpha = dusk * (0.16 + 0.035 * Math.min(4, tw.tiles));
      pool.scaleX = pool.scaleY = tw.poolSize / FRAME;
      for (let i = 0; i < tw.n; i++) {
        const p = lamps.ps[tw.first + i];
        const hour = 0.08 + unit(tw.seed, i + 40) * 0.6;
        const on = clamp01((dusk - hour) / 0.12);
        if (on <= 0) {
          p.alpha = 0;
          continue;
        }
        const flicker = reduced ? 1 : 0.86 + 0.14 * Math.sin(t * (1.7 + (i % 3) * 0.6) + tw.seed + i);
        p.alpha = on * 0.75 * flicker;
        p.scaleX = p.scaleY = (6 + unit(tw.seed, i + 70) * 3) / FRAME;
      }
    }

    /* a works' first breath: a fan of puffs thrown up off the card's top
       edge, climbing and spreading, gone in a second */
    for (let s = 0; s < STRIKES; s++) {
      const b = strikes[s];
      const age = t - b.t0;
      const live = age >= 0 && age < STRIKE_S;
      for (let i = 0; i < STRIKE_PUFFS; i++) {
        const p = dust.ps[s * STRIKE_PUFFS + i];
        if (!live) {
          if (p.alpha !== 0) hide(p);
          continue;
        }
        const q = age / STRIKE_S;
        /* a fan from ten to two o'clock over the card */
        const a = -Math.PI * (0.2 + (0.6 * i) / (STRIKE_PUFFS - 1));
        const out = 6 + 34 * (1 - Math.pow(1 - q, 2.4));
        p.x = b.x + Math.cos(a) * (TILE_HALF * 0.55 + out) + WIND * 14 * q;
        p.y = b.y + Math.sin(a) * out * 0.8 - 18 * q;
        p.scaleX = p.scaleY = (18 + 36 * Math.sqrt(q)) / FRAME;
        p.rotation = i + q;
        p.alpha = 0.7 * Math.pow(1 - q, 1.3) * clamp01(age / 0.05);
      }
    }
    /* flares: a warm flash on the card turned, sparks climbing off it */
    for (let s = 0; s < FLARES; s++) {
      const b = flares[s];
      const age = t - b.t0;
      const live = age >= 0 && age < FLARE_S;
      const base = FLARE_FIRST + s * (1 + FLARE_SPARKS);
      for (let i = 0; i <= FLARE_SPARKS; i++) {
        const p = lamps.ps[base + i];
        if (!live) {
          if (p.alpha !== 0) hide(p);
          continue;
        }
        const q = age / FLARE_S;
        if (i === 0) {
          p.x = b.x;
          p.y = b.y;
          p.scaleX = p.scaleY = (TILE_HALF * 3.4 * (0.75 + 0.45 * q)) / FRAME;
          p.alpha = 0.8 * Math.pow(1 - q, 1.8) * clamp01(age / 0.06);
          continue;
        }
        const sq = clamp01(q * 1.1);
        const lane = (unit(s * 13 + 5, i) - 0.5) * TILE_HALF * 1.6;
        p.x = b.x + lane + Math.sin(age * 6 + i) * 3 + sq * 10;
        p.y = b.y - TILE_HALF * 0.6 - sq * (34 + unit(s, i) * 22);
        p.scaleX = p.scaleY = (10 - 5 * sq) / FRAME;
        p.alpha = Math.pow(1 - sq, 0.7) * clamp01(age / 0.1);
      }
    }
  };

  const showDusk = (on: boolean): void => {
    duskShown = on;
  };

  return { low, high, sync, strike, flare, tick, showDusk };
}
