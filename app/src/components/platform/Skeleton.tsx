import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Skeleton (design.md §7.8) — barres enamel-700, shimmer 1.6s         */
/* (désactivé en reduced-motion via le garde CSS de index.css).        */
/*                                                                     */
/* The wait has its own drawing: a page that serves the empty state    */
/* while the office is still answering tells the reader something      */
/* false, then contradicts it a moment later. `=== null` is a wait and */
/* belongs here; `.length === 0` is an absence and belongs to          */
/* EmptyState. A wait that carries a `label` also speaks: it is a      */
/* polite status, so the bell that rings on arrival is announced.      */
/* ------------------------------------------------------------------ */

/** line = a run of bars · card = a console's worth · table = ruled rows */
export type SkeletonShape = 'line' | 'card' | 'table';

export interface SkeletonProps {
  className?: string;
  /** nombre de barres empilées */
  lines?: number;
  /** ce qui attend : une ligne, une fiche, un tableau */
  shape?: SkeletonShape;
  /** nombre de fiches ou de lignes du tableau */
  rows?: number;
  /** ce que l'attente annonce, pour qui ne la voit pas */
  label?: string;
}

/** one bar of the wait */
function Bar({ className }: { className?: string }) {
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

export default function Skeleton({ className, lines = 1, shape = 'line', rows = 3, label }: SkeletonProps) {
  const spoken = label
    ? ({ role: 'status', 'aria-live': 'polite' as const, 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const);

  if (shape === 'card') {
    return (
      <div {...spoken} className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="console p-4">
            <Bar className="h-3 w-24" />
            <Bar className="mt-3 h-5 w-2/3" />
            <Bar className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (shape === 'table') {
    return (
      <div {...spoken} className={cn('flex flex-col', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--gz-ink-faint)] py-2.5 last:border-b-0">
            <Bar className="h-3 w-8 shrink-0" />
            <Bar className="h-3 flex-1" />
            <Bar className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (lines > 1) {
    return (
      <div {...spoken} className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
        ))}
      </div>
    );
  }

  return label ? (
    <div {...spoken}>
      <Bar className={className} />
    </div>
  ) : (
    <Bar className={className} />
  );
}
