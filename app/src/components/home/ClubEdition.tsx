import { useState } from 'react';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useEdition, useSession } from '@/online/session';
import { weekOf } from '@/platform/almanac';

/* ------------------------------------------------------------------ */
/* The club's edition: what the whole house played this week, as the   */
/* office keeps it — the game of the week, the most assiduous member,  */
/* the latest games told the chronicle's way. Nothing is made up.      */
/* ------------------------------------------------------------------ */

const hash = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export default function ClubEdition() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const [week] = useState(weekOf);
  const edition = useEdition(week);
  return (
    <section aria-label={t('platform.home.edition.title')}>
      <p className="micro-label text-paper-100">{t('platform.home.edition.title')}</p>
      <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
        {!session ? (
          <p className="px-1 py-5 text-center font-serif text-[13.5px] italic text-paper-300">{t('platform.home.edition.signIn')}</p>
        ) : !edition ? (
          <p className="px-1 py-5 text-center font-serif text-[13.5px] italic text-paper-300">{t('platform.home.activity.loading')}</p>
        ) : edition.games === 0 ? (
          <p className="px-1 py-5 text-center font-serif text-[13.5px] italic text-paper-300">{t('platform.home.edition.none')}</p>
        ) : (
          <div className="px-1 py-3">
            <p className="data-text text-[11px] text-iron-400 tnums">{t('platform.home.edition.games', { n: edition.games })}</p>
            {edition.best && (
              <div className="mt-3">
                <p className="micro-label text-brass-300">{t('platform.home.edition.best')}</p>
                <p className="mt-1 font-fraunces text-[17px] font-medium leading-snug text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
                  {t('platform.home.edition.bestLine', { table: tableTitle(edition.best.name, lang), name: edition.best.winner, vp: edition.best.vp })}
                </p>
                <p className="data-text mt-1 text-[11px] text-iron-600">{edition.best.players.join(' · ')}</p>
              </div>
            )}
            {edition.busiest && <p className="mt-3 font-serif text-[13.5px] italic text-paper-300">{t('platform.home.edition.busiest', { name: edition.busiest.name, n: edition.busiest.games })}</p>}
            <ul className="mt-3 flex flex-col">
              {edition.latest.map((g) => (
                <li key={g.code + g.finishedAt} className="border-b border-[var(--gz-ink-faint)] py-2 font-serif text-[13.5px] leading-snug text-paper-100 last:border-b-0">
                  {t(`platform.chronicle.club.${hash(g.code) % 3}`, { table: tableTitle(g.name, lang), name: g.winner, vp: g.vp, n: g.players })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
