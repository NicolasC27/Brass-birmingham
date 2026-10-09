import type { RailMode } from './boardOptions';

/* ------------------------------------------------------------------ */
/* The players' column, as plain arithmetic: which of its three states  */
/* is on show, how much of a purse the round has taken, which way a    */
/* seat drifts in the next round's order, and where the ticks fall on  */
/* the thin income filet. No React here, so it can be read and tested  */
/* on its own.                                                         */
/* ------------------------------------------------------------------ */

export const RAIL_MODES: readonly RailMode[] = ['medals', 'cards', 'slip'];

/** a stored state made good again: anything unknown opens on the medallions */
export function sanitizeRailMode(v: unknown): RailMode {
  return RAIL_MODES.includes(v as RailMode) ? (v as RailMode) : 'medals';
}

/**
 * The state actually on show. A game read again keeps its trimmed cards,
 * which carry the live standing; the focus view never spreads the cards,
 * though a column already put away in the slip stays there.
 */
export function shownRailMode(o: { mode: RailMode; focus: boolean; reading: boolean }): RailMode {
  if (o.reading) return 'cards';
  if (o.focus) return o.mode === 'slip' ? 'slip' : 'medals';
  return o.mode;
}

/**
 * The part of the purse this round has taken: what was spent, over what
 * was spent plus what is left. An untouched purse (or an empty one that
 * spent nothing) reads nought; the result always lies within 0..1.
 */
export function spentShare(spent: number, money: number): number {
  const s = Math.max(0, spent);
  const whole = s + Math.max(0, money);
  return whole > 0 ? Math.min(1, s / whole) : 0;
}

/** which way a seat moves in the next round's order (1 plays first) */
export function rankDrift(next: number, now: number): 'up' | 'down' | 'same' {
  return next < now ? 'up' : next > now ? 'down' : 'same';
}

/**
 * The lantern's stop along the column: the active seat's place in the
 * order of play, or null when nobody is to act (the game is over, or the
 * seat is not in the order at all).
 */
export function lanternStop(order: readonly number[], current: number, over: boolean): number | null {
  if (over) return null;
  const at = order.indexOf(current);
  return at < 0 ? null : at;
}

/**
 * The graduations of the thin income filet: one every five spaces, the
 * tens a little longer and the only ones that carry their figure.
 */
export function filetTicks(max: number): { space: number; major: boolean }[] {
  const out: { space: number; major: boolean }[] = [];
  for (let s = 0; s <= max; s += 5) out.push({ space: s, major: s % 10 === 0 });
  return out;
}
