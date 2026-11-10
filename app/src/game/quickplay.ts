import { setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { LESSON_IDS, freshProgress, readLearnt, saveProgress } from '@/components/game/lessons';
import type { CourseId } from '@/components/game/lessons';
import { SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import { personaName } from '@/game/data';
import { tr } from '@/i18n';
import { forgetHomeGame, homeKnown, homeSnapshot, listHomeGames, openHomeGame, refreshHome } from './home';
import type { HomeTable } from './home';
import type { SetupPayload } from './types';

/* ------------------------------------------------------------------ */
/* Quick play — the title screen's "play now". A visitor should be on  */
/* the board in one click: the table is dressed here (you against two  */
/* clockwork rivals), opened at the office, which deals it its code,   */
/* and the game page reads it like any other.                          */
/* ------------------------------------------------------------------ */

/** the game last touched, if any — where it stands */
export function readResume(): HomeTable | null {
  return listHomeGames()[0] ?? null;
}

/** the table quick play dresses: a solo setup the player made earlier, else you and two rivals */
export function quickSetup(): StoredSetup {
  const stored = loadStoredSetup();
  if (stored && stored.players.filter((p) => p.type === 'human').length === 1 && stored.players.some((p) => p.type === 'bot')) return stored;
  return {
    players: [
      { name: tr('setup.defaults.playerOne'), color: 'brass', type: 'human' },
      { name: personaName('wedgwood'), color: 'oxblood', type: 'bot', persona: 'wedgwood' },
      { name: personaName('arkwright'), color: 'verdigris', type: 'bot', persona: 'arkwright' },
    ],
    options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
  };
}

/** the guided game: you against one gentle machine, canal era only, assistance on.
 *  The table it is played at is kept by its code: the guide comes back with
 *  that table, and with no other */
export const TUTORIAL_KEY = 'brassworks.tutorial.table';
/** the deals a guided game is dealt, each checked against the guide's words:
 *  the reader plays first and holds a coal card and a forge card, a mine
 *  may stand a canal away from a forge town, each works of the hand has a
 *  buyer (guidedDeal.dealMisses) — and, played out, a reader who follows
 *  the lessons feeds a forge from their own mine and sells by round 5,
 *  whichever mine they pick, and no lesson is ever missed or left with no
 *  way on. The first deal of each layout of the merchants' tiles that
 *  holds, in seed order: app/tools/guide/deals.ts plays them out and
 *  writes the list again — with the machine at 200 ms a move, at node's
 *  speed, so run it again after a change to the machines or the lessons */
export const TUTORIAL_SEEDS: readonly number[] = [3, 395, 767, 1062, 1164, 1512, 1568, 1737, 2108, 2213, 2276, 2747];
/** the seed of the reader's last guided deal: starting over is another game */
export const TUTORIAL_DEALT_KEY = 'brassworks.tutorial.dealt';
/** the deal every guided game was dealt before there was a list */
const FIRST_SEED = 3;
/** the deal's seed, which stood for the guided table before its code did */
const TUTORIAL_SEED_KEY = 'brassworks.tutorial.v1';

/** the second lesson: the full game, both eras, against the same gentle
 *  machine, assistance on — at a table of its own, kept by its code
 *  beside the first lesson's: either may be left unfinished while the
 *  other is played */
export const FULL_KEY = 'brassworks.tutorial.full.table';
/** its deals: a list of its own, apart from the first lesson's so that it
 *  never deals again an opening the reader played there, and checked on
 *  what the first lesson's list never plays — the rail era. The reader
 *  plays first and holds a works a merchant of the table buys (the canal
 *  is theirs to play); played out by a reader who follows the lessons and
 *  by one who follows their criteria, every lesson is shown, none is left
 *  with no way on, and the careful reader opens the rail as its plan says
 *  — a brewery, a rail, a double rail. The first deal of each layout of
 *  the merchants' tiles: app/tools/guide/deals.ts --full plays them out
 *  and writes the list, at the machine's two forms, 200 ms a move */
export const FULL_SEEDS: readonly number[] = [2, 6, 7, 11, 18, 19, 26, 27];
/** the seed of the reader's last deal of the second lesson */
export const FULL_DEALT_KEY = 'brassworks.tutorial.full.dealt';
/** where each course keeps the code of its table */
const BOUND: Readonly<Record<CourseId, string>> = { short: TUTORIAL_KEY, full: FULL_KEY };
/** the key a course keeps its table under — the store's leave reads it */
export const boundKeyOf = (course: CourseId): string => BOUND[course];

/** is this the guided table? The one whose code the guide was opened at —
 *  or, read once from before the code was kept, a table of the guided deal */
export function guidedTable(code: string, seed: number): boolean {
  try {
    const bound = localStorage.getItem(TUTORIAL_KEY);
    if (bound !== null) return bound === code;
    const old = localStorage.getItem(TUTORIAL_SEED_KEY);
    if (old === null || !/^\d+$/.test(old) || Number(old) !== seed) return false;
    localStorage.setItem(TUTORIAL_KEY, code);
    localStorage.removeItem(TUTORIAL_SEED_KEY);
    return true;
  } catch {
    return false;
  }
}

/** the course this table is the guided table of: the second lesson's, the
 *  first's (guidedTable, which takes up the old seed once), or none */
export function guidedCourse(code: string, seed: number): CourseId | null {
  try {
    if (localStorage.getItem(FULL_KEY) === code) return 'full';
  } catch {
    return null;
  }
  return guidedTable(code, seed) ? 'short' : null;
}

/** the guided table to go back to: the one the guide is bound to, while the
 *  register keeps it and it is not played out. None, and the course deals
 *  a new one */
export function resumeOf(bound: string | null, tables: readonly HomeTable[]): string | null {
  if (!bound) return null;
  return tables.some((t) => t.code === bound && !t.over) ? bound : null;
}

/** the code of the table a course's guide is bound to, if any */
export function guidedBound(course: CourseId = 'short'): string | null {
  try {
    return localStorage.getItem(BOUND[course]);
  } catch {
    return null;
  }
}

/** a course's guided table left unfinished, as the register now stands */
export function guidedResume(tables: readonly HomeTable[] = listHomeGames(), course: CourseId = 'short'): string | null {
  return resumeOf(guidedBound(course), tables);
}

/** a course's guided table to open: the one left unfinished — the
 *  register read first when it has not been, so that a table the office
 *  still keeps is never dealt over — or, with none, or asked `again`, a
 *  new one */
export async function openGuided(again = false, course: CourseId = 'short'): Promise<string> {
  const left = guidedResume(homeKnown() ? homeSnapshot() : await refreshHome(), course);
  if (left && !again) return left;
  /* one guided table a course: dealt again, the one left unfinished is
     forgotten, so the register never fills with lessons begun */
  if (left) await forgetHomeGame(left);
  return course === 'full' ? startFullLesson() : startTutorial();
}

/** a guided deal to play: any of the list but the reader's last one */
export function drawTutorialSeed(last: number | null, roll: () => number = Math.random, seeds: readonly number[] = TUTORIAL_SEEDS): number {
  const left = seeds.filter((s) => s !== last);
  return left[Math.min(left.length - 1, Math.floor(roll() * left.length))] ?? seeds[0];
}

/** the seed of the reader's last guided deal — for a reader of the guide
 *  from before the list, its one deal; none for a newcomer */
export function lastTutorialSeed(): number | null {
  try {
    const dealt = localStorage.getItem(TUTORIAL_DEALT_KEY);
    if (dealt !== null && /^\d+$/.test(dealt)) return Number(dealt);
    /* the first lesson's marks: the second's say nothing of its deal */
    const guided = localStorage.getItem(TUTORIAL_KEY) !== null || localStorage.getItem(TUTORIAL_SEED_KEY) !== null || readLearnt().some((id) => LESSON_IDS.includes(id));
    return guided ? FIRST_SEED : null;
  } catch {
    return null;
  }
}

export function tutorialSetup(): StoredSetup {
  return {
    players: [
      { name: tr('setup.defaults.playerOne'), color: 'brass', type: 'human' },
      { name: personaName('wedgwood'), color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  };
}

/** the second lesson's table: the first's, dressed for a full game */
export function fullSetup(): StoredSetup {
  const setup = tutorialSetup();
  return { ...setup, options: { ...setup.options, eraLength: 'standard' } };
}

/** the seed of the reader's last deal of the second lesson; none before one */
function lastFullSeed(): number | null {
  try {
    const dealt = localStorage.getItem(FULL_DEALT_KEY);
    return dealt !== null && /^\d+$/.test(dealt) ? Number(dealt) : null;
  } catch {
    return null;
  }
}

/** dress the second lesson's table and open it on the register, as the
 *  first lesson's is: nothing of it written before the office has dealt
 *  it, and the first lesson's table and record left as they are */
export async function startFullLesson(): Promise<string> {
  const seed = drawTutorialSeed(lastFullSeed(), Math.random, FULL_SEEDS);
  const { code } = await openHomeGame(seed, fullSetup() as unknown as SetupPayload);
  try {
    localStorage.setItem(FULL_KEY, code);
    localStorage.setItem(FULL_DEALT_KEY, String(seed));
    localStorage.removeItem(MINI_KEY);
  } catch {
    /* storage unavailable — the guide stays with this visit */
  }
  saveProgress(freshProgress(code, 'full'));
  setBoardOption('guideFolded', false);
  return code;
}

/** dress the guided table and open it on the register — the caller then opens
 *  /game/local/<code>, where the guide takes over. The dress goes to the
 *  office with the deal and nowhere else: the table form this browser keeps
 *  is the player's own, and quick play dresses its tables from it */
export async function startTutorial(): Promise<string> {
  const seed = drawTutorialSeed(lastTutorialSeed());
  const { code } = await openHomeGame(seed, tutorialSetup() as unknown as SetupPayload);
  /* the guide goes with the table the office dealt, and the lessons start
     afresh there — only once it is dealt, so a table the office never
     opened takes nothing of the last one */
  try {
    localStorage.setItem(TUTORIAL_KEY, code);
    localStorage.setItem(TUTORIAL_DEALT_KEY, String(seed));
    localStorage.removeItem(TUTORIAL_SEED_KEY);
    /* a fold left over from a past run must not re-apply to a fresh one */
    localStorage.removeItem(MINI_KEY);
  } catch {
    /* storage unavailable — the guide stays with this visit */
  }
  saveProgress(freshProgress(code));
  /* nor a lane folded at the last table: the welcome is read in the open */
  setBoardOption('guideFolded', false);
  return code;
}

/** dress the table and open it at the office — the caller then opens /game/local/<code> */
export async function startQuickGame(): Promise<string> {
  const setup = quickSetup();
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
  return (await openHomeGame(undefined, setup as unknown as SetupPayload)).code;
}
