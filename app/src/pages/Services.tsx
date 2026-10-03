import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useSeasonReview, useSeasons, useSession } from '@/online/session';
import PageShell from '@/components/site/PageShell';

/* ------------------------------------------------------------------ */
/* /services — every service the cote has known, and the review of the */
/* one chosen: the players by rating, the companies by wins, the game  */
/* of the service. The running one is reviewed as it stands.           */
/* ------------------------------------------------------------------ */

export default function Services() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const desk = useDesk();
  const seasons = useSeasons();
  const [chosen, setChosen] = useState<string | null>(null);
  const current = desk?.season.id ?? null;
  const id = chosen ?? seasons?.[0]?.id ?? current;
  const review = useSeasonReview(id);
  return (
    <PageShell eyebrow={t('platform.seasons.eyebrow')} title={t('platform.seasons.title')} lede={t('platform.seasons.lede')}>
      {!session ? (
        <p className="font-serif text-[14px] italic text-paper-300">{t('platform.challenge.board.signIn')}</p>
      ) : (
        <div className="grid gap-8 min-[1100px]:grid-cols-12">
          <aside className="min-[1100px]:col-span-3">
            <p className="micro-label text-paper-100">{t('platform.seasons.list')}</p>
            <div className="gz-rule-double mt-2" aria-hidden />
            <ul className="mt-2 flex flex-col">
              {(seasons ?? []).map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setChosen(s.id)} className={cn('flex w-full items-baseline justify-between gap-3 border-b border-[var(--gz-ink-faint)] py-2 text-left transition-colors hover:bg-enamel-800', id === s.id ? 'text-brass-300' : 'text-paper-100')}>
                    <span className="font-fraunces text-[15px] font-medium" style={{ fontVariationSettings: '"opsz" 48' }}>
                      {s.name}
                    </span>
                    {s.id === current && <span className="micro-label text-iron-600">{t('platform.seasons.current')}</span>}
                  </button>
                </li>
              ))}
              {seasons && seasons.length === 0 && <li className="py-3 font-serif text-[13px] italic text-paper-300">{t('platform.seasons.none')}</li>}
            </ul>
          </aside>
          <section className="gz-col-rule min-[1100px]:col-span-9">
            {!review ? (
              <p className="font-serif text-[14px] italic text-iron-400">{t('platform.ranking.loading')}</p>
            ) : (
              <>
                <h2 className="gz-head h2-section">{review.season.name}</h2>
                <p className="mt-3 text-center font-serif text-[14px] italic text-paper-300">{t('platform.seasons.games', { n: review.games })}</p>
                {review.best && (
                  <div className="mt-6 text-center">
                    <p className="micro-label text-brass-300">{t('platform.seasons.best')}</p>
                    <p className="mt-1 font-fraunces text-[20px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
                      {t('platform.home.edition.bestLine', { table: tableTitle(review.best.name, lang), name: review.best.winner, vp: review.best.vp })}
                    </p>
                  </div>
                )}
                <div className="mt-8 grid gap-8 min-[760px]:grid-cols-2">
                  <div>
                    <p className="micro-label text-paper-100">{t('platform.seasons.players')}</p>
                    <div className="gz-rule-double mt-2" aria-hidden />
                    <ol className="flex flex-col">
                      {review.players.map((row, i) => (
                        <li key={row.id} className={cn('flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2', row.id === session.id && 'text-brass-300')}>
                          <span className="data-text w-5 text-[11px] text-iron-600 tnums">{i + 1}.</span>
                          <span className="min-w-0 flex-1 truncate font-fraunces text-[15px] font-medium" style={{ fontVariationSettings: '"opsz" 48' }}>
                            {row.name}
                          </span>
                          <span className="data-text text-[12px] text-paper-300 tnums">{row.rating}</span>
                        </li>
                      ))}
                      {review.players.length === 0 && <li className="py-3 font-serif text-[13px] italic text-paper-300">{t('platform.seasons.nobody')}</li>}
                    </ol>
                  </div>
                  <div>
                    <p className="micro-label text-paper-100">{t('platform.companies.title')}</p>
                    <div className="gz-rule-double mt-2" aria-hidden />
                    <ol className="flex flex-col">
                      {review.companies.map((row, i) => (
                        <li key={row.id} className="flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2">
                          <span className="data-text w-5 text-[11px] text-iron-600 tnums">{i + 1}.</span>
                          <span className="min-w-0 flex-1 truncate font-fraunces text-[15px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
                            {row.name}
                          </span>
                          <span className="data-text text-[12px] text-paper-300 tnums">{t('platform.companies.wins', { n: row.wins, games: row.games })}</span>
                        </li>
                      ))}
                      {review.companies.length === 0 && <li className="py-3 font-serif text-[13px] italic text-paper-300">{t('platform.companies.none')}</li>}
                    </ol>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
