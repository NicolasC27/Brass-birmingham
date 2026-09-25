import { loadStoredSetup } from '@/components/setup/constants';
import type { PlayerColor, StoredSetup } from '@/components/setup/constants';
import { randomId } from '@/online/table';
import { pickTableName } from '@/online/tableNames';
import { deserialize, serialize } from './engine';
import type { GameState } from './types';
import { PINS_KEY, RESUME_KEY } from './types';

/* ------------------------------------------------------------------ */
/* The register of the games played on this device.                    */
/*                                                                     */
/* Each has a name and a code like a table of the club, its own save   */
/* and its own pins, so several can stand at once: a new deal is a new */
/* table, never the old one handed back. The register is an index of   */
/* small entries — where each game stands and who sits at it — so the  */
/* hall and the desk list them without opening a single save.          */
/* ------------------------------------------------------------------ */

export interface LocalTable {
  code: string;
  name: string;
  startedAt: number;
  updatedAt: number;
  era: 'canal' | 'rail';
  round: number;
  seats: { name: string; color: PlayerColor; kind: 'human' | 'bot' }[];
  /** played out: kept for the results, no longer offered */
  over?: boolean;
}

const INDEX_KEY = 'brassworks.local.v1';
/** the one save of before the register, and the name it was given */
const LEGACY_TABLE_KEY = 'brassworks.resume.table.v1';

export const localSaveKey = (code: string): string => `${INDEX_KEY}:${code}`;
/** the pins of a game at home are kept apart from an online table's of the same code */
export const localPinScope = (code: string): string => `local:${code}`;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — non-fatal */
  }
};
const drop = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
};

const seatsOf = (g: GameState): LocalTable['seats'] => g.players.map((p) => ({ name: p.name, color: p.color as PlayerColor, kind: p.isBot && !p.resigned ? 'bot' : 'human' }));

function readIndex(): LocalTable[] {
  const raw = read(INDEX_KEY);
  let list: LocalTable[] = [];
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(v)) list = v.filter((t): t is LocalTable => !!t && typeof t.code === 'string' && typeof t.name === 'string');
  } catch {
    list = [];
  }
  const moved = migrate(list);
  if (moved) writeIndex(moved);
  return moved ?? list;
}

function writeIndex(list: LocalTable[]): void {
  write(INDEX_KEY, JSON.stringify(list));
}

/** the save from before the register, if any, becomes an entry of it */
function migrate(list: LocalTable[]): LocalTable[] | null {
  const raw = read(RESUME_KEY);
  if (!raw) return null;
  drop(RESUME_KEY);
  let legacy: { code?: string; name?: string; startedAt?: number; updatedAt?: number } = {};
  try {
    legacy = JSON.parse(read(LEGACY_TABLE_KEY) ?? '{}') as typeof legacy;
  } catch {
    legacy = {};
  }
  drop(LEGACY_TABLE_KEY);
  const g = deserialize(raw);
  if (!g || g.phase === 'game-over') {
    drop(PINS_KEY);
    return null;
  }
  const code = legacy.code && !list.some((t) => t.code === legacy.code) ? legacy.code : freeCode(list);
  const now = Date.now();
  const entry: LocalTable = { code, name: legacy.name ?? pickTableName(list.map((t) => t.name)), startedAt: legacy.startedAt ?? now, updatedAt: legacy.updatedAt ?? now, era: g.era, round: g.round, seats: seatsOf(g) };
  write(localSaveKey(code), raw);
  const pins = read(PINS_KEY);
  if (pins) write(`${PINS_KEY}:${localPinScope(code)}`, pins);
  drop(PINS_KEY);
  return [entry, ...list];
}

function freeCode(list: LocalTable[]): string {
  let code = randomId(4);
  while (list.some((t) => t.code === code)) code = randomId(4);
  return code;
}

/** a new table of this device that starts from a given position — a game
    under review played on from there. Its code, for the address */
export function forkLocalGame(g: GameState): string {
  const list = readIndex();
  const now = Date.now();
  const entry: LocalTable = {
    code: freeCode(list),
    name: pickTableName(list.map((t) => t.name)),
    startedAt: now,
    updatedAt: now,
    era: g.era,
    round: g.round,
    seats: g.players.map((p) => ({ name: p.name, color: p.color as PlayerColor, kind: p.isBot ? 'bot' : 'human' })),
  };
  writeIndex([entry, ...list]);
  write(localSaveKey(entry.code), serialize(g));
  return entry.code;
}

/** the games in play on this device, the last touched first */
export function listLocalGames(): LocalTable[] {
  return readIndex()
    .filter((t) => !t.over)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function localGame(code: string): LocalTable | null {
  return readIndex().find((t) => t.code === code) ?? null;
}

/** a new table on this device, from the setup given (else the one on the
 *  setup page): named, coded, and on the register before its first deal.
 *  Games played out are pruned as it opens. */
export function openLocalGame(setup: StoredSetup | null = loadStoredSetup()): LocalTable {
  const list = readIndex();
  for (const t of list.filter((x) => x.over)) {
    drop(localSaveKey(t.code));
    drop(`${PINS_KEY}:${localPinScope(t.code)}`);
  }
  const kept = list.filter((t) => !t.over);
  const now = Date.now();
  const entry: LocalTable = {
    code: freeCode(kept),
    name: setup?.name ?? pickTableName(kept.map((t) => t.name)),
    startedAt: now,
    updatedAt: now,
    era: 'canal',
    round: 1,
    seats: setup?.players.map((p) => ({ name: p.name, color: p.color, kind: p.type })) ?? [],
  };
  writeIndex([entry, ...kept]);
  return entry;
}

export function readLocalSave(code: string): GameState | null {
  const raw = read(localSaveKey(code));
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}

/** the game moved on: its save, and its line in the register */
export function saveLocalGame(code: string, g: GameState): void {
  write(localSaveKey(code), serialize(g));
  const list = readIndex();
  const at = list.findIndex((t) => t.code === code);
  const was = at >= 0 ? list[at] : null;
  const entry: LocalTable = { code, name: was?.name ?? pickTableName(list.map((t) => t.name)), startedAt: was?.startedAt ?? Date.now(), updatedAt: Date.now(), era: g.era, round: g.round, seats: seatsOf(g), ...(g.phase === 'game-over' ? { over: true } : {}) };
  if (at >= 0) list[at] = entry;
  else list.unshift(entry);
  writeIndex(list);
}

/** a game put away for good: its save, its pins and its line in the register */
export function forgetLocalGame(code: string): void {
  drop(localSaveKey(code));
  drop(`${PINS_KEY}:${localPinScope(code)}`);
  writeIndex(readIndex().filter((t) => t.code !== code));
}
