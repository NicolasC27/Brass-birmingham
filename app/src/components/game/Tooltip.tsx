import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { placeTip } from './tooltipPlace';

/**
 * Contextual tooltip (design.md §6.4) — dark plate, brass rule, 250ms hover
 * delay, 120ms fade + 4px rise. Mirrors content into an aria-live inspector.
 * The plate is laid at the body's level, placed from the anchor's box, so
 * a lane that clips its overflow (the tracks) or a dock above it (the
 * hand) never hides it, and slid back inside the screen when centring it
 * on the anchor would cut it at an edge.
 */
export default function Tooltip({
  title,
  children,
  content,
  side = 'top',
  gap,
  className,
}: {
  title?: string;
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** px between the plate and the anchor (8 by default) */
  gap?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /* the plate's own size, measured as it mounts (before it is painted) */
  const [plate, setPlate] = useState<{ w: number; h: number } | null>(null);
  const measure = useCallback((el: HTMLSpanElement | null) => {
    if (el) setPlate((was) => (was && was.w === el.offsetWidth && was.h === el.offsetHeight ? was : { w: el.offsetWidth, h: el.offsetHeight }));
  }, []);
  const timer = useRef<number | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const place = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
  };
  const show = () => {
    timer.current = window.setTimeout(() => {
      place();
      setOpen(true);
    }, 250);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };

  /* where the plate goes, from the anchor's box on the screen: pinned by
     the edge that faces the anchor, centred on it, kept on the screen */
  const at = box ? placeTip(side, box, plate, window.innerWidth, window.innerHeight, gap) : null;
  const vertical = side === 'top' || side === 'bottom';
  const rest = { x: 0, y: 0 };
  const from = vertical ? { x: 0, y: side === 'top' ? 4 : -4 } : { x: side === 'left' ? 4 : -4, y: 0 };

  return (
    <span
      ref={anchor}
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => {
        place();
        setOpen((o) => !o);
      }}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && at && (
              <motion.span
                ref={measure}
                role="tooltip"
                initial={{ opacity: 0, ...from }}
                animate={{ opacity: 1, ...rest }}
                exit={{ opacity: 0, ...from }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none fixed z-[80] w-max max-w-[260px] rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 text-left shadow-e3"
                style={at}
              >
                {title && (
                  <>
                    <span className="block font-fell text-sm tracking-wide text-brass-400">{title}</span>
                    <span className="my-1.5 block h-px bg-brass-700/50" />
                  </>
                )}
                <span className="block font-sans text-[12.5px] leading-relaxed text-cream-100/90">{content}</span>
              </motion.span>
            )}
          </AnimatePresence>,
          document.body,
        )}
      {/* aria-live inspector mirror */}
      <span className="sr-only" aria-live="polite">
        {open ? `${title ?? ''} ` : ''}
      </span>
    </span>
  );
}
