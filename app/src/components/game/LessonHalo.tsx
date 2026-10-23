import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/game/store';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The lesson's halo: a brass ring drawn around each part of the HUD    */
/* the guide is talking about — the element that carries the matching   */
/* `data-lens` mark. Measured from the element itself, so it follows    */
/* the layout, and a hair wider than it so the thing stays readable.    */
/* A mark inside the guide's own note (its Show button) is rung above   */
/* the note; any other under it, which it must never cover.             */
/* ------------------------------------------------------------------ */

const PAD = 6;

interface Box {
  word: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** the element sits in the guide's note */
  inNote: boolean;
}

const same = (a: Box[], b: Box[]): boolean =>
  a.length === b.length && a.every((p, i) => p.word === b[i].word && p.inNote === b[i].inNote && Math.abs(p.x - b[i].x) < 1 && Math.abs(p.y - b[i].y) < 1 && Math.abs(p.w - b[i].w) < 1 && Math.abs(p.h - b[i].h) < 1);

function LessonHalo() {
  const hud = useGame((s) => s.lens?.hud ?? null);
  /* one word or several: kept as a string, so an equal list is the same */
  const words = hud === null ? '' : Array.isArray(hud) ? hud.join(' ') : hud;
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    if (!words) return;
    const measure = () => {
      const next = words.split(' ').flatMap((word): Box[] => {
        /* a mark is a word of the element's list: a disc may stand for two parts */
        const el = document.querySelector<HTMLElement>(`[data-lens~="${word}"]`);
        const r = el?.getBoundingClientRect();
        if (!el || !r || r.width === 0 || r.height === 0) return [];
        return [{ word, x: r.left, y: r.top, w: r.width, h: r.height, inNote: !!el.closest('[data-guide]') }];
      });
      setBoxes((prev) => (same(prev, next) ? prev : next));
    };
    const raf = requestAnimationFrame(measure);
    const iv = window.setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
      window.removeEventListener('resize', measure);
    };
  }, [words]);
  return (
    <AnimatePresence>
      {boxes
        /* a ring measured for the lens before is not drawn for this one */
        .filter((box) => words.split(' ').includes(box.word))
        .map((box) => (
          <motion.div
            key={box.word}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden
            className={cn('pointer-events-none fixed rounded-lg ring-2 ring-brass-400 shadow-[0_0_0_4px_rgba(221,190,126,.18),0_0_24px_rgba(221,190,126,.45)]', box.inNote ? 'z-[81]' : 'z-[79]')}
            style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + 2 * PAD, height: box.h + 2 * PAD }}
          >
            <span className="absolute inset-0 animate-pulse rounded-lg ring-1 ring-brass-300/70" />
          </motion.div>
        ))}
    </AnimatePresence>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(LessonHalo);
