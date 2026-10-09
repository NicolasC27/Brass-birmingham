import { PLACEMENTS } from '@/platform/rank';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import RankEmblem from './RankEmblem';

/* ------------------------------------------------------------------ */
/* RankBadge (design.md §7.5) — emblème (RankEmblem, inked from the    */
/* register) + nom de rang + LP.                                       */
/* Tiers : bronze, fer, acier, laiton, or, maître. Non placé :         */
/* emblème « ? » + PLACEMENTS n/5 (les cinq du bureau).                 */
/* ------------------------------------------------------------------ */

export type RankTier = 'bronze' | 'fer' | 'acier' | 'laiton' | 'or' | 'maitre';

export interface RankBadgeProps {
  tier: RankTier | 'placement';
  /** division romaine optionnelle (II, I…) */
  division?: string;
  lp?: number;
  /** joueurs en placement : victoires / 10 */
  placementDone?: number;
  /** emblème 20–40px */
  size?: number;
  /** cache le texte (pastille seule) */
  compact?: boolean;
  className?: string;
}

export default function RankBadge({ tier, division, lp, placementDone, size = 32, compact = false, className }: RankBadgeProps) {
  const t = useT();
  const name = tier === 'placement' ? null : t(`platform.rank.${tier}`);

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <RankEmblem tier={tier} size={size} />
      {!compact && (
        <span className="flex flex-col leading-tight">
          {tier === 'placement' ? (
            <span className="micro-label text-iron-400">{t('platform.rank.placement', { done: placementDone ?? 0, total: PLACEMENTS })}</span>
          ) : (
            <>
              <span className="font-ui text-[13px] font-semibold text-paper-100">
                {name}
                {division ? ` ${division}` : ''}
              </span>
              {lp !== undefined && <span className="data-text text-iron-400">{t('platform.rank.lp', { lp })}</span>}
            </>
          )}
        </span>
      )}
    </span>
  );
}
