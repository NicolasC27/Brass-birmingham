import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { SetupPayload } from '@/game/types';
import { MAX_SEATS, canStart, freeColor, randomId, setupFromTable } from '@/online/table';
import type { Identity, LobbyError, Table, TableSeat } from '@/online/table';
import { DEFAULT_PACE, TableGame } from './game';
import type { Pace } from './game';

/* ------------------------------------------------------------------ */
/* The hall — every table in the house.                                */
/*                                                                     */
/* A client sends the table as it would have it; the hall keeps only   */
/* what that client is allowed to change (your own chair, the host's   */
/* pen for the rules and the bots) and answers with the table that     */
/* now stands. Ringing the bell turns the table into a game.           */
/* ------------------------------------------------------------------ */

interface Room {
  table: Table;
  game: TableGame | null;
}

export type Changed = (code: string, what: 'table' | 'game') => void;

/** a table nobody has touched for this long is swept away */
export const STALE_MS = 6 * 60 * 60 * 1000;

export class Hall {
  private rooms = new Map<string, Room>();
  private listeners = new Set<Changed>();
  private readonly pace: Pace;

  constructor(pace: Pace = DEFAULT_PACE) {
    this.pace = pace;
  }

  onChange(cb: Changed): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private announce(code: string, what: 'table' | 'game'): void {
    for (const cb of this.listeners) cb(code, what);
  }

  table(code: string): Table | null {
    return this.rooms.get(code)?.table ?? null;
  }

  game(code: string): TableGame | null {
    return this.rooms.get(code)?.game ?? null;
  }

  codes(): string[] {
    return [...this.rooms.keys()];
  }

  create(me: Identity, tableName: string, options: SetupOptions, color?: PlayerColor): Table {
    let code = randomId(4);
    while (this.rooms.has(code)) code = randomId(4);
    const now = Date.now();
    const table: Table = {
      code,
      name: tableName,
      hostId: me.id,
      seats: [seatFor(me, { seats: [] }, color)],
      options: houseRules(options),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(code, { table, game: null });
    this.announce(code, 'table');
    return table;
  }

  /** take a chair — throws a LobbyError when the table will not have you */
  join(code: string, me: Identity, color?: PlayerColor): Table {
    const room = this.rooms.get(code);
    if (!room) throw new Error('not-found' satisfies LobbyError);
    const seated = room.table.seats.find((s) => s.id === me.id);
    /* coming back to your own chair is always allowed, game or no game */
    if (seated) return room.table;
    if (room.table.status !== 'open' || room.game) throw new Error('started' satisfies LobbyError);
    if (room.table.seats.length >= MAX_SEATS) throw new Error('full' satisfies LobbyError);
    room.table = { ...room.table, seats: [...room.table.seats, seatFor(me, room.table, color)], updatedAt: Date.now() };
    this.announce(code, 'table');
    return room.table;
  }

  leave(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    /* a game in play keeps its seats: leaving is a disconnection, not a quit */
    if (!room || room.game) return;
    const seats = room.table.seats.filter((s) => s.id !== playerId);
    if (seats.length === room.table.seats.length) return;
    let hostId = room.table.hostId;
    if (hostId === playerId) {
      const next = seats.find((s) => s.kind === 'human');
      if (!next) {
        this.close(code);
        return;
      }
      hostId = next.id;
    }
    room.table = { ...room.table, seats, hostId, updatedAt: Date.now() };
    this.announce(code, 'table');
  }

  close(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.game?.dispose();
    this.rooms.delete(code);
    this.announce(code, 'table');
  }

  /** sweep the tables nobody has touched in a long while */
  sweep(maxAge = STALE_MS): void {
    const cut = Date.now() - maxAge;
    for (const [code, room] of this.rooms) if (room.table.updatedAt < cut) this.close(code);
  }

  /** the table as `playerId` would have it — kept down to what they may change */
  rewrite(code: string, playerId: string, wanted: Table): { table: Table | null; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { table: null, error: 'not-found' satisfies LobbyError };
    if (room.game) return { table: room.table, error: 'started' satisfies LobbyError };
    const next = sane(room.table, wanted, playerId);
    if (!next) return { table: room.table, error: 'refused' satisfies LobbyError };
    room.table = next;
    if (next.status === 'starting') this.start(code);
    this.announce(code, 'table');
    return { table: room.table };
  }

  /** the bell: the table becomes a game, seats in the order they sat down */
  private start(code: string): void {
    const room = this.rooms.get(code);
    if (!room || room.game) return;
    const setup: SetupPayload = setupFromTable(room.table);
    room.game = new TableGame(code, room.table.seats.map((s) => s.id), setup, () => this.announce(code, 'game'), this.pace);
    this.announce(code, 'game');
  }

  act(code: string, playerId: string, action: GameAction): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    const error = game.act(playerId, action);
    if (!error) this.touch(code);
    return error;
  }

