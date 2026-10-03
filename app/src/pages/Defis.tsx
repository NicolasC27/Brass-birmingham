import { useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { personaName } from '@/game/data';
import { attemptsOf, challengeOf, type Challenge } from '@/game/challenge';
import { weekOf } from '@/platform/almanac';
import { useChallengeBoard, useSession } from '@/online/session';
import PageShell from '@/components/site/PageShell';

/* ------------------------------------------------------------------ */
/* /defis — the notices of the past weeks, each with the week's board  */
/* as the office keeps it and the reader's own best attempt: where one */
/* came close, and where the others stood.                             */
/* ------------------------------------------------------------------ */

const WEEKS = 12;

function WeekBoard({ challenge }: { challenge: Challenge }) {
  const t = useT();
  const session = useSession();
  const board = useChallengeBoard(challenge.week);
  if (!session) return <p className="font-serif text-[13px] italic text-paper-300">{t('platform.challenge.board.signIn')}</p>;
  if (!board) return <p className="font-serif text-[13px] italic text-iron-400">{t('platform.ranking.loading')}</p>;
  if (board.players === 0) return <p className="font-serif text-[13px] italic text-paper-300">{t('platform.defis.noBoard')}</p>;
  return (
    <ol className="flex flex-col">
      {board.rows.slice(0, 3).map((row, i) => (
        <li key={row.id} className={cn('flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-1 last:border-b-0', row.id === session.id && 'text-brass-300')}>
          <span className="data-text w-4 text-[11px] text-iron-600 tnums">{i + 1}.</span>
          <span className="min-w-0 flex-1 truncate font-fraunces text-[14px] font-medium" style={{ fontVariationSettings: '"opsz" 48' }}>
            {row.name}
          </span>
          <span className="font-fraunces text-[15px] font-medium tnums">{row.points}</span>
        </li>
      ))}
      {board.me && board.me.rank > 3 && <li className="data-text pt-1 text-[11px] text-iron-400 tnums">{t('platform.challenge.board.mine', { rank: board.me.rank, points: board.me.points })}</li>}
    </ol>
  );
}

export default function Defis() {
  const t = useT();
  const [now] = useState(weekOf);
  const weeks = Array.from({ length: Math.min(WEEKS, now + 1) }, (_, i) => now - i);
  return (
    <PageShell eyebrow={t('platform.defis.eyebrow')} title={t('platform.defis.title')} lede={t('platform.defis.lede')}>
      <div className="gz-rule-double" aria-hidden />
      <ol className="flex flex-col">
        {weeks.map((week) => {
          const c = challengeOf(week);
          const best = attemptsOf(week)[0] ?? null;
          const current = week === now;
          return (
            <li key={week} className={cn('grid gap-6 border-b border-[var(--gz-ink-faint)] py-6 min-[900px]:grid-cols-12', current && 'bg-brass-500/[.05]')}>
              <div className="min-[900px]:col-span-5">
                <p className="micro-label text-iron-400">
                  {t('platform.defis.week', { n: c.number })}
                  {current && <span className="ml-2 text-brass-300">{t('platform.defis.current')}</span>}
                </p>
                <h2 className="mt-1 font-fraunces text-[22px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
                  {t(`platform.challenge.titles.${c.id}`)}
                </h2>
                <p className="mt-2 font-serif text-[13.5px] italic leading-relaxed text-paper-300">{t(`platform.challenge.stories.${c.id}`)}</p>
                <p className="data-text mt-2 text-[11px] text-iron-600">{t('platform.challenge.rivals', { names: c.rivals.map(personaName).join(', ') })}</p>
              </div>
              <div className="min-[900px]:col-span-3">
                <p className="micro-label text-paper-100">{t('platform.defis.mine')}</p>
                {best ? (
                  <>
                    <p className="mt-1 font-fraunces text-[30px] font-normal leading-none text-paper-100 tnums">{best.points}</p>
                    <p className="data-text mt-1 text-[11px] text-iron-400 tnums">
                      {t('platform.challenge.board.met', { done: best.met.filter(Boolean).length, total: best.met.length })} · {best.vp} PV
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-serif text-[13px] italic text-paper-300">{t('platform.defis.none')}</p>
                )}
                {current && (
                  <Link to="/#defi" className="mt-3 inline-block font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-300 transition-colors hover:text-paper-100">
                    {t('platform.defis.open')}
                  </Link>
                )}
              </div>
              <div className="min-[900px]:col-span-4">
                <p className="micro-label text-paper-100">{t('platform.challenge.board.title')}</p>
                <div className="mt-1">
                  <WeekBoard challenge={c} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
