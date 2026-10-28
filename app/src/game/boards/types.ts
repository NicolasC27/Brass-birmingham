/* ------------------------------------------------------------------ */
/* A board, before it is placed on the world.                          */
/*                                                                     */
/* Coordinates below are written on the original 1600×1100 canvas the  */
/* Midlands was drawn on; the registry scales them to the 3200×1800    */
/* world every board shares, so a second board can be laid out with a  */
/* ruler on the same paper as the first.                               */
/* ------------------------------------------------------------------ */

import type { IndustryType } from '../types';

/** the industries a single socket will take */
export type Space = IndustryType[];

export interface TownDef {
  id: string;
  name: string;
  /** on the 1600×1100 canvas */
  x: number;
  y: number;
  /** sockets in board order; their count picks the cluster layout */
  spaces: Space[];
  /** farm brewery: one brewery socket, industry cards only */
  farm?: boolean;
}

export interface MerchantDef {
  id: string;
  name: string;
  x: number;
  y: number;
  slots: number;
  minPlayers: number;
  bonus: { vp?: number; income?: number; money?: number; develop?: boolean };
}

export interface LinkSpec {
  a: string;
  b: string;
  /** default true; a rail-only link says canal: false */
  canal?: boolean;
  /** default true; a canal-only link says rail: false */
  rail?: boolean;
  /** a polyline on the 1600×1100 canvas, for a link that must bend */
  path?: [number, number][];
  /** one link that also connects a third node, without a second tile */
  alsoConnects?: string;
}

export interface BoardDef {
  id: string;
  /** shown in the setup and on the desk */
  name: string;
  /** one line of where and when, for the setup panel */
  blurb: string;
  towns: TownDef[];
  merchants: MerchantDef[];
  links: LinkSpec[];
  /** location cards per town, by player count (2, 3, 4) */
  locationCards: Record<string, [number, number, number]>;
}
