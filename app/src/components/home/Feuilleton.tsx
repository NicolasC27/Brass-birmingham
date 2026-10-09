import { useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { momentAddress, readFeuilleton } from '@/platform/feuilleton';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The feuilleton on the front page: the last game at home in three    */
/* moments, each with the round it fell in, who played it and what it  */
/* did to the lead, and a link that opens the table right there.       */
/* ------------------------------------------------------------------ */

export default function Feuilleton() {
  const t = useT();
  const lang = useLang();
  const [episode] = useState(readFeuilleton);
  return (
    <section aria-label={t('platform.feuilleton.eyebrow')}>
      <h2 className="micro-label text-paper-100">
        {t('platform.feuilleton.eyebrow')}
        <GlossMark id="feuilleton" />
      </h2>
      <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
        {!episode ? (
          <p className="px-1 py-6 text-center font-serif text-[14px] text-paper-300">{t('platform.feuilleton.none')}</p>
        ) : (
          <article className="px-1 py-4">
            <h3 className="font-fraunces text-[18px] font-medium leading-tight text-paper-100">
              {t('platform.feuilleton.title', { table: tableTitle(episode.name, lang) })}
            </h3>
            <p className="data-text mt-1 text-iron-400 tnums">{episode.scores.map((s) => `${s.name} ${s.vp}`).join(' · ')}</p>
            <ol className="mt-3 flex flex-col">
              {episode.moments.map((m, i) => (
                <li key={m.at} className="flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-3 last:border-b-0">
                  <span className="brass-roundel h-5 w-5 shrink-0 font-ui text-[10.5px] font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[13px] leading-snug text-paper-100">
                      {t(m.mine ? 'platform.feuilleton.mine' : 'platform.feuilleton.theirs', { round: m.round, era: t(`platform.challenge.era.${m.era}`), name: m.by })}
                    </span>
                    <span className={cn('data-text tnums', m.shift >= 0 ? 'text-bottle-ink' : 'text-rust-400')}>
                      {t('platform.feuilleton.shift', { n: `${m.shift > 0 ? '+' : ''}${m.shift}` })}
                    </span>
                  </span>
                  <Link to={momentAddress(episode, m)} className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
                    {t('platform.feuilleton.open')} →
                  </Link>
                </li>
              ))}
            </ol>
          </article>
        )}
      </div>
    </section>
  );
}
