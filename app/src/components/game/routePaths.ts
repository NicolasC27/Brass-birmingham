import { LINKS, NODE_POS, onBoardChange } from '@/game/data';
import type { Era, LinkDef } from '@/game/types';
import { RAIL_ROUTES } from './railRoutes';

/* ------------------------------------------------------------------ */
/* routePaths — deterministic winding routes for every link (map-v5).  */
/*                                                                     */
/* Each link becomes ONE quadratic bézier between the two town anchor  */
/* points with a perpendicular bulge derived from a hash of the link   */
/* id (magnitude 6–14% of the segment length, alternating sides), and  */
/* over that arc a meander: a few gentle waves across the route,       */
/* fading to nothing at either town, so a canal or a road wanders with */
/* the land instead of describing an arc.                              */
/*                                                                     */
/* Town-avoidance rule: the candidate curve is sampled; if any sample  */
/* comes within CLEARANCE px of a third node's anchor, the bulge side  */
/* flips; if it still collides the bulge halves, then falls back to a  */
/* straight chord. Verified by scripts/check-routes (run, not          */
/* committed): every link clears every third node by ≥ 90px.           */
/* ------------------------------------------------------------------ */

/** min distance a route may keep from any third node's anchor */
const CLEARANCE = 90;
/** samples per curve for the avoidance probe */
const SAMPLES = 64;
/** the meander's reach across the route, as a share of its length */
const MEANDER = 0.035;
/** points along a finished route */
const STEPS = 48;

export interface Route {
  /** SVG path data (world coords) */
  d: string;
  /** curve point at t=0.5 (owner notch / price chip / tooltip anchor) */
  mid: [number, number];
  /** dense polyline sampling the curve (drawing + hit-testing outside SVG) */
  pts: [number, number][];
}

/** deterministic 31-hash of the link id */
function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

interface Quad {
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
}

function quadPoint(q: Quad, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * q.ax + 2 * u * t * q.cx + t * t * q.bx, u * u * q.ay + 2 * u * t * q.cy + t * t * q.by];
}

/** sample a curve; returns min distance to any third-node anchor */
function clearance(q: Quad, a: string, b: string): number {
  let best = Infinity;
  for (const [id, [tx, ty]] of Object.entries(NODE_POS)) {
    if (id === a || id === b) continue;
    for (let i = 0; i <= SAMPLES; i++) {
      const [px, py] = quadPoint(q, i / SAMPLES);
      const d = Math.hypot(tx - px, ty - py);
      if (d < best) best = d;
    }
  }
  return best;
}

/** quadratic bézier with control = midpoint + perpendicular bulge */
function bulged(ax: number, ay: number, bx: number, by: number, mag: number, side: number): Quad {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return {
    ax,
    ay,
    cx: (ax + bx) / 2 + nx * mag * len * side,
    cy: (ay + by) / 2 + ny * mag * len * side,
    bx,
    by,
  };
}

/** the arc with its meander laid over it: two to four half-waves and two
 *  finer ones on top, phased by the hash, under an envelope that is nothing
 *  at the towns — the route straightens as it arrives */
function meandered(q: Quad, h: number, amp: number): [number, number][] {
  const len = Math.hypot(q.bx - q.ax, q.by - q.ay);
  const p1 = ((h >>> 3) % 628) / 100;
  const p2 = ((h >>> 9) % 628) / 100;
  const p3 = ((h >>> 15) % 628) / 100;
  const waves = 2 + ((h >>> 20) % 3);
  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const [x, y] = quadPoint(q, t);
    const u = 1 - t;
    const tx = 2 * u * (q.cx - q.ax) + 2 * t * (q.bx - q.cx);
    const ty = 2 * u * (q.cy - q.ay) + 2 * t * (q.by - q.cy);
    const tl = Math.hypot(tx, ty) || 1;
    const env = Math.sin(Math.PI * t);
    const wave = Math.sin(waves * Math.PI * t + p1) * 0.6 + Math.sin((waves * 2 + 1) * Math.PI * t + p2) * 0.3 + Math.sin((waves * 4 + 1) * Math.PI * t + p3) * 0.12;
    const off = amp * len * env * wave;
    pts.push([x + (-ty / tl) * off, y + (tx / tl) * off]);
  }
  return pts;
}

/** min distance from a polyline to any third node's anchor */
function clearanceOf(pts: [number, number][], a: string, b: string): number {
  let best = Infinity;
  for (const [id, [tx, ty]] of Object.entries(NODE_POS)) {
    if (id === a || id === b) continue;
    for (const [px, py] of pts) {
      const d = Math.hypot(tx - px, ty - py);
      if (d < best) best = d;
    }
  }
  return best;
}

function buildRoute(def: LinkDef): Route {
  const [ax, ay] = NODE_POS[def.a];
  const [bx, by] = NODE_POS[def.b];
  const h = hash32(def.id);
  const mag = 0.06 + (h % 801) / 10000; // 6.0%–14.0% of segment length
  const side = h & 1 ? 1 : -1;

  const candidates: [number, number][] = [
    [mag, side],
    [mag, -side],
    [mag / 2, side],
    [mag / 2, -side],
    [0, 1],
  ];
  let q = bulged(ax, ay, bx, by, ...candidates[0]);
  for (const c of candidates) {
    const cand = bulged(ax, ay, bx, by, ...c);
    if (clearance(cand, def.a, def.b) >= CLEARANCE) {
      q = cand;
      break;
    }
  }

  /* the meander, drawn in until it too clears every third town */
  let pts = meandered(q, h, MEANDER);
  for (let amp = MEANDER / 2; clearanceOf(pts, def.a, def.b) < CLEARANCE && amp > MEANDER / 8; amp /= 2) pts = meandered(q, h, amp);
  if (clearanceOf(pts, def.a, def.b) < CLEARANCE) pts = meandered(q, h, 0);

  const r = (n: number): number => Math.round(n * 10) / 10;
  const d = `M${pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')}`;
  return { d, mid: pts[STEPS / 2], pts };
}

let ROUTES = new Map<string, Route>(LINKS.map((def) => [def.id, buildRoute(def)]));

/* the Rail Era's routes were traced on the relief of the rail-era painting
   (tools/map/rail-routes.py): the map engraves the very same lines, so a
   railway built on the board lies exactly on the one painted under it */
let RAIL_ERA = new Map<string, Route>(
  LINKS.filter((def) => RAIL_ROUTES[def.id]).map((def) => {
    const pts = RAIL_ROUTES[def.id];
    const d = `M${pts.map(([x, y]) => `${x},${y}`).join(' L')}`;
    return [def.id, { d, mid: pts[Math.floor(pts.length / 2)], pts }];
  }),
);

/* another board draws another network: both tables are traced again */
onBoardChange(() => {
  ROUTES = new Map<string, Route>(LINKS.map((def) => [def.id, buildRoute(def)]));
  RAIL_ERA = new Map<string, Route>(
    LINKS.filter((def) => RAIL_ROUTES[def.id]).map((def) => {
      const pts = RAIL_ROUTES[def.id];
      const d = `M${pts.map(([x, y]) => `${x},${y}`).join(' L')}`;
      return [def.id, { d, mid: pts[Math.floor(pts.length / 2)], pts }];
    }),
  );
});

/** winding route for a link (precomputed, deterministic); the Rail Era has
 *  its own tracing for every link that can carry rails */
export function routeFor(def: LinkDef, era: Era = 'canal'): Route {
  return (era === 'rail' ? RAIL_ERA.get(def.id) : undefined) ?? ROUTES.get(def.id)!;
}
