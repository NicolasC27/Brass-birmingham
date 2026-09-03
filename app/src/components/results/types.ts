/**
 * Final-ledger storage contract (brassworks.final.v1), written by the game
 * engine at the end of the last era and read by the /results ceremony.
 */

import { PLAYER_COLORS, type PlayerColor } from "@/components/setup/constants";
import { tr } from "@/i18n";

export const FINAL_STORAGE_KEY = "brassworks.final.v1";

export interface FinalPlayer {
  name: string;
  color: PlayerColor;
  vp: number;
  income: number;
  links: number;
  industries: number;
}

export interface FinalEra {
  name: "Canal" | "Rail";
  scores: number[];
}

export interface FinalResult {
  players: FinalPlayer[];
  eras: FinalEra[];
  winnerIndex: number;
  timeline: string[];
}

function isPlayerColor(c: unknown): c is PlayerColor {
  return typeof c === "string" && PLAYER_COLORS.some((p) => p.id === c);
}

/** Parse the stored final ledger; null when absent or malformed. */
export function readFinalResult(): FinalResult | null {
  try {
    const raw = localStorage.getItem(FINAL_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<FinalResult>;
    if (!Array.isArray(data.players) || data.players.length === 0) return null;

    const players: FinalPlayer[] = data.players.map((p) => ({
      name: typeof p?.name === "string" && p.name.trim() ? p.name : tr("results.nameless"),
      color: isPlayerColor(p?.color) ? p.color : "brass",
      vp: Number.isFinite(p?.vp) ? Number(p.vp) : 0,
      income: Number.isFinite(p?.income) ? Number(p.income) : 0,
      links: Number.isFinite(p?.links) ? Number(p.links) : 0,
      industries: Number.isFinite(p?.industries) ? Number(p.industries) : 0,
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

    return { players, eras, winnerIndex, timeline };
  } catch {
    return null;
  }
}

/** Rank players: VP desc, income as the tie-break (official rule). */
export function rankPlayers(result: FinalResult): { player: FinalPlayer; index: number }[] {
  return result.players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => b.player.vp - a.player.vp || b.player.income - a.player.income);
}

/** Era-scored VP total, falling back to the engine's reported VP. */
export function eraTotal(result: FinalResult, playerIdx: number): number {
  if (result.eras.length === 0) return result.players[playerIdx]?.vp ?? 0;
  return result.eras.reduce((sum, e) => sum + (e.scores[playerIdx] ?? 0), 0);
}
