import { motion } from 'framer-motion';
import { PLAYER_COLORS, INCOME_PAYOUT, fmtPay } from '@/game/data';
import { eraRounds } from '@/game/engine';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import Tooltip from './Tooltip';
import { cn } from '@/lib/utils';

/**
 * Floating slim top-centre bar (map-v3 §2): era badge, round dial, turn
 * spinner, action pips, and the optional brass countdown plate.
 * Always fully opaque — game status must never look faded.
 */
export default function GameTopBar({ secondsLeft }: { secondsLeft: number | null }) {
  const t = useT();
  const game = useGame((s) => s.game);
  if (!game) return null;
  const p = game.players[game.current];
  const color = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const total = eraRounds(game.players.length);
  const roundFrac = Math.min(1, game.round / total);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;

  // spinner pointer angle toward active player notch
  const angle = (game.current / game.players.length) * 360;

  return (
    <div className="fixed left-1/2 top-[44px] z-[64] flex h-11 max-w-[94vw] -translate-x-1/2 items-center justify-center gap-4 rounded-lg border border-brass-700/60 bg-coal-900/90 px-4 shadow-e3 backdrop-blur-md sm:gap-6">
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-lg opacity-[0.05]" />

      {/* ornate era + round plaque (Steam reference: engraved caps, brass flourishes) */}
      <Tooltip
        side="bottom"
        title={t('game.topbar.eraRoundTitle', { era: game.era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail'), round: game.round, total })}
        content={game.era === 'canal' ? t('game.topbar.canalTip') : t('game.topbar.railTip')}
      >
        <span className="relative flex items-center gap-2 rounded-md border border-brass-700/80 bg-gradient-to-b from-coal-800 to-coal-900 px-3 py-1 shadow-e2">
          {/* left brass flourish */}
          <svg width={30} height={14} viewBox="0 0 30 14" aria-hidden className="shrink-0 text-brass-500">
            <path d="M29,7 H14 M14,7 C10,7 9,3 5,3 C2,3 1,5 1,7 C1,9 2,11 5,11 C7,11 8,9.4 8,8" fill="none" stroke="currentColor" strokeWidth={1.2} />
            <circle cx={29} cy={7} r={1.6} fill="currentColor" />
          </svg>
          <span className="flex flex-col items-center leading-none">
            <span
              className={cn(
                'font-fell text-[13px] tracking-[0.18em]',
                game.era === 'canal' ? 'text-cream-100' : 'text-copper-500 brightness-150',
              )}
              style={{ textShadow: '0 1px 0 rgba(0,0,0,.8), 0 0 8px rgba(201,164,92,.25)' }}
            >
              {game.era === 'canal' ? t('game.topbar.badgeCanal') : t('game.topbar.badgeRail')}
              <span className="mx-1.5 text-brass-500">—</span>
              <span className="text-brass-400">
                {t('game.topbar.roundShort', { round: game.round, total })}
              </span>
            </span>
            {/* round progress: thin brass inlay */}
            <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-coal-950">
              <motion.span className="block h-full rounded-full bg-brass-400" animate={{ width: `${roundFrac * 100}%` }} transition={{ duration: 0.5 }} />
            </span>
          </span>
          {/* right brass flourish (mirrored) */}
          <svg width={30} height={14} viewBox="0 0 30 14" aria-hidden className="shrink-0 -scale-x-100 text-brass-500">
            <path d="M29,7 H14 M14,7 C10,7 9,3 5,3 C2,3 1,5 1,7 C1,9 2,11 5,11 C7,11 8,9.4 8,8" fill="none" stroke="currentColor" strokeWidth={1.2} />
            <circle cx={29} cy={7} r={1.6} fill="currentColor" />
          </svg>
        </span>
      </Tooltip>

      {/* turn spinner */}
      <div className="flex items-center gap-2.5">
        <div className="relative h-[34px] w-[34px] rounded-full border border-brass-700 bg-coal-800 shadow-e2">
          {game.players.map((pl, i) => {
            const a = (i / game.players.length) * 360;
            return (
              <span
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  background: PLAYER_COLORS[pl.color]?.hex,
                  left: `calc(50% + ${Math.cos(((a - 90) * Math.PI) / 180) * 11}px - 4px)`,
                  top: `calc(50% + ${Math.sin(((a - 90) * Math.PI) / 180) * 11}px - 4px)`,
                }}
              />
            );
          })}
          <motion.span
            className="absolute left-1/2 top-1/2 h-[13px] w-[3px] origin-bottom rounded-full bg-brass-400"
            style={{ marginLeft: -1.5, marginTop: -13 }}
            animate={{ rotate: angle + 4 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          />
        </div>
        <motion.span
          key={game.current}
          initial={{ x: -14, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="rounded-sm px-2 py-0.5 font-sans text-xs font-semibold"
          style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
        >
          {t('game.topbar.toAct', { name: p.name })}
        </motion.span>
        <span className="font-mono text-[10px] text-cream-100/60">
          {t('game.topbar.actionOf', { n: maxActions - game.actionsLeft + 1, max: maxActions })}
        </span>
      </div>

      {/* countdown plate */}
      {secondsLeft !== null && (
        <span
          className={cn(
            'rounded-sm border px-2 py-1 font-mono text-xs font-semibold',
            secondsLeft < 20
              ? 'animate-pulse border-rust-500 text-rust-500 brightness-150'
              : 'border-brass-700 text-brass-400',
          )}
          aria-label={t('game.topbar.secondsLeft', { seconds: secondsLeft })}
        >
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </span>
      )}

      {/* income peek */}
      <span className="hidden font-mono text-[10px] text-cream-100/50 lg:block">
        {t('game.topbar.incomePeek', { amount: fmtPay(INCOME_PAYOUT[p.income]), count: game.deck.length })}
      </span>
    </div>
  );
}
