import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { ShapeChip } from '@/components/game/TownInspector';

/* ------------------------------------------------------------------ */
/* A vote to abandon is on the table. Every human who has not spoken   */
/* yet gets a yes and a no: online, only my seat; at one table, every  */
/* seat, since the device is shared. One refusal ends the proposal.    */
/* ------------------------------------------------------------------ */

function ConcedeBanner() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const voteConcede = useGame((s) => s.voteConcede);
  const votes = game?.concessions ?? [];
  const open = !!game && game.phase === 'action' && votes.length > 0;
  const humans = game ? game.players.map((_, i) => i).filter((i) => !game.players[i].isBot) : [];
  const waiting = humans.filter((i) => !votes.includes(i) && (seat === null || seat === i));
  return (
    <AnimatePresence>
      {open && game && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed left-1/2 top-[52px] z-[66] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-rust-500/70 bg-coal-950/90 px-4 py-2 shadow-e3 backdrop-blur-md"
        >
          <Flag className="h-4 w-4 shrink-0 text-rust-500 brightness-150" aria-hidden />
          <div className="min-w-0">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rust-500 brightness-150">
              {t('game.concede.title', { names: votes.map((i) => game.players[i].name).join(', '), n: votes.length, h: humans.length })}
            </div>
            <div className="font-sans text-[10.5px] text-cream-100/60">{t('game.concede.hint')}</div>
          </div>
          {waiting.map((i) => (
            <span key={i} className="flex items-center gap-1.5 border-l border-brass-700/40 pl-3">
              {seat === null && humans.length > 1 && (
                <span className="flex items-center gap-1 font-fell text-[11px] text-cream-100/85">
                  <ShapeChip color={game.players[i].color} size={10} />
                  {game.players[i].name}
                </span>
              )}
              <button
                type="button"
                onClick={() => voteConcede(i, 'yes')}
                className="rounded-md border border-rust-500/80 bg-rust-500/20 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-rust-500 brightness-150 hover:bg-rust-500/30"
              >
                {t('game.concede.yes')}
              </button>
              <button
                type="button"
                onClick={() => voteConcede(i, 'no')}
                className="rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/70 hover:text-brass-400"
              >
                {t('game.concede.no')}
              </button>
            </span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(ConcedeBanner);
