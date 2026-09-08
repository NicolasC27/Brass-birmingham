import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { INCOME_PAYOUT, INDUSTRIES, INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS, TOWN_BY_ID, fmtPay, incomeLevel } from '@/game/data';
import { useGame } from '@/game/store';
import type { IndustryLevel, IndustryType, PlayerState } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { hudInsets, setBoardOption, useBoardOptions } from './boardOptions';
import { useNarrow } from '@/hooks/use-narrow';
import { INDUSTRY_COLOR } from './townChrome';
import { ShapeChip } from './TownInspector';

/* ------------------------------------------------------------------ */
/* The player MAT — the physical board every player keeps in front of  */
/* them: the tiles still to build per industry, stacked by level       */
/* (lowest on top, the only one you may build), with the next tile's   */
/* cost, resources, era restriction and lightbulb. Any player's mat    */
/* can be opened; under each stack, what that player already has on   */
/* the board. It docks beside the player rail (top-left) as a slim     */
/* panel, no veil, so the board stays in view and usable. Opened from  */
/* the rail or with P.                                                 */
/* ------------------------------------------------------------------ */

const ORDER: IndustryType[] = ['cotton', 'manufacturer', 'pottery', 'brewery', 'coal', 'iron'];
/** fallback width of the player rail (measured live once mounted) */
const RAIL_W = 236;

/** one printed tile of the mat: pips, price, income, VP, count — and a
 *  floating sheet with the rest on hover (a portal, so the scrolling mat
 *  never clips it and the tile itself never moves) */
