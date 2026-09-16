import { randomBytes, randomInt } from 'node:crypto';
import type { BotDifficulty, PlayerColor, SetupOptions } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { SetupPayload } from '@/game/types';
import { CODE_ALPHABET, MAX_SEATS, canStart, freeColor, setupFromTable } from '@/online/table';
import type { Desk, Identity, Invitation, LobbyError, Table, TableSeat, TableSummary } from '@/online/table';
import { DEFAULT_PACE, TableGame } from './game';
import type { Pace } from './game';
import type { Store } from './store';

/* ------------------------------------------------------------------ */
/* The hall — every table in the house.                                */
/*                                                                     */
/* A client sends the table as it would have it; the hall keeps only   */
/* what that client is allowed to change (your own chair, the host's   */
/* pen for the rules and the bots) and answers with the table that     */
/* now stands. Ringing the bell turns the table into a game.           */
/*                                                                     */
/* Nothing lives only in memory: tables are written to the register as */
/* they change and games as they are played, so the house opens again  */
/* on the same tables, with every game exactly where it was left.      */
/* ------------------------------------------------------------------ */

interface Room {
  table: Table;
  game: TableGame | null;
}

export type Changed = (code: string, what: 'table' | 'game') => void;
/** an account's desk changed: a letter came, a table moved */
export type DeskChanged = (accountId: string) => void;

/** a table nobody has touched for this long is swept away */
export const STALE_MS = 30 * 24 * 60 * 60 * 1000;
/** how many tables one account may keep open, waiting on a bell */
export const OPEN_TABLES = 8;

