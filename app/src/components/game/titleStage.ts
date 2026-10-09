import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/* ------------------------------------------------------------------ */
/* The title card's timetable. A table is set in four stretches: the   */
/* register read from the office, the press brought up (the board's    */
/* code and its GPU), the map engraved (the sheets and the tiles), and  */
/* the table set. The line on the card runs through them: each stretch  */
/* lays its own length of track, eased towards the next station and     */
/* never past it, so the line only ever goes forward.                   */
/* ------------------------------------------------------------------ */

export type TitleStage = 'reading' | 'pressing' | 'engraving' | 'ready';

/** each stretch: where its track starts, where it stops short of, and how
 *  long it takes to lay most of the way (ms, the easing's time constant) */
const STRETCH: Record<TitleStage, readonly [from: number, to: number, pace: number]> = {
  reading: [0.04, 0.22, 700],
  pressing: [0.22, 0.5, 1100],
  engraving: [0.5, 0.94, 1600],
  ready: [1, 1, 1],
};

/** how much of the line is laid, 0 to 1, so many ms into a stretch */
export function trackProgress(stage: TitleStage, ms: number): number {
  const [from, to, pace] = STRETCH[stage];
  return from + (to - from) * (1 - Math.exp(-Math.max(0, ms) / pace));
}

/** a table is never held behind its card longer than this */
export const BOARD_CAP_MS = 20000;
/** a board up with no minimap to read (a survey, a game read again): the
 *  sheets are given this long once the canvas stands */
export const UNFRAMED_MS = 1500;

/** where the board stands, from what the page can see of it: its canvas,
 *  and whether the minimap's frame has been measured against the board's
 *  own size — which the board only learns once its scene is built */
export function boardStage(seen: { waited: number; canvasFor: number | null; framed: boolean | null }): TitleStage {
  if (seen.waited >= BOARD_CAP_MS) return 'ready';
  if (seen.canvasFor === null) return 'pressing';
  if (seen.framed === true) return 'ready';
  if (seen.framed === null && seen.canvasFor >= UNFRAMED_MS) return 'ready';
  return 'engraving';
}

/** the minimap's frame under a board, measured or not (null: no minimap
 *  shown). Before the board knows its size the frame is the 6 px stub a
 *  zero viewport leaves; once the scene is built it spans the view */
function framedIn(host: HTMLElement | null): boolean | null {
  const plate = host?.querySelector<HTMLElement>('[data-minimap]');
  if (!plate || plate.getClientRects().length === 0) return null;
  const frame = plate.querySelector<HTMLElement>(':scope > .border-brass-400');
  return frame ? frame.offsetWidth > 8 : null;
}

/** how far the board under `host` has come while `watching` — a stand-in
 *  read from the page until the board reports its own readiness */
export function useBoardSet(host: RefObject<HTMLElement | null>, watching: boolean): TitleStage {
  const [stage, setStage] = useState<TitleStage>('pressing');
  /* a new table: its board starts from the press again */
  const [was, setWas] = useState(watching);
  if (was !== watching) {
    setWas(watching);
    setStage('pressing');
  }
  useEffect(() => {
    if (!watching) return;
    let waited = 0;
    let canvasAt: number | null = null;
    const STEP = 120;
    const id = window.setInterval(() => {
      waited += STEP;
      const el = host.current;
      if (canvasAt === null && el?.querySelector('canvas')) canvasAt = waited;
      const next = boardStage({ waited, canvasFor: canvasAt === null ? null : waited - canvasAt, framed: framedIn(el) });
      setStage(next);
      if (next === 'ready') window.clearInterval(id);
    }, STEP);
    return () => window.clearInterval(id);
  }, [host, watching]);
  return watching ? stage : 'reading';
}
