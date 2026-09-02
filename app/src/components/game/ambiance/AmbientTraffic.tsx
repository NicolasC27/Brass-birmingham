import { memo, useMemo } from 'react';
import { LINKS } from '@/game/data';
import type { GameState, LinkDef } from '@/game/types';
import { routeFor } from '../routePaths';
import { usePageVisible } from './usePageVisible';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* AmbientTraffic — narrowboats sliding along BUILT canal links and    */
/* locomotives along built rail links (map-v3 §4). One glyph per link, */
/* only a few links animated at once. CSS offset-path keeps motion on  */
/* the compositor (transform-only); paused on hidden tab; disabled     */
/* under prefers-reduced-motion. Keyframes scoped to this file.        */
/* ------------------------------------------------------------------ */

const MAX_VEHICLES = 6;

/* Vehicles ride the same winding bézier as the rendered route, so      */
/* narrowboats/locomotives follow the curves exactly (CSS offset-path). */
function linkD(def: LinkDef): string {
  return routeFor(def).d;
}

interface Vehicle {
  id: string;
  d: string;
  icon: string;
  dur: number;
  delay: number;
  reverse: boolean;
}

export default memo(function AmbientTraffic({
  links,
  reduced,
}: {
  links: GameState['links'];
  reduced: boolean;
}) {
  const visible = usePageVisible();

  const vehicles = useMemo<Vehicle[]>(() => {
    const built = Object.entries(links)
      .map(([id, l]) => ({ def: LINKS.find((d) => d.id === id), era: l.era }))
      .filter((x): x is { def: LinkDef; era: 'canal' | 'rail' } => !!x.def)
      .sort((a, b) => a.def.id.localeCompare(b.def.id))
      .slice(0, MAX_VEHICLES);
    return built.map(({ def, era }, i) => ({
      id: def.id,
      d: linkD(def),
      icon: era === 'canal' ? '/icon-canal.svg' : '/icon-rail.svg',
      dur: era === 'canal' ? 34 + (i % 3) * 6 : 18 + (i % 3) * 4,
      delay: -i * 5.5,
      reverse: i % 2 === 1,
    }));
  }, [links]);

  if (reduced || vehicles.length === 0) return null;

  return (
    <div aria-hidden data-layer="traffic" className={cn('pointer-events-none absolute inset-0', !visible && 'bw-traffic-paused')}>
      <style>{`
        @keyframes bw-travel {
          from { offset-distance: 0%; }
          to   { offset-distance: 100%; }
        }
        .bw-vehicle {
          position: absolute;
          left: 0;
          top: 0;
          width: 22px;
          height: 22px;
          margin-left: -11px;
          margin-top: -11px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          filter: invert(.86) sepia(.28) saturate(1.1) drop-shadow(0 0 3px rgba(16,13,11,.9));
          offset-rotate: auto;
          animation: bw-travel 30s linear infinite;
          will-change: offset-distance;
        }
        .bw-traffic-paused .bw-vehicle { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .bw-vehicle { animation: none !important; }
        }
      `}</style>
      {vehicles.map((v) => (
        <span
          key={v.id}
          className="bw-vehicle"
          style={{
            backgroundImage: `url(${v.icon})`,
            offsetPath: `path("${v.d}")`,
            animationDuration: `${v.dur}s`,
            animationDelay: `${v.delay}s`,
            animationDirection: v.reverse ? 'reverse' : 'normal',
          }}
        />
      ))}
    </div>
  );
});
