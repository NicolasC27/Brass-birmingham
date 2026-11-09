import { useSyncExternalStore } from 'react';
import { onlineWire } from './net';
import type { Wire } from './wire';
import type { ServerMessage } from './protocol';
import type { Line, Room } from './parlour';
import { HALL, friendRoom, hasLink } from './parlour';

/* ------------------------------------------------------------------ */
/* The parlour, as this browser keeps it.                              */
/*                                                                     */
/* The office carries every line (online/parlour.ts); this is what     */
/* the telegraph dock and the table's wire read: the lines of each    */
/* room seen so far, what has not been read, which room is on show.   */
/* A line said in a room nobody is looking at counts as unread until  */
/* the room is opened, and the office is told how far it was read so  */
/* another tab, or tomorrow's, agrees.                                 */
/* ------------------------------------------------------------------ */

const DOCK_KEY = 'brassworks.telegraph.v1';
const HIDDEN_KEY = 'brassworks.telegraph.hidden.v1';
/** a room keeps so many lines in memory; older ones are read back from the office */
const KEEP = 300;

export interface RoomView {
  lines: Line[];
  /** older lines remain at the office */
  more: boolean;
  /** the first page has been asked for */
  asked: boolean;
}

export interface Parlour {
  rooms: Record<Room, RoomView>;
  /** lines not read, by room */
  unread: Record<Room, number>;
  /** the room on show, if any */
  open: Room | null;
  /** the dock stands open */
  docked: boolean;
  /** a room shown by a page of its own (the table's wire), dock or no dock */
  focus: Room | null;
  /** members this reader has chosen not to read */
  hidden: string[];
  /** the last line said to this reader while nobody was looking (never the hall's), for a word on the page */
  latest: Line | null;
  /** a friend come or gone, by their room: said in the tape, never written down */
  notes: Record<Room, Note[]>;
}

export interface Note {
  at: number;
  kind: 'came' | 'went';
  name: string;
}

const EMPTY: RoomView = { lines: [], more: false, asked: false };

let state: Parlour = { rooms: {}, unread: {}, open: null, docked: false, focus: null, hidden: [], latest: null, notes: {} };
/** the friends' lamps as the desk last showed them, by account id */
let lamps: Map<string, boolean> | null = null;
const listeners = new Set<() => void>();
let attached: Wire | null = null;

const emit = () => {
  for (const cb of listeners) cb();
};
const set = (patch: Partial<Parlour>) => {
  state = { ...state, ...patch };
  emit();
};

function readDock(): { docked: boolean; open: Room | null } {
  try {
    const raw = localStorage.getItem(DOCK_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { docked?: unknown; open?: unknown };
      return { docked: d.docked === true, open: typeof d.open === 'string' ? d.open : null };
    }
  } catch {
    /* private mode */
  }
  return { docked: false, open: null };
}
function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function keep(): void {
  try {
    localStorage.setItem(DOCK_KEY, JSON.stringify({ docked: state.docked, open: state.open }));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(state.hidden));
  } catch {
    /* the dock forgets its shape then */
  }
}

/** the wire listened to, once */
function attach(): Wire | null {
  const w = onlineWire();
  if (!w || attached === w) return w;
  attached = w;
  state = { ...state, ...readDock(), hidden: readHidden() };
  w.on(receive);
  w.onSession(() => {
    /* nobody signed in: nothing of the parlour is this browser's */
    if (!w.session) {
      lamps = null;
      set({ rooms: {}, unread: {}, open: null, focus: null, latest: null, notes: {} });
    }
  });
  /* a friend's lamp turning on or off is a note in their room */
  w.onDesk(() => {
    const friends = w.desk?.friends.filter((f) => f.status === 'friends') ?? [];
    const now = new Map(friends.map((f) => [f.account.id, f.online]));
    if (lamps) {
      let notes = state.notes;
      for (const f of friends) {
        const was = lamps.get(f.account.id);
        if (was === undefined || was === f.online) continue;
        const room = friendRoom(f.id);
        notes = { ...notes, [room]: [...(notes[room] ?? []), { at: Date.now(), kind: f.online ? ('came' as const) : ('went' as const), name: f.account.name }].slice(-20) };
      }
      if (notes !== state.notes) set({ notes });
    }
    lamps = now;
  });
  return w;
}

/** the room is being read right now: on show in the open dock, or by a page
 *  of its own, with the page visible */
const reading = (room: Room): boolean => ((state.open === room && state.docked) || state.focus === room) && typeof document !== 'undefined' && document.visibilityState === 'visible';

