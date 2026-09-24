import { cloneState } from './clone';
import { advance, applyBuild, applyConcede, applyDevelop, applyLoan, applyNetwork, applyPass, applyResign, applyScout, applySell, beginRailEra, buildTargets, canScout, linkTargets, newGame, sellTargets, withIron } from './engine';
import type { BotMove } from './bot';
import type { GameState, IndustryType, SetupPayload } from './types';

/* ------------------------------------------------------------------ */
/* The action log — the protocol between a table and its players.     */
/*                                                                     */
/* A GameAction names WHAT a player does with the smallest possible   */
/* vocabulary (card ids, town + slot, link ids, merchant ids). It      */
/* never carries a plan: the engine recomputes costs, coal, iron and   */
/* beer from the live state, so a client cannot smuggle a cheaper      */
/* supply. applyAction validates, applies on a copy and advances the   */
/* turn; the accepted action is appended to state.actions. Replaying   */
/* the log from the seed rebuilds the exact same state — that is what */
/* a server, a reconnecting client or a spectator does.                */
/* ------------------------------------------------------------------ */

export type GameAction =
  | { kind: 'build'; card: string; town: string; slot: number; industry: IndustryType; /** the iron works to draw from (its key) or 'market'; nothing for the engine's nearest */ ironFrom?: string | null }
  | { kind: 'network'; card: string; link: string; second?: string; /** for a double rail, the brewery to drink from (its key); nothing for the engine's choice */ beerFrom?: string | null }
  | { kind: 'develop'; card: string; industries: IndustryType[]; /** per industry, the iron works to draw from (its key), 'market', or nothing for the engine's choice */ ironFrom?: (string | null)[] }
  | { kind: 'sell'; card: string; sales: { town: string; slot: number; merchant: string; /** per beer needed, the merchant's barrel ('merchant') or a brewery (its key); nothing for the engine's choice */ beerFrom?: (string | null)[] }[] }
  | { kind: 'loan'; card?: string }
  | { kind: 'scout'; cards: string[] }
  | { kind: 'pass'; card?: string; reason?: string }
  /** a vote to abandon the game — cast in one's own name, on anyone's turn */
  | { kind: 'concede'; player: number; vote: 'yes' | 'no' }
  /** a seat left for good: a machine takes the chair — the last human out abandons the game */
  | { kind: 'resign'; player: number }
  /** the canal ceremony is over: sweep the board and deal the rail era */
  | { kind: 'begin-rail' };

export interface ActionResult {
  state: GameState | null;
  error?: string;
}

/** validate `action` for `playerIdx` against `s`, apply it on a copy and
 *  advance the turn. `s` itself is never touched. */
