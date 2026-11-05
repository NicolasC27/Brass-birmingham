import { useState } from 'react';
import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { personaName } from '@/game/data';
import { tableTitle } from '@/online/tableNames';
import { useGuidedGame } from '@/hooks/use-guided-game';
import { lessonsRead, lessonsToRedo } from '@/platform/cours';
import { courseKeyOf } from '@/components/game/lessonWords';
import { courseIds, lastOf } from '@/components/game/lessons';
import type { CourseId } from '@/components/game/lessons';
import { getChapters } from '@/components/rules/rulesData';
import PageShell, { Refusal } from '@/components/site/PageShell';
import TrailNotice from '@/components/site/TrailNotice';
import ProgressCard from '@/components/desk/ProgressCard';

/* ------------------------------------------------------------------ */
/* /cours — the evening course, printed as a programme: the guided     */
/* games' lessons with a mark against each one read — the first        */
/* lesson's short game, then the second's full one, each its own list  */
/* and count, each startable whenever the reader likes — the chapters  */
/* of the rules as the syllabus, the lessons the judge sends the reader */
/* back to, and the sheet of progress.                                  */
/* ------------------------------------------------------------------ */

/** the words each course's programme is printed with */
const WORDS: Readonly<Record<CourseId, { title: string; copy: string; begin: string; resume: string; again: string }>> = {
  short: { title: 'platform.cours.guided', copy: 'platform.cours.guidedCopy', begin: 'platform.cours.begin', resume: 'platform.cours.resume', again: 'platform.cours.again' },
  full: { title: 'platform.cours.full.title', copy: 'platform.cours.full.copy', begin: 'platform.cours.full.begin', resume: 'platform.cours.full.resume', again: 'platform.cours.full.again' },
};

/** a course's programme: its lessons, marked as read, and its table */
function Programme({ course, className }: { course: CourseId; className?: string }) {
  const t = useT();
  const lang = useLang();
  const words = WORDS[course];
  const ids = courseIds(course);
  const [passed] = useState(() => lessonsRead(course));
  const begun = passed.length > 0;
  /* a guided game played to its end with lessons it never came to: named
     under the count, which no longer rounds them up */
  const unseen = passed.includes(lastOf(course)) ? ids.filter((id) => !passed.includes(id)) : [];
  /* each lesson by the title its game gives it: the first's short game, the second's full one */
  const titleOf = (id: string) => t(`game.guide.steps.${courseKeyOf(id)}.title`, { bot: personaName('wedgwood') });
  /* the course's table left unfinished is taken up where it stands; with
     none — never begun, played out, the guide left there — the lessons
     start over at a new one, as they do when the reader asks */
  const guided = useGuidedGame(course);
  const { table, unfinished } = guided;
  return (
    <section className={className} aria-label={t(words.title)}>
      <h2 className="gz-head h2-section">{t(words.title)}</h2>
      <p className="mt-3 font-serif text-[14px] italic text-paper-300">{t(words.copy)}</p>
      <ol className="mt-4 grid gap-x-8 min-[760px]:grid-cols-2">
        {ids.map((id, i) => {
          const read = passed.includes(id);
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
              <span className={cn('font-fraunces text-[14px] font-medium', read ? 'text-paper-100' : 'text-paper-300')}>{titleOf(id)}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => guided.open()} disabled={guided.busy} aria-busy={guided.busy} className="gz-ticket gz-ticket-brass">
          <GraduationCap aria-hidden />
          {guided.busy ? t('game.page.settingTable') : t(unfinished ? words.resume : begun ? words.again : words.begin)}
        </button>
        {/* the table waits, and a reader some way into it may still start over */}
        {unfinished && begun && !guided.busy && (
          <button type="button" onClick={() => guided.open(true)} className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-500 transition-colors hover:text-paper-100">
            {t(words.again)}
          </button>
        )}
        <span className="data-text text-iron-400 tnums">{t('platform.cours.reached', { done: passed.length, total: ids.length })}</span>
      </div>
      {unseen.length > 0 && <p className="mt-2 font-serif text-[13px] italic text-paper-300">{t('platform.cours.unseen', { list: unseen.map(titleOf).join(', ') })}</p>}
      {table && <p className="mt-2 font-serif text-[13px] italic text-paper-300">{t('platform.cours.waits', { name: tableTitle(table.name, lang), round: table.round })}</p>}
      <Refusal text={guided.failed ? t('platform.cours.failed') : null} />
    </section>
  );
}

export default function Cours() {
  const t = useT();
  const [redo] = useState(lessonsToRedo);
  /* the syllabus is the register's own table of contents — all twelve
     chapters, glossary and approximations included — not a copy of ten */
  const chapters = getChapters();
  const chapterNo = (id: string) => String(chapters.findIndex((c) => c.id === id) + 1).padStart(2, '0');

  return (
    <PageShell back={{ to: '/rules', label: t('platform.cours.back') }} eyebrow={t('platform.cours.eyebrow')} title={t('platform.cours.title')} lede={t('platform.cours.lede')}>
      <div className="grid gap-10 min-[1100px]:grid-cols-12">
        {/* the guided games, lesson by lesson: the first, then the second */}
        <div className="min-[1100px]:col-span-7">
          <Programme course="short" />
          <TrailNotice className="mt-3" />
          <Programme course="full" className="mt-10" />

          {/* the sheet of progress keeps to the lessons' column: alone under
              the grid it was a 1176px cartouche for two lines */}
          <div className="mt-10">
            <h2 className="gz-head h2-section">{t('platform.cours.sheet')}</h2>
            <div className="mt-4">
              <ProgressCard emptyLink={{ to: '/desk#tables', label: t('platform.cours.toAnalyse') }} />
            </div>
          </div>
        </div>

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
