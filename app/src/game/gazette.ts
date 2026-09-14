/* The Gazette's copy — three headlines on a round just played, set from
   the ledger in the style of a Midlands paper of 1850. Everyone at the
   table reads the same ledger, so nothing goes over the wire. */
import { TOWN_BY_ID } from './data';
import type { GameState, LedgerEntry } from './types';

export interface Headline {
  key: string;
  vars: Record<string, string | number>;
  /** the louder the story, the higher on the page */
  weight: number;
}

/** the round's stories, loudest first, three at most */
export function headlinesFor(g: GameState, round: number, era: GameState['era']): Headline[] {
  const entries = g.ledger.filter((e) => e.round === round && e.era === era && e.player !== undefined);
  if (!entries.length) return [];
  const out: Headline[] = [];
  const name = (e: LedgerEntry) => g.players[e.player!]?.name ?? '';
  /* the purse opened widest */
  const spent = new Map<number, number>();
  for (const e of entries) spent.set(e.player!, (spent.get(e.player!) ?? 0) + Number(e.vars?.spent ?? 0));
  const [bigSpender, sum] = [...spent.entries()].sort((a, b) => b[1] - a[1])[0] ?? [-1, 0];
  if (sum >= 20) out.push({ key: 'spender', vars: { name: g.players[bigSpender].name, n: sum }, weight: sum });
  /* the bank, again */
  const loans = new Map<number, number>();
  for (const e of entries) if (e.key === 'loan') loans.set(e.player!, (loans.get(e.player!) ?? 0) + 1);
  for (const [who, n] of loans) out.push({ key: n > 1 ? 'loansTwice' : 'loan', vars: { name: g.players[who].name }, weight: 12 + n * 6 });
  /* goods sent to market */
  const sold = new Map<number, LedgerEntry[]>();
  for (const e of entries) if (e.key === 'sell') sold.set(e.player!, [...(sold.get(e.player!) ?? []), e]);
  for (const [who, es] of sold) {
    const merchants = [...new Set(es.map((e) => String(e.vars?.merchant ?? '')))];
    out.push({ key: es.length > 1 ? 'sellsMany' : 'sells', vars: { name: g.players[who].name, n: es.length, merchant: merchants[0] ?? '', goods: String(es[0].vars?.industry ?? '') }, weight: 10 + es.length * 8 });
  }
  /* rails laid two at a time, a network stretched */
  for (const e of entries) {
    if (e.key === 'network' && e.vars?.a2) out.push({ key: 'doubleRail', vars: { name: name(e), a: String(e.vars.a), b: String(e.vars.b) }, weight: 18 });
  }
  /* works raised: the busiest builder */
  const built = new Map<number, LedgerEntry[]>();
  for (const e of entries) if (e.key === 'build') built.set(e.player!, [...(built.get(e.player!) ?? []), e]);
  const busiest = [...built.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (busiest && busiest[1].length >= 2) out.push({ key: 'builds', vars: { name: g.players[busiest[0]].name, n: busiest[1].length, town: String(busiest[1][0].vars?.town ?? '') }, weight: 9 + busiest[1].length * 4 });
  /* a turn let go */
  for (const e of entries) if (e.key === 'pass') out.push({ key: 'passes', vars: { name: name(e) }, weight: 7 });
  /* a flip: the works that paid */
  for (const e of entries) if (e.key === 'flip') out.push({ key: 'flips', vars: { name: name(e), goods: String(e.vars?.industry ?? ''), town: TOWN_BY_ID[e.region ?? '']?.name ?? '' }, weight: 6 });
  out.sort((a, b) => b.weight - a.weight);
  /* one story per player at most, so the page is not all one name */
  const seen = new Set<string>();
  const picked: Headline[] = [];
  for (const h of out) {
    const who = String(h.vars.name);
    if (seen.has(who)) continue;
    seen.add(who);
    picked.push(h);
    if (picked.length === 3) break;
  }
  return picked.length ? picked : [{ key: 'quiet', vars: {}, weight: 0 }];
}
