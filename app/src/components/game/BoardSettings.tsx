import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { setLang, useLang, useT } from '@/i18n';
import { hudInsets, setBoardOption, useBoardOptions } from './boardOptions';
import type { IncomeSide } from './boardOptions';
import type { MinimapSize } from './boardOptions';
import { STOCK_STYLE_IDS } from './stockStyles';
import type { StockStyle } from '@/gl/paint';
import { useGame } from '@/game/store';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Board settings panel (gear in the board options row): language,     */
/* stock-badge style WITH a live mini preview of each variant, minimap */
/* size, renderer and camera toggles — the chips that used to crowd    */
/* the market panel's right edge live here now.                        */
/* ------------------------------------------------------------------ */

/** tiny tile mock showing where the stock badge sits for a given style */
function StockPreview({ style, active }: { style: StockStyle; active: boolean }) {
  /* 44px brass tile */
  const badge = (() => {
    const base = 'absolute flex items-center justify-center rounded-[3px] bg-[#17110C] font-mono font-bold text-[#F4ECD8] shadow-sm';
    switch (style) {
      case 'corner':
        return <span className={`${base} -right-1.5 -top-1.5 h-4 w-4 rounded-full text-[9px] ring-1 ring-[#C9A45C]`}>3</span>;
      case 'big':
        return <span className={`${base} left-1/2 top-1/2 h-5 w-9 -translate-x-1/2 -translate-y-1/2 gap-0.5 text-[9px]`}>▪×3</span>;
      case 'counter':
        return <span className={`${base} left-1/2 top-1/2 h-3.5 w-7 -translate-x-1/2 -translate-y-1/2 text-[7px]`}>▪×3</span>;
      case 'tag':
        return <span className={`${base} left-1/2 top-1/2 h-3.5 w-7 -translate-y-1/2 text-[7px]`} style={{ transform: 'translate(-10%, -50%)' }}>▪×3</span>;
      case 'top':
        return <span className={`${base} -top-1.5 left-1/2 h-3.5 w-7 -translate-x-1/2 text-[7px]`}>▪×3</span>;
    }
  })();
  return (
    <span
      aria-hidden
      className={cn(
        'relative block h-11 w-11 shrink-0 rounded-md border transition-colors',
        active ? 'border-brass-400 bg-[radial-gradient(circle_at_50%_40%,#D8B46A,#8C6F33)]' : 'border-brass-700/60 bg-[radial-gradient(circle_at_50%_40%,#C9A45C,#6F5426)]',
      )}
    >
      {badge}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{label}</span>
      {children}
    </div>
  );
}

const segBtn = (on: boolean) =>
  cn(
    'px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
    on ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400',
  );

/** small brass toggle switch (same grammar as the follow-bots switch) */
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn('relative h-5 w-9 shrink-0 rounded-full border transition-colors', on ? 'border-brass-400 bg-brass-500/30' : 'border-brass-700/60 bg-coal-800')}
    >
      <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-brass-400 transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

