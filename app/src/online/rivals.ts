import type { Desk, Table } from './table';

/** my record against the account in that seat, from the office's figures
 *  (kept by account id, so a namesake is never mistaken for a rival) */
export function recordAgainst(desk: Desk | null, table: Table | null, seat: number): { won: number; lost: number; played: number } | null {
  const id = table?.seats[seat]?.id;
  if (!desk || !id) return null;
  const r = desk.stats.rivals?.find((x) => x.id === id);
  return r && r.played ? { won: r.won, lost: r.lost, played: r.played } : null;
}
