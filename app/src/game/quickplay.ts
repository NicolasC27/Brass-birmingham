import { SETUP_STORAGE_KEY, loadStoredSetup } from '@/components/setup/constants';
import type { PlayerColor, StoredSetup } from '@/components/setup/constants';
import { personaName } from '@/game/data';
import { tr } from '@/i18n';
import { randomId } from '@/online/table';
import { pickTableName } from '@/online/tableNames';
import { deserialize } from './engine';
import { PINS_KEY, RESUME_KEY } from './types';

/* ------------------------------------------------------------------ */
/* Quick play — the title screen's "play now". A visitor should be on  */
/* the board in one click: the table is dressed here (you against two  */
/* clockwork rivals) and the game page reads it like any other setup.  */
/*                                                                     */
/* The game played on this device has a name and a code like any table */
/* of the club, so the hall and the desk can list it, and it can be    */
/* put away like the others.                                           */
/* ------------------------------------------------------------------ */

/** the table played on this device: named and coded like one of the club's */
export interface LocalTable {
  code: string;
  name: string;
  startedAt: number;
  updatedAt: number;
}

export const LOCAL_TABLE_KEY = 'brassworks.resume.table.v1';

export function readLocalTable(): LocalTable | null {
  try {
    const raw = localStorage.getItem(LOCAL_TABLE_KEY);
    const t = raw ? (JSON.parse(raw) as Partial<LocalTable>) : null;
    return t && typeof t.code === 'string' && typeof t.name === 'string' ? { code: t.code, name: t.name, startedAt: t.startedAt ?? Date.now(), updatedAt: t.updatedAt ?? Date.now() } : null;
  } catch {
    return null;
  }
}

function writeLocalTable(t: LocalTable): void {
  try {
    localStorage.setItem(LOCAL_TABLE_KEY, JSON.stringify(t));
  } catch {
    /* non-fatal */
  }
}

/** a new game on this device: the name chosen on the setup page (else one
 *  from the register) and a code of its own */
export function nameLocalTable(): LocalTable {
  const now = Date.now();
  const t: LocalTable = { code: randomId(4), name: loadStoredSetup()?.name ?? pickTableName([]), startedAt: now, updatedAt: now };
  writeLocalTable(t);
  return t;
}

/** the game moved on: the desk sorts tables by their last move */
export function touchLocalTable(): void {
  const t = readLocalTable();
  if (t) writeLocalTable({ ...t, updatedAt: Date.now() });
}

/** put the game on this device away for good: the save, its name, the
 *  reader's pins and the guide's bookmarks */
export function forgetLocalGame(): void {
  try {
    for (const key of [RESUME_KEY, LOCAL_TABLE_KEY, PINS_KEY, TUTORIAL_KEY, 'brassworks.tutorial.step', 'brassworks.tutorial.reached']) localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

/** the game autosaved on this device, if any — where it stands and who sits at it */
export interface LocalResume {
  era: 'canal' | 'rail';
  round: number;
  table: LocalTable | null;
  seats: { name: string; color: PlayerColor; kind: 'human' | 'bot' }[];
}

export function readResume(): LocalResume | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    const s = raw ? deserialize(raw) : null;
    if (!s || s.phase === 'game-over') return null;
    return { era: s.era, round: s.round, table: readLocalTable(), seats: s.players.map((p) => ({ name: p.name, color: p.color as PlayerColor, kind: p.isBot ? 'bot' : 'human' })) };
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

/** dress the guided table — the caller then opens /game, where the guide takes over */
export function startTutorial(): void {
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(tutorialSetup()));
    localStorage.removeItem(RESUME_KEY);
    localStorage.removeItem(LOCAL_TABLE_KEY);
    localStorage.setItem(TUTORIAL_KEY, 'new');
    localStorage.removeItem('brassworks.tutorial.step');
    localStorage.removeItem('brassworks.tutorial.reached');
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
}

/** dress the table and forget any game in progress — the caller then opens /game */
export function startQuickGame(): void {
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(quickSetup()));
    localStorage.removeItem(LOCAL_TABLE_KEY);
    localStorage.removeItem(RESUME_KEY);
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* storage unavailable — the game page falls back to its default table */
  }
}
