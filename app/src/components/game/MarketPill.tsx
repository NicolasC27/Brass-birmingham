import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Scale } from 'lucide-react';
import { MARKET_MAX, marketBuyPrice } from '@/game/data';
import type { MarketState, Resource } from '@/game/types';
import { money, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The exchange, folded: a quotation strip at the top right — coal and */
/* iron, the price to buy and the stock left, and the price the reader */
/* would pay after the purchase being planned. When the market moves   */
/* while the strip is folded, it flashes and says what moved.          */
/* ------------------------------------------------------------------ */

const RES: Resource[] = ['coal', 'iron'];

/** what changed in the market since the reader last looked */
function useMarketMove(market: MarketState, watching: boolean): { text: string | null; key: number } {
  const t = useT();
  const prev = useRef<MarketState>(market);
  const [move, setMove] = useState<{ text: string | null; key: number }>({ text: null, key: 0 });
  useEffect(() => {
    const before = prev.current;
    prev.current = market;
    if (!watching) return;
    const bits: string[] = [];
    for (const r of RES) {
      if (before[r] === market[r]) continue;
      const from = marketBuyPrice(r, before[r]);
      const to = marketBuyPrice(r, market[r]);
      const name = t(`game.market.${r}`);
      bits.push(from !== to ? `${name} ${money(from)} → ${money(to)}` : `${name} ${market[r] > before[r] ? '+' : ''}${market[r] - before[r]}`);
    }
    if (!bits.length) return;
    const key = Date.now();
    /* shown on the next frame, and gone after a few seconds */
    const show = window.setTimeout(() => setMove({ text: bits.join(' · '), key }), 0);
    const hide = window.setTimeout(() => setMove((m) => (m.key === key ? { text: null, key } : m)), 4500);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [market, watching, t]);
  return move;
}

export default function MarketPill({ market, consume, top, bottom, left, open, onToggle }: { market: MarketState; consume: Partial<Record<Resource, number>>; top: number; /** at the foot of the board instead, while a game is read */ bottom?: number; /** with `bottom`: at the left edge rather than the right */ left?: number; open: boolean; onToggle: () => void }) {
  const t = useT();
  const move = useMarketMove(market, !open);
  return (
    <motion.button
      type="button"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onToggle}
      data-market-pill
      data-lens="market"
      aria-expanded={open}
      aria-label={t(open ? 'game.page.foldMarket' : 'game.page.openMarket')}
      className={cn(
        'fixed z-[64] flex flex-col items-stretch plaque gap-1 rounded-lg border px-3 py-1.5 transition-shadow',
        left === undefined && 'right-3',
        move.text ? 'border-brass-400 shadow-[0_0_0_1px_rgba(201,164,92,.5),0_0_18px_rgba(201,164,92,.35)]' : open ? 'border-brass-400/80' : 'border-brass-700/70',
      )}
      style={bottom !== undefined ? { bottom, ...(left !== undefined ? { left } : {}) } : { top }}
    >
      <span className="flex items-center gap-3">
        <Scale className="h-3.5 w-3.5 shrink-0 text-brass-400" />
        {RES.map((r) => {
          const count = market[r];
          const price = marketBuyPrice(r, count);
          const n = consume[r] ?? 0;
          const after = n > 0 ? marketBuyPrice(r, Math.max(0, count - n)) : null;
          return (
            <span key={r} className="flex items-center gap-1.5">
              <img src={r === 'coal' ? '/icon-coal.svg' : '/icon-iron.svg'} alt="" className="h-3.5 w-3.5 opacity-90" />
              <span className="font-fell text-[15px] leading-none text-cream-100" style={{ fontVariantNumeric: 'oldstyle-nums' }}>
                {money(price)}
              </span>
              {after !== null && after !== price && (
                <span className="font-mono text-[9.5px] leading-none text-rust-500 brightness-150" title={t('game.page.marketAfter')}>
                  → {money(after)}
                </span>
              )}
              {/* stock left, as a short bar of the tray's own colour */}
              <span className="flex h-[6px] w-[38px] overflow-hidden rounded-sm bg-coal-950" aria-label={t('game.market.inMarket', { count, max: MARKET_MAX[r] })}>
                <span className={cn('block h-full', r === 'coal' ? 'bg-cream-100/70' : 'bg-[#e07020]')} style={{ width: `${(count / MARKET_MAX[r]) * 100}%` }} />
              </span>
            </span>
          );
        })}
      </span>
      {move.text && (
        <motion.span key={move.key} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-[9.5px] leading-none text-brass-400">
          {move.text}
        </motion.span>
      )}
    </motion.button>
  );
}
