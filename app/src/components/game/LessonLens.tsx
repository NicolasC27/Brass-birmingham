import { useEffect, useMemo } from 'react';
import { useGame } from '@/game/store';
import { lensFor } from './lensFor';


/** keeps the store's lens on the lesson at hand, and flies the camera to it once */
export default function LessonLens({ stepId, active }: { stepId: string | null | undefined; active: boolean }) {
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const matPlayer = useGame((s) => s.matPlayer);
  const setLens = useGame((s) => s.setLens);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const me = seat ?? (game ? game.players.findIndex((p) => !p.isBot) : -1);
  const lens = useMemo(() => (active && game ? lensFor(stepId, { g: game, me, sel: selectedCardId, mat: matPlayer, verb }) : null), [active, game, me, stepId, selectedCardId, matPlayer, verb]);
  useEffect(() => {
    setLens(lens);
    return () => setLens(null);
  }, [lens, setLens]);
  /* the camera comes to the lesson's best place when the lesson changes,
     not at every move — nor away from a place already picked, when the
     lesson comes back from a page its build called for */
  const at = lens?.at ?? null;
  useEffect(() => {
    if (at && !useGame.getState().buildPick) flyToRegion(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, !!at]);
  return null;
}
