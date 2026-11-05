import { applyAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { buildTargets, eraRounds, isWild, merchantOpen, reachable, sellTargets, tileKey } from '@/game/engine';
import { onlyMoney, searchTurn, sparedFirst } from '@/game/search';
import type { Lens } from '@/game/store';
import type { Card, GameState, IndustryType } from '@/game/types';
import { asideNow, courseIn, lastRound } from './lessons';
import type { Progress } from './lessons';

/* ------------------------------------------------------------------ */
/* What an expert would play in the reader's seat, given by degrees:    */
/* the reason first, then the place, then the move set up in the hand.  */
/* The search that finds it plays at full strength for the reader's     */
/* seat: it is not the move of the table's machine, which plays at its  */
/* character's own strength. It pays with whichever card it can best    */
/* spare; at the guided table that may be the very card a lesson asks   */
/* the reader to keep (the forge card, spent on the canal). The move is */
/* then set up with another card that plays it, or not at all, and the  */
/* plate says why.                                                      */
/* ------------------------------------------------------------------ */

const WORKS: readonly IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

/** the cards the guided game asks the reader to keep through a move, the
 *  lesson whose deed they are kept for (the one the plate names), and
 *  that deed: a move that does it may spend them */
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

/** what a lesson asks the reader to keep: the card its own deed is done
 *  with, spent by another move — and, under the canal, the forge card,
 *  kept for the forge that follows; under the loan, the cards of towns
 *  already linked to a merchant, which build a works that sells there
 *  (not in the last round, where the loan's page asks for no card) */
export function keepOf(id: string, g: GameState, me: number): Keep | null {
  const hand = g.players[me].hand;
  const keep = (lesson: string, cards: string[], every: boolean, purpose: (a: GameAction) => boolean): Keep | null => (cards.length ? { lesson, cards, every, for: purpose } : null);
  switch (id) {
    case 'coal':
      return keep('coal', deedCards(g, me, 'coal'), false, builds(['coal']));
    case 'link':
      return keep('iron', hand.filter((c) => names(c, 'iron')).map((c) => c.id), false, builds(['iron']));
    case 'iron':
      return keep('iron', deedCards(g, me, 'iron'), false, builds(['iron']));
    case 'works':
      return keep('works', hand.filter((c) => buildsNow(g, me, c, WORKS)).map((c) => c.id), false, builds(WORKS));
    /* the second lesson's brewery of the rail era */
    case 'railBrewery':
      return keep('railBrewery', deedCards(g, me, 'brewery'), false, builds(['brewery']));
    case 'loan':
      if (lastRound(g)) return null;
      return keep('works', hand.filter((c) => c.kind === 'location' && !!c.town && nearBuyer(g, c.town)).map((c) => c.id), true, builds(WORKS));
    default:
      return null;
  }
}

/** the opening's deeds, by the lesson that teaches each, the keep that
 *  holds its card, and the tile it builds */
const OPENING: readonly (readonly [lesson: string, keep: string, industry: IndustryType])[] = [
  ['coal', 'coal', 'coal'],
  ['iron', 'link', 'iron'],
];

/** what the guided game keeps as it stands: the cards of the lesson due
 *  (and of the loan, in the detour to it) — and, whatever page is on
 *  show, the opening's: the coal card until the mine, the forge card
 *  until the forge, each until its lesson is passed or set aside */
export function keepsFor(p: Progress, g: GameState, me: number, deed: string | null, detour: boolean): Keep[] {
  const built = (industry: IndustryType): boolean => Object.values(g.tiles).some((t) => t.owner === me && t.industry === industry);
  /* the first lesson's opening only: the second's canal is the reader's */
  const opening = courseIn(p) === 'short' ? OPENING.filter(([lesson, , industry]) => !p.passed.includes(lesson) && !asideNow(p, lesson, g) && !built(industry)).map(([, id]) => id) : [];
  const ids = [...new Set([...(detour ? ['loan'] : []), ...(deed ? [deed] : []), ...opening])];
  return ids.map((id) => keepOf(id, g, me)).filter((k): k is Keep => !!k);
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

/** a card the hand does without: the second of a pair, or, in the canal
 *  era, the card of a town the reader already has a tile in — one tile
 *  a town, it builds nothing new there before the rail */
const idle = (g: GameState, me: number, c: Card): boolean => {
  if (isWild(c)) return false;
  const twin = g.players[me].hand.some((x) => x.id !== c.id && x.kind === c.kind && (c.kind === 'location' ? x.town === c.town : x.industry === c.industry && x.industry2 === c.industry2));
  const closed = g.era === 'canal' && c.kind === 'location' && Object.entries(g.tiles).some(([k, t]) => t.owner === me && k.split(':')[0] === c.town);
  return twin || closed;
};

/** the same move, paid with cards the lessons do not keep, when the
 *  engine allows one; the card each time the one the hand best does
 *  without — the second of a pair, or a town the canal era closes to the
 *  reader, first; else as the search itself spares a card (what it
 *  unlocks, now or once paid for; wilds last) — a brewery card not yet
 *  built only when no other card will do */
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
    const order = sparedFirst(g, me, (rather.length ? rather : legal).map((x) => x.card));
    const best = order.find((c) => idle(g, me, c)) ?? order[0];
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

/** the reader's actions left before the game ends, this one not
 *  counted: the rest of the turn and two a round after it, as far as the
 *  hand and its share of the deck still go */
function actionsAfter(g: GameState, me: number): number {
  const turn = g.current === me ? g.actionsLeft - 1 : 0;
  const rounds = Math.max(0, eraRounds(g.players.length) - g.round);
  const cards = g.players[me].hand.length - 1 + Math.floor(g.deck.length / g.players.length);
  return Math.max(0, Math.min(turn + 2 * rounds, cards));
}

/** a tile begun too late to flip: in the era the game ends with — a
 *  short game's canal, the rail — only a flipped tile scores, and its
 *  price is lost otherwise. It flips as it is laid, its cubes all sold
 *  to the market; or a works is sold, one action more (two, when no
 *  merchant is within reach yet); or a mine, a forge or a brewery is
 *  emptied, a cube an action at best — and in the last two rounds, the
 *  ones the lesson on them speaks of, not at all: what empties it is
 *  anyone's move, not the reader's to count on. The engine's search
 *  values an unflipped tile by its chances, not by the actions left: the
 *  guide sets such a build aside itself, as that lesson asks */
export function deadAtClose(g: GameState, me: number, a: GameAction): boolean {
  if (a.kind !== 'build' || !(g.era === 'rail' || g.eraLength === 'short')) return false;
  const after = applyAction(g, me, a).state;
  const tile = after?.tiles[tileKey(a.town, a.slot)];
  if (!after || !tile || tile.flipped) return false;
  const works = WORKS.includes(tile.industry);
  if (!works && g.round >= eraRounds(g.players.length) - 1) return true;
  const need = works ? (sellTargets(after, me).some((x) => x.town === a.town && x.slot === a.slot && x.valid) ? 1 : 2) : tile.cubes;
  return need > actionsAfter(g, me);
}

/** what an expert would play in the reader's seat: the search at full
 *  strength — not the machine's own entry point, which caps a human seat
 *  under assist and blurs its reading — with a tile begun too late to
 *  flip passed over for the best move after it. A deed the reader may
 *  not set aside (`deed`: the first mine) is advised first when a move
 *  does it: advice played past it would leave the lesson with no way on */
export function expertMove(g: GameState, me: number, budgetMs = 400, deed?: (a: GameAction) => boolean): GameAction | null {
  const r = searchTurn(g, me, { budgetMs, strength: 1, rank: true });
  if (!r) return null;
  const fits = (a: GameAction) => !deadAtClose(g, me, a);
  if (deed && !deed(r.action)) {
    const does = r.ranked?.find((x) => deed(x.action) && fits(x.action))?.action;
    if (does) return does;
  }
  if (fits(r.action)) return r.action;
  return r.ranked?.find((x) => fits(x.action))?.action ?? null;
}

/** the same move, whatever cards pay for it and wherever its cubes and
 *  its beer are drawn from: the tile, the links, the tiles developed, the
 *  sales and their merchants — or a loan, a scout, a pass */
export function sameMove(a: GameAction, b: GameAction): boolean {
  const sorted = (xs: string[]) => [...xs].sort().join('|');
  switch (a.kind) {
    case 'build':
      return b.kind === 'build' && a.town === b.town && a.slot === b.slot && a.industry === b.industry;
    case 'network':
      return b.kind === 'network' && sorted([a.link, ...(a.second ? [a.second] : [])]) === sorted([b.link, ...(b.second ? [b.second] : [])]);
    case 'develop':
      return b.kind === 'develop' && sorted(a.industries) === sorted(b.industries);
    case 'sell':
      return b.kind === 'sell' && sorted(a.sales.map((x) => `${tileKey(x.town, x.slot)}>${x.merchant}`)) === sorted(b.sales.map((x) => `${tileKey(x.town, x.slot)}>${x.merchant}`));
    case 'loan':
    case 'scout':
    case 'pass':
      return b.kind === a.kind;
    default:
      return false;
  }
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
