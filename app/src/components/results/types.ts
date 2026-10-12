/**
 * The final ledger as the ceremony reads it: the board leaves it in memory
 * at the end of the last era (game/final.ts), and /results shapes it here.
 */

import { PLAYER_COLORS, type PlayerColor } from "@/components/setup/constants";
import { heldFinal } from "@/game/final";
import { tr } from "@/i18n";


export interface FinalPlayer {
  name: string;
  color: PlayerColor;
  vp: number;
  income: number;
  links: number;
  industries: number;
  /** the tally of what the player did, for the titles */
  stats?: { built: number; links: number; sold: number; loans: number; developed: number };
  bot?: boolean;
  /** the purse at the close: the last tie-break after the income level */
  money?: number;
}

export interface FinalEra {
  name: "Canal" | "Rail";
  scores: number[];
}

export interface FinalRound {
  era: "canal" | "rail";
  round: number;
  vp: number[];
  income: number[];
  money: number[];
}

export interface FinalResult {
  players: FinalPlayer[];
  eras: FinalEra[];
  winnerIndex: number;
  timeline: string[];
  history: FinalRound[];
  /** the table rose before the last scoring: the points stand as they were,
   *  and nobody is crowned */
  abandoned?: boolean;
  /** where the game stopped: the era and round of the last move */
  closedAt?: { era: "canal" | "rail"; round: number };
}

function isPlayerColor(c: unknown): c is PlayerColor {
  return typeof c === "string" && PLAYER_COLORS.some((p) => p.id === c);
}

/** Parse a final ledger — the one the board left by default; null when
 *  absent or malformed. */
export function readFinalResult(payload: unknown = heldFinal()): FinalResult | null {
  try {
    const data = payload as Partial<FinalResult> | null;
    if (!data || !Array.isArray(data.players) || data.players.length === 0) return null;

    const players: FinalPlayer[] = data.players.map((p) => ({
      name: typeof p?.name === "string" && p.name.trim() ? p.name : tr("results.nameless"),
      color: isPlayerColor(p?.color) ? p.color : "brass",
      vp: Number.isFinite(p?.vp) ? Number(p.vp) : 0,
      income: Number.isFinite(p?.income) ? Number(p.income) : 0,
      links: Number.isFinite(p?.links) ? Number(p.links) : 0,
      industries: Number.isFinite(p?.industries) ? Number(p.industries) : 0,
      stats: p?.stats && typeof p.stats === "object" ? p.stats : undefined,
      bot: !!p?.bot,
      ...(Number.isFinite(p?.money) ? { money: Number(p.money) } : {}),
    }));

    const eras: FinalEra[] = Array.isArray(data.eras)
      ? data.eras
          .filter((e) => e && (e.name === "Canal" || e.name === "Rail"))
          .map((e) => ({
            name: e.name,
            scores: Array.isArray(e.scores)
              ? players.map((_, i) => (Number.isFinite(e.scores[i]) ? Number(e.scores[i]) : 0))
              : players.map(() => 0),
          }))
      : [];

    const winnerIndex =
      typeof data.winnerIndex === "number" &&
      data.winnerIndex >= 0 &&
      data.winnerIndex < players.length
        ? data.winnerIndex
        : 0;

    const timeline = Array.isArray(data.timeline)
      ? data.timeline.filter((t): t is string => typeof t === "string")
      : [];

    const nums = (v: unknown): number[] =>
      Array.isArray(v) ? players.map((_, i) => (Number.isFinite(v[i]) ? Number(v[i]) : 0)) : players.map(() => 0);
    const history: FinalRound[] = Array.isArray((data as { history?: unknown }).history)
      ? ((data as { history: Partial<FinalRound>[] }).history)
          .filter((h) => h && (h.era === "canal" || h.era === "rail"))
          .map((h) => ({ era: h.era as "canal" | "rail", round: Number(h.round) || 0, vp: nums(h.vp), income: nums(h.income), money: nums(h.money) }))
      : [];

    /* the ledger carries no purse: the account book's last line has it */
    const last = history[history.length - 1];
    if (last) players.forEach((p, i) => {
      if (p.money === undefined) p.money = last.money[i];
    });

    const closedAt =
      data.closedAt && (data.closedAt.era === "canal" || data.closedAt.era === "rail")
        ? { era: data.closedAt.era, round: Number(data.closedAt.round) || 0 }
        : last
          ? { era: last.era, round: last.round }
          : undefined;

    return { players, eras, winnerIndex, timeline, history, abandoned: !!data.abandoned, closedAt };
  } catch {
    return null;
  }
}

/** Rank players as the engine does (official rule): VP, then income level,
 *  then money. The engine's own winner leads whatever the ledger lacks, so
 *  the page never crowns someone the table did not. */
export function rankPlayers(result: FinalResult): { player: FinalPlayer; index: number }[] {
  return result.players
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        Number(b.index === result.winnerIndex) - Number(a.index === result.winnerIndex) ||
        b.player.vp - a.player.vp ||
        b.player.income - a.player.income ||
        (b.player.money ?? 0) - (a.player.money ?? 0),
    );
}

/** How the first place was settled when the top two are level on points:
 *  by the income level, else by the purse; null when points decided it. */
export function tieBreakOf(
  result: FinalResult,
): { by: "income" | "money"; hi: number; lo: number } | null {
  const [a, b] = rankPlayers(result);
  if (!a || !b || a.player.vp !== b.player.vp) return null;
  if (a.player.income !== b.player.income)
    return { by: "income", hi: a.player.income, lo: b.player.income };
  if (a.player.money !== undefined && b.player.money !== undefined && a.player.money !== b.player.money)
    return { by: "money", hi: a.player.money, lo: b.player.money };
  return null;
}

/** Era-scored VP total, falling back to the engine's reported VP. */
export function eraTotal(result: FinalResult, playerIdx: number): number {
  if (result.eras.length === 0) return result.players[playerIdx]?.vp ?? 0;
  return result.eras.reduce((sum, e) => sum + (e.scores[playerIdx] ?? 0), 0);
}
