import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { INCOME_PAYOUT, INDUSTRIES, INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS, TOWN_BY_ID, fmtPay, incomeLevel } from '@/game/data';
import { useGame } from '@/game/store';
import type { IndustryType, PlayerState } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { hudInsets, setBoardOption, useBoardOptions } from './boardOptions';
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
/** width of a rail chip + gap: where the mat's left edge lands */
const RAIL_W = 236;

function IndustryBlock({ ind, p, playerIdx }: { ind: IndustryType; p: PlayerState; playerIdx: number }) {
  const t = useT();
  const game = useGame((s) => s.game)!;
  const levels = INDUSTRIES[ind];
  const left = p.stacks[ind];
  const nextLevel = left[0];
  const next = levels.find((lv) => lv.level === nextLevel);
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
      {/* the stack laid flat: one chip per level, level I first like the printed mat */}
      <ul className="mt-1.5 flex flex-wrap gap-1">
        {levels.map((lv) => {
          const count = left.filter((l) => l === lv.level).length;
          const isNext = nextLevel === lv.level;
          const gone = count === 0;
          return (
            <li
              key={lv.level}
              title={`L${lv.level} · £${lv.cost} · +${lv.incomeDelta} · ${lv.vp} VP`}
              className={cn(
                'flex items-center gap-1 rounded-[4px] border px-1.5 py-[3px] font-mono text-[9.5px]',
                isNext ? 'border-brass-400 bg-brass-500/15 text-cream-100 shadow-[0_0_8px_rgba(201,164,92,.25)]' : gone ? 'border-brass-700/25 text-cream-100/35' : 'border-brass-700/50 text-cream-100/80',
              )}
            >
              <span className="flex gap-[2px]">
                {Array.from({ length: lv.level }, (_, i) => (
                  <span key={i} className={cn('h-[4px] w-[4px] rounded-full', gone ? 'bg-brass-700/60' : 'bg-brass-400')} />
                ))}
              </span>
              <span className="font-bold">{gone ? '—' : `×${count}`}</span>
            </li>
          );
        })}
      </ul>
      {/* the next tile to build: what it costs and gives */}
      {next ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9.5px] text-cream-100/70">
          <span className="rounded-sm bg-brass-400 px-1 font-sans text-[8px] font-black uppercase tracking-[0.14em] text-coal-950">{t('game.mat.next')}</span>
          <span className="font-bold text-cream-100">L{next.level}</span>
          <span className="text-brass-400">{t('game.mat.costs', { cost: next.cost })}</span>
          {(next.coal > 0 || next.iron > 0) && <span>{t('game.mat.needs', { coal: next.coal, iron: next.iron })}</span>}
          <span className="text-cream-100/85">
            +{next.incomeDelta} · {next.vp} VP
          </span>
          {next.beerToSell > 0 && <span>{t('game.mat.beer', { n: next.beerToSell })}</span>}
          {!next.eras.includes('rail') && <span className="rounded-sm border border-bottle-600/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-bottle-600 brightness-150">{t('game.mat.canalOnly')}</span>}
          {!next.eras.includes('canal') && <span className="rounded-sm border border-copper-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-copper-500 brightness-125">{t('game.mat.railOnly')}</span>}
          {next.noDevelop && <span className="rounded-sm border border-rust-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-rust-500 brightness-150">{t('game.mat.noDevelop')}</span>}
        </div>
      ) : (
        <div className="mt-1.5 font-mono text-[9.5px] text-cream-100/40">{t('game.mat.gone')}</div>
      )}
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
  const insets = hudInsets(useBoardOptions());

  useEffect(() => {
    if (matPlayer === null) return;
    /* one left-hand panel at a time: the mat takes the settings' place */
    setBoardOption('settingsOpen', false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matPlayer, closeMat]);

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
          style={{ left: insets.left + RAIL_W, top: insets.top, bottom: insets.bottom + 8, width: `min(400px, calc(100vw - ${insets.left + RAIL_W + 12}px))` }}
        >
          {/* player tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-brass-700/40 px-3 py-2">
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
                  <ShapeChip color={pl.color} size={10} />
                  {pl.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={closeMat}
              aria-label={t('game.mat.close')}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-brass-700/70 bg-coal-900/90 text-brass-400 hover:bg-coal-800"
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
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
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
