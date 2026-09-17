import type { PlayerColor } from '@/components/setup/constants';
import { eraRounds } from '@/game/data';
import type { Era } from '@/game/types';
import { MAX_SEATS, type PublicTable, type TableSummary } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The office's register of tables, in the shape the club's cards      */
/* read: seats padded to four, the state from the status, the mode     */
/* from the ranked flag. Region and line are not known table by table, */
/* so the card does not show them.                                     */
/* ------------------------------------------------------------------ */

export type TableMode = 'normal' | 'ranked';
export type TableState = 'open' | 'live' | 'full';

export interface CardSeat {
  name: string;
  color: PlayerColor;
  kind: 'human' | 'bot';
  /** unknown from the register: the office does not publish readiness */
  ready?: boolean;
  host?: boolean;
  you?: boolean;
}

export interface CardTable {
  code: string;
  name: string;
  mode: TableMode;
  hostName: string;
  /** null = a free seat */
  seats: (CardSeat | null)[];
  state: TableState;
  era?: Era;
  /** the round in play, and how many the era holds */
  round?: number;
  rounds?: number;
  /** the seat to act, while in play */
  toAct?: CardSeat;
  /** sockets at the table right now, the seated ones included */
  watchers: number;
  /** I sit at this table */
  mine: boolean;
  /** it is my move */
  myTurn: boolean;
  updatedAt: number;
}

export function toCard(x: PublicTable, mine?: TableSummary, myName?: string): CardTable {
  const seats: (CardSeat | null)[] = x.seats.map((s) => ({
    name: s.name,
    color: s.color,
    kind: s.kind,
    host: s.kind === 'human' && s.name === x.hostName,
    you: !!myName && s.kind === 'human' && s.name === myName,
  }));
  const playing = x.status === 'playing';
  /* an open table shows its free chairs; a game in play has none */
  while (!playing && seats.length < MAX_SEATS) seats.push(null);
  const toAct = playing && x.current !== undefined ? (seats[x.current] ?? undefined) : undefined;
  return {
    code: x.code,
    name: x.name,
    mode: x.ranked ? 'ranked' : 'normal',
    hostName: x.hostName,
    seats,
    state: playing ? 'live' : x.seats.length >= MAX_SEATS ? 'full' : 'open',
    era: playing ? x.era : undefined,
    round: playing ? x.round : undefined,
    rounds: playing ? eraRounds(x.seats.length) : undefined,
    toAct,
    watchers: x.watchers,
    mine: !!mine,
    myTurn: !!mine?.myTurn,
    updatedAt: x.updatedAt,
  };
}

/** the register as cards, my tables first, then the freshest */
export function toCards(tables: PublicTable[], mine: TableSummary[] = [], myName?: string): CardTable[] {
  const byCode = new Map(mine.map((x) => [x.code, x]));
  return tables
    .map((x) => toCard(x, byCode.get(x.code), myName))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.updatedAt - a.updatedAt);
}
