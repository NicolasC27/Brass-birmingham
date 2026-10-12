import { readable } from '@/game/analysis';
import { useGame } from '@/game/store';
import { hudInsets, useBoardOptions } from './boardOptions';
import { GUIDE_RAIL, REVIEW_CURVE_H, guideDock } from './guideKeys';

/** the lane the analysis panel holds down the right edge, and nothing when it
 *  is closed: the HUD keeps out of it rather than hiding under it */
export function analysisLane(open: boolean): number {
  /* the same measure the panel takes for itself: under 1100 px the guide's
     dock is folded, and the analysis would otherwise be counted as a rail */
  if (!open) return 0;
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return Math.max(GUIDE_RAIL, guideDock(vw) || Math.max(300, Math.min(420, Math.round(vw * 0.34))));
}

/** the insets every floating HUD element keeps from the screen edges,
 *  following the board options, whether the VP track is on screen, and the
 *  room the analysis takes when it is open */
export function useHudInsets(): { left: number; bottom: number; top: number; right: number } {
  const opts = useBoardOptions();
  const table = useGame((s) => s.game !== null);
  const reading = useGame((s) => s.debriefOpen && readable(s.game));
  const base = hudInsets(opts, table && opts.vpTrack && !reading, analysisLane(!!reading));
  /* a game being read: the curve runs across the top where the VP track was */
  return reading ? { ...base, top: REVIEW_CURVE_H + 8 } : base;
}

/** on narrow screens the player rail is a strip under the top bar */
export const narrowRailTop = (insets: { top: number }): number => insets.top + 52;
