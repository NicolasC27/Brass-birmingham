import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import SeatToken from './SeatToken';
import Button from './Button';
import type { DemoTable } from './mockData';

/* ------------------------------------------------------------------ */
/* TableCard (design.md §7.2) — panneau enamel-850, hairline laiton,   */
/* radius 12px : nom + ribbon d'état, rangée de SeatToken, badges      */
/* mode/visibilité/région + CTA selon état.                            */
/* ------------------------------------------------------------------ */

const spring = { type: 'spring', stiffness: 260, damping: 24 } as const;

function StateRibbon({ state, pulse }: { state: DemoTable['state']; pulse: boolean }) {
  const t = useT();
  const styles: Record<DemoTable['state'], string> = {
    open: 'bg-bottle-700/60 text-bottle-400',
    live: 'bg-[rgb(var(--signal-400)/.12)] text-signal-400',
    full: 'bg-enamel-700 text-iron-400',
  };
  return (
    <span className={cn('micro-label flex h-[22px] items-center gap-1.5 rounded-full px-2.5', styles[state])}>
      {state === 'live' && (
        <span className={cn('h-1.5 w-1.5 rounded-full bg-signal-400', pulse && 'animate-pulse-signal')} aria-hidden />
      )}
      {t(`platform.state.${state}`)}
    </span>
  );
}

function ModeBadge({ mode, visibility }: { mode: DemoTable['mode']; visibility: DemoTable['visibility'] }) {
  const t = useT();
  return (
    <>
      <span
        className={cn(
          'micro-label rounded px-1.5 py-0.5',
          mode === 'ranked' ? 'bg-rust-700/50 text-rust-400' : 'bg-bottle-700/60 text-bottle-400',
        )}
      >
        {t(`platform.mode.${mode}`)}
      </span>
      <span className="micro-label rounded bg-enamel-700 px-1.5 py-0.5 text-iron-400">{t(`platform.mode.${visibility}`)}</span>
    </>
  );
}

export interface TableCardProps {
  table: DemoTable;
  /** désactive le pulse du ribbon EN COURS (max 3 pulses / viewport, home.md §S2) */
  pulse?: boolean;
  /** CTA « Reprendre » (ma table en cours) */
  mine?: boolean;
  onJoin?: (table: DemoTable) => void;
  onResume?: (table: DemoTable) => void;
  onWatch?: (table: DemoTable) => void;
  className?: string;
}

export default function TableCard({ table, pulse = true, mine = false, onJoin, onResume, onWatch, className }: TableCardProps) {
  const t = useT();
  const filled = table.seats.filter(Boolean).length;

  const cta = mine ? (
    <Button variant="live" className="!h-8 px-3 text-[13px]" onClick={() => onResume?.(table)}>
      {t('platform.action.resume')}
    </Button>
  ) : table.state === 'open' ? (
    <Button variant="primary" className="!h-8 px-3 text-[13px]" onClick={() => onJoin?.(table)}>
      {t('platform.action.join')}
    </Button>
  ) : table.state === 'live' && onWatch ? (
    <Button variant="ghost" className="!h-8 px-3 text-[13px]" icon={<Eye size={16} aria-hidden />} onClick={() => onWatch(table)}>
      {t('platform.action.watch')}
    </Button>
  ) : (
    <Button variant="ghost" className="!h-8 px-3 text-[13px]" disabled>
      {t('platform.action.full')}
    </Button>
  );

  return (
    <motion.article
      layout
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, x: 12 }}
      transition={spring}
      className={cn(
        'rounded-xl border border-brass-hairline bg-enamel-850 p-4 transition-colors duration-150 ease-out',
        'hover:border-brass-hairline-strong hover:bg-enamel-800',
        className,
      )}
      aria-label={table.name}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="title-card truncate">{table.name}</h3>
        <StateRibbon state={table.state} pulse={pulse} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-end gap-2">
          {table.seats.map((s, i) => (
            <SeatToken key={i} seat={s} index={i} />
          ))}
        </div>
        <span className="micro-label whitespace-nowrap text-iron-400">{t('platform.state.seats', { filled, total: table.seats.length })}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[rgb(var(--paper-100)/.07)] pt-3">
        <div className="flex items-center gap-1.5">
          <ModeBadge mode={table.mode} visibility={table.visibility} />
          <span className="data-text ml-1 text-[11px] text-iron-600">
            {table.region} · {table.latencyMs} ms
            {table.state !== 'open' && table.round !== undefined ? ` · ${t('platform.state.turn', { round: table.round })}` : ''}
          </span>
        </div>
        {cta}
      </div>
    </motion.article>
  );
}
