import { Flag, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { ago } from './ago';

/* ------------------------------------------------------------------ */
/* ActivityFeedItem — a line of the club's news: a small mark, the     */
/* sentence in the serif, the time in the mono at the end of the line, */
/* « il y a 4 min », counted from the real instant. A rule under each. */
/* ------------------------------------------------------------------ */

/** what the club's feed can say: my finished games, the tables in play */
export type FeedKind = 'gameWon' | 'gameOver' | 'tableLive';

const ICONS: Record<FeedKind, LucideIcon> = {
  gameWon: Trophy,
  gameOver: Flag,
  tableLive: Swords,
};


export interface ActivityFeedItemProps {
  kind: FeedKind;
  vars: Record<string, string | number>;
  /** the line to print, when the chronicle has its own way of telling it */
  textKey?: string;
  /** when it happened (ms since the epoch) */
  at: number;
  onClick?: () => void;
  className?: string;
}

export default function ActivityFeedItem({ kind, vars, at, textKey, onClick, className }: ActivityFeedItemProps) {
  const t = useT();
  const lang = useLang();
  const Icon = ICONS[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-[var(--gz-ink-faint)] px-1 py-2.5 text-left transition-colors duration-150 hover:bg-enamel-800',
        className,
      )}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden className={cn('shrink-0', kind === 'tableLive' ? 'text-signal-ink' : 'text-brass-300')} />
      <span className="min-w-0 flex-1 truncate font-serif text-[13.5px] text-paper-100">{t(textKey ?? `platform.home.feed.${kind}`, vars)}</span>
      <span className="data-text shrink-0 text-[11px] text-iron-400 tnums">{ago(t, lang, at)}</span>
    </button>
  );
}
