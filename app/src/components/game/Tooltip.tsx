import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Contextual tooltip (design.md §6.4) — dark plate, brass rule, 250ms hover
 * delay, 120ms fade + 4px rise. Mirrors content into an aria-live inspector.
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
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const show = () => {
    timer.current = window.setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };

  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : side === 'bottom'
        ? 'top-full left-1/2 -translate-x-1/2 mt-2'
        : side === 'left'
          ? 'right-full top-1/2 -translate-y-1/2 mr-2'
          : 'left-full top-1/2 -translate-y-1/2 ml-2';

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => setOpen((o) => !o)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'pointer-events-none absolute z-[70] w-max max-w-[260px] rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 text-left shadow-e3',
              pos,
            )}
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
      </AnimatePresence>
      {/* aria-live inspector mirror */}
      <span className="sr-only" aria-live="polite">
        {open ? `${title ?? ''} ` : ''}
      </span>
    </span>
  );
}
