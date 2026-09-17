import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import Button from './Button';
import type { TableMode } from './ModeCard';

/* ------------------------------------------------------------------ */
/* QueuePanel (design.md §7.4) — console de file d'attente.            */
/* Seul élément halé du viewport (bordure signal + halo). Barre « forge*/
/* » indéterminée : deux lingots laiton qui glissent (animate-forge).  */
/* Le panneau montre la file telle que l'office la tient : gens en     */
/* attente, temps écoulé depuis l'entrée, estimation honnête. Quand la */
/* table part, l'office nous y mène — rien à confirmer ici.            */
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

function formatElapsed(since: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** a clock that ticks every second while the panel is up */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export interface QueuePanelProps {
  mode: TableMode;
  /** when I entered the queue (server time, ms) */
  since: number;
  /** people in this queue, me included */
  waiting: number;
  /** estimation honnête (design.md §10), déjà libellée : « ~1 min », « 2–4 min » */
  estimate: string;
  onCancel?: () => void;
  className?: string;
}

export default function QueuePanel({ mode, since, waiting, estimate, onCancel, className }: QueuePanelProps) {
  const t = useT();
  const now = useNow();

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      className={cn('rounded-xl border border-[rgb(var(--signal-400)/.5)] bg-enamel-850 p-5 halo-signal', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="micro-label text-iron-400">{t(`platform.mode.${mode}`)}</p>
          <h3 className="title-card mt-1">{t('platform.queue.searching')}</h3>
        </div>
        <span className="data-text tnums text-signal-400">{formatElapsed(since, now)}</span>
      </div>

      <div className="mt-4">
        <ForgeBar />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="data-text min-w-0 text-[12px] text-iron-400">
          {t('platform.queue.playersWaiting', { count: waiting })} · {estimate}
        </p>
        <Button variant="danger-ghost" className="!h-9 shrink-0 whitespace-nowrap" onClick={onCancel}>
          {t('platform.action.cancel')}
        </Button>
      </div>

      <p className="mt-3 font-ui text-[12px] leading-relaxed text-iron-400">{t(mode === 'ranked' ? 'platform.queue.rankedRule' : 'platform.queue.normalRule')}</p>
    </motion.section>
  );
}
