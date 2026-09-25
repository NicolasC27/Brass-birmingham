import { useState } from 'react';
import { motion } from 'framer-motion';
import { MARKET_MAX, marketBuyPrice, marketSellPrice } from '@/game/data';
import type { Resource } from '@/game/types';
import { useGame, useShownGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* COAL & IRON EXCHANGE (v18) — the victorian quotation board.         */
/* ONE representation only: a slate board where each price notch is a  */
/* socket, and a socket either holds an ingot or gapes empty — the     */
/* stock per price is read by pure looking, nothing to count, nothing  */
/* to hover. The buy price is the hero numeral (chalk on slate); the   */
/* next ingot to leave wears the brass ring. No floating tooltips      */
/* inside the scrollable drawer (they clipped — rule learned); the     */
/* "about" text lives in a native <details> fold instead.              */
/* ------------------------------------------------------------------ */

/** the ingot resting in a filled socket — anthracite block / glowing iron;
 *  the buy socket keeps the RESOURCE material (a gold ingot would read as
 *  a third resource) — only the socket ring carries the brass signal */
function Ingot({ resource }: { resource: Resource }) {
  if (resource === 'iron')
    return (
      <span
        className="block h-full w-full rounded-[2px] bg-[linear-gradient(160deg,#F5B476,#E0813F_50%,#9C4A1E)]"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,226,190,.6), inset 0 -3px 4px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.75), 0 0 5px rgba(224,129,63,.35)' }}
      />
    );
  /* coal on a soot-dark socket: lit top plane or it vanishes — but dark
     enough to never rival the brass accents (anthracite, not lead) */
  return (
    <span
      className="block h-full w-full rounded-[2px] bg-[linear-gradient(160deg,#948A7C,#4E4740_45%,#211D19)]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(242,234,214,.45), inset 0 -3px 4px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.8)' }}
    />
  );
}

/** one resource line on the quotation board: hero price, then the row of
 *  sockets £1..£max (filled from the DEAREST end — the cheapest filled
 *  socket is the next buy), each socket engraved with its price */
