import { useGame } from '@/game/store';
import { hudInsets, useBoardOptions } from './boardOptions';
import { GUIDE_RAIL, guideDock } from './guideKeys';

/** the lane the analysis panel holds down the right edge, and nothing when it
 *  is closed: the HUD keeps out of it rather than hiding under it */
export function analysisLane(open: boolean): number {
  return open ? Math.max(GUIDE_RAIL, guideDock()) : 0;
}

/** the insets every floating HUD element keeps from the screen edges,
 *  following the board options, whether the VP track is on screen, and the
 *  room the analysis takes when it is open */
export function useHudInsets(): { left: number; bottom: number; top: number; right: number } {
  const opts = useBoardOptions();
  const table = useGame((s) => s.game !== null);
  const reading = useGame((s) => s.debriefOpen && s.game?.phase === 'game-over');
  return hudInsets(opts, table && opts.vpTrack, analysisLane(!!reading));
}

/** on narrow screens the player rail is a strip under the top bar */
export const narrowRailTop = (insets: { top: number }): number => insets.top + 52;
