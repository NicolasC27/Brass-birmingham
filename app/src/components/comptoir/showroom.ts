import { defaultSetup, newGame } from '@/game/engine';
import type { GameState, IndustryType, TileState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The showroom: the table the counter's window shows. A game dealt    */
/* from the usual setup with a few canals laid straight into the       */
/* state, so a ground is seen for itself, bare — and a tile of every   */
/* trade when it is a set of tiles that is looked at.                  */
/* ------------------------------------------------------------------ */

/** the same deal every time: the window is a shop window, not a game */
const SEED = 1842;

/** town, slot, trade, owner, level, flipped, cubes — for the tiles alone */
const TILES: [string, number, IndustryType, number, number, boolean, number][] = [
  ['birmingham', 0, 'cotton', 0, 1, true, 0],
  ['birmingham', 1, 'manufacturer', 1, 2, false, 0],
  ['birmingham', 2, 'iron', 2, 1, false, 2],
  ['coventry', 0, 'pottery', 1, 1, false, 0],
  ['coventry', 1, 'coal', 0, 1, false, 3],
  ['walsall', 0, 'iron', 1, 1, true, 0],
  ['dudley', 0, 'coal', 2, 2, false, 4],
  ['wolverhampton', 0, 'manufacturer', 0, 1, true, 0],
  ['stone', 0, 'brewery', 1, 1, false, 2],
  ['stafford', 1, 'pottery', 2, 1, true, 0],
];

/** canal, owner: three, so the ground shows how a route is worn */
const CANALS: [string, number][] = [
  ['birmingham--walsall', 0],
  ['coventry--birmingham', 1],
  ['birmingham--dudley', 2],
];

export function showroom(withTiles: boolean): GameState {
  const g = newGame(defaultSetup(), SEED);
  const tiles: Record<string, TileState> = {};
  if (withTiles) for (const [town, slot, industry, owner, level, flipped, cubes] of TILES) tiles[`${town}:${slot}`] = { owner, industry, level, flipped, cubes };
  const links: GameState['links'] = {};
  for (const [id, owner] of CANALS) links[id] = { owner, era: 'canal' };
  return { ...g, tiles, links };
}
