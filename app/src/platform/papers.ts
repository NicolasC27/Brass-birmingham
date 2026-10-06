import { onlineWire } from '@/online/net';

/* ------------------------------------------------------------------ */
/* The papers that follow the account.                                 */
/*                                                                     */
/* The judge's sheet, the feuilleton, the patents, the machines'       */
/* letters, the towns built, the form and the week's notice: none of   */
/* them is a game, and all of them are a record of having played. The  */
/* office keeps them, one row an account and a kind, and this browser  */
/* keeps a mirror — read once as the application opens, so a page may  */
/* still ask for a paper without waiting, and written through to the   */
/* office the moment it changes.                                       */
/*                                                                     */
/* The office decides. There is no folding of one copy into another    */
/* any more: what the office hands over is what the papers are.        */
/* ------------------------------------------------------------------ */

export const PAPER_KINDS = ['progress', 'feuilleton', 'patents', 'letters', 'lines', 'form', 'challenge', 'equipped'] as const;
export type Kind = (typeof PAPER_KINDS)[number];

const shelf = new Map<Kind, unknown>();
const watchers = new Set<() => void>();

const told = (): void => {
  for (const cb of watchers) cb();
};

/** a paper changed, or the whole shelf did */
export function subscribePapers(cb: () => void): () => void {
  watchers.add(cb);
  return () => watchers.delete(cb);
}

/** what the office keeps under this kind, or `fallback` when it keeps none */
export function paper<T>(kind: Kind, fallback: T): T {
  const body = shelf.get(kind);
  return body === undefined || body === null ? fallback : (body as T);
}

/** a paper written: kept here at once, so what wrote it reads it back, and
 *  handed to the office, which is where it lives */
export function writePaper(kind: Kind, body: unknown): void {
  shelf.set(kind, body);
  told();
  void onlineWire()?.putPaper(kind, body).catch(() => undefined);
}

/** the shelf emptied: another account's papers are not this one's, and a
 *  test starts from a browser that has none */
export function clearPapers(): void {
  shelf.clear();
  told();
}

/** the papers as the office keeps them. A browser that cannot reach it has
 *  none, which is the honest answer: they are not kept here any more */
export async function hydratePapers(): Promise<void> {
  const wire = onlineWire();
  if (!wire || wire.stranger) return;
  let held: Record<string, { body: unknown }>;
  try {
    held = await wire.askPapers();
  } catch {
    return;
  }
  for (const kind of PAPER_KINDS) {
    const body = held[kind]?.body;
    if (body !== undefined) shelf.set(kind, body);
  }
  told();
}

/** the papers of a browser from before the office kept them, put up as they
 *  are — only the kinds the office holds nothing of */
export function liftPapers(found: Partial<Record<Kind, unknown>>): void {
  for (const kind of PAPER_KINDS) {
    const body = found[kind];
    if (body === undefined || shelf.has(kind)) continue;
    writePaper(kind, body);
  }
}
