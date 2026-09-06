import { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, incomeLevel } from '@/game/data';
import { LayoutGrid } from 'lucide-react';
import { useGame } from '@/game/store';
import { projectedOrder } from '@/game/engine';
import { hudInsets, useBoardOptions } from './boardOptions';
import { useT } from '@/i18n';
import type { PlayerState } from '@/game/types';
import { cn } from '@/lib/utils';

function useCountTween(value: number): number {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const start = performance.now();
    const dur = 400;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

function ShapeToken({ color, size = 12 }: { color: string; size?: number }) {
  const c = PLAYER_COLORS[color] ?? PLAYER_COLORS.brass;
  const s = size;
  if (c.shape === 'square')
    return <span className="inline-block rounded-[2px]" style={{ width: s, height: s, background: c.hex }} />;
  if (c.shape === 'diamond')
    return <span className="inline-block rotate-45 rounded-[1px]" style={{ width: s * 0.85, height: s * 0.85, background: c.hex }} />;
  if (c.shape === 'triangle')
    return (
      <span
        className="inline-block"
        style={{
          width: 0, height: 0,
          borderLeft: `${s * 0.55}px solid transparent`,
          borderRight: `${s * 0.55}px solid transparent`,
          borderBottom: `${s}px solid ${c.hex}`,
        }}
      />
    );
  return <span className="inline-block rounded-full" style={{ width: s, height: s, background: c.hex }} />;
}

export { ShapeToken };

/** victorian oil-portrait medallion per seat (human first, then the bots) */
const portraitFor = (index: number): string => `/portrait-${(index % 4) + 1}.png`;

/** circular portrait medallion with a player-colour rim (Steam reference);
 *  the active player gets a glowing ring. */
function PortraitMedallion({ p, index, active, size }: { p: PlayerState; index: number; active: boolean; size: number }) {
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  return (
    <span
      className={cn('relative inline-block shrink-0 rounded-full', active && 'animate-pulse')}
      style={{
        width: size,
        height: size,
        boxShadow: active
          ? `0 0 0 2px #100D0B, 0 0 0 4px ${color.hex}, 0 0 14px ${color.hex}`
          : `0 0 0 2px #100D0B, 0 0 0 3.5px ${color.hex}`,
      }}
      aria-hidden
    >
      <img
        src={portraitFor(index)}
        alt=""
        draggable={false}
        className="h-full w-full rounded-full object-cover"
        style={{ filter: 'saturate(.92) brightness(.96)' }}
      />
      {/* brass inner rim */}
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(201,164,92,.55), inset 0 2px 6px rgba(0,0,0,.5)' }} />
    </span>
  );
}

function RailChip({ p, index, active, nextRank, nowRank }: { p: PlayerState; index: number; active: boolean; nextRank: number; nowRank: number }) {
  const t = useT();
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const money = useCountTween(p.money);
  const vp = useCountTween(p.vp);
  const spotlight = useGame((s) => s.spotlight);
  const setSpotlight = useGame((s) => s.setSpotlight);
  const openMat = useGame((s) => s.openMat);
  const spotlighted = spotlight === index;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={spotlighted}
      aria-label={t('game.rail.compactAria', { name: p.name, money: p.money, income: incomeLevel(p.income), vp: p.vp })}
      title={spotlighted ? t('game.rail.spotRelease') : t('game.rail.spotMap')}
      onClick={() => setSpotlight(spotlighted ? null : index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSpotlight(spotlighted ? null : index);
        }
      }}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md border border-brass-700/40 bg-coal-900/80 px-2 py-1.5 shadow-e2 backdrop-blur-md',
        active && 'border-brass-700/70',
        spotlighted && 'ring-1 ring-brass-400',
      )}
    >
      <PortraitMedallion p={p} index={index} active={active} size={34} />
      <div className="flex min-w-0 flex-col items-start gap-px">
        <span className="max-w-[110px] truncate font-fell text-[12px] leading-tight tracking-wide text-cream-100">
          {p.name}
          {p.isBot && <span className="ml-1 font-mono text-[8px] uppercase text-brass-500/80">{p.difficulty.slice(0, 4)}</span>}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] leading-tight">
          <span className="font-semibold" style={{ color: color.hex }}>£{money}</span>
          <span className="text-bottle-600 brightness-150">↗ {incomeLevel(p.income)}</span>
          <span className="text-cream-100/70">{vp} VP</span>
          {active && <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-brass-400">{t('game.rail.toAct')}</span>}
        </span>
        {/* turn order: what this round cost so far, and the seat it earns next
            round (least spent plays first) */}
        <span className="flex items-center gap-1.5 font-mono text-[9px] leading-tight text-cream-100/55" title={t('game.rail.orderTip')}>
          <span>{t('game.rail.spent', { amount: p.spent })}</span>
          <span className="text-cream-100/30">·</span>
          <span className={nextRank < nowRank ? 'text-bottle-600 brightness-150' : nextRank > nowRank ? 'text-rust-500 brightness-150' : ''}>
            {t('game.rail.next', { rank: nextRank })}
            {nextRank < nowRank ? ' ↑' : nextRank > nowRank ? ' ↓' : ''}
          </span>
        </span>
      </div>
      {/* the player's mat: remaining tiles by industry and level */}
      <button
        type="button"
        aria-label={t('game.mat.openAria', { name: p.name })}
        title={t('game.mat.openTip')}
        onClick={(e) => {
          e.stopPropagation();
          openMat(index);
        }}
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md border border-brass-700/50 text-brass-500/70 transition-colors hover:border-brass-400 hover:text-brass-400"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* PlayerRail — plain VERTICAL stack in play order (seat 0 = first to act,
 * top of the stack). Click = spotlight that player's possessions on the
 * map. No hover expansion: the strip is all there is. */
export default function PlayerRail() {
  const t = useT();
  const game = useGame((s) => s.game);
  const insets = hudInsets(useBoardOptions());
  if (!game) return null;
  const next = projectedOrder(game);

  return (
    <div className="fixed z-[64] flex flex-col gap-2" style={{ left: insets.left, top: insets.top }} aria-label={t('game.rail.playersAria')}>
      {game.players.map((p, i) => (
        <RailChip key={i} p={p} index={i} active={i === game.current} nowRank={game.order.indexOf(i) + 1} nextRank={next.indexOf(i) + 1} />
      ))}
    </div>
  );
}
