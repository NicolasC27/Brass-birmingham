import { randomBytes, randomInt } from 'node:crypto';
import type { BotPersona, PlayerColor, SetupOptions } from '@/components/setup/constants';
import { freePersona, personaName, personaOf } from '@/game/data';
import type { GameAction } from '@/game/actions';
import type { SetupPayload } from '@/game/types';
import { CODE_ALPHABET, MAX_SEATS, canStart, freeColor, setupFromTable } from '@/online/table';
import type { Dispatch, Desk, HallCounts, Identity, Invitation, Leaderboard, LobbyError, PublicTable, QueueState, Table, TableFilter, TableQuery, TableSeat, TableSummary, TablesPage, Tier } from '@/online/table';
import { TABLE_FILTERS, normalizeQuery } from '@/online/table';
import { DEFAULT_PACE, TableGame } from './game';
import type { Pace } from './game';
import { Queue } from './queue';
import type { Match, Mode, Waits } from './queue';
import { seasonAt } from './rating';
import { pickTableName } from '@/online/tableNames';
import type { Store } from './store';
import { PaceWatch, sameHouse } from './watch';

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
/*                                                                     */
/* The hall also keeps the two queues and deals their tables itself,   */
/* and answers for the register of what is being played, the season's */
/* board and the counts on the desk. What only the switchboard knows — */
/* who holds a socket, who watches what — it is told through presence. */
/* ------------------------------------------------------------------ */

interface Room {
  table: Table;
  game: TableGame | null;
}

export type Changed = (code: string, what: 'table' | 'game') => void;
/** an account's desk changed: a letter came, a table moved */
export type DeskChanged = (accountId: string) => void;
/** an account's place in the queues changed (null: it stands in none) */
export type QueueChanged = (accountId: string, state: QueueState | null) => void;
/** the office dealt a table to these accounts from a queue */
export type Dealt = (accountIds: string[], table: Table) => void;

/** what the switchboard knows and the hall does not */
export interface Presence {
  /** distinct accounts with a socket open */
  count: () => number;
  /** does this account hold a socket right now? */
  has: (accountId: string) => boolean;
  /** sockets following this table */
  watchers: (code: string) => number;
  /** the address this account's socket comes from, when one is open */
  address?: (accountId: string) => string | null;
}
const NOBODY: Presence = { count: () => 0, has: () => true, watchers: () => 0 };

export interface HallOptions {
  /** the clock the queues wait by (a test would rather turn it itself) */
  now?: () => number;
  waits?: Partial<Waits>;
}

/** the tables the office deals from the queues */
const QUICK_TABLE = { options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: 2, fidelity: 'core', assist: false } as SetupOptions };
const RANKED_TABLE = { options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: 3, fidelity: 'core', assist: false } as SetupOptions };
/** the machines that keep a lone quick player company */
const COMPANY: BotPersona[] = ['boulton', 'wedgwood'];

