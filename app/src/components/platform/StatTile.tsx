import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* StatTile (design.md §7.8) — valeur Fraunces 28px + micro-label +    */
/* delta mono (+12 bottle / −8 rust).                                  */
/* ------------------------------------------------------------------ */

export interface StatTileProps {
  value: string | number;
  label: string;
  /** delta signé ; 0/undefined → pas de delta */
  delta?: number;
  className?: string;
}

export default function StatTile({ value, label, delta, className }: StatTileProps) {
  return (
    <div className={cn('console p-4', className)}>
      <div className="flex items-baseline gap-2">
        <span className="font-fraunces text-[26px] font-normal leading-none text-paper-100 tnums">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn('data-text text-[12px]', delta > 0 ? 'text-bottle-400' : 'text-rust-400')}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <p className="micro-label mt-2 text-iron-400">{label}</p>
    </div>
  );
}
