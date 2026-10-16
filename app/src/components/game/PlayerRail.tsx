import { memo, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import PlayerCard from './PlayerCard';
import type { ReactNode } from 'react';
import { INCOME_PAYOUT, PLAYER_COLORS, incomeLevel } from '@/game/data';
import { ArrowDownRight, ChevronsLeft, ChevronsRight, Coins, Eye, LayoutGrid, PanelLeftClose, TrendingUp, Trophy } from 'lucide-react';
import { useGame, useShownGame } from '@/game/store';
import { projectEraScores, projectedOrder } from '@/game/engine';
import { FILET_W, TRACK_W, setBoardOption, useBoardOptions } from './boardOptions';
import type { RailMode } from './boardOptions';
import { useHudInsets, narrowRailTop } from './useHudInsets';
import { TelegramPlaque } from './Telegrams';
import { ShapeChip } from './TownInspector';
import { useLayer } from './useLayer';
import { useReducedMotion } from './useReducedMotion';
import { lanternStop, rankDrift, shownRailMode, spentShare } from './railLogic';
import { useNarrow } from '@/hooks/use-narrow';
import { money as sum, useT } from '@/i18n';
import { useTable } from '@/online/lobby';
import { portraitUrl } from '@/online/session';
import type { PlayerState } from '@/game/types';
import { cn } from '@/lib/utils';
import { portraitFor } from './portraits';

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

/** circular portrait medallion with a player-colour rim (Steam reference);
 *  the active player gets a glowing ring. */
/** a machine wears its character, a member their own likeness when the
 *  office serves one (an online table's seat knows their account), and
 *  anyone else one of the house's oil portraits. `bare` drops the colour
 *  rim and the glow, for a frame that draws its own. */
export function PortraitMedallion({ p, index, active, size, bare }: { p: PlayerState; index: number; active: boolean; size: number; bare?: boolean }) {
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const code = useGame((st) => st.code);
  const table = useTable(code);
  const seatId = table?.seats[index]?.kind === 'human' ? table.seats[index].id : null;
  const likeness = !p.isBot && seatId ? portraitUrl(seatId) : null;
  const [broken, setBroken] = useState<string | null>(null);
  const src = likeness && broken !== likeness ? likeness : portraitFor(p, index);
  return (
    <span
      className={cn('relative inline-block shrink-0 rounded-full', active && !bare && 'animate-pulse')}
      style={{
        width: size,
        height: size,
        boxShadow: bare ? undefined : active ? `0 0 0 2px #100D0B, 0 0 0 4px ${color.hex}, 0 0 14px ${color.hex}` : `0 0 0 2px #100D0B, 0 0 0 3.5px ${color.hex}`,
      }}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => likeness && setBroken(likeness)}
        className="h-full w-full rounded-full object-cover"
        style={{ filter: 'saturate(.92) brightness(.96)' }}
      />
      {/* brass inner rim */}
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(201,164,92,.55), inset 0 2px 6px rgba(0,0,0,.5)' }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The lantern of the turn: a signal lamp in iron and brass, its lens   */
/* lit, hung beside whoever is to act. Drawn here, a few paths, so it   */
/* costs nothing to fetch and stays sharp at any size.                  */
/* ------------------------------------------------------------------ */

export function Lantern({ h = 22, reduced }: { h?: number; reduced: boolean }) {
  const lens = `lantern-lens-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={(h * 14) / 22} height={h} viewBox="0 0 14 22" aria-hidden className="block overflow-visible">
      <defs>
        <radialGradient id={lens} cx="50%" cy="52%" r="62%">
          <stop offset="0" stopColor="#FFF6D6" />
          <stop offset="0.42" stopColor="#FFC85E" />
          <stop offset="1" stopColor="#B4531B" />
        </radialGradient>
      </defs>
      {/* the ring it hangs by, the hood, the lit glass, the base */}
      <circle cx="7" cy="1.9" r="1.4" fill="none" stroke="#C9A45C" strokeWidth="0.9" />
      <path d="M2.6 6.2 L7 3.3 L11.4 6.2 Z" fill="#241C15" stroke="#C9A45C" strokeWidth="0.7" strokeLinejoin="round" />
      <rect x="2.2" y="6.2" width="9.6" height="1.3" rx="0.4" fill="#A8864A" />
      <motion.rect
        x="3.2"
        y="7.5"
        width="7.6"
        height="9.2"
        rx="0.8"
        fill={`url(#${lens})`}
        animate={reduced ? { opacity: 1 } : { opacity: [1, 0.84, 0.97, 0.9, 1] }}
        transition={reduced ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <path d="M3.2 7.5 V16.7 M10.8 7.5 V16.7" stroke="#1A1410" strokeWidth="0.8" />
      <path d="M7 7.5 V16.7 M3.2 12.1 H10.8" stroke="#1A1410" strokeWidth="0.4" opacity="0.6" />
      <rect x="2.2" y="16.7" width="9.6" height="1.3" rx="0.4" fill="#A8864A" />
      <path d="M4 18 H10 L9.1 20.4 H4.9 Z" fill="#241C15" stroke="#C9A45C" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

/** the lamp's light spilling round it: a warm pool, screened over the table */
function LanternGlow({ size, reduced }: { size: number; reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        mixBlendMode: 'screen',
        background: 'radial-gradient(circle, rgba(255,200,110,.5) 0%, rgba(255,160,70,.2) 38%, rgba(255,140,50,0) 70%)',
      }}
      initial={{ opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { opacity: [0.75, 1, 0.85, 1] }}
      transition={reduced ? { duration: 0.35 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function RailChip({ p, index, active, nextRank, nowRank, compact, live, onCard, travel }: { p: PlayerState; index: number; active: boolean; nextRank: number; nowRank: number; compact?: boolean; /** while a game is read again: what the board is worth on top of the banked points */ live: number | null; onCard: () => void; /** the lantern glides from chip to chip (the full column only) */ travel?: boolean }) {
  const latency = useGame((st) => st.latency);
  const online = useGame((st) => st.code !== null);
  const t = useT();
  const reduced = useReducedMotion();
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const money = useCountTween(p.money);
  const vp = useCountTween(live === null ? p.vp : p.vp + live);
  const spotlight = useGame((s) => s.spotlight);
  const setSpotlight = useGame((s) => s.setSpotlight);
  const openMat = useGame((s) => s.openMat);
  const setNetPeek = useGame((s) => s.setNetPeek);
  const peekTimer = useRef<number | null>(null);
  const spotlighted = spotlight === index;
  const lvl = incomeLevel(p.income);
  const pay = sum(INCOME_PAYOUT[p.income]);

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
      data-lens={p.isBot ? 'rail-bot' : 'rail'}
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
        <PortraitMedallion p={p} index={index} active={false} size={compact ? 26 : 36} />
      </button>
      <div className="flex min-w-0 flex-col items-start gap-[3px]">
        <span className="flex items-center gap-1.5">
          <span className={cn('max-w-[104px] truncate font-fell leading-tight tracking-wide', active ? 'text-cream-100' : 'text-cream-100/85', compact ? 'text-[12px]' : 'text-[13px]')}>{p.name}</span>
          {p.isBot && <span className="font-mono text-[9px] uppercase text-brass-500/80">{t('game.rail.bot')}</span>}
          {online && !p.isBot && typeof latency[index] === 'number' && (
            <span className="font-mono text-[9px] tabular-nums" style={{ color: latency[index]! < 90 ? '#4EE38F' : latency[index]! < 220 ? '#DDBE7E' : '#FF5F4C' }} title={t('game.rail.latency', { ms: latency[index]! })}>
              {latency[index]} ms
            </span>
          )}
          {/* the lantern of the turn, where the word "to act" used to be */}
          {active && (
            <motion.span layoutId={travel ? 'rail-lantern-card' : undefined} className="relative -my-1 inline-flex" title={t('game.rail.toAct')}>
              <LanternGlow size={30} reduced={reduced} />
              <Lantern h={compact ? 14 : 16} reduced={reduced} />
              <span className="sr-only">{t('game.rail.toAct')}</span>
            </motion.span>
          )}
        </span>
        {/* the three figures, money first and largest, each behind its own icon */}
        <span className="flex items-baseline gap-2 font-mono leading-none">
          <span className={cn('flex items-baseline gap-0.5 font-bold', compact ? 'text-[12px]' : 'text-[14px]')} style={{ color: color.hex }} title={t('game.rail.moneyTip')}>
            <Coins aria-hidden className={cn('shrink-0 self-center opacity-80', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />{sum(money)}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-bottle-600 brightness-150" title={t('game.rail.incomeTitle', { income: lvl }) + ' — ' + t('game.rail.incomeContent', { amount: pay })}>
            <TrendingUp aria-hidden className="h-2.5 w-2.5 shrink-0" />
            {lvl}
            {!compact && <span className="text-cream-100/45">({pay})</span>}
          </span>
          <span
            className={cn('flex items-center gap-0.5 text-[10px]', live === null ? 'text-cream-100/75' : 'text-brass-300')}
            title={live === null ? t('game.rail.vpTip') : t('game.rail.vpLiveTip', { banked: p.vp, board: live })}
          >
            <Trophy aria-hidden className="h-2.5 w-2.5 shrink-0" />
            {vp}
            {live !== null && <span className="text-[9px] uppercase tracking-[0.1em] text-brass-400/70">{t('game.rail.vpLive')}</span>}
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
        data-lens={p.isBot ? undefined : 'mat'}
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

/* ------------------------------------------------------------------ */
/* The medallions: each seat a portrait in a disc, ringed in its colour. */
/* The ring's arc is the part of the purse this round has taken; a       */
/* small numeral struck on the ring is the seat it earns next round;     */
/* the purse and the points sit on a plate under the disc, the owner's  */
/* shape on the ring for eyes that do not tell the colours apart. The    */
/* round's figures wait under the pointer, the card unfolds at a click.  */
/* ------------------------------------------------------------------ */

/** the lamp's lane on the left, the ring beside it */
const LANE = 16;
const RING = 50;
const R = 22.5;
const SLOT_W = LANE + RING + 2;
const SLOT_H = 70;
const GAP = 8;
const PITCH = SLOT_H + GAP;
const LANTERN_H = 24;

function Medal({ p, index, active, nextRank, nowRank, open, onToggle, onClose, onPeek, reduced }: { p: PlayerState; index: number; active: boolean; nextRank: number; nowRank: number; open: boolean; onToggle: () => void; onClose: () => void; /** the rest of the column learns which plate is up */ onPeek: (on: boolean) => void; reduced: boolean }) {
  const t = useT();
  const game = useShownGame();
  const latency = useGame((st) => st.latency);
  const online = useGame((st) => st.code !== null);
  const spotlighted = useGame((s) => s.spotlight === index);
  const setNetPeek = useGame((s) => s.setNetPeek);
  const color = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.brass;
  const money = useCountTween(p.money);
  const [plate, setPlate] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const slot = useRef<HTMLDivElement>(null);
  /* the unfolded card is a panel of the table: Escape folds it again */
  const sheet = useLayer(open, onClose);

  /* a click anywhere else on the table folds the card back into its disc */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (slot.current && e.target instanceof Node && !slot.current.contains(e.target)) onClose();
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open, onClose]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const lvl = incomeLevel(p.income);
  const share = spentShare(p.spent, p.money);
  const C = 2 * Math.PI * R;
  const drift = rankDrift(nextRank, nowRank);
  const label = t('game.railLane.medalAria', {
    name: p.name,
    now: active ? t('game.railLane.now') : '',
    money: sum(p.money),
    income: lvl,
    vp: p.vp,
    spent: sum(p.spent),
    rank: nextRank,
  });
  const showPlate = (on: boolean) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (on) {
      timer.current = window.setTimeout(() => {
        setPlate(true);
        onPeek(true);
        setNetPeek(index);
      }, 180);
    } else {
      setPlate(false);
      onPeek(false);
      setNetPeek(null);
    }
  };
  /* the numeral struck at half past one on the ring, the shape at half past four */
  const at = (deg: number, d: number) => ({ left: LANE + RING / 2 + R * Math.cos((deg * Math.PI) / 180) - d / 2, top: RING / 2 + R * Math.sin((deg * Math.PI) / 180) - d / 2, width: d, height: d });

  return (
    <div ref={slot} className="relative" style={{ width: SLOT_W, height: SLOT_H }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-current={active ? 'true' : undefined}
        data-lens={p.isBot ? 'rail-bot' : 'rail'}
        onClick={() => {
          showPlate(false);
          onToggle();
        }}
        onPointerEnter={() => showPlate(true)}
        onPointerLeave={() => showPlate(false)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && showPlate(true)}
        onBlur={() => showPlate(false)}
        className="group absolute top-0 rounded-full outline-none transition-transform duration-200 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-coal-950"
        style={{ left: LANE, width: RING, height: RING }}
      >
        <svg
          width={RING}
          height={RING}
          viewBox={`0 0 ${RING} ${RING}`}
          aria-hidden
          className="absolute inset-0 overflow-visible transition-[filter] duration-500"
          /* the lamp's light caught on the ring of whoever is to act */
          style={{ filter: active ? 'drop-shadow(0 0 7px rgba(255,184,86,.55))' : undefined }}
        >
          {/* the lacquered bed, the brass hairline outside, the ring's track */}
          <circle cx={RING / 2} cy={RING / 2} r={R + 2.2} fill="#100D0B" stroke={spotlighted ? '#E2C27F' : 'rgba(201,164,92,.5)'} strokeWidth={spotlighted ? 1.3 : 0.8} />
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={color.hex} strokeOpacity={0.24} strokeWidth={3} />
          {/* spent this round, clockwise from noon */}
          <motion.circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={color.hex}
            strokeWidth={3}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            initial={false}
            animate={{ strokeDasharray: `${(share * C).toFixed(2)} ${C.toFixed(2)}` }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
          />
          <circle cx={RING / 2} cy={RING / 2} r={R - 2.6} fill="none" stroke="rgba(201,164,92,.45)" strokeWidth={0.6} />
        </svg>
        <span className="absolute" style={{ left: (RING - 38) / 2, top: (RING - 38) / 2, filter: active ? undefined : 'brightness(.86)' }}>
          <PortraitMedallion p={p} index={index} active={active} size={38} bare />
        </span>
      </button>
      {/* the seat it earns next round, struck on the ring */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute flex items-center justify-center rounded-full border bg-coal-950 font-mono text-[9px] font-bold leading-none',
          drift === 'up' ? 'border-bottle-600 text-bottle-600 brightness-150' : drift === 'down' ? 'border-rust-500 text-rust-500 brightness-125' : 'border-brass-500/80 text-brass-300',
        )}
        style={{ ...at(-45, 15), boxShadow: '0 1px 2px rgba(0,0,0,.7)' }}
      >
        {nextRank}
      </span>
      {/* the owner's shape, for eyes the colours fail */}
      <span aria-hidden className="pointer-events-none absolute flex items-center justify-center rounded-full border border-brass-700/70 bg-coal-950" style={at(45, 13)}>
        <ShapeChip color={p.color} size={8} vivid />
      </span>
      {/* the purse and the points, on a small plate under the disc: what a
          seat holds is public at the table, so it is always in sight */}
      <span
        aria-hidden
        className="pointer-events-none absolute flex -translate-x-1/2 items-center whitespace-nowrap rounded-sm border border-brass-700/70 bg-coal-950/95 font-mono text-[9.5px] font-semibold leading-[13px] tabular-nums text-cream-100/85"
        style={{ left: LANE + RING / 2, top: RING - 5, boxShadow: '0 1px 2px rgba(0,0,0,.7)' }}
      >
        <span className={cn('px-1', p.money < 0 ? 'text-rust-500 brightness-125' : 'text-cream-100')}>{sum(money)}</span>
        <span className="h-[9px] w-px bg-brass-700/70" />
        <span className="flex items-center gap-0.5 px-1">
          <Trophy className="h-2 w-2 text-brass-400/80" />
          {p.vp}
        </span>
      </span>
      {/* what the seat has laid out this round, under its purse: the figure
          the next round's order is read from, public at the table */}
      <span
        aria-hidden
        className={cn('pointer-events-none absolute flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap font-mono text-[9px] leading-none tabular-nums', p.spent > 0 ? 'text-cream-100/70' : 'text-cream-100/35')}
        style={{ left: LANE + RING / 2, top: RING + 10 }}
      >
        <ArrowDownRight className="h-2 w-2 shrink-0 opacity-80" />
        {sum(p.spent)}
      </span>

      {/* the money, and the round's figures, while the pointer rests */}
      <AnimatePresence>
        {plate && !open && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="plaque pointer-events-none absolute z-[72] w-max rounded-md border px-2.5 py-1.5"
            style={{ left: LANE + RING + 10, top: 1 }}
          >
            <span className="flex items-center gap-1.5">
              <span className="font-fell text-[13px] leading-tight tracking-wide text-cream-100">{p.name}</span>
              {p.isBot && <span className="font-mono text-[9px] uppercase text-brass-500/80">{t('game.rail.bot')}</span>}
              {online && !p.isBot && typeof latency[index] === 'number' && <span className="font-mono text-[9px] tabular-nums text-cream-100/55">{latency[index]} ms</span>}
            </span>
            <span className="mt-0.5 flex items-baseline gap-2 font-mono leading-none">
              <span className="flex items-baseline gap-0.5 text-[15px] font-bold" style={{ color: color.hex }}>
                <Coins className="h-3 w-3 shrink-0 self-center opacity-80" />
                {sum(money)}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-bottle-600 brightness-150">
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                {lvl}
                <span className="text-cream-100/45">({sum(INCOME_PAYOUT[p.income])})</span>
              </span>
            </span>
            <span className="mt-1 block font-mono text-[9px] leading-tight text-cream-100/55">
              {t('game.railLane.spentLine', { spent: sum(p.spent), purse: sum(p.spent + p.money) })}
              <span className="text-cream-100/30"> · </span>
              {t('game.railLane.rankLine', { rank: nextRank })}
              {drift === 'up' ? ' ↑' : drift === 'down' ? ' ↓' : ''}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the card, unfolding out of its disc */}
      <AnimatePresence>
        {open && game && (
          <motion.div
            key="card"
            className="absolute z-[71]"
            style={{ left: LANE + RING + 8, top: -2 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0.4, clipPath: 'inset(0% 100% 0% 0%)' }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', transitionEnd: { clipPath: 'none' } }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
            transition={{ duration: reduced ? 0.12 : 0.26, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div ref={sheet} tabIndex={-1} className="w-[268px] outline-none">
              <RailChip p={p} index={index} active={active} nowRank={nowRank} nextRank={nextRank} live={null} onCard={() => setCardOpen((c) => !c)} />
            </div>
            <AnimatePresence>{cardOpen && <div className="absolute left-full top-0 z-[70] ml-2"><PlayerCard game={game} seat={index} onClose={() => setCardOpen(false)} /></div>}</AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** the slip: the whole column folded into a brass tab on the left edge,
 *  one pip per seat in the order of play, the one to act lit */
function Slip({ order, players, lit, left, top, reduced }: { order: number[]; players: PlayerState[]; lit: number | null; left: number; top: number; reduced: boolean }) {
  const t = useT();
  return (
    <motion.button
      type="button"
      data-player-rail
      onClick={() => setBoardOption('railMode', 'medals')}
      aria-label={t('game.railLane.slipOpen')}
      title={t('game.railLane.slipOpen')}
      initial={reduced ? { opacity: 0 } : { x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { x: -24, opacity: 0 }}
      whileHover={reduced ? undefined : { x: 3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="fixed z-[64] flex w-[16px] flex-col items-center gap-[7px] rounded-r-md border border-l-0 border-brass-700/60 bg-coal-950/90 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,.5)] outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-brass-400"
      style={{ left, top }}
    >
      {/* the grip, three struck lines */}
      <span aria-hidden className="flex flex-col gap-[2px]">
        {[0, 1, 2].map((k) => <span key={k} className="block h-px w-[7px] bg-brass-500/60" />)}
      </span>
      {order.map((i) => (
        <span key={i} aria-hidden className="relative flex h-[10px] w-[10px] items-center justify-center">
          {lit === i && <LanternGlow size={22} reduced={reduced} />}
          <ShapeChip color={players[i].color} size={9} vivid />
        </span>
      ))}
      <span aria-hidden className="flex flex-col gap-[2px]">
        {[0, 1, 2].map((k) => <span key={k} className="block h-px w-[7px] bg-brass-500/60" />)}
      </span>
    </motion.button>
  );
}

/* the small row under the column that moves it between its states */
const SWITCH = 'plaque flex h-6 items-center justify-center rounded-md text-brass-500/80 opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100';

/* PlayerRail — the players in play order, whoever acts first this round at
 * the top, gliding to their new places when the round turns. Three states,
 * kept in the board options: the medallions (a narrow column, the default),
 * the full cards, and the slip on the left edge. A game read again keeps
 * its trimmed cards, laid under the curve with the live standing. */
function PlayerRail({ tools }: { tools?: ReactNode }) {
  const t = useT();
  const game = useShownGame();
  const reading = useGame((s) => s.review !== null);
  const insets = useHudInsets();
  const narrow = useNarrow();
  const reduced = useReducedMotion();
  const { railMode, focus, incomeSide, incomePinned } = useBoardOptions();
  const [cardSeat, setCardSeat] = useState<number | null>(null);
  const [openSeat, setOpenSeat] = useState<number | null>(null);
  const [peek, setPeek] = useState<number | null>(null);
  if (!game) return null;
  const next = projectedOrder(game);
  const mode = shownRailMode({ mode: railMode, focus, reading });
  const set = (m: RailMode) => {
    setOpenSeat(null);
    setBoardOption('railMode', m);
  };
  const lit = lanternStop(game.order, game.current, game.phase === 'game-over');

  if (mode === 'slip') {
    return (
      <AnimatePresence>
        <Slip key="slip" order={game.order} players={game.players} lit={lit === null ? null : game.order[lit]} left={incomeSide === 'left' ? (incomePinned ? TRACK_W : FILET_W) : 0} top={narrow ? narrowRailTop(insets) : insets.top + 4} reduced={reduced} />
      </AnimatePresence>
    );
  }

  /* a game being read: the chips trimmed and laid in a row under the curve,
     the board left to the reading */
  const compact = narrow || reading;
  const row = narrow;
  /* a game read again shows the standing as it was at that moment: the points
     banked, plus what the board would have scored had the era ended there.
     Once an era has been counted — the canal's scoring, the game's end — the
     tiles still standing are already in the bank, and adding them again
     printed 194 for a winner who closed on 143 */
  const counted = game.phase === 'game-over' || game.phase === 'scoring-canal';
  const live = reading && !counted ? projectEraScores(game) : null;
  const medals = mode === 'medals';

  /* wide: a vertical stack top-left. Narrow: a wrapping strip under the top
     bar */
  return (
    <div
      data-player-rail
      className={cn('fixed z-[64] flex gap-2', row ? 'flex-row flex-wrap items-start' : 'flex-col')}
      style={narrow ? { left: insets.left, right: 12, top: narrowRailTop(insets) } : { left: insets.left, top: insets.top }}
      aria-label={t('game.rail.playersAria')}
    >
      {medals ? (
        <motion.div
          key="medals"
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22 }}
          className={cn('relative flex', row ? 'flex-row' : 'flex-col')}
          style={{ gap: GAP }}
        >
          {/* the signal post the lantern rides, from the first disc to the last */}
          {!row && game.order.length > 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute w-px"
              style={{ left: LANE / 2 - 0.5, top: RING / 2, height: (game.order.length - 1) * PITCH, background: 'linear-gradient(180deg, rgba(201,164,92,.1), rgba(201,164,92,.45) 12%, rgba(201,164,92,.45) 88%, rgba(201,164,92,.1))' }}
            />
          )}
          {game.order.map((i, pos) => (
            <motion.div key={i} layout transition={{ type: 'spring', stiffness: 260, damping: 30 }} className={cn('relative', (openSeat === i || peek === i) && 'z-[2]')}>
              <Medal
                p={game.players[i]}
                index={i}
                active={i === game.current && lit !== null}
                nowRank={pos + 1}
                nextRank={next.indexOf(i) + 1}
                open={openSeat === i}
                onToggle={() => setOpenSeat((s) => (s === i ? null : i))}
                onClose={() => setOpenSeat((s) => (s === i ? null : s))}
                onPeek={(on) => setPeek((s) => (on ? i : s === i ? null : s))}
                reduced={reduced}
              />
              {/* a telegram hangs beside the disc rather than under it */}
              {openSeat !== i && (
                <div className="absolute top-0 z-[1] w-60 [&>div]:!mt-0 [&>div]:!rounded-md [&>div]:!border-t" style={{ left: LANE + RING + 10 }}>
                  <TelegramPlaque seat={i} compact />
                </div>
              )}
            </motion.div>
          ))}
          {/* the lantern of the turn: it travels down the post to the seat to
              act; with motion reduced it is simply lit at its new place */}
          {lit !== null && (
            <motion.span
              key={reduced ? `lamp-${game.current}` : 'lamp'}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 z-[1] block"
              /* motion reduced: the lamp is set down at its stop and only its
                 light comes up; nothing slides, not even the first frame */
              style={reduced ? { width: LANE, left: row ? lit * (SLOT_W + GAP) : 0, top: row ? RING / 2 - LANTERN_H / 2 : lit * PITCH + RING / 2 - LANTERN_H / 2 } : { width: LANE }}
              initial={reduced ? { opacity: 0 } : false}
              animate={reduced ? { opacity: 1 } : { opacity: 1, x: row ? lit * (SLOT_W + GAP) : 0, y: row ? RING / 2 - LANTERN_H / 2 : lit * PITCH + RING / 2 - LANTERN_H / 2 }}
              transition={reduced ? { duration: 0.35 } : { type: 'spring', stiffness: 150, damping: 20 }}
            >
              <span className="relative flex justify-center">
                <LanternGlow size={60} reduced={reduced} />
                <Lantern h={LANTERN_H} reduced={reduced} />
              </span>
            </motion.span>
          )}
        </motion.div>
      ) : (
        <LayoutGroup id="rail-cards">
          <motion.div
            key="cards"
            initial={reduced ? { opacity: 0 } : { opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', transitionEnd: { clipPath: 'none' } }}
            transition={{ duration: reduced ? 0.15 : 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className={cn('flex gap-2', row ? 'flex-row flex-wrap' : 'flex-col')}
          >
            {game.order.map((i, pos) => (
              <motion.div key={i} layout transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="relative flex flex-col">
                <RailChip p={game.players[i]} index={i} active={i === game.current && lit !== null} nowRank={pos + 1} nextRank={next.indexOf(i) + 1} compact={compact} live={live ? live[i].total : null} onCard={() => setCardSeat((c) => (c === i ? null : i))} travel />
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
          </motion.div>
        </LayoutGroup>
      )}
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
      {/* the column's own switches: spread the cards or fold them to discs,
          and put the whole column away in the slip. Not while a game is
          read: the row is already as small as it gets */}
      {!reading && (
        <div className="flex gap-1" style={medals && !row ? { width: SLOT_W } : row ? undefined : { width: '100%' }}>
          {!focus && (
            <button
              type="button"
              onClick={() => set(medals ? 'cards' : 'medals')}
              aria-label={t(medals ? 'game.railLane.toCards' : 'game.railLane.toMedals')}
              title={t(medals ? 'game.railLane.toCards' : 'game.railLane.toMedals')}
              className={cn(SWITCH, row ? 'w-8' : 'flex-1')}
            >
              {medals ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
            </button>
          )}
          <button type="button" onClick={() => set('slip')} aria-label={t('game.railLane.toSlip')} title={t('game.railLane.toSlip')} className={cn(SWITCH, 'w-8')}>
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {tools && !focus && !reading && (
        /* the tools follow the column: two abreast under the discs, a
           plain row under the cards */
        <div className={cn(medals && !row ? 'grid grid-cols-2 gap-1' : 'flex flex-wrap items-center gap-1.5')} style={medals && !row ? { width: SLOT_W } : undefined}>
          {tools}
        </div>
      )}
    </div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(PlayerRail);
