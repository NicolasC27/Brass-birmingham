import { onlineWire } from '@/online/net';

/* ------------------------------------------------------------------ */
/* What a reader writes beside a game: a word pinned on a town, and a  */
/* page of their own — plans, things to remember, what a rival seems   */
/* to be after.                                                       */
/*                                                                    */
/* The office keeps them, one row an account and a game, so they come */
/* back on another machine and two people at one table never read     */
/* each other's. They travel with the game: read when it opens,       */
/* written a beat after the pen stops.                                */
/* ------------------------------------------------------------------ */

export interface Notes {
  /** a word a town was pinned with, by town id */
  pins: Record<string, string>;
  /** the page kept beside the game */
  page: string;
}

export const NO_NOTES: Notes = { pins: {}, page: '' };

/** the notes this account keeps beside that game */
export async function readNotes(code: string): Promise<Notes> {
  const wire = onlineWire();
  if (!wire || wire.stranger) return NO_NOTES;
  let body: unknown;
  try {
    body = await wire.askNotes(code);
  } catch {
    return NO_NOTES;
  }
  if (!body || typeof body !== 'object') return NO_NOTES;
  const n = body as Partial<Notes>;
  return { pins: n.pins && typeof n.pins === 'object' ? n.pins : {}, page: typeof n.page === 'string' ? n.page : '' };
}

/** the notes as they now stand. Nothing is awaited: what was written is
 *  already on screen, and the office has nothing to answer */
export function writeNotes(code: string, notes: Notes): void {
  onlineWire()?.putNotes(code, notes);
}
