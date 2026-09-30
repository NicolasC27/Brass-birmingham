import { LINKS, NODE_POS, onBoardChange } from '@/game/data';
import type { Era, LinkDef } from '@/game/types';
import { RAIL_ROUTES } from './railRoutes';

/* ------------------------------------------------------------------ */
/* routePaths — deterministic winding routes for every link (map-v5).  */
/*                                                                     */
/* Each link becomes ONE quadratic bézier between the two town anchor  */
/* points with a perpendicular bulge derived from a hash of the link   */
/* id (magnitude 6–14% of the segment length, alternating sides).      */
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

  const r = (n: number): number => Math.round(n * 10) / 10;
  const d = `M${r(q.ax)},${r(q.ay)} Q${r(q.cx)},${r(q.cy)} ${r(q.bx)},${r(q.by)}`;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 32; i++) pts.push(quadPoint(q, i / 32));
  return { d, mid: quadPoint(q, 0.5), pts };
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
