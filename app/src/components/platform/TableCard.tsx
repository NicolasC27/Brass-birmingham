import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { CardTable, TableMode, TableState } from '@/platform/tables';
import SeatToken from './SeatToken';
import Button from './Button';

/* ------------------------------------------------------------------ */
/* TableCard (design.md §7.2) — panneau enamel-850, hairline laiton,   */
/* radius 12px : nom + ribbon d'état, rangée de SeatToken, badge mode  */
/* + ligne de registre (hôte, ère · tour, présents) + CTA selon état.  */
/* Les données viennent du registre de l'office (platform/tables.ts).  */
/* ------------------------------------------------------------------ */

const spring = { type: 'spring', stiffness: 260, damping: 24 } as const;

function StateRibbon({ state, pulse }: { state: TableState; pulse: boolean }) {
  const t = useT();
  const styles: Record<TableState, string> = {
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

function ModeBadge({ mode }: { mode: TableMode }) {
  const t = useT();
  return (
    <span
      className={cn(
        'micro-label rounded px-1.5 py-0.5',
        mode === 'ranked' ? 'bg-rust-700/50 text-rust-400' : 'bg-bottle-700/60 text-bottle-400',
      )}
    >
      {t(`platform.mode.${mode}`)}
    </span>
  );
}

export interface TableCardProps {
  table: CardTable;
  /** désactive le pulse du ribbon EN COURS (max 3 pulses / viewport, home.md §S2) */
  pulse?: boolean;
  onJoin?: (table: CardTable) => void;
  /** ma table : retour au salon (ouverte) ou à la partie (en cours) */
  onResume?: (table: CardTable) => void;
  onWatch?: (table: CardTable) => void;
  className?: string;
}

export default function TableCard({ table, pulse = true, onJoin, onResume, onWatch, className }: TableCardProps) {
  const t = useT();
  const filled = table.seats.filter(Boolean).length;
  const btn = '!h-8 px-3 text-[13px]';

  const cta = table.mine ? (
    <Button variant={table.state === 'live' ? 'live' : 'primary'} className={btn} onClick={() => onResume?.(table)}>
      {table.state === 'live' ? (table.myTurn ? t('platform.play.tables.yourTurn') : t('platform.action.resume')) : t('platform.action.enterLobby')}
    </Button>
  ) : table.state === 'open' ? (
    table.mode === 'ranked' ? (
      <Button variant="ghost" className={btn} disabled title={t('platform.play.tables.viaQueueHint')}>
        {t('platform.play.tables.viaQueue')}
      </Button>
    ) : (
      <Button variant="primary" className={btn} onClick={() => onJoin?.(table)}>
        {t('platform.action.join')}
      </Button>
    )
  ) : table.state === 'live' ? (
    onWatch ? (
      <Button variant="ghost" className={btn} icon={<Eye size={16} aria-hidden />} onClick={() => onWatch(table)}>
        {t('platform.action.watch')}
      </Button>
    ) : null
  ) : (
    <Button variant="ghost" className={btn} disabled>
      {t('platform.action.full')}
    </Button>
  );

  /* la ligne de registre : l'hôte quand la table attend, l'ère et le tour quand elle joue */
  const line =
    table.state === 'live'
      ? [
          table.era ? t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal') : null,
          table.round !== undefined ? (table.rounds ? t('platform.play.tables.roundOf', { round: table.round, total: table.rounds }) : t('platform.state.turn', { round: table.round })) : null,
          table.toAct ? t('platform.play.tables.toAct', { name: table.toAct.name }) : null,
        ]
      : [t('platform.play.tables.host', { name: table.hostName })];

  return (
    <motion.article
      layout
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, x: 12 }}
      transition={spring}
      className={cn(
        'console p-4 transition-colors duration-150 ease-out',
        'hover:border-brass-hairline-strong hover:bg-enamel-800',
        table.myTurn && 'border-[rgb(var(--signal-400)/.5)]',
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
        <div className="flex min-w-0 items-center gap-1.5">
          <ModeBadge mode={table.mode} />
          <span className="data-text ml-1 truncate text-[11px] text-iron-600 tnums">{line.filter(Boolean).join(' · ')}</span>
          {table.state === 'live' && table.watchers > 0 && (
            <span className="data-text flex shrink-0 items-center gap-1 text-[11px] text-iron-600 tnums" title={t('platform.play.tables.watchers', { count: table.watchers })}>
              <Eye size={12} aria-hidden />
              {table.watchers}
            </span>
          )}
        </div>
        {cta}
      </div>
    </motion.article>
  );
}
