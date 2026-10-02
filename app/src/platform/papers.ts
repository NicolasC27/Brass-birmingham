import { onlineWire } from '@/online/net';
import { listPatents, mergePatents } from './patents';
import { listLetters, mergeLetters } from './letters';
import { mergeFeuilleton, readFeuilleton } from './feuilleton';

/* ------------------------------------------------------------------ */
/* The papers that follow the account. The patents, the machines'     */
/* letters and the feuilleton are written in this browser; once signed */
/* in, the office keeps a copy, and another browser signing in with    */
/* the same name reads it back and folds it into its own. Nothing is   */
/* ever taken away by a sync: papers only gather.                      */
/* ------------------------------------------------------------------ */

const KINDS = ['patents', 'letters', 'feuilleton'] as const;
type Kind = (typeof KINDS)[number];

const local = (kind: Kind): unknown => (kind === 'patents' ? listPatents() : kind === 'letters' ? listLetters() : readFeuilleton());

/** what the office keeps, folded into what this browser holds, and the
 *  result handed back to the office */
export async function syncPapers(): Promise<void> {
  const wire = onlineWire();
  if (!wire?.session) return;
  let remote: Record<string, { body: unknown; updatedAt: number }>;
  try {
    remote = await wire.askPapers();
  } catch {
    return;
  }
  const patents = remote.patents?.body;
  if (Array.isArray(patents)) mergePatents(patents);
  const letters = remote.letters?.body;
  if (Array.isArray(letters)) mergeLetters(letters);
  const feuilleton = remote.feuilleton?.body;
  if (feuilleton && typeof feuilleton === 'object') mergeFeuilleton(feuilleton as Parameters<typeof mergeFeuilleton>[0]);
  pushPapers();
}

/** this browser's papers, handed to the office when there is one on the line */
export function pushPapers(): void {
  const wire = onlineWire();
  if (!wire?.session) return;
  for (const kind of KINDS) {
    const body = local(kind);
    if (body === null || (Array.isArray(body) && body.length === 0)) continue;
    void wire.putPaper(kind, body).catch(() => undefined);
  }
}
