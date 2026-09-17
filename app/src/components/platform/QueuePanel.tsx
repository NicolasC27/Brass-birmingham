import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import Button from './Button';
import type { TableMode } from './mockData';

/* ------------------------------------------------------------------ */
/* QueuePanel (design.md §7.4) — console de file d'attente.            */
/* Seul élément halé du viewport (bordure signal + halo). Barre « forge*/
/* » indéterminée : deux lingots laiton qui glissent (animate-forge).  */
/* Événement « match trouvé » → panneau bottle + compte à rebours.     */
/* ------------------------------------------------------------------ */

function ForgeBar() {
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-enamel-700" aria-hidden>
      <span className="animate-forge absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-brass-500 to-transparent" />
      <span
        className="animate-forge absolute inset-y-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-brass-300/70 to-transparent"
        style={{ animationDelay: '0.9s' }}
      />
    </div>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface QueuePanelProps {
  mode: TableMode;
  /** estimation honnête (design.md §10) : minutes, ou plage fixe */
  estimateMin?: number;
  estimateRange?: [number, number];
  playersWaiting: number;
  /** match trouvé : compte à rebours avant le salon */
  found?: boolean;
  countdownSec?: number;
  onCancel?: () => void;
  onEnter?: () => void;
  className?: string;
}

export default function QueuePanel({
  mode,
  estimateMin,
  estimateRange = [2, 4],
  playersWaiting,
  found = false,
  countdownSec = 5,
  onCancel,
  onEnter,
  className,
}: QueuePanelProps) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (found) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [found]);

  const estimate = estimateMin !== undefined ? t('platform.queue.estimate', { minutes: estimateMin }) : t('platform.queue.estimateRange', { min: estimateRange[0], max: estimateRange[1] });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-xl border bg-enamel-850 p-5',
        found ? 'border-bottle-500' : 'border-[rgb(var(--signal-400)/.5)] halo-signal',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="micro-label text-iron-400">{t(`platform.mode.${mode}`)}</p>
          <h3 className={cn('title-card mt-1', found && 'text-bottle-400')}>
            {found ? t('platform.queue.found') : t('platform.queue.searching')}
          </h3>
        </div>
        <span className="data-text tnums text-signal-400">{found ? t('platform.queue.countdown', { seconds: countdownSec }) : formatElapsed(elapsed)}</span>
      </div>

      <div className="mt-4">
        <ForgeBar />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="data-text text-[12px] text-iron-400">
          {t('platform.queue.playersWaiting', { count: playersWaiting })} · {estimate}
        </p>
        {found ? (
          <Button variant="live" className="!h-9" onClick={onEnter}>
            {t('platform.action.enterLobby')}
          </Button>
        ) : (
          <Button variant="danger-ghost" className="!h-9" onClick={onCancel}>
            {t('platform.action.cancel')}
          </Button>
        )}
      </div>
    </motion.section>
  );
}
