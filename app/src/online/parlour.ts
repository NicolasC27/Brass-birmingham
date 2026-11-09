import type { Identity } from './table';

/* ------------------------------------------------------------------ */
/* The parlour — where members talk, in a few rooms.                   */
/*                                                                     */
/* The hall is open to every member whose address has answered its    */
/* letter; a friends' room belongs to the two of them for as long as   */
/* the friendship lasts; a table's room is its seats', and whoever    */
/* watches the table reads it. The office keeps every line, hands them */
/* back a page at a time, and knows which lines each member has seen. */
/* These types are the wire's and the register's alike.                */
/* ------------------------------------------------------------------ */

/** 'hall', 'friend:<friendship id>' or 'table:<code>' */
export type Room = string;

export const HALL: Room = 'hall';
export const friendRoom = (friendshipId: string): Room => `friend:${friendshipId}`;
export const tableRoom = (code: string): Room => `table:${code}`;

/** what a room's name says of it, or null for a name the office does not keep */
export function roomOf(room: unknown): { kind: 'hall' } | { kind: 'friend'; id: string } | { kind: 'table'; code: string } | null {
  if (typeof room !== 'string' || room.length > 40) return null;
  if (room === HALL) return { kind: 'hall' };
  if (room.startsWith('friend:')) return { kind: 'friend', id: room.slice(7) };
  if (room.startsWith('table:')) return { kind: 'table', code: room.slice(6) };
  return null;
}

/** one line said in a room */
export interface Line {
  id: number;
  room: Room;
  from: Identity;
  text: string;
  at: number;
}

/** the lines a member has not read in a room, and when the last was said */
export interface Unread {
  room: Room;
  count: number;
  at: number;
}

/** a line is one breath long */
export const MAX_LINE = 280;
/** how many lines a page of a room carries */
export const LINES_PAGE = 50;
/** a member may say so many lines within the window, and no more */
export const SAY_WINDOW_MS = 10_000;
export const SAY_SHOWER = 5;

/** the text as the office keeps it: one line, trimmed, no control characters;
 *  null when nothing is left of it, or too much */
export function cleanLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_LINE) return null;
  return text;
}

/* an address in a line: a scheme, a www, or a name with a known ending —
   caught whatever the case, and even with the dots spaced or spelt out */
const LINK = /\b(?:https?:\/\/|www\.)|(?:^|[^\p{L}\p{N}])[\p{L}\p{N}-]{2,}(?:\s*(?:\.|\(dot\)|\[dot\])\s*[\p{L}\p{N}-]{2,})*\s*(?:\.|\(dot\)|\[dot\])\s*(?:com|net|org|io|gg|fr|de|es|co|uk|eu|me|tv|app|dev|xyz|info|biz|link|ly|be|ch|ca|us|it|nl|site|online|club|gl)(?![\p{L}\p{N}])/iu;

/** the parlour carries no address: a line with a link in it is turned down */
export const hasLink = (text: string): boolean => LINK.test(text);

/** why a line was not carried */
export type SayError = 'refused' | 'not-found' | 'silenced' | 'too-long' | 'no-links' | 'verify-first';

/** a line reported to the direction, as its desk reads it */
export interface Report {
  /** the mark's id */
  id: string;
  at: number;
  reporter: Identity;
  author: Identity;
  line: { id: number; room: Room; text: string; at: number };
  /** until when the author is silenced, or 0 */
  silencedUntil: number;
}