function LevelTile({ ind, lv, count, isNext, gone }: { ind: IndustryType; lv: IndustryLevel; count: number; isNext: boolean; gone: boolean }) {
  const t = useT();
  const ref = useRef<HTMLLIElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  const show = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const up = r.bottom + 150 > window.innerHeight;
      setTip({ x: r.left + r.width / 2, y: up ? r.top - 6 : r.bottom + 6, up });
    }, 180);
  };
  const hide = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setTip(null);
  };
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const canalOnly = !lv.eras.includes('rail');
  const railOnly = !lv.eras.includes('canal');
  return (
    <li
      ref={ref}
      onPointerEnter={show}
      onPointerLeave={hide}
      className={cn(
        'relative flex w-[76px] cursor-help flex-col rounded-[5px] border px-1.5 py-1 transition-colors',
        isNext
          ? 'border-brass-400 bg-brass-500/15 shadow-[0_0_10px_rgba(201,164,92,.25)]'
          : gone
            ? 'border-brass-700/25 bg-coal-900/40 opacity-45'
            : 'border-brass-700/50 bg-coal-900/70 hover:border-brass-500',
      )}
    >
      {/* level pips + how many left */}
      <div className="flex items-center justify-between">
        <span className="flex gap-[2px]">
          {Array.from({ length: lv.level }, (_, i) => (
            <span key={i} className={cn('h-[4px] w-[4px] rounded-full', gone ? 'bg-brass-700/60' : 'bg-brass-400')} />
          ))}
        </span>
        <span className={cn('font-mono text-[9px] font-bold leading-none', gone ? 'text-cream-100/40' : 'text-brass-400')}>{gone ? '—' : `×${count}`}</span>
      </div>
      {/* the printed numbers: price, then income and VP */}
      <div className="mt-1 font-mono text-[12px] font-bold leading-none text-cream-100">£{lv.cost}</div>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[9px] leading-none">
        <span className="text-bottle-600 brightness-150">+{lv.incomeDelta}</span>
        <span className="text-cream-100/85">{lv.vp} VP</span>
      </div>
      {/* era / develop marks as small dots, spelled out in the sheet */}
      {(canalOnly || railOnly || lv.noDevelop) && (
        <span className="absolute right-1 top-[13px] flex gap-[3px]">
          {canalOnly && <span className="h-[5px] w-[5px] rounded-full bg-bottle-600 brightness-150" />}
          {railOnly && <span className="h-[5px] w-[5px] rounded-full bg-copper-500" />}
          {lv.noDevelop && <span className="h-[5px] w-[5px] rounded-full bg-rust-500" />}
        </span>
      )}
      {isNext && <span className="absolute -top-[7px] left-1.5 rounded-sm bg-brass-400 px-1 font-sans text-[7px] font-black uppercase leading-[11px] tracking-[0.14em] text-coal-950">{t('game.mat.next')}</span>}
      {tip &&
        createPortal(
          <div
            role="tooltip"
            className="plate pointer-events-none fixed z-[95] w-[220px] px-3 py-2 shadow-e3"
            style={{ left: tip.x, top: tip.y, transform: tip.up ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
          >
            <div className="flex items-baseline justify-between border-b border-brass-700/40 pb-1">
              <span className="font-fell text-[12px] tracking-wide text-brass-400">{INDUSTRY_LABEL[ind]} · {t('game.mat.level', { n: lv.level })}</span>
              <span className="font-mono text-[9px] text-cream-100/55">{gone ? t('game.mat.gone') : `×${count}`}</span>
            </div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-[3px] font-mono text-[9.5px] leading-[13px]">
              <dt className="text-cream-100/50">{t('game.mat.sheet.build')}</dt>
              <dd className="text-cream-100/90">
                {t('game.mat.costs', { cost: lv.cost })}
                {lv.coal > 0 && <span className="text-cream-100/70"> · {t('game.mat.coalN', { n: lv.coal })}</span>}
                {lv.iron > 0 && <span className="text-cream-100/70"> · {t('game.mat.ironN', { n: lv.iron })}</span>}
              </dd>
              <dt className="text-cream-100/50">{t('game.mat.sheet.flip')}</dt>
              <dd className="text-cream-100/90">{t('game.mat.sheet.flipGives', { inc: lv.incomeDelta, vp: lv.vp })}</dd>
              {lv.links > 0 && (
                <>
                  <dt className="text-cream-100/50">{t('game.mat.sheet.links')}</dt>
                  <dd className="text-cream-100/90">{t('game.mat.linkVp', { n: lv.links })}</dd>
                </>
              )}
              {(lv.cubes > 0 || lv.beerToSell > 0) && (
                <>
                  <dt className="text-cream-100/50">{t('game.mat.sheet.sell')}</dt>
                  <dd className="text-cream-100/90">
                    {lv.cubes > 0 && t(ind === 'brewery' ? 'game.mat.barrels' : 'game.mat.cubes', { n: lv.cubes })}
                    {lv.cubes > 0 && lv.beerToSell > 0 && ' · '}
                    {lv.beerToSell > 0 && t('game.mat.beer', { n: lv.beerToSell })}
                  </dd>
                </>
              )}
            </dl>
            {(canalOnly || railOnly || lv.noDevelop) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {canalOnly && <span className="rounded-sm border border-bottle-600/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-bottle-600 brightness-150">{t('game.mat.canalOnly')}</span>}
                {railOnly && <span className="rounded-sm border border-copper-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-copper-500 brightness-125">{t('game.mat.railOnly')}</span>}
                {lv.noDevelop && <span className="rounded-sm border border-rust-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-rust-500 brightness-150">{t('game.mat.noDevelop')}</span>}
              </div>
            )}
          </div>,
          document.body,
        )}
    </li>
  );
}

