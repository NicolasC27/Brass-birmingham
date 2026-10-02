import { setupOf } from '@/game/actions';
import { localGame } from '@/game/local';
import { reviewGame, swingsFor } from '@/game/review';
import { shareFragment } from '@/game/share';
import type { Era, GameState } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The feuilleton: the last game played out at home, told in three     */
/* moments — the moves that swung the lead the most, read off the      */
/* positions alone — each a link that opens the table at that move.    */
/* The game travels in the link (share.ts), so the episode stands even */
/* after the register has pruned the save. Kept in this browser.       */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.feuilleton.v1';
const MOMENTS = 3;

export interface Moment {
  at: number;
  era: Era;
  round: number;
  /** who played it, and by how much the reader's lead moved */
  by: string;
  mine: boolean;
  shift: number;
}

export interface Episode {
  code: string;
  name: string;
  at: number;
  me: string;
  /** every seat's points at the close, the reader's first */
  scores: { name: string; vp: number; mine: boolean }[];
  moments: Moment[];
  /** the game carried in a fragment; `&at=<move>` opens it on a moment */
  fragment: string;
}

/** a game at home is over: the episode written */
export function noteFeuilleton(g: GameState, code: string): Episode | null {
  if (g.phase !== 'game-over' || g.abandoned) return null;
  const me = g.players.findIndex((p) => !p.isBot);
  if (me < 0 || g.actions.length < 6) return null;
  const review = reviewGame(setupOf(g), g.seed, g.actions);
  const moments = swingsFor(review, me)
    .filter((s) => s.at > 0)
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
    .slice(0, MOMENTS)
    .sort((a, b) => a.at - b.at)
    .map((s) => ({ at: s.at, era: s.era, round: s.round, by: g.players[s.by]?.name ?? '', mine: s.by === me, shift: s.shift }));
  const scores = g.players.map((p, i) => ({ name: p.name, vp: p.vp, mine: i === me })).sort((a, b) => Number(b.mine) - Number(a.mine) || b.vp - a.vp);
  const episode: Episode = { code, name: localGame(code)?.name ?? code, at: Date.now(), me: g.players[me].name, scores, moments, fragment: shareFragment(g) };
  try {
    localStorage.setItem(KEY, JSON.stringify(episode));
  } catch {
    /* the shelf is full: no episode this time */
  }
  return episode;
}

/** the episode on the shelf, if any */
export function readFeuilleton(): Episode | null {
  try {
    const raw = localStorage.getItem(KEY);
    const e = raw ? (JSON.parse(raw) as Episode) : null;
    return e && Array.isArray(e.moments) && typeof e.fragment === 'string' ? e : null;
  } catch {
    return null;
  }
}

/** an episode kept elsewhere, folded in: the later of the two stays */
export function mergeFeuilleton(e: Episode): void {
  const mine = readFeuilleton();
  if (!Array.isArray(e.moments) || typeof e.fragment !== 'string' || typeof e.at !== 'number') return;
  if (mine && mine.at >= e.at) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    /* non-fatal */
  }
}

/** the address of a moment: the table, the game in its fragment, the move */
export const momentAddress = (e: Episode, m: Moment): string => `/game/local/${e.code}${e.fragment}&at=${m.at}`;
