import { DoorOpen, Medal, Timer, Trophy, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { FeedKind } from './mockData';

/* ------------------------------------------------------------------ */
/* ActivityFeedItem (design.md §7.8) — icône 16px de mode + phrase     */
/* 13px + horodatage mono « il y a 4 min ».                            */
/* ------------------------------------------------------------------ */

const ICONS: Record<FeedKind, LucideIcon> = {
  tableOpened: DoorOpen,
  joinedQueue: Timer,
  gameWon: Trophy,
  newRank: Medal,
  tableFull: Users,
};

function ago(t: ReturnType<typeof useT>, minutes: number): string {
  if (minutes < 1) return t('platform.time.now');
  if (minutes < 60) return t('platform.time.minutesAgo', { count: minutes });
  return t('platform.time.hoursAgo', { count: Math.floor(minutes / 60) });
}

export interface ActivityFeedItemProps {
  kind: FeedKind;
  vars: Record<string, string | number>;
  minutesAgo: number;
  onClick?: () => void;
  className?: string;
}

export default function ActivityFeedItem({ kind, vars, minutesAgo, onClick, className }: ActivityFeedItemProps) {
  const t = useT();
  const Icon = ICONS[kind];
  const resolved = { ...vars, ...(vars.mode ? { mode: t(`platform.mode.${vars.mode}`) } : {}) };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-enamel-800',
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass-hairline bg-enamel-700 text-brass-300">
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate font-ui text-[13px] text-paper-300">{t(`platform.home.feed.${kind}`, resolved)}</span>
      <span className="data-text shrink-0 text-[11px] text-iron-600">{ago(t, minutesAgo)}</span>
    </button>
  );
}
