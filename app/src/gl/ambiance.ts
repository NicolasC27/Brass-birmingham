import { Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js';
import { LINKS, MERCHANTS, PLAYER_COLORS, TOWNS } from '@/game/data';
import { useGame } from '@/game/store';
import { routeFor } from '@/components/game/routePaths';
import type { GameState } from '@/game/types';
import { displayPosFor } from '@/components/game/townChrome';

const hex = (s: string): number => parseInt(s.replace('#', ''), 16);

/* ------------------------------------------------------------------ */
/* ambiance.ts — living-board effects as GPU sprites: drifting mist,   */
/* breathing lamplight halos, chimney smoke, boats/trains on built     */
/* links, river sheen, and the canal-end rail etch reveal. All         */
/* animation runs in the ticker on transform/alpha only — the GPU way  */
/* (no CSS, no DOM, no re-raster); the few Graphics redraws are        */
/* stepped at ~4 Hz like the SVG reference.                            */
/* ------------------------------------------------------------------ */

interface Animated {
  /** advance the effect; called every ticker frame with elapsed seconds */
  tick(t: number): void;
}

/** soft radial glow texture (white — tinted per sprite) */
function glowTexture(size = 128): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.38)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

const hashId = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return h;
};

/* --------------------- arc-length polyline sampler ------------------ */
/* Precomputes cumulative lengths once so per-frame lookups (vehicles,  */
/* river dashes, etch strokes) allocate nothing.                        */

interface Sampler {
  total: number;
  /** position + angle at arc distance d; writes into `out` */
  at(d: number, out: [number, number, number]): void;
}

function makeSampler(pts: [number, number][]): Sampler {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum.push(total);
  }
  const n = pts.length - 1;
  const headAng = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  const tailAng = Math.atan2(pts[n][1] - pts[n - 1][1], pts[n][0] - pts[n - 1][0]);
  return {
    total,
    at(d, out) {
      if (d <= 0) {
        out[0] = pts[0][0];
        out[1] = pts[0][1];
        out[2] = headAng;
        return;
      }
      if (d >= total) {
        out[0] = pts[n][0];
        out[1] = pts[n][1];
        out[2] = tailAng;
        return;
      }
      let i = 1;
      while (cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1];
      const p = seg === 0 ? 0 : (d - cum[i - 1]) / seg;
      out[0] = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * p;
      out[1] = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * p;
      out[2] = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    },
  };
}

