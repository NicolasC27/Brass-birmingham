import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { INCOME_PAYOUT, INDUSTRIES, INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS, TOWN_BY_ID, fmtPay, incomeLevel } from '@/game/data';
import { useGame } from '@/game/store';
import type { IndustryType, PlayerState } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { INDUSTRY_COLOR } from './townChrome';
import { ShapeChip } from './TownInspector';

/* ------------------------------------------------------------------ */
/* The player MAT — the physical board every player keeps in front of  */
/* them: six industry columns, the tiles still to build stacked by     */
/* level (lowest on top, the only one you may build), with each        */
/* level's cost, resources, era restriction and lightbulb. Any player's */
/* mat can be opened; below the stacks, what that player already has   */
/* on the board. Opened from the player rail or with P.                */
/* ------------------------------------------------------------------ */

const ORDER: IndustryType[] = ['cotton', 'manufacturer', 'pottery', 'brewery', 'coal', 'iron'];

function Column({ ind, p, playerIdx }: { ind: IndustryType; p: PlayerState; playerIdx: number }) {
  const t = useT();
  const game = useGame((s) => s.game)!;
  const levels = INDUSTRIES[ind];
  const left = p.stacks[ind];
  const next = left[0];
  const total = levels.reduce((a, l) => a + l.count, 0);
  const onBoard = Object.entries(game.tiles)
    .filter(([, x]) => x.owner === playerIdx && x.industry === ind)
    .map(([key, x]) => ({ key, x, town: TOWN_BY_ID[key.split(':')[0]]?.name ?? key }))
    .sort((a, b) => a.x.level - b.x.level);
  const color = INDUSTRY_COLOR[ind];
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-brass-700/40 bg-coal-950/60">
      {/* column head */}
      <div className="flex items-center gap-2 border-b border-brass-700/40 px-2.5 py-2">
        <span
          aria-hidden
          className="block h-5 w-5 shrink-0"
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
        <div className="min-w-0">
          <div className="truncate font-fell text-[13px] tracking-wide text-cream-100">{INDUSTRY_LABEL[ind]}</div>
          <div className="font-mono text-[9.5px] text-cream-100/55">{t('game.mat.remaining', { left: left.length, total })}</div>
        </div>
      </div>
      {/* the stack, level I on top like the printed mat */}
      <ul className="flex flex-col gap-1.5 p-2">
        {levels.map((lv) => {
          const count = left.filter((l) => l === lv.level).length;
          const isNext = next === lv.level;
          const gone = count === 0;
          const canalOnly = !lv.eras.includes('rail');
          const railOnly = !lv.eras.includes('canal');
          return (
            <li
              key={lv.level}
              className={cn(
                'relative rounded-[5px] border px-2 py-1.5 transition-colors',
                isNext ? 'border-brass-400 bg-brass-500/15 shadow-[0_0_10px_rgba(201,164,92,.25)]' : gone ? 'border-brass-700/25 bg-coal-900/40 opacity-45' : 'border-brass-700/50 bg-coal-900/70',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {/* level pips */}
                  <span className="flex gap-[2px]">
                    {Array.from({ length: lv.level }, (_, i) => (
                      <span key={i} className={cn('h-[5px] w-[5px] rounded-full', gone ? 'bg-brass-700/60' : 'bg-brass-400')} />
                    ))}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-cream-100">L{lv.level}</span>
                </span>
                <span className={cn('rounded-sm px-1 font-mono text-[9.5px] font-bold leading-[14px]', gone ? 'text-cream-100/40' : 'bg-coal-950/80 text-brass-400')}>
                  {gone ? t('game.mat.gone') : `×${count}`}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9.5px] text-cream-100/70">
                <span className="text-brass-400">{t('game.mat.costs', { cost: lv.cost })}</span>
                {(lv.coal > 0 || lv.iron > 0) && <span>{t('game.mat.needs', { coal: lv.coal, iron: lv.iron })}</span>}
                <span className="text-cream-100/85">+{lv.incomeDelta} · {lv.vp} VP</span>
                {lv.beerToSell > 0 && <span>{t('game.mat.beer', { n: lv.beerToSell })}</span>}
              </div>
              {(canalOnly || railOnly || lv.noDevelop || isNext) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {isNext && <span className="rounded-sm bg-brass-400 px-1 font-sans text-[8px] font-black uppercase tracking-[0.14em] text-coal-950">{t('game.mat.next')}</span>}
                  {canalOnly && <span className="rounded-sm border border-bottle-600/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-bottle-600 brightness-150">{t('game.mat.canalOnly')}</span>}
                  {railOnly && <span className="rounded-sm border border-copper-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-copper-500 brightness-125">{t('game.mat.railOnly')}</span>}
                  {lv.noDevelop && <span className="rounded-sm border border-rust-500/70 px-1 font-sans text-[8px] font-semibold uppercase tracking-wider text-rust-500 brightness-150">{t('game.mat.noDevelop')}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {/* what this player already has on the board for this industry */}
      <div className="mt-auto border-t border-brass-700/40 px-2.5 py-2">
        <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.14em] text-cream-100/45">{t('game.mat.onBoard')}</div>
        {onBoard.length === 0 ? (
          <div className="mt-0.5 font-mono text-[9.5px] text-cream-100/35">{t('game.mat.nothingBuilt')}</div>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {onBoard.map(({ key, x, town }) => (
              <li key={key} className="flex items-center justify-between gap-1 font-mono text-[9.5px]">
                <span className="truncate text-cream-100/80">
                  L{x.level} · {town}
                </span>
                <span className={x.flipped ? 'text-brass-400' : 'text-cream-100/50'}>{x.flipped ? t('game.mat.flipped') : x.cubes > 0 ? t('game.mat.stock', { n: x.cubes }) : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function PlayerMat() {
  const t = useT();
  const game = useGame((s) => s.game);
  const matPlayer = useGame((s) => s.matPlayer);
  const openMat = useGame((s) => s.openMat);
  const closeMat = useGame((s) => s.closeMat);

  useEffect(() => {
    if (matPlayer === null) return;
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[78] flex items-center justify-center bg-coal-950/55 p-4 backdrop-blur-[2px]"
          onClick={closeMat}
        >
          <motion.div
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label={t('game.mat.title', { name: game.players[matPlayer].name })}
            onClick={(e) => e.stopPropagation()}
            className="plate relative max-h-[90vh] w-[min(1120px,96vw)] overflow-y-auto p-4 shadow-e4"
          >
            {/* player tabs */}
            <div className="flex flex-wrap items-center gap-2">
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
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-fell text-[13px] tracking-wide transition-colors',
                      active ? 'border-brass-400 bg-brass-500/15 text-cream-100' : 'border-brass-700/50 text-cream-100/70 hover:border-brass-500 hover:text-cream-100',
                    )}
                    style={active ? { boxShadow: `inset 0 0 0 1px ${col}55` } : undefined}
                  >
                    <ShapeChip color={pl.color} size={11} />
                    {pl.name}
                    {i === game.current && <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-brass-400">{t('game.rail.toAct')}</span>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={closeMat}
                aria-label={t('game.mat.close')}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-brass-700/70 bg-coal-900/90 text-brass-400 hover:bg-coal-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {(() => {
              const p = game.players[matPlayer];
              const links = Object.values(game.links).filter((l) => l.owner === matPlayer).length;
              return (
                <>
                  {/* the counting-house line */}
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-brass-700/40 pb-3">
                    <h2 className="font-fell text-xl tracking-wide text-brass-400">{t('game.mat.title', { name: p.name })}</h2>
                    <span className="font-mono text-[11px] text-cream-100/85">£{p.money}</span>
                    <span className="font-mono text-[11px] text-cream-100/85">{t('game.mat.income', { lvl: incomeLevel(p.income), pay: fmtPay(INCOME_PAYOUT[p.income]) })}</span>
                    <span className="font-mono text-[11px] text-cream-100/85">{p.vp} VP</span>
                    <span className="font-mono text-[11px] text-cream-100/60">{t('game.mat.links', { n: links })}</span>
                    <span className="font-mono text-[11px] text-cream-100/60">{t('game.mat.loans', { n: p.loans })}</span>
                    <span className="font-mono text-[11px] text-cream-100/60">{t('game.mat.hand', { n: p.hand.length })}</span>
                    <span className="ml-auto font-sans text-[9.5px] uppercase tracking-[0.14em] text-cream-100/40">{t('game.mat.keyHint')}</span>
                  </div>
                  {/* six columns, like the printed mat */}
                  <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-6">
                    {ORDER.map((ind) => (
                      <Column key={ind} ind={ind} p={p} playerIdx={matPlayer} />
                    ))}
                  </div>
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
