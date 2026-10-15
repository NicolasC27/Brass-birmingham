import { applyAction, botAction, fallbackAction, replay, withEdition } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { BOT_SKILL, personaName } from '@/game/data';
import { newGame } from '@/game/engine';
import { lastRound } from '@/components/game/handFan';
import type { BotPersona, GameState, SetupPayload } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The test bench's scenarios: a game at home played forward by the   */
/* machines, every seat included, to a chosen moment — the canal half  */
/* way through, the rail's last turn, the scores. Nothing is forged:   */
/* each move is chosen on the position, read by the engine as the      */
/* office will read it, and the log that comes out replays from the    */
/* seed like any other. The office is then handed that log and checks  */
/* it move by move all over again.                                     */
/*                                                                     */
/* Plain functions of a seed and a chooser, so a stop condition can be */
/* held to account without a browser or an office.                     */
/* ------------------------------------------------------------------ */

export type PresetId = 'canal-start' | 'canal-mid' | 'canal-last' | 'canal-scoring' | 'canal-ceremony' | 'rail-start' | 'rail-late' | 'rail-last' | 'game-over';

export interface Preset {
  id: PresetId;
  label: string;
  /** what the table looks like when it opens */
  note: string;
  /** the first position the play stops at, the owner's seat given */
  until: (s: GameState, owner: number, fresh: boolean) => boolean;
  /** the play runs to `until`, then steps back to the start of the owner's
   *  last turn before it: he plays the moment himself */
  back?: boolean;
}

/** the tiles turned over on the board, every seat's */
export const flippedTiles = (s: GameState): number => Object.values(s.tiles).filter((t) => t.flipped).length;

/** the owner is to act, at the start of a turn of his */
const ownTurn = (s: GameState, owner: number, fresh: boolean): boolean => s.phase === 'action' && s.current === owner && fresh;

/** the era's last round, whichever era is played (the engine's own reading, as the notices say it) */
const eraLastRound = (s: GameState): boolean => s.phase === 'action' && lastRound({ ...s, era: 'rail' });

export const PRESETS: readonly Preset[] = [
  { id: 'canal-start', label: 'Début du canal', note: 'premier tour du propriétaire', until: (s, o, f) => s.era === 'canal' && ownTurn(s, o, f) },
  {
    id: 'canal-mid',
    label: 'Milieu du canal',
    note: 'manche 4 ou plus, tuiles et canaux posés',
    until: (s, o, f) => s.era === 'canal' && s.round >= 4 && Object.keys(s.tiles).length > 0 && Object.keys(s.links).length > 0 && ownTurn(s, o, f),
  },
  { id: 'canal-last', label: 'Dernière manche du canal', note: 'pioche vide, dernières cartes', until: (s, o, f) => s.era === 'canal' && eraLastRound(s) && ownTurn(s, o, f) },
  { id: 'canal-scoring', label: 'Avant le décompte du canal', note: 'le dernier tour du propriétaire, puis la cérémonie', until: (s) => s.phase === 'scoring-canal', back: true },
  { id: 'canal-ceremony', label: 'Cérémonie du canal', note: 'la cérémonie à l’ouverture', until: (s) => s.phase === 'scoring-canal' },
  { id: 'rail-start', label: 'Début du rail', note: 'premier tour du rail', until: (s, o, f) => s.era === 'rail' && ownTurn(s, o, f) },
  {
    id: 'rail-late',
    label: 'Fin du rail',
    note: 'pioche vide, au moins trois tuiles retournées',
    until: (s, o, f) => s.era === 'rail' && s.deck.length === 0 && flippedTiles(s) >= 3 && ownTurn(s, o, f),
  },
  { id: 'rail-last', label: 'Dernier tour du rail', note: 'le dernier tour du propriétaire avant la fin', until: (s) => s.phase === 'game-over', back: true },
  { id: 'game-over', label: 'Partie finie', note: 'le registre final', until: (s) => s.phase === 'game-over' },
];

export const presetOf = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);

/* ---------------------------- the table ---------------------------- */

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;

export interface TableAsk {
  /** 2 to 4 seats */
  seats: number;
  /** the owner's seat, counted from 0 */
  owner: number;
  /** the owner's name at the table */
  name: string;
  /** the machines, in the order of their seats (the owner's left out) */
  personas: readonly BotPersona[];
}

/** the deal of a scenario: the owner in his seat, a machine in every other,
 *  the colours in the order of the seats, the rules of today */
export function scenarioSetup(ask: TableAsk): SetupPayload {
  const seats = Math.max(2, Math.min(4, Math.round(ask.seats)));
  const owner = Math.max(0, Math.min(seats - 1, Math.round(ask.owner)));
  let b = 0;
  const players = Array.from({ length: seats }, (_, i): SetupPayload['players'][number] => {
    if (i === owner) return { name: ask.name, color: COLORS[i], type: 'human' };
    const persona = ask.personas[b++] ?? 'boulton';
    return { name: personaName(persona), color: COLORS[i], type: 'bot', persona };
  });
  return withEdition({ players, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } });
}

