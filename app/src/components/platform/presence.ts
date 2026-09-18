import { useMemo } from 'react';
import { isOnline } from '@/online/lobby';
import { useDesk, useLine } from '@/online/session';

/* ------------------------------------------------------------------ */
/* Presence & queues — what the office says: signed-in players, the   */
/* people waiting in each queue, the tables in play. When the wire is  */
/* down nothing is made up: the strip says "local mode".               */
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
  playing: number;
  normalQueue: QueueSnapshot;
  rankedQueue: QueueSnapshot;
}

const LOCAL: PresenceSnapshot = { online: false, playersOnline: 0, playing: 0, normalQueue: { count: 0, estimateMin: 0 }, rankedQueue: { count: 0, estimateMin: 0 } };

/** the house as the desk last said it (the office counts the queues together) */
export function usePresence(): PresenceSnapshot {
  const desk = useDesk();
  const line = useLine();
  return useMemo(() => {
    /* the line is what says the office is there; a visitor without a desk sees the house at zero, not "local mode" */
    if (!isOnline || line !== 'online') return LOCAL;
    const hall = desk?.hall ?? { online: 0, playing: 0, queued: 0 };
    const ranked = desk?.queue?.mode === 'ranked' ? desk.queue.waiting : 0;
    const normal = desk?.queue?.mode === 'quick' ? desk.queue.waiting : Math.max(0, hall.queued - ranked);
    return {
      online: true,
      playersOnline: hall.online,
      playing: hall.playing,
      normalQueue: { count: normal, estimateMin: 1 },
      rankedQueue: { count: ranked, estimateMin: 3 },
    };
  }, [desk, line]);
}