export function applyAction(s: GameState, playerIdx: number, action: GameAction): ActionResult {
  const fail = (error: string): ActionResult => ({ state: null, error });
  if (action.kind === 'begin-rail') {
    if (s.phase !== 'scoring-canal') return fail('No ceremony to close');
    const mut = cloneState(s);
    beginRailEra(mut);
    mut.actions.push(action);
    return { state: mut };
  }
  if (action.kind === 'concede') {
    if (s.phase !== 'action') return fail('The game is not in play');
    if (playerIdx !== action.player) return fail('A vote is cast in one\'s own name');
    if (s.players[action.player]?.isBot) return fail('That seat plays itself');
    const mut = cloneState(s);
    applyConcede(mut, action.player, action.vote);
    mut.actions.push(action);
    return { state: mut };
  }
  if (action.kind === 'resign') {
    if (s.phase === 'game-over') return fail('The game is over');
    if (playerIdx !== action.player) return fail('A seat is left in one\'s own name');
    if (s.players[action.player]?.isBot) return fail('That seat plays itself');
    const mut = cloneState(s);
    applyResign(mut, action.player);
    mut.actions.push(action);
    return { state: mut };
  }
  if (s.phase !== 'action') return fail('The game is not in play');
  if (playerIdx !== s.current) return fail('Not your turn');
  const mut = cloneState(s);
  const p = mut.players[playerIdx];
  const cardOf = (id: string | undefined) => (id ? p.hand.find((c) => c.id === id) : undefined);
  /* a refused card is the classic sign of a log that no longer matches its
     seed: say who was to act and what they hold, it is the whole diagnosis */
  const noCard = (id: string) => fail(`Card not in hand — ${p.name} (seat ${playerIdx}, ${s.era} R${s.round}) holds ${p.hand.map((c) => c.id).join(' ') || 'nothing'}, action names ${id}`);
  let ok = false;
  switch (action.kind) {
    case 'build': {
      const card = cardOf(action.card);
      if (!card) return noCard(action.card);
      const target = buildTargets(mut, playerIdx, card).find((t) => t.town === action.town && t.slot === action.slot && t.industry === action.industry);
      if (!target) return fail('No such slot for this card');
      if (!target.valid) return fail(target.reason ?? 'Cannot build there');
      const chosen = withIron(mut, playerIdx, target, action.ironFrom);
      if (!chosen.valid) return fail(chosen.reason ?? 'Cannot build there');
      ok = applyBuild(mut, playerIdx, card, chosen);
      break;
    }
    case 'network': {
      const card = cardOf(action.card);
      if (!card) return noCard(action.card);
      const list = linkTargets(mut, playerIdx);
      const first = list.find((t) => t.link.id === action.link);
      if (!first) return fail('No such link');
      if (!first.valid) return fail(first.reason ?? 'Cannot lay that link');
      const second = action.second ? list.find((t) => t.link.id === action.second) : undefined;
      if (action.second && !second) return fail('No such second link');
      ok = applyNetwork(mut, playerIdx, card, first, second, action.beerFrom);
      break;
    }
    case 'develop': {
      const card = cardOf(action.card);
      if (!card) return noCard(action.card);
      ok = applyDevelop(mut, playerIdx, card, action.industries, action.ironFrom);
      break;
    }
    case 'sell': {
      const card = cardOf(action.card);
      if (!card) return noCard(action.card);
      const list = sellTargets(mut, playerIdx);
      const picks = action.sales.map((x) => list.find((t) => t.town === x.town && t.slot === x.slot && t.merchant === x.merchant && t.valid));
      if (picks.some((t) => !t)) return fail('A sale is not possible');
      ok = applySell(mut, playerIdx, card, picks as NonNullable<(typeof picks)[number]>[], action.sales.map((x) => x.beerFrom ?? []));
      break;
    }
    case 'loan':
      ok = applyLoan(mut, playerIdx, cardOf(action.card));
      break;
    case 'scout':
      ok = applyScout(mut, playerIdx, action.cards);
      break;
    case 'pass':
      ok = applyPass(mut, playerIdx, action.card, action.reason);
      break;
  }
  if (!ok) return fail('The engine refused the action');
  /* the action's own ledger entry learns what it cost the purse (a loan
     shows as a gain), so the register can add up a round per player */
  const spent = s.players[playerIdx].money - mut.players[playerIdx].money;
  const entry = [...mut.ledger].reverse().find((e) => e.player === playerIdx && e.at === s.actions.length);
  if (entry?.vars) entry.vars.spent = spent;
  advance(mut);
  mut.actions.push(action);
  return { state: mut };
}

/** the action a bot's chosen move stands for (null = nothing playable) */
export function botAction(move: BotMove | null): GameAction | null {
  if (!move) return null;
  switch (move.kind) {
    case 'build':
      return move.card && move.build ? { kind: 'build', card: move.card.id, town: move.build.town, slot: move.build.slot, industry: move.build.industry } : null;
    case 'network':
      return move.card && move.link ? { kind: 'network', card: move.card.id, link: move.link.link.id } : null;
    case 'develop':
      return move.card && move.develop ? { kind: 'develop', card: move.card.id, industries: move.develop } : null;
    case 'sell':
      return move.card && move.sell ? { kind: 'sell', card: move.card.id, sales: move.sell.map((t) => ({ town: t.town, slot: t.slot, merchant: t.merchant })) } : null;
    case 'loan':
      return { kind: 'loan' };
    case 'scout':
      return move.scoutCards ? { kind: 'scout', cards: move.scoutCards } : null;
  }
}

