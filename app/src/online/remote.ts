import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
import { rememberName } from './identity';
import type { LobbyClient } from './lobby';
import type { ServerMessage } from './protocol';
import type { Identity, LobbyError, Table } from './table';
import type { Wire } from './wire';

/* ------------------------------------------------------------------ */
/* The lobby, over the wire.                                           */
/*                                                                     */
/* Same interface as the local client, so the office and the room do   */
/* not know which one they are talking to. Seat edits are shown at     */
/* once and sent as a wish: the server keeps what this player may       */
/* change and pushes back the table that stands — which overwrites the  */
/* guess a moment later if it was too generous.                        */
/* ------------------------------------------------------------------ */

/** how long a create or a join waits for the office to answer */
const ANSWER_MS = 8000;

interface Waiting {
  ok: (t: Table) => void;
  ko: (e: Error) => void;
  timer: number;
}

export class RemoteLobbyClient implements LobbyClient {
  me: Identity;
  private wire: Wire;
  private tables = new Map<string, Table | null>();
  private listeners = new Map<string, Set<() => void>>();
  private waiting = new Map<number, Waiting>();
  private rid = 0;

  constructor(wire: Wire) {
    this.wire = wire;
    this.me = wire.me;
    wire.on((m) => this.receive(m));
  }

  setName(name: string): void {
    this.me = { ...this.me, name };
    rememberName(name);
    this.wire.setName(name);
  }

  create(tableName: string, options: SetupOptions, color?: PlayerColor): Promise<Table> {
    return this.ask((rid) => this.wire.send({ t: 'create', rid, name: tableName, options, color }));
  }

  join(code: string, color?: PlayerColor): Promise<Table> {
    return this.ask((rid) => this.wire.send({ t: 'join', rid, code, color }));
  }

  leave(code: string): void {
    this.wire.send({ t: 'leave', code });
    this.wire.unwatch(code);
    this.remember(code, null);
  }

  /** show the wish at once, send it, let the server have the last word */
  update(code: string, patch: (t: Table) => Table): Table | null {
    const table = this.tables.get(code);
    if (!table) return null;
    const wanted = { ...patch(structuredClone(table)), updatedAt: Date.now() };
    this.remember(code, wanted);
    this.wire.send({ t: 'table', code, table: wanted });
    return wanted;
  }

  get(code: string): Table | null {
    return this.tables.get(code) ?? null;
  }

  subscribe(code: string, cb: () => void): () => void {
    let set = this.listeners.get(code);
    if (!set) {
      set = new Set();
      this.listeners.set(code, set);
    }
    set.add(cb);
    this.wire.watch(code);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.listeners.delete(code);
        this.wire.unwatch(code);
      }
    };
  }

  private ask(fire: (rid: number) => void): Promise<Table> {
    const rid = ++this.rid;
    return new Promise<Table>((ok, ko) => {
      const timer = window.setTimeout(() => {
        this.waiting.delete(rid);
        ko(new Error('offline' satisfies LobbyError));
      }, ANSWER_MS);
      this.waiting.set(rid, { ok, ko, timer });
      fire(rid);
    });
  }

  private receive(m: ServerMessage): void {
    if (m.t === 'table') {
      this.remember(m.code, m.table);
      return;
    }
    if (m.t === 'seated') {
      const w = this.take(m.rid);
      this.remember(m.table.code, m.table);
      w?.ok(m.table);
      return;
    }
    if (m.t === 'refused') {
      const w = m.rid === undefined ? null : this.take(m.rid);
      w?.ko(new Error(m.error));
    }
  }

  private take(rid: number): Waiting | null {
    const w = this.waiting.get(rid);
    if (!w) return null;
    window.clearTimeout(w.timer);
    this.waiting.delete(rid);
    return w;
  }

  /* useSyncExternalStore wants the same object back while nothing changed:
     the server's echo of our own guess must not count as a new table, or
     the room re-renders (and its animations restart) for nothing */
  private remember(code: string, table: Table | null): void {
    const had = this.tables.get(code);
    if (had && table && shape(had) === shape(table)) return;
    this.tables.set(code, table);
    this.listeners.get(code)?.forEach((cb) => cb());
  }
}

/** a table without the clock that ticks on every write */
function shape(t: Table): string {
  return JSON.stringify({ ...t, updatedAt: 0 });
}
