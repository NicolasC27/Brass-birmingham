import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { tableRoom } from '@/online/parlour';
import { focusRoom, useParlour, useRoom } from '@/online/talk';
import { Tape } from '@/components/platform/Telegraph';
import { cn } from '@/lib/utils';
import { useLayer } from './useLayer';

/* The table's wire — free lines between the seats of an online table,
   beside the printed telegrams. The button lives with the tools under
   the players; the sheet hangs under it and reads as a tape. A watcher
   reads along; only a seat may write. At home there is nobody to wire. */

export function TableWireButton({ className }: { className: string }) {
  const t = useT();
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const game = useGame((s) => s.game);
  const room = code && seat !== null ? tableRoom(code) : null;
  const view = useRoom(room);
  const p = useParlour();
  const unread = room ? (p.unread[room] ?? 0) : 0;
  const [open, setOpen] = useState(false);
  const sheet = useLayer(open, () => setOpen(false), { zone: 'left' });
  /* the sheet up is the room being read; down, or the page left, it is not */
  useEffect(() => {
    if (!room) return;
    focusRoom(open ? room : null);
    return () => focusRoom(null);
  }, [open, room]);
  if (!room || !game) return null;
  const label = t('game.wire.open');
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={label} aria-label={label} className={cn(className, open && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
        <MessageSquare className="h-4 w-4" />
        {unread > 0 && !open && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-brass-400 px-1.5 font-mono text-[9px] font-bold leading-[14px] text-coal-950" aria-label={t('game.wire.unreadAria', { n: unread })}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={sheet}
            tabIndex={-1}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role="region"
            aria-label={t('game.wire.title')}
            className="plaque absolute left-0 top-full z-[72] mt-2 flex h-[380px] w-[400px] flex-col overflow-hidden rounded-md"
          >
            <div className="flex items-center justify-between border-b border-brass-500/25 px-3 py-1.5">
              <span className="engraved-brass font-fell text-[12px] tracking-[0.08em]">{t('game.wire.title')}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('game.notice.dismiss')} className="text-brass-500/70 hover:text-brass-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Tape room={room} lines={view.lines} more={view.more} readOnly={(seat ?? -1) < 0} placeholder={t('game.wire.placeholder')} emptyText={t('game.wire.empty')} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
