import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { isOnline, lobby } from '@/online/lobby';
import { useLine, useSession } from '@/online/session';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import Button from '@/components/platform/Button';
import Modal from '@/components/platform/Modal';
import ModeCard from '@/components/platform/ModeCard';
import QueuePanel from '@/components/platform/QueuePanel';
import { readPresence } from '@/components/platform/presence';
import { demoRating, type TableMode } from '@/components/platform/mockData';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 1 (play.md) — console de matchmaking : choix de mode 2-up   */
/* (ancres #file-normale / #file-classee), préférences persistées,     */
/* QueuePanel (repos / actif / adversaire trouvé).                     */
/*                                                                     */
/* Honnêteté produit (design.md §10) : le backend n'a AUCUN contrat    */
/* de matchmaking. La file est une simulation côté client, badgée      */
/* SAISON 1 · CLASSEMENT BÊTA en classé ; l'estimation classée reste   */
/* une plage fixe 2–4 min, jamais un faux chiffre précis. L'événement  */
/* « adversaire trouvé » (prévu par play.md) est simulé par un minuteur*/
/* local et débouche sur une vraie table créée via le flux existant.   */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/* --------------------- préférences de file (chips) --------------------- */

const PREFS_KEY = 'brassworks.play.prefs.v1';

interface PlayPrefs {
  players: 2 | 3 | 4;
  allowBots: boolean;
}

function readPrefs(): PlayPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<PlayPrefs>;
    return {
      players: raw.players === 2 || raw.players === 3 || raw.players === 4 ? raw.players : 4,
      allowBots: raw.allowBots !== false,
    };
  } catch {
    return { players: 4, allowBots: true };
  }
}

function chipClass(active: boolean): string {
  return cn(
    'h-8 rounded-full border px-3.5 font-ui text-[12px] font-semibold transition-colors duration-150',
    active
      ? 'border-brass-400 bg-enamel-800 text-brass-300'
      : 'border-[rgb(var(--paper-100)/.14)] text-paper-300 hover:border-[rgb(var(--paper-100)/.3)] hover:text-paper-100',
  );
}

/* -------------------------------- composant -------------------------------- */

