import { memo, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useGame } from '@/game/store';
import { headlinesFor } from '@/game/gazette';
import type { Headline } from '@/game/gazette';
import type { GameState } from '@/game/types';
import { useT } from '@/i18n';
import { useBoardOptions } from './boardOptions';
import { useGazetteDesk } from './noticeQueue';
import type { GazetteIssue } from './noticeQueue';

/* The Gazette — three headlines on the round just played, set from the
   ledger in the style of a Midlands paper of 1850. Read by everyone at
   the table from the same ledger: nothing goes over the wire. The paper
   is set here and handed to the table's notices, which hang it in their
   one pile at its rank: after whatever touches the reader. */

function Gazette() {
  const game = useGame((s) => s.game);
  const { telegrams: enabled, focus } = useBoardOptions();
  const publish = useGazetteDesk((s) => s.publish);
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
      if (!enabled || focus || game.phase !== 'action' || game.era !== era) return;
      const lines = headlinesFor(game, prev, era);
      if (lines.length) publish({ id: seen, round: prev, era, lines });
    }, 0);
    return () => window.clearTimeout(id);
  }, [game, mark, seen, enabled, focus, publish]);
  /* the paper put away with the table, or when the reader turns it off */
  useEffect(() => {
    if (!enabled || focus) publish(null);
  }, [enabled, focus, publish]);
  useEffect(() => () => publish(null), [publish]);
  return null;
}

/** the paper itself, as it hangs in the notices' pile */
export function GazettePaper({ issue, onClose }: { issue: GazetteIssue; onClose: () => void }) {
  const t = useT();
  const say = (h: Headline) => t(`game.gazette.${h.key}`, { ...h.vars, goods: h.vars.goods ? t(`game.log.industry.${h.vars.goods}`) : '' });
  return (
    <div className="paper relative rounded-[3px] px-4 py-3 shadow-e3" style={{ transform: 'rotate(-0.6deg)' }} aria-label={t('game.gazette.aria', { round: issue.round })}>
      <button type="button" onClick={onClose} aria-label={t('game.notice.dismiss')} className="absolute right-1.5 top-1.5 rounded-sm p-0.5 text-ink-900/45 hover:bg-ink-900/10 hover:text-ink-900">
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="border-b border-ink-900/40 pb-1 text-center font-display text-[15px] font-black uppercase tracking-[0.12em] text-ink-900">{t('game.gazette.title')}</p>
      <p className="mt-0.5 text-center font-fell text-[10px] uppercase tracking-[0.18em] text-ink-900/60">{t('game.gazette.issue', { round: issue.round, era: t(`game.topbar.${issue.era === 'canal' ? 'eraCanal' : 'eraRail'}`) })}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {issue.lines.map((h, i) => (
          <li key={i} className={i === 0 ? 'font-fell text-[15px] leading-snug text-ink-900 [text-wrap:pretty]' : 'font-fell text-[13px] leading-snug text-ink-900/80 [text-wrap:pretty]'}>
            {say(h)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(Gazette);