function IndustryBlock({ ind, p, playerIdx }: { ind: IndustryType; p: PlayerState; playerIdx: number }) {
  const t = useT();
  const game = useGame((s) => s.game)!;
  const levels = INDUSTRIES[ind];
  const left = p.stacks[ind];
  const nextLevel = left[0];
  const total = levels.reduce((a, l) => a + l.count, 0);
  const onBoard = Object.entries(game.tiles)
    .filter(([, x]) => x.owner === playerIdx && x.industry === ind)
    .map(([key, x]) => ({ key, x, town: TOWN_BY_ID[key.split(':')[0]]?.name ?? key }))
    .sort((a, b) => a.x.level - b.x.level);
  const color = INDUSTRY_COLOR[ind];
  return (
    <section className="rounded-md border border-brass-700/40 bg-coal-950/60 px-2.5 py-2">
      {/* head: icon, name, remaining */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="block h-4 w-4 shrink-0"
          style={{
            WebkitMaskImage: `url(${INDUSTRY_ICON[ind]})`,
            maskImage: `url(${INDUSTRY_ICON[ind]})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            backgroundColor: color,
          }}
        />
        <span className="truncate font-fell text-[13px] tracking-wide text-cream-100">{INDUSTRY_LABEL[ind]}</span>
        <span className="ml-auto shrink-0 font-mono text-[9.5px] text-cream-100/55">{t('game.mat.remaining', { left: left.length, total })}</span>
      </div>
      {/* the stack laid flat: one MINI TILE per level, level I first like the
          printed mat. Each tile carries what the printed one does — price,
          income, VP, and how many are left — so nothing needs a hover to be
          read; the full sheet floats in a tooltip anchored to the tile. */}
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {levels.map((lv) => {
          const count = left.filter((l) => l === lv.level).length;
          const isNext = nextLevel === lv.level;
          const gone = count === 0;
          return (
            <LevelTile key={lv.level} ind={ind} lv={lv} count={count} isNext={isNext} gone={gone} />
          );
        })}
      </ul>
      {/* what this player already has on the board for this industry */}
      {onBoard.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1 border-t border-brass-700/30 pt-1.5">
          {onBoard.map(({ key, x, town }) => (
            <li
              key={key}
              className={cn('rounded-[4px] border px-1.5 py-[2px] font-mono text-[9px]', x.flipped ? 'border-brass-500/60 text-brass-400' : 'border-brass-700/40 text-cream-100/75')}
              title={x.flipped ? t('game.mat.flipped') : x.cubes > 0 ? t('game.mat.stock', { n: x.cubes }) : undefined}
            >
              L{x.level} {town}
              {!x.flipped && x.cubes > 0 && <span className="text-cream-100/45"> · {x.cubes}</span>}
              {x.flipped && <span> ✓</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PlayerMat() {
  const t = useT();
  const game = useGame((s) => s.game);
  const matPlayer = useGame((s) => s.matPlayer);
  const openMat = useGame((s) => s.openMat);
  const closeMat = useGame((s) => s.closeMat);
  const opts = useBoardOptions();
  const insets = hudInsets(opts);
  const narrow = useNarrow();
  const wide = opts.matWide && !narrow;
  /* the mat sits flush right of the rail: measure it rather than guess */
  const [railW, setRailW] = useState(RAIL_W);
  const [railBottom, setRailBottom] = useState(0);
  useEffect(() => {
    if (matPlayer === null) return;
    const rail = document.querySelector<HTMLElement>('[data-player-rail]');
    if (!rail) return;
    const measure = () => {
      const r = rail.getBoundingClientRect();
      setRailW(Math.round(r.width) + 12);
      setRailBottom(Math.round(r.bottom));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [matPlayer]);

  useEffect(() => {
    if (matPlayer === null) return;
    /* one left-hand panel at a time: the mat takes the settings' place */
    setBoardOption('settingsOpen', false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMat();
        return;
      }
      /* 1–4: read that seat's mat (the digits leave the hand while it is open) */
      const n = Number(e.key);
      const g = useGame.getState().game;
      if (g && n >= 1 && n <= g.players.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openMat(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matPlayer, closeMat, openMat]);

  return (
    <AnimatePresence>
      {game && matPlayer !== null && (
        <motion.div
          key="mat"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-label={t('game.mat.title', { name: game.players[matPlayer].name })}
          className="plate fixed z-[78] flex flex-col overflow-hidden shadow-e4"
          style={
            narrow
              ? /* under the player strip, full width */ { left: 12, right: 12, top: railBottom + 8, bottom: insets.bottom + 8 }
              : wide
                ? { left: insets.left + railW, right: 12, top: insets.top, maxHeight: `calc(100vh - ${insets.top + insets.bottom + 8}px)` }
                : { left: insets.left + railW, top: insets.top, bottom: insets.bottom + 8, width: `min(400px, calc(100vw - ${insets.left + railW + 12}px))` }
          }
        >
          {/* player tabs — numbered like their shortcut; the wheel cycles seats */}
          <div
            className="flex flex-wrap items-center gap-1.5 border-b border-brass-700/40 px-3 py-2"
            onWheel={(e) => {
              const n = game.players.length;
              const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
              if (dir) openMat((matPlayer + dir + n) % n);
            }}
          >
            {game.players.map((pl, i) => {
              const col = PLAYER_COLORS[pl.color]?.hex ?? '#C9A45C';
              const active = i === matPlayer;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={active}
                  onClick={() => openMat(i)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1 font-fell text-[12px] tracking-wide transition-colors',
                    active ? 'border-brass-400 bg-brass-500/15 text-cream-100' : 'border-brass-700/50 text-cream-100/70 hover:border-brass-500 hover:text-cream-100',
                  )}
                  style={active ? { boxShadow: `inset 0 0 0 1px ${col}55` } : undefined}
                >
                  <kbd className={cn('rounded-[3px] border px-1 font-mono text-[8.5px] font-semibold leading-[13px]', active ? 'border-brass-400/70 text-brass-400' : 'border-brass-700/60 text-cream-100/45')}>{i + 1}</kbd>
                  <ShapeChip color={pl.color} size={10} />
                  {pl.name}
                </button>
              );
            })}
            {/* slim docked panel ↔ spread wide over the board (remembered) */}
            <button
              type="button"
              hidden={narrow}
              onClick={() => setBoardOption('matWide', !wide)}
              aria-label={wide ? t('game.mat.shrink') : t('game.mat.expand')}
              title={wide ? t('game.mat.shrink') : t('game.mat.expand')}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-brass-700/70 bg-coal-900/90 text-brass-400 hover:bg-coal-800"
            >
              {wide ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={closeMat}
              aria-label={t('game.mat.close')}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-brass-700/70 bg-coal-900/90 text-brass-400 hover:bg-coal-800"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {(() => {
            const p = game.players[matPlayer];
            const links = Object.values(game.links).filter((l) => l.owner === matPlayer).length;
            const stat = (v: string, dim = false) => <span className={cn('font-mono text-[10.5px]', dim ? 'text-cream-100/55' : 'text-cream-100/90')}>{v}</span>;
            return (
              <>
                {/* the counting-house line */}
                <div className="border-b border-brass-700/40 px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('game.mat.title', { name: p.name })}</h2>
                    {matPlayer === game.current && <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-brass-400">{t('game.rail.toAct')}</span>}
                    <span className="ml-auto font-sans text-[8.5px] uppercase tracking-[0.14em] text-cream-100/35">{t('game.mat.keyHint')}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {stat(`£${p.money}`)}
                    {stat(t('game.mat.income', { lvl: incomeLevel(p.income), pay: fmtPay(INCOME_PAYOUT[p.income]) }))}
                    {stat(`${p.vp} VP`)}
                    {stat(t('game.mat.links', { n: links }), true)}
                    {stat(t('game.mat.loans', { n: p.loans }), true)}
                    {stat(t('game.mat.hand', { n: p.hand.length }), true)}
                  </div>
                </div>
                {/* six industries, stacked like the printed mat read top to bottom */}
                <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-gutter:stable]', wide ? 'grid auto-rows-min grid-cols-3 gap-2 2xl:grid-cols-6' : 'flex flex-col gap-1.5')}>
                  {ORDER.map((ind) => (
                    <IndustryBlock key={ind} ind={ind} p={p} playerIdx={matPlayer} />
                  ))}
                </div>
              </>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