/** the machines' strength for each cote, and before a first ranked game */
const STRENGTH_BY_TIER: Record<Tier, number> = { apprentice: 0.3, journeyman: 0.45, foreman: 0.6, industrialist: 0.8, magnate: 1 };
const FRESH_STRENGTH = 0.35;

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
  private queueListeners = new Set<QueueChanged>();
  private dealtListeners = new Set<Dealt>();
  private readonly queues: Queue;
  private who: Presence = NOBODY;
  /** the watch on the pace of every human seat */
  private readonly watch = new PaceWatch();
  private readonly pace: Pace;
  private readonly store: Store;

  constructor(store: Store, pace: Pace = DEFAULT_PACE, o: HallOptions = {}) {
    this.store = store;
    this.pace = pace;
    /* the ranked line never seats two accounts from one address together */
    this.queues = new Queue({ now: o.now, waits: o.waits, present: (id) => this.who.has(id), apart: (a, b) => sameHouse(this.who.address?.(a), this.who.address?.(b)) });
    this.reopen();
  }

  /** the switchboard tells the hall who is in and who watches what */
  presence(p: Presence): void {
    this.who = p;
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

  /** how well the machines play at a table: the strongest human's cote sets
   *  it, a fresh account is met gently, a table of machines plays flat out */
  private strengthFor(seatIds: string[]): number {
    const season = seasonAt().id;
    let best = -1;
    for (const id of seatIds) {
      if (id.startsWith('bot-')) continue;
      const rating = this.store.ratingFor(id, season);
      best = Math.max(best, rating ? STRENGTH_BY_TIER[rating.tier] : FRESH_STRENGTH);
    }
    return best < 0 ? 1 : best;
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

  onQueue(cb: QueueChanged): () => void {
    this.queueListeners.add(cb);
    return () => this.queueListeners.delete(cb);
  }

  onDealt(cb: Dealt): () => void {
    this.dealtListeners.add(cb);
    return () => this.dealtListeners.delete(cb);
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
        ...(room.table.ranked ? { ranked: true } : {}),
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
    const season = seasonAt();
    return {
      tables: this.tablesFor(accountId),
      invitations: received,
      sent,
      friends: this.store.friendsOf(accountId),
      history: this.store.historyFor(accountId),
      stats: this.store.statsFor(accountId),
      rating: this.store.ratingFor(accountId, season.id),
      season,
      purse: this.store.purse(accountId),
      hall: this.counts(),
      queue: this.queues.stateOf(accountId),
    };
  }

  /** the house at a glance */
  counts(): HallCounts {
    let playing = 0;
    for (const room of this.rooms.values()) if (room.game && !room.game.over) playing += 1;
    return { online: this.who.count(), playing, queued: this.queues.total() };
  }

  /** the register of tables anyone may look at: in play first, then the newest */
  register(viewerId: string | null = null): PublicTable[] {
    const out: PublicTable[] = [];
    /* the viewer's friends, to mark the tables they sit at */
    const friends = new Set(viewerId ? this.store.friendsOf(viewerId).filter((f) => f.status === 'friends').map((f) => f.account.id) : []);
    for (const room of this.rooms.values()) {
      const g = room.game;
      if (g?.over || (!g && this.ended.has(room.table.code))) continue;
      const friend = friends.size > 0 && room.table.seats.some((s) => friends.has(s.id));
      out.push({
        ...(friend ? { friend: true } : {}),
        code: room.table.code,
        name: room.table.name,
        hostName: room.table.seats.find((s) => s.id === room.table.hostId)?.name ?? '',
        seats: room.table.seats.map((s) => ({ name: s.name, color: s.color, kind: s.kind })),
        status: g ? 'playing' : 'open',
        ...(g ? { era: g.state.era, round: g.state.round, current: g.state.current } : {}),
        ranked: !!room.table.ranked,
        watchers: this.who.watchers(room.table.code),
        updatedAt: room.table.updatedAt,
      });
    }
    return out.sort((a, b) => Number(b.status === 'playing') - Number(a.status === 'playing') || b.updatedAt - a.updatedAt);
  }

  /** the register as one reader turns it: searched, filtered, sorted, a
   *  page at a time — with the reader's own tables, their friends' and the
   *  most watched ones beside, whatever the page */
  page(viewerId: string | null, wanted: TableQuery = {}): TablesPage {
    const query = normalizeQuery(wanted);
    const all = this.register(viewerId);
    const seatedHere = (t: PublicTable): boolean => !!viewerId && !!this.rooms.get(t.code)?.table.seats.some((s) => s.id === viewerId);
    const needle = query.q;
    const searched = needle ? all.filter((t) => t.code.toLowerCase().startsWith(needle) || t.hostName.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle)) : all;
    const passes = (t: PublicTable, f: TableFilter): boolean => {
      switch (f) {
        case 'seats':
          return t.status === 'open' && !t.ranked && t.seats.length < MAX_SEATS && !seatedHere(t);
        case 'friends':
          return !!t.friend;
        case 'ranked':
          return t.ranked;
        case 'rail':
          return t.status === 'playing' && t.era === 'rail';
        case 'live':
          return t.status === 'playing';
        default:
          return true;
      }
    };
    const counts = Object.fromEntries(TABLE_FILTERS.map((f) => [f, searched.filter((t) => passes(t, f)).length])) as Record<TableFilter, number>;
    const byWatched = (a: PublicTable, b: PublicTable) => b.watchers - a.watchers || (b.round ?? 0) - (a.round ?? 0) || b.updatedAt - a.updatedAt;
    /* filling: the tables about to start first, the fullest of them ahead,
       then the games by how young they are; fresh: the last touched first */
    const byFilling = (a: PublicTable, b: PublicTable) => {
      const oa = a.status === 'open' ? 0 : 1;
      const ob = b.status === 'open' ? 0 : 1;
      if (oa !== ob) return oa - ob;
      if (oa === 0) return b.seats.length - a.seats.length || b.updatedAt - a.updatedAt;
      return (a.round ?? 0) - (b.round ?? 0) || b.updatedAt - a.updatedAt;
    };
    const list = searched.filter((t) => passes(t, query.filter)).sort(query.filter === 'live' ? byWatched : query.sort === 'fresh' ? (a, b) => b.updatedAt - a.updatedAt : byFilling);
    const offset = Math.min(query.offset, Math.max(0, list.length - 1));
    /* the telegraph: the newest headlines of the tables in play */
    const dispatches: Dispatch[] = [];
    for (const room of this.rooms.values()) {
      if (!room.game || room.game.over) continue;
      for (const d of room.game.dispatches) dispatches.push({ ...d, code: room.table.code, table: room.table.name });
    }
    dispatches.sort((a, b) => b.at - a.at);
    return {
      query: { ...query, offset },
      tables: list.slice(offset, offset + query.limit),
      total: list.length,
      counts,
      mine: all.filter(seatedHere),
      friends: all.filter((t) => t.friend && !seatedHere(t)).sort(byWatched).slice(0, 3),
      live: all.filter((t) => t.status === 'playing').sort(byWatched).slice(0, 3),
      dispatches: dispatches.slice(0, 10),
    };
  }

  /** a chair for whoever cannot choose: the open table nearest to starting */
  seatMe(me: Identity, color?: PlayerColor): Table {
    const open = [...this.rooms.values()].filter((r) => !r.table.ranked && r.table.status === 'open' && !this.started(r) && r.table.seats.length < MAX_SEATS && !r.table.seats.some((s) => s.id === me.id));
    open.sort((a, b) => b.table.seats.length - a.table.seats.length || a.table.createdAt - b.table.createdAt);
    if (!open.length) throw new Error('not-found' satisfies LobbyError);
    return this.join(open[0].table.code, me, color);
  }

  leaderboard(accountId: string): Leaderboard {
    return this.store.leaderboard(seasonAt(), accountId);
  }

  /* ----------------------------- the queues ---------------------------- */

  /** stand in a line, or step out of it — then the office looks down the lines */
  queue(accountId: string, mode: Mode, on: boolean): void {
    const touched = on ? this.queues.join(accountId, mode) : [this.queues.leave(accountId)].filter((m): m is Mode => m !== null);
    if (!touched.length) {
      /* already standing there: a fresh tab is told where it stands */
      if (on) for (const cb of this.queueListeners) cb(accountId, this.queues.stateOf(accountId));
      return;
    }
    this.announceQueues(touched, [accountId]);
    this.announceDesk(accountId);
    this.matchQueues();
  }

  /** the office looks down the lines: the absent are dropped, the tables ready are dealt */
  matchQueues(): void {
    const dropped = this.queues.sweep();
    const matches = this.queues.match();
    for (const m of matches) this.dealQueue(m);
    const touched = new Set<Mode>(matches.map((m) => m.mode));
    if (dropped.length) touched.add('quick').add('ranked');
    this.announceQueues([...touched], dropped);
    for (const id of dropped) this.announceDesk(id);
  }

  /** everyone still in these lines hears the new count; `gone` hear they are out */
  private announceQueues(modes: Mode[], gone: string[]): void {
    for (const id of gone) if (!this.queues.modeOf(id)) for (const cb of this.queueListeners) cb(id, null);
    for (const mode of new Set(modes)) for (const id of this.queues.members(mode)) for (const cb of this.queueListeners) cb(id, this.queues.stateOf(id));
  }

  /** a table dealt from a queue: seated, announced, and the bell rung at once */
  private dealQueue(m: Match): void {
    const ranked = m.mode === 'ranked';
    const blueprint = ranked ? RANKED_TABLE : QUICK_TABLE;
    const seats: TableSeat[] = [];
    const now = Date.now();
    for (const id of m.ids) {
      const account = this.store.account(id);
      if (!account || !account.verified) continue;
      seats.push({ ...seatFor(account, { seats }, account.favoriteColor ?? undefined), ready: true });
    }
    if (!seats.length) return;
    for (const machine of COMPANY.slice(0, ranked ? 0 : m.machines)) {
      seats.push({ id: 'bot-' + randomBytes(4).toString('hex'), name: personaName(machine), color: freeColor({ seats }), kind: 'bot', persona: machine, ready: true, joinedAt: now });
    }
    let code = mintCode();
    while (this.rooms.has(code)) code = mintCode();
    const table: Table = { code, name: this.drawName(), hostId: seats[0].id, seats, options: blueprint.options, status: 'starting', ...(ranked ? { ranked: true } : {}), createdAt: now, updatedAt: now };
    this.rooms.set(code, { table, game: null });
    this.write(code);
    /* the players are told they sit here — and only then is the bell rung, so
       that the first frame of the game finds them watching */
    const ids = seats.filter((s) => s.kind === 'human').map((s) => s.id);
    for (const id of ids) for (const cb of this.queueListeners) cb(id, null);
    for (const cb of this.dealtListeners) cb(ids, table);
    this.start(code);
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

  create(me: Identity, options: SetupOptions, color?: PlayerColor): Table {
    let open = 0;
    for (const room of this.rooms.values()) if (room.table.hostId === me.id && !this.started(room)) open += 1;
    if (open >= OPEN_TABLES) throw new Error('refused' satisfies LobbyError);
    let code = mintCode();
    while (this.rooms.has(code)) code = mintCode();
    const now = Date.now();
    const table: Table = {
      code,
      name: this.drawName(),
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

  /** a name from the register that no live table carries */
  private drawName(): string {
    const busy: string[] = [];
    for (const room of this.rooms.values()) if (!room.game || !room.game.over) busy.push(room.table.name);
    return pickTableName(busy);
  }

  /** take a chair — throws a LobbyError when the table will not have you */
  join(code: string, me: Identity, color?: PlayerColor): Table {
    const room = this.rooms.get(code);
    if (!room) throw new Error('not-found' satisfies LobbyError);
    const seated = room.table.seats.find((s) => s.id === me.id);
    /* coming back to your own chair is always allowed, game or no game */
    if (seated) return room.table;
    /* a ranked table seats only those the office dealt into it */
    if (room.table.ranked) throw new Error('refused' satisfies LobbyError);
    if (room.table.status !== 'open' || this.started(room)) throw new Error('started' satisfies LobbyError);
    if (room.table.seats.length >= MAX_SEATS) throw new Error('full' satisfies LobbyError);
    room.table = { ...room.table, seats: [...room.table.seats, seatFor(me, room.table, color)], updatedAt: Date.now() };
    this.write(code);
    return room.table;
  }

  /** a seat given up for good. At an open table the chair is freed; at a
   *  game in play a machine takes it over and plays it out, the last human
   *  out abandoning the game; a game played out simply leaves the desk.
   *  The table closes once no human is left at it. */
  leave(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const seats = room.table.seats.filter((s) => s.id !== playerId);
    if (seats.length === room.table.seats.length) return;
    const game = room.game;
    if (game && !game.over) {
      const seat = game.seatOf(playerId);
      if (seat >= 0 && !game.state.players[seat].isBot) {
        const error = game.act(playerId, { kind: 'resign', player: seat });
        if (error) {
          console.error(`table ${code}: ${playerId} could not leave the game: ${error}`);
          return;
        }
      }
    }
    let hostId = room.table.hostId;
    const next = seats.find((s) => s.kind === 'human');
    if (!next) {
      this.close(code);
      return;
    }
    if (hostId === playerId) hostId = next.id;
    room.table = { ...room.table, seats, hostId, updatedAt: Date.now() };
    this.write(code);
    /* no longer seated, the leaver is not on the table's list: their desk is told apart */
    this.announceDesk(playerId);
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
      strength: () => this.strengthFor(seatIds),
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
        finish: (state, tallies) => {
          this.store.finishGame(code, state, tallies, !!this.rooms.get(code)?.table.ranked);
          this.watch.forget(code);
          /* the cote and the purse moved after the last frame went out: the desks again */
          for (const id of seatIds) if (!id.startsWith('bot-')) this.announceDesk(id);
        },
      },
    });
    return game;
  }

  act(code: string, playerId: string, action: GameAction): string | null {
    const game = this.rooms.get(code)?.game;
    if (!game) return 'No game at this table';
    /* the watch times the opening of each human turn: a run of openings
       quicker than a board can be read is noted in the register */
    const opening = game.turnActions() === 0 && game.state.phase === 'action' && game.seatOf(playerId) === game.state.current;
    const age = game.turnAge();
    const error = game.act(playerId, action);
    if (!error && opening && action.kind !== 'concede' && action.kind !== 'resign' && this.watch.note(code, game.seatOf(playerId), age)) {
      this.store.flag(playerId, 'pace', `turn opened in ${age} ms, the twelfth such in a row`, code);
    }
    return error;
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
const colorOf = (v: unknown): PlayerColor | null => (COLORS.includes(v as PlayerColor) ? (v as PlayerColor) : null);
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
      const persona = w.persona === undefined ? freePersona(seats.map((s) => s.persona)) : personaOf(w.persona);
      /* no machine ever sits at a ranked table */
      if (!host || w.kind !== 'bot' || !color || !name || !persona || cur.ranked) return null;
      /* the client's own bot id is kept when it is plainly a bot's (accounts
         are 'a-…'): a second edit sent before the echo then names the same
         machine, not a new one */
      const id = /^bot-[a-z0-9]{4,12}$/.test(w.id) ? w.id : 'bot-' + randomBytes(4).toString('hex');
      seats.push({ id, name, color, kind: 'bot', persona, ...(w.minutes !== undefined ? { minutes: minutesOf(w.minutes) } : {}), ready: true, joinedAt: Date.now() });
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
    const persona = w.persona === undefined ? was.persona : personaOf(w.persona);
    const name = was.kind === 'bot' ? botName(w.name) : was.name;
    if (!color || !name || persona === null) return null;
    seats.push({ ...was, color, ...(persona !== undefined ? { persona } : {}), ready: was.kind === 'bot' ? true : !!w.ready, name, ...(host && w.minutes !== undefined ? { minutes: minutesOf(w.minutes) } : {}) });
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
    name: cur.name,
    options: host ? houseRules(wanted.options) : cur.options,
    seats,
    status: 'open',
    ...(cur.ranked ? { ranked: true } : {}),
    updatedAt: Date.now(),
  };
  /* only the host rings, and only when every human has stamped themselves ready */
  if (host && wanted.status === 'starting' && canStart(next)) next.status = 'starting';
  return next;
}
