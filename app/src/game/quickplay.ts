import { setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { freshProgress, readLearnt, saveProgress } from '@/components/game/lessons';
import { SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import { personaName } from '@/game/data';
import { tr } from '@/i18n';
import { homeKnown, homeSnapshot, listHomeGames, openHomeGame, refreshHome } from './home';
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
 *  writes the list again */
export const TUTORIAL_SEEDS: readonly number[] = [3, 395, 767, 1062, 1164, 1512, 1568, 1737, 2108, 2213, 2276, 2747];
/** the seed of the reader's last guided deal: starting over is another game */
export const TUTORIAL_DEALT_KEY = 'brassworks.tutorial.dealt';
/** the deal every guided game was dealt before there was a list */
const FIRST_SEED = 3;
/** the deal's seed, which stood for the guided table before its code did */
const TUTORIAL_SEED_KEY = 'brassworks.tutorial.v1';

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

/** the guided table to go back to: the one the guide is bound to, while the
 *  register keeps it and it is not played out. None, and the course deals
 *  a new one */
export function resumeOf(bound: string | null, tables: readonly HomeTable[]): string | null {
  if (!bound) return null;
  return tables.some((t) => t.code === bound && !t.over) ? bound : null;
}

/** the code of the table the guide is bound to, if any */
export function guidedBound(): string | null {
  try {
    return localStorage.getItem(TUTORIAL_KEY);
  } catch {
    return null;
  }
}

/** the guided table left unfinished, as the register now stands */
export function guidedResume(tables: readonly HomeTable[] = listHomeGames()): string | null {
  return resumeOf(guidedBound(), tables);
}

/** the guided table to open: the one left unfinished — the register read
 *  first when it has not been, so that a table the office still keeps is
 *  never dealt over — or, with none, or asked `again`, a new one */
export async function openGuided(again = false): Promise<string> {
  if (!again) {
    const left = guidedResume(homeKnown() ? homeSnapshot() : await refreshHome());
    if (left) return left;
  }
  return startTutorial();
}

/** a guided deal to play: any of the list but the reader's last one */
export function drawTutorialSeed(last: number | null, roll: () => number = Math.random): number {
  const left = TUTORIAL_SEEDS.filter((s) => s !== last);
  return left[Math.min(left.length - 1, Math.floor(roll() * left.length))] ?? TUTORIAL_SEEDS[0];
}

/** the seed of the reader's last guided deal — for a reader of the guide
 *  from before the list, its one deal; none for a newcomer */
export function lastTutorialSeed(): number | null {
  try {
    const dealt = localStorage.getItem(TUTORIAL_DEALT_KEY);
    if (dealt !== null && /^\d+$/.test(dealt)) return Number(dealt);
    const guided = localStorage.getItem(TUTORIAL_KEY) !== null || localStorage.getItem(TUTORIAL_SEED_KEY) !== null || readLearnt().length > 0;
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
