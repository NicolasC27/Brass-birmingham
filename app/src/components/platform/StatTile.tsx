import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* StatTile (design.md §7.8) — valeur Fraunces 26px + micro-label +    */
/* delta mono (+12 bottle / −8 rust). An emblem may hang in the top    */
/* right corner, out of the line of reading: `badge` for a mark that   */
/* says something (the rank), `icon` for one that only names the tile  */
/* (the purse). A tile stretched by its row can spread: the figure at  */
/* the top, the label at the foot, instead of both stuck to the top.   */
/* ------------------------------------------------------------------ */

export interface StatTileProps {
  value: string | number;
  label: string;
  /** delta signé ; 0/undefined → pas de delta */
  delta?: number;
  /** a mark in the corner that carries meaning (a compact RankBadge) */
  badge?: ReactNode;
  /** a glyph in the corner that only names the tile, drawn in brass */
  icon?: ReactNode;
  /** the figure at the top and the label at the foot, when the row is taller than the tile */
  spread?: boolean;
  className?: string;
}

export default function StatTile({ value, label, delta, badge, icon, spread = false, className }: StatTileProps) {
  const corner = badge ?? icon;
  return (
    <div className={cn('console relative p-4', spread && 'flex flex-col justify-between gap-2', className)}>
      {corner && (
        <span aria-hidden={badge ? undefined : true} className={cn('absolute right-4 top-4 flex', !badge && 'text-brass-300')}>
          {corner}
        </span>
      )}
      <div className={cn('flex items-baseline gap-2', corner && 'pr-10')}>
        <span className="font-fraunces text-[26px] font-normal leading-none text-paper-100 tnums">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn('data-text', delta > 0 ? 'text-bottle-ink' : 'text-rust-400')}>{delta > 0 ? `+${delta}` : delta}</span>
        )}
      </div>
      <p className={cn('micro-label text-iron-400', !spread && 'mt-2')}>{label}</p>
    </div>
  );
}
