import type { PlayerColor, SetupOptions } from '@/components/setup/constants';
import type { GameAction } from '@/game/actions';
import type { GameState, SetupPayload } from '@/game/types';
import type { AuthError, Identity, LobbyError, Table } from './table';

/* ------------------------------------------------------------------ */
/* The wire — what a table and its players say to each other.          */
/*                                                                     */
/* Every message is one JSON frame with a `t` tag. The client only     */
/* ever proposes (an action, a rewritten table); the server alone      */
/* decides, keeps the log and hands back what each seat is allowed to  */
/* see. Requests that expect an answer carry a `rid` the reply echoes. */
/*                                                                     */
/* A socket says nothing but signup, signin and auth until it holds a  */
/* session: a seat belongs to an account, not to a browser tab.        */
/* ------------------------------------------------------------------ */

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
  /** the game is over: the whole log opens up, and the replay with it */
  archive?: { seed: number; setup: SetupPayload; actions: GameAction[] };
}

export type ClientMessage =
  /** open an account, and be signed in with it */
  | { t: 'signup'; rid: number; name: string; password: string }
  | { t: 'signin'; rid: number; name: string; password: string }
  /** first frame of a socket that already holds a session */
  | { t: 'auth'; rid?: number; token: string }
  /** forget this session for good */
  | { t: 'signout' }
  | { t: 'create'; rid: number; name: string; options: SetupOptions; color?: PlayerColor }
  | { t: 'join'; rid: number; code: string; color?: PlayerColor }
  /** follow a table without taking a seat (a link, a reconnection) */
  | { t: 'watch'; code: string }
  | { t: 'leave'; code: string }
  /** the table as the author would have it — the server keeps what it may */
  | { t: 'table'; code: string; table: Table }
  | { t: 'act'; code: string; action: GameAction }
  | { t: 'undo'; code: string }
  | { t: 'ping' };

export type ServerMessage =
  /** the socket now speaks for this account */
  | { t: 'welcome'; rid?: number; me: Identity }
  /** a fresh session: the token is the client's to keep */
  | { t: 'session'; rid: number; token: string; me: Identity }
  /** the table changed (null = it is gone) */
  | { t: 'table'; code: string; table: Table | null }
  /** the answer to a create or a join */
  | { t: 'seated'; rid: number; table: Table }
  | { t: 'refused'; rid?: number; error: AuthError | LobbyError | string }
  | { t: 'game'; view: GameView }
  /** the engine turned an action down — its own words, for the shake */
  | { t: 'rejected'; code: string; error: string }
  | { t: 'pong' };

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
