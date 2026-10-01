import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT, localeOf } from '@/i18n';
import { PATENT_IDS, listPatents } from '@/platform/patents';

/* ------------------------------------------------------------------ */
/* The wall of patents: every distinction the house grants, the ones   */
/* held printed in full with their date, the rest as a faint outline  */
/* of what is still to be earned.                                      */
/* ------------------------------------------------------------------ */

export default function PatentsWall() {
  const t = useT();
  const lang = useLang();
  const [held] = useState(() => new Map(listPatents().map((p) => [p.id, p])));
  return (
    <section aria-label={t('platform.patents.eyebrow')}>
      <p className="micro-label text-paper-100">{t('platform.patents.eyebrow')}</p>
      <div className="mt-1 border-t border-[var(--gz-ink-soft)] pt-3">
        {held.size === 0 && <p className="pb-2 font-serif text-[13.5px] italic text-paper-300">{t('platform.patents.none')}</p>}
        <ul className="grid grid-cols-3 gap-2">
          {PATENT_IDS.map((id) => {
            const p = held.get(id);
            return (
              <li
                key={id}
                title={t(`platform.patents.terms.${id}`)}
                className={cn(
                  'flex flex-col items-center gap-1.5 border px-2 py-3 text-center',
                  p ? 'border-[var(--gz-ink-soft)] bg-enamel-850 shadow-[inset_0_0_0_3px_rgb(var(--enamel-850)),inset_0_0_0_4px_var(--gz-ink-faint)]' : 'border-dashed border-[var(--gz-ink-faint)] opacity-55',
                )}
              >
                <ScrollText size={14} strokeWidth={1.5} aria-hidden className={p ? 'text-brass-300' : 'text-iron-600'} />
                <span className="font-fraunces text-[12px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
                  {t(`platform.patents.names.${id}`)}
                </span>
                {p && <span className="data-text text-[10px] text-iron-600">{new Date(p.at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
