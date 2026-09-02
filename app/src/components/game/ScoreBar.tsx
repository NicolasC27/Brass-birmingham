import { INCOME_MAX, INCOME_PAYOUT, PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import Tooltip from './Tooltip';
import { ShapeChip } from './TownInspector';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Score rail — full-width strip across the very top: every player's   */
/* VP, income level and payout at a glance, in their colour.           */
/* Interactive: click a player to spotlight their works/links on the   */
/* board (dims the rest); the player to act carries the brass line.    */
/* ------------------------------------------------------------------ */

export default function ScoreBar() {
  const t = useT();
  const game = useGame((s) => s.game);
  const spotlight = useGame((s) => s.spotlight);
  const setSpotlight = useGame((s) => s.setSpotlight);
  if (!game) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex h-9 items-stretch justify-center overflow-x-auto border-b border-brass-700/50 bg-coal-900/90 shadow-e2 backdrop-blur-md"
      role="group"
      aria-label={t('game.score.aria')}
    >
      {game.players.map((p, i) => {
        const col = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
        const cur = i === game.current;
        const spot = spotlight === i;
        const filledTicks = Math.round((p.income / INCOME_MAX) * 15);
        return (
          <Tooltip
            key={i}
            side="bottom"
            title={t('game.score.tipTitle', { name: p.name, vp: p.vp, income: p.income, payout: INCOME_PAYOUT[p.income] })}
            content={
              <>
                {t('game.score.tipStats', { money: p.money, built: p.stats.built, links: p.stats.links, sold: p.stats.sold })}
                <br />
                {spot ? t('game.score.tipRelease') : t('game.score.tipIsolate')}
              </>
            }
          >
            <button
              type="button"
              aria-pressed={spot}
              aria-label={t('game.score.playerAria', { name: p.name, vp: p.vp, income: p.income })}
              onClick={() => setSpotlight(spot ? null : i)}
              className={cn(
                'relative flex items-center gap-2 border-l border-brass-700/30 px-3 transition-colors first:border-l-0 hover:bg-coal-800/70',
                spot && 'bg-coal-800/90 shadow-[inset_0_0_0_1px_var(--brass-400)]',
              )}
            >
              {/* active-player brass underline */}
              {cur && <span aria-hidden className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-brass-400" />}
              <ShapeChip color={p.color} size={11} />
              <span className={cn('font-sans text-[11px] font-semibold', cur ? 'text-cream-100' : 'text-cream-100/70')}>{p.name}</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: col }}>
                {p.vp}
                <span className="ml-0.5 text-[8px] font-semibold uppercase tracking-wider text-cream-100/45">{t('game.score.vpUnit')}</span>
              </span>
              {/* income: payout + mini track (physical income rail) */}
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-semibold text-brass-400">+£{INCOME_PAYOUT[p.income]}</span>
                <span aria-hidden className="flex items-end gap-px pb-0.5">
                  {Array.from({ length: 15 }, (_, t) => (
                    <span
                      key={t}
                      className="w-[3px] rounded-[1px]"
                      style={{
                        height: 4 + (t % 5) , // slight stepped silhouette, like the real track
                        background: t < filledTicks ? col : 'rgba(242,234,214,.14)',
                      }}
                    />
                  ))}
                </span>
              </span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