/** a table code minted from the house's own dice, not the client's */
const mintCode = (): string => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export class Hall {
  private rooms = new Map<string, Room>();
  /** the tables whose game is over but not in memory: played out before a
   *  restart, or a log the engine would not replay — they start no more */
  private ended = new Set<string>();
  private listeners = new Set<Changed>();
  private deskListeners = new Set<DeskChanged>();
  private readonly pace: Pace;
  private readonly store: Store;

  constructor(store: Store, pace: Pace = DEFAULT_PACE) {
    this.store = store;
    this.pace = pace;
    this.reopen();
  }

  /** the house as the register left it: tables back, games replayed */
  private reopen(): void {
    for (const table of this.store.tables()) this.rooms.set(table.code, { table, game: null });
    for (const g of this.store.games()) {
      const room = this.rooms.get(g.code);
      if (!room) continue;
      if (g.finishedAt !== null) {
        this.ended.add(g.code);
        continue;
      }
      try {
        room.game = this.deal(g.code, g.seatIds, g.setup, g.seed, g.actions);
      } catch (e) {
        /* a log the engine no longer accepts: the table stands, but plays no more */
        console.error(`table ${g.code}: the log would not replay, the game is off:`, e);
        room.game = null;
        this.ended.add(g.code);
      }
    }
  }

  onChange(cb: Changed): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** `desks`: the table's own players hear of it at their desk too — every
   *  table change, a game starting, ending or passing the turn, but not
   *  every frame of play; on a start or an end their friends do as well */
  private announce(code: string, what: 'table' | 'game', desks = what === 'table', friends = what === 'table'): void {
    for (const cb of this.listeners) cb(code, what);
    const room = this.rooms.get(code);
    if (!room || !desks) return;
    for (const s of room.table.seats) if (s.kind === 'human') this.announceDesk(s.id);
    /* a table starting or ending: its players' friends see whom they may watch */
    if (friends) for (const s of room.table.seats) if (s.kind === 'human') for (const id of this.store.friendIds(s.id)) this.announceDesk(id);
  }

  onDesk(cb: DeskChanged): () => void {
    this.deskListeners.add(cb);
    return () => this.deskListeners.delete(cb);
  }

  private announceDesk(accountId: string): void {
    for (const cb of this.deskListeners) cb(accountId);
  }

  /* ------------------------------ the desk ----------------------------- */

  /** every table this account sits at, as the desk lists them */
  tablesFor(accountId: string): TableSummary[] {
    const out: TableSummary[] = [];
    for (const room of this.rooms.values()) {
      const seat = room.table.seats.findIndex((s) => s.id === accountId);
      if (seat < 0) continue;
      const g = room.game;
      out.push({
        code: room.table.code,
        name: room.table.name,
        hostId: room.table.hostId,
        seats: room.table.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind })),
        status: g ? (g.over ? 'over' : 'playing') : this.ended.has(room.table.code) ? 'over' : 'open',
        ...(g ? { era: g.state.era, round: g.state.round, current: g.state.current } : {}),
        myTurn: !!g && !g.over && g.state.phase === 'action' && g.seatOf(accountId) === g.state.current,
        updatedAt: room.table.updatedAt,
      });
    }
    return out.sort((a, b) => Number(b.myTurn) - Number(a.myTurn) || b.updatedAt - a.updatedAt);
  }

  /** the table this account sits at that is in play, for a friend to watch */
  playingOf(accountId: string): { code: string; name: string } | undefined {
    for (const room of this.rooms.values()) {
      if (room.game && !room.game.over && room.table.seats.some((s) => s.id === accountId)) return { code: room.table.code, name: room.table.name };
    }
    return undefined;
  }

  desk(accountId: string): Desk {
    const { received, sent } = this.store.invitationsFor(accountId);
    return { tables: this.tablesFor(accountId), invitations: received, sent, friends: this.store.friendsOf(accountId), history: this.store.historyFor(accountId), stats: this.store.statsFor(accountId) };
  }

  /** ask a player by name to be friends (accepting when they asked first) */
  befriend(me: Identity, name: string): void {
    const to = this.store.accountByName(name);
    if (!to) throw new Error('no-such-player' satisfies LobbyError);
    const error = this.store.befriend(me.id, to.id);
    if (error) throw new Error(error satisfies LobbyError);
    this.announceDesk(me.id);
    this.announceDesk(to.id);
  }

  unfriend(me: Identity, id: string): void {
    const other = this.store.friendsOf(me.id).find((f) => f.id === id)?.account.id;
    if (!this.store.unfriend(id, me.id)) throw new Error('not-found' satisfies LobbyError);
    this.announceDesk(me.id);
    if (other) this.announceDesk(other);
  }

  /** whoever should hear that this account came or went: its friends */
  friendsToTell(accountId: string): string[] {
    return this.store.friendIds(accountId);
  }

  /** a letter from a player at the table to a player by name */
  invite(code: string, from: Identity, toName: string): Invitation {
    const room = this.rooms.get(code);
    if (!room) throw new Error('not-found' satisfies LobbyError);
    if (!room.table.seats.some((s) => s.id === from.id)) throw new Error('not-yours' satisfies LobbyError);
    if (this.started(room) || room.table.status !== 'open') throw new Error('started' satisfies LobbyError);
    if (room.table.seats.length >= MAX_SEATS) throw new Error('full' satisfies LobbyError);
    const to = this.store.accountByName(toName);
    if (!to || to.id === from.id) throw new Error('no-such-player' satisfies LobbyError);
    if (room.table.seats.some((s) => s.id === to.id)) throw new Error('already-seated' satisfies LobbyError);
    if (this.store.pendingInvitation(code, to.id)) throw new Error('already-invited' satisfies LobbyError);
    const letter = this.store.invite(code, from, { id: to.id, name: to.name });
    this.announceDesk(to.id);
    this.announceDesk(from.id);
    return letter;
  }

  /** the letter answered: accepting takes the chair (or says why it cannot) */
  answer(id: string, me: Identity, accept: boolean): Table | null {
    const letter = this.store.invitation(id);
    if (!letter || letter.to.id !== me.id) throw new Error('not-found' satisfies LobbyError);
    this.store.answerInvitation(id);
    this.announceDesk(letter.from.id);
    this.announceDesk(me.id);
    if (!accept) return null;
    return this.join(letter.code, me);
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

  /** the bell has rung here, or will never ring: a game plays, or played out */
  private started(room: Room): boolean {
    return !!room.game || this.ended.has(room.table.code) || this.store.gameFinished(room.table.code);
  }

  create(me: Identity, tableName: string, options: SetupOptions, color?: PlayerColor): Table {
    let open = 0;
    for (const room of this.rooms.values()) if (room.table.hostId === me.id && !this.started(room)) open += 1;
    if (open >= OPEN_TABLES) throw new Error('refused' satisfies LobbyError);
    let code = mintCode();
    while (this.rooms.has(code)) code = mintCode();
    const now = Date.now();
    const table: Table = {
      code,
      name: tableName.trim().slice(0, 28) || `${me.name}'s table`,
      hostId: me.id,
      seats: [seatFor(me, { seats: [] }, color)],
      options: houseRules(options),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(code, { table, game: null });
    this.write(code);
    return table;
  }

  /** take a chair — throws a LobbyError when the table will not have you */
  join(code: string, me: Identity, color?: PlayerColor): Table {
    const room = this.rooms.get(code);
    if (!room) throw new Error('not-found' satisfies LobbyError);
    const seated = room.table.seats.find((s) => s.id === me.id);
    /* coming back to your own chair is always allowed, game or no game */
    if (seated) return room.table;
    if (room.table.status !== 'open' || this.started(room)) throw new Error('started' satisfies LobbyError);
    if (room.table.seats.length >= MAX_SEATS) throw new Error('full' satisfies LobbyError);
    room.table = { ...room.table, seats: [...room.table.seats, seatFor(me, room.table, color)], updatedAt: Date.now() };
    this.write(code);
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
    this.write(code);
  }

  close(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.game?.close();
    /* the table is gone: whoever was asked to it, or sat at it, hears of it */
    const told = new Set([...this.store.voidInvitations(code), ...room.table.seats.filter((s) => s.kind === 'human').map((s) => s.id)]);
    this.rooms.delete(code);
    this.store.dropTable(code);
    this.announce(code, 'table');
    for (const id of told) this.announceDesk(id);
  }

  /** sweep the tables nobody has touched in a long while — never one in play */
  sweep(maxAge = STALE_MS): void {
    const cut = Date.now() - maxAge;
    for (const [code, room] of this.rooms) {
      if (room.game && !room.game.over) continue;
      if (room.table.updatedAt < cut) this.close(code);
    }
  }

  /** stop every clock in the house (the process is going down) */
  dispose(): void {
    for (const room of this.rooms.values()) room.game?.close();
  }

  /** the table as `playerId` would have it — kept down to what they may change */
  rewrite(code: string, playerId: string, wanted: Table): { table: Table | null; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { table: null, error: 'not-found' satisfies LobbyError };
    if (this.started(room)) return { table: room.table, error: 'started' satisfies LobbyError };
    const next = sane(room.table, wanted, playerId);
    if (!next) return { table: room.table, error: 'refused' satisfies LobbyError };
    room.table = next;
    if (next.status === 'starting') this.start(code);
    this.write(code);
    return { table: room.table };
  }

  /** the bell: the table becomes a game, seats in the order they sat down */
  private start(code: string): void {
    const room = this.rooms.get(code);
    if (!room || this.started(room)) return;
    const setup: SetupPayload = setupFromTable(room.table);
    const seatIds = room.table.seats.map((s) => s.id);
    const seed = randomInt(1e9);
    if (!this.store.openGame(code, seed, setup, seatIds)) {
      console.error(`table ${code}: a game was already played out here, the bell is ignored`);
      this.ended.add(code);
      return;
    }
    room.game = this.deal(code, seatIds, setup, seed);
    for (const id of this.store.voidInvitations(code)) this.announceDesk(id);
    this.announce(code, 'game', true, true);
  }

  private deal(code: string, seatIds: string[], setup: SetupPayload, seed: number, actions?: GameAction[]): TableGame {
    /* what the last frame said, to tell a turn passing or the end from a move */
    let ended = false;
    let current = -1;
    const game: TableGame = new TableGame({
      code,
      seatIds,
      setup,
      seed,
      actions,
      hostId: this.rooms.get(code)?.table.hostId,
      pace: this.pace,
      emit: () => {
        this.touch(code);
        const over = game.over;
        const turned = game.state.current !== current;
        const justEnded = over && !ended;
        ended = over;
        current = game.state.current;
        this.announce(code, 'game', turned || justEnded, justEnded);
      },
      journal: {
        append: (idx: number, action: GameAction) => this.store.appendMove(code, idx, action),
        drop: (idx: number) => this.store.dropMove(code, idx),
        finish: (state, tallies) => this.store.finishGame(code, state, tallies),
      },
    });
    return game;
  }

  act(code: string, playerId: string, action: GameAction): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    return game.act(playerId, action);
  }

  undo(code: string, playerId: string): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    return game.undo(playerId);
  }

  pause(code: string, playerId: string, want: 'propose' | 'agree' | 'refuse' | 'resume'): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    return game.pauseTable(playerId, want);
  }

  takeBreak(code: string, playerId: string, on: boolean): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    return game.breakSeat(playerId, on);
  }

  rollback(code: string, playerId: string, want: 'propose' | 'agree' | 'refuse', to?: number): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    return game.rollbackTable(playerId, want, to);
  }

  /** the table changed: to the register, then to everyone watching */
  private write(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    this.store.saveTable(room.table);
    this.announce(code, 'table');
  }

  /** the table is alive — a played action keeps it from being swept */
  private touch(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.table = { ...room.table, updatedAt: Date.now() };
    this.store.saveTable(room.table);
  }
}

