import type { QueueState } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The queues — the people waiting for the office to seat them.        */
/*                                                                     */
/* Two lines, quick and ranked; an account stands in one at most, and  */
/* joining the other is moving. The office looks down the lines every  */
/* few seconds and on every arrival: a full table goes at once, a      */
/* shorter one once the first in line has waited long enough, and in   */
/* the quick line someone quite alone is given two machines. Whoever   */
/* has no socket left is dropped after a while — a table dealt to an   */
/* empty chair helps nobody. Nothing here knows how a table is made:   */
/* the queue says who, the hall deals.                                 */
/* ------------------------------------------------------------------ */

export type Mode = QueueState['mode'];

export interface Waits {
  /** the quick line: a short table once the first has waited this long */
  quick: number;
  /** the ranked line: three instead of four once the first has waited this long */
  ranked: number;
  /** an account with no socket is dropped after this long */
  gone: number;
}
export const WAITS: Waits = { quick: 40_000, ranked: 90_000, gone: 30_000 };
/** the machines that keep a lone quick player company */
export const COMPANY = 2;

/** the table the queue asks the hall to deal */
export interface Match {
  mode: Mode;
  ids: string[];
  /** machines to seat alongside (the quick line only) */
  machines: number;
}

interface Waiting {
  id: string;
  since: number;
  /** since when no socket of theirs has been seen (null: one is open) */
  goneSince: number | null;
}

export interface QueueOptions {
  now?: () => number;
  /** does this account hold a socket right now? */
  present?: (id: string) => boolean;
  /** two accounts that must not sit at the same ranked table */
  apart?: (a: string, b: string) => boolean;
  waits?: Partial<Waits>;
}

export class Queue {
  private lines: Record<Mode, Waiting[]> = { quick: [], ranked: [] };
  private readonly now: () => number;
  private readonly present: (id: string) => boolean;
  private readonly apart: (a: string, b: string) => boolean;
  private readonly waits: Waits;

  constructor(o: QueueOptions = {}) {
    this.now = o.now ?? Date.now;
    this.present = o.present ?? (() => true);
    this.apart = o.apart ?? (() => false);
    this.waits = { ...WAITS, ...o.waits };
  }

  /** stand in a line — leaving the other, if standing there; the modes touched */
  join(id: string, mode: Mode): Mode[] {
    if (this.lines[mode].some((w) => w.id === id)) return [];
    const left = this.leave(id);
    this.lines[mode].push({ id, since: this.now(), goneSince: null });
    return left ? [left, mode] : [mode];
  }

  /** step out of whichever line; the mode left, or null when not in one */
  leave(id: string): Mode | null {
    for (const mode of ['quick', 'ranked'] as const) {
      const at = this.lines[mode].findIndex((w) => w.id === id);
      if (at < 0) continue;
      this.lines[mode].splice(at, 1);
      return mode;
    }
    return null;
  }

  modeOf(id: string): Mode | null {
    for (const mode of ['quick', 'ranked'] as const) if (this.lines[mode].some((w) => w.id === id)) return mode;
    return null;
  }

  stateOf(id: string): QueueState | null {
    const mode = this.modeOf(id);
    if (!mode) return null;
    const w = this.lines[mode].find((x) => x.id === id)!;
    return { mode, since: w.since, waiting: this.lines[mode].length };
  }

  members(mode: Mode): string[] {
    return this.lines[mode].map((w) => w.id);
  }

  size(mode: Mode): number {
    return this.lines[mode].length;
  }

  total(): number {
    return this.lines.quick.length + this.lines.ranked.length;
  }

  /** drop whoever has had no socket for a while; the ids dropped */
  sweep(): string[] {
    const now = this.now();
    const dropped: string[] = [];
    for (const mode of ['quick', 'ranked'] as const) {
      this.lines[mode] = this.lines[mode].filter((w) => {
        if (this.present(w.id)) {
          w.goneSince = null;
          return true;
        }
        w.goneSince ??= now;
        if (now - w.goneSince < this.waits.gone) return true;
        dropped.push(w.id);
        return false;
      });
    }
    return dropped;
  }

  /** the tables to deal now, their people taken out of the lines */
  match(): Match[] {
    const now = this.now();
    const out: Match[] = [];
    const take = (mode: Mode, n: number, machines = 0) => out.push({ mode, ids: this.lines[mode].splice(0, n).map((w) => w.id), machines });
    const waited = (mode: Mode) => now - this.lines[mode][0].since;

    while (this.lines.quick.length >= 4) take('quick', 4);
    const quick = this.lines.quick.length;
    if (quick >= 2 && waited('quick') >= this.waits.quick) take('quick', quick);
    else if (quick === 1 && waited('quick') >= this.waits.quick) take('quick', 1, COMPANY);

    /* the ranked line: a table is made of people who may sit together —
       the first in line and the next three who are no kin of theirs */
    const ranked = (n: number): string[] | null => {
      const line = this.lines.ranked;
      for (let head = 0; head < line.length; head++) {
        const picked = [head];
        for (let i = head + 1; i < line.length && picked.length < n; i++) if (picked.every((p) => !this.apart(line[p].id, line[i].id))) picked.push(i);
        if (picked.length === n) {
          const ids = picked.map((i) => line[i].id);
          this.lines.ranked = line.filter((_, i) => !picked.includes(i));
          return ids;
        }
      }
      return null;
    };
    for (let ids = ranked(4); ids; ids = ranked(4)) out.push({ mode: 'ranked', ids, machines: 0 });
    if (this.lines.ranked.length >= 3 && waited('ranked') >= this.waits.ranked) {
      const ids = ranked(3);
      if (ids) out.push({ mode: 'ranked', ids, machines: 0 });
    }
    return out;
  }
}
