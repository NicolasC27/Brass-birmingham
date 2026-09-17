import { isOnline } from '@/online/lobby';

/* ------------------------------------------------------------------ */
/* Presence & queues — CLIENT-SIDE MOCK, clearly documented.           */
/*                                                                     */
/* The server has no presence / queue-length endpoint yet, so these    */
/* values are plausible demo figures used to dress the StatusStrip,    */
/* the ModeCards and the table board. This module is the single        */
/* extension point: when a real endpoint lands, replace readPresence() */
/* internals — the consumers keep the same snapshot shape.             */
/*                                                                     */
/* Product honesty (design.md §10): when the wire is down, we never    */
/* show fake live figures — the strip switches to "Mode local".        */
/* ------------------------------------------------------------------ */

export interface QueueSnapshot {
  /** players currently waiting */
  count: number;
  /** rough wait estimate, minutes */
  estimateMin: number;
}

export interface PresenceSnapshot {
  /** false → the strip shows "Mode local" and every figure is hidden */
  online: boolean;
  playersOnline: number;
  normalQueue: QueueSnapshot;
  rankedQueue: QueueSnapshot;
  region: string;
  latencyMs: number;
}

const DEMO: Omit<PresenceSnapshot, 'online'> = {
  playersOnline: 128,
  normalQueue: { count: 6, estimateMin: 1 },
  rankedQueue: { count: 3, estimateMin: 3 },
  region: 'EU',
  latencyMs: 24,
};

const LOCAL: PresenceSnapshot = {
  online: false,
  playersOnline: 0,
  normalQueue: { count: 0, estimateMin: 0 },
  rankedQueue: { count: 0, estimateMin: 0 },
  region: '—',
  latencyMs: 0,
};

/** current presence snapshot (mock — see header) */
export function readPresence(): PresenceSnapshot {
  if (!isOnline) return LOCAL;
  return { online: true, ...DEMO };
}
