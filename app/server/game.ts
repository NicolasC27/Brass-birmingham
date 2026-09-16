import { applyAction, botAction, canUndoNow, fallbackAction, humanActionIndices, replay, undoLastHuman } from '@/game/actions';
import type { GameAction, UndoMark } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { candleMinutes, newGame } from '@/game/engine';
import { tallyGame } from '@/game/tally';
import type { Tally } from '@/game/tally';
import type { GameState, SetupPayload } from '@/game/types';
import type { GameView, Pause, Rollback } from '@/online/protocol';
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
/** a personal break: five minutes, three times a game */
export const BREAK_MS = 5 * MINUTE;
export const BREAKS_PER_GAME = 3;
/** how often one may take an action back within one turn */
export const UNDOS_PER_TURN = 2;

/** where the moves are written down as they are accepted */
export interface Journal {
  append(idx: number, action: GameAction): void;
  drop(idx: number): void;
  /** the game is over: the state as it ended and what each seat did, for the record */
  finish(state: GameState, tallies: Tally[]): void;
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
  /** the table's host: the one who may propose a rollback */
  hostId?: string;
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
  /** what was left of the candle when the table stopped */
  private frozen: number | null = null;
  /** the actions taken back this turn */
  private undos = 0;
  private closed = false;
  /** the host id, for the rollback — the first human seat when unknown */
  readonly hostId: string | null;
  pause: Pause | null = null;
  breaks: number[];
  rollback: Rollback | null = null;
  private breakTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(o: TableGameOptions) {
    this.code = o.code;
    this.seatIds = o.seatIds;
    this.setup = o.setup;
    this.emit = o.emit;
    this.pace = o.pace ?? DEFAULT_PACE;
    this.journal = o.journal ?? null;
    this.seed = o.seed ?? Math.floor(Math.random() * 1e9);
    this.hostId = o.hostId ?? null;
    this.breaks = o.setup.players.map(() => 0);
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
    if (this.frozen !== null) return this.frozen;
    return this.burnsOut === null ? null : Math.max(0, this.burnsOut - Date.now());
  }

  /** the whole table stands still: a pause everyone agreed to */
  get stopped(): boolean {
    return this.pause?.kind === 'table' && this.pause.held;
  }

  private get humans(): number[] {
    return this.state.players.map((_, i) => i).filter((i) => !this.state.players[i].isBot);
  }

  /** stop the candle where it is */
  private freeze(): void {
    if (this.burnsOut !== null && this.frozen === null) this.frozen = Math.max(0, this.burnsOut - Date.now());
    this.dispose();
    this.burnsOut = null;
  }

  /** light the candle again where it stopped, or whatever the table owes */
  private thaw(): void {
    const left = this.frozen;
    this.frozen = null;
    if (left !== null && this.state.phase === 'action' && !this.state.players[this.state.current].isBot) {
      this.burnsOut = Date.now() + left;
      this.timer = setTimeout(() => this.burnOut(), left);
      return;
    }
    this.schedule();
  }

  /* ------------------------------ pauses ----------------------------- */

