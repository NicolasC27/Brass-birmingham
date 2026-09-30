import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { useT } from '@/i18n';
import { isOnline } from '@/online/lobby';
import { clearDealt, setQueue, useDealt, useDesk, useLine, useSession } from '@/online/session';
import { rankOf } from '@/platform/rank';
import Button from '@/components/platform/Button';
import Modal from '@/components/platform/Modal';
import ModeCard, { type TableMode } from '@/components/platform/ModeCard';
import QueuePanel from '@/components/platform/QueuePanel';
import { usePresence } from '@/components/platform/presence';
import type { Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 1 (play.md) — console de matchmaking : choix de mode 2-up   */
/* (ancres #file-normale / #file-classee) et QueuePanel.               */
/*                                                                     */
/* Les files sont celles de l'office (src/online/session.ts) : entrer  */
/* dans un mode l'y inscrit, le bureau dit qui attend et depuis quand, */
/* et quand assez de monde est là l'office donne une table et nous y   */
/* mène (useDealt). Rien n'est simulé ; l'estimation reste honnête     */
/* (design.md §10) : « ~1 min » en normal, la plage 2–4 min en classé. */
/* Le classé demande une adresse vérifiée.                             */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/** the office's name for a mode: the site's « normal » is the quick queue */
const officeMode = (mode: TableMode): 'quick' | 'ranked' => (mode === 'ranked' ? 'ranked' : 'quick');
const siteMode = (mode: 'quick' | 'ranked'): TableMode => (mode === 'ranked' ? 'ranked' : 'normal');

/* -------------------------------- composant -------------------------------- */

export default function Matchmaking({ onToast }: { onToast: Notify }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const line = useLine();
  const presence = usePresence();
  /* serveur configuré mais injoignable : files fermées (design.md §10) */
  const serverUp = isOnline && line === 'online';
  const verified = session?.verified ?? false;

  const queue = desk?.queue ?? null;
  const queueMode: TableMode | null = queue ? siteMode(queue.mode) : null;
  const [pendingSwitch, setPendingSwitch] = useState<TableMode | null>(null);

  /* the office dealt a table from the queue: straight to it, it is already started */
  const dealt = useDealt();
  useEffect(() => {
    if (!dealt) return;
    clearDealt();
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

  const modeCard = (mode: TableMode, i: number) => {
    const ranked = mode === 'ranked';
    const snap = ranked ? presence.rankedQueue : presence.normalQueue;
    const lockedRanked = ranked && !!session && !verified;
    return (
      <motion.div
        id={ranked ? 'file-classee' : 'file-normale'}
        className="scroll-mt-28"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease, delay: 0.08 + i * 0.08 }}
      >
        <motion.div animate={{ scale: queueMode === mode ? 1.01 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
          <ModeCard
            mode={mode}
            active={queueMode === mode}
            disabled={!serverUp || lockedRanked}
            disabledReason={serverUp && lockedRanked ? t('platform.play.verifyFirst') : undefined}
            queueCount={snap.count}
            estimate={estimateFor(mode)}
            rank={ranked && rank ? { tier: rank.tier, division: rank.division } : undefined}
            onSelect={select}
            className="h-[200px] items-start pt-6"
          />
        </motion.div>
      </motion.div>
    );
  };

  const idleTitle = serverUp ? t('platform.play.idleTitle') : line === 'connecting' ? t('platform.play.idleConnecting') : t('platform.play.idleOffline');

  return (
    <section className="pt-10" aria-label={t('platform.play.title')}>
      {/* En-tête */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease }} className="micro-label text-brass-300">
        {t('platform.play.eyebrow')}
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease, delay: 0.04 }}>
        <h1 className="display-page mt-2">{t('platform.play.title')}</h1>
        <p className="mt-2 font-serif text-[15px] italic text-paper-300">{t('platform.play.lede')}</p>
      </motion.div>

      <div className="mt-8 grid gap-6 min-[1100px]:grid-cols-12">
        {/* Choix de mode — colonnes 1–8 */}
        <div className="min-[1100px]:col-span-8">
          <div className="grid gap-4 min-[760px]:grid-cols-2">
            {modeCard('normal', 0)}
            {modeCard('ranked', 1)}
          </div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease, delay: 0.24 }}
            className="mt-4 font-ui text-[13px] text-iron-400"
          >
            {t('platform.play.officeNote')}
          </motion.p>
        </div>

        {/* QueuePanel — colonnes 9–12 */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease, delay: 0.16 }}
          className="min-[1100px]:col-span-4"
        >
          {queue && queueMode ? (
            <div>
              <QueuePanel mode={queueMode} since={queue.since} waiting={queue.waiting} estimate={estimateFor(queueMode)} onCancel={cancel} />
            </div>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 border border-dashed border-[var(--gz-ink-soft)] px-6 text-center">
              <Timer size={24} aria-hidden className="text-iron-400" />
              <p className="title-card">{idleTitle}</p>
              <p className="font-ui text-[13px] text-iron-400">{serverUp ? (session ? t('platform.play.idleHint') : t('platform.play.idleSignIn')) : t('platform.play.idleRetrying')}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Basculer de file pendant une recherche → confirmation (play.md §1) */}
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
