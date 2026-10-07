import { useState } from 'react';
import { useLang, useT } from '@/i18n';
import { personaName } from '@/game/data';
import { tableTitle } from '@/online/tableNames';
import { letterKey, listLetters } from '@/platform/letters';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The post: the last letters the machines wrote after a game at home, */
/* the latest first, each with its sender and the table it concerns.  */
/* ------------------------------------------------------------------ */

const SHOWN = 2;

export default function Post() {
  const t = useT();
  const lang = useLang();
  const [letters] = useState(() => listLetters().slice(0, SHOWN));
  return (
    <section aria-label={t('platform.letters.eyebrow')}>
      <h2 className="micro-label text-paper-100">
        {t('platform.letters.eyebrow')}
        <GlossMark id="courrier" />
      </h2>
      <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
        {letters.length === 0 ? (
          <p className="px-1 py-6 text-center font-serif text-[14px] text-paper-300">{t('platform.letters.none')}</p>
        ) : (
          letters.map((l) => (
            <article key={l.id} className="border-b border-[var(--gz-ink-faint)] px-1 py-4 last:border-b-0">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-fraunces text-[14px] font-medium text-paper-100">
                  {t('platform.letters.from', { name: personaName(l.persona) })}
                </span>
                <span className="data-text text-[10.5px] text-iron-400">{t('platform.letters.re', { table: tableTitle(l.table, lang) })}</span>
              </p>
              <p className="mt-2 font-serif text-[14px] leading-relaxed text-paper-300">
                {t(letterKey(l), { me: l.me, table: tableTitle(l.table, lang), vp: l.vp, theirs: l.theirs })}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