  /** a pause of the whole table: proposed, agreed, refused, lifted */
  pauseTable(playerId: string, want: 'propose' | 'agree' | 'refuse' | 'resume'): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (this.state.phase !== 'action') return 'The game is not in play';
    const p = this.pause;
    if (want === 'resume') {
      if (!p || p.kind !== 'table') return 'The table is not paused';
      this.pause = null;
      this.thaw();
      this.emit();
      return null;
    }
    if (want === 'refuse') {
      if (!p || p.kind !== 'table' || p.held) return 'No pause is proposed';
      this.pause = null;
      this.emit();
      return null;
    }
    if (want === 'propose') {
      if (p) return p.kind === 'break' ? 'A seat is on a break' : 'A pause is already proposed';
      this.pause = { kind: 'table', by: seat, since: Date.now(), votes: [seat], held: false };
    } else {
      if (!p || p.kind !== 'table' || p.held) return 'No pause is proposed';
      if (!p.votes.includes(seat)) p.votes.push(seat);
    }
    const t = this.pause;
    if (t && t.kind === 'table' && this.humans.every((i) => t.votes.includes(i))) {
      t.held = true;
      this.freeze();
    }
    this.emit();
    return null;
  }

  /** one seat's own break: their candle waits, five minutes at most */
  breakSeat(playerId: string, on: boolean): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (this.state.phase !== 'action') return 'The game is not in play';
    if (!on) {
      if (this.pause?.kind !== 'break' || this.pause.by !== seat) return 'You are not on a break';
      this.endBreak();
      return null;
    }
    if (this.pause) return this.pause.kind === 'break' ? 'A seat is already on a break' : 'The table is paused';
    if (this.breaks[seat] >= BREAKS_PER_GAME) return 'No break left';
    this.breaks[seat] += 1;
    const until = Date.now() + BREAK_MS * ((this.pace.minute ?? MINUTE) / MINUTE);
    this.pause = { kind: 'break', by: seat, since: Date.now(), until };
    /* the breaker's own candle waits; anyone else's keeps burning */
    if (this.state.current === seat) this.freeze();
    this.breakTimer = setTimeout(() => this.endBreak(), until - Date.now());
    this.emit();
    return null;
  }

  private endBreak(): void {
    if (this.breakTimer) clearTimeout(this.breakTimer);
    this.breakTimer = null;
    if (this.pause?.kind !== 'break') return;
    this.pause = null;
    this.thaw();
    this.emit();
  }

  /* ----------------------------- rollback ---------------------------- */

  /** the host proposes to return the table to before action `to`; every human must agree */
  rollbackTable(playerId: string, want: 'propose' | 'agree' | 'refuse', to?: number): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (this.state.phase !== 'action') return 'The game is not in play';
    if (want === 'propose') {
      if (this.hostId !== null && playerId !== this.hostId) return 'Only the host may roll the table back';
      if (this.rollback) return 'A rollback is already proposed';
      if (to === undefined || !Number.isInteger(to) || to < 0 || to >= this.state.actions.length) return 'No such moment in the log';
      this.rollback = { to, by: seat, votes: [seat] };
    } else if (want === 'refuse') {
      if (!this.rollback) return 'No rollback is proposed';
      this.rollback = null;
    } else {
      if (!this.rollback) return 'No rollback is proposed';
      if (!this.rollback.votes.includes(seat)) this.rollback.votes.push(seat);
    }
    const r = this.rollback;
    if (r && this.humans.every((i) => r.votes.includes(i))) {
      this.rollback = null;
      this.journal?.drop(r.to);
      const actions = this.state.actions.slice(0, r.to);
      this.state = replay(this.setup, this.seed, actions);
      this.marks = humanActionIndices(this.setup, this.seed, actions);
      this.frozen = null;
      this.undos = 0;
      this.schedule();
    }
    this.emit();
    return null;
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
    if (action.kind === 'begin-rail') {
      /* the ceremony is closed by the seat to act, or by the table's own clock */
      if (this.state.phase !== 'scoring-canal') return 'The canal era is not being scored';
      if (this.stopped) return 'The table is paused';
      if (seat !== this.state.current) return 'Not your turn';
      return this.commit(seat, action);
    }
    if (this.state.phase !== 'action') return 'The game is not in play';
    if (this.stopped) return 'The table is paused';
    if (seat !== this.state.current) return 'Not your turn';
    if (this.state.players[seat].isBot) return 'That seat plays itself';
    return this.commit(seat, action);
  }

  /** take back the action this seat has just played */
  undo(playerId: string): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
    if (!this.mayUndo(seat)) return 'Too late — the turn has moved on';
    if (this.undos >= UNDOS_PER_TURN) return 'No more taking back this turn';
    const back = undoLastHuman(this.state, this.marks);
    if (!back) return 'Nothing to take back';
    /* the candle burns on: taking back a move does not buy the time again */
    const left = this.burnsOut === null ? null : this.msLeft;
    this.journal?.drop(this.marks[this.marks.length - 1].at);
    this.state = back;
    this.marks = this.marks.slice(0, -1);
    this.undos += 1;
    this.emit();
    this.schedule();
    if (left !== null && this.burnsOut !== null) {
      this.dispose();
      this.burnsOut = Date.now() + left;
      this.timer = setTimeout(() => this.burnOut(), left);
    }
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
      frozen: this.frozen !== null,
      host: this.hostId ? this.seatOf(this.hostId) : (this.humans[0] ?? -1),
      pause: this.pause,
      breaks: this.breaks,
      rollback: this.rollback,
      /* over: the log is nobody's secret any more, and the replay needs it */
      ...(this.over ? { archive: { seed: this.seed, setup: this.setup, actions: this.state.actions } } : {}),
    };
  }

  /** stop the clock (the table is being closed) */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** the table is closed for good: every clock, the break's too */
  close(): void {
    this.dispose();
    if (this.breakTimer) clearTimeout(this.breakTimer);
    this.breakTimer = null;
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
    if (this.state.current !== before.current || this.state.phase !== before.phase) this.undos = 0;
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
    /* a paused table owes nothing until it is lifted */
    if (this.stopped) return;
    const s = this.state;
    if (s.phase === 'scoring-canal') {
      this.timer = setTimeout(() => {
        try {
          this.commit(s.current, { kind: 'begin-rail' });
        } catch (e) {
          console.error(`table ${this.code}: the ceremony would not close:`, e);
        }
      }, this.pace.ceremony);
      return;
    }
    if (s.phase !== 'action') {
      if (!this.closed) {
        this.closed = true;
        try {
          this.journal?.finish(s, tallyGame(this.setup, this.seed, s.actions));
        } catch (e) {
          console.error(`table ${this.code}: the record of the game could not be written:`, e);
        }
      }
      return;
    }
    if (s.players[s.current].isBot) {
      this.timer = setTimeout(() => this.playBot(), this.pace.bot);
      return;
    }
    /* a seat on a break does not have its candle lit until it is back */
    if (this.pause?.kind === 'break' && this.pause.by === s.current) return;
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
    try {
      const wanted = botAction(chooseBotMove(s, seat));
      /* nothing playable, or a move the engine turns down: scout, else pass */
      if (!wanted || this.commit(seat, wanted) !== null) this.commit(seat, fallbackAction(s, seat));
    } catch (e) {
      this.recover(s, seat, 'the bot', e);
    }
  }

  private burnOut(): void {
    const s = this.state;
    if (s.phase !== 'action' || s.players[s.current].isBot) return;
    try {
      this.commit(s.current, { kind: 'pass', reason: `${s.players[s.current].name}'s candle burned out.` }, false);
    } catch (e) {
      this.recover(s, s.current, 'the candle', e);
    }
  }

  /** a clock's turn threw: log it and put the turn anyway, so that the
   *  table does not stand still on an error nobody is there to see */
  private recover(before: GameState, seat: number, who: string, e: unknown): void {
    console.error(`table ${this.code}: ${who} at seat ${seat} failed:`, e);
    try {
      /* the action did land and only its aftermath failed: just move on */
      if (this.state !== before) {
        this.schedule();
        return;
      }
      if (this.commit(seat, fallbackAction(before, seat), false) !== null) this.commit(seat, { kind: 'pass', reason: 'The table put the turn.' }, false);
    } catch (again) {
      console.error(`table ${this.code}: still stuck after ${who} failed:`, again);
    }
  }
}
