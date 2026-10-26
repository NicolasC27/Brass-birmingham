import { setBoardOption } from '@/components/game/boardOptions';
import { MINI_KEY } from '@/components/game/guideKeys';
import { freshProgress, saveProgress } from '@/components/game/lessons';
import { SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import { personaName } from '@/game/data';
import { tr } from '@/i18n';
import { listHomeGames, openHomeGame } from './home';
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

/** the guided game: you against one gentle machine, canal era only, assistance on,
 *  and a fixed deal so the guide knows the hand. The table it is played at is
 *  kept by its code: the guide comes back with that table, and with no other */
export const TUTORIAL_KEY = 'brassworks.tutorial.table';
export const TUTORIAL_SEED = 3;
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
 *  /game/local/<code>, where the guide takes over */
export async function startTutorial(): Promise<string> {
  const setup = tutorialSetup();
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
  const { code } = await openHomeGame(TUTORIAL_SEED, setup as unknown as SetupPayload);
  /* the guide goes with the table the office dealt, and the lessons start
     afresh there — only once it is dealt, so a table the office never
     opened takes nothing of the last one */
  try {
    localStorage.setItem(TUTORIAL_KEY, code);
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
