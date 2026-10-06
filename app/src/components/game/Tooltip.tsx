import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Contextual tooltip (design.md §6.4) — dark plate, brass rule, 250ms hover
 * delay, 120ms fade + 4px rise. Mirrors content into an aria-live inspector.
 * The plate is laid at the body's level, placed from the anchor's box, so
 * a lane that clips its overflow (the tracks) or a dock above it (the
 * hand) never hides it.
 */
export default function Tooltip({
  title,
  children,
  content,
  side = 'top',
  className,
}: {
  title?: string;
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
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

  /* where the plate goes, from the anchor's box on the screen */
  const at = box
    ? side === 'top'
      ? { left: box.x + box.w / 2, top: box.y - 8, transform: 'translate(-50%, -100%)' }
      : side === 'bottom'
        ? { left: box.x + box.w / 2, top: box.y + box.h + 8, transform: 'translate(-50%, 0)' }
        : side === 'left'
          ? { left: box.x - 8, top: box.y + box.h / 2, transform: 'translate(-100%, -50%)' }
          : { left: box.x + box.w + 8, top: box.y + box.h / 2, transform: 'translate(0, -50%)' }
    : null;

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
                role="tooltip"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
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
