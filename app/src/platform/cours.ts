import { listProgress, recurring, type Motif } from '@/game/progress';

/* ------------------------------------------------------------------ */
/* The evening course: the guided game's lessons, the rules' chapters, */
/* and what the judge says keeps going wrong, stitched into a printed   */
/* programme. The lesson ids mirror the guide's STEPS (Guide.tsx), the  */
/* chapter ids the rules page's sections.                               */
/* ------------------------------------------------------------------ */

/** the lessons of the guided game, in the order the guide gives them */
export const LESSONS = ['welcome', 'board', 'goal', 'money', 'mat', 'matRead', 'hand', 'coal', 'botTurn', 'payday', 'link', 'iron', 'develop', 'works', 'market', 'beer', 'sell', 'flipped', 'loan', 'eraEnd', 'plan', 'tips', 'onward'] as const;
/** the chapters of the rules, with their numerals */
export const CHAPTERS = ['quickstart', 'eras', 'actions', 'industries', 'network', 'supply', 'market', 'selling', 'money', 'scoring'] as const;
export type Chapter = (typeof CHAPTERS)[number];

/** the chapter a recurring miss sends the reader back to */
export const CHAPTER_OF: Record<Motif, Chapter> = {
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

const REACH_KEY = 'brassworks.tutorial.reached';

/** how far the guided game was read, as an index into LESSONS (0 = not begun) */
export function lessonsReached(): number {
  try {
    return Math.max(0, Math.min(LESSONS.length, Number(localStorage.getItem(REACH_KEY) ?? 0)));
  } catch {
    return 0;
  }
}

/** the lessons to take again: the judge's recurring motifs over the last games */
export function lessonsToRedo(): { motif: Motif; chapter: Chapter; games: number; times: number }[] {
  return recurring(listProgress(), 10)
    .slice(0, 3)
    .map((r) => ({ motif: r.motif, chapter: CHAPTER_OF[r.motif], games: r.games, times: r.times }));
}
