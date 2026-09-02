import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MERCHANTS, TOWNS } from '@/game/data';
import type { GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* TownLamplight — warm lamplight halos over every town & merchant     */
/* (v9). Each settlement gets a soft amber radial glow (blend: screen) */
/* that breathes slowly like a lantern; durations/delays are hashed    */
/* from the node id so no two lamps breathe in sync. A town where any  */
/* player has built a tile burns a little brighter — industry lights   */
/* the streets. Lives INSIDE the 2400×1600 world container: halos pan  */
/* and zoom with the map (they deliberately grow when zooming in).     */
/* pointer-events: none, transform/opacity only, memoized.             */
/* ------------------------------------------------------------------ */

const AMBER = '232,163,61'; // #E8A33D
const TOWN_R = 90;
const MERCHANT_R = 70;

/** tiny deterministic string hash (stable across renders/sessions) */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return h;
}

interface Halo {
  id: string;
  x: number;
  y: number;
  r: number;
  lit: boolean;
  dur: number;
  delay: number;
}

export default memo(function TownLamplight({ game, reduced }: { game: GameState; reduced: boolean }) {
  const halos = useMemo<Halo[]>(() => {
    /* towns with ANY built tile (any player) glow brighter (+0.1 opacity) */
    const litTowns = new Set(Object.keys(game.tiles).map((k) => k.split(':')[0]));
    const mk = (id: string, x: number, y: number, r: number): Halo => {
      const h = hashId(id);
      return {
        id,
        x,
        y,
        r,
        lit: litTowns.has(id),
        dur: 4 + (h % 300) / 100, // 4.0–6.99s
        delay: (h % 700) / 100, // 0–6.99s desync
      };
    };
    return [
      ...TOWNS.map((t) => mk(t.id, t.x, t.y, TOWN_R)),
      ...MERCHANTS.map((m) => mk(m.id, m.x, m.y, MERCHANT_R)),
    ];
  }, [game.tiles]);

  return (
    <div aria-hidden data-layer="lamplight" className="pointer-events-none absolute inset-0 overflow-hidden">
      {halos.map((halo) => {
        const lo = halo.lit ? 0.38 : 0.28;
        const hi = halo.lit ? 0.5 : 0.4;
        const style = {
          left: halo.x,
          top: halo.y,
          width: halo.r * 2,
          height: halo.r * 2,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(${AMBER},.85) 0%, rgba(${AMBER},.38) 38%, rgba(${AMBER},0) 68%)`,
          mixBlendMode: 'screen',
        } as const;
        if (reduced) {
          return <div key={halo.id} className="absolute rounded-full" style={{ ...style, opacity: (lo + hi) / 2 }} />;
        }
        return (
          <motion.div
            key={halo.id}
            className="absolute rounded-full"
            /* will-change promotes each halo to its own composited layer:
               the breathing opacity then runs on the compositor instead of
               repainting the world every frame (measured idle cost) */
            style={{ ...style, willChange: 'opacity' }}
            initial={{ opacity: lo }}
            animate={{ opacity: [lo, hi, lo] }}
            transition={{ repeat: Infinity, duration: halo.dur, ease: 'easeInOut', delay: halo.delay }}
          />
        );
      })}
    </div>
  );
});
