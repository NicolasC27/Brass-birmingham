import { createHash } from 'node:crypto';
import { replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { personaOf } from '@/game/data';
import { tallyGame } from '@/game/tally';
import type { Tally } from '@/game/tally';
import type { GameState, SetupPayload } from '@/game/types';
import type { HomeError } from '@/online/table';
import { MAX_SEATS, SEAT_COLORS } from '@/online/table';

/* ------------------------------------------------------------------ */
/* Games played at home.                                               */
/*                                                                     */
/* A game at home never passes through the house: it is dealt, played  */
/* and scored in the browser, against machines the player chose. What  */
/* the client sends when such a game ends is therefore not its result  */
/* but the game itself — a seed, a setup and the log — and the office  */
/* replays it with the very engine the table server uses, then reads   */
/* the standings off its own board. Nothing the client says about who  */
/* won is read, because nothing of the sort is sent.                   */
/*                                                                     */
/* Three logs are turned away: one the engine will not replay, one     */
/* that stops before the last card is played, and one where no single  */
/* chair was the sender's. What a replay cannot prove is merit — at    */
/* home the player picks the opposition and may deal again until the   */
/* board falls right — so a home game goes on the record and nowhere   */
/* else: no cote, no guineas, none of the season's figures.            */
/* ------------------------------------------------------------------ */

/** the longest log the office will replay — a game of four runs to a
 *  couple of hundred actions, so this is a guard, not a rule */
export const MAX_ACTIONS = 1000;
/** how long a name may be on a chair of a game played at home */
const MAX_SEAT_NAME = 20;

/** a game played at home, as the office has replayed it for itself */
export interface HomeGame {
  /** the code it is filed under: the same log is the same game */
  code: string;
  accountId: string;
  /** the chair the account played — the one human chair of the game */
  seat: number;
  seed: number;
  setup: SetupPayload;
  actions: GameAction[];
  /** the board as the office's own replay left it */
  state: GameState;
  tallies: Tally[];
}

/** the code a home game is filed under. It is the fingerprint of the
 *  account and of the game, so the same log sent twice — a flaky line,
 *  a second tab — is the same row, written once. */
export function homeCode(accountId: string, seed: number, setup: SetupPayload, actions: GameAction[]): string {
  const print = createHash('sha256').update(JSON.stringify([accountId, seed, setup, actions])).digest('hex');
  return `h-${print.slice(0, 12)}`;
}

const one = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** the setup as the office will have it — never the client's object.
 *  Only what the deal turns on is read (how many chairs, which are
 *  machines, the house rules); the rest is trimmed to a printable size. */
function houseSetup(raw: unknown): SetupPayload | null {
  const it = raw as Partial<SetupPayload> | null;
  const seats = Array.isArray(it?.players) ? it.players : null;
  if (!seats || seats.length < 2 || seats.length > MAX_SEATS) return null;
  if (!seats.every((p) => p && typeof p.name === 'string' && (p.type === 'human' || p.type === 'bot'))) return null;
  const o = (it?.options ?? {}) as Partial<SetupPayload['options']>;
  const minutes = o.timerMinutes;
  return {
    players: seats.map((p) => {
      const persona = personaOf(p.persona);
      return { name: p.name.trim().slice(0, MAX_SEAT_NAME) || 'Joueur', color: one(p.color, SEAT_COLORS, 'brass'), type: p.type, ...(persona ? { persona } : {}) };
    }),
    options: {
      eraLength: one(o.eraLength, ['short', 'standard'] as const, 'standard'),
      marketTemper: one(o.marketTemper, ['calm', 'standard', 'volatile'] as const, 'standard'),
      fidelity: one(o.fidelity, ['core', 'approx'] as const, 'core'),
      assist: !!o.assist,
      timerMinutes: typeof minutes === 'number' && minutes > 0 ? Math.min(180, Math.round(minutes)) : null,
    },
  };
}

/** the log as a list of actions, or null when it is not one */
function houseLog(raw: unknown): GameAction[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ACTIONS) return null;
  return raw.every((a) => !!a && typeof a === 'object' && typeof (a as GameAction).kind === 'string') ? (raw as GameAction[]) : null;
}

/** the chairs of a played-out game that were not a machine's. A chair
 *  handed over mid-game is the human's still: the log says when it went. */
const humanSeats = (s: GameState): number[] => s.players.map((_, i) => i).filter((i) => !s.players[i].isBot || !!s.players[i].resigned);

/** replay what the client sent and, when it holds up, hand back the game
 *  the office is prepared to put on `accountId`'s record. */
export function readHomeGame(accountId: string, sent: { seed: unknown; setup: unknown; actions: unknown }): HomeGame | { error: HomeError } {
  const seed = sent.seed;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return { error: 'malformed' };
  const setup = houseSetup(sent.setup);
  const actions = houseLog(sent.actions);
  if (!setup || !actions) return { error: 'malformed' };
  let state: GameState;
  try {
    state = replay(setup, seed, actions);
  } catch {
    /* an action the engine refuses: the log and the seed do not describe
       one another, whatever the sender believes they played */
    return { error: 'no-replay' };
  }
  if (state.phase !== 'game-over') return { error: 'unfinished' };
  /* one human chair, and it is the sender's. A hotseat played out by two
     people on one keyboard has no chair the office can call theirs, and a
     table of machines alone has none at all. */
  const seats = humanSeats(state);
  if (seats.length !== 1) return { error: 'not-seated' };
  return { code: homeCode(accountId, seed, setup, actions), accountId, seat: seats[0], seed, setup, actions, state, tallies: tallyGame(setup, seed, actions) };
}