export default function BoardSettings() {
  const opts = useBoardOptions();
  const lang = useLang();
  const t = useT();
  const followBots = useGame((s) => s.followBots);
  const toggleFollowBots = useGame((s) => s.toggleFollowBots);
  const open = opts.settingsOpen;
  const insets = hudInsets(opts);
  const close = () => setBoardOption('settingsOpen', false);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-[69]" onClick={close} aria-hidden />
          <motion.aside
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="plate fixed z-[70] max-h-[78vh] w-[min(340px,92vw)] overflow-y-auto p-4 shadow-e4"
            style={{ left: insets.left, bottom: insets.bottom + 76 }}
            role="dialog"
            aria-label={t('game.settings.title')}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('game.settings.title')}</h2>
              <button type="button" onClick={close} aria-label={t('game.settings.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="my-2 h-px bg-brass-700/50" />

            <Row label={t('game.settings.language')}>
              <div className="flex overflow-hidden rounded-md border border-brass-700/60">
                {(['fr', 'en'] as const).map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={segBtn(lang === l)}>
                    {l}
                  </button>
                ))}
              </div>
            </Row>

            {/* stock badge style, each with its live mini preview */}
            <div className="py-2">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{t('game.settings.stockBadge')}</span>
              <div className="mt-1.5 grid grid-cols-1 gap-1">
                {STOCK_STYLE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={opts.stockStyle === id}
                    onClick={() => setBoardOption('stockStyle', id)}
                    className={cn(
                      'flex items-center gap-3 rounded-md border px-2 py-1.5 text-left transition-colors',
                      opts.stockStyle === id ? 'border-brass-400 bg-coal-800/80' : 'border-brass-700/40 hover:border-brass-700',
                    )}
                  >
                    <StockPreview style={id} active={opts.stockStyle === id} />
                    <span className={cn('font-sans text-[11.5px] font-semibold', opts.stockStyle === id ? 'text-brass-400' : 'text-cream-100/75')}>
                      {t(`board.stockStyle.${id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* minimap size: stacked (long words need the full width) */}
            <div className="py-2">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{t('game.settings.minimapSize')}</span>
              <div className="mt-1.5 flex overflow-hidden rounded-md border border-brass-700/60">
                {(['s', 'm', 'l'] as MinimapSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={opts.minimapSize === s}
                    onClick={() => setBoardOption('minimapSize', s)}
                    className={cn('flex-1', segBtn(opts.minimapSize === s))}
                  >
                    {t(`game.settings.size.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* income track side: bottom edge (default) or down the left edge */}
            <div className="py-2">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{t('game.settings.incomeSide')}</span>
              <div className="mt-1.5 flex overflow-hidden rounded-md border border-brass-700/60">
                {(['bottom', 'left'] as IncomeSide[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={opts.incomeSide === side}
                    onClick={() => setBoardOption('incomeSide', side)}
                    className={cn('flex-1', segBtn(opts.incomeSide === side))}
                  >
                    {t(`game.settings.side.${side}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-1 h-px bg-brass-700/40" />

            {/* board display toggles — moved here from the old bottom-left
                HUD row so the map stays clear */}
            <div className="pt-1">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{t('game.settings.boardSection')}</span>
              <Row label={t('game.settings.showUnbuilt')}>
                <Switch on={!opts.hideUnbuilt} onClick={() => setBoardOption('hideUnbuilt', !opts.hideUnbuilt)} label={t('game.settings.showUnbuilt')} />
              </Row>
              <Row label={t('game.settings.bigChips')}>
                <Switch on={opts.bigChips} onClick={() => setBoardOption('bigChips', !opts.bigChips)} label={t('game.settings.bigChips')} />
              </Row>
              <Row label={t('game.settings.greyMerch')}>
                <Switch on={opts.greyFreeMerchants} onClick={() => setBoardOption('greyFreeMerchants', !opts.greyFreeMerchants)} label={t('game.settings.greyMerch')} />
              </Row>
              <Row label={t('game.settings.fullscreen')}>
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else void document.documentElement.requestFullscreen();
                  }}
                  className="rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 transition-colors hover:text-brass-400"
                >
                  F
                </button>
              </Row>
            </div>

            <Row label={t('game.settings.followBots')}>
              <Switch on={followBots} onClick={toggleFollowBots} label={t('game.settings.followBots')} />
            </Row>

            <div className="my-1 h-px bg-brass-700/40" />

            {/* keyboard shortcuts — the HUD no longer advertises them */}
            <div className="py-1">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-cream-100/70">{t('game.settings.keysSection')}</span>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                {(
                  [
                    ['F', t('game.settings.keys.fs')],
                    ['C', t('game.settings.keys.links')],
                    ['M', t('game.settings.keys.market')],
                    ['L', t('game.settings.keys.ledger')],
                    ['0', t('game.settings.keys.fit')],
                    ['+ / −', t('game.settings.keys.zoom')],
                    ['← / →', t('game.settings.keys.towns')],
                    ['1–8', t('game.settings.keys.cards')],
                    ['H', t('game.settings.keys.hand')],
                    ['Wheel', t('game.settings.keys.tracks')],
                    ['Enter', t('game.settings.keys.confirm')],
                    ['Esc', t('game.settings.keys.cancel')],
                    ['?', t('game.settings.keys.rules')],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="contents">
                    <dt>
                      <kbd className="rounded-[3px] border border-brass-700/60 bg-coal-950/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brass-400">{k}</kbd>
                    </dt>
                    <dd className="font-sans text-[10.5px] text-cream-100/65">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
