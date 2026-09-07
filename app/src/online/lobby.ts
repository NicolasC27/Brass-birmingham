import { useSyncExternalStore } from 'react';
import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import { MAX_SEATS, freeColor, randomId } from './table';
import type { Identity, LobbyError, Table, TableSeat } from './table';

/* ------------------------------------------------------------------ */
/* Lobby — tables, seats, readiness. The UI talks to a LobbyClient and  */
/* nothing else; the local client below keeps tables in localStorage   */
/* and mirrors every change to the other tabs of this browser through  */
/* a BroadcastChannel, so two tabs already play host and guest. The    */
/* online transport implements the same interface against a server.    */
/* ------------------------------------------------------------------ */

export * from './table';

/** create and join cross the wire online, and answer at once locally */
export type Awaitable<T> = T | Promise<T>;

export interface LobbyClient {
  readonly me: Identity;
  setName(name: string): void;
  create(tableName: string, options: SetupOptions, color?: PlayerColor): Awaitable<Table>;
  join(code: string, color?: PlayerColor): Awaitable<Table>;
  leave(code: string): void;
  /** rewrite a table (seat edits, rules, start) — the callback gets the latest copy */
  update(code: string, patch: (t: Table) => Table): Table | null;
  get(code: string): Table | null;
  subscribe(code: string, cb: () => void): () => void;
}

/* ----------------------------- local client ------------------------ */

const TABLES_KEY = 'brassworks.lobby.tables.v1';
const NAME_KEY = 'brassworks.player.name.v1';
const ID_KEY = 'brassworks.player.id.v1'; // sessionStorage: one identity per tab
const CHANNEL = 'brassworks-lobby';

const rid = randomId;

function readTables(): Record<string, Table> {
  try {
    return JSON.parse(localStorage.getItem(TABLES_KEY) ?? '{}') as Record<string, Table>;
  } catch {
    return {};
  }
}

class LocalLobbyClient implements LobbyClient {
  me: Identity;
  private listeners = new Map<string, Set<() => void>>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    let id = '';
    let name = '';
    try {
      id = sessionStorage.getItem(ID_KEY) ?? '';
      if (!id) {
        id = 'p-' + rid(10);
        sessionStorage.setItem(ID_KEY, id);
      }
      name = localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      id = id || 'p-' + rid(10);
    }
    this.me = { id, name };
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<{ code: string }>) => this.emit(e.data.code);
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => e.key === TABLES_KEY && this.emitAll());
  }

  setName(name: string): void {
    this.me = { ...this.me, name };
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* non-fatal */
    }
  }

  private write(tables: Record<string, Table>, code: string): void {
    try {
      localStorage.setItem(TABLES_KEY, JSON.stringify(tables));
    } catch {
      /* non-fatal */
    }
    this.channel?.postMessage({ code });
    this.emit(code);
  }

  private emit(code: string): void {
    this.listeners.get(code)?.forEach((cb) => cb());
  }
  private emitAll(): void {
    this.listeners.forEach((set) => set.forEach((cb) => cb()));
  }

  private seatFor(color?: PlayerColor, table?: Table): TableSeat {
    return { id: this.me.id, name: this.me.name, color: freeColor(table ?? { seats: [] }, color), kind: 'human', ready: false, joinedAt: Date.now() };
  }

  create(tableName: string, options: SetupOptions, color?: PlayerColor): Table {
    const tables = readTables();
    let code = rid(4);
    while (tables[code]) code = rid(4);
    const now = Date.now();
    const table: Table = { code, name: tableName, hostId: this.me.id, seats: [this.seatFor(color)], options: { ...DEFAULT_OPTIONS, ...options }, status: 'open', createdAt: now, updatedAt: now };
    tables[code] = table;
    this.write(tables, code);
    return table;
  }

  join(code: string, color?: PlayerColor): Table {
    const tables = readTables();
    const table = tables[code];
    if (!table) throw new Error('not-found' satisfies LobbyError);
    if (table.status !== 'open') throw new Error('started' satisfies LobbyError);
    if (table.seats.some((s) => s.id === this.me.id)) return table;
    if (table.seats.length >= MAX_SEATS) throw new Error('full' satisfies LobbyError);
    table.seats.push(this.seatFor(color, table));
    table.updatedAt = Date.now();
    this.write(tables, code);
    return table;
  }

  leave(code: string): void {
    const tables = readTables();
    const table = tables[code];
    if (!table) return;
    table.seats = table.seats.filter((s) => s.id !== this.me.id);
    /* the host leaving hands the table to the next human, or closes it */
    if (table.hostId === this.me.id) {
      const next = table.seats.find((s) => s.kind === 'human');
      if (next) table.hostId = next.id;
      else delete tables[code];
    }
    if (tables[code]) tables[code].updatedAt = Date.now();
    this.write(tables, code);
  }

  update(code: string, patch: (t: Table) => Table): Table | null {
    const tables = readTables();
    const table = tables[code];
    if (!table) return null;
    const next = { ...patch(structuredClone(table)), updatedAt: Date.now() };
    tables[code] = next;
    this.write(tables, code);
    return next;
  }

  /* useSyncExternalStore needs the same object back while nothing changed */
  private snapshots = new Map<string, { raw: string; table: Table }>();
  get(code: string): Table | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(TABLES_KEY);
    } catch {
      return null;
    }
    const tables = raw ? (JSON.parse(raw) as Record<string, Table>) : {};
    const table = tables[code];
    if (!table) {
      this.snapshots.delete(code);
      return null;
    }
    const json = JSON.stringify(table);
    const cached = this.snapshots.get(code);
    if (cached && cached.raw === json) return cached.table;
    this.snapshots.set(code, { raw: json, table });
    return table;
  }

  subscribe(code: string, cb: () => void): () => void {
    if (!this.listeners.has(code)) this.listeners.set(code, new Set());
    this.listeners.get(code)!.add(cb);
    return () => this.listeners.get(code)?.delete(cb);
  }
}

export const lobby: LobbyClient = new LocalLobbyClient();

/** the live table (or null once it is gone) */
export function useTable(code: string): Table | null {
  return useSyncExternalStore(
    (cb) => lobby.subscribe(code, cb),
    () => lobby.get(code),
    () => null,
  );
}