  undo(code: string, playerId: string): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    const error = game.undo(playerId);
    if (!error) this.touch(code);
    return error;
  }

  private touch(code: string): void {
    const room = this.rooms.get(code);
    if (room) room.table = { ...room.table, updatedAt: Date.now() };
  }
}

/** the house rules as the server will have them — never the client's object */
function houseRules(o: Partial<SetupOptions> | undefined): SetupOptions {
  const one = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const minutes = o?.timerMinutes;
  return {
    eraLength: one(o?.eraLength, ['short', 'standard'] as const, 'standard'),
    marketTemper: one(o?.marketTemper, ['calm', 'standard', 'volatile'] as const, 'standard'),
    fidelity: one(o?.fidelity, ['core', 'approx'] as const, 'core'),
    timerMinutes: typeof minutes === 'number' && minutes > 0 ? Math.min(180, Math.round(minutes)) : null,
  };
}

function seatFor(me: Identity, table: Pick<Table, 'seats'>, color?: PlayerColor): TableSeat {
  return { id: me.id, name: me.name || 'Player', color: freeColor(table, color), kind: 'human', ready: false, joinedAt: Date.now() };
}

/* ---------------------- what a rewrite may touch ------------------- */

/** the table that stands after `wanted`, or null when the author overreached */
function sane(cur: Table, wanted: Table, playerId: string): Table | null {
  const host = cur.hostId === playerId;
  if (!cur.seats.some((s) => s.id === playerId)) return null;
  const seats: TableSeat[] = [];
  for (const w of wanted.seats) {
    const was = cur.seats.find((s) => s.id === w.id);
    /* a seat that was not there can only be a bot, and only the host seats it */
    if (!was) {
      if (!host || w.kind !== 'bot') return null;
      seats.push({ id: w.id, name: w.name, color: w.color, kind: 'bot', difficulty: w.difficulty ?? 'industrialist', ready: true, joinedAt: Date.now() });
      continue;
    }
    /* another human's chair is theirs: the host may clear it, never edit it */
    if (was.kind === 'human' && was.id !== playerId) {
      seats.push(was);
      continue;
    }
    if (was.kind === 'bot' && !host) {
      seats.push(was);
      continue;
    }
    seats.push({ ...was, name: w.name || was.name, color: w.color, difficulty: w.difficulty ?? was.difficulty, ready: was.kind === 'bot' ? true : !!w.ready });
  }
  if (!host && seats.length !== cur.seats.length) return null;
  if (seats.length < 1 || seats.length > MAX_SEATS) return null;
  if (!seats.some((s) => s.id === cur.hostId)) return null;
  if (new Set(seats.map((s) => s.id)).size !== seats.length) return null;
  if (new Set(seats.map((s) => s.color)).size !== seats.length) return null;
  const next: Table = {
    code: cur.code,
    hostId: cur.hostId,
    createdAt: cur.createdAt,
    name: host ? wanted.name.trim().slice(0, 28) || cur.name : cur.name,
    options: host ? houseRules(wanted.options) : cur.options,
    seats,
    status: 'open',
    updatedAt: Date.now(),
  };
  /* only the host rings, and only when every human has stamped themselves ready */
  if (host && wanted.status === 'starting' && canStart(next)) next.status = 'starting';
  return next;
}
