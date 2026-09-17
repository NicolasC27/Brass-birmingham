import { Coffee, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import RankBadge, { type RankTier } from './RankBadge';

/* ------------------------------------------------------------------ */
/* ModeCard (design.md §7.3) — Normal / Classé, sélectionnable.        */
/* La méta vient de l'office : gens dans la file, estimation honnête   */
/* (« ~1 min » en normal, « 2–4 min » en classé). Indisponible : la    */
/* carte se grise et dit pourquoi (serveur hors ligne, adresse à       */
/* vérifier).                                                          */
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
        'group flex w-full items-center gap-4 rounded-xl border bg-enamel-850 p-4 text-left transition-all duration-150 ease-out',
        ranked ? 'hover:border-rust-600' : 'hover:border-bottle-500',
        active && (ranked ? 'border-2 border-rust-600 bg-enamel-800' : 'border-2 border-bottle-500 bg-enamel-800'),
        !active && 'border-brass-hairline hover:bg-enamel-800',
        disabled && 'cursor-not-allowed opacity-55 hover:border-brass-hairline hover:bg-enamel-850',
        compact && 'h-[88px]',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:translate-x-0.5',
          ranked ? 'bg-rust-700/50 text-rust-400' : 'bg-bottle-700/60 text-bottle-400',
        )}
      >
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-ui text-[15px] font-semibold text-paper-100">{title}</span>
          {ranked && rank && <RankBadge tier={rank.tier} division={rank.division} size={20} compact />}
        </span>
        <span className="mt-0.5 block truncate font-ui text-[13px] text-paper-300">{disabled ? reason : copy}</span>
      </span>
    </button>
  );
}
