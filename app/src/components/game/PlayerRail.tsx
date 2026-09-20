import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PlayerCard from './PlayerCard';
import type { ReactNode } from 'react';
import { INCOME_PAYOUT, PLAYER_COLORS, fmtPay, incomeLevel } from '@/game/data';
import { ChevronsDownUp, ChevronsUpDown, Coins, Eye, LayoutGrid, TrendingUp, Trophy } from 'lucide-react';
import { useGame } from '@/game/store';
import { projectedOrder } from '@/game/engine';
import { setBoardOption, useBoardOptions } from './boardOptions';
import { useHudInsets, narrowRailTop } from './useHudInsets';
import { TelegramPlaque } from './Telegrams';
import { useNarrow } from '@/hooks/use-narrow';
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

/** the machines wear their character's portrait; a human seat one of the house's oil portraits, by seat */
const portraitFor = (p: { isBot: boolean; persona: string }, index: number): string => (p.isBot ? `/portrait-${p.persona}.webp` : `/portrait-${(index % 4) + 1}.webp`);

/** circular portrait medallion with a player-colour rim (Steam reference);
 *  the active player gets a glowing ring. */
export function PortraitMedallion({ p, index, active, size }: { p: PlayerState; index: number; active: boolean; size: number }) {
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
        src={portraitFor(p, index)}
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

function RailChip({ p, index, active, nextRank, nowRank, compact, onCard }: { p: PlayerState; index: number; active: boolean; nextRank: number; nowRank: number; compact?: boolean; onCard: () => void }) {
  const latency = useGame((st) => st.latency);
  const online = useGame((st) => st.code !== null);
  const t = useT();
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const money = useCountTween(p.money);
  const vp = useCountTween(p.vp);
  const spotlight = useGame((s) => s.spotlight);
  const setSpotlight = useGame((s) => s.setSpotlight);
  const openMat = useGame((s) => s.openMat);
  const setNetPeek = useGame((s) => s.setNetPeek);
  const peekTimer = useRef<number | null>(null);
  const spotlighted = spotlight === index;
  const lvl = incomeLevel(p.income);
  const pay = fmtPay(INCOME_PAYOUT[p.income]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={spotlighted}
      aria-current={active ? 'true' : undefined}
      aria-label={t('game.rail.compactAria', { name: p.name, money: p.money, income: lvl, vp: p.vp })}
      title={spotlighted ? t('game.rail.spotRelease') : t('game.rail.spotMap')}
      onPointerEnter={() => {
        /* a beat of hover lights the player's whole network on the map */
        if (peekTimer.current !== null) window.clearTimeout(peekTimer.current);
        peekTimer.current = window.setTimeout(() => setNetPeek(index), 180);
      }}
      onPointerLeave={() => {
        if (peekTimer.current !== null) window.clearTimeout(peekTimer.current);
        peekTimer.current = null;
        setNetPeek(null);
      }}
      onClick={() => setSpotlight(spotlighted ? null : index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSpotlight(spotlighted ? null : index);
        }
      }}
      className={cn(
        'relative flex cursor-pointer items-center gap-2 plaque overflow-hidden rounded-md border py-1.5 pl-3 pr-2 transition-[border-color,box-shadow,background-color] duration-300',
        active ? '!border-brass-400/90' : 'opacity-90',
        spotlighted && 'ring-1 ring-brass-400',
      )}
      style={active ? { boxShadow: `0 0 0 1px ${color.hex}55, 0 0 22px ${color.hex}66, 0 4px 14px rgba(0,0,0,.45)` } : undefined}
    >
      {/* the seat's colour down the left edge; solid and bright when it is their turn */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] transition-opacity" style={{ background: color.hex, opacity: active ? 1 : 0.45 }} />
      {/* the portrait opens the player's card; the rest of the chip is the spotlight */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCard();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={t('game.card.open', { name: p.name })}
        title={t('game.card.open', { name: p.name })}
        className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-brass-400"
      >
        <PortraitMedallion p={p} index={index} active={active} size={compact ? 26 : 36} />
      </button>
      <div className="flex min-w-0 flex-col items-start gap-[3px]">
        <span className="flex items-center gap-1.5">
          <span className={cn('max-w-[104px] truncate font-fell leading-tight tracking-wide', active ? 'text-cream-100' : 'text-cream-100/85', compact ? 'text-[12px]' : 'text-[13px]')}>{p.name}</span>
          {p.isBot && <span className="font-mono text-[8px] uppercase text-brass-500/80">{t('game.rail.bot')}</span>}
          {online && !p.isBot && typeof latency[index] === 'number' && (
            <span className="font-mono text-[8.5px] tabular-nums" style={{ color: latency[index]! < 90 ? '#4EE38F' : latency[index]! < 220 ? '#DDBE7E' : '#FF5F4C' }} title={t('game.rail.latency', { ms: latency[index]! })}>
              {latency[index]} ms
            </span>
          )}
          {active && <span className="rounded-sm bg-brass-400 px-1 py-px font-sans text-[8px] font-bold uppercase tracking-widest text-coal-950">{t('game.rail.toAct')}</span>}
        </span>
        {/* the three figures, money first and largest, each behind its own icon */}
        <span className="flex items-baseline gap-2 font-mono leading-none">
          <span className={cn('flex items-baseline gap-0.5 font-bold', compact ? 'text-[12px]' : 'text-[14px]')} style={{ color: color.hex }} title={t('game.rail.moneyTip')}>
            <Coins aria-hidden className={cn('shrink-0 self-center opacity-80', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />£{money}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-bottle-600 brightness-150" title={t('game.rail.incomeTitle', { income: lvl }) + ' — ' + t('game.rail.incomeContent', { amount: pay })}>
            <TrendingUp aria-hidden className="h-2.5 w-2.5 shrink-0" />
            {lvl}
            {!compact && <span className="text-cream-100/45">({pay})</span>}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-cream-100/75" title={t('game.rail.vpTip')}>
            <Trophy aria-hidden className="h-2.5 w-2.5 shrink-0" />
            {vp}
          </span>
        </span>
        {/* turn order: what this round cost so far, and the seat it earns next
            round (least spent plays first) — folded away when compact */}
        {!compact && (
          <span className="flex items-center gap-1.5 font-mono text-[9px] leading-tight text-cream-100/55" title={t('game.rail.orderTip')}>
            <span>{t('game.rail.spent', { amount: p.spent })}</span>
            <span className="text-cream-100/30">·</span>
            <span className={cn('flex items-center gap-0.5 rounded-sm border px-1 py-px', nextRank < nowRank ? 'border-bottle-600/60 text-bottle-600 brightness-150' : nextRank > nowRank ? 'border-rust-500/60 text-rust-500 brightness-150' : 'border-brass-700/50 text-cream-100/60')}>
              {t('game.rail.nextShort', { rank: nextRank })}
              {nextRank < nowRank ? ' ↑' : nextRank > nowRank ? ' ↓' : ''}
            </span>
          </span>
        )}
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

/* PlayerRail — plain VERTICAL stack in play order: whoever acts first this
 * round sits at the top, and the chips glide to their new places when the
 * round turns. Click = spotlight that player's possessions on the map. No
 * hover expansion: the strip is all there is. */
export default function PlayerRail({ tools }: { tools?: ReactNode }) {
  const t = useT();
  const game = useGame((s) => s.game);
  const insets = useHudInsets();
  const narrow = useNarrow();
  const { railCompact, focus } = useBoardOptions();
  const [cardSeat, setCardSeat] = useState<number | null>(null);
  if (!game) return null;
  const next = projectedOrder(game);
  const compact = narrow || railCompact || focus;

  /* wide: a vertical stack top-left. Narrow: a wrapping strip under the top
     bar, chips trimmed to portrait, name and the three numbers */
  return (
    <div
      data-player-rail
      className={cn('fixed z-[64] flex gap-2', narrow ? 'flex-row flex-wrap' : 'flex-col')}
      style={narrow ? { left: insets.left, right: 12, top: narrowRailTop(insets) } : { left: insets.left, top: insets.top }}
      aria-label={t('game.rail.playersAria')}
    >
      {game.order.map((i, pos) => (
        <motion.div key={i} layout transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="relative flex flex-col">
          <RailChip p={game.players[i]} index={i} active={i === game.current} nowRank={pos + 1} nextRank={next.indexOf(i) + 1} compact={compact} onCard={() => setCardSeat((c) => (c === i ? null : i))} />
          <TelegramPlaque seat={i} compact={compact} />
          {/* the player's card, beside their chip */}
          <AnimatePresence>
            {cardSeat === i && (
              <div className={cn('absolute z-[70]', narrow ? 'left-0 top-full mt-1' : 'left-full top-0 ml-2')}>
                <PlayerCard game={game} seat={i} onClose={() => setCardSeat(null)} />
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
      {/* the focus view: one small way back, the rest of the tools away */}
      {focus && (
        <button
          type="button"
          onClick={() => setBoardOption('focus', false)}
          title={t('game.rail.focusExit')}
          aria-label={t('game.rail.focusExit')}
          className="flex h-6 w-6 items-center justify-center plaque rounded-md text-brass-400/80 opacity-80 transition-opacity hover:opacity-100"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
      {/* fold the rail to one line per seat, for more board */}
      {!narrow && !focus && (
        <button
          type="button"
          onClick={() => setBoardOption('railCompact', !railCompact)}
          aria-pressed={railCompact}
          aria-label={t(railCompact ? 'game.rail.expand' : 'game.rail.fold')}
          title={t(railCompact ? 'game.rail.expand' : 'game.rail.fold')}
          className="flex h-5 w-full items-center justify-center plaque rounded-md text-brass-500/70 opacity-80 transition-opacity hover:opacity-100"
        >
          {railCompact ? <ChevronsUpDown className="h-3 w-3" /> : <ChevronsDownUp className="h-3 w-3" />}
        </button>
      )}
      {tools && !focus && <div className="flex flex-wrap items-center gap-1.5">{tools}</div>}
    </div>
  );
}
