import { useEffect, useMemo } from 'react';
import { useGame } from '@/game/store';
import { lensFor } from './lensFor';


/** keeps the store's lens on the lesson at hand, and flies the camera to it once */
export default function LessonLens({ stepId, active }: { stepId: string | null | undefined; active: boolean }) {
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const setLens = useGame((s) => s.setLens);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const me = seat ?? (game ? game.players.findIndex((p) => !p.isBot) : -1);
  const lens = useMemo(() => (active && game ? lensFor(stepId, game, me, selectedCardId, verb) : null), [active, game, me, stepId, selectedCardId, verb]);
  useEffect(() => {
    setLens(lens);
    return () => setLens(null);
  }, [lens, setLens]);
  /* the camera comes to the lesson's town when the lesson changes, not at every move */
  const town = lens?.town ?? null;
  useEffect(() => {
    if (town) flyToRegion(town);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, !!town]);
  return null;
}
