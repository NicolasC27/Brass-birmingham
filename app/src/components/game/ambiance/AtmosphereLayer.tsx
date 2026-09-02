import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Era } from '@/game/types';

/* ------------------------------------------------------------------ */
/* AtmosphereLayer — era lighting over the board (map-v3 §4).          */
/* Canal era: green-blue dawn gradient + waterway mist drifting along  */
/* the canal corridor. Rail era: ember-orange industrial glow rising   */
/* from the Black Country / Birmingham cluster. Lives INSIDE the       */
/* 2400×1600 world container so it pans/zooms with the map.            */
/* pointer-events: none, transform/opacity only, memoized.             */
/* ------------------------------------------------------------------ */

const MISTS_CANAL = [
  { left: '34%', top: '12%', w: 340, h: 130, dur: 34, delay: 0, dx: 34, dy: 12 },
  { left: '42%', top: '44%', w: 300, h: 110, dur: 40, delay: 7, dx: -28, dy: 16 },
  { left: '36%', top: '74%', w: 320, h: 120, dur: 38, delay: 14, dx: 24, dy: -14 },
] as const;

const GLOWS_RAIL = [
  // Birmingham / Black Country furnace glow
  { left: '44%', top: '56%', w: 460, h: 300, dur: 22, delay: 0, o: 0.16 },
  { left: '30%', top: '48%', w: 340, h: 230, dur: 26, delay: 5, o: 0.12 },
  { left: '58%', top: '30%', w: 380, h: 250, dur: 30, delay: 11, o: 0.1 },
] as const;

export default memo(function AtmosphereLayer({ era, reduced }: { era: Era; reduced: boolean }) {
  const rail = era === 'rail';
  return (
    <div aria-hidden data-layer="atmosphere" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* era gradient — animated crossfade when the era turns */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: rail ? 0 : 1 }}
        transition={{ duration: reduced ? 0.15 : 2.4, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(120% 90% at 28% 12%, rgba(62,114,86,.30), transparent 55%),' +
            'linear-gradient(180deg, rgba(86,118,128,.14), transparent 42%)',
        }}
      />
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: rail ? 1 : 0 }}
        transition={{ duration: reduced ? 0.15 : 2.4, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(55% 42% at 57% 68%, rgba(166,86,43,.22), transparent 72%),' +
            'linear-gradient(0deg, rgba(124,62,31,.10), transparent 40%)',
        }}
      />

      {/* drifting waterway mist (canal) / furnace shimmer (rail).
          will-change: the blur is baked into each blob's own composited
          layer once — the drift/pulse then runs on the compositor instead
          of re-evaluating blur-3xl every frame */}
      {!reduced && !rail &&
        MISTS_CANAL.map((m, i) => (
          <motion.div
            key={`mist-${i}`}
            className="absolute rounded-full bg-[#9FB8A8] blur-3xl"
            style={{ left: m.left, top: m.top, width: m.w, height: m.h, opacity: 0.08, willChange: 'transform' }}
            animate={{ x: [0, m.dx, 0], y: [0, m.dy, 0] }}
            transition={{ repeat: Infinity, duration: m.dur, ease: 'easeInOut', delay: m.delay }}
          />
        ))}
      {!reduced && rail &&
        GLOWS_RAIL.map((g, i) => (
          <motion.div
            key={`ember-${i}`}
            className="absolute rounded-full bg-copper-500 blur-3xl"
            style={{ left: g.left, top: g.top, width: g.w, height: g.h, willChange: 'opacity, transform' }}
            animate={{ opacity: [g.o, g.o * 1.7, g.o], scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: g.dur, ease: 'easeInOut', delay: g.delay }}
          />
        ))}
    </div>
  );
});
