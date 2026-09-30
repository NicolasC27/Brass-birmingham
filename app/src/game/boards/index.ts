/* ------------------------------------------------------------------ */
/* The boards, and the one in play.                                    */
/*                                                                     */
/* A board is a geography: towns with their sockets, edge merchants,   */
/* links, and how many location cards each town deals. Everything else */
/* — the tiles, the market, the money, the rules — is the same game on */
/* whichever board it is played.                                       */
/*                                                                     */
/* The board in play is module state, set once when a game is made and */
/* read by the geometry that hangs off it. A game carries its board's  */
/* id in its setup, so a game replayed from seed and actions — by the  */
/* analysis, by the server, by a bot — stands on the same ground it    */
/* was played on.                                                      */
/* ------------------------------------------------------------------ */

import type { LinkDef, Merchant, Town } from '../types';
import { MIDLANDS } from './midlands';
import type { BoardDef } from './types';
import { VENETO } from './veneto';

export type { BoardDef, LinkSpec, MerchantDef, Space, TownDef } from './types';

/** world upscale: the 1600×1100 canvas a board is drawn on → the 3200×1800
 *  world every board is played in (v13 "maximum air": ×2.0 / ×1.6364) */
const SX = 3200 / 1600;
const SY = 1800 / 1100;
const wx = (x: number): number => Math.round(x * SX);
const wy = (y: number): number => Math.round(y * SY);

/** socket offsets per town slot-count (sockets are 64×44, medallion r=22) */
const SLOT_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, -70]],
  2: [[-74, -26], [74, 26]],
  3: [[0, -78], [-78, 34], [78, 34]],
  4: [[-44, -78], [44, -78], [-82, 34], [82, 34]],
};

/** a board placed on the world: what the engine and the renderer read */
export interface Board {
  id: string;
  name: string;
  blurb: string;
  towns: Town[];
  merchants: Merchant[];
  links: LinkDef[];
  locationCards: Record<string, [number, number, number]>;
  nodePos: Record<string, [number, number]>;
  townById: Record<string, Town>;
  merchantById: Record<string, Merchant>;
}

function place(def: BoardDef): Board {
  const towns: Town[] = def.towns.map((d) => {
    const layout = SLOT_LAYOUT[d.spaces.length];
    if (!layout) throw new Error(`${def.id}: ${d.id} has ${d.spaces.length} sockets, no layout for that`);
    return {
      id: d.id,
      name: d.name,
      x: wx(d.x),
      y: wy(d.y),
      farm: d.farm,
      slots: d.spaces.map((allows, i) => ({ allows, x: wx(d.x + layout[i][0]), y: wy(d.y + layout[i][1]) })),
    };
  });
  const merchants: Merchant[] = def.merchants.map((m) => ({ ...m, x: wx(m.x), y: wy(m.y) }));
  const links: LinkDef[] = def.links.map((l) => ({
    id: `${l.a}--${l.b}`,
    a: l.a,
    b: l.b,
    canal: l.canal ?? true,
    rail: l.rail ?? true,
    ...(l.path ? { path: l.path.map(([x, y]) => [wx(x), wy(y)] as [number, number]) } : {}),
    ...(l.alsoConnects ? { alsoConnects: l.alsoConnects } : {}),
  }));
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    towns,
    merchants,
    links,
    locationCards: def.locationCards,
    nodePos: Object.fromEntries([
      ...towns.map((t) => [t.id, [t.x, t.y] as [number, number]]),
      ...merchants.map((m) => [m.id, [m.x, m.y] as [number, number]]),
    ]),
    townById: Object.fromEntries(towns.map((t) => [t.id, t])),
    merchantById: Object.fromEntries(merchants.map((m) => [m.id, m])),
  };
}

const DEFS: BoardDef[] = [MIDLANDS, VENETO];
/** every board, placed on the world, by its id */
export const BOARDS: Record<string, Board> = Object.fromEntries(DEFS.map((d) => [d.id, place(d)]));
/** the ids in the order they are offered */
export const BOARD_IDS: string[] = DEFS.map((d) => d.id);
/** the board a game stands on when its setup says nothing */
export const DEFAULT_BOARD = MIDLANDS.id;

export const boardOf = (id: string | undefined): Board => BOARDS[id ?? DEFAULT_BOARD] ?? BOARDS[DEFAULT_BOARD];
