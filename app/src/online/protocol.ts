import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';
import type { AuthError, Desk, Identity, Leaderboard, LobbyError, Me, QueueState, Table, TableQuery, TablesPage } from './table';

/* ------------------------------------------------------------------ */
/* The wire — what a table and its players say to each other.          */
/*                                                                     */
/* Every message is one JSON frame with a `t` tag. The client only     */
/* ever proposes (an action, a rewritten table); the server alone      */
/* decides, keeps the log and hands back what each seat is allowed to  */
/* see. Requests that expect an answer carry a `rid` the reply echoes. */
/*                                                                     */
/* A socket says nothing but signup, signin and auth until it holds a  */
/* session: a seat belongs to an account, not to a browser tab. An     */
/* account is opened with an address, and the tables open once the     */
/* address has answered its letter.                                    */
/* ------------------------------------------------------------------ */

/** the table stopped: everyone agreed to a pause, or one seat took a break */
export type Pause =
  | { kind: 'table'; by: number; since: number; /** seats that agreed — it holds once every human has */ votes: number[]; held: boolean }
  | { kind: 'break'; by: number; since: number; /** when the break ends on its own */ until: number };

/** the host proposes to return the table to before action `to`; it happens once every human agrees */
export interface Rollback {
  to: number;
  by: number;
  votes: number[];
}

/** the game as one seat may see it — hands of others and deck redacted */
export interface GameView {
  code: string;
  /** the seat this view belongs to, or -1 for a spectator */
  seat: number;
  state: GameState;
  /** may this seat take back the action it has just played? */
  canUndo: boolean;
  /** what is left of the turn's candle when this frame was sent, in ms
   *  (null when the table plays without a timer) — the client anchors it
   *  to its own clock, so the two need not agree on the time of day */
  msLeft: number | null;
  /** the candle is frozen: a pause holds */
  frozen: boolean;
  /** the host's seat (-1 when the host has no seat) — the one who may roll the table back */
  host: number;
  pause: Pause | null;
  /** breaks taken so far, per seat (three at most) */
  breaks: number[];
  rollback: Rollback | null;
  /** the game is over: the whole log opens up, and the replay with it */
  archive?: { seed: number; setup: SetupPayload; actions: GameAction[] };
}

export type ClientMessage =
  /** open an account, and be signed in with it — the letter leaves at once */
  | { t: 'signup'; rid: number; name: string; email: string; password: string; accept: boolean }
  | { t: 'signin'; rid: number; name: string; password: string }
  /** first frame of a socket that already holds a session */
  | { t: 'auth'; rid?: number; token: string }
  /** forget this session for good */
  | { t: 'signout' }
  /** the letter's link: this address is mine */
  | { t: 'verify'; rid: number; token: string }
  /** the letter never came: send it again (or to a new address) */
  | { t: 'resend'; rid: number; email?: string }
  /** a password forgotten: a letter to the address on the account */
  | { t: 'forgot'; rid: number; email: string }
  | { t: 'reset'; rid: number; token: string; password: string }
  /** the profile, as its owner would have it */
  | { t: 'profile'; rid: number; motto?: string; favoriteColor?: PlayerColor | null }
  | { t: 'password'; rid: number; current: string; next: string }
  /** everything the register holds under my name, to take away */
  | { t: 'export'; rid: number }
  /** close my account and erase what identifies me; the password says it is me */
  | { t: 'close'; rid: number; password: string }
  /** an idea or a bug for the house, from any page */
  | { t: 'feedback'; rid: number; page: string; kind: 'idea' | 'bug'; text: string }
  /** the desk: my tables, my invitations, my past games */
  | { t: 'desk'; rid?: number }
  /** ask a player by name to be friends — or accept their asking */
  | { t: 'friend'; rid: number; name: string }
  /** end a friendship, or decline one on its way */
  | { t: 'unfriend'; rid: number; id: string }
  /** ask a player by name to a table I sit at */
  | { t: 'invite'; rid: number; code: string; name: string }
  /** answer an invitation — accepting takes the chair */
  | { t: 'answer'; rid: number; id: string; accept: boolean }
  | { t: 'create'; rid: number; options: SetupOptions; color?: PlayerColor }
  | { t: 'join'; rid: number; code: string; color?: PlayerColor }
  /** follow a table without taking a seat (a link, a reconnection) */
  | { t: 'watch'; code: string }
  | { t: 'leave'; code: string }
  /** the table as the author would have it — the server keeps what it may */
  | { t: 'table'; code: string; table: Table }
  | { t: 'act'; code: string; action: GameAction }
  | { t: 'undo'; code: string }
  /** a pause of the whole table: proposed, agreed, refused, or lifted */
  | { t: 'pause'; code: string; want: 'propose' | 'agree' | 'refuse' | 'resume' }
  /** my own break: five minutes, three times a game */
  | { t: 'break'; code: string; on: boolean }
  /** the host's rollback to before action `to`, and the answers to it */
  | { t: 'rollback'; code: string; want: 'propose' | 'agree' | 'refuse'; to?: number }
  /** a telegram to the table: one of the printed lines, nothing else */
  | { t: 'telegram'; code: string; key: string }
  /** look here: a town, a house or a route pointed at */
  | { t: 'mark'; code: string; key: string }
  /** the move my analysis is showing, for the table to follow; null: I stopped.
      `look` is where my camera sits on the map and `cursor` where my pointer
      is, both in world units, so the table sees what I am looking at */
  | { t: 'review'; code: string; at: number | null; look?: { wx: number; wy: number; k: number }; cursor?: { wx: number; wy: number } | null; seat?: number; line?: { from: number; moves: GameAction[] } | null }
  /** the register of tables being played, for the hall */
  | { t: 'tables'; rid: number; query?: TableQuery }
  | { t: 'seatme'; rid: number; color?: PlayerColor }
  | { t: 'leaderboard'; rid: number }
  /** stand in (or leave) the quick or the ranked queue */
  | { t: 'queue'; mode: 'quick' | 'ranked'; on: boolean }
  /** buy an item at the counter with the guineas earned at the tables */
  | { t: 'buy'; rid: number; item: string }
  | { t: 'ping' };

