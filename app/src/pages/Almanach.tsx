import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { ALMANAC_YEARS, ephemerisOf, weekOf } from '@/platform/almanac';
import PageShell from '@/components/site/PageShell';

/* ------------------------------------------------------------------ */
/* /almanach — the almanac printed whole: the forty years of the era   */
/* the journal walks through, a week each, the one running marked.     */
/* ------------------------------------------------------------------ */

export default function Almanach() {
  const t = useT();
  const [now] = useState(() => ephemerisOf(weekOf()));
  return (
    <PageShell eyebrow={t('platform.almanach.eyebrow')} title={t('platform.almanach.title')} lede={t('platform.almanach.lede')}>
      <div className="gz-rule-double" aria-hidden />
      <ol className="grid gap-x-10 min-[900px]:grid-cols-2">
        {ALMANAC_YEARS.map((year, i) => {
          const current = i === now.index;
          return (
            <li key={year} className={cn('flex items-start gap-5 border-b border-[var(--gz-ink-faint)] py-4', current && 'bg-brass-500/[.06]')}>
              <span className={cn('w-[72px] shrink-0 font-fraunces text-[30px] font-normal leading-none tnums', current ? 'text-brass-300' : 'text-paper-100')}>
                {year}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[14px] leading-relaxed text-paper-100">{t(`platform.almanac.e${i}`)}</span>
                {current && <span className="micro-label mt-1 block text-brass-300">{t('platform.almanach.thisWeek')}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
