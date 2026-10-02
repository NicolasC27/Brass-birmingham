import { incomeLevel } from '@/game/data';
import { deedsOf, type Deeds } from '@/game/plan';
import type { Tally } from '@/game/tally';
import type { GameState } from '@/game/types';
import type { PastGame } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The patents. Distinctions granted for a thing done at a table, and   */
/* printed like letters patent: the brewer's, the ironmaster's, the    */
/* one for winning without the bank. A patent is granted once. A game  */
/* at home is read from its deeds; a game of the office from the tally */
/* it sends with the history. The wall lives in this browser.          */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.patents.v1';

export type PatentId = 'brewer' | 'ironmaster' | 'noBanker' | 'network' | 'centenary' | 'spinner' | 'potter' | 'doubleRail' | 'rentier';
export const PATENT_IDS: PatentId[] = ['brewer', 'ironmaster', 'noBanker', 'network', 'centenary', 'spinner', 'potter', 'doubleRail', 'rentier'];

interface Read {
  vp: number;
  won: boolean;
  deeds?: Deeds;
  tally?: Tally;
  income: number;
}

const flipped = (d: Deeds, industry: Deeds['built'][number]['industry'], level = 1) => d.built.filter((b) => b.industry === industry && b.level >= level && b.sold).length;

/** what each patent asks; a rule that cannot be read from a tally stays quiet there */
const RULES: Record<PatentId, (r: Read) => boolean> = {
  brewer: (r) => (r.deeds ? flipped(r.deeds, 'brewery') >= 4 : (r.tally?.industries.brewery ?? 0) >= 4),
  ironmaster: (r) => (r.deeds ? r.deeds.built.some((b) => b.industry === 'iron' && b.level >= 4) : (r.tally?.industries.iron ?? 0) >= 3),
  noBanker: (r) => r.won && (r.deeds ? r.deeds.loans === 0 : r.tally?.loans === 0),
  network: (r) => (r.deeds ? r.deeds.links.length : (r.tally?.links ?? 0)) >= 14,
  centenary: (r) => r.vp >= 150,
  spinner: (r) => (r.deeds ? flipped(r.deeds, 'cotton') >= 4 : (r.tally?.industries.cotton ?? 0) >= 4),
  potter: (r) => (r.deeds ? flipped(r.deeds, 'pottery', 3) >= 1 : (r.tally?.industries.pottery ?? 0) >= 3),
  doubleRail: (r) => !!r.deeds && r.deeds.links.filter((l) => l.double).length >= 3,
  rentier: (r) => r.income >= 24,
};

export interface Patent {
  id: PatentId;
  at: number;
  table: string;
}

const readAll = (): Patent[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) ? v.filter((p): p is Patent => !!p && PATENT_IDS.includes(p.id)) : [];
  } catch {
    return [];
  }
};
const writeAll = (list: Patent[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
};

/** the wall, the latest grant first */
export const listPatents = (): Patent[] => readAll().sort((a, b) => b.at - a.at);

function grant(read: Read, table: string, at = Date.now()): Patent[] {
  const have = readAll();
  const held = new Set(have.map((p) => p.id));
  const fresh = PATENT_IDS.filter((id) => !held.has(id) && RULES[id](read)).map((id) => ({ id, at, table }));
  if (fresh.length) writeAll([...have, ...fresh]);
  return fresh;
}

/** a game at home is over: the patents its deeds earn, granted */
export function grantFromGame(g: GameState, table: string): Patent[] {
  if (g.phase !== 'game-over' || g.abandoned) return [];
  const me = g.players.findIndex((p) => !p.isBot);
  if (me < 0) return [];
  const vps = g.players.map((x) => x.vp);
  const d = deedsOf(g, me);
  return grant({ vp: vps[me], won: vps.every((v, i) => i === me || v < vps[me]), deeds: d, income: incomeLevel(g.players[me].income) }, table);
}

/** the office's history read through: whatever a past game earns, granted at its date */
export function grantFromHistory(history: PastGame[], me: string): Patent[] {
  const out: Patent[] = [];
  for (const g of [...history].sort((a, b) => a.finishedAt - b.finishedAt)) {
    if (g.abandoned) continue;
    const seat = g.players.findIndex((p) => p.id === me);
    const p = g.players[seat];
    if (!p?.tally) continue;
    out.push(...grant({ vp: p.vp, won: g.winner === seat, tally: p.tally, income: p.tally.income }, g.name, g.finishedAt));
  }
  return out;
}

/** patents kept elsewhere, folded in: a patent held stays, one new is granted at its own date */
export function mergePatents(list: unknown[]): void {
  const have = readAll();
  const held = new Set(have.map((p) => p.id));
  const fresh: Patent[] = [];
  for (const p of list) {
    if (!p || typeof p !== 'object' || !PATENT_IDS.includes((p as Patent).id) || typeof (p as Patent).at !== 'number') continue;
    const { id, at, table } = p as Patent;
    if (held.has(id)) continue;
    held.add(id);
    fresh.push({ id, at, table: String(table ?? '') });
  }
  if (fresh.length) writeAll([...have, ...fresh]);
}

/** patents granted within the week: the front page mentions them */
export const freshPatents = (now = Date.now()): Patent[] => listPatents().filter((p) => now - p.at < 7 * 24 * 3600 * 1000);
