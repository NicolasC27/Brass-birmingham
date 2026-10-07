import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { startTutorial } from '@/game/quickplay';
import { personaName } from '@/game/data';
import { CHAPTERS, LESSONS, lessonsReached, lessonsToRedo } from '@/platform/cours';
import PageShell from '@/components/site/PageShell';
import ProgressCard from '@/components/desk/ProgressCard';

/* ------------------------------------------------------------------ */
/* /cours — the evening course, printed as a programme: the guided     */
/* game's lessons with a mark against each one read, the chapters of   */
/* the rules as the syllabus, the lessons the judge sends the reader    */
/* back to, and the sheet of progress.                                  */
/* ------------------------------------------------------------------ */

export default function Cours() {
  const t = useT();
  const navigate = useNavigate();
  const [reached] = useState(lessonsReached);
  const [redo] = useState(lessonsToRedo);
  const begun = reached > 0;
  const done = reached >= LESSONS.length;

  return (
    <PageShell eyebrow={t('platform.cours.eyebrow')} title={t('platform.cours.title')} lede={t('platform.cours.lede')}>
      <div className="grid gap-10 min-[1100px]:grid-cols-12">
        {/* the guided game, lesson by lesson */}
        <section className="min-[1100px]:col-span-7" aria-label={t('platform.cours.guided')}>
          <h2 className="gz-head h2-section">{t('platform.cours.guided')}</h2>
          <p className="mt-3 font-serif text-[14px] italic text-paper-300">{t('platform.cours.guidedCopy')}</p>
          <ol className="mt-4 grid gap-x-8 min-[760px]:grid-cols-2">
            {LESSONS.map((id, i) => {
              const read = i < reached;
              return (
                <li key={id} className="flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2">
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center self-center rounded-full border', read ? 'border-bottle-400 text-bottle-ink' : 'border-[var(--gz-ink-soft)]')}>
                    {read && <Check size={10} strokeWidth={3} aria-hidden />}
                  </span>
                  <span className="data-text w-6 text-[10.5px] text-iron-400 tnums">{String(i + 1).padStart(2, '0')}</span>
                  <span className={cn('font-fraunces text-[14px] font-medium', read ? 'text-paper-100' : 'text-paper-300')}>
                    {t(`game.guide.steps.${id}.title`, { bot: personaName('wedgwood') })}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void startTutorial().then((code) => navigate(`/game/local/${code}`))} className="gz-ticket gz-ticket-brass">
              <GraduationCap aria-hidden />
              {t(done ? 'platform.cours.again' : begun ? 'platform.cours.resume' : 'platform.cours.begin')}
            </button>
            <span className="data-text text-[10.5px] text-iron-400 tnums">{t('platform.cours.reached', { done: reached, total: LESSONS.length })}</span>
          </div>
        </section>

        {/* the syllabus: the rules' chapters, and what to take again */}
        <aside className="gz-col-rule min-[1100px]:col-span-5">
          <h2 className="gz-head h2-section">{t('platform.cours.syllabus')}</h2>
          <ol className="mt-4 flex flex-col">
            {CHAPTERS.map((id, i) => (
              <li key={id}>
                <Link to={`/rules#${id}`} className="group flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2 transition-colors hover:bg-enamel-800">
                  <span className="data-text w-6 text-[10.5px] text-iron-400 tnums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-fraunces text-[14px] font-medium text-paper-100">
                    {t(`rules.chapters.${id}`)}
                  </span>
                  <span className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-iron-400 transition-colors group-hover:text-brass-300">{t('platform.cours.read')} →</span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-8">
            <p className="micro-label text-paper-100">{t('platform.cours.redo')}</p>
            <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
              {redo.length === 0 ? (
                <p className="py-4 font-serif text-[13px] italic text-paper-300">{t('platform.cours.redoNone')}</p>
              ) : (
                redo.map((r) => (
                  <Link key={r.motif} to={`/rules#${r.chapter}`} className="group flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-[13px] leading-snug text-paper-100">{t(`game.debrief.motifs.${r.motif}`)}</span>
                      <span className="data-text text-[10.5px] text-iron-400 tnums">
                        {t('platform.cours.redoMeta', { games: r.games, times: r.times })} · {t('platform.cours.chapter', { n: String(CHAPTERS.indexOf(r.chapter) + 1).padStart(2, '0'), title: t(`rules.chapters.${r.chapter}`) })}
                      </span>
                    </span>
                    <span className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors group-hover:text-paper-100">{t('platform.cours.read')} →</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <h2 className="gz-head h2-section">{t('platform.cours.sheet')}</h2>
        <div className="mt-4">
          <ProgressCard />
        </div>
      </div>
    </PageShell>
  );
}
