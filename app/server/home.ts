import { actorOf, applyAction, replay, setupOf, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { tallyGame } from '@/game/tally';
import type { GameState, SetupPayload } from '@/game/types';
import type { PlayerColor } from '@/components/setup/constants';
import type { HomeSave, HomeTable } from '@/online/table';
import type { Brief, Store } from './store';

/* ------------------------------------------------------------------ */
/* The games played at home.                                           */
/*                                                                     */
/* A person against the machines, on their own screen — and all the    */
/* same a game of the house: the office deals it a code, keeps its log */
/* and, above all, reads every move with the engine before writing it  */
/* down. The client drives the machines; the office does not judge how */
/* well a machine played, only that the move was legal. What it        */
/* promises of a game at home is what it promises of a table: the log  */
/* replays.                                                            */
/*                                                                     */
/* A game being played is held in memory, replayed from its log when   */
/* it is asked for again and dropped after a long silence — the same   */
/* bargain the hall makes for its tables, without the seats, the       */
/* candle or the pauses.                                               */
/* ------------------------------------------------------------------ */

/** a game at home let go after this long without a move */
const IDLE_MS = 60 * 60 * 1000;

/** a game at home the office is following */
interface Held {
  ownerId: string;
  setup: SetupPayload;
  seed: number;
  state: GameState;
  /** when it last moved */
  at: number;
}

/** a move turned down: the refusal as a key the tongues can say, and for a
 *  move out of step, where the office's log stands */
export type Refusal = { ok: false; error: string; stands?: number };
export type Accepted = { ok: true; over: boolean };

/** the line of the register a position leaves behind */
export function briefOf(state: GameState): Brief {
  return {
    era: state.era,
    round: state.round,
    /* a chair a machine plays out for someone who left is still their chair */
    seats: state.players.map((p) => ({ name: p.name, color: p.color as PlayerColor, kind: p.isBot && !p.resigned ? 'bot' : 'human' })),
  };
}

export class Home {
  private held = new Map<string, Held>();
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /** this account's register, the last touched first */
  list(ownerId: string): HomeTable[] {
    return this.store.homeGames(ownerId);
  }

  /** one game whole, for a browser that has just arrived */
  save(ownerId: string, code: string): HomeSave | null {
    return this.store.homeSave(ownerId, code);
  }

  /** a new game at home: dealt here, so its code is the office's to give */
  deal(ownerId: string, name: string, asked: SetupPayload, seed: number): HomeTable {
    /* the deal names the edition it is played under, whatever the browser
       sent: one this engine plays, today's when it named none */
    const setup = withEdition(asked);
    const state = newGame(setup, seed);
    const line = this.store.openHomeGame(ownerId, name, seed, setup, briefOf(state));
    this.held.set(line.code, { ownerId, setup, seed, state, at: Date.now() });
    return line;
  }

  /** one move proposed: read by the engine, then written — or refused, and
   *  nothing is written at all */
  act(ownerId: string, code: string, idx: number, action: GameAction): Accepted | Refusal {
    const g = this.hold(ownerId, code);
    if (!g) return { ok: false, error: 'no-such-game' };
    if (g.state.phase === 'game-over') return { ok: false, error: 'the game is over' };
    /* the log is a line, not a heap: a move out of step means the two sides
       have drifted, and the browser must read the game back */
    if (idx !== g.state.actions.length) return { ok: false, error: 'out-of-step', stands: g.state.actions.length };
    const r = applyAction(g.state, actorOf(g.state, action), action);
    if (!r.state) return { ok: false, error: r.error ?? 'the engine refused the action' };
    g.state = r.state;
    g.at = Date.now();
    this.store.appendHomeMove(ownerId, code, idx, action, briefOf(r.state));
    const over = r.state.phase === 'game-over';
    /* the standings are the office's own reading of its own log — the browser
       is never asked what it scored */
    if (over) this.store.finishHomeGame(ownerId, code, r.state, tallyGame(setupOf(r.state), g.seed, r.state.actions));
    return { ok: true, over };
  }

  /** a move taken back, and the log cut there */
  undo(ownerId: string, code: string, at: number): Accepted | Refusal {
    const g = this.hold(ownerId, code);
    if (!g) return { ok: false, error: 'no-such-game' };
    if (at < 0 || at >= g.state.actions.length) return { ok: false, error: 'nothing to take back there' };
    let state: GameState;
    try {
      /* the edition the log was read under when the game was taken up, not
         the bare deal of a game dealt before editions were named */
      state = replay(setupOf(g.state), g.seed, g.state.actions.slice(0, at));
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
    g.state = state;
    g.at = Date.now();
    this.store.dropHomeMoves(ownerId, code, at, briefOf(state));
    return { ok: true, over: false };
  }

  /** a game put away for good */
  forget(ownerId: string, code: string): void {
    if (!this.store.homeSave(ownerId, code)) return;
    this.held.delete(code);
    this.store.forgetHomeGame(ownerId, code);
  }

  /** the game in hand, replayed from its log if it is not held any more */
  private hold(ownerId: string, code: string): Held | null {
    const already = this.held.get(code);
    if (already) return already.ownerId === ownerId ? already : null;
    const save = this.store.homeSave(ownerId, code);
    if (!save) return null;
    let state: GameState;
    try {
      state = replay(save.setup, save.seed, save.actions);
    } catch (e) {
      /* a log the engine no longer accepts: the game stands on the record,
         but it is played no further */
      console.error(`game at home ${code}: the log would not replay:`, (e as Error).message);
      return null;
    }
    const held: Held = { ownerId, setup: save.setup, seed: save.seed, state, at: Date.now() };
    this.held.set(code, held);
    return held;
  }

  /** the games nobody has moved in a long while, let go of — the log keeps
   *  them, and they come back replayed */
  sweep(now = Date.now()): void {
    for (const [code, g] of this.held) if (now - g.at > IDLE_MS) this.held.delete(code);
  }
}
