import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Skeleton (design.md §7.8) — barres enamel-700, shimmer 1.6s         */
/* (désactivé en reduced-motion via le garde CSS de index.css).        */
/* ------------------------------------------------------------------ */

export interface SkeletonProps {
  className?: string;
  /** nombre de barres empilées */
  lines?: number;
}

export default function Skeleton({ className, lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer h-4 rounded bg-enamel-700',
        'bg-[linear-gradient(100deg,rgb(var(--enamel-700))_40%,rgb(var(--enamel-line))_50%,rgb(var(--enamel-700))_60%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
