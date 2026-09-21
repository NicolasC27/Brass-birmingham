import { SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import { personaName } from '@/game/data';
import { tr } from '@/i18n';
import { listLocalGames, openLocalGame } from './local';
import type { LocalTable } from './local';

/* ------------------------------------------------------------------ */
/* Quick play — the title screen's "play now". A visitor should be on  */
/* the board in one click: the table is dressed here (you against two  */
/* clockwork rivals), opened on the register of this device, and the   */
/* game page reads it like any other setup.                            */
/* ------------------------------------------------------------------ */

/** the game last touched on this device, if any — where it stands */
export function readResume(): LocalTable | null {
  return listLocalGames()[0] ?? null;
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
 *  and a fixed deal so the guide knows the hand */
export const TUTORIAL_KEY = 'brassworks.tutorial.v1';
export const TUTORIAL_SEED = 3;

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
export function startTutorial(): string {
  const setup = tutorialSetup();
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
    localStorage.setItem(TUTORIAL_KEY, 'new');
    localStorage.removeItem('brassworks.tutorial.step');
    localStorage.removeItem('brassworks.tutorial.reached');
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
  return openLocalGame(setup).code;
}

/** dress the table and open it on the register — the caller then opens /game/local/<code> */
export function startQuickGame(): string {
  const setup = quickSetup();
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
  return openLocalGame(setup).code;
}
