import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { ALMANAC_YEARS, ephemerisOf, weekOf } from '@/platform/almanac';
import PageShell from '@/components/site/PageShell';

/* ------------------------------------------------------------------ */
/* /almanach — the almanac printed whole: the forty years of the era   */
/* the journal walks through, a week each, the one running marked.     */
/*                                                                     */
/* The years run down the first column and on into the second, as a    */
/* printed almanac does, with a rule between the two. The running week */
/* is told by a heavy rule in the margin, not by a tint: a tint of the */
/* page on the page parts from it by a hair, and by day not at all.     */
/* ------------------------------------------------------------------ */

const CURRENT_ID = 'cette-semaine';

export default function Almanach() {
  const t = useT();
  const [now] = useState(() => ephemerisOf(weekOf()));
  const year = ALMANAC_YEARS[now.index];

  /* the running year sits far down the list: the lede carries the way to it */
  const toCurrent = (e: React.MouseEvent) => {
    e.preventDefault();
    /* asked in so many words, the smooth scroll would override the reader's
       wish for less motion that the stylesheet honours: the jump is made
       instantly for them */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(CURRENT_ID)?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <PageShell
      back={{ to: '/', label: t('platform.account.back') }}
      eyebrow={t('platform.almanach.eyebrow')}
      title={t('platform.almanach.title')}
      lede={
        <>
          {t('platform.almanach.lede')}
          {year !== undefined && (
            <a href={`#${CURRENT_ID}`} onClick={toCurrent} className="mt-1.5 block w-fit py-0.5 font-ui text-[12.5px] not-italic text-paper-100 underline decoration-[var(--gz-ink-soft)] underline-offset-4 transition-colors hover:decoration-[var(--gz-ink)]">
              {t('platform.almanach.goCurrent', { year })} ↓
            </a>
          )}
        </>
      }
    >
      <div className="gz-rule-double" aria-hidden />
      <ol className="gap-x-14 min-[900px]:columns-2 min-[900px]:[column-rule:1px_solid_var(--gz-ink-soft)]">
        {ALMANAC_YEARS.map((y, i) => {
          const current = i === now.index;
          return (
            <li
              key={y}
              id={current ? CURRENT_ID : undefined}
              aria-current={current ? 'date' : undefined}
              className={cn(
                'flex break-inside-avoid items-start gap-5 border-b border-[var(--gz-ink-faint)] py-4',
                current && 'relative before:absolute before:-left-3 before:inset-y-3 before:w-[3px] before:bg-[var(--gz-ink)] [html[data-theme=dark]_&]:bg-brass-500/[.05]',
              )}
            >
              <span className="w-[72px] shrink-0 font-fraunces text-[30px] font-normal leading-none text-paper-100 tnums">{y}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[14px] leading-relaxed text-paper-100">{t(`platform.almanac.e${i}`)}</span>
                {current && <span className="micro-label mt-1 block text-paper-100"><span className="mr-1.5 text-brass-300" aria-hidden>◆</span>{t('platform.almanach.thisWeek')}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
