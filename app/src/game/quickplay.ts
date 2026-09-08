import { BOT_NAME_POOL, SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { StoredSetup } from '@/components/setup/constants';
import { tr } from '@/i18n';
import { deserialize } from './engine';
import { RESUME_KEY } from './types';

/* ------------------------------------------------------------------ */
/* Quick play — the title screen's "play now". A visitor should be on  */
/* the board in one click: the table is dressed here (you against two  */
/* clockwork rivals) and the game page reads it like any other setup.  */
/* ------------------------------------------------------------------ */

/** the game autosaved on this device, if any — where it stands */
export function readResume(): { era: 'canal' | 'rail'; round: number } | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    const s = raw ? deserialize(raw) : null;
    if (!s || s.phase === 'game-over') return null;
    return { era: s.era, round: s.round };
  } catch {
    return null;
  }
}

/** the table quick play dresses: a solo setup the player made earlier, else you and two rivals */
export function quickSetup(): StoredSetup {
  const stored = loadStoredSetup();
  if (stored && stored.players.filter((p) => p.type === 'human').length === 1 && stored.players.some((p) => p.type === 'bot')) return stored;
  return {
    players: [
      { name: tr('setup.defaults.playerOne'), color: 'brass', type: 'human' },
      { name: BOT_NAME_POOL[0], color: 'oxblood', type: 'bot', difficulty: 'industrialist' },
      { name: BOT_NAME_POOL[1], color: 'verdigris', type: 'bot', difficulty: 'foreman' },
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
      { name: BOT_NAME_POOL[0], color: 'oxblood', type: 'bot', difficulty: 'foreman' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  };
}

/** dress the guided table — the caller then opens /game, where the guide takes over */
export function startTutorial(): void {
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(tutorialSetup()));
    localStorage.removeItem(RESUME_KEY);
    localStorage.setItem(TUTORIAL_KEY, 'new');
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
}

/** dress the table and forget any game in progress — the caller then opens /game */
export function startQuickGame(): void {
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(quickSetup()));
    localStorage.removeItem(RESUME_KEY);
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
}