function seatFor(me: Identity, table: Pick<Table, 'seats'>, color?: PlayerColor): TableSeat {
  return { id: me.id, name: me.name, color: freeColor(table, color), kind: 'human', ready: false, joinedAt: Date.now() };
}

/** the house rules as the server will have them — never the client's object */
function houseRules(o: Partial<SetupOptions> | undefined): SetupOptions {
  const one = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const minutes = o?.timerMinutes;
  return {
    eraLength: one(o?.eraLength, ['short', 'standard'] as const, 'standard'),
    marketTemper: one(o?.marketTemper, ['calm', 'standard', 'volatile'] as const, 'standard'),
    fidelity: one(o?.fidelity, ['core', 'approx'] as const, 'core'),
    assist: !!o?.assist,
    timerMinutes: typeof minutes === 'number' && minutes > 0 ? Math.min(180, Math.round(minutes)) : null,
  };
}

/** a seat's candle as the host would have it: none, or a sane number of minutes */
function minutesOf(v: unknown): number | null {
  return typeof v === 'number' && v > 0 ? Math.min(180, Math.round(v)) : null;
}

/* the four chairs and the three bots, as the setup page knows them — spelt
   out here so the server has no page to import */
const COLORS: readonly PlayerColor[] = ['brass', 'oxblood', 'verdigris', 'steel'];
const DIFFICULTIES: readonly BotDifficulty[] = ['foreman', 'industrialist', 'magnate'];
const colorOf = (v: unknown): PlayerColor | null => (COLORS.includes(v as PlayerColor) ? (v as PlayerColor) : null);
const difficultyOf = (v: unknown): BotDifficulty | null => (DIFFICULTIES.includes(v as BotDifficulty) ? (v as BotDifficulty) : null);
/** a bot's name as the host typed it, trimmed to what a chair can carry */
const botName = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 20) : null);

