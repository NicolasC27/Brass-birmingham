import type { BuildTarget } from './engine';

/* ------------------------------------------------------------------ */
/* The one refusal worth telling when nothing takes a verb. The engine  */
/* says, of every place it is asked about, why that place will not do; */
/* the reader wants the reason that matters — what a canal, a mine or  */
/* a loan would open: coal, iron, money, the network — before the      */
/* merely structural ones (wrong slot, occupied) that hold for every   */
/* other place on the map. Pure: the engine's own sentences, said in   */
/* the reader's tongue by whoever shows them.                          */
/* ------------------------------------------------------------------ */

type Refused = { valid: boolean; reason?: string };
type Rank = readonly (string | RegExp)[];

/** a build refused, the most actionable reason first */
const BUILD_RANK: Rank = [
  'No connected coal — reach a mine or a merchant',
  'No coal left anywhere',
  'No iron available anywhere',
  /^Needs £/,
  'Not in your network',
  'Canal Era: one tile per location',
  /overbuil/,
  'Occupied by another industry',
  /era$/,
  /tiles left$/,
];

/** the refused target whose reason is the one worth telling: the best
 *  ranked, and among reasons ranked alike the one most targets give —
 *  the first target to give it. Null when none was refused */
export function refusalOf<T extends Refused>(targets: readonly T[], rank: Rank = BUILD_RANK): T | null {
  const count = new Map<string, number>();
  for (const x of targets) if (!x.valid && x.reason) count.set(x.reason, (count.get(x.reason) ?? 0) + 1);
  let best: { at: number; n: number; x: T } | null = null;
  for (const x of targets) {
    const reason = x.reason;
    if (x.valid || !reason) continue;
    let at = rank.findIndex((r) => (typeof r === 'string' ? r === reason : r.test(reason)));
    if (at < 0) at = rank.length;
    const n = count.get(reason) ?? 0;
    if (!best || at < best.at || (at === best.at && n > best.n)) best = { at, n, x };
  }
  return best?.x ?? null;
}

/** why no site takes the card */
export function whyNoBuild(targets: readonly BuildTarget[]): string {
  return refusalOf(targets)?.reason ?? 'No valid construction site for this card';
}
