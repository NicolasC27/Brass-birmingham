import { Flag, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT, localeOf } from '@/i18n';

/* ------------------------------------------------------------------ */
/* ActivityFeedItem (design.md §7.8) — icône 16px + phrase 13px +      */
/* horodatage mono « il y a 4 min », calculé depuis l'instant réel.    */
/* ------------------------------------------------------------------ */

/** what the club's feed can say: my finished games, the tables in play */
export type FeedKind = 'gameWon' | 'gameOver' | 'tableLive';

const ICONS: Record<FeedKind, LucideIcon> = {
  gameWon: Trophy,
  gameOver: Flag,
  tableLive: Swords,
};

/** « il y a 4 min », then hours, then days; a date past the week */
function ago(t: ReturnType<typeof useT>, lang: string, at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return t('platform.time.now');
  if (minutes < 60) return t('platform.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('platform.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('platform.time.daysAgo', { count: days });
  return new Date(at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short' });
}

export interface ActivityFeedItemProps {
  kind: FeedKind;
  vars: Record<string, string | number>;
  /** when it happened (ms since the epoch) */
  at: number;
  onClick?: () => void;
  className?: string;
}

export default function ActivityFeedItem({ kind, vars, at, onClick, className }: ActivityFeedItemProps) {
  const t = useT();
  const lang = useLang();
  const Icon = ICONS[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-enamel-800',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass-hairline bg-enamel-700',
          kind === 'tableLive' ? 'text-signal-400' : 'text-brass-300',
        )}
      >
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate font-ui text-[13px] text-paper-300">{t(`platform.home.feed.${kind}`, vars)}</span>
      <span className="data-text shrink-0 text-[11px] text-iron-600 tnums">{ago(t, lang, at)}</span>
    </button>
  );
}
