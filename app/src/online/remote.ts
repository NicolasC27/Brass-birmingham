import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
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

/** the table in the answer to a create or a join */
function seated(m: ServerMessage): Table {
  if (m.t !== 'seated') throw new Error('refused' satisfies LobbyError);
  return m.table;
}

export class RemoteLobbyClient implements LobbyClient {
  private wire: Wire;
  private tables = new Map<string, Table | null>();
  private listeners = new Map<string, Set<() => void>>();

  constructor(wire: Wire) {
    this.wire = wire;
    wire.on((m) => this.receive(m));
  }

  /** online you are your account: no seat exists before you have signed in */
  get me(): Identity {
    return this.wire.session ?? { id: '', name: '' };
  }

  /** the name at the table is the name on the account */
  setName(): void {
    /* nothing to remember: the office knows who you are */
  }

  async create(options: SetupOptions, color?: PlayerColor): Promise<Table> {
    return seated(await this.wire.ask((rid) => ({ t: 'create', rid, options, color })));
  }

  async join(code: string, color?: PlayerColor): Promise<Table> {
    return seated(await this.wire.ask((rid) => ({ t: 'join', rid, code, color })));
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
    /* the bell is the one edit not shown ahead: the room moves to the
       game only on the server's word, not on a wish it may refuse */
    if (wanted.status === table.status) this.remember(code, wanted);
    this.wire.send({ t: 'table', code, table: wanted });
    return wanted;
  }

  get(code: string): Table | null {
    return this.tables.get(code) ?? null;
  }

  /** the server has spoken of this table (even to say it is gone) */
  known(code: string): boolean {
    return this.tables.has(code);
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

  private receive(m: ServerMessage): void {
    if (m.t === 'table') this.remember(m.code, m.table);
    if (m.t === 'seated') this.remember(m.table.code, m.table);
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
