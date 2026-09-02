import { memo } from 'react';
import { WORLD_H, WORLD_W } from '../boardView';

/* ------------------------------------------------------------------ */
/* RiverSheen — animated light on the painted rivers (v10).            */
/* The era map art has rivers painted into the terrain; this layer     */
/* lays a few curved highlights along the main visible courses: a      */
/* soft wide gleam plus a thin dashed current whose dashoffset drifts  */
/* slowly downstream. Rendered in the 3200×1800 world container so it  */
/* pans/zooms with the map; mix-blend screen, every stroke ≤ 0.25      */
/* opacity, pointer-events: none. prefers-reduced-motion → static.     */
/* River polylines are approximate world coordinates traced from       */
/* map-era-canal.png (same geography on the rail map), v13-stretched   */
/* with the world (×1.25 on both axes from the 2560×1440 v11 coords).  */
/* ------------------------------------------------------------------ */

interface River {
  id: string;
  /** smooth path through world coords */
  d: string;
  /** width of the thin current line (the gleam scales from it) */
  w: number;
  /** seconds for one flow cycle (staggered so rivers don't sync) */
  dur: number;
}

const RIVERS: River[] = [
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

export default memo(function RiverSheen({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden data-layer="sheen" className="pointer-events-none absolute inset-0" style={{ mixBlendMode: 'screen' }}>
      <style>{`
        @keyframes bw-riverflow { to { stroke-dashoffset: -240; } }
        {/* thin drifting current (static under reduced motion).
            steps(): the dashoffset only advances ~4×/s instead of every
            frame — on a 0.22-opacity gleam the stepping is invisible, and
            the SVG stops repainting 60×/s (measured: dominant pan cost) */}
        .bw-riverflow { stroke-dasharray: 34 86; animation: bw-riverflow var(--bw-river-dur, 26s) steps(104) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bw-riverflow { animation: none !important; }
        }
      `}</style>
      <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className="absolute inset-0 h-full w-full">
        <defs>
          {/* pale water light fading out downstream of each highlight */}
          <linearGradient id="bw-rivergrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8FB8C4" stopOpacity="0" />
            <stop offset="30%" stopColor="#8FB8C4" stopOpacity="0.9" />
            <stop offset="72%" stopColor="#8FB8C4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8FB8C4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {RIVERS.map((r) => (
          <g key={r.id}>
            {/* soft gleam lifting the painted water out of the terrain */}
            <path d={r.d} fill="none" stroke="url(#bw-rivergrad)" strokeWidth={r.w * 3.2} strokeOpacity={0.09} strokeLinecap="round" />
            {/* thin drifting current (static under reduced motion) */}
            <path
              d={r.d}
              fill="none"
              stroke="url(#bw-rivergrad)"
              strokeWidth={r.w}
              strokeOpacity={0.22}
              strokeLinecap="round"
              className={reduced ? undefined : 'bw-riverflow'}
              style={{ ['--bw-river-dur' as string]: `${r.dur}s` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
});
