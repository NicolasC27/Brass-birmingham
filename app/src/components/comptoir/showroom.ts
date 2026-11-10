import { defaultSetup, newGame } from '@/game/engine';
import type { GameState, IndustryType, TileState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The showroom: the table the counter's window shows. A game dealt    */
/* from the usual setup, then a canal era well under way laid straight */
/* into the state — a tile of every trade, three owners, a few flipped */
/* and stocked, a dozen canals — so a set of tiles, a ground or a hand  */
/* of cards is seen as it will be played, not on an empty board.       */
/* ------------------------------------------------------------------ */

/** the same deal every time: the window is a shop window, not a game */
const SEED = 1842;

/** town, slot, trade, owner, level, flipped, cubes */
const TILES: [string, number, IndustryType, number, number, boolean, number][] = [
  ['birmingham', 0, 'cotton', 0, 1, true, 0],
  ['birmingham', 1, 'manufacturer', 1, 2, false, 0],
  ['birmingham', 2, 'iron', 2, 1, false, 2],
  ['coventry', 0, 'pottery', 1, 1, false, 0],
  ['coventry', 1, 'coal', 0, 1, false, 3],
  ['walsall', 0, 'iron', 1, 1, true, 0],
  ['dudley', 0, 'coal', 2, 2, false, 4],
  ['wolverhampton', 0, 'manufacturer', 0, 1, true, 0],
  ['kidderminster', 0, 'cotton', 2, 1, false, 0],
  ['worcester', 0, 'cotton', 1, 1, true, 0],
  ['redditch', 1, 'iron', 0, 1, false, 1],
  ['nuneaton', 0, 'brewery', 2, 1, false, 1],
  ['tamworth', 0, 'cotton', 1, 1, false, 0],
  ['stoke', 1, 'pottery', 0, 1, false, 0],
  ['stone', 0, 'brewery', 1, 1, false, 2],
  ['stafford', 1, 'pottery', 2, 1, true, 0],
  ['burton', 1, 'brewery', 0, 1, false, 1],
  ['derby', 0, 'cotton', 2, 1, false, 0],
  ['farm-n', 0, 'brewery', 0, 1, false, 2],
];

/** canal, owner */
const CANALS: [string, number][] = [
  ['birmingham--walsall', 0],
  ['walsall--wolverhampton', 1],
  ['wolverhampton--dudley', 2],
  ['birmingham--dudley', 0],
  ['coventry--birmingham', 1],
  ['tamworth--birmingham', 2],
  ['birmingham--worcester', 1],
  ['kidderminster--worcester', 2],
  ['stoke--stone', 0],
  ['stone--stafford', 0],
  ['derby--burton', 1],
  ['cannock--walsall', 2],
];

export function showroom(): GameState {
  const g = newGame(defaultSetup(), SEED);
  const tiles: Record<string, TileState> = {};
  for (const [town, slot, industry, owner, level, flipped, cubes] of TILES) tiles[`${town}:${slot}`] = { owner, industry, level, flipped, cubes };
  const links: GameState['links'] = {};
  for (const [id, owner] of CANALS) links[id] = { owner, era: 'canal' };
  return { ...g, tiles, links };
}