function receive(m: ServerMessage): void {
  if (m.t === 'said') {
    const { line } = m;
    const room = state.rooms[line.room] ?? EMPTY;
    if (room.lines.some((l) => l.id === line.id)) return;
    const lines = [...room.lines, line].slice(-KEEP);
    const rooms = { ...state.rooms, [line.room]: { ...room, lines } };
    const mine = line.from.id === attached?.session?.id;
    if (!mine && !reading(line.room)) {
      const hidden = state.hidden.includes(line.from.id);
      set({ rooms, unread: hidden ? state.unread : { ...state.unread, [line.room]: (state.unread[line.room] ?? 0) + 1 }, latest: hidden || line.room === HALL ? state.latest : line });
    }
    else {
      set({ rooms });
      if (!mine) attached?.send({ t: 'seen', room: line.room, at: line.at });
    }
    return;
  }
  if (m.t === 'lines') {
    const room = state.rooms[m.room] ?? EMPTY;
    const known = new Set(room.lines.map((l) => l.id));
    const lines = [...m.lines.filter((l) => !known.has(l.id)), ...room.lines].sort((a, b) => a.id - b.id).slice(-KEEP);
    /* the page just read is the oldest in hand: whether older lines remain is its word */
    set({ rooms: { ...state.rooms, [m.room]: { lines, more: m.more, asked: true } } });
    return;
  }
  if (m.t === 'unread') {
    /* the office counts the rooms it keeps a reading of; the hall is this browser's own count */
    const unread: Record<Room, number> = state.unread[HALL] ? { [HALL]: state.unread[HALL] } : {};
    for (const r of m.rooms) if (!reading(r.room)) unread[r.room] = r.count;
    set({ unread });
  }
}

/* ------------------------------- hooks ------------------------------- */

function subscribe(cb: () => void): () => void {
  attach();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useParlour(): Parlour {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useRoom(room: Room | null): RoomView {
  return useSyncExternalStore(
    subscribe,
    () => (room ? (state.rooms[room] ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
}

/** lines not read in every room but the ones named */
export function useUnreadTotal(except: Room[] = []): number {
  const p = useParlour();
  let n = 0;
  for (const [room, count] of Object.entries(p.unread)) if (!except.includes(room)) n += count;
  return n;
}

/* ------------------------------ commands ------------------------------ */

export function setDocked(docked: boolean): void {
  set({ docked });
  keep();
  if (docked && state.open) showRoom(state.open);
}

/** the room on show (null: the list): its lines are asked for, and it is read */
export function showRoom(room: Room | null): void {
  set({ open: room });
  keep();
  if (!room) return;
  const w = attach();
  if (!w) return;
  const view = state.rooms[room] ?? EMPTY;
  if (!view.asked) void w.ask((rid) => ({ t: 'lines', rid, room })).catch(() => undefined);
  markRead(room);
}

/** a page of its own shows this room (null: it closed): its lines are asked for, and it is read */
export function focusRoom(room: Room | null): void {
  set({ focus: room });
  if (!room) return;
  const w = attach();
  if (!w) return;
  if (!(state.rooms[room] ?? EMPTY).asked) void w.ask((rid) => ({ t: 'lines', rid, room })).catch(() => undefined);
  markRead(room);
}

/** the room is read up to its last line */
export function markRead(room: Room): void {
  const w = attach();
  const view = state.rooms[room];
  const last = view?.lines[view.lines.length - 1];
  if (state.unread[room]) {
    const unread = { ...state.unread };
    delete unread[room];
    set({ unread });
  }
  if (w && last && room !== HALL) w.send({ t: 'seen', room, at: last.at });
}

/** older lines of a room, from before the first one in hand */
export function loadMore(room: Room): void {
  const w = attach();
  const view = state.rooms[room];
  if (!w || !view?.more || !view.lines.length) return;
  void w.ask((rid) => ({ t: 'lines', rid, room, before: view.lines[0].id })).catch(() => undefined);
}

export async function say(room: Room, text: string): Promise<void> {
  const w = attach();
  if (!w) throw new Error('offline');
  /* the office would say the same: said here at once, without the trip */
  if (hasLink(text)) throw new Error('no-links');
  await w.ask((rid) => ({ t: 'say', rid, room, text }));
}

export async function reportLine(id: number): Promise<void> {
  const w = attach();
  if (!w) throw new Error('offline');
  await w.ask((rid) => ({ t: 'report', rid, id }));
}

/** the word on the page has been read, or waved away */
export function clearLatest(): void {
  if (state.latest) set({ latest: null });
}

/** a member this reader would rather not read, or read again */
export function hideMember(accountId: string, on: boolean): void {
  const hidden = on ? [...new Set([...state.hidden, accountId])] : state.hidden.filter((x) => x !== accountId);
  set({ hidden });
  keep();
}
