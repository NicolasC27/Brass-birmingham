import { Particle, ParticleContainer, Texture } from 'pixi.js';
import { BLEED_X, BLEED_Y, WORLD_H, WORLD_W } from '@/components/game/boardView';

/* ------------------------------------------------------------------ */
/* The snow over a frozen ground: flakes and streaks of blown snow      */
/* crossing the table from the upper left, as the wind the ear hears    */
/* (sfx.ts) would carry them, denser as the evening comes on, and now   */
/* and then a gust that drives them. One particle sheet, in world       */
/* units, wrapped round the painted table; nothing of it under reduced  */
/* motion but a few flakes standing still.                              */
/* ------------------------------------------------------------------ */

/** flakes on the sheet */
export const FLAKES = 420;
/** of them, long streaks of blown snow rather than flakes */
const STREAKS = 90;
/** the wind, world units a second, from the upper left */
const WIND_X = 150;
const WIND_Y = 58;
/** the flakes' own fall, over the wind */
const FALL = 22;

export interface Snow {
  layer: ParticleContainer;
  /** `dusk` 0 (day) to 1 (night); `k` the camera's zoom (1 = the whole table) */
  tick(t: number, dt: number, k: number, dusk: number): void;
}

/** a soft dot: white at the heart, nothing at the rim */
function flakeTexture(size = 16): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(236,244,255,0.75)');
  g.addColorStop(1, 'rgba(220,232,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

const hash = (i: number): number => (((i + 1) * 2654435761) >>> 0) % 10007 / 10007;

/** how hard the wind blows at `t`: a slow swell with a sharper gust riding
 *  on it, 0.6 in a lull to about 1.8 in a gust */
export function gust(t: number): number {
  const slow = 0.5 + 0.5 * Math.sin(t * 0.11 + 0.7);
  const sharp = Math.max(0, Math.sin(t * 0.37) + Math.sin(t * 0.19) - 1.2);
  return 0.6 + 0.6 * slow + 0.6 * sharp;
}

/** how much of the snow is seen as the evening comes: a third by day,
 *  all of it by night */
export const snowDensity = (dusk: number): number => 0.34 + 0.66 * Math.min(1, Math.max(0, dusk));

export function buildSnow(reduced: boolean): Snow {
  const tex = flakeTexture();
  const layer = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, rotation: false, color: true, uvs: false } });
  layer.eventMode = 'none';
  /* the sheet runs a bleed past the world on every side, so a flake
     carried off one edge comes back in at the other unseen */
  const X0 = -BLEED_X;
  const Y0 = -BLEED_Y;
  const SW = WORLD_W + 2 * BLEED_X;
  const SH = WORLD_H + 2 * BLEED_Y;
  const angle = Math.atan2(WIND_Y, WIND_X);
  interface Flake {
    p: Particle;
    x: number;
    y: number;
    /** its size, world units, and how fast it goes against the others */
    size: number;
    pace: number;
    /** its sway, and its own alpha */
    ph: number;
    a: number;
    streak: boolean;
  }
  const flakes: Flake[] = [];
  for (let i = 0; i < FLAKES; i++) {
    const streak = i < STREAKS;
    const size = streak ? 4 + hash(i * 7) * 4 : 6 + hash(i * 7) * 9;
    const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0, scaleX: 0, scaleY: 0, rotation: angle });
    layer.addParticle(p);
    flakes.push({ p, x: X0 + hash(i * 3) * SW, y: Y0 + hash(i * 5) * SH, size, pace: 0.7 + hash(i * 11) * 0.6, ph: hash(i * 13) * Math.PI * 2, a: (streak ? 0.3 : 0.45) + hash(i * 17) * 0.35, streak });
  }
  const unit = tex.width;
  let laid = false;
  return {
    layer,
    tick(t, dt, k, dusk) {
      const density = snowDensity(dusk);
      /* under reduced motion a few flakes stand on the table, no more */
      if (reduced) {
        if (laid) return;
        laid = true;
        flakes.forEach((f, i) => {
          const on = i % 6 === 0 && !f.streak;
          f.p.x = f.x;
          f.p.y = f.y;
          f.p.scaleX = f.p.scaleY = on ? f.size / unit : 0;
          f.p.alpha = on ? f.a * 0.6 : 0;
        });
        return;
      }
      const g = gust(t);
      const shown = Math.floor(FLAKES * density);
      /* the camera close: the flakes read at their own size, not blown up
         with the table */
      const closeness = Math.min(1, 1 / Math.max(1, k * 0.6));
      for (let i = 0; i < FLAKES; i++) {
        const f = flakes[i];
        const on = i < shown || (f.streak && g > 1.2);
        if (!on) {
          if (f.p.alpha !== 0) {
            f.p.alpha = 0;
            f.p.scaleX = f.p.scaleY = 0;
          }
          continue;
        }
        const drive = g * f.pace;
        f.x += (WIND_X * drive + Math.sin(t * 1.3 + f.ph) * 12) * dt;
        f.y += (WIND_Y * drive + FALL * f.pace + Math.cos(t * 0.9 + f.ph) * 8) * dt;
        if (f.x > X0 + SW) f.x -= SW;
        if (f.y > Y0 + SH) f.y -= SH;
        if (f.x < X0) f.x += SW;
        if (f.y < Y0) f.y += SH;
        f.p.x = f.x;
        f.p.y = f.y;
        const s = (f.size * closeness) / unit;
        if (f.streak) {
          /* a streak stretches with the gust and thins as it does */
          f.p.scaleX = s * (2.5 + 4 * g);
          f.p.scaleY = s * 0.5;
          f.p.alpha = f.a * Math.min(1, 0.35 + 0.5 * (g - 0.6));
        } else {
          f.p.scaleX = f.p.scaleY = s;
          f.p.alpha = f.a * (0.75 + 0.25 * Math.sin(t * 2.1 + f.ph));
        }
      }
    },
  };
}
