import type { BuildTarget, LinkTarget, SellTarget } from './engine';

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

/** a build refused, the most actionable reason first; then the nearest —
 *  what stands in the way at a place of the network (one tile to a town,
 *  a tile there already) before a place out of it */
const BUILD_RANK: Rank = [
  'No connected coal — reach a mine or a merchant',
  'No coal left anywhere',
  'No iron available anywhere',
  /^Needs £/,
  'Canal Era: one tile per location',
  /overbuil/,
  'Occupied by another industry',
  'Not in your network',
  /era$/,
  /tiles left$/,
];

/** a link refused: the money first — a link refused for it has its coal,
 *  and a loan lays it, as the guide's own block says — then the coal a
 *  rail burns, then the network it must touch */
const LINK_RANK: Rank = [/^Needs £/, 'No connected coal for the locomotives', 'No coal left anywhere', 'Link must touch your network'];

/** a tile kept from developing: no iron to be had, then no money for
 *  the market's, then the lightbulb no iron lifts */
const DEVELOP_RANK: Rank = ['No iron available anywhere', 'Cannot afford the iron', /^Lightbulb/];

/** no link the network could take: every one that touches it is laid */
export const NO_FREE_LINK = 'No free link touches your network';

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

/** a refusal the card itself gives — it names another town or another
 *  industry: nothing on the board would change it */
export const onTheCard = (reason: string | undefined): boolean => !!reason && /^This card builds |^Farm breweries take/.test(reason);

/** why no site takes the card */
export function whyNoBuild(targets: readonly BuildTarget[]): string {
  return refusalOf(targets)?.reason ?? 'No valid construction site for this card';
}

/** why no link can be laid: the coal or the money it lacks — else, money
 *  in hand, no free link is left that touches the network */
export function whyNoLink(targets: readonly LinkTarget[]): string {
  const best = refusalOf(targets, LINK_RANK)?.reason;
  return best && best !== 'Link must touch your network' ? best : NO_FREE_LINK;
}

/** why nothing can be developed: the iron, or the money the market asks
 *  for it — the lightbulb only when every tile left carries one */
export function whyNoDevelop(options: readonly Refused[]): string {
  return refusalOf(options, DEVELOP_RANK)?.reason ?? 'Nothing worth developing (needs iron)';
}

/** the way round a refusal, as the beginner's aid says it after the
 *  reason: its key under topbar.aid.none. A development refused for the
 *  money has its iron, and needs the purse; one refused for the tiles —
 *  lightbulbs alone left, or none — needs another use of the card */
export function noneAid(verb: string, reason?: string): string {
  if (verb !== 'develop') return verb;
  if (reason === 'Cannot afford the iron') return 'developMoney';
  if (reason && (/^Lightbulb/.test(reason) || reason.startsWith('Nothing worth developing'))) return 'developNone';
  return 'develop';
}

/** why nothing sells: the beer a works joined to its buyer lacks, else no
 *  works joined to one */
export function whyNoSale(targets: readonly SellTarget[]): string {
  return targets.find((x) => !x.valid && x.reason)?.reason ?? 'No goods connected to a demanding merchant';
}
