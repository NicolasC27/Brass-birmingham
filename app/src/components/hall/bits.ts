import type { Tier } from '@/online/table';

/* ------------------------------------------------------------------ */
/* Small facts every hall screen shares: a seat's portrait, the colour */
/* of a rank, days and minutes.                                        */
/* ------------------------------------------------------------------ */

/** the oil portrait a seat shows (the board picks the same way, by index) */
export const portraitFor = (index: number): string => `/portrait-${(index % 4) + 1}.webp`;

/** the colour a rank wears: the player colours climb the ladder, the top is the accent */
export const TIER_TONE: Record<Tier, string> = { apprentice: 'var(--h-muted)', journeyman: 'var(--h-verdigris)', foreman: 'var(--h-steel)', industrialist: 'var(--h-brass)', magnate: 'var(--h-accent)' };

/** whole days until a moment, never negative */
export const daysUntil = (at: number): number => Math.max(0, Math.ceil((at - Date.now()) / 86_400_000));

/** m:ss since a moment */
export function elapsed(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
