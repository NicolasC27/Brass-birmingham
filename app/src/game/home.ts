import { onlineWire } from '@/online/net';
import { hasOldStuff, liftBrowser } from '@/platform/uplift';
import { pickTableName } from '@/online/tableNames';
import type { HomeSave, HomeTable } from '@/online/table';
import type { HomeHeard } from '@/online/wire';
import { replay, setupOf } from './actions';
import type { GameAction } from './actions';
import { RULES_EDITION, defaultSetup } from './engine';
import type { GameState, SetupPayload } from './types';
import { SETUP_KEY } from './types';

/* ------------------------------------------------------------------ */
/* The register of the games played at home.                          */
/*                                                                    */
/* The office keeps it — a game against the machines is a seed and a  */
/* log like any other, written under the account that played it, and  */
/* read by the engine move by move. This browser keeps nothing but a  */
/* mirror of the register, so that a page can still ask what is on it */
/* without waiting: the mirror is filled once when the application    */
/* opens, and again whenever the office says it has moved.            */
/*                                                                    */
/* Nothing here is a source of truth. Lose the mirror and a reload     */
/* brings it back; lose the browser and the games are still there.     */
/* ------------------------------------------------------------------ */

export type { HomeSave, HomeTable };

let register: HomeTable[] = [];
const watchers = new Set<() => void>();
/** the mirror as an unchanging object while the register does not move,
 *  so `useSyncExternalStore` may hold on to it */
let snapshot: HomeTable[] = register;

function settle(games: HomeTable[]): void {
  register = [...games].sort((a, b) => b.updatedAt - a.updatedAt);
  snapshot = register;
  for (const cb of watchers) cb();
}

/** the register moved: a component reading it is told */
export function subscribeHome(cb: () => void): () => void {
  watchers.add(cb);
  return () => watchers.delete(cb);
}

/** every game on the register, played out ones included, the last touched first */
export const homeSnapshot = (): HomeTable[] => snapshot;

/** the games still to be played, the last touched first */
export const listHomeGames = (): HomeTable[] => register.filter((t) => !t.over);

export const homeGame = (code: string): HomeTable | null => register.find((t) => t.code === code) ?? null;

/** the setup the last table was dealt from — the form this browser filled in,
 *  which is a preference of this device and not a record of play */
export function readSetup(): SetupPayload {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SetupPayload;
      if (parsed.players?.length >= 2) return parsed;
    }
  } catch {
    /* fall through */
  }
  return defaultSetup();
}

/** the office's register, read into the mirror. Called once as the
 *  application opens, and never fails loudly: a browser that cannot reach
 *  the office shows an empty register, not an error */
export async function hydrateHome(): Promise<void> {
  const wire = onlineWire();
  if (!wire) return;
  /* the register keeps arriving on its own from here on */
  wire.onHome(() => settle(wire.home ?? []));
  /* games written in this browser before the office kept them are carried
     up first, so they are on the register the moment it is read */
  if (hasOldStuff()) await liftBrowser().catch(() => 0);
  /* nobody has signed in, no session is waiting and nothing was carried up:
     this browser has played nothing, and no account is opened to say so */
  if (wire.stranger) return;
  try {
    settle(await wire.askHome());
  } catch {
    /* the office is not answering: the register stands empty for now */
  }
}

/** a new game at home. The office deals the code — this browser proposes the
 *  name, the deal and the seed, and the office writes them down */
export async function openHomeGame(seed = Math.floor(Math.random() * 1e9), setup: SetupPayload = readSetup(), name?: string): Promise<HomeTable> {
  const wire = onlineWire();
  if (!wire) throw new Error('offline');
  /* the deal is written down with the edition of the rules it is played
     under, so the log never has to be tried against two of them */
  const dealt: SetupPayload = setup.options.rules === undefined ? { ...setup, options: { ...setup.options, rules: RULES_EDITION } } : setup;
  const table = await wire.openHome(name ?? pickTableName(register.map((t) => t.name)), seed, dealt);
  settle([table, ...register.filter((t) => t.code !== table.code)]);
  return table;
}

/** why a game at home could not be read back: the office has no such game,
 *  its log will not replay under this build's engine, or the office did not
 *  answer at all. Only the first is a reason to deal a new one */
export type HomeMiss = 'absent' | 'unreplayable' | 'offline';

/** a game at home as it now stands, replayed from the log the office keeps
 *  — or the reason it could not be */
export async function readHomeSave(code: string): Promise<{ game: GameState } | { miss: HomeMiss }> {
  const wire = onlineWire();
  if (!wire) return { miss: 'offline' };
  let save: HomeSave | null;
  try {
    save = await wire.loadHome(code);
  } catch {
    return { miss: 'offline' };
  }
  if (!save) return { miss: 'absent' };
  try {
    return { game: replay(save.setup, save.seed, save.actions) };
  } catch {
    /* a log this build's engine no longer accepts: the game is on the record
       and is played no further */
    return { miss: 'unreplayable' };
  }
}

/** what became of a move sent to the office: written, turned down, or not
 *  known — the line went quiet before the office had read it */
export type Recorded = HomeHeard;

/** one move, at its place in the log, and the office's reading of it. The
 *  office answers the move itself; a move not answered in time waits in the
 *  wire's outbox and goes out with the line — whether it stands is the
 *  office's to say then */
export async function recordMove(code: string, idx: number, action: GameAction): Promise<Recorded> {
  const wire = onlineWire();
  if (!wire) return 'offline';
  return wire.actHome(code, idx, action);
}

/** a move taken back, and the log cut there */
export async function recordUndo(code: string, at: number): Promise<void> {
  await onlineWire()?.undoHome(code, at);
}

/** a game put away for good: the mirror first, so the page that asked sees
 *  it gone at once, then the office */
export async function forgetHomeGame(code: string): Promise<void> {
  settle(register.filter((t) => t.code !== code));
  try {
    await onlineWire()?.forgetHome(code);
  } catch {
    /* the office will still have it: the next register says so */
  }
}

/** a new game at home that starts from a position under review — a game
 *  played on from there. Its log begins where that one stood */
export async function forkHomeGame(g: GameState): Promise<HomeTable> {
  const wire = onlineWire();
  if (!wire) throw new Error('offline');
  const table = await openHomeGame(g.seed, setupOf(g));
  /* the moves that led here, written again under the new code. They go
     out in order; what the office makes of each is read with the board */
  g.actions.forEach((a, i) => void wire.actHome(table.code, i, a));
  return table;
}