function QuotationRow({
  resource,
  count,
  focus,
  consumePreview,
}: {
  resource: Resource;
  count: number;
  focus: boolean;
  consumePreview: number;
}) {
  const max = MARKET_MAX[resource];
  const buyPrice = marketBuyPrice(resource, count);
  /* sell-in quotation: what a fresh connected mine/works earns per cube it
     sells into the tray — the quiet secondary figure next to the hero buy */
  const sellPrice = marketSellPrice(resource, count);
  /* after the planned consumption: stock and the buy price it would leave */
  const afterCount = Math.max(0, count - consumePreview);
  const afterPrice = marketBuyPrice(resource, count - consumePreview);
  /* TWO physical spaces per price — £6 coal shows two sockets, and you can
     see at a glance whether 0, 1 or 2 cubes remain at that price */
  const prices = Array.from({ length: max / 2 }, (_, i) => i + 1);
  const t = useT();
  const name = resource === 'coal' ? t('game.market.coal') : t('game.market.iron');
  /* one live caption line under the row — hover explains, never reveals */
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5" data-market-tray={resource}>
      {/* quotation header: resource, HERO buy price (chalk on slate), stock */}
      <div className="flex items-end gap-2 px-0.5">
        <img src={resource === 'coal' ? '/icon-coal.svg' : '/icon-iron.svg'} alt="" className="mb-0.5 h-5 w-5 opacity-90" />
        <span className="font-fell text-[14px] leading-none tracking-wide text-cream-100">{name}</span>
        <span className="ml-auto flex items-baseline gap-2.5">
          <span className="font-sans text-[8px] font-bold uppercase tracking-[0.14em] text-cream-100/45">{t('game.market.buyBadge')}</span>
          {/* hero price — chalk on slate: the ONE cream-bright figure of the panel */}
          <span
            className={cn('font-fell text-[24px] leading-none text-cream-100', focus && 'animate-pulse')}
            style={{ textShadow: '0 1px 0 rgba(0,0,0,.85), 0 0 8px rgba(242,234,214,.22)', fontVariantNumeric: 'oldstyle-nums' }}
          >
            £{buyPrice}
          </span>
          {count === 0 && (
            <span
              title={t('game.market.fallbackTip')}
              className="rounded-[3px] border border-dashed border-brass-500/50 px-1 py-px font-sans text-[7.5px] font-bold uppercase tracking-[0.1em] text-brass-500/80"
            >
              {t('game.market.fallbackPrice')}
            </span>
          )}
          <span className="font-mono text-[10px] text-cream-100/45" style={{ textShadow: '0 1px 1px rgba(0,0,0,.8)' }}>
            {t('game.market.inMarket', { count, max })}
          </span>
          <span className="font-mono text-[9px] text-cream-100/40" title={t('game.market.sellInTip')}>
            {t('game.market.sellIn', { price: sellPrice })}
          </span>
        </span>
      </div>

      {/* forecast line: what the planned draw leaves behind — stock and the
          buy price it would move to (mirrors the pulsing sockets below) */}
      {consumePreview > 0 && (
        <p aria-live="polite" className="px-0.5 font-mono text-[9.5px] leading-tight text-brass-400" style={{ textShadow: '0 1px 1px rgba(0,0,0,.8)' }}>
          {t('game.market.afterPlan', { count: afterCount, price: afterPrice })}
        </p>
      )}

      {/* the board: one column per price, TWO stacked sockets each; brass
          rivets pin the quotation board like a wall instrument */}
      <div
        className="relative grid gap-[4px] rounded-[4px] bg-[#0D0A07] px-2 py-2.5 shadow-[inset_0_2px_7px_rgba(0,0,0,.85),inset_0_-1px_0_rgba(242,234,214,.07),inset_1px_0_3px_rgba(0,0,0,.5)]"
        style={{ gridTemplateColumns: `repeat(${max / 2}, minmax(0,1fr))` }}
        onMouseLeave={() => setNote(null)}
      >
        {([['top-0.5', 'left-0.5'], ['top-0.5', 'right-0.5'], ['bottom-0.5', 'left-0.5'], ['bottom-0.5', 'right-0.5']] as const).map(([v, h], k) => (
          <span
            key={k}
            aria-hidden
            className={`pointer-events-none absolute ${v} ${h} z-10 h-[5px] w-[5px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#F2EAD6,#C9A45C_45%,#5A4420_80%)]`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,.8), inset 0 -1px 1px rgba(0,0,0,.5)' }}
          />
        ))}
        {prices.map((price, ci) => {
          // ingots fill from the DEAREST end; `count` ingots remain
          const s0 = 2 * ci;
          const s1 = s0 + 1; // 0-based space indices of this price column
          const f0 = s0 >= max - count;
          const f1 = s1 >= max - count;
          const n = (f0 ? 1 : 0) + (f1 ? 1 : 0);
          const buySpace = max - count; // next space to leave (0-based)
          const isBuyCol = count > 0 && Math.floor(buySpace / 2) === ci;
          const consumes = (s: number) => consumePreview > 0 && s >= max - count && s < max - count + consumePreview;
          const socket = (s: number, filled: boolean) => (
            <motion.span
              key={s}
              animate={consumes(s) ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
              transition={consumes(s) ? { repeat: Infinity, duration: 0.9 } : { duration: 0.15 }}
              className={cn(
                'relative block h-[11px] w-full rounded-[2px] bg-[#12100E]',
                count > 0 && s === buySpace && 'ring-2 ring-brass-400',
              )}
              style={{
                boxShadow:
                  count > 0 && s === buySpace
                    ? 'inset 0 2px 4px rgba(0,0,0,.9), inset 0 -1px 0 rgba(242,234,214,.06), 0 0 12px rgba(232,205,142,.75)'
                    : 'inset 0 2px 4px rgba(0,0,0,.9), inset 0 -1px 0 rgba(242,234,214,.06)',
              }}
            >
              {filled && (
                <motion.span
                  layoutId={`exchange-ingot-${resource}-${s - (max - count)}`}
                  transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                  className="absolute inset-[2px]"
                >
                  <Ingot resource={resource} />
                </motion.span>
              )}
            </motion.span>
          );
          return (
            <div
              key={price}
              className="relative flex cursor-help flex-col items-center gap-[3px]"
              onMouseEnter={() =>
                setNote(
                  `${t('game.market.cellTitle', { name, price })} — ${
                    isBuyCol ? t('game.market.cellBuy') : n === 0 ? t('game.market.cellEmpty') : t('game.market.cellPair', { n })
                  }`,
                )
              }
            >
              {/* gas-lamp pointer above the column of the next space to leave */}
              {isBuyCol && (
                <span
                  aria-hidden
                  className="absolute -top-[7px] left-1/2 -translate-x-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '5px solid #C9A45C',
                    filter: 'drop-shadow(0 0 3px rgba(201,164,92,.8))',
                  }}
                />
              )}
              {socket(s0, f0)}
              {socket(s1, f1)}
              {/* engraved price numeral — the column IS the price display */}
              <span
                className={cn(
                  'font-mono text-[10px] leading-none',
                  isBuyCol ? 'font-bold text-brass-400' : n > 0 ? 'font-semibold text-cream-100/80' : 'text-cream-100/50',
                )}
                style={{ textShadow: '0 1px 0 rgba(242,234,214,.12), 0 -1px 1px rgba(0,0,0,.9)' }}
              >
                {price}
              </span>
            </div>
          );
        })}
      </div>
      {/* live hover caption (two reserved lines — never truncates mid-word) */}
      <div aria-live="polite" className="line-clamp-2 min-h-[24px] px-0.5 font-sans text-[9.5px] leading-tight text-cream-100/60">
        {note ?? ' '}
      </div>
    </div>
  );
}

/** full cost of drawing `n` cubes of one resource: each cube pays the
 *  price of the socket it leaves, dearer as the tray empties */
function drawCost(resource: Resource, have: number, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += marketBuyPrice(resource, have - i);
  return sum;
}

