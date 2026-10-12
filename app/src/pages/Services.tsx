import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useSeasonReview, useSeasons, useSession, useStranger } from '@/online/session';
import PageShell from '@/components/site/PageShell';
import EmptyState from '@/components/platform/EmptyState';

/* ------------------------------------------------------------------ */
/* /services — every service the cote has known, and the review of the */
/* one chosen: the players by rating, the companies by wins, the game  */
/* of the service. The running one is reviewed as it stands.           */
/* ------------------------------------------------------------------ */

export default function Services() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();
  const seasons = useSeasons();
  const [chosen, setChosen] = useState<string | null>(null);
  const current = desk?.season.id ?? null;
  const id = chosen ?? seasons?.[0]?.id ?? current;
  const review = useSeasonReview(id);
  return (
    <PageShell eyebrow={t('platform.seasons.eyebrow')} title={t('platform.seasons.title')} lede={t('platform.seasons.lede')}>
      {stranger ? (
        <EmptyState className="console" title={t('platform.seasons.signInTitle')} copy={t('platform.seasons.signIn')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />
      ) : !session ? (
        <p className="font-serif text-[14px] italic text-iron-400">{t('platform.ranking.loading')}</p>
      ) : (
        <div className="grid gap-8 min-[1100px]:grid-cols-12">
          {/* the list keeps a column's measure when the aside takes the full
              width: a name and its state stay within reach of each other */}
          <aside className="max-w-[520px] min-[1100px]:col-span-3 min-[1100px]:max-w-none">
            <p className="micro-label text-paper-100">{t('platform.seasons.list')}</p>
            <div className="gz-rule-double mt-2" aria-hidden />
            <ul className="mt-2 flex flex-col">
              {(seasons ?? []).map((s) => (
                <li key={s.id}>
                  {/* the service read on the right is marked by a brass bar, not by its ink alone */}
                  <button
                    type="button"
                    onClick={() => setChosen(s.id)}
                    aria-current={id === s.id ? 'true' : undefined}
                    className={cn('flex w-full items-baseline justify-between gap-3 border-b border-l-2 border-b-[var(--gz-ink-faint)] py-2 pl-3 text-left transition-colors hover:bg-enamel-800', id === s.id ? 'border-l-brass-300 text-brass-300' : 'border-l-transparent text-paper-100')}
                  >
                    <span className="font-fraunces text-[15px] font-medium">
                      {s.name}
                    </span>
                    {s.id === current && <span className="micro-label text-iron-400">{t('platform.seasons.current')}</span>}
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
                <p className="mt-3 font-serif text-[14px] italic text-paper-300">{t('platform.seasons.games', { n: review.games })}</p>
                {review.best && (
                  <div className="mt-6">
                    <p className="micro-label text-brass-300">{t('platform.seasons.best')}</p>
                    <p className="mt-1 font-fraunces text-[20px] font-medium text-paper-100">
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
                          <span className="data-text w-5 text-iron-400 tnums">{i + 1}.</span>
                          <span className="min-w-0 flex-1 truncate font-fraunces text-[15px] font-medium">
                            {row.name}
                          </span>
                          <span className="data-text text-paper-300 tnums">{row.rating}</span>
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
                          <span className="data-text w-5 text-iron-400 tnums">{i + 1}.</span>
                          <span className="min-w-0 flex-1 truncate font-fraunces text-[15px] font-medium text-paper-100">
                            {row.name}
                          </span>
                          <span className="data-text text-paper-300 tnums">{t('platform.companies.wins', { n: row.wins, games: row.games })}</span>
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