export default function Matchmaking({ onToast }: { onToast: Notify }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const line = useLine();
  const presence = readPresence();
  /* serveur configuré mais injoignable : files fermées (design.md §10) */
  const serverUp = isOnline && line === 'online';

  const [prefs, setPrefs] = useState<PlayPrefs>(readPrefs);
  const [queue, setQueue] = useState<TableMode | null>(null);
  const [found, setFound] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [pendingSwitch, setPendingSwitch] = useState<TableMode | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* non-fatal */
    }
  }, [prefs]);

  /* « Adversaire trouvé » — simulation locale (voir en-tête), jamais un backend */
  useEffect(() => {
    if (!queue || found) return;
    const delay = 12000 + Math.random() * 18000;
    const id = window.setTimeout(() => setFound(true), delay);
    return () => window.clearTimeout(id);
  }, [queue, found]);

  const enter = useCallback(async () => {
    if (entering) return;
    if (!session) {
      navigate('/account');
      return;
    }
    setEntering(true);
    try {
      const table = await lobby.create(t('site.desk.defaultName', { name: session.name }), DEFAULT_OPTIONS);
      navigate(`/online/${table.code}`);
    } catch (e) {
      onToast({ message: lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: 'error' });
      setEntering(false);
      setFound(false);
      setQueue(null);
    }
  }, [entering, session, navigate, t, onToast]);

  /* compte à rebours 5 s, puis entrée auto dans le salon (play.md §1) */
  useEffect(() => {
    if (!found) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      setCountdown(Math.max(0, 5 - ticks));
      if (ticks >= 5) {
        window.clearInterval(id);
        void enter();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [found, enter]);

  const startQueue = (mode: TableMode) => {
    setFound(false);
    setCountdown(5);
    setQueue(mode);
  };

  const select = (mode: TableMode) => {
    if (!serverUp) return;
    if (queue === mode) return;
    if (queue) {
      setPendingSwitch(mode);
      return;
    }
    startQueue(mode);
  };

  const cancel = () => {
    setFound(false);
    setQueue(null);
    onToast({ message: t('platform.play.searchCancelled'), kind: 'info' });
  };

  const modeCard = (mode: TableMode, i: number) => {
    const ranked = mode === 'ranked';
    const snap = ranked ? presence.rankedQueue : presence.normalQueue;
    return (
      <motion.div
        id={ranked ? 'file-classee' : 'file-normale'}
        className="scroll-mt-28"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease, delay: 0.08 + i * 0.08 }}
      >
        <motion.div animate={{ scale: queue === mode ? 1.01 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
          <ModeCard
            mode={mode}
            active={queue === mode}
            disabled={!serverUp}
            queueCount={snap.count}
            estimateMin={snap.estimateMin}
            rank={ranked ? { tier: demoRating.tier, division: demoRating.division } : undefined}
            onSelect={select}
            className="h-[200px] items-start pt-6"
          />
        </motion.div>
      </motion.div>
    );
  };

  return (
    <section className="pt-10" aria-label={t('platform.play.title')}>
      {/* En-tête */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease }} className="micro-label text-brass-300">
        {t('platform.play.eyebrow')}
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease, delay: 0.04 }}>
        <h1 className="display-page mt-2">{t('platform.play.title')}</h1>
        <p className="mt-2 font-ui text-[15px] text-paper-300">{t('platform.play.lede')}</p>
      </motion.div>

      <div className="mt-8 grid gap-6 min-[1100px]:grid-cols-12">
        {/* Choix de mode — colonnes 1–8 */}
        <div className="min-[1100px]:col-span-8">
          <div className="grid gap-4 min-[760px]:grid-cols-2">
            {modeCard('normal', 0)}
            {modeCard('ranked', 1)}
          </div>

          {/* Préférences de file — chips persistées en local */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease, delay: 0.24 }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={prefs.players === n}
                onClick={() => setPrefs((p) => ({ ...p, players: n }))}
                className={chipClass(prefs.players === n)}
              >
                {t('platform.play.prefs.players', { count: n })}
              </button>
            ))}
            <span aria-hidden className="hidden h-4 w-px bg-[rgb(var(--paper-100)/.12)] min-[760px]:block" />
            <span className={cn(chipClass(false), 'cursor-default hover:border-[rgb(var(--paper-100)/.14)] hover:text-paper-300')}>
              {t('platform.play.prefs.region', { region: presence.region })}
            </span>
            <button
              type="button"
              aria-pressed={prefs.allowBots}
              onClick={() => setPrefs((p) => ({ ...p, allowBots: !p.allowBots }))}
              className={chipClass(prefs.allowBots)}
            >
              {t('platform.play.prefs.bots')}
            </button>
          </motion.div>
        </div>

        {/* QueuePanel — colonnes 9–12 */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease, delay: 0.16 }}
          className="min-[1100px]:col-span-4"
        >
          {queue ? (
            <div>
              <QueuePanel
                mode={queue}
                estimateMin={queue === 'normal' ? presence.normalQueue.estimateMin : undefined}
                estimateRange={[2, 4]}
                playersWaiting={(queue === 'normal' ? presence.normalQueue : presence.rankedQueue).count}
                found={found}
                countdownSec={countdown}
                onCancel={cancel}
                onEnter={() => void enter()}
              />
              {queue === 'ranked' && (
                <p className="micro-label mt-2 text-center text-[10px] text-iron-600">{t('platform.rank.beta')}</p>
              )}
            </div>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgb(var(--paper-100)/.14)] px-6 text-center">
              <Timer size={24} aria-hidden className="text-iron-400" />
              <p className="font-ui text-[14px] font-semibold text-paper-100">
                {serverUp ? t('platform.play.idleTitle') : t('platform.play.idleOffline')}
              </p>
              <p className="font-ui text-[13px] text-iron-400">{t('platform.play.idleHint')}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Basculer de file pendant une recherche → confirmation (play.md §1) */}
      <Modal open={pendingSwitch !== null} onClose={() => setPendingSwitch(null)} title={t('platform.play.switchTitle')}>
        <p className="font-ui text-[14px] text-paper-300">
          {t('platform.play.switchCopy', { mode: t(`platform.mode.${queue ?? 'normal'}`) })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPendingSwitch(null)}>
            {t('platform.play.switchStay')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (pendingSwitch) startQueue(pendingSwitch);
              setPendingSwitch(null);
            }}
          >
            {t('platform.play.switchConfirm')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
