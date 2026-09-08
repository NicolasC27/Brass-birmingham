import { applyAction, botAction, canUndoNow, fallbackAction, humanActionIndices, replay, undoLastHuman } from '@/game/actions';
import type { GameAction, UndoMark } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { candleMinutes, newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import type { GameView } from '@/online/protocol';
import { viewFor } from './view';

/* ------------------------------------------------------------------ */
/* A table in play.                                                    */
/*                                                                     */
/* The seed and the log live here and nowhere else. Every action —     */
/* a player's or a bot's — goes through applyAction, the one door the  */
/* engine opens; whatever it refuses simply never happened. The bots   */
/* are played by the table itself, after a pause long enough to watch, */
/* the canal ceremony closes on its own so an absent player cannot     */
/* hold the era open, and the turn candle burns here too: a seat that  */
/* lets it go out passes, whether or not anyone is at the screen.      */
/*                                                                     */
/* Nothing is kept but the seed and the moves: handed a log, the table */
/* replays it and is exactly where it was before the server stopped.   */
/* ------------------------------------------------------------------ */

export interface Pace {
  /** how long a bot seems to think, in ms */
  bot: number;
  /** how long the canal ceremony stays on the table before the rail era */
  ceremony: number;
  /** how long a minute of the turn candle lasts, in ms — a minute, unless
   *  a test would rather not wait one */
  minute?: number;
}

export const DEFAULT_PACE: Pace = { bot: 1200, ceremony: 7000 };
const MINUTE = 60_000;

/** where the moves are written down as they are accepted */
export interface Journal {
  append(idx: number, action: GameAction): void;
  drop(idx: number): void;
  /** the game is over: the state as it ended, for the record */
  finish(state: GameState): void;
}

export interface TableGameOptions {
  code: string;
  /** the account id of each seat, in player order */
  seatIds: string[];
  setup: SetupPayload;
  seed?: number;
  /** a log to sit back down in front of (a server that has restarted) */
  actions?: GameAction[];
  pace?: Pace;
  /** the state moved on: hand every watcher their view again */
  emit: () => void;
  journal?: Journal;
}

export class TableGame {
  readonly code: string;
  readonly seatIds: string[];
  readonly seed: number;
  readonly setup: SetupPayload;
  state: GameState;
  private readonly emit: () => void;
  private readonly pace: Pace;
  private readonly journal: Journal | null;
  /** the actions taken by humans — the undo marks, kept as the store does */
  private marks: UndoMark[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** when this turn's candle goes out (epoch ms), null when none burns */
  private burnsOut: number | null = null;
  private closed = false;

  constructor(o: TableGameOptions) {
    this.code = o.code;
    this.seatIds = o.seatIds;
    this.setup = o.setup;
    this.emit = o.emit;
    this.pace = o.pace ?? DEFAULT_PACE;
    this.journal = o.journal ?? null;
    this.seed = o.seed ?? Math.floor(Math.random() * 1e9);
    if (o.actions?.length) {
      this.state = replay(o.setup, this.seed, o.actions);
      this.marks = humanActionIndices(o.setup, this.seed, o.actions);
    } else {
      this.state = newGame(o.setup, this.seed);
    }
    this.schedule();
  }

  /** the player index of an account id, or -1 for anyone else */
  seatOf(playerId: string): number {
    return this.seatIds.indexOf(playerId);
  }

  get over(): boolean {
    return this.state.phase === 'game-over';
  }

  /** what is left of this turn's candle, in ms (null when none burns) */
  get msLeft(): number | null {
    return this.burnsOut === null ? null : Math.max(0, this.burnsOut - Date.now());
  }

  /** play an action for a seat; null when it was accepted, else the reason */
  act(playerId: string, action: GameAction): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (action.kind === 'concede') {
      /* a vote is cast on anyone's turn, in one's own name, and leaves the
         candle burning: it is nobody's to take back */
      if (this.state.phase !== 'action') return 'The game is not in play';
      if (action.player !== seat) return 'A vote is cast in one\'s own name';
      return this.commit(seat, action, false, true);
    }
    if (action.kind !== 'begin-rail') {
      if (this.state.phase !== 'action') return 'The game is not in play';
      if (seat !== this.state.current) return 'Not your turn';
      if (this.state.players[seat].isBot) return 'That seat plays itself';
    }
    return this.commit(seat, action);
  }

  /** take back the action this seat has just played */
  undo(playerId: string): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (!this.mayUndo(seat)) return 'Too late — the turn has moved on';
    const back = undoLastHuman(this.state, this.marks);
    if (!back) return 'Nothing to take back';
    this.journal?.drop(this.marks[this.marks.length - 1].at);
    this.state = back;
    this.marks = this.marks.slice(0, -1);
    this.emit();
    this.schedule();
    return null;
  }

  mayUndo(seat: number): boolean {
    const last = this.marks[this.marks.length - 1];
    return !!last && last.by === seat && canUndoNow(this.state, this.marks);
  }

  /** the game as one player sees it — a stranger gets the spectator's view */
  view(playerId: string): GameView {
    const seat = this.seatOf(playerId);
    return {
      code: this.code,
      seat,
      state: viewFor(this.state, seat),
      canUndo: seat >= 0 && this.mayUndo(seat),
      msLeft: this.msLeft,
      /* over: the log is nobody's secret any more, and the replay needs it */
      ...(this.over ? { archive: { seed: this.seed, setup: this.setup, actions: this.state.actions } } : {}),
    };
  }

  /** stop the clock (the table is being closed) */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** `marked` false: the action stands, but it is nobody's to take back —
   *  a pass the candle imposed must not be undone to buy another turn */
  private commit(seat: number, action: GameAction, marked = true, keepClock = false): string | null {
    const before = this.state;
    const r = applyAction(before, seat, action);
    if (!r.state) return r.error ?? 'The engine refused the action';
    const at = before.actions.length;
    if (marked && before.phase === 'action' && !before.players[before.current].isBot) this.marks.push({ at, by: before.current });
    this.state = r.state;
    this.journal?.append(at, action);
    this.emit();
    /* a vote must not re-light the candle — unless it just closed the game */
    if (!keepClock || this.state.phase !== 'action') this.schedule();
    return null;
  }

  /** whatever the table owes next: a bot's turn, the end of the ceremony,
   *  or the candle it lit for the player to act */
  private schedule(): void {
    this.dispose();
    this.burnsOut = null;
    const s = this.state;
    if (s.phase === 'scoring-canal') {
      this.timer = setTimeout(() => this.commit(s.current, { kind: 'begin-rail' }), this.pace.ceremony);
      return;
    }
    if (s.phase !== 'action') {
      if (!this.closed) {
        this.closed = true;
        this.journal?.finish(s);
      }
      return;
    }
    if (s.players[s.current].isBot) {
      this.timer = setTimeout(() => this.playBot(), this.pace.bot);
      return;
    }
    const minutes = candleMinutes(s, s.current);
    if (!minutes) return;
    const burn = minutes * (this.pace.minute ?? MINUTE);
    this.burnsOut = Date.now() + burn;
    this.timer = setTimeout(() => this.burnOut(), burn);
  }

  private playBot(): void {
    const s = this.state;
    if (s.phase !== 'action' || !s.players[s.current].isBot) return;
    const seat = s.current;
    const wanted = botAction(chooseBotMove(s, seat));
    /* nothing playable, or a move the engine turns down: scout, else pass */
    if (!wanted || this.commit(seat, wanted) !== null) this.commit(seat, fallbackAction(s, seat));
  }

  private burnOut(): void {
    const s = this.state;
    if (s.phase !== 'action' || s.players[s.current].isBot) return;
    this.commit(s.current, { kind: 'pass', reason: `${s.players[s.current].name}'s candle burned out.` }, false);
  }
}
