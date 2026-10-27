import { EMPTY_THREAD } from './guideThread';
import type { Said, Thread } from './guideThread';

/* ------------------------------------------------------------------ */
/* What the reader has read at a table, kept over a reload: the        */
/* machine's last plate put away, the last of the table's news, and    */
/* the thread said so far. A page reloaded mid-game used to bring the  */
/* plates back, fresh, holding the machine again, over an empty        */
/* thread. Kept for the few tables last sat at, the latest first; a    */
/* table not among them starts with nothing read. Pure: the guide      */
/* reads the shelf once as it opens, and writes it as it changes.      */
/* ------------------------------------------------------------------ */

/** where the shelf is kept */
export const READ_KEY = 'brassworks.guide.read';
/** the tables kept, the latest first */
export const TABLES_KEPT = 6;
/** the turns of a thread kept, the latest */
export const SAID_KEPT = 120;

/** what was read at one table */
export interface Read {
  /** the machine's move whose plate was put away, by its entry in the log */
  plate: number;
  /** the last of the table's news read */
  news: number;
  /** the thread said so far, oldest first */
  said: Said[];
  /** the last piece of news filed into it */
  filed: number;
}

export const NOTHING_READ: Read = { plate: -1, news: -1, said: [], filed: -1 };

type Shelved = Read & { code: string };

const KINDS = new Set<Said['kind']>(['lesson', 'bot', 'news', 'ask', 'answer', 'note']);
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : -1);

/** a turn of the thread as stored, or null when it is not one */
function saidOf(x: unknown): Said | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.body !== 'string' || typeof o.kind !== 'string' || !KINDS.has(o.kind as Said['kind'])) return null;
  return { key: typeof o.key === 'string' ? o.key : '', kind: o.kind as Said['kind'], body: o.body, ...(typeof o.head === 'string' ? { head: o.head } : {}), ...(typeof o.seat === 'number' ? { seat: o.seat } : {}) };
}

/** the tables on the shelf, whatever state the stored text is in */
function shelf(raw: string | null): Shelved[] {
  try {
    const v = JSON.parse(raw ?? 'null') as { v?: number; tables?: unknown } | null;
    if (!v || v.v !== 1 || !Array.isArray(v.tables)) return [];
    return v.tables.flatMap((x): Shelved[] => {
      if (!x || typeof x !== 'object' || typeof (x as { code?: unknown }).code !== 'string') return [];
      const o = x as Record<string, unknown>;
      const said = Array.isArray(o.said) ? o.said.map(saidOf).filter((s): s is Said => s !== null) : [];
      return [{ code: o.code as string, plate: num(o.plate), news: num(o.news), said, filed: num(o.filed) }];
    });
  } catch {
    return [];
  }
}

/** what was read at this table, from the shelf as stored. The turns come
 *  back under keys of their own: the keys a thread hands out count its
 *  turns, and a thread cut to its latest would hand one out twice */
export function readAt(raw: string | null, code: string): Read {
  const at = shelf(raw).find((x) => x.code === code);
  if (!at) return NOTHING_READ;
  return { plate: at.plate, news: at.news, said: at.said.map((s, i) => ({ ...s, key: `r${i}` })), filed: at.filed };
}

/** the shelf as stored, with this table's reading put on top: its thread
 *  cut to the latest turns, the tables sat at longest ago let go */
export function shelve(raw: string | null, code: string, read: Read): string {
  const mine: Shelved = { code, plate: read.plate, news: read.news, said: read.said.slice(-SAID_KEPT), filed: read.filed };
  const others = shelf(raw).filter((x) => x.code !== code);
  return JSON.stringify({ v: 1, tables: [mine, ...others].slice(0, TABLES_KEPT) });
}

/** the thread a table's reading starts from: what was said, nothing live
 *  yet — the lesson, her plate and the news on show are taken in again
 *  as the guide opens */
export const threadOf = (read: Read): Thread => ({ ...EMPTY_THREAD, said: read.said, filed: read.filed });
