import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { isOnline } from '@/online/lobby';
import { clearDealt, setQueue, useDealt, useDesk, useLine, useSession } from '@/online/session';
import { rankOf } from '@/platform/rank';
import Button from '@/components/platform/Button';
import Modal from '@/components/platform/Modal';
import RankBadge from '@/components/platform/RankBadge';
import type { TableMode } from '@/components/platform/ModeCard';
import { usePresence } from '@/components/platform/presence';
import { getBoardOptions } from '@/components/game/boardOptions';
import { stationBell } from '@/gl/sfx';
import type { Notify } from './notify';
import { preloadGame } from '@/platform/preload';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The counters of the play hall — two windows, normal and ranked,     */
/* printed side by side: how many stand in the line, how long it       */
/* takes, the house's rule for that line, and a ticket to take it.     */
/* The queues are the office's (src/online/session.ts): taking a       */
/* ticket signs the line, the desk says who waits and since when, and  */
/* when enough people stand there the office deals a table and leads   */
/* us to it (useDealt). Nothing is simulated; the estimate stays       */
/* honest. The ranked line asks for a verified address.                */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/** the office's name for a mode: the site's « normal » is the quick queue */
const officeMode = (mode: TableMode): 'quick' | 'ranked' => (mode === 'ranked' ? 'ranked' : 'quick');
const siteMode = (mode: 'quick' | 'ranked'): TableMode => (mode === 'ranked' ? 'ranked' : 'normal');

/** the clock, ticking every second while a line is being stood in */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [on]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* -------------------------------- composant -------------------------------- */

export default function Matchmaking({ onToast }: { onToast: Notify }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const line = useLine();
  const presence = usePresence();
  /* a server configured but out of reach: the lines are closed */
  const serverUp = isOnline && line === 'online';
  const verified = session?.verified ?? false;

  const queue = desk?.queue ?? null;
  const queueMode: TableMode | null = queue ? siteMode(queue.mode) : null;
  const now = useNow(queue !== null);
  const [pendingSwitch, setPendingSwitch] = useState<TableMode | null>(null);

  /* the office dealt a table from the queue: straight to it, it is already started */
  const dealt = useDealt();
  useEffect(() => {
    if (!dealt) return;
    clearDealt();
    /* the station bell: the train is made up, the passengers are called */
    if (getBoardOptions().sound) stationBell();
    navigate(`/game/${dealt}`);
  }, [dealt, navigate]);

  const estimateFor = (mode: TableMode) => (mode === 'ranked' ? t('platform.queue.estimateRange', { min: 2, max: 4 }) : t('platform.queue.estimate', { minutes: 1 }));

  const select = (mode: TableMode) => {
    if (!serverUp) return;
    if (!session) {
      navigate('/account');
      return;
    }
    if (mode === 'ranked' && !verified) {
      onToast({ message: t('platform.play.verifyFirst'), kind: 'info' });
      return;
    }
    if (queueMode === mode) return;
    if (queueMode) {
      setPendingSwitch(mode);
      return;
    }
    setQueue(officeMode(mode), true);
  };

  const cancel = () => {
    if (!queueMode) return;
    setQueue(officeMode(queueMode), false);
    onToast({ message: t('platform.play.searchCancelled'), kind: 'info' });
  };

  const confirmSwitch = () => {
    if (pendingSwitch && queueMode) {
      setQueue(officeMode(queueMode), false);
      setQueue(officeMode(pendingSwitch), true);
    }
    setPendingSwitch(null);
  };

  const rank = session ? rankOf(desk?.rating) : null;

  const counter = (mode: TableMode, i: number) => {
    const ranked = mode === 'ranked';
    const snap = ranked ? presence.rankedQueue : presence.normalQueue;
    const lockedRanked = ranked && !!session && !verified;
    const active = queueMode === mode;
    const closed = !serverUp || lockedRanked;
    const reason = !serverUp ? (line === 'connecting' ? t('platform.play.idleConnecting') : t('platform.play.idleOffline')) : lockedRanked ? t('platform.play.verifyFirst') : null;
    return (
      <motion.div
        id={ranked ? 'file-classee' : 'file-normale'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease, delay: 0.06 + i * 0.06 }}
        className={cn('gz-classified scroll-mt-28 !items-stretch !p-5 !text-left', active && 'halo-signal !border-[rgb(var(--signal-400)/.6)]', closed && 'opacity-70')}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="micro-label text-paper-100">{t(`platform.play.counter.${mode}`)}</span>
          {ranked && rank && rank.tier !== 'placement' && <RankBadge tier={rank.tier} division={rank.division} size={18} compact />}
        </div>
        <div className="mt-3 flex items-end gap-3">
          <span className="font-fraunces text-[44px] font-normal leading-none text-paper-100 tnums" style={{ fontVariationSettings: '"opsz" 144' }}>
            {snap.count}
          </span>
          <span className="data-text pb-1.5 text-[11px] text-iron-400 tnums">
            {t('platform.queue.playersWaiting', { count: snap.count })} · {estimateFor(mode)}
          </span>
        </div>
        <p className="mt-3 min-h-[3.9em] font-serif text-[13px] italic leading-snug text-paper-300">{reason ?? t(ranked ? 'platform.queue.rankedRule' : 'platform.queue.normalRule')}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {active && queue ? (
            <>
              <span className="flex items-center gap-2 font-ui text-[12px] font-semibold text-signal-400">
                <span className="animate-pulse-signal h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
                {t('platform.queue.searching')}
                <span className="data-text text-[12px] text-paper-100 tnums">{mmss(now - queue.since)}</span>
              </span>
              <button type="button" onClick={cancel} className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] text-rust-400 transition-colors hover:text-paper-100">
                {t('platform.play.counter.leave')}
              </button>
            </>
          ) : (
            <button type="button" disabled={closed} onClick={() => select(mode)} onMouseEnter={preloadGame} onFocus={preloadGame} className={cn('gz-ticket', !closed && 'gz-ticket-brass', closed && 'cursor-not-allowed opacity-60')}>
              {t('platform.play.counter.take')}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <section aria-label={t('platform.play.counter.title')}>
      <p className="micro-label text-paper-100">
        {t('platform.play.counter.title')}
        <GlossMark id="quai" />
      </p>
      <div className="gz-rule-double mt-2" aria-hidden />
      <div className="mt-5 grid gap-5 min-[760px]:grid-cols-2">
        {counter('normal', 0)}
        {counter('ranked', 1)}
      </div>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.22 }} className="mt-4 font-serif text-[13px] italic leading-relaxed text-iron-400">
        {serverUp && !session ? t('platform.play.idleSignIn') : t('platform.play.officeNote')}
      </motion.p>

      {/* changing lines while standing in one: a confirmation */}
      <Modal open={pendingSwitch !== null} onClose={() => setPendingSwitch(null)} title={t('platform.play.switchTitle')}>
        <p className="font-ui text-[14px] text-paper-300">{t('platform.play.switchCopy', { mode: t(`platform.mode.${queueMode ?? 'normal'}`) })}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPendingSwitch(null)}>
            {t('platform.play.switchStay')}
          </Button>
          <Button variant="primary" onClick={confirmSwitch}>
            {t('platform.play.switchConfirm')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
