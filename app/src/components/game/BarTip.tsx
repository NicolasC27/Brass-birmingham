import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * The turn strip's own hint: a small dark slip hung under the strip,
 * never over it and never past the window's edge. It stands in for the
 * browser's `title`, which the system draws wherever the pointer happens
 * to be, in its own face, over the board. Hover or keyboard focus shows
 * it after a short wait; a press puts it away, the button has answered.
 */
export default function BarTip({ tip, keys, off, children }: { tip: ReactNode; keys?: string; off?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  /* a button that cannot be pressed has nothing to say */
  const shown = open && !off;
  const anchor = useRef<HTMLSpanElement>(null);
  const slip = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const show = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    clear();
    setOpen(false);
  };

  /* placed once the slip is laid out, so its own width can be read: centred
     on the button, below the strip's bottom edge, held inside the window */
  useLayoutEffect(() => {
    const el = slip.current;
    if (!shown || !el) return;
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const strip = anchor.current?.closest('[data-topbar]')?.getBoundingClientRect();
    const w = el.getBoundingClientRect().width;
    el.style.top = `${Math.round((strip ? strip.bottom : a.bottom) + 6)}px`;
    el.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - 8 - w, a.left + a.width / 2 - w / 2)))}px`;
  });

  return (
    <span
      ref={anchor}
      className="inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        /* only the keyboard's focus: a click has already been answered */
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) show();
      }}
      onBlur={hide}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {shown && (
              /* over the rails and the tracks under the strip, beneath any
                 sheet that rises over the table (the mat, the scoring) */
              <motion.span
                ref={slip}
                role="tooltip"
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none fixed left-0 top-0 z-[73] flex w-max max-w-[280px] items-center gap-2 rounded-md border border-brass-700/60 bg-coal-900/95 px-2.5 py-1.5 font-sans text-[11.5px] leading-snug text-cream-100/90 shadow-e3"
              >
                <span>{tip}</span>
                {keys && <kbd className="rounded-[3px] border border-brass-700/60 px-1 font-mono text-[10px] leading-[14px] text-brass-400">{keys}</kbd>}
              </motion.span>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
