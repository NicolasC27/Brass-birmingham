import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, VolumeX, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { TELEGRAMS, TELEGRAM_COOLDOWN_MS, telegramText } from '@/game/telegrams';
import { counterBell } from '@/gl/sfx';
import { useT } from '@/i18n';
import { getBoardOptions, useBoardOptions } from './boardOptions';
import { cn } from '@/lib/utils';

/* Telegrams — the printed lines a player wires across the table. The
   button lives with the tools under the players; a received line hangs
   as a brass plaque under its sender's card for a few seconds. */

/** the reader's seat: online the chair, at home the human */
function useMySeat(): number {
  const seat = useGame((s) => s.seat);
  const game = useGame((s) => s.game);
  if (seat !== null) return seat;
  return game ? game.players.findIndex((p) => !p.isBot) : -1;
}

export function TelegramButton({ className }: { className: string }) {
  const t = useT();
  const { telegrams: enabled } = useBoardOptions();
  const sentAt = useGame((s) => s.telegramSentAt);
  const sendTelegram = useGame((s) => s.sendTelegram);
  const game = useGame((s) => s.game);
  const me = useMySeat();
  const [open, setOpen] = useState(false);
  /* the clock ticks while the last wire cools down */
  const [now, setNow] = useState(0);
  const left = now ? Math.max(0, TELEGRAM_COOLDOWN_MS - (now - sentAt)) : 0;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 500);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [sentAt]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (!enabled || !game || me < 0 || game.phase === 'game-over') return null;
  const label = left > 0 ? t('game.telegram.wait', { s: Math.ceil(left / 1000) }) : t('game.telegram.send');
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={label} aria-label={label} className={cn(className, open && '!border-brass-400 bg-brass-500/20 !opacity-100')}>
        <Mail className="h-4 w-4" />
        {left > 0 && <span className="absolute -bottom-1 -right-1 rounded-sm bg-coal-900 px-0.5 font-mono text-[8px] leading-[10px] text-brass-400">{Math.ceil(left / 1000)}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            role="menu"
            aria-label={t('game.telegram.title')}
            className="plaque absolute left-full top-0 z-[72] ml-2 w-[440px] rounded-md p-2"
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="engraved-brass font-fell text-[12px] tracking-[0.08em]">{t('game.telegram.title')}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('game.notice.dismiss')} className="text-brass-500/70 hover:text-brass-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {TELEGRAMS.map((key) => {
                const { text, gloss } = telegramText(t, key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    disabled={left > 0}
                    onClick={() => {
                      if (sendTelegram(key)) setOpen(false);
                    }}
                    className="flex flex-col items-start rounded-sm px-2 py-1 text-left hover:bg-brass-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-fell text-[13px] leading-tight text-cream-100/90">{text}</span>
                    {gloss && <span className="font-sans text-[10px] italic leading-tight text-cream-100/50">{gloss}</span>}
                  </button>
                );
              })}
            </div>
            {left > 0 && <p className="mt-1 px-1 font-mono text-[10px] text-brass-400/80">{label}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/** the plaque under a seat's card while its last line hangs there */
export function TelegramPlaque({ seat, compact }: { seat: number; compact?: boolean }) {
  const t = useT();
  const { telegrams: enabled } = useBoardOptions();
  const tg = useGame((s) => s.telegrams.find((x) => x.from === seat));
  const game = useGame((s) => s.game);
  const muteSeat = useGame((s) => s.muteSeat);
  const me = useMySeat();
  const id = tg?.id;
  useEffect(() => {
    if (id !== undefined && getBoardOptions().sound) counterBell();
  }, [id]);
  if (!enabled || !game) return null;
  const name = game.players[seat]?.name ?? '';
  return (
    <AnimatePresence>
      {tg && (
        <motion.div
          key={tg.id}
          initial={{ opacity: 0, y: -8, scaleY: 0.6 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          role="status"
          aria-label={t('game.telegram.from', { name })}
          className={cn('plaque relative -mt-1 mb-1 origin-top rounded-b-md border-t-0 px-2.5 py-1.5', compact ? 'ml-1 mr-1' : 'ml-3 mr-3')}
        >
          <p className="pr-4 font-fell text-[13px] leading-snug text-brass-400">{telegramText(t, tg.key).text}</p>
          {telegramText(t, tg.key).gloss && <p className="pr-4 font-sans text-[10px] italic leading-tight text-cream-100/55">{telegramText(t, tg.key).gloss}</p>}
          {seat !== me && (
            <button
              type="button"
              onClick={() => muteSeat(seat, true)}
              title={t('game.telegram.mute', { name })}
              aria-label={t('game.telegram.mute', { name })}
              className="absolute right-1 top-1 rounded-sm p-0.5 text-cream-100/45 hover:bg-brass-500/20 hover:text-brass-400"
            >
              <VolumeX className="h-3 w-3" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** the office frowned at a shower of marks: a word in the middle of the
 *  screen, the second time a silence for the rest of the game */
export function MarkWarning() {
  const t = useT();
  const warning = useGame((s) => s.markWarning);
  const dismiss = useGame((s) => s.dismissMarkWarning);
  useEffect(() => {
    if (!warning) return;
    const id = window.setTimeout(dismiss, 6000);
    return () => window.clearTimeout(id);
  }, [warning, dismiss]);
  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          key={warning}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          role="alert"
          className="plaque pointer-events-auto fixed left-1/2 top-1/2 z-[78] w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-md px-5 py-4 text-center shadow-e4"
          onClick={dismiss}
        >
          <p className="engraved-brass font-fell text-[13px] uppercase tracking-[0.16em]">{t('game.telegram.officeTitle')}</p>
          <p className="mt-2 font-fell text-[16px] leading-snug text-cream-100/90">{t(warning === 'muted' ? 'game.telegram.marksMuted' : 'game.telegram.marksWarned')}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
