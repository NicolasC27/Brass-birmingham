import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { INCOME_MAX, INCOME_PAYOUT, LOAN_AMOUNT, PLAYER_COLORS, fmtPay, incomeLevel, levelTopSpace, loanLanding } from '@/game/data';
import { useGame, useShownGame } from '@/game/store';
import { useT } from '@/i18n';
import Tooltip from './Tooltip';
import { ShapeChip } from './TownInspector';
import { useReducedMotion } from './useReducedMotion';
import { TRACK_H, TRACK_W, useBoardOptions } from './boardOptions';

/* ------------------------------------------------------------------ */
/* Two STRAIGHT tracks, one per scale:                                  */
/*  • victory points: a ruler 0→100 along the TOP edge                  */
/*  • income: graduated by PAYOUT bracket, along the BOTTOM edge or     */
/*    down the LEFT edge (board option `incomeSide`)                    */
/* Both tracks ZOOM under the mouse wheel (up to ×6, around the cursor),*/
/* pan by dragging, and reset on double-click. Every position is a      */
/* fraction of the track, so the same code lays out either axis.       */
/* ------------------------------------------------------------------ */

type Axis = 'x' | 'y';
type Kind = 'vp' | 'income';

const LVL_N = INCOME_MAX + 1; // spaces 0..99
export { TRACK_H };

/* the VP ruler grows with the leader: 0–100, then 0–150 past 100, then
 * 0–300 past 150 — no wrap-around, every pawn stays on the ruler */
const vpTrackMax = (best: number) => (best > 150 ? 300 : best > 100 ? 150 : 100);

/* levels 0–10 (one payout each, where everybody starts) get DOUBLE width
 * so their −£n labels fit and the opening pile has room to breathe */
const W_LOW = 2;
const UNITS = 11 * W_LOW + (LVL_N - 11);
const lvlStart = (l: number) => (l <= 10 ? l * W_LOW : 11 * W_LOW + (l - 11));
const lvlW = (l: number) => (l <= 10 ? W_LOW : 1);
const lvlPct = (lvl: number) => {
  const l = Math.min(lvl, INCOME_MAX);
  return ((lvlStart(l) + lvlW(l) / 2) / UNITS) * 100;
};
type Band = { from: number; to: number; pay: number };
const bandUnits = (b: { from: number; to: number }) => lvlStart(b.to) + lvlW(b.to) - lvlStart(b.from);
const BANDS: Band[] = (() => {
  const out: Band[] = [];
  for (let l = 0; l <= INCOME_MAX; l++) {
    const pay = INCOME_PAYOUT[l];
    const last = out[out.length - 1];
    if (last && last.pay === pay) last.to = l;
    else out.push({ from: l, to: l, pay });
  }
  return out;
})();

const CHIP = 16;
const ZOOM_MAX = 6;

/** place something at `pct` (0 = track start) along the lane's axis */
function at(axis: Axis, pct: number, extra: CSSProperties = {}): CSSProperties {
  return axis === 'x' ? { left: `${pct}%`, ...extra } : { top: `${100 - pct}%`, ...extra };
}
/** the same as `at`, as a plain motion target */
const anim = (axis: Axis, pct: number): Record<string, string> => (axis === 'x' ? { left: `${pct}%` } : { top: `${100 - pct}%` });
/** a span from `a` to `b` (pct) along the axis */
function span(axis: Axis, a: number, b: number, extra: CSSProperties = {}): CSSProperties {
  const lo = Math.min(a, b);
  const len = Math.abs(b - a);
  return axis === 'x' ? { left: `${lo}%`, width: `${len}%`, ...extra } : { top: `${100 - lo - len}%`, height: `${len}%`, ...extra };
}

/* ------------------------------ zoom ------------------------------- */

/**
 * `window` (optional): the [lo, hi] fraction of the track that should stay in
 * view when the user has not zoomed by hand — the lane frames it (up to ×4)
 * and eases out as the pawns spread. A wheel takes manual control; a
 * double-click hands it back.
 */
