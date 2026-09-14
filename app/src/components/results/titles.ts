import type { PlayerState } from '@/game/types';

/* Titles — what a game says of each player once it is over, read from the
   tally of what they did: one title at most per player, one player at
   most per title, the higher-ranked keeping it on a tie. */

export type Title = 'merchant' | 'builder' | 'railwayman' | 'engineer' | 'banker';
export type Tally = PlayerState['stats'];

const CLAIMS: { title: Title; of: (t: Tally) => number; least: number }[] = [
  { title: 'merchant', of: (t) => t.sold, least: 3 },
  { title: 'builder', of: (t) => t.built, least: 4 },
  { title: 'railwayman', of: (t) => t.links, least: 4 },
  { title: 'engineer', of: (t) => t.developed, least: 2 },
  { title: 'banker', of: (t) => t.loans, least: 2 },
];

/** `ranked` lists player indices best first; returns a title per player index or null */
export function titlesFor(tallies: (Tally | undefined)[], ranked: number[]): (Title | null)[] {
  const out: (Title | null)[] = tallies.map(() => null);
  for (const claim of CLAIMS) {
    let best = -1;
    let bestScore = 0;
    for (const i of ranked) {
      const t = tallies[i];
      if (!t || out[i]) continue;
      const score = claim.of(t);
      if (score >= claim.least && score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best >= 0) out[best] = claim.title;
  }
  return out;
}