/** what a player with nothing playable does: scout if allowed, else pass */
export function fallbackAction(s: GameState, playerIdx: number): GameAction {
  const p = s.players[playerIdx];
  if (canScout(s, playerIdx).ok && p.hand.length >= 3) return { kind: 'scout', cards: p.hand.slice(0, 3).map((c) => c.id) };
  return { kind: 'pass' };
}

/** who takes an action of the log: the player to act, except a vote, which is cast in its author's name */
export const actorOf = (s: GameState, a: GameAction): number => (a.kind === 'concede' || a.kind === 'resign' ? a.player : s.current);

/** rebuild a game from its seed and its log; throws on the first refused action */
export function replay(setup: SetupPayload, seed: number, actions: GameAction[]): GameState {
  let s = newGame(setup, seed);
  actions.forEach((a, i) => {
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) throw new Error(`replay: action ${i} (${a.kind}) refused — ${r.error}`);
    s = r.state;
  });
  return s;
}

/** an action a human took: its index in the log and the seat that took it */
export interface UndoMark {
  at: number;
  by: number;
}

/** the actions taken by humans (replayed from the seed — the log itself
 *  never says who acted, the state at that point does) */
export function humanActionIndices(setup: SetupPayload, seed: number, actions: GameAction[]): UndoMark[] {
  const marks: UndoMark[] = [];
  let s = newGame(setup, seed);
  actions.forEach((a, i) => {
    /* a vote, or a seat handed over, is nobody's turn: it is not an undo point */
    if (a.kind !== 'concede' && a.kind !== 'resign' && s.phase === 'action' && !s.players[s.current].isBot) marks.push({ at: i, by: s.current });
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) throw new Error(`replay: action ${i} (${a.kind}) refused — ${r.error}`);
    s = r.state;
  });
  return marks;
}

/** Undo is a courtesy of the table, not a time machine: only the action
 *  just taken, while the turn is still that player's. Once the turn has
 *  passed — a bot or another player acted — the move stands. */
export function canUndoNow(s: GameState, marks: UndoMark[]): boolean {
  const last = marks[marks.length - 1];
  return !!last && last.at === s.actions.length - 1 && s.phase === 'action' && s.current === last.by;
}

/** the game as it stood before the human's last action — or null when no
 *  human has acted yet (the caller decides whether undo is still allowed) */
export function undoLastHuman(s: GameState, marks: UndoMark[]): GameState | null {
  const at = marks[marks.length - 1]?.at;
  if (at === undefined) return null;
  const back = replay(setupOf(s), s.seed, s.actions.slice(0, at));
  /* no build/link FX should replay on the board: bump past the live counter */
  back.fxSeq = s.fxSeq + 1;
  delete back.lastFx;
  return back;
}

/** the setup a state was created from (what replay needs besides the seed) */
export function setupOf(s: GameState): SetupPayload {
  return {
    /* a chair handed to a machine was a human's at the deal: the log says when it changed hands */
    players: s.players.map((p) => ({ name: p.name, color: p.color, type: p.isBot && !p.resigned ? 'bot' : 'human', ...(p.isBot && !p.resigned ? { persona: p.persona } : {}) })),
    /* the house rule travels with the setup: an undo that dropped it
       would take the assistance away mid-game */
    options: { eraLength: s.eraLength, marketTemper: s.marketTemper, timerMinutes: s.timerMinutes, fidelity: s.fidelity, assist: s.assist },
  };
}
