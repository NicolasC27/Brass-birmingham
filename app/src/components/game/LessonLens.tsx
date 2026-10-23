import { useEffect, useMemo } from 'react';
import { projectQueued, useGame } from '@/game/store';
import { lensFor } from './lensFor';


/** keeps the store's lens on the lesson at hand, and flies the camera to it once */
export default function LessonLens({ stepId, active }: { stepId: string | null | undefined; active: boolean }) {
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const matPlayer = useGame((s) => s.matPlayer);
  const preparing = useGame((s) => s.preparing);
  const queued = useGame((s) => s.queued);
  const setLens = useGame((s) => s.setLens);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const me = seat ?? (game ? game.players.findIndex((p) => !p.isBot) : -1);
  /* the table the plan is made on, as the board's marks are: with moves
     already prepared, the one they leave */
  const plan = useMemo(() => (game && preparing && queued.length && me >= 0 && game.phase === 'action' ? projectQueued(game, me, queued) : game), [game, preparing, queued, me]);
  const lens = useMemo(() => (active && plan ? lensFor(stepId, { g: plan, me, sel: selectedCardId, mat: matPlayer, verb }) : null), [active, plan, me, stepId, selectedCardId, matPlayer, verb]);
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