function useLaneZoom(axis: Axis, window?: [number, number]) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1000);
  /* null = automatic framing (derived below); an object = the user's own zoom */
  const [manual, setManual] = useState<{ zoom: number; offset: number } | null>(null);
  const drag = useRef<{ start: number; offset: number } | null>(null);
  const AUTO_MAX = 4;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* ResizeObserver reports once on observe(), so no synchronous setState here */
    const ro = new ResizeObserver(([e]) => setSize(axis === 'x' ? e.contentRect.width : e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [axis]);

  /* automatic framing: fit the window, up to ×AUTO_MAX, centred on it */
  let auto = { zoom: 1, offset: 0 };
  if (window && size > 1) {
    const [lo, hi] = window;
    const a = axis === 'x' ? lo : 100 - hi;
    const b = axis === 'x' ? hi : 100 - lo;
    const z = Math.max(1, Math.min(AUTO_MAX, 100 / Math.max(1, b - a)));
    const centre = ((a + b) / 2 / 100) * size * z;
    auto = { zoom: z, offset: Math.max(0, Math.min(size * (z - 1), centre - size / 2)) };
  }
  const { zoom, offset } = manual ?? auto;
  const live = useRef({ zoom, offset, size });
  useEffect(() => {
    live.current = { zoom, offset, size };
  }, [zoom, offset, size]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cursor = axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top;
      const { zoom: z, offset: o, size: sz } = live.current;
      const nz = Math.max(1, Math.min(ZOOM_MAX, z * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const frac = (cursor + o) / (sz * z);
      setManual({ zoom: nz, offset: Math.max(0, Math.min(sz * (nz - 1), frac * sz * nz - cursor)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [axis]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || e.button !== 0) return;
    drag.current = { start: axis === 'x' ? e.clientX : e.clientY, offset };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const cur = axis === 'x' ? e.clientX : e.clientY;
    setManual({ zoom, offset: Math.max(0, Math.min(size * (zoom - 1), d.offset - (cur - d.start))) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const reset = () => setManual(null);
  const inner: CSSProperties =
    axis === 'x'
      ? { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${zoom * 100}%`, transform: `translateX(${-offset}px)` }
      : { position: 'absolute', left: 0, right: 0, top: 0, height: `${zoom * 100}%`, transform: `translateY(${-offset}px)` };
  return { ref, zoom, size, inner, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick: reset }, grabbing: zoom > 1 };
}

/* ------------------------------ pawns ------------------------------ */

type Move = { id: string; kind: Kind; idx: number; from: number; to: number; delta: number };

function Pawn({
  axis,
  idx,
  kind,
  pct,
  fanIndex,
  fanSize,
  showLabel,
  spot,
  onToggle,
  reduced,
}: {
  axis: Axis;
  idx: number;
  kind: Kind;
  pct: number;
  fanIndex: number;
  fanSize: number;
  showLabel: boolean;
  spot: boolean;
  onToggle: () => void;
  reduced: boolean;
}) {
  const game = useShownGame()!;
  const t = useT();
  const p = game.players[idx];
  const col = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const pay = fmtPay(INCOME_PAYOUT[p.income]);
  const after = loanLanding(p.income) ?? p.income;
  /* the climb ahead: how many spaces the pawn still has to cross before
     the next level pays, or the ceiling */
  const lvl = incomeLevel(p.income);
  const toNext = lvl >= 30 ? 0 : levelTopSpace(lvl) + 1 - p.income;
  const nextPay = fmtPay(INCOME_PAYOUT[Math.min(INCOME_MAX, levelTopSpace(lvl) + 1)]);
  const fan = (fanIndex - (fanSize - 1) / 2) * 10;
  const zig = fanSize > 1 ? (fanIndex % 2 ? 4 : -4) : 0;
  const label = kind === 'vp' ? String(p.vp) : pay;
  const place: CSSProperties =
    axis === 'x' ? { top: '50%', marginLeft: fan - CHIP / 2, marginTop: -CHIP / 2 + zig, zIndex: 10 + fanIndex } : { left: 18, marginTop: fan - CHIP / 2, marginLeft: zig, zIndex: 10 + fanIndex };

  return (
    <motion.div
      className="pointer-events-none absolute z-10"
      initial={false}
      animate={anim(axis, pct)}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 22 }}
      style={place}
    >
      <Tooltip
        side={kind === 'vp' ? 'bottom' : axis === 'x' ? 'top' : 'right'}
        className="pointer-events-auto items-center"
        title={kind === 'vp' ? t('game.frame.vpPawnTitle', { name: p.name, vp: p.vp }) : t('game.incomeRail.pawnTitle', { name: p.name, lvl: incomeLevel(p.income), pay })}
        content={
          kind === 'vp' ? (
            t('game.frame.vpPawnHint', { money: p.money, built: p.stats.built, links: p.stats.links })
          ) : (
            <>
              <span className="block font-semibold text-cream-100">{toNext > 0 ? t('game.incomeRail.pawnNext', { n: toNext, lvl: lvl + 1, pay: nextPay }) : t('game.incomeRail.pawnTop')}</span>
              <span className="mt-1 block">{t('game.incomeRail.pawnHint', { amount: LOAN_AMOUNT, after: incomeLevel(after), pay: fmtPay(INCOME_PAYOUT[after]) })}</span>
            </>
          )
        }
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.25 }}
          whileTap={{ scale: 0.9 }}
          animate={{
            boxShadow: spot ? [`0 0 0 1.5px ${col}, 0 0 6px ${col}`, `0 0 0 2px ${col}, 0 0 14px ${col}`] : `0 0 0 1.5px ${col}, 0 1px 3px rgba(0,0,0,.8)`,
          }}
          transition={spot ? { boxShadow: { repeat: Infinity, repeatType: 'reverse', duration: 0.9 } } : undefined}
          aria-pressed={spot}
          aria-label={kind === 'vp' ? t('game.frame.vpPawnAria', { name: p.name, vp: p.vp }) : t('game.incomeRail.pawnAria', { name: p.name, lvl: incomeLevel(p.income), pay })}
          onClick={onToggle}
          onPointerDown={(e) => e.stopPropagation()}
          /* the pawn is painted at 16px; its hit zone runs 4px further all
             round (24px, the target floor), the drawing of the track untouched */
          className="relative flex shrink-0 items-center justify-center rounded-full before:absolute before:-inset-1 before:rounded-full before:content-['']"
          style={{ width: CHIP, height: CHIP, background: `${col}55` }}
        >
          <ShapeChip color={p.color} size={10} />
        </motion.button>
        {showLabel && (
          <span
            aria-hidden
            className={`ml-1 whitespace-nowrap font-mono text-[9.5px] font-bold leading-none ${kind === 'income' && INCOME_PAYOUT[p.income] < 0 ? 'text-[#C4644F]' : 'text-cream-100'}`}
            style={{ textShadow: '0 1px 1px rgba(0,0,0,.95), 0 0 4px rgba(0,0,0,.8)' }}
          >
            {label}
          </span>
        )}
      </Tooltip>
    </motion.div>
  );
}

/** "+3" that rises and fades from the landing cell, plus the run the pawn crossed */
function MoveFx({ axis, move, pct, from, to, col, reduced }: { axis: Axis; move: Move; pct: number; from: number; to: number; col: string; reduced: boolean }) {
  const dur = reduced ? 0.01 : 1.1;
  const runStyle: CSSProperties = axis === 'x' ? { ...span('x', from, to), top: '50%', height: 3, marginTop: -1.5 } : { ...span('y', from, to), left: 22, width: 3 };
  const labelStyle: CSSProperties = axis === 'x' ? { ...at('x', pct), top: '50%' } : { ...at('y', pct), left: 36 };
  return (
    <>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute z-[9] rounded-full"
        style={{ ...runStyle, background: col }}
        initial={{ opacity: 0.75 }}
        animate={{ opacity: 0 }}
        transition={{ duration: dur, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden
        className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-black ${move.delta < 0 ? 'text-rust-500 brightness-150' : 'text-bottle-600 brightness-[1.8]'}`}
        style={{ ...labelStyle, textShadow: '0 1px 2px rgba(0,0,0,.95)' }}
        initial={{ y: -8, opacity: 1 }}
        animate={{ y: -26, opacity: 0 }}
        transition={{ duration: dur, ease: 'easeOut' }}
      >
        {move.delta > 0 ? `+${move.delta}` : move.delta}
      </motion.span>
    </>
  );
}

/* ------------------------------ tracks ----------------------------- */

function EdgeTracks() {
  const game = useShownGame();
  const spotlight = useGame((s) => s.spotlight);
  const setSpotlight = useGame((s) => s.setSpotlight);
  const loanConfirm = useGame((s) => s.loanConfirm);
  const loanPeek = useGame((s) => s.loanPeek);
  const { incomeSide, vpTrack: vpTrackOn } = useBoardOptions();
  /* a game being read: the analysis's curve takes the top edge */
  const reading = useGame((s) => s.debriefOpen && s.game?.phase === 'game-over');
  const t = useT();
  const reduced = useReducedMotion();
  const incAxis: Axis = incomeSide === 'left' ? 'y' : 'x';

  /* the VP lane frames every pawn: the ruler stretches with the leader and
     the lane zooms on the pack, 6 points of air either side, never narrower
     than a third of the ruler */
  const vps = game ? game.players.map((p) => p.vp) : [0];
  const vpMax = vpTrackMax(Math.max(...vps));
  const vpPct = (vp: number) => (Math.min(vp, vpMax) / vpMax) * 100;
  const vpLo = vpPct(Math.max(0, Math.min(...vps) - 6));
  const vpHi = vpPct(Math.min(vpMax, Math.max(...vps) + 6));
  const vpPad = Math.max(0, 34 - (vpHi - vpLo)) / 2;
  const vpWindow: [number, number] = [Math.max(0, vpLo - vpPad), Math.min(100, vpHi + vpPad)];
  const vpLane = useLaneZoom('x', vpWindow);
  /* the income lane frames the pawns: tight at the start (everyone sits on
     level 0), wider as incomes spread; 8 spaces of air either side, never
     narrower than a third of the track */
  const incomes = game ? game.players.map((p) => p.income) : [10];
  const winLo = Math.max(0, lvlPct(Math.max(0, Math.min(...incomes) - 8)));
  const winHi = Math.min(100, lvlPct(Math.min(INCOME_MAX, Math.max(...incomes) + 8)));
  const pad = Math.max(0, 34 - (winHi - winLo)) / 2;
  const incWindow: [number, number] = [Math.max(0, winLo - pad), Math.min(100, winHi + pad)];
  const incLane = useLaneZoom(incAxis, incWindow);

  /* detect pawn moves → delta floats + run flash */
  const prev = useRef<Map<number, { vp: number; income: number }> | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const sig = game ? game.players.map((p) => `${p.vp}/${p.income}`).join('|') : '';
  useEffect(() => {
    if (!game) return;
    const now = new Map(game.players.map((p, i) => [i, { vp: p.vp, income: p.income }]));
    const was = prev.current;
    prev.current = now;
    if (!was || was.size !== now.size) return;
    const fresh: Move[] = [];
    now.forEach((cur, i) => {
      const old = was.get(i);
      if (!old) return;
      if (old.vp !== cur.vp) fresh.push({ id: `vp-${i}-${cur.vp}-${Date.now()}`, kind: 'vp', idx: i, from: old.vp, to: cur.vp, delta: cur.vp - old.vp });
      if (old.income !== cur.income) fresh.push({ id: `inc-${i}-${cur.income}-${Date.now()}`, kind: 'income', idx: i, from: old.income, to: cur.income, delta: cur.income - old.income });
    });
    if (!fresh.length) return;
    setMoves((m) => [...m, ...fresh]);
    const ids = new Set(fresh.map((f) => f.id));
    const h = window.setTimeout(() => setMoves((m) => m.filter((x) => !ids.has(x.id))), 1300);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  if (!game) return null;

  const belt = 'bg-coal-950/85 border-brass-700/40 backdrop-blur-md';
  const toggle = (i: number) => setSpotlight(spotlight === i ? null : i);

  /* players sharing a cell fan out; only the last wears the label */
  const groups = (kind: Kind) => {
    const map = new Map<number, number[]>();
    game.players.forEach((p, i) => {
      const v = kind === 'vp' ? p.vp : p.income;
      map.set(v, [...(map.get(v) ?? []), i]);
    });
    return map;
  };
  const vpAt = groups('vp');
  const incAt = groups('income');

  const pawns = (kind: Kind, axis: Axis) =>
    game.players.map((p, i) => {
      const map = kind === 'vp' ? vpAt : incAt;
      const key = kind === 'vp' ? p.vp : p.income;
      const list = map.get(key) ?? [i];
      const crowded = kind === 'vp' ? map.has(key + 1) || map.has(key + 2) : key > 10 ? map.has(key + 1) || map.has(key + 2) : map.has(key + 1);
      return (
        <Pawn
          key={`${kind}-${i}`}
          axis={axis}
          idx={i}
          kind={kind}
          pct={kind === 'vp' ? vpPct(p.vp) : lvlPct(p.income)}
          fanIndex={list.indexOf(i)}
          fanSize={list.length}
          showLabel={list[list.length - 1] === i && !(crowded && axis === 'x')}
          spot={spotlight === i}
          onToggle={() => toggle(i)}
          reduced={reduced}
        />
      );
    });

  const fx = (kind: Kind, axis: Axis) =>
    moves
      .filter((m) => m.kind === kind)
      .map((m) => {
        const col = PLAYER_COLORS[game.players[m.idx].color]?.hex ?? '#C9A45C';
        const f = kind === 'vp' ? vpPct(m.from) : lvlPct(m.from);
        const to = kind === 'vp' ? vpPct(m.to) : lvlPct(m.to);
        return <MoveFx key={m.id} axis={axis} move={m} pct={to} from={f} to={to} col={col} reduced={reduced} />;
      });

  /* loan preview: a dashed ghost at the landing space while the note is on the table */
  const cur = game.players[game.current];
  const ghostLvl = loanLanding(cur.income) ?? cur.income;
  const ghostCol = PLAYER_COLORS[cur.color]?.hex ?? '#C9A45C';

  const pxPerUnit = (incLane.size * incLane.zoom) / UNITS;
  const fits = (b: Band) => (incAxis === 'x' ? bandUnits(b) * pxPerUnit >= fmtPay(b.pay).length * 5.2 + 4 : bandUnits(b) * pxPerUnit >= 12);

  const grab = (lane: ReturnType<typeof useLaneZoom>) => (lane.grabbing ? 'cursor-grab active:cursor-grabbing' : '');

  return (
    <div role="group" aria-label={t('game.frame.aria')}>
      {/* ====================== TOP — victory points ======================
          on screen when the player asked for it (settings, or the key):
          a row of zeros is what they asked to see, not a surprise */}
      <AnimatePresence initial={false}>
        {game && vpTrackOn && !reading && (
          <motion.div
            key="vp"
            initial={{ y: -TRACK_H }}
            animate={{ y: 0 }}
            exit={{ y: -TRACK_H }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className={`fixed inset-x-0 top-0 z-[58] border-b ${belt}`}
            style={{ height: TRACK_H }}
            aria-label={t('game.frame.vpTrackLabel')}
            data-lens="vp"
          >
            <span aria-hidden className="absolute left-1.5 top-[3px] font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-brass-400/70">
              {t('game.frame.vpTrackShort')}
              {vpLane.zoom > 1.01 && <span title={t('game.frame.zoomTip')} className="ml-1 text-cream-100/50">×{vpLane.zoom.toFixed(1)}</span>}
            </span>
            <div ref={vpLane.ref} className={`relative mx-12 h-full overflow-hidden ${grab(vpLane)}`} {...vpLane.handlers}>
              <div style={vpLane.inner}>
                {Array.from({ length: vpMax / 10 + 1 }, (_, k) => k * 10).map((v) => (
                  <span key={v} aria-hidden className="absolute top-[2px] -translate-x-1/2 font-mono text-[9px] font-bold leading-none text-brass-400" style={{ left: `${(v / vpMax) * 100}%` }}>
                    {v}
                  </span>
                ))}
                {Array.from({ length: vpMax + 1 }, (_, v) => (
                  <span
                    key={v}
                    aria-hidden
                    className={`absolute bottom-0 w-px ${v % 10 === 0 ? 'h-[10px] bg-brass-400' : v % 5 === 0 ? 'h-[7px] bg-brass-500/80' : 'h-[4px] bg-brass-700/60'}`}
                    style={{ left: `${(v / vpMax) * 100}%` }}
                  />
                ))}
                {fx('vp', 'x')}
                {pawns('vp', 'x')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================== income: BOTTOM edge or LEFT edge ====================== */}
      <div
        className={`fixed z-[58] ${belt} ${incAxis === 'x' ? 'inset-x-0 bottom-0 border-t' : 'bottom-0 left-0 border-r'}`}
        style={incAxis === 'x' ? { height: TRACK_H } : { width: TRACK_W, top: TRACK_H }}
        aria-label={t('game.incomeRail.aria')}
        data-lens="income"
      >
        <span aria-hidden className={`absolute font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-brass-400/70 ${incAxis === 'x' ? 'bottom-[3px] left-1.5' : 'left-1.5 top-[3px]'}`}>
          {t('game.incomeRail.trackShort')}
          {incLane.zoom > 1.01 && <span title={t('game.frame.zoomTip')} className="ml-1 text-cream-100/50">×{incLane.zoom.toFixed(1)}</span>}
        </span>
        <div ref={incLane.ref} className={`relative overflow-hidden ${incAxis === 'x' ? 'mx-12 h-full' : 'mx-0 mb-3 mt-4 h-[calc(100%-28px)]'} ${grab(incLane)}`} {...incLane.handlers}>
          <div style={incLane.inner}>
            {/* payout brackets */}
            {BANDS.map((b) => {
              const who = game.players.filter((p) => p.income >= b.from && p.income <= b.to).map((p) => p.name);
              const a0 = (lvlStart(b.from) / UNITS) * 100;
              const a1 = ((lvlStart(b.from) + bandUnits(b)) / UNITS) * 100;
              return (
                <div
                  key={b.from}
                  className={`absolute transition-colors hover:bg-brass-500/15 ${incAxis === 'x' ? 'bottom-0 top-0 border-r' : 'left-0 right-0 border-t'} border-brass-700/50 ${b.pay < 0 ? 'bg-rust-500/10' : ''}`}
                  style={span(incAxis, a0, a1)}
                >
                  <Tooltip
                    side={incAxis === 'x' ? 'top' : 'right'}
                    className={`absolute inset-0 !flex ${incAxis === 'x' ? 'items-start justify-center' : 'items-center justify-end pr-1'}`}
                    title={t('game.incomeRail.bandTitle', { levels: String(incomeLevel(b.from)), pay: fmtPay(b.pay) })}
                    content={who.length ? t('game.incomeRail.bandWho', { names: who.join(', ') }) : t('game.incomeRail.bandEmpty')}
                  >
                    {fits(b) && (
                      <span className={`${incAxis === 'x' ? 'mt-[2px]' : ''} font-mono text-[9px] font-bold leading-none ${b.pay < 0 ? 'text-[#C4644F]' : 'text-brass-400'}`}>
                        {fmtPay(b.pay)}
                      </span>
                    )}
                  </Tooltip>
                </div>
              );
            })}
            {/* space ticks + numerals every 10 */}
            {Array.from({ length: LVL_N }, (_, l) => (
              <span
                key={l}
                aria-hidden
                className={`pointer-events-none absolute ${
                  incAxis === 'x'
                    ? `bottom-0 w-px ${l % 10 === 0 ? 'h-[9px] bg-brass-400' : l % 5 === 0 ? 'h-[6px] bg-brass-500/70' : 'h-[3px] bg-brass-700/50'}`
                    : `left-0 h-px ${l % 10 === 0 ? 'w-[9px] bg-brass-400' : l % 5 === 0 ? 'w-[6px] bg-brass-500/70' : 'w-[3px] bg-brass-700/50'}`
                }`}
                style={at(incAxis, lvlPct(l))}
              />
            ))}
            {Array.from({ length: Math.floor(INCOME_MAX / 10) + 1 }, (_, k) => k * 10).map((l) => (
              <span
                key={l}
                aria-hidden
                className="pointer-events-none absolute font-mono text-[9px] leading-none text-cream-100/55"
                style={incAxis === 'x' ? { ...at('x', lvlPct(l)), bottom: 1, marginLeft: 3 } : { ...at('y', lvlPct(l)), left: 2, marginTop: 2 }}
              >
                {l}
              </span>
            ))}
            {fx('income', incAxis)}
            {(loanConfirm || loanPeek) && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute z-[12] flex items-center"
                initial={{ opacity: 0, ...anim(incAxis, lvlPct(cur.income)) }}
                animate={{ opacity: 1, ...anim(incAxis, lvlPct(ghostLvl)) }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 22 }}
                style={incAxis === 'x' ? { top: '50%', marginLeft: -CHIP / 2, marginTop: -CHIP / 2 } : { left: 18, marginTop: -CHIP / 2 }}
              >
                <span className="flex items-center justify-center rounded-full border border-dashed" style={{ width: CHIP, height: CHIP, borderColor: ghostCol, background: `${ghostCol}22` }}>
                  <ShapeChip color={cur.color} size={9} />
                </span>
                <span className="ml-1 whitespace-nowrap font-mono text-[9.5px] font-bold text-[#C4644F]" style={{ textShadow: '0 1px 1px rgba(0,0,0,.95)' }}>
                  {t('game.incomeRail.loanGhost', { pay: fmtPay(INCOME_PAYOUT[ghostLvl]) })}
                </span>
              </motion.div>
            )}
            {pawns('income', incAxis)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(EdgeTracks);