export type ServerMessage =
  /** the socket now speaks for this account */
  | { t: 'welcome'; rid?: number; me: Me }
  /** a fresh session: the token is the client's to keep */
  | { t: 'session'; rid: number; token: string; me: Me }
  /** the account changed (verified, a new motto…) */
  | { t: 'me'; rid?: number; me: Me }
  /** the answer to a request that has nothing else to say */
  | { t: 'done'; rid: number }
  /** the member's data, as one document */
  | { t: 'export'; rid: number; data: Record<string, unknown> }
  /** the desk, whenever it changes */
  | { t: 'desk'; rid?: number; desk: Desk }
  /** the table changed (null = it is gone) */
  | { t: 'table'; code: string; table: Table | null }
  /** the answer to a create or a join */
  | { t: 'seated'; rid: number; table: Table }
  | { t: 'refused'; rid?: number; error: AuthError | LobbyError | string }
  | { t: 'game'; view: GameView }
  /** the engine turned an action down — its own words, for the shake */
  | { t: 'rejected'; code: string; error: string }
  /** a seat's telegram, carried to everyone at the table */
  | { t: 'telegram'; code: string; from: number; key: string; at: number }
  | { t: 'mark'; code: string; from: number; key: string; at: number }
  /** a seat is reading the game again, and showing where it stands */
  | { t: 'review'; code: string; from: number; at: number | null; look?: { wx: number; wy: number; k: number }; cursor?: { wx: number; wy: number } | null; seat?: number; line?: { from: number; moves: GameAction[] } | null }
  /** the office frowns at a shower of marks: a warning, then silence for the game */
  | { t: 'warned'; code: string; about: 'marks'; muted: boolean }
  /** every seat's line to the office, in ms (null for a machine or an empty chair), now and then */
  | { t: 'pulse'; code: string; latency: (number | null)[] }
  | { t: 'tables'; rid?: number; page: TablesPage }
  | { t: 'leaderboard'; rid: number; board: Leaderboard }
  /** the queue moved (null: I left it, or the office sat me — a `seated` follows) */
  | { t: 'queue'; state: QueueState | null }
  | { t: 'pong' };

/** a name or an address: the office does not say which was wrong */
export type { Identity };

export const encode = (m: ServerMessage | ClientMessage): string => JSON.stringify(m);

/** parse a frame; null when it is not a message of ours */
export function decode<T>(raw: string): T | null {
  try {
    const m = JSON.parse(raw) as T & { t?: unknown };
    return typeof m?.t === 'string' ? m : null;
  } catch {
    return null;
  }
}
