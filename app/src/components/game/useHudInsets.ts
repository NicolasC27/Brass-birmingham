import { vpTrackShown } from '@/game/engine';
import { useGame } from '@/game/store';
import { hudInsets, useBoardOptions } from './boardOptions';

/** the insets every floating HUD element keeps from the screen edges,
 *  following the board options and whether the VP track is on screen */
export function useHudInsets(): { left: number; bottom: number; top: number } {
  const opts = useBoardOptions();
  const vpTrack = useGame((s) => (s.game ? vpTrackShown(s.game) : false));
  return hudInsets(opts, vpTrack && opts.vpTrack);
}

/** on narrow screens the player rail is a strip under the top bar */
export const narrowRailTop = (insets: { top: number }): number => insets.top + 52;
