import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coffee, Pause, Play, RotateCcw, Users } from 'lucide-react';
import { ledgerText } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The table's mood, online: a pause everyone agreed to (the candles   */
/* stop, the board waits), one seat's own break (their candle waits,   */
/* their screen is drawn), and the host's rollback to a moment of the  */
/* ledger — each proposed, answered, and shown to everyone.            */
/* ------------------------------------------------------------------ */

const MAX_BREAKS = 3;

function clock(ms: number): string {
  if (!Number.isFinite(ms) || Math.abs(ms) > 1e9) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** a clock that ticks once a second while mounted */
function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, []);
  return now;
}

/** the chip under the settings: pause the table, take a break */
export function TableMenu({ className, compact }: { className: string; compact?: boolean }) {
  const t = useT();
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const game = useGame((s) => s.game);
  const mood = useGame((s) => s.mood);
  const pauseTable = useGame((s) => s.pauseTable);
  const takeBreak = useGame((s) => s.takeBreak);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  /* a spectator has no say at the table */
  if (!code || seat === null || seat < 0 || !game || game.phase !== 'action') return null;
  const used = mood.breaks[seat] ?? 0;
  const left = MAX_BREAKS - used;
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className} aria-haspopup="menu" aria-expanded={open} title={t('game.mood.table')} aria-label={t('game.mood.table')}>
        <Users className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {!compact && t('game.mood.table')}
      </button>
      {open && (
        <div role="menu" className={cn('plaque absolute z-[70] w-64 rounded-lg p-2', compact ? 'left-0 top-[calc(100%+6px)]' : 'bottom-0 right-[calc(100%+8px)]')}>
          <button
            type="button"
            role="menuitem"
            disabled={!!mood.pause}
            onClick={() => {
              pauseTable('propose');
              setOpen(false);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-coal-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pause className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
            <span>
              <span className="block font-sans text-[12px] font-semibold text-cream-100">{t('game.mood.pauseTable')}</span>
              <span className="block font-sans text-[10.5px] leading-snug text-cream-100/50">{t('game.mood.pauseHint')}</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!!mood.pause || left <= 0}
            onClick={() => {
              takeBreak(true);
              setOpen(false);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-coal-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
            <span>
              <span className="block font-sans text-[12px] font-semibold text-cream-100">{t('game.mood.myBreak')}</span>
              <span className="block font-sans text-[10.5px] leading-snug text-cream-100/50">{left > 0 ? t('game.mood.myBreakHint', { n: left, max: MAX_BREAKS }) : t('game.mood.noBreak')}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/** what the table is doing, said to everyone: the banners and the curtains */
export default function TableMood() {
  const t = useT();
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const game = useGame((s) => s.game);
  const mood = useGame((s) => s.mood);
  const pauseTable = useGame((s) => s.pauseTable);
  const takeBreak = useGame((s) => s.takeBreak);
  const rollbackTable = useGame((s) => s.rollbackTable);
  const now = useNow();
  if (!code || !game) return null;
  const humans = game.players.map((_, i) => i).filter((i) => !game.players[i].isBot);
  const name = (i: number) => game.players[i]?.name ?? '';
  const { pause, rollback } = mood;
  const banner = 'fixed left-1/2 top-[52px] z-[66] flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-coal-950/90 px-4 py-2 shadow-e3 backdrop-blur-md';

  return (
    <>
      <AnimatePresence>
        {/* a pause proposed, not yet agreed by all */}
        {pause?.kind === 'table' && !pause.held && (
          <motion.div key="pause-proposal" role="status" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className={cn(banner, 'border-brass-500/70')}>
            <Pause className="h-4 w-4 text-brass-400" />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-brass-400">{t('game.mood.proposed', { name: name(pause.by), n: pause.votes.length, h: humans.length })}</span>
            {seat !== null && seat >= 0 && !pause.votes.includes(seat) && (
              <span className="flex items-center gap-1.5 border-l border-brass-700/40 pl-3">
                <button type="button" onClick={() => pauseTable('agree')} className="btn-strike !min-h-[30px] !px-3 !py-1 !text-[10px]">
                  {t('game.mood.agree')}
                </button>
                <button type="button" onClick={() => pauseTable('refuse')} className="btn-ledger !min-h-[30px] !px-3 !py-1 !text-[10px]">
                  {t('game.mood.refuse')}
                </button>
              </span>
            )}
          </motion.div>
        )}

        {/* the host's rollback, waiting on everyone */}
        {rollback && (
          <motion.div key="rollback" role="status" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className={cn(banner, 'max-w-[92vw] border-rust-500/70', pause?.kind === 'table' && !pause.held && 'top-[96px]')}>
            <RotateCcw className="h-4 w-4 shrink-0 text-rust-500 brightness-150" />
            <span className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-rust-500 brightness-150">
              {t('game.mood.rollbackProposed', { name: name(rollback.by), entry: (() => {
                const e = game.ledger.find((x) => x.at === rollback.to && x.verb !== 'system');
                return e ? ledgerText(e, t) : `#${rollback.to}`;
              })(), n: rollback.votes.length, h: humans.length })}
            </span>
            {seat !== null && !rollback.votes.includes(seat) && (
              <span className="flex shrink-0 items-center gap-1.5 border-l border-brass-700/40 pl-3">
                <button type="button" onClick={() => rollbackTable('agree')} className="btn-strike !min-h-[30px] !px-3 !py-1 !text-[10px]">
                  {t('game.mood.agree')}
                </button>
                <button type="button" onClick={() => rollbackTable('refuse')} className="btn-ledger !min-h-[30px] !px-3 !py-1 !text-[10px]">
                  {t('game.mood.refuse')}
                </button>
              </span>
            )}
            {seat !== null && rollback.votes.includes(seat) && rollback.by === seat && (
              <button type="button" onClick={() => rollbackTable('refuse')} className="btn-ledger !min-h-[30px] !px-3 !py-1 !text-[10px]">
                {t('game.hand.cancel')}
              </button>
            )}
          </motion.div>
        )}

        {/* somebody else's break: a word, the game goes on around them */}
        {pause?.kind === 'break' && pause.by !== seat && (
          <motion.div key="break-other" role="status" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className={cn(banner, 'border-brass-700/70')}>
            <Coffee className="h-4 w-4 text-brass-400" />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-cream-100/80">{t('game.mood.breakOther', { name: name(pause.by), time: clock(pause.until - now) })}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* the whole table stopped: a curtain over the board, and the way out */}
        {pause?.kind === 'table' && pause.held && (
          <motion.div key="held" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[88] flex items-center justify-center bg-coal-950/80 backdrop-blur-sm">
            <div className="plaque plaque-rivets px-10 py-8 text-center">
              <Pause className="mx-auto h-8 w-8 text-ink-900/70" />
              <h2 className="engraved-brass mt-2 font-display text-[34px] font-black">{t('game.mood.held')}</h2>
              <p className="mt-1 font-fell text-[14px] text-ink-900/80">{t('game.mood.heldSince', { time: clock(now - pause.since) })}</p>
              {seat !== null && seat >= 0 && (
                <button type="button" onClick={() => pauseTable('resume')} className="btn-ledger mt-5 !border-ink-900/60 !text-ink-900 hover:!bg-ink-900/10">
                  <Play className="h-4 w-4" /> {t('game.mood.resume')}
                </button>
              )}
            </div>
          </motion.div>
        )}
        {/* my own break: the screen is drawn, my candle waits */}
        {pause?.kind === 'break' && pause.by === seat && (
          <motion.div key="break-mine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[88] flex items-center justify-center bg-coal-950">
            <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-30" />
            <div className="plaque plaque-rivets relative px-10 py-8 text-center">
              <Coffee className="mx-auto h-8 w-8 text-ink-900/70" />
              <h2 className="engraved-brass mt-2 font-display text-[34px] font-black">{t('game.mood.breakMine')}</h2>
              <p className="mt-1 font-fell text-[14px] text-ink-900/80">{t('game.mood.breakLeft', { time: clock(pause.until - now) })}</p>
              <button type="button" onClick={() => takeBreak(false)} className="btn-ledger mt-5 !border-ink-900/60 !text-ink-900 hover:!bg-ink-900/10">
                <Play className="h-4 w-4" /> {t('game.mood.resume')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
