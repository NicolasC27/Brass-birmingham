import { Coffee, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import RankBadge from './RankBadge';
import type { TableMode } from './mockData';

/* ------------------------------------------------------------------ */
/* ModeCard (design.md §7.3) — Normal / Classé, sélectionnable.        */
/* Mention honnête du classé : SAISON 1 · CLASSEMENT BÊTA (§10).       */
/* Hors ligne : désactivée + « Serveur hors ligne » (home.md §S3).     */
/* ------------------------------------------------------------------ */

export interface ModeCardProps {
  mode: TableMode;
  active?: boolean;
  disabled?: boolean;
  /** joueurs en file + estimation, pour la méta */
  queueCount?: number;
  estimateMin?: number;
  /** rang affiché sur la carte classée */
  rank?: { tier: 'bronze' | 'fer' | 'acier' | 'laiton' | 'or' | 'maitre'; division?: string };
  /** variante horizontale compacte (home §S3, h-88px) */
  compact?: boolean;
  onSelect?: (mode: TableMode) => void;
  className?: string;
}

export default function ModeCard({
  mode,
  active = false,
  disabled = false,
  queueCount = 0,
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
  const copy = ranked
    ? t('platform.home.modes.rankedCopy', { count: queueCount, minutes: estimateMin })
    : t('platform.home.modes.normalCopy', { count: queueCount, minutes: estimateMin });

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? t('platform.serverOffline') : undefined}
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
        <span className="mt-0.5 block truncate font-ui text-[13px] text-paper-300">
          {disabled ? t('platform.home.modes.offline') : copy}
        </span>
        {ranked && <span className="micro-label mt-1 block text-[9px] text-iron-600">{t('platform.rank.beta')}</span>}
      </span>
    </button>
  );
}