/* --------------------------- the play ---------------------------- */

/** the move a seat plays forward with (null: nothing it wants) */
export type Chooser = (s: GameState, seat: number) => GameAction | null;

/** the heuristic machine: a few milliseconds a move, legal, and it builds,
 *  sells and turns tiles like a player — enough to set any scene */
export const quickChooser: Chooser = (s, seat) => botAction(chooseBotMove(s, seat, BOT_SKILL.industrialist));

export interface Played {
  /** the log up to the moment, every move read by the engine */
  actions: GameAction[];
  state: GameState;
  /** the moment was found; false when the game ended first */
  reached: boolean;
}

/** how far along a game is, 0 to 1, by era and round */
export function progressOf(s: GameState, rounds: number): number {
  if (s.phase === 'game-over') return 1;
  const done = (s.era === 'rail' ? rounds : 0) + Math.min(s.round, rounds) - 1;
  return Math.max(0, Math.min(0.99, done / (2 * rounds)));
}

/** the play, one move at a time: yields the position after each move, so
 *  a caller may give the page a breath now and then */
export function* playSteps(setup: SetupPayload, seed: number, preset: Preset, owner: number, choose: Chooser = quickChooser): Generator<GameState, Played> {
  let s = newGame(setup, seed);
  const actions: GameAction[] = [];
  /* who took each move, in which era and round: the way back to a turn's start */
  const turns: { seat: number; era: string; round: number }[] = [];
  let guard = 0;
  for (;;) {
    const prev = turns[turns.length - 1];
    const fresh = !prev || prev.seat !== s.current || prev.round !== s.round || prev.era !== s.era;
    if (preset.until(s, owner, fresh)) break;
    if (s.phase === 'game-over' || guard++ > 4000) return { actions, state: s, reached: false };
    let taken: GameAction;
    let r;
    if (s.phase === 'scoring-canal') {
      taken = { kind: 'begin-rail' };
      r = applyAction(s, s.current, taken);
    } else {
      const seat = s.current;
      const wanted = choose(s, seat);
      r = wanted ? applyAction(s, seat, wanted) : null;
      taken = wanted!;
      /* nothing it wants, or a move the engine refuses: scout or pass, as a machine at the table does */
      if (!r?.state) {
        taken = fallbackAction(s, seat);
        r = applyAction(s, seat, taken);
      }
    }
    if (!r.state) throw new Error(`move ${actions.length} refused: ${r.error ?? 'unknown'}`);
    turns.push({ seat: s.phase === 'action' ? s.current : -1, era: s.era, round: s.round });
    actions.push(taken);
    s = r.state;
    yield s;
  }
  if (!preset.back) return { actions, state: s, reached: true };
  const at = lastTurnStart(turns, owner);
  if (at < 0) return { actions, state: s, reached: false };
  const cut = actions.slice(0, at);
  return { actions: cut, state: replay(setup, seed, cut), reached: true };
}

/** where the owner's last turn in the log began: the index of its first
 *  move (-1: he never played) */
export function lastTurnStart(turns: readonly { seat: number; era: string; round: number }[], owner: number): number {
  let i = -1;
  for (let k = turns.length - 1; k >= 0; k--)
    if (turns[k].seat === owner) {
      i = k;
      break;
    }
  if (i < 0) return -1;
  while (i > 0 && turns[i - 1].seat === owner && turns[i - 1].round === turns[i].round && turns[i - 1].era === turns[i].era) i--;
  return i;
}

/** the whole play at once (the tests, and anyone who need not wait) */
export function playTo(setup: SetupPayload, seed: number, preset: Preset, owner: number, choose: Chooser = quickChooser): Played {
  const steps = playSteps(setup, seed, preset, owner, choose);
  for (;;) {
    const n = steps.next();
    if (n.done) return n.value;
  }
}

/** the play in slices, the page breathing between them and told how far it is */
export async function playForward(setup: SetupPayload, seed: number, preset: Preset, owner: number, onProgress: (share: number) => void, choose: Chooser = quickChooser): Promise<Played> {
  const steps = playSteps(setup, seed, preset, owner, choose);
  const rounds = setup.players.length <= 2 ? 10 : setup.players.length === 3 ? 9 : 8;
  let since = performance.now();
  for (;;) {
    const n = steps.next();
    if (n.done) return n.value;
    if (performance.now() - since > 30) {
      onProgress(progressOf(n.value, rounds));
      await new Promise((ok) => setTimeout(ok, 0));
      since = performance.now();
    }
  }
}

/** a log in slices small enough for one frame of the wire */
export function chunks<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
