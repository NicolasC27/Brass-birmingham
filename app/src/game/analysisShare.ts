import { onlineWire } from '@/online/net';
import type { ServerMessage } from '@/online/protocol';
import { ANALYSIS_VERSION } from './analysis';
import type { JudgeId } from './analysis';
import type { Held, ReadingPart } from './analysisMerge';

/* ------------------------------------------------------------------ */
/* The panel's end of a shared reading.                                */
/*                                                                     */
/* At a table of the club the reading is the office's, not this        */
/* browser's: what it holds is asked for before a single figure is     */
/* read again, a stretch of the game is taken so two players never     */
/* read the same positions, and everything that lands here goes back   */
/* up as it goes — in batches, not a frame per figure.                 */
/*                                                                     */
/* Nothing of this is needed at home: without a server, or for a game  */
/* of this device, there is no share and the panel reads as it always  */
/* did, on its own, off the shelf in localStorage.                     */
/* ------------------------------------------------------------------ */

/** how many positions a reader takes at a time */
export const SLICE = 64;

export interface Share {
  /** the reading the office keeps (null when it keeps none), and how many
      readers of the table are at work on it, this one counted */
  get(): Promise<{ reading: Held | null; readers: number }>;
  /** a stretch of positions to read, [lo, hi) — empty when the game is
      covered already and there is nothing left but to listen */
  claim(want: number): Promise<{ lo: number; hi: number; readers: number }>;
  /** figures just read, for the office and the rest of the table */
  post(part: ReadingPart): void;
  /** what the other readers of this table send in */
  on(cb: (part: ReadingPart, readers: number) => void): () => void;
}

/** the share of this table's reading, or null when there is nobody to share
 *  it with: no server in this build, or a game that is not a table's */
export function shareOf(code: string, judge: JudgeId): Share | null {
  const wire = onlineWire();
  if (!wire || !code) return null;
  const v = ANALYSIS_VERSION;
  const mine = (m: ServerMessage): boolean => 'code' in m && m.code === code && 'judge' in m && m.judge === judge && 'v' in m && m.v === v;
  return {
    async get() {
      const m = await wire.ask((rid) => ({ t: 'analysis.get', rid, code, v, judge }));
      return m.t === 'analysis' && mine(m) ? { reading: m.reading, readers: m.readers } : { reading: null, readers: 0 };
    },
    async claim(want) {
      const m = await wire.ask((rid) => ({ t: 'analysis.claim', rid, code, v, judge, want }));
      return m.t === 'analysis.slice' && mine(m) ? { lo: m.lo, hi: m.hi, readers: m.readers } : { lo: 0, hi: 0, readers: 0 };
    },
    post(part) {
      wire.send({ t: 'analysis.post', code, v, judge, part });
    },
    on(cb) {
      return wire.on((m) => {
        if (m.t === 'analysis.add' && mine(m)) cb(m.part, m.readers);
      });
    },
  };
}
