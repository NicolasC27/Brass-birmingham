import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { TOWN_BY_ID } from '@/game/data';
import type { Era, GameState, IndustryType } from '@/game/types';
import { WORLD_H, WORLD_W } from '../boardView';
import { TILE_HALF, townChrome } from '../townChrome';
import { usePageVisible } from './usePageVisible';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* ChimneySmoke — animated smoke wisps over built industries           */
/* (map-v3 §4, v10 pass). One plume cluster per unflipped works,       */
/* anchored to the DISPLAY tile positions (townChrome compact grid,    */
/* so smoke stays glued to the tiles through cluster nudges).          */
/* Canal era burns discreetly (fewer, fainter wisps); the rail era     */
/* stokes every chimney (full wisps, heavier smoke). Total active      */
/* wisps are capped at MAX_WISPS (~30) whatever the factory count;     */
/* flipped/exhausted works go cold. Lives inside the 2400×1600 world   */
/* container; CSS keyframes are scoped here (never index.css).         */
/* transform/opacity only, pointer-events: none, paused when the tab   */
/* is hidden, fully disabled under prefers-reduced-motion.             */
/* ------------------------------------------------------------------ */

/** hard cap on simultaneously animated wisps across the whole board */
const MAX_WISPS = 30;
/** industries with chimneys; breweries get a faint single wisp */
const SMOKES: Record<IndustryType, number> = {
  coal: 3,
  iron: 3,
  cotton: 2,
  manufacturer: 2,
  pottery: 2,
  brewery: 1,
};

interface Emitter {
  key: string;
  x: number; // world coords (2400×1600), display grid
  y: number;
  wisps: number;
  faint: boolean;
}

export default memo(function ChimneySmoke({
  tiles,
  era,
  reduced,
}: {
  tiles: GameState['tiles'];
  era: Era;
  reduced: boolean;
}) {
  const visible = usePageVisible();

  const emitters = useMemo<Emitter[]>(() => {
    const out: Emitter[] = [];
    for (const [key, t] of Object.entries(tiles)) {
      if (t.flipped) continue; // exhausted mines go cold
      const n = SMOKES[t.industry];
      if (!n) continue;
      const [townId, slotStr] = key.split(':');
      const town = TOWN_BY_ID[townId];
      if (!town) continue;
      const pos = townChrome(town).slots[Number(slotStr)];
      if (!pos) continue;
      // canal era: a discreet hearth per works; rail era: the full stack
      const wisps = era === 'rail' ? n : Math.max(1, Math.round(n * 0.65));
      out.push({ key, x: pos.x, y: pos.y - TILE_HALF + 6, wisps, faint: t.industry === 'brewery' });
    }
    // cap total active wisps: trim the biggest clusters first, one wisp
    // at a time, so every works keeps smoking when possible
    let total = out.reduce((s, e) => s + e.wisps, 0);
    while (total > MAX_WISPS) {
      const big = out.reduce((a, b) => (b.wisps > a.wisps ? b : a), out[0]);
      if (!big || big.wisps <= 1) break;
      big.wisps -= 1;
      total -= 1;
    }
    // extreme case (more works than the cap): the newest works wait their turn
    return total > MAX_WISPS ? out.slice(0, MAX_WISPS) : out;
  }, [tiles, era]);

  if (reduced || emitters.length === 0) return null;

  const baseOpacity = era === 'rail' ? 0.34 : 0.22;

  return (
    <div aria-hidden data-layer="smoke" className={cn('pointer-events-none absolute inset-0', !visible && 'bw-smoke-paused')}>
      <style>{`
        @keyframes bw-smoke-rise {
          0%   { transform: translate(0, 0) scale(.7); opacity: 0; }
          18%  { opacity: var(--bw-smoke-o, .3); }
          60%  { opacity: calc(var(--bw-smoke-o, .3) * .66); }
          100% { transform: translate(var(--bw-smoke-dx, 14px), -52px) scale(1.7); opacity: 0; }
        }
        .bw-smoke-wisp {
          position: absolute;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(214,206,188,.85), rgba(214,206,188,0) 68%);
          filter: blur(3px);
          animation: bw-smoke-rise 5.2s ease-out infinite;
          will-change: transform, opacity;
        }
        .bw-smoke-paused .bw-smoke-wisp { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .bw-smoke-wisp { animation: none !important; }
        }
      `}</style>
      {emitters.map((e) => (
        <div key={e.key} className="absolute" style={{ left: (e.x / WORLD_W) * 100 + '%', top: (e.y / WORLD_H) * 100 + '%' }}>
          {Array.from({ length: e.wisps }, (_, i) => (
            <span
              key={i}
              className="bw-smoke-wisp"
              style={
                {
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  marginTop: -7,
                  animationDelay: `${(i * 5.2) / e.wisps}s`,
                  '--bw-smoke-o': e.faint ? baseOpacity * 0.55 : baseOpacity,
                  '--bw-smoke-dx': `${(i % 2 === 0 ? 1 : -1) * (10 + i * 5)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
});
