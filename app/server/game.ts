import { applyAction, botAction, canUndoNow, fallbackAction } from '@/game/actions';
import { undoLastHuman } from '@/game/actions';
import type { GameAction, UndoMark } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { newGame } from '@/game/engine';
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
/* and the canal ceremony closes on its own so an absent player cannot */
/* hold the era open.                                                  */
/* ------------------------------------------------------------------ */

export interface Pace {
  /** how long a bot seems to think, in ms */
  bot: number;
  /** how long the canal ceremony stays on the table before the rail era */
  ceremony: number;
}

export const DEFAULT_PACE: Pace = { bot: 1200, ceremony: 7000 };

export class TableGame {
  readonly code: string;
  /** the lobby id of each seat, in player order */
  readonly seatIds: string[];
  readonly seed: number;
  readonly setup: SetupPayload;
  state: GameState;
  private readonly emit: () => void;
  private readonly pace: Pace;
  /** the actions taken by humans — the undo marks, kept as the store does */
  private marks: UndoMark[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string, seatIds: string[], setup: SetupPayload, emit: () => void, pace: Pace = DEFAULT_PACE, seed = Math.floor(Math.random() * 1e9)) {
    this.code = code;
    this.seatIds = seatIds;
    this.emit = emit;
    this.pace = pace;
    this.seed = seed;
    this.setup = setup;
    this.state = newGame(setup, seed);
    this.schedule();
  }

  /** the player index of a lobby id, or -1 for anyone else */
  seatOf(playerId: string): number {
    return this.seatIds.indexOf(playerId);
  }

  get over(): boolean {
    return this.state.phase === 'game-over';
  }

  /** play an action for a seat; null when it was accepted, else the reason */
  act(playerId: string, action: GameAction): string | null {
    const seat = this.seatOf(playerId);
    if (seat < 0) return 'You are not seated at this table';
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
      /* over: the log is nobody's secret any more, and the replay needs it */
      ...(this.over ? { archive: { seed: this.seed, setup: this.setup, actions: this.state.actions } } : {}),
    };
  }

  /** stop the clock (the table is being closed) */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private commit(seat: number, action: GameAction): string | null {
    const before = this.state;
    const r = applyAction(before, seat, action);
    if (!r.state) return r.error ?? 'The engine refused the action';
    if (before.phase === 'action' && !before.players[before.current].isBot) this.marks.push({ at: before.actions.length, by: before.current });
    this.state = r.state;
    this.emit();
    this.schedule();
    return null;
  }

  /** whatever the table owes next: a bot's turn, or the end of the ceremony */
  private schedule(): void {
    this.dispose();
    const s = this.state;
    if (s.phase === 'scoring-canal') {
      this.timer = setTimeout(() => this.commit(s.current, { kind: 'begin-rail' }), this.pace.ceremony);
      return;
    }
    if (s.phase !== 'action' || !s.players[s.current].isBot) return;
    this.timer = setTimeout(() => this.playBot(), this.pace.bot);
  }

  private playBot(): void {
    const s = this.state;
    if (s.phase !== 'action' || !s.players[s.current].isBot) return;
    const seat = s.current;
    const wanted = botAction(chooseBotMove(s, seat));
    /* nothing playable, or a move the engine turns down: scout, else pass */
    if (!wanted || this.commit(seat, wanted) !== null) this.commit(seat, fallbackAction(s, seat));
  }
}
