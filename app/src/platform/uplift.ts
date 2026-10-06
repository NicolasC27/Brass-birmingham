import { deserialize } from '@/game/engine';
import { openHomeGame } from '@/game/home';
import { readShared } from '@/game/share';
import { setupOf } from '@/game/actions';
import type { GameState } from '@/game/types';
import { onlineWire } from '@/online/net';
import { PAPER_KINDS, liftPapers } from './papers';
import type { Kind } from './papers';

/* ------------------------------------------------------------------ */
/* The lift.                                                           */
/*                                                                     */
/* Games at home used to be written in the browser that played them.   */
/* Whatever is still lying in one when it next opens is carried up to  */
/* the office — every save on the old register, and the game the last  */
/* feuilleton carries in its link, which is often the only thing left  */
/* of a game whose save was swept away. Each is opened under its own   */
/* code and its log written out, so it lands on the register like any  */
/* other. The papers go up with them — but only the kinds the office   */
/* keeps none of, so a fuller set kept there is never written over by  */
/* an old browser's copy. Then the old keys go.                        */
/*                                                                     */
/* This runs once in the life of a browser. A game it cannot make      */
/* sense of is left where it is rather than thrown away.               */
/* ------------------------------------------------------------------ */

const INDEX_KEY = 'brassworks.local.v1';
const RESUME_KEY = 'brassworks.resume.v1';
const FEUILLETON_KEY = 'brassworks.feuilleton.v1';
const PINS_KEY = 'brassworks.pins.v1';
const FINAL_KEY = 'brassworks.final.v1';
/** the lift has been run in this browser */
const DONE_KEY = 'brassworks.lifted.v1';
/** the papers of a browser from before the office kept them, by kind */
const OLD_PAPERS: Record<Kind, string> = {
  progress: 'brassworks.progress.v1',
  feuilleton: FEUILLETON_KEY,
  patents: 'brassworks.patents.v1',
  letters: 'brassworks.letters.v1',
  lines: 'brassworks.lines.v1',
  form: 'brassworks.form.v1',
  challenge: 'brassworks.challenge.v1',
};

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const drop = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
};

interface OldTable {
  code: string;
  name: string;
}

/** one game found in the browser, with the name it went by */
interface Found {
  name: string;
  game: GameState;
  /** the keys that held it, dropped once it is up */
  keys: string[];
}

/** the old register, the save before it, and the game the feuilleton carries */
function findOld(): Found[] {
  const out: Found[] = [];
  const seen = new Set<number>();
  const keep = (name: string, game: GameState | null, keys: string[]): void => {
    /* the same game twice — its save and its feuilleton — goes up once */
    if (!game || seen.has(game.seed)) return;
    seen.add(game.seed);
    out.push({ name, game, keys });
  };

  let index: OldTable[] = [];
  try {
    const v = JSON.parse(read(INDEX_KEY) ?? '[]') as unknown;
    if (Array.isArray(v)) index = v.filter((t): t is OldTable => !!t && typeof (t as OldTable).code === 'string');
  } catch {
    index = [];
  }
  for (const t of index) {
    const key = `${INDEX_KEY}:${t.code}`;
    const raw = read(key);
    if (raw) keep(typeof t.name === 'string' ? t.name : t.code, deserialize(raw), [key, `${PINS_KEY}:local:${t.code}`]);
  }

  const resume = read(RESUME_KEY);
  if (resume) keep('', deserialize(resume), [RESUME_KEY, PINS_KEY]);

  /* the feuilleton carries the whole game in its link: often the last trace
     of a game whose save the old register had already swept away */
  try {
    const e = JSON.parse(read(FEUILLETON_KEY) ?? 'null') as { name?: string; fragment?: string } | null;
    if (e && typeof e.fragment === 'string') keep(typeof e.name === 'string' ? e.name : '', readShared(e.fragment), []);
  } catch {
    /* no feuilleton worth reading */
  }
  return out;
}

/** is there anything in this browser still to carry up? */
export function hasOldStuff(): boolean {
  if (read(DONE_KEY)) return false;
  if (read(INDEX_KEY) || read(RESUME_KEY)) return true;
  return PAPER_KINDS.some((k) => !!read(OLD_PAPERS[k]));
}

/** the papers this browser still holds, as the office will have them — only
 *  the kinds it keeps none of, so a fuller set kept there is never written
 *  over by an old browser's copy */
function liftOldPapers(): void {
  const found: Partial<Record<Kind, unknown>> = {};
  for (const kind of PAPER_KINDS) {
    const raw = read(OLD_PAPERS[kind]);
    if (!raw) continue;
    try {
      found[kind] = JSON.parse(raw) as unknown;
    } catch {
      /* a paper this browser cannot read is a paper it does not send */
    }
  }
  liftPapers(found);
}

/** everything left in this browser, carried up to the office. The number of
 *  games that made it — nothing is dropped until it is up */
export async function liftBrowser(): Promise<number> {
  if (!hasOldStuff()) return 0;
  const wire = onlineWire();
  if (!wire) return 0;
  const found = findOld();
  /* a browser that never signed the register still gets an account: what it
     has played is the reason the account exists */
  try {
    await wire.need();
  } catch {
    return 0;
  }
  liftOldPapers();
  let up = 0;
  for (const f of found) {
    try {
      const table = await openHomeGame(f.game.seed, setupOf(f.game), f.name || undefined);
      f.game.actions.forEach((a, i) => wire.actHome(table.code, i, a));
      up += 1;
      for (const key of f.keys) drop(key);
    } catch {
      /* this one stays where it is, and the lift is tried again next time */
      return up;
    }
  }
  drop(INDEX_KEY);
  drop(FINAL_KEY);
  for (const kind of PAPER_KINDS) drop(OLD_PAPERS[kind]);
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* non-fatal */
  }
  return up;
}