/* ---------------------- what a rewrite may touch ------------------- */

/** the table that stands after `wanted`, or null when the author overreached */
function sane(cur: Table, wanted: Table, playerId: string): Table | null {
  const host = cur.hostId === playerId;
  if (!cur.seats.some((s) => s.id === playerId)) return null;
  const seats: TableSeat[] = [];
  for (const w of wanted.seats) {
    const was = cur.seats.find((s) => s.id === w.id);
    /* a seat that was not there can only be a bot, and only the host seats it;
       its id is the house's, whatever the client called it */
    if (!was) {
      const color = colorOf(w.color);
      const name = botName(w.name);
      const difficulty = w.difficulty === undefined ? 'industrialist' : difficultyOf(w.difficulty);
      if (!host || w.kind !== 'bot' || !color || !name || !difficulty) return null;
      /* the client's own bot id is kept when it is plainly a bot's (accounts
         are 'a-…'): a second edit sent before the echo then names the same
         machine, not a new one */
      const id = /^bot-[a-z0-9]{4,12}$/.test(w.id) ? w.id : 'bot-' + randomBytes(4).toString('hex');
      seats.push({ id, name, color, kind: 'bot', difficulty, ...(w.minutes !== undefined ? { minutes: minutesOf(w.minutes) } : {}), ready: true, joinedAt: Date.now() });
      continue;
    }
    /* another human's chair is theirs: the host may clear it, never edit it —
       except its candle, which is the host's to set */
    if (was.kind === 'human' && was.id !== playerId) {
      seats.push(host && w.minutes !== was.minutes ? { ...was, ...(w.minutes === undefined ? {} : { minutes: minutesOf(w.minutes) }) } : was);
      continue;
    }
    if (was.kind === 'bot' && !host) {
      seats.push(was);
      continue;
    }
    /* your own name at the table is your account's, not the client's word */
    const color = colorOf(w.color);
    const difficulty = w.difficulty === undefined ? was.difficulty : difficultyOf(w.difficulty);
    const name = was.kind === 'bot' ? botName(w.name) : was.name;
    if (!color || !name || difficulty === null) return null;
    seats.push({ ...was, color, ...(difficulty !== undefined ? { difficulty } : {}), ready: was.kind === 'bot' ? true : !!w.ready, name, ...(host && w.minutes !== undefined ? { minutes: minutesOf(w.minutes) } : {}) });
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
