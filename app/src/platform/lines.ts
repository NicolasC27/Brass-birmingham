import { setupOf } from '@/game/actions';
import { tallyGame } from '@/game/tally';
import type { GameState } from '@/game/types';
import type { PastGame } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The member's lines: where they built, town by town, over every game */
/* — the office's history carries a tally a game, and a game at home   */
/* adds its own here as it ends. The desk draws it on the map.         */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.lines.v1';

export interface Lines {
  /** tiles laid, by town */
  towns: Record<string, number>;
  games: number;
}

const empty = (): Lines => ({ towns: {}, games: 0 });

function readLocal(): Lines {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Lines>) : null;
    return v && v.towns && typeof v.towns === 'object' ? { towns: v.towns, games: v.games ?? 0 } : empty();
  } catch {
    return empty();
  }
}

/** a game at home is over: the human seat's towns are added to the lines */
export function noteLines(g: GameState): void {
  if (g.phase !== 'game-over' || g.abandoned) return;
  const me = g.players.findIndex((p) => !p.isBot);
  if (me < 0) return;
  const tally = tallyGame(setupOf(g), g.seed, g.actions)[me];
  if (!tally) return;
  const lines = readLocal();
  for (const [town, n] of Object.entries(tally.towns)) lines.towns[town] = (lines.towns[town] ?? 0) + n;
  lines.games += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* non-fatal */
  }
}

/** every line the member drew: the office's games and the games at home */
export function linesOf(history: PastGame[], me: string | null): Lines {
  const out = readLocal();
  if (!me) return out;
  for (const g of history) {
    if (g.abandoned) continue;
    const p = g.players.find((x) => x.id === me);
    if (!p?.tally) continue;
    for (const [town, n] of Object.entries(p.tally.towns)) out.towns[town] = (out.towns[town] ?? 0) + n;
    out.games += 1;
  }
  return out;
}
