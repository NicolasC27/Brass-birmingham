import { useState } from 'react';
import { useT } from '@/i18n';
import { PERSONAS, personaName } from '@/game/data';
import { useEdition, useSession } from '@/online/session';
import { weekOf } from '@/platform/almanac';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The portrait of the week: one of the four machines in turn, its     */
/* portrait, three lines of a life of the era, and its record against  */
/* the club this week as the office counted it.                        */
/* ------------------------------------------------------------------ */

export default function Portrait() {
  const t = useT();
  const session = useSession();
  const [week] = useState(weekOf);
  const persona = PERSONAS[week % PERSONAS.length];
  const edition = useEdition(week);
  const record = edition?.machines.find((m) => m.name === persona.name) ?? null;
  return (
    <section aria-label={t('platform.portrait.eyebrow')} className="gz-classified !items-start !p-5 !text-left">
      <p className="micro-label text-paper-100">
        {t('platform.portrait.eyebrow')}
        <GlossMark id="portrait" />
      </p>
      <div className="mt-3 flex gap-4">
        <div className="gz-engraving h-[92px] w-[92px] shrink-0">
          <img src={`/portrait-${persona.id}.webp`} alt="" className="!aspect-square" />
        </div>
        <div className="min-w-0">
          <p className="font-fraunces text-[20px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
            {personaName(persona.id)}
          </p>
          <p className="mt-1 font-serif text-[13px] italic leading-relaxed text-paper-300">{t(`platform.portrait.bio.${persona.id}`)}</p>
        </div>
      </div>
      <p className="data-text mt-3 text-[11px] text-iron-400 tnums">
        {!session ? t('platform.portrait.signIn') : record ? t('platform.portrait.record', { won: record.won, lost: record.lost }) : t('platform.portrait.none')}
      </p>
    </section>
  );
}
