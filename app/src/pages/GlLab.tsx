import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import PixiBoard from '@/gl/PixiBoard';
import { useGame } from '@/game/store';

/**
 * /game-gl — WebGL (PixiJS) proof-of-concept. Same store, same live game
 * (bots keep playing), only the board renderer changes: sprites on the
 * GPU instead of DOM/SVG. Read-only board — this is a fluidity test bed,
 * not the playable client.
 */
export default function GlLab() {
  const init = useGame((s) => s.init);
  const game = useGame((s) => s.game);
  const ceremony = useGame((s) => s.ceremony);
  const runBot = useGame((s) => s.runBot);
  const endCeremony = useGame((s) => s.endCeremony);

  useEffect(() => {
    init();
  }, [init]);

  /* keep the bots driving the board so the scene stays alive */
  useEffect(() => {
    if (!game || game.phase !== 'action' || ceremony) return;
    if (!game.players[game.current].isBot) return;
    const t = window.setTimeout(() => runBot(), 1350);
    return () => window.clearTimeout(t);
  }, [game, ceremony, runBot]);

  /* no Ceremony component here — auto-close the era interlude */
  useEffect(() => {
    if (!ceremony) return;
    const t = window.setTimeout(() => endCeremony(), 5000);
    return () => window.clearTimeout(t);
  }, [ceremony, endCeremony]);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-coal-950">
      {game && (
        <PixiBoard game={game} targets={[]} linkTargetsList={[]} sellTargetsList={[]} ghost={null} onInvalid={() => {}} />
      )}
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <span className="plate px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-brass-400">
          Moteur WebGL (PixiJS) — lecture seule
        </span>
        <Link
          to="/game"
          className="plate pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-cream-100/75 hover:text-brass-400"
        >
          <ArrowLeft className="h-3 w-3" /> Version SVG jouable
        </Link>
      </div>
    </div>
  );
}
