import { applyAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { spareCard } from '@/game/bot';
import { buildTargets, merchantOpen, reachable, tileKey } from '@/game/engine';
import { onlyMoney } from '@/game/search';
import type { Lens } from '@/game/store';
import type { Card, GameState, IndustryType } from '@/game/types';

/* ------------------------------------------------------------------ */
/* What an expert would play in the reader's seat, given by degrees:    */
/* the reason first, then the place, then the move set up in the hand.  */
/* The search that finds it plays at full strength — it is not the      */
/* machine at the table — and pays with whichever card it can best      */
/* spare; at the guided table that may be the very card the lesson due  */
/* asks the reader to keep (the forge card, spent on the canal). The    */
/* move is then set up with another card that plays it, or not at all,  */
/* and the plate says why.                                              */
/* ------------------------------------------------------------------ */

const WORKS: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

/** the cards a lesson asks the reader to keep through a move, and what
 *  they are kept for: a move that does that may spend them */
export interface Keep {
  lesson: string;
  cards: string[];
  /** every one of them kept, or one of them at least */
  every: boolean;
  for: (a: GameAction) => boolean;
}

const builds = (inds: readonly IndustryType[]) => (a: GameAction): boolean => a.kind === 'build' && inds.includes(a.industry);
/** the industry card that names this industry: "la carte forge" */
const names = (c: Card, industry: IndustryType): boolean => c.kind === 'industry' && (c.industry === industry || c.industry2 === industry);
/** the card builds one of these as the table stands, or will once the
 *  purse allows: a short purse keeps the card all the same */
const buildsNow = (g: GameState, me: number, c: Card, inds: readonly IndustryType[]): boolean => buildTargets(g, me, c).some((t) => (t.valid || onlyMoney(t)) && inds.includes(t.industry));
/** the card the lesson names when the hand holds it, else any card that
 *  builds the lesson's tile as the table stands */
const deedCards = (g: GameState, me: number, industry: IndustryType): string[] => {
  const hand = g.players[me].hand;
  const named = hand.filter((c) => names(c, industry));
  return (named.length ? named : hand.filter((c) => buildsNow(g, me, c, [industry]))).map((c) => c.id);
};
/** a town that links laid, by anyone, join to a merchant of this table */
const nearBuyer = (g: GameState, town: string): boolean => [...reachable(g, town, g.era, null)].some((n) => merchantOpen(g, n));

/** what the lesson due asks the reader to keep: the card its own deed is
 *  done with, spent by another move — and, under the canal, the forge card
 *  the next action wants; under the loan, the cards of towns already
 *  linked to a merchant, which build a works that sells there */
export function keepOf(id: string, g: GameState, me: number): Keep | null {
  const hand = g.players[me].hand;
  const keep = (cards: string[], every: boolean, purpose: (a: GameAction) => boolean): Keep | null => (cards.length ? { lesson: id, cards, every, for: purpose } : null);
  switch (id) {
    case 'coal':
      return keep(deedCards(g, me, 'coal'), false, builds(['coal']));
    case 'link':
      return keep(hand.filter((c) => names(c, 'iron')).map((c) => c.id), false, builds(['iron']));
    case 'iron':
      return keep(deedCards(g, me, 'iron'), false, builds(['iron']));
    case 'works':
      return keep(hand.filter((c) => buildsNow(g, me, c, WORKS)).map((c) => c.id), false, builds(WORKS));
    case 'loan':
      return keep(hand.filter((c) => c.kind === 'location' && !!c.town && nearBuyer(g, c.town)).map((c) => c.id), true, builds(WORKS));
    default:
      return null;
  }
}

/** the cards a move spends */
export const spentBy = (a: GameAction): string[] => (a.kind === 'scout' ? a.cards : 'card' in a && typeof a.card === 'string' ? [a.card] : []);

/** the move spends what the lesson keeps: one of them when every one is
 *  kept, the last of them otherwise — unless it is what they are kept for */
const breaks = (k: Keep, a: GameAction): boolean => {
  if (k.for(a)) return false;
  const spent = spentBy(a);
  const hit = k.cards.filter((id) => spent.includes(id));
  return hit.length > 0 && (k.every || hit.length === k.cards.length);
};

/** the move to set up, and what became of its cards: played as found;
 *  played with other cards (`played`) so as to keep the lesson's
 *  (`kept`); or not set up at all, no other card of the hand playing it */
export type Spared =
  | { action: GameAction; played: string[]; kept: string[]; lesson: string | null }
  | { action: null; played: []; kept: string[]; lesson: string };

/** a brewery card, while the reader has no brewery on the board: the
 *  guide's own habit keeps it (tips), so a card is changed for it last */
const beerCard = (g: GameState, me: number, c: Card): boolean => names(c, 'brewery') && !Object.values(g.tiles).some((t) => t.owner === me && t.industry === 'brewery');

/** the same move, paid with cards the lessons do not keep, when the
 *  engine allows one; the card each time the one best spared, as the
 *  search itself chooses it (fewest builds, wilds last) — a brewery card
 *  not yet built only when no other card will do */
export function spareFor(g: GameState, me: number, a: GameAction, keeps: readonly (Keep | null)[]): Spared {
  const held = keeps.filter((k): k is Keep => !!k && breaks(k, a));
  if (!held.length) return { action: a, played: [], kept: [], lesson: null };
  const lesson = held[0].lesson;
  const kept = [...new Set(held.flatMap((k) => k.cards))];
  const spent = spentBy(a);
  /* any card of the hand no lesson keeps and the move does not spend already */
  const off = new Set(keeps.flatMap((k) => (k ? k.cards : [])));
  const swaps = spent.filter((id) => kept.includes(id));
  let move = a;
  const played: string[] = [];
  for (const out of swaps) {
    const used = new Set([...spentBy(move), ...played]);
    const tried = g.players[me].hand.filter((c) => !off.has(c.id) && !used.has(c.id)).map((c) => ({ card: c, move: withCard(move, out, c.id) }));
    const legal = tried.filter((x) => !!applyAction(g, me, x.move).state);
    const rather = legal.filter((x) => !beerCard(g, me, x.card));
    const best = spareCard(g, me, (rather.length ? rather : legal).map((x) => x.card));
    if (!best) return { action: null, played: [], kept: swaps, lesson };
    move = legal.find((x) => x.card.id === best.id)!.move;
    played.push(best.id);
  }
  return { action: move, played, kept: swaps, lesson };
}

/** the move with one of its cards changed for another */
function withCard(a: GameAction, from: string, to: string): GameAction {
  if (a.kind === 'scout') return { ...a, cards: a.cards.map((id) => (id === from ? to : id)) };
  return 'card' in a && a.card === from ? ({ ...a, card: to } as GameAction) : a;
}

/** a move played on the map, whose place can be shown there */
export const hasPlace = (a: GameAction): boolean => a.kind === 'build' || a.kind === 'network' || a.kind === 'sell';

/** where the move is played, lit as a lesson's lamp is — nothing dimmed,
 *  the other places still the reader's to choose — and where the camera
 *  comes; a move off the map rings its button in the hand */
export function placeLens(a: GameAction): Lens | null {
  switch (a.kind) {
    case 'build':
      return { first: [tileKey(a.town, a.slot)], at: a.town };
    case 'network':
      return { links: [a.link, ...(a.second ? [a.second] : [])], at: a.link };
    case 'sell':
      return a.sales.length ? { first: [...new Set(a.sales.map((x) => tileKey(x.town, x.slot)))], merchants: [...new Set(a.sales.map((x) => x.merchant))], at: a.sales[0].town } : null;
    case 'develop':
    case 'loan':
    case 'scout':
      return { hud: a.kind };
    default:
      return null;
  }
}
