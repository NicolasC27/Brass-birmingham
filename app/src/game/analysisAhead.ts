import { setupOf } from './actions';
import { PASSES } from './analysis';
import type { Reading, Verdict } from './analysis';
import { analysisKey, keepAnalysis, readKept } from './analysisKeep';
import type { Note } from './analysisWorker';
import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* The judge thinks ahead of time.                                     */
/*                                                                     */
/* Reading a whole game takes a worker a minute or two, and the reader */
/* asks for it at the one moment they are least patient: the end. So   */
/* the first half is read while the second is being played — at the    */
/* turn of the eras, on the thread of its own, and straight onto the   */
/* shelf. Nothing of it is shown while the game runs: the panel picks  */
/* it up at the end and reads on from there.                           */
/* ------------------------------------------------------------------ */

let ahead: { key: string; worker: Worker } | null = null;

/** stop whatever was being read ahead (the panel asks for its own reading) */
export function stopAhead(): void {
  ahead?.worker.terminate();
  ahead = null;
}

/** read this game as it stands and keep it, in the background: the panel that
 *  opens later finds the first half done. Does nothing when the shelf already
 *  holds this much of the game, or when one is being read already. */
export function readAhead(game: GameState, table: string, seat: number): void {
  if (typeof Worker === 'undefined' || seat < 0 || !game.actions.length) return;
  const key = analysisKey(table, game.seed);
  if (ahead?.key === key) return;
  const kept = readKept(key, game.actions.length);
  if (kept && kept.moves >= game.actions.length) return;
  stopAhead();
  let worker: Worker;
  try {
    worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  ahead = { key, worker };
  const moves = game.actions.length;
  const seats: Record<number, Reading[]> = { ...(kept?.seats ?? {}) };
  const verdicts: Record<number, Verdict> = { ...(kept?.verdicts[seat] ?? {}) };
  let total = 0;
  worker.onmessage = (e: MessageEvent<Note>) => {
    const n = e.data;
    if (n.kind === 'position') {
      seats[n.k] = n.seats;
      total = n.total;
    } else if (n.kind === 'turn') {
      verdicts[n.verdict.at] = n.verdict;
      total = n.total;
    } else if (n.kind === 'done') {
      /* a whole reading of the game as it stood: the shelf keeps it, stamped
         with the judge that wrote it, and a later reading picks up after it */
      keepAnalysis(key, moves, { seats, verdicts: { ...(kept?.verdicts ?? {}), [seat]: verdicts }, roads: kept?.roads ?? {}, total });
      stopAhead();
    } else if (n.kind === 'failed') {
      stopAhead();
    }
  };
  worker.postMessage({ setup: setupOf(game), seed: game.seed, actions: game.actions, me: seat, passes: PASSES, from: kept?.moves ?? 0 });
}
