import type { PastGame, PublicTable } from '@/online/table';

/* ------------------------------------------------------------------ */
/* The chronicle. The club's news, told the way a Midlands paper of    */
/* the period would tell it: the same fact, a few ways of saying it,   */
/* chosen by the table's code so a line reads the same at every visit. */
/* Nothing is invented — the winner, the points, the round are the    */
/* office's; only the voice is the journal's.                          */
/* ------------------------------------------------------------------ */

const VARIANTS = 3;

const hash = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export type Story = { key: string; vars: Record<string, string | number> };

/** a past game of mine, as the chronicle tells it — a run of wins gets its own line */
export function storyOfGame(game: PastGame, me: string, streak: number, title: string): Story {
  const winner = game.players[game.winner];
  const won = winner?.id === me;
  const vars = { table: title, name: winner?.name ?? '—', vp: winner?.vp ?? 0, n: streak };
  if (won && streak >= 3) return { key: 'platform.chronicle.streak', vars };
  return { key: `platform.chronicle.${won ? 'won' : 'lost'}.${hash(game.code) % VARIANTS}`, vars };
}

/** a table in play, as the chronicle tells it */
export function storyOfTable(table: PublicTable, title: string): Story {
  const cur = table.current !== undefined ? table.seats[table.current] : undefined;
  return { key: `platform.chronicle.live.${hash(table.code) % VARIANTS}`, vars: { table: title, round: table.round ?? 1, name: cur?.name ?? '—' } };
}

/** how many of my latest games in a row I won, counting from the latest */
export function winStreak(history: PastGame[], me: string): number {
  let n = 0;
  for (const g of [...history].sort((a, b) => b.finishedAt - a.finishedAt)) {
    if (g.players[g.winner]?.id !== me) break;
    n += 1;
  }
  return n;
}
