import type { RankTier } from '@/components/platform/RankBadge';
import type { Rating, Tier } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The office's cote, read as the club's rank badge: the guild ranks   */
/* wear the badge's metals, two divisions per rank, the placements     */
/* shown as such until the five are played.                            */
/* ------------------------------------------------------------------ */

export const PLACEMENTS = 5;

const METAL: Record<Tier, RankTier> = { apprentice: 'bronze', journeyman: 'fer', foreman: 'acier', industrialist: 'laiton', magnate: 'or' };
const FLOOR: Record<Tier, number> = { apprentice: 1000, journeyman: 1200, foreman: 1400, industrialist: 1600, magnate: 1800 };

export interface RankView {
  tier: RankTier | 'placement';
  /** the division inside the rank: II then I */
  division?: string;
  /** points inside the division, 0–99 */
  lp?: number;
  /** placements played so far, while the cote is not firm */
  placementDone: number | null;
  /** progress inside the division, 0–100 */
  progress: number;
  rating: number | null;
}

/** what the badge shows for this season's cote (null: no ranked game yet) */
export function rankOf(rating: Rating | null | undefined): RankView {
  if (!rating) return { tier: 'placement', placementDone: 0, progress: 0, rating: null };
  if (rating.placements > 0) return { tier: 'placement', placementDone: PLACEMENTS - rating.placements, progress: Math.round(((PLACEMENTS - rating.placements) / PLACEMENTS) * 100), rating: rating.rating };
  const above = Math.max(0, rating.rating - FLOOR[rating.tier]);
  const division = rating.tier === 'magnate' ? undefined : above >= 100 ? 'I' : 'II';
  const lp = rating.tier === 'magnate' ? above : above % 100;
  return { tier: METAL[rating.tier], division, lp, placementDone: null, progress: rating.tier === 'magnate' ? 100 : lp, rating: rating.rating };
}
