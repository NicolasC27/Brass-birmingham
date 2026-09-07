import {
  advance,
  applyBuild,
  applyDevelop,
  applyLoan,
  applyNetwork,
  applyPass,
  applyScout,
  applySell,
  beginRailEra,
  buildTargets,
  canScout,
  linkTargets,
  newGame,
  sellTargets,
} from './engine';
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
  | { kind: 'build'; card: string; town: string; slot: number; industry: IndustryType }
  | { kind: 'network'; card: string; link: string; second?: string }
  | { kind: 'develop'; card: string; industries: IndustryType[] }
  | { kind: 'sell'; card: string; sales: { town: string; slot: number; merchant: string }[] }
  | { kind: 'loan'; card?: string }
  | { kind: 'scout'; cards: string[] }
  | { kind: 'pass'; card?: string; reason?: string }
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
    const mut = structuredClone(s);
    beginRailEra(mut);
    mut.actions.push(action);
    return { state: mut };
  }
  if (s.phase !== 'action') return fail('The game is not in play');
  if (playerIdx !== s.current) return fail('Not your turn');
  const mut = structuredClone(s);
  const p = mut.players[playerIdx];
  const cardOf = (id: string | undefined) => (id ? p.hand.find((c) => c.id === id) : undefined);
  let ok = false;
  switch (action.kind) {
    case 'build': {
      const card = cardOf(action.card);
      if (!card) return fail('Card not in hand');
      const target = buildTargets(mut, playerIdx, card).find((t) => t.town === action.town && t.slot === action.slot && t.industry === action.industry);
      if (!target) return fail('No such slot for this card');
      if (!target.valid) return fail(target.reason ?? 'Cannot build there');
      ok = applyBuild(mut, playerIdx, card, target);
      break;
    }
    case 'network': {
      const card = cardOf(action.card);
      if (!card) return fail('Card not in hand');
      const list = linkTargets(mut, playerIdx);
      const first = list.find((t) => t.link.id === action.link);
      if (!first) return fail('No such link');
      if (!first.valid) return fail(first.reason ?? 'Cannot lay that link');
      const second = action.second ? list.find((t) => t.link.id === action.second) : undefined;
      if (action.second && !second) return fail('No such second link');
      ok = applyNetwork(mut, playerIdx, card, first, second);
      break;
    }
    case 'develop': {
      const card = cardOf(action.card);
      if (!card) return fail('Card not in hand');
      ok = applyDevelop(mut, playerIdx, card, action.industries);
      break;
    }
    case 'sell': {
      const card = cardOf(action.card);
      if (!card) return fail('Card not in hand');
      const list = sellTargets(mut, playerIdx);
      const picks = action.sales.map((x) => list.find((t) => t.town === x.town && t.slot === x.slot && t.merchant === x.merchant && t.valid));
      if (picks.some((t) => !t)) return fail('A sale is not possible');
      ok = applySell(mut, playerIdx, card, picks as NonNullable<(typeof picks)[number]>[]);
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

/** rebuild a game from its seed and its log; throws on the first refused action */
export function replay(setup: SetupPayload, seed: number, actions: GameAction[]): GameState {
  let s = newGame(setup, seed);
  actions.forEach((a, i) => {
    const r = applyAction(s, s.current, a);
    if (!r.state) throw new Error(`replay: action ${i} (${a.kind}) refused — ${r.error}`);
    s = r.state;
  });
  return s;
}

/** the setup a state was created from (what replay needs besides the seed) */
export function setupOf(s: GameState): SetupPayload {
  return {
    players: s.players.map((p) => ({ name: p.name, color: p.color, type: p.isBot ? 'bot' : 'human', difficulty: p.difficulty })),
    options: { eraLength: s.eraLength, marketTemper: s.marketTemper, timerMinutes: s.timerMinutes, fidelity: s.fidelity },
  };
}
