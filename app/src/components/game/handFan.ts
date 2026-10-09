import type { Card, GameState } from '@/game/types';
import { actionsFor, projectedOrder } from '@/game/engine';
import { industryFaceUrl } from '@/gl/faces';

/* ------------------------------------------------------------------ */
/* The fan's measure: how wide the cards of the hand are, and how far  */
/* they overlap, read from the room the dock is given.                 */
/* ------------------------------------------------------------------ */

/* A card is never narrower than CARD_MIN nor wider than CARD_MAX; between
   the two it takes its share of the room the fan is given. Only when even
   the narrowest cards will not sit side by side do they overlap, and then
   by exactly what the room lacks — never by a fixed step. */
export const CARD_MIN = 84;
export const CARD_MAX = 100;
export const CARD_H = 120;
/* the least of a covered card that stays in view: its liseré and the
   start of its name */
export const CARD_PEEK = 40;
/* the dock's fixed parts round the fan: padding, deck plate, verb grid,
   the two gaps between them and the plaque's hairlines; the hints column
   right of it when shown */
export const DOCK_FIXED = 32 + 64 + 216 + 2 * 12 + 4;
export const HINTS_W = 190 + 12;
/* the dock's open height: the strip and the body */
export const DOCK_OPEN_H = 180;

export interface FanMeasure {
  /** each card's width */
  card: number;
  /** the margin laid before every card but the first (≤ 0: overlap) */
  step: number;
}

/* the fan's own margins: a hair at its left, and at its right the siding
   the cards run into when the pointer lifts one out of the overlap — as
   wide as the overlap itself, never under FAN_SLIDE_MIN */
export const FAN_PAD = 4;
export const FAN_SLIDE_MIN = 12;

/** the whole width a fan of `n` cards laid at `m` takes, siding included */
export function fanWidth(n: number, m: FanMeasure): number {
  if (n <= 0) return 0;
  return FAN_PAD + n * m.card + (n - 1) * m.step + Math.max(FAN_SLIDE_MIN, -m.step);
}

/** the cards' width and overlap for `n` cards in `room` px, the fan's
 *  margins and its siding counted in, so a lifted card never pushes the
 *  last one out of the dock */
export function fanMeasure(n: number, room: number): FanMeasure {
  if (n <= 0) return { card: CARD_MIN, step: 0 };
  const inner = room - FAN_PAD - FAN_SLIDE_MIN;
  const card = Math.max(CARD_MIN, Math.min(CARD_MAX, Math.floor(inner / n)));
  if (n === 1) return { card, step: 0 };
  let step = Math.floor((inner - n * card) / (n - 1));
  /* past the siding's least width the siding grows with the overlap, and
     takes back one step of it: n cards, n − 2 steps, the pad */
  if (step < -FAN_SLIDE_MIN) step = n > 2 ? Math.floor((room - FAN_PAD - n * card) / (n - 2)) : -(card - CARD_PEEK);
  return { card, step: Math.max(-(card - CARD_PEEK), Math.min(4, step)) };
}

/* ------------------------------------------------------------------ */
/* The purse's two public figures: what a player has spent this round, */
/* and the place it earns them at the next one.                        */
/* ------------------------------------------------------------------ */

/** the round under way is the game's last: the draw pile is out, and no
 *  hand will hold a card once every seat has played its turn — those who
 *  have played keep what they hold, the seat at the table lays its actions
 *  left, the seats still to come two cards each (a scout leaves hands
 *  uneven, so the count is taken seat by seat). The canal's last round
 *  still leads into the rail's first, where the order holds. */
export function lastRound(game: GameState): boolean {
  if (game.deck.length > 0) return false;
  if (game.era !== 'rail' && game.eraLength !== 'short') return false;
  return game.order.every((seat, at) => {
    const held = game.players[seat].hand.length;
    if (at < game.turnPos) return held === 0;
    if (at === game.turnPos) return held <= game.actionsLeft;
    return held <= actionsFor(game, game.players[seat]);
  });
}

/** the seat's place at the next round, counted from one: the engine's own
 *  order (least spent first, a tie keeping today's order). Null when there
 *  is no next round to take a place at. */
export function nextTurnPlace(game: GameState, seat: number): number | null {
  if (game.phase !== 'action' || lastRound(game)) return null;
  const at = projectedOrder(game).indexOf(seat);
  return at < 0 ? null : at + 1;
}

/* ------------------------------------------------------------------ */
/* The picture printed on each card: the town's engraved plate, the    */
/* trade's painting from the table's tile set, a joker's own plate.    */
/* ------------------------------------------------------------------ */

/** the towns whose plate has been engraved (tools/assets/cards); another
 *  board's towns are drawn on the card itself, as a skyline */
export const ENGRAVED_TOWNS: ReadonlySet<string> = new Set([
  'belper', 'derby', 'leek', 'stoke', 'stone', 'uttoxeter', 'stafford', 'burton', 'cannock', 'tamworth',
  'walsall', 'wolverhampton', 'coalbrookdale', 'dudley', 'kidderminster', 'worcester', 'birmingham', 'coventry', 'nuneaton', 'redditch',
]);

/** the picture a card carries, or null when the card draws its own */
export function cardArt(card: Card): string | null {
  if (card.kind === 'location') return card.town && ENGRAVED_TOWNS.has(card.town) ? `/cards/town-${card.town}.webp` : null;
  if (card.kind === 'wild-location') return '/cards/wild-location.webp';
  if (card.kind === 'wild-industry') return '/cards/wild-industry.webp';
  /* the table's painted set, whatever the board wears */
  return card.industry ? industryFaceUrl(card.industry, {}) : null;
}

/** a small, steady number from a word: a town drawn with no plate keeps
 *  the same skyline from one deal to the next */
export function seedOf(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** the shape of a town drawn with no plate, on a 100 × 72 plate: its
 *  houses (front and gable), the church, the chimneys; the ground at 52 */
export interface Skyline {
  ground: number;
  houses: { x: number; w: number; top: number; peak: number }[];
  spire: number;
  stacks: { x: number; top: number }[];
}

export function skylineOf(town: string): Skyline {
  let s = seedOf(town) || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const ground = 52;
  const spire = 30 + Math.floor(rnd() * 40);
  const houses: Skyline['houses'] = [];
  const stacks: Skyline['stacks'] = [];
  for (let x = 4; x < 96; ) {
    const w = 9 + Math.floor(rnd() * 8);
    const top = ground - 10 - Math.floor(rnd() * 12);
    houses.push({ x, w, top, peak: top - 5 - rnd() * 4 });
    if (rnd() < 0.3) stacks.push({ x: x + w - 3, top: top - 14 - rnd() * 8 });
    x += w + 1;
  }
  return { ground, houses, spire, stacks };
}
