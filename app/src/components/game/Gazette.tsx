import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGame } from '@/game/store';
import type { GameState } from '@/game/types';
import { headlinesFor } from '@/game/gazette';
import type { Headline } from '@/game/gazette';
import { useT } from '@/i18n';
import { useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';

/* The Gazette — three headlines on the round just played, set from the
   ledger in the style of a Midlands paper of 1850. Read by everyone at
   the table from the same ledger: nothing goes over the wire. */

const SHOWN_MS = 11_000;

export default function Gazette() {
  const t = useT();
  const game = useGame((s) => s.game);
  const { telegrams: enabled, focus } = useBoardOptions();
  const insets = useHudInsets();
  /* the guide keeps the right lane while it runs: the headlines step left of it */
  const [aside, setAside] = useState(16);
  useEffect(() => {
    const measure = () => {
      const lane = document.querySelector('[data-guide]')?.getBoundingClientRect();
      setAside(lane && lane.width > 0 ? Math.round(window.innerWidth - lane.left + 12) : 16);
    };
    measure();
    const t = window.setInterval(measure, 1000);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, []);
  const [issue, setIssue] = useState<{ id: string; round: number; era: GameState['era']; lines: Headline[] } | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const mark = game ? `${game.era}:${game.round}` : null;
  /* a new round: the paper on the one just played */
  useEffect(() => {
    if (!game || !mark) return;
    if (seen === null) {
      const id = window.setTimeout(() => setSeen(mark), 0);
      return () => window.clearTimeout(id);
    }
    if (mark === seen) return;
    const [era, round] = seen.split(':') as [GameState['era'], string];
    const prev = Number(round);
    const id = window.setTimeout(() => {
      setSeen(mark);
      if (game.phase !== 'action' || game.era !== era) return;
      const lines = headlinesFor(game, prev, era);
      if (lines.length) setIssue({ id: seen, round: prev, era, lines });
    }, 0);
    return () => window.clearTimeout(id);
  }, [game, mark, seen]);
  useEffect(() => {
    if (!issue) return;
    const id = window.setTimeout(() => setIssue(null), SHOWN_MS);
    return () => window.clearTimeout(id);
  }, [issue]);
  if (!enabled || focus) return null;
  const say = (h: Headline) => t(`game.gazette.${h.key}`, { ...h.vars, goods: h.vars.goods ? t(`game.log.industry.${h.vars.goods}`) : '' });
  return (
    <AnimatePresence>
      {issue && (
        <motion.aside
          key={issue.id}
          initial={{ opacity: 0, y: -10, rotate: -0.6 }}
          animate={{ opacity: 1, y: 0, rotate: -0.6 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          role="status"
          aria-label={t('game.gazette.aria', { round: issue.round })}
          className="paper pointer-events-auto fixed z-[66] w-[330px] rounded-[3px] px-4 py-3 shadow-e3"
          style={{ top: insets.top + 64, right: aside }}
        >
          <button type="button" onClick={() => setIssue(null)} aria-label={t('game.notice.dismiss')} className="absolute right-1.5 top-1.5 rounded-sm p-0.5 text-ink-900/45 hover:bg-ink-900/10 hover:text-ink-900">
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="border-b border-ink-900/40 pb-1 text-center font-display text-[15px] font-black uppercase tracking-[0.12em] text-ink-900">{t('game.gazette.title')}</p>
          <p className="mt-0.5 text-center font-fell text-[10px] uppercase tracking-[0.18em] text-ink-900/60">{t('game.gazette.issue', { round: issue.round, era: t(`game.topbar.${issue.era === 'canal' ? 'eraCanal' : 'eraRail'}`) })}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {issue.lines.map((h, i) => (
              <li key={i} className={i === 0 ? 'font-fell text-[15px] leading-snug text-ink-900' : 'font-fell text-[13px] leading-snug text-ink-900/80'}>
                {say(h)}
              </li>
            ))}
          </ul>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
