import { Link } from 'react-router';
import { Eye } from 'lucide-react';
import { PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { keyLabel, useKeybindings } from './keybindings';
import { useHudInsets } from './useHudInsets';

/* SpectatorStrip — the plaque that stands where the hand would be while
   one watches a table from no seat: whose move it is, the two keys that
   read the board (another seat's last move, the acting seat's empire),
   and the way back to the desk. */
export default function SpectatorStrip() {
  const t = useT();
  const game = useGame((s) => s.game);
  const keys = useKeybindings();
  const insets = useHudInsets();
  if (!game) return null;
  const p = game.players[game.current];
  const color = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const over = game.phase === 'game-over';
  return (
    <div className="pointer-events-none fixed left-0 right-0 z-[63] flex justify-center" style={{ bottom: insets.bottom + 10 }} data-spectator>
      <div role="status" className="plaque pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2">
        <Eye className="h-4 w-4 shrink-0 text-brass-400" aria-hidden />
        <span className="font-fell text-[14px] text-cream-100">{t('game.page.spectating')}</span>
        <span className="h-4 w-px bg-brass-700/60" aria-hidden />
        <span className="flex items-center gap-1.5 font-sans text-[12px] text-cream-100/80">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {over ? t('game.page.spectatingOver') : p.isBot ? t('game.topbar.thinks', { name: p.name }) : t('game.topbar.plays', { name: p.name })}
        </span>
        {!over && (
          <span className="hidden font-sans text-[10.5px] uppercase tracking-[0.12em] text-cream-100/45 md:inline">
            {t('game.page.spectatingKeys', { last: keyLabel(keys.lastMove), survey: keyLabel(keys.survey) })}
          </span>
        )}
        <Link to="/play" className="btn-ledger !min-h-[28px] !px-2.5 !py-0.5 !text-[10px]">
          {t('game.page.spectatingLeave')}
        </Link>
      </div>
    </div>
  );
}
