import { Coffee, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import RankBadge, { type RankTier } from './RankBadge';

/* ------------------------------------------------------------------ */
/* ModeCard (design.md §7.3) — Normal / Classé, sélectionnable.        */
/* La méta vient de l'office : gens dans la file, estimation honnête   */
/* (« ~1 min » en normal, « 2–4 min » en classé). Indisponible : la    */
/* carte se grise et dit pourquoi (serveur hors ligne, adresse à       */
/* vérifier). The ranked card is told by its trophy, its rank and the  */
/* brass of the honours — the rust is kept for what is lost or undone. */
/* Compact, the wait takes a line of its own rather than an ellipsis.  */
/* ------------------------------------------------------------------ */

/** the two counters of the hub: the quick queue reads « normal » on the site */
export type TableMode = 'normal' | 'ranked';

export interface ModeCardProps {
  mode: TableMode;
  active?: boolean;
  disabled?: boolean;
  /** shown in place of the copy while disabled (default: server offline) */
  disabledReason?: string;
  /** people in this queue */
  queueCount?: number;
  /** a ready-made estimate (« 2–4 min ») — wins over estimateMin */
  estimate?: string;
  estimateMin?: number;
  /** rang affiché sur la carte classée */
  rank?: { tier: RankTier | 'placement'; division?: string };
  /** variante horizontale compacte (home §S3, h-88px) */
  compact?: boolean;
  onSelect?: (mode: TableMode) => void;
  className?: string;
}

export default function ModeCard({
  mode,
  active = false,
  disabled = false,
  disabledReason,
  queueCount = 0,
  estimate,
  estimateMin = 0,
  rank,
  compact = false,
  onSelect,
  className,
}: ModeCardProps) {
  const t = useT();
  const ranked = mode === 'ranked';
  const Icon = ranked ? Trophy : Coffee;

  const title = ranked ? t('platform.home.modes.rankedTitle') : t('platform.home.modes.normalTitle');
  const wait = estimate ?? t('platform.queue.estimate', { minutes: estimateMin });
  const copy = ranked ? t('platform.queue.rankedMeta', { count: queueCount, estimate: wait }) : t('platform.queue.normalMeta', { count: queueCount, estimate: wait });
  const reason = disabledReason ?? t('platform.home.modes.offline');

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? reason : undefined}
      onClick={() => onSelect?.(mode)}
      className={cn(
        'group flex w-full items-center gap-4 border bg-enamel-850 p-4 text-left transition-all duration-150 ease-out',
        ranked ? 'hover:border-brass-400' : 'hover:border-bottle-500',
        active && (ranked ? 'border-2 border-brass-400 bg-enamel-800' : 'border-2 border-bottle-500 bg-enamel-800'),
        !active && 'border-[var(--gz-line-control)] hover:bg-enamel-800',
        /* the card is a command, so the rule around it is a command's rule; put
           out, it is painted from the register's off plate and not veiled */
        disabled && 'is-off',
        /* compact, the three cards of the strip stand level: a wait that takes
           a second line lengthens the row, not one card */
        compact && 'h-full min-h-[76px]',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-transform duration-150 group-hover:translate-x-0.5',
          ranked ? 'border-brass-400/50 text-brass-300' : 'border-bottle-400/50 text-bottle-ink',
          'group-disabled:border-[var(--gz-ink-faint)] group-disabled:text-[rgb(var(--state-off-ink))]',
        )}
      >
        <Icon size={18} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="title-card group-disabled:text-[rgb(var(--state-off-ink))]">{title}</span>
          {ranked && rank && <RankBadge tier={rank.tier} division={rank.division} size={20} compact />}
        </span>
        <span className="mt-0.5 line-clamp-2 font-ui text-[12.5px] leading-snug text-paper-300 group-disabled:text-[rgb(var(--state-off-ink))]">{disabled ? reason : copy}</span>
      </span>
    </button>
  );
}