/** shared scratch tuple for sampler lookups (single-threaded ticker) */
const P: [number, number, number] = [0, 0, 0];
const Q: [number, number, number] = [0, 0, 0];
/** darken/lighten a packed colour by `f`, as a CSS hex string (for gradients) */
const shadeHex = (c: number, f: number): string => {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((c >> 16) & 0xff);
  const g = ch((c >> 8) & 0xff);
  const b = ch(c & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/** stroke the arc [d0, d1] of a sampler as one sub-stroke */
function strokeArc(g: Graphics, sam: Sampler, d0: number, d1: number, width: number, alpha: number, color: number): void {
  if (alpha <= 0 || d1 <= d0) return;
  const steps = Math.max(1, Math.ceil((d1 - d0) / 14));
  sam.at(d0, P);
  g.moveTo(P[0], P[1]);
  for (let s = 1; s <= steps; s++) {
    sam.at(d0 + ((d1 - d0) * s) / steps, P);
    g.lineTo(P[0], P[1]);
  }
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

/* ---------------------------- river sheen --------------------------- */
/* Parity with components/game/ambiance/RiverSheen.tsx: five painted    */
/* rivers get a soft wide gleam plus a thin dashed current drifting     */
/* downstream. The SVG linear gradient is approximated by chunking      */
/* each stroke along the path with alpha following the same profile     */
/* (fade-in 0–30 %, full 30–72 %, fade-out 72–100 %).                   */

interface RiverDef {
  id: string;
  /** smooth path through world coords (M + absolute C only) */
  d: string;
  w: number;
  dur: number;
}

const RIVERS: RiverDef[] = [
  {
    // the great river: top centre → winding south-east → bottom edge
    id: 'main',
    d: 'M1520,-22 C1566,135 1594,270 1614,371 C1654,529 1746,664 1880,799 C2000,911 2146,990 2214,1080 C2266,1159 2214,1226 2294,1305 C2360,1384 2494,1496 2574,1631 C2614,1699 2654,1766 2680,1822',
    w: 7,
    dur: 26,
  },
  {
    // west river: mid-north-west, meandering to the bottom-left
    id: 'west',
    d: 'M626,202 C600,371 574,540 540,720 C506,878 400,1012 294,1085 C200,1148 154,1198 166,1282 C180,1372 226,1496 266,1609',
    w: 6,
    dur: 30,
  },
  {
    // south-west brook, joining the great river near the bottom
    id: 'south',
    d: 'M826,1575 C986,1519 1146,1462 1306,1440 C1494,1418 1680,1474 1866,1462 C2026,1451 2174,1429 2280,1395',
    w: 5.5,
    dur: 24,
  },
  {
    // east river: slipping off the right edge
    id: 'east',
    d: 'M2746,630 C2814,731 2906,821 3000,900 C3080,968 3160,1024 3226,1069',
    w: 5.5,
    dur: 22,
  },
  {
    // northern tributary: feeding the great river from the north-west
    id: 'north',
    d: 'M1174,-11 C1254,101 1360,214 1466,326 C1534,405 1614,461 1680,500',
    w: 5,
    dur: 28,
  },
];

const RIVER_COLOR = 0x8fb8c4;
/** pale-water gradient profile from RiverSheen (fade in → hold → fade out) */
const riverProfile = (u: number): number => (u < 0.3 ? u / 0.3 : u <= 0.72 ? 1 : Math.max(0, 1 - (u - 0.72) / 0.28));

/** sample a river SVG path (M + absolute C commands only) into a dense polyline */
function sampleRiverPath(d: string): [number, number][] {
  const pts: [number, number][] = [];
  const cmds = d.match(/[MC][^MC]*/g) ?? [];
  let x = 0;
  let y = 0;
  for (const cmd of cmds) {
    const n = (cmd.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (cmd[0] === 'M') {
      x = n[0];
      y = n[1];
      pts.push([x, y]);
    } else {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const [x1, y1, x2, y2, x3, y3] = [n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5]];
        for (let s = 1; s <= 10; s++) {
          const u = s / 10;
          const v = 1 - u;
          pts.push([
            v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
            v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
          ]);
        }
        x = x3;
        y = y3;
      }
    }
  }
  return pts;
}

/* ------------------------- rail etch reveal ------------------------- */
/* Parity with Board.tsx bw-etchdraw: during the 'canal-end' ceremony   */
/* the unbuilt rail-only routes etch themselves in brass (#DDBE7E),     */
/* staggered by rail-only index; the normal board redraw then shows     */
/* the definitive trace — this effect is purely cosmetic.               */

const ETCH_COLOR = 0xddbe7e;
const ETCH_DUR = 1.5;
/** cubic ease-in-out, approximating the CSS animation timing */
const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export interface Ambiance {
  layer: Container;
  tick: (t: number, game: GameState | null) => void;
}

export function buildAmbiance(reduced: boolean): Ambiance {
  const layer = new Container();
  const glow = glowTexture();
  const animated: Animated[] = [];

  /* ------------------------- drifting mist -------------------------- */
  if (!reduced) {
    const MISTS = [
      { x: 0.34, y: 0.12, w: 420, dur: 34, dx: 34, dy: 12, ph: 0 },
      { x: 0.42, y: 0.44, w: 370, dur: 40, dx: -28, dy: 16, ph: 7 },
      { x: 0.36, y: 0.74, w: 390, dur: 38, dx: 24, dy: -14, ph: 14 },
    ];
    for (const m of MISTS) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.width = m.w;
      s.height = m.w * 0.4;
      s.tint = 0x9fb8a8;
      s.alpha = 0.08;
      s.blendMode = 'screen';
      const cx = m.x * 3200;
      const cy = m.y * 1800;
      layer.addChild(s);
      animated.push({
        tick: (t) => {
          const p = ((t + m.ph) % m.dur) / m.dur;
          const sway = Math.sin(p * Math.PI * 2);
          s.position.set(cx + sway * m.dx, cy + sway * m.dy);
        },
      });
    }
  }

  /* ----------------------- town lamplight halos ---------------------- */
  for (const node of [...TOWNS.map((t) => ({ id: t.id, x: t.x, y: t.y, r: 90 })), ...MERCHANTS.map((m) => ({ id: m.id, x: m.x, y: m.y, r: 70 }))]) {
    const h = hashId(node.id);
    const s = new Sprite(glow);
    s.anchor.set(0.5);
    s.position.set(node.x, node.y);
    s.width = s.height = node.r * 2;
    s.tint = 0xe8a33d;
    s.blendMode = 'screen';
    const lo = 0.28;
    const hi = 0.4;
    const dur = 4 + (h % 300) / 100;
    const ph = (h % 700) / 100;
    layer.addChild(s);
    if (reduced) {
      s.alpha = (lo + hi) / 2;
    } else {
      animated.push({
        tick: (t) => {
          const p = ((t + ph) % dur) / dur;
          s.alpha = lo + (hi - lo) * (0.5 - 0.5 * Math.cos(p * Math.PI * 2));
        },
      });
    }
  }

  /* --------------------------- river sheen --------------------------- */
  const riverLayer = new Container();
  riverLayer.blendMode = 'screen';
  interface RiverFx {
    sam: Sampler;
    w: number;
    dur: number;
    /** animated dashes (null under reduced motion → thin static current) */
    dashes: Graphics | null;
    lastStep: number;
  }
  const rivers: RiverFx[] = [];
  /* dash pattern + stepping match the SVG: dasharray 34/86 (period 120),
     dashoffset drifting 0 → −240 over dur in steps(104) (~4 Hz) */
  const DASH_ON = 34;
  const DASH_PERIOD = 120;
  const DASH_STEPS = 104;
  const CHUNKS = 26;
  for (const r of RIVERS) {
    const pts = sampleRiverPath(r.d);
    if (pts.length < 2) continue;
    const sam = makeSampler(pts);
    const du = sam.total / CHUNKS;
    /* soft gleam lifting the painted water out of the terrain (static) */
    const gleam = new Graphics();
    for (let i = 0; i < CHUNKS; i++) {
      strokeArc(gleam, sam, i * du, (i + 1) * du, r.w * 3.2, 0.09 * riverProfile((i + 0.5) / CHUNKS), RIVER_COLOR);
    }
    let dashes: Graphics | null = null;
    if (reduced) {
      /* reduced motion: thin static current instead of drifting dashes */
      const thin = new Graphics();
      for (let i = 0; i < CHUNKS; i++) {
        strokeArc(thin, sam, i * du, (i + 1) * du, r.w, 0.22 * riverProfile((i + 0.5) / CHUNKS), RIVER_COLOR);
      }
      riverLayer.addChild(gleam, thin);
    } else {
      dashes = new Graphics();
      riverLayer.addChild(gleam, dashes);
    }
    rivers.push({ sam, w: r.w, dur: r.dur, dashes, lastStep: -1 });
  }
  layer.addChild(riverLayer);

  const drawRiverDashes = (fx: RiverFx, step: number): void => {
    const g = fx.dashes;
    if (!g) return;
    g.clear();
    const off = -(((step / DASH_STEPS) * 240) % DASH_PERIOD);
    for (let s = off; s < fx.sam.total; s += DASH_PERIOD) {
      const d0 = Math.max(0, s);
      const d1 = Math.min(fx.sam.total, s + DASH_ON);
      if (d1 <= d0) continue;
      strokeArc(g, fx.sam, d0, d1, fx.w, 0.22 * riverProfile((d0 + d1) / 2 / fx.sam.total), RIVER_COLOR);
    }
  };

  /* ---------------- chimney smoke + traffic (dynamic) ---------------- */
  const smokeLayer = new Container();
  const wakeLayer = new Container(); // ripples + smoke puffs, under the hulls
  const trafficLayer = new Container();
  layer.addChild(smokeLayer, wakeLayer, trafficLayer);

  interface Wisp {
    s: Sprite;
    x: number;
    y: number;
    ph: number;
    dx: number;
  }
  let wisps: Wisp[] = [];
  interface Puff {
    s: Sprite;
    born: number;
    x: number;
    y: number;
  }
  interface Vehicle {
    c: Container;
    wake: Graphics;
    sam: Sampler;
    dur: number;
    ph: number;
    reverse: boolean;
    boat: boolean;
    puffs: Puff[];
    lastPuff: number;
    len: number;
  }
  let vehicles: Vehicle[] = [];

  /* a narrowboat seen from above, pointing +x: long dark hull, the owner's
     livery stripe, a stern cabin with a brass chimney and a bow lantern */
  const makeBoat = (col: number): Container => {
    const c = new Container();
    const g = new Graphics();
    const L = 44;
    const W = 11;
    // hull
    g.moveTo(-L / 2 + 4, -W / 2)
      .lineTo(L / 2 - 9, -W / 2)
      .quadraticCurveTo(L / 2 + 1, -W / 2 + 1, L / 2 + 3, 0)
      .quadraticCurveTo(L / 2 + 1, W / 2 - 1, L / 2 - 9, W / 2)
      .lineTo(-L / 2 + 4, W / 2)
      .quadraticCurveTo(-L / 2, W / 2, -L / 2, 0)
      .quadraticCurveTo(-L / 2, -W / 2, -L / 2 + 4, -W / 2)
      .closePath()
      .fill(0x1c1410)
      .stroke({ width: 1, color: 0x0a0705 });
    // gunwale + livery stripe along the hull
    g.rect(-L / 2 + 5, -W / 2 + 1.5, L - 14, 1.6).fill({ color: col, alpha: 0.95 });
    g.rect(-L / 2 + 5, W / 2 - 3.1, L - 14, 1.6).fill({ color: col, alpha: 0.95 });
    // cargo hold: tarpaulin in a darker shade with rope ties
    const hold = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
    hold.addColorStop(0, shadeHex(col, 0.75)).addColorStop(0.5, shadeHex(col, 0.5)).addColorStop(1, shadeHex(col, 0.32));
    g.roundRect(-L / 2 + 11, -W / 2 + 2.6, L - 26, W - 5.2, 2).fill(hold);
    for (let k = 0; k < 4; k++) g.rect(-L / 2 + 14 + k * 5.5, -W / 2 + 2.6, 0.8, W - 5.2).fill({ color: 0x0a0705, alpha: 0.35 });
    // stern cabin: owner colour, cream roof line, brass chimney
    g.roundRect(-L / 2 + 2, -W / 2 + 1.8, 9, W - 3.6, 1.5).fill(col).stroke({ width: 0.8, color: 0x0a0705 });
    g.rect(-L / 2 + 3, -W / 2 + 3, 7, 1).fill({ color: 0xf4ecd8, alpha: 0.7 });
    g.circle(-L / 2 + 5, 0, 1.4).fill(0xc9a45c).stroke({ width: 0.5, color: 0x0a0705 });
    // tiller
    g.moveTo(-L / 2, 0).lineTo(-L / 2 - 5, -2.5).stroke({ width: 1.2, color: 0x6b5138, cap: 'round' });
    g.eventMode = 'none';
    c.addChild(g);
    // bow lantern
    const lamp = new Sprite(glow);
    lamp.anchor.set(0.5);
    lamp.width = lamp.height = 26;
    lamp.position.set(L / 2 - 2, 0);
    lamp.tint = 0xffb347;
    lamp.alpha = 0.55;
    lamp.blendMode = 'screen';
    lamp.eventMode = 'none';
    c.addChild(lamp);
    c.eventMode = 'none';
    return c;
  };

  /* a locomotive with its tender, pointing +x: brass boiler, owner-coloured
     cab, dark wheels with brass rims, a tall chimney at the front */
  const makeTrain = (col: number): Container => {
    const c = new Container();
    const g = new Graphics();
    // tender
    g.roundRect(-30, -4.5, 12, 9, 1.5).fill(0x2a2018).stroke({ width: 0.8, color: 0x0a0705 });
    g.rect(-29, -3.5, 10, 7).fill({ color: col, alpha: 0.85 });
    // frame + wheels
    g.roundRect(-17, -5, 36, 10, 2).fill(0x1c1410).stroke({ width: 0.8, color: 0x0a0705 });
    for (const wx of [-12, -3, 8, 15]) {
      g.circle(wx, 6, 2.6).fill(0x100d0b).stroke({ width: 0.8, color: 0xc9a45c });
      g.circle(wx, -6, 2.6).fill(0x100d0b).stroke({ width: 0.8, color: 0xc9a45c });
    }
    // cab (owner colour) at the back of the engine
    g.roundRect(-16, -5.5, 10, 11, 1.5).fill(col).stroke({ width: 0.8, color: 0x0a0705 });
    g.rect(-15, -4, 8, 1.2).fill({ color: 0xf4ecd8, alpha: 0.7 });
    // boiler: brass cylinder with bands
    const boiler = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local' });
    boiler.addColorStop(0, '#E9CF8B').addColorStop(0.5, '#B8923F').addColorStop(1, '#6B4F1E');
    g.roundRect(-6, -4, 24, 8, 3.5).fill(boiler).stroke({ width: 0.8, color: 0x3a2a10 });
    for (const bx of [0, 7, 14]) g.rect(bx, -4, 1, 8).fill({ color: 0x3a2a10, alpha: 0.6 });
    // chimney + buffer beam
    g.circle(15, 0, 2.6).fill(0x2a2018).stroke({ width: 0.8, color: 0xc9a45c });
    g.rect(18, -4.5, 1.6, 9).fill(0x9e3b30);
    g.eventMode = 'none';
    c.addChild(g);
    // firebox glow
    const fire = new Sprite(glow);
    fire.anchor.set(0.5);
    fire.width = fire.height = 18;
    fire.position.set(-11, 0);
    fire.tint = 0xff7a2a;
    fire.alpha = 0.45;
    fire.blendMode = 'screen';
    fire.eventMode = 'none';
    c.addChild(fire);
    c.eventMode = 'none';
    return c;
  };
  let smokeKey = '';
  let trafficKey = '';

  const rebuildDynamic = (game: GameState | null, iconCanal: Texture | null, iconRail: Texture | null) => {
    if (!game) return;
    /* smoke: two wisps per unflipped built works */
    const emitters: [number, number][] = [];
    for (const [key, tile] of Object.entries(game.tiles)) {
      if (tile.flipped) continue;
      const [townId, si] = key.split(':');
      const town = TOWNS.find((t) => t.id === townId);
      const sp = town?.slots[Number(si)];
      if (sp) emitters.push(displayPosFor(sp.x, sp.y));
    }
    const eKey = emitters.map((e) => `${e[0]},${e[1]}`).join('|');
    if (eKey !== smokeKey) {
      smokeKey = eKey;
      smokeLayer.removeChildren();
      wisps = [];
      if (!reduced) {
        for (const [x, y] of emitters) {
          for (let i = 0; i < 2; i++) {
            const s = new Sprite(glow);
            s.anchor.set(0.5);
            s.tint = 0xd6cebc;
            s.blendMode = 'screen';
            smokeLayer.addChild(s);
            wisps.push({ s, x, y, ph: i * 2.6 + (hashId(`${x},${y}`) % 100) / 50, dx: (i % 2 === 0 ? 1 : -1) * 12 });
          }
        }
      }
    }
    /* traffic: one vehicle per built link, following its polyline */
    const links = Object.entries(game.links);
    const tKey = links.map(([id, l]) => `${id}:${l.era}`).join('|');
    if (tKey !== trafficKey && iconCanal && iconRail) {
      trafficKey = tKey;
      for (const child of trafficLayer.removeChildren()) child.destroy({ children: true });
      for (const child of wakeLayer.removeChildren()) child.destroy();
      vehicles = [];
      if (!reduced) {
        for (const [id, l] of links) {
          const def = LINKS.find((d) => d.id === id);
          if (!def) continue;
          /* vehicles follow the true winding route (routeFor sampling —
             same curve the board draws and hit-tests) */
          const pts = routeFor(def).pts;
          const boat = l.era !== 'rail';
          const col = hex(PLAYER_COLORS[game.players[l.owner].color]?.hex ?? '#C9A45C');
          const h = hashId(id);
          /* barges amble (a full crossing in 24–40 s), locomotives hurry (11–19 s) */
          const dur = boat ? 24 + (h % 16) : 11 + (h % 8);
          const spawn = (reverse: boolean, phase: number) => {
            const c = boat ? makeBoat(col) : makeTrain(col);
            c.scale.set(boat ? 1.3 : 1.25);
            const wake = new Graphics();
            wake.eventMode = 'none';
            wakeLayer.addChild(wake);
            trafficLayer.addChild(c);
            const puffs: Puff[] = [];
            for (let k = 0; k < (boat ? 2 : 5); k++) {
              const s = new Sprite(glow);
              s.anchor.set(0.5);
              s.tint = boat ? 0xd6cebc : 0xe8e2d6;
              s.blendMode = 'screen';
              s.alpha = 0;
              s.eventMode = 'none';
              wakeLayer.addChild(s);
              puffs.push({ s, born: -99, x: 0, y: 0 });
            }
            vehicles.push({ c, wake, sam: makeSampler(pts), dur, ph: phase, reverse, boat, puffs, lastPuff: -99, len: boat ? 44 : 48 });
          };
          /* two vehicles per link: the second casts off when the first reaches
             80 % of the crossing, so the line never looks idle. Barges run in
             opposite directions and pass each other mid-canal; trains follow
             one another the same way down the line. */
          const first = h % 2 === 0;
          const ph = (h % 900) / 100;
          spawn(first, ph);
          spawn(boat ? !first : first, ph + 0.2 * dur);
        }
      }
    }
  };

  /* SVG icon textures (loadBoardAssets preloads them, so Texture.from
     resolves from the warm cache) — kept as the rebuild trigger */
  const iconCanal = Texture.from('/icon-canal.svg');
  const iconRail = Texture.from('/icon-rail.svg');

  /* ------------------------ rail etch reveal ------------------------- */
  const etchLayer = new Container();
  layer.addChild(etchLayer);
  interface Etch {
    id: string;
    delay: number;
    sam: Sampler;
    g: Graphics;
    lastP: number;
  }
  /* stagger order matches RAIL_ONLY_ORDER in Board.tsx */
  const etches: Etch[] = LINKS.filter((l) => !l.canal).map((def, i) => {
    const pts = routeFor(def).pts;
    const g = new Graphics();
    etchLayer.addChild(g);
    return { id: def.id, delay: 0.5 + i * 0.09, sam: makeSampler(pts), g, lastP: -1 };
  });
  let etchOn = false;
  let etchStart = 0;

  const updateEtch = (t: number, game: GameState | null): void => {
    /* ceremony lives outside GameState — read it from the store */
    const on = useGame.getState().ceremony === 'canal-end' && !reduced;
    if (on && !etchOn) {
      etchOn = true;
      etchStart = t;
      for (const e of etches) e.lastP = -1;
    } else if (!on && etchOn) {
      /* ceremony over (or never started): the board redraw shows the
         definitive traces — drop the cosmetic strokes */
      etchOn = false;
      for (const e of etches) {
        e.g.clear();
        e.lastP = -1;
      }
    }
    if (!etchOn || !game) return;
    for (const e of etches) {
      if (game.links[e.id]) {
        if (e.lastP !== 0) {
          e.g.clear();
          e.lastP = 0;
        }
        continue;
      }
      const el = t - etchStart - e.delay;
      const p = el <= 0 ? 0 : Math.min(1, el / ETCH_DUR);
      if (p === e.lastP) continue;
      e.lastP = p;
      e.g.clear();
      if (p === 0) continue;
      /* SVG keyframes: dash draws over the first 78 % at opacity .65,
         then fades out by 100 % */
      const frac = easeInOut(Math.min(1, p / 0.78));
      const alpha = p <= 0.78 ? 0.65 : 0.65 * (1 - (p - 0.78) / 0.22);
      strokeArc(e.g, e.sam, 0, e.sam.total * frac, 3, alpha, ETCH_COLOR);
    }
  };

  return {
    layer,
    tick(t: number, game: GameState | null) {
      for (const a of animated) a.tick(t);
      for (const fx of rivers) {
        if (!fx.dashes) continue;
        const step = Math.floor((t / fx.dur) * DASH_STEPS);
        if (step !== fx.lastStep) {
          fx.lastStep = step;
          drawRiverDashes(fx, step);
        }
      }
      rebuildDynamic(game, iconCanal, iconRail);
      updateEtch(t, game);
      for (const w of wisps) {
        const cycle = 5.2;
        const p = ((t + w.ph) % cycle) / cycle;
        const rise = p * 52;
        w.s.position.set(w.x + w.dx * p, w.y - rise);
        const sc = 14 + p * 22;
        w.s.width = w.s.height = sc;
        w.s.alpha = p < 0.18 ? (p / 0.18) * 0.3 : 0.3 * (1 - p);
      }
      for (const v of vehicles) {
        /* ease in and out at the quays: a barge casts off and moors, it never teleports */
        const raw = ((t + v.ph) % v.dur) / v.dur;
        const p = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        /* keep to the open water between the quays: the vehicle never hides under a town's tiles */
        const d = (0.1 + 0.8 * (v.reverse ? 1 - p : p)) * v.sam.total;
        v.sam.at(d, P);
        const heading = v.reverse ? P[2] + Math.PI : P[2];
        /* a barge sways a touch on the water; a locomotive rattles faster and less */
        const sway = v.boat ? Math.sin(t * 1.6 + v.ph) * 0.03 : Math.sin(t * 9 + v.ph) * 0.006;
        v.c.position.set(P[0], P[1]);
        v.c.rotation = heading + sway;
        /* wake: two ripples peeling off the stern, following the curve behind */
        v.wake.clear();
        if (v.boat) {
          const dirSign = v.reverse ? 1 : -1;
          for (const side of [-1, 1]) {
            let first = true;
            for (let k = 0; k <= 5; k++) {
              const back = v.len * 0.65 + k * 11;
              const dd = Math.max(0, Math.min(v.sam.total, d + dirSign * back));
              v.sam.at(dd, Q);
              const nx = -Math.sin(Q[2]);
              const ny = Math.cos(Q[2]);
              const off = side * (3.5 + k * 3);
              const x = Q[0] + nx * off;
              const y = Q[1] + ny * off;
              if (first) {
                v.wake.moveTo(x, y);
                first = false;
              } else v.wake.lineTo(x, y);
            }
            v.wake.stroke({ width: 1.8, color: 0xffffff, alpha: 0.5, cap: 'round' });
          }
        }
        /* smoke: the chimney breathes a puff every so often; puffs drift up and fade */
        const every = v.boat ? 2.4 : 0.55;
        if (t - v.lastPuff > every) {
          v.lastPuff = t;
          const puff = v.puffs.reduce((a, b) => (a.born < b.born ? a : b));
          const chimney = v.boat ? -v.len / 2 + 5 : 15;
          const cx = P[0] + Math.cos(heading) * chimney;
          const cy = P[1] + Math.sin(heading) * chimney;
          puff.born = t;
          puff.x = cx;
          puff.y = cy;
        }
        for (const puff of v.puffs) {
          const age = t - puff.born;
          const life = v.boat ? 3.2 : 2.2;
          if (age < 0 || age > life) {
            puff.s.alpha = 0;
            continue;
          }
          const q = age / life;
          const size = (v.boat ? 8 : 10) + q * (v.boat ? 22 : 34);
          puff.s.width = puff.s.height = size;
          puff.s.position.set(puff.x + Math.sin(puff.born * 3 + q * 4) * 6 * q, puff.y - q * (v.boat ? 26 : 40));
          puff.s.alpha = (q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85) * (v.boat ? 0.22 : 0.4);
        }
      }
    },
  };
}
