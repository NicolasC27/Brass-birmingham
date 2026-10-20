import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/game/store';

/* ------------------------------------------------------------------ */
/* The lesson's halo: a brass ring drawn around the part of the HUD the */
/* guide is talking about — the element that carries the matching       */
/* `data-lens` mark. Measured from the element itself, so it follows    */
/* the layout, and a hair wider than it so the thing stays readable.    */
/* ------------------------------------------------------------------ */

const PAD = 6;

function LessonHalo() {
  const hud = useGame((s) => s.lens?.hud ?? null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!hud) return;
    const measure = () => {
      /* a mark is a word of the element's list: a disc may stand for two parts */
      const el = document.querySelector<HTMLElement>(`[data-lens~="${hud}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        setBox(null);
        return;
      }
      setBox((prev) => (prev && Math.abs(prev.x - r.left) < 1 && Math.abs(prev.y - r.top) < 1 && Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1 ? prev : { x: r.left, y: r.top, w: r.width, h: r.height }));
    };
    const raf = requestAnimationFrame(measure);
    const iv = window.setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
      window.removeEventListener('resize', measure);
    };
  }, [hud]);
  return (
    <AnimatePresence>
      {hud && box && (
        <motion.div
          key={hud}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          aria-hidden
          className="pointer-events-none fixed z-[79] rounded-lg ring-2 ring-brass-400 shadow-[0_0_0_4px_rgba(221,190,126,.18),0_0_24px_rgba(221,190,126,.45)]"
          style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + 2 * PAD, height: box.h + 2 * PAD }}
        >
          <span className="absolute inset-0 animate-pulse rounded-lg ring-1 ring-brass-300/70" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(LessonHalo);