export default function MarketTray({ consumePreview }: { consumePreview?: Partial<Record<Resource, number>> }) {
  const t = useT();
  const game = useShownGame();
  const marketFocus = useGame((s) => s.marketFocus);
  if (!game) return null;
  const { coal, iron } = game.market;
  const temper = game.marketTemper;
  const coalDraw = consumePreview?.coal ?? 0;
  const ironDraw = consumePreview?.iron ?? 0;
  const drawTotal = drawCost('coal', coal, coalDraw) + drawCost('iron', iron, ironDraw);

  return (
    <section
      aria-label={t('game.market.sectionAria')}
      className={cn(
        'plate relative overflow-hidden p-3 transition-shadow',
        marketFocus && 'shadow-[0_0_0_2px_var(--brass-400),0_10px_24px_rgba(0,0,0,.35)]',
      )}
    >
      {/* soot-dark brick behind WARM mahogany panelling */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/market-brick.png')] bg-cover bg-center opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#1A120B]/55" />
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-x-0 top-0 h-[36px] opacity-30 shadow-[inset_0_-8px_12px_rgba(0,0,0,.65)]" />
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-x-0 bottom-0 h-[26px] opacity-25 shadow-[inset_0_8px_12px_rgba(0,0,0,.6)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_3px_rgba(62,42,26,.9),inset_0_0_0_4px_rgba(138,107,51,.35),inset_0_2px_10px_rgba(0,0,0,.6)]" />

      <header className="relative mb-3">
        {/* brass cornice */}
        <div
          aria-hidden
          className="h-[5px] rounded-full bg-[linear-gradient(180deg,#E8CD8E,#C9A45C_45%,#6F5426)] shadow-[0_2px_4px_rgba(0,0,0,.65),inset_0_1px_0_rgba(242,234,214,.65)]"
        />
        <h2
          className="mt-1.5 text-center font-fell text-[15px] tracking-[0.08em] text-brass-400"
          style={{ textShadow: '0 1px 0 rgba(0,0,0,.85), 0 -1px 0 rgba(242,234,214,.14)' }}
        >
          {t('game.market.heading')}
        </h2>
        <div
          aria-hidden
          className="mt-1.5 h-px bg-[linear-gradient(90deg,transparent,rgba(201,164,92,.65),transparent)]"
        />
      </header>

      <div className="relative flex flex-col gap-3">
        <QuotationRow resource="coal" count={coal} focus={marketFocus} consumePreview={consumePreview?.coal ?? 0} />
        <QuotationRow resource="iron" count={iron} focus={marketFocus} consumePreview={consumePreview?.iron ?? 0} />
      </div>

      <footer className="relative mt-2 border-t border-brass-700/40 pt-2">
        {/* the planned draw itemised: cubes per resource, total market cost —
            the same money the banner's cost chip counts, read from the tray */}
        {drawTotal > 0 && (
          <p className="mb-1.5 flex items-center gap-1.5 rounded-sm border border-brass-500/40 bg-brass-500/10 px-1.5 py-1 font-mono text-[10px] text-cream-100/85">
            <span className="shrink-0 font-sans text-[8.5px] font-bold uppercase tracking-[0.12em] text-brass-400">{t('game.market.drawLead')}</span>
            {coalDraw > 0 && <span>{t('game.log.coalN', { n: coalDraw })}</span>}
            {ironDraw > 0 && <span>{t('game.log.ironN', { n: ironDraw })}</span>}
            <span className="ml-auto shrink-0 font-semibold text-brass-400">£{drawTotal}</span>
          </p>
        )}
        {/* demand track — fixed 5-notch scale, tinted per resource */}
        <p className="flex items-center gap-2 font-mono text-[10px] text-cream-100/60" style={{ textShadow: '0 1px 1px rgba(0,0,0,.8)' }}>
          <span>{t('game.market.demandLabel')}</span>
          <span>
            {t('game.market.coal')}{' '}
            <span className="text-[#8A8178]">{'●'.repeat(Math.min(5, MARKET_MAX.coal - coal))}{'○'.repeat(5 - Math.min(5, MARKET_MAX.coal - coal))}</span>
          </span>
          <span aria-hidden>·</span>
          <span>
            {t('game.market.iron')}{' '}
            <span className="text-[#E0813F]">{'●'.repeat(Math.min(5, MARKET_MAX.iron - iron))}{'○'.repeat(5 - Math.min(5, MARKET_MAX.iron - iron))}</span>
          </span>
        </p>
        {/* no floating tooltip inside this scrollable drawer (it clipped) —
            a native fold carries the explanation instead */}
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none font-sans text-[9.5px] font-semibold uppercase tracking-[0.1em] text-brass-500/80 hover:text-brass-400">
            {t('game.market.bourseTitle')} — {temper}
          </summary>
          <p className="mt-1 font-sans text-[10px] leading-relaxed text-cream-100/65">{t('game.market.aboutBody')}</p>
        </details>
      </footer>
    </section>
  );
}
