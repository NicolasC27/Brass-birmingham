import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { PERSONAS, personaName } from '@/game/data';
import { useEdition, useSession } from '@/online/session';
import { weekOf } from '@/platform/almanac';
import { useRivals } from '@/platform/rivals';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The portrait of the week: one of the four machines in turn, its     */
/* portrait, three lines of a life of the era, and its record against  */
/* the club this week as the office counted it — and against the       */
/* reader, when they have met it at home.                              */
/* ------------------------------------------------------------------ */

export default function Portrait() {
  const t = useT();
  const session = useSession();
  const [week] = useState(weekOf);
  const persona = PERSONAS[week % PERSONAS.length];
  const edition = useEdition(week);
  const record = edition?.machines.find((m) => m.name === persona.name) ?? null;
  const rivals = useRivals();
  const mine = session ? (rivals?.find((r) => r.persona === persona.id && r.games > 0) ?? null) : null;
  return (
    <section aria-label={t('platform.portrait.eyebrow')} className="gz-classified !items-start !p-5 !text-left">
      <h2 className="micro-label text-paper-100">
        {t('platform.portrait.eyebrow')}
        <GlossMark id="portrait" />
      </h2>
      <div className="mt-3 flex gap-4">
        <div className="gz-engraving h-[92px] w-[92px] shrink-0">
          <img src={`/portrait-${persona.id}.webp`} alt="" className="!aspect-square" />
        </div>
        <div className="min-w-0">
          <p className="font-fraunces text-[20px] font-medium leading-tight text-paper-100">
            {personaName(persona.id)}
          </p>
          <p className="mt-1 font-serif text-[13px] italic leading-relaxed text-paper-300">{t(`platform.portrait.bio.${persona.id}`)}</p>
        </div>
      </div>
      {/* the record is a tally and takes the ledger's mono; the invitation to
          sign is a sentence and takes the house's own */}
      <p className={cn('mt-3 text-[10.5px] text-iron-400', record ? 'data-text tnums' : 'font-ui')}>
        {!session ? t('platform.portrait.signIn') : record ? t('platform.portrait.record', { won: record.won, lost: record.lost }) : t('platform.portrait.none')}
      </p>
      {mine && <p className="mt-1 data-text tnums text-[10.5px] text-iron-400">{t('rivals.record', { games: mine.games, won: mine.won })}</p>}
    </section>
  );
}
