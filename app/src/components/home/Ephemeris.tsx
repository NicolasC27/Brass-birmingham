import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '@/i18n';
import { ephemerisOf } from '@/platform/almanac';

/* the almanac's line of the week: the year of the era in large figures,
   the thing that happened, in italic, under a rule */
export default function Ephemeris() {
  const t = useT();
  const [e] = useState(() => ephemerisOf());
  return (
    <section aria-label={t('platform.almanac.eyebrow')} className="border-y border-[var(--gz-ink-soft)] py-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="micro-label text-paper-100">{t('platform.almanac.eyebrow')}</span>
        <Link to="/almanach" className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-300 transition-colors hover:text-paper-100">
          {t('platform.almanach.all')}
        </Link>
      </p>
      <div className="mt-2 flex items-start gap-4">
        <span className="font-fraunces text-[34px] font-normal leading-none text-brass-300 tnums" style={{ fontVariationSettings: '"opsz" 144' }}>
          {e.year}
        </span>
        <p className="font-serif text-[14px] italic leading-relaxed text-paper-300">{t(e.key)}</p>
      </div>
    </section>
  );
}
