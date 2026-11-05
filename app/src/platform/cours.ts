import { FULL_LESSON_IDS, LESSON_IDS, courseIds, readLearnt } from '@/components/game/lessons';
import type { CourseId } from '@/components/game/lessons';
import { listProgress, recurring, type Motif } from '@/game/progress';

/* ------------------------------------------------------------------ */
/* The evening course: the guided game's lessons, the rules' chapters, */
/* and what the judge says keeps going wrong, stitched into a printed   */
/* programme. The lessons are the guide's own (lessons.ts), the chapter */
/* ids the rules page's sections.                                       */
/* ------------------------------------------------------------------ */

/** the lessons of the guided game, in the order the guide gives them */
export const LESSONS = LESSON_IDS;
/** and of the second lesson, the full game: a programme of its own */
export const FULL_LESSONS = FULL_LESSON_IDS;
/** the ids of the rules' twelve chapters, as the rules page anchors them
    (rulesData.getChapters, which carries their numerals and titles) */
export const CHAPTER_IDS = ['quickstart', 'eras', 'actions', 'industries', 'network', 'supply', 'market', 'selling', 'money', 'scoring', 'glossary', 'approximations'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

/** the chapter a recurring miss sends the reader back to */
export const CHAPTER_OF: Record<Motif, ChapterId> = {
  singleRail: 'network',
  loanOverBuild: 'money',
  passed: 'actions',
  buildOverDevelop: 'industries',
  developOverBuild: 'industries',
  sellLate: 'selling',
  buildOverLink: 'network',
  linkOverBuild: 'industries',
  wrongTown: 'network',
  wrongIndustry: 'industries',
};

/** the lessons of a course passed, in the guide's order: a lesson counts
 *  once it is passed, wherever the reader passed it from, at whichever
 *  guided table of that course — one dealt afresh starts its lessons
 *  over, not the course's marks. A page the game never called for — no
 *  sale, no merchant's barrel — is passed with the closing word
 *  (lessons.closed); a lesson the reader never came to is not, however
 *  the game ended. Each course counts its own: the second lesson's marks
 *  are not the first's */
export function lessonsRead(course: CourseId = 'short'): string[] {
  const read = readLearnt();
  return courseIds(course).filter((id) => read.includes(id));
}

/** the lessons to take again: the judge's recurring motifs over the last games */
export function lessonsToRedo(): { motif: Motif; chapter: ChapterId; games: number; times: number }[] {
  return recurring(listProgress(), 10)
    .slice(0, 3)
    .map((r) => ({ motif: r.motif, chapter: CHAPTER_OF[r.motif], games: r.games, times: r.times }));
}
