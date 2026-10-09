import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { startTutorial } from '@/game/quickplay';
import { personaName } from '@/game/data';
import { LESSONS, lessonsReached, lessonsToRedo } from '@/platform/cours';
import { getChapters } from '@/components/rules/rulesData';
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
  /* the syllabus is the register's own table of contents — all twelve
     chapters, glossary and approximations included — not a copy of ten */
  const chapters = getChapters();
  const chapterNo = (id: string) => String(chapters.findIndex((c) => c.id === id) + 1).padStart(2, '0');

  return (
    <PageShell back={{ to: '/rules', label: t('platform.cours.back') }} eyebrow={t('platform.cours.eyebrow')} title={t('platform.cours.title')} lede={t('platform.cours.lede')}>
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
                  {/* a mark of the record, not a box to tick: the lozenge of
                      the register's lists, inked once the lesson is read and
                      a bare rule until then; it sits on the first line even
                      when the title runs to two */}
                  <span aria-hidden className="flex h-[21px] w-3 shrink-0 items-center justify-center self-start">
                    {read ? <span className="h-[7px] w-[7px] rotate-45 bg-bottle-400" /> : <span className="h-px w-2 bg-[var(--gz-ink-soft)]" />}
                  </span>
                  <span className="sr-only">{t(read ? 'platform.cours.markRead' : 'platform.cours.markUnread')}</span>
                  <span className="data-text w-6 shrink-0 text-iron-400 tnums">{String(i + 1).padStart(2, '0')}</span>
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
            <span className="data-text text-iron-400 tnums">{t('platform.cours.reached', { done: reached, total: LESSONS.length })}</span>
          </div>

          {/* the sheet of progress keeps to the lessons' column: alone under
              the grid it was a 1176px cartouche for two lines */}
          <div className="mt-10">
            <h2 className="gz-head h2-section">{t('platform.cours.sheet')}</h2>
            <div className="mt-4">
              <ProgressCard emptyLink={{ to: '/desk#tables', label: t('platform.cours.toAnalyse') }} />
            </div>
          </div>
        </section>

        {/* the syllabus: the rules' chapters, and what to take again */}
        <aside className="gz-col-rule min-[1100px]:col-span-5">
          <h2 className="gz-head h2-section">{t('platform.cours.syllabus')}</h2>
          <ol className="mt-4 flex flex-col">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <Link to={`/rules#${c.id}`} className="group flex items-baseline gap-3 border-b border-[var(--gz-ink-faint)] py-2 transition-colors hover:bg-enamel-800">
                  <span className="data-text w-6 shrink-0 text-iron-400 tnums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-fraunces text-[14px] font-medium text-paper-100">{c.title}</span>
                  {/* one ink for every « Read » of the page, the brass of a link */}
                  <span className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-500 transition-colors group-hover:text-paper-100">{t('platform.cours.read')} →</span>
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
                      <span className="data-text text-iron-400 tnums">
                        {t('platform.cours.redoMeta', { games: r.games, times: r.times })} · {t('platform.cours.chapter', { n: chapterNo(r.chapter), title: t(`rules.chapters.${r.chapter}`) })}
                      </span>
                    </span>
                    <span className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-500 transition-colors group-hover:text-paper-100">{t('platform.cours.read')} →</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
