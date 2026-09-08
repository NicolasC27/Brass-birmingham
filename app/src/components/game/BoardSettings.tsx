import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, Keyboard, LayoutGrid, Map, MonitorCog, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setLang, useLang, useT } from '@/i18n';
import { MAT_ORDER_DEFAULT, MAT_STYLES, hudInsets, setBoardOption, useBoardOptions } from './boardOptions';
import { NARROW_RAIL_TOP, useNarrow } from '@/hooks/use-narrow';
import type { IncomeSide, MapStyle, MatStyle, MinimapSize } from './boardOptions';
import type { TrafficLevel } from '@/gl/ambiance';
import { KEY_ACTIONS, RESERVED_KEYS, eventKey, keyLabel, resetKeybindings, setKeybinding, useKeybindings } from './keybindings';
import type { KeyAction } from './keybindings';
import { STOCK_STYLE_IDS } from './stockStyles';
import { TILE_VARIANTS, variantFaceUrl } from '@/gl/paint';
import type { TileVariant } from '@/gl/paint';
import type { ChipStyle, SlotArt, StockStyle } from '@/gl/paint';
import type { IndustryType } from '@/game/types';
import { useGame } from '@/game/store';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Board settings — a centred dialog with a section rail on the left   */
/* (tiles / board / interface / shortcuts) and, on the right, one row  */
/* per option: label, a one-line hint, the control. Visual choices     */
/* (slot art, income band, stock badge) carry a live mini preview so   */
/* the reader can pick without trying each one on the board.          */
/* ------------------------------------------------------------------ */

type SectionId = 'tiles' | 'board' | 'interface' | 'keys';
const SECTIONS: { id: SectionId; icon: LucideIcon }[] = [
  { id: 'tiles', icon: LayoutGrid },
  { id: 'board', icon: Map },
  { id: 'interface', icon: MonitorCog },
  { id: 'keys', icon: Keyboard },
];

/* ----------------------------- previews ---------------------------- */

const CARD = 'relative block h-12 w-12 shrink-0 overflow-hidden rounded-md border';

/** industry key → asset file stem ('manufacturer' vs file 'manufacture') */
/** one painting variant of an industry on the dark tile ground */
function VariantPreview({ industry, variant, active }: { industry: IndustryType; variant: TileVariant; active: boolean }) {
  return (
    <span aria-hidden className={cn(CARD, 'bg-[#12100C]', active ? 'border-brass-400' : 'border-brass-700/50')}>
      <span className="absolute inset-1 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${variantFaceUrl(variant, industry)})` }} />
    </span>
  );
}

/** the cotton mill painting: full colour, or the engraved sepia print */
function SlotPreview({ art, active }: { art: SlotArt; active: boolean }) {
  return (
    <span aria-hidden className={cn(CARD, 'bg-[#12100C]', active ? 'border-brass-400' : 'border-brass-700/50')}>
      <span
        className="absolute inset-1 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/tile-cotton-cut.png)',
          filter: art === 'engraved' ? 'grayscale(1) sepia(0.55) brightness(0.72) contrast(0.95)' : undefined,
          opacity: art === 'engraved' ? 0.88 : 1,
        }}
      />
    </span>
  );
}

/** brass card with the income / VP layout */
function ChipPreview({ style, active }: { style: ChipStyle; active: boolean }) {
  const num = 'font-mono text-[6.5px] font-semibold text-[#F4ECD8]';
  return (
    <span
      aria-hidden
      className={cn(CARD, active ? 'border-brass-400' : 'border-brass-700/50')}
      style={{ background: 'radial-gradient(circle at 50% 40%, #D8B46A, #8C6F33)', boxShadow: 'inset 0 0 0 2px #C9A45C' }}
    >
      {style === 'band' ? (
        <span className="absolute inset-x-[3px] bottom-[3px] flex h-3 items-center justify-between rounded-[2px] bg-[#0C0A08]/60 px-1">
          <span className={num}>+2</span>
          <span className={num}>3vp</span>
        </span>
      ) : (
        <>
          <span className={cn('absolute bottom-[3px] left-[3px] flex h-3 w-[18px] items-center justify-center rounded-[2px] bg-[#17110C] ring-1 ring-[#F4ECD8]/35', num)}>+2</span>
          <span className={cn('absolute bottom-[3px] right-[3px] flex h-3 w-[18px] items-center justify-center rounded-[2px] bg-[#17110C] ring-1 ring-[#F4ECD8]/35', num)}>3vp</span>
        </>
      )}
    </span>
  );
}

/** tiny tile mock showing where the stock badge sits for a given style */
function StockPreview({ style, active }: { style: StockStyle; active: boolean }) {
  const badge = (() => {
    const base = 'absolute flex items-center justify-center rounded-[3px] bg-[#17110C] font-mono font-bold text-[#F4ECD8] shadow-sm';
    switch (style) {
      case 'corner':
        return <span className={`${base} right-0.5 top-0.5 h-4 w-4 rounded-full text-[9px] ring-1 ring-[#C9A45C]`}>3</span>;
      case 'big':
        return <span className={`${base} left-1/2 top-1/2 h-5 w-9 -translate-x-1/2 -translate-y-1/2 gap-0.5 text-[9px]`}>▪×3</span>;
      case 'counter':
        return <span className={`${base} left-1/2 top-1/2 h-3.5 w-7 -translate-x-1/2 -translate-y-1/2 text-[7px]`}>▪×3</span>;
      case 'tag':
        return <span className={`${base} right-0 top-1/2 h-3.5 w-7 -translate-y-1/2 translate-x-1 text-[7px]`}>▪×3</span>;
      case 'top':
        return <span className={`${base} left-1/2 top-0 h-3.5 w-7 -translate-x-1/2 -translate-y-1 text-[7px]`}>▪×3</span>;
    }
  })();
  return (
    <span
      aria-hidden
      className={cn(CARD, active ? 'border-brass-400' : 'border-brass-700/50')}
      style={{ background: 'radial-gradient(circle at 50% 40%, #D8B46A, #8C6F33)' }}
    >
      {badge}
    </span>
  );
}

/* ----------------------------- controls ---------------------------- */

/** one option: label + hint on the left, its control on the right */
function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-brass-700/25 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="font-sans text-[12px] font-semibold text-cream-100/90">{label}</div>
        {hint && <div className="mt-0.5 font-sans text-[10.5px] leading-snug text-cream-100/50">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

/** segmented control */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-brass-700/60">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
            value === o.id ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** a visual choice: label + hint above, one previewed card per option */
function ChoiceCards<T extends string>({
  label,
  hint,
  sublabel,
  value,
  options,
  onChange,
  columns = 2,
}: {
  label: string;
  hint?: string;
  /** small brass caption under the label (e.g. the industry name) */
  sublabel?: string;
  value: T;
  options: { id: T; label: string; preview: (active: boolean) => React.ReactNode }[];
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div className="border-b border-brass-700/25 py-2.5 last:border-b-0">
      {label && <div className="font-sans text-[12px] font-semibold text-cream-100/90">{label}</div>}
      {hint && <div className="mt-0.5 font-sans text-[10.5px] leading-snug text-cream-100/50">{hint}</div>}
      {sublabel && <div className={cn('font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-brass-400/80', (label || hint) && 'mt-1.5')}>{sublabel}</div>}
      <div className={cn('mt-2 grid gap-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors',
                active ? 'border-brass-400 bg-coal-800/80' : 'border-brass-700/40 hover:border-brass-700',
              )}
            >
              {o.preview(active)}
              <span className={cn('font-sans text-[11px] font-semibold leading-tight', active ? 'text-brass-400' : 'text-cream-100/75')}>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** the rebindable shortcuts (click a keycap, press the new key) + the fixed ones */
function ShortcutEditor() {
  const t = useT();
  const keys = useKeybindings();
  const [listening, setListening] = useState<KeyAction | null>(null);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setListening(null);
        return;
      }
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      const k = eventKey(e);
      if (RESERVED_KEYS.has(k) || e.ctrlKey || e.metaKey || e.altKey) {
        setRefused(true);
        window.setTimeout(() => setRefused(false), 900);
        return;
      }
      setKeybinding(listening, k);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening]);
  const cap = 'rounded-[3px] border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold';
  const fixed: [string, string][] = [
    ['+ / −', t('game.settings.keys.zoom')],
    ['← / →', t('game.settings.keys.towns')],
    ['1–8', t('game.settings.keys.cards')],
    ['Wheel', t('game.settings.keys.tracks')],
    ['Enter', t('game.settings.keys.confirm')],
    ['Esc', t('game.settings.keys.cancel')],
  ];
  return (
    <div className="py-1">
      <p className="mb-2 font-sans text-[10.5px] leading-snug text-cream-100/50">{t('game.settings.keysRebind')}</p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {KEY_ACTIONS.map((action) => {
          const on = listening === action;
          return (
            <div key={action} className="contents">
              <dt>
                <button
                  type="button"
                  onClick={() => setListening(on ? null : action)}
                  aria-pressed={on}
                  className={cn(
                    cap,
                    'min-w-[34px] transition-colors',
                    on ? (refused ? 'border-rust-500 text-rust-500' : 'border-brass-400 bg-brass-500/20 text-brass-400') : 'border-brass-700/60 bg-coal-950/80 text-brass-400 hover:border-brass-400',
                  )}
                >
                  {on ? (refused ? t('game.settings.keys.unbindable') : t('game.settings.keysListening')) : keyLabel(keys[action])}
                </button>
              </dt>
              <dd className="font-sans text-[11px] text-cream-100/70">{t(`game.settings.keys.${action}`)}</dd>
            </div>
          );
        })}
      </dl>
      <button
        type="button"
        onClick={resetKeybindings}
        className="mt-2 rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 transition-colors hover:text-brass-400"
      >
        {t('game.settings.keysReset')}
      </button>
      <div className="mt-3 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-100/40">{t('game.settings.keysFixed')}</div>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {fixed.map(([k, label]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className={cn(cap, 'border-brass-700/40 bg-coal-950/60 text-cream-100/60')}>{k}</kbd>
            </dt>
            <dd className="font-sans text-[11px] text-cream-100/60">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------ abandon ---------------------------- */

/** propose to abandon the game: a two-step button, then the table votes */
function AbandonRow() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const voteConcede = useGame((s) => s.voteConcede);
  const [armed, setArmed] = useState(false);
  if (!game || game.phase !== 'action') return null;
  const votes = game.concessions ?? [];
  const humans = game.players.map((_, i) => i).filter((i) => !game.players[i].isBot);
  /* online: my seat; at one table: the player to act, or the next human
     who has not spoken (the bots' turns are nobody's to wait for) */
  const me = seat ?? (humans.includes(game.current) && !votes.includes(game.current) ? game.current : (humans.find((i) => !votes.includes(i)) ?? game.current));
  const mine = humans.includes(me);
  const pending = votes.length > 0;
  const voted = votes.includes(me);
  return (
    <OptionRow label={t('game.settings.abandon')} hint={t(pending ? 'game.settings.abandonPending' : 'game.settings.abandonHint')}>
      {armed ? (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              voteConcede(me, 'yes');
              setArmed(false);
            }}
            className="rounded-md border border-rust-500/80 bg-rust-500/20 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-rust-500 brightness-150 transition-colors hover:bg-rust-500/30"
          >
            {t('game.settings.abandonYes')}
          </button>
          <button type="button" onClick={() => setArmed(false)} className="rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 hover:text-brass-400">
            {t('game.settings.abandonNo')}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={!mine || voted}
          onClick={() => setArmed(true)}
          className="flex items-center gap-1.5 rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 transition-colors hover:border-rust-500/70 hover:text-rust-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Flag className="h-3 w-3" />
          {t(voted ? 'game.settings.abandonVoted' : 'game.settings.abandonBtn')}
        </button>
      )}
    </OptionRow>
  );
}

/* ------------------------------ dialog ----------------------------- */

export default function BoardSettings() {
  const opts = useBoardOptions();
  const lang = useLang();
  const t = useT();
  const followBots = useGame((s) => s.followBots);
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.code !== null);
  const toggleFollowBots = useGame((s) => s.toggleFollowBots);
  const [section, setSection] = useState<SectionId>('tiles');
  const open = opts.settingsOpen;
  const insets = hudInsets(opts);
  const narrow = useNarrow();
  const close = () => setBoardOption('settingsOpen', false);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="plate fixed left-3 z-[70] flex w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden shadow-e4"
          style={{ top: narrow ? NARROW_RAIL_TOP : insets.top + 8, bottom: insets.bottom + 8 }}
          role="dialog"
          aria-label={t('game.settings.title')}
        >
            {/* header */}
            <div className="flex items-start justify-between gap-4 border-b border-brass-700/40 px-4 py-3">
              <div>
                <h2 className="font-fell text-[18px] leading-tight tracking-wide text-brass-400">{t('game.settings.title')}</h2>
                <p className="mt-0.5 font-sans text-[11px] text-cream-100/50">{t('game.settings.subtitle')}</p>
              </div>
              <button type="button" onClick={close} aria-label={t('game.settings.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {/* section tabs — the panel is docked beside the board, so the
                  sections run across the top and the board stays in view */}
              <nav aria-label={t('game.settings.title')} className="flex shrink-0 gap-1 overflow-x-auto border-b border-brass-700/40 p-2">
                {SECTIONS.map(({ id, icon: Icon }) => {
                  const active = section === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setSection(id)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors',
                        active ? 'bg-brass-400/15 text-brass-400' : 'text-cream-100/60 hover:bg-coal-800 hover:text-cream-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {t(`game.settings.sections.${id}`)}
                    </button>
                  );
                })}
              </nav>

              {/* section body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <p className="mb-1 font-sans text-[11px] text-cream-100/50">{t(`game.settings.sectionHint.${section}`)}</p>

                {section === 'tiles' && (
                  <>
                    {(Object.entries(TILE_VARIANTS) as [IndustryType, NonNullable<(typeof TILE_VARIANTS)[IndustryType]>][]).map(([industry, variants], idx) => (
                      <ChoiceCards<string>
                        key={industry}
                        label={idx === 0 ? t('game.settings.tileArt') : ''}
                        hint={idx === 0 ? t('game.settings.tileArtHint') : undefined}
                        sublabel={t(`game.settings.industry.${industry}`)}
                        value={opts.tileArt[industry] ?? variants[0].id}
                        onChange={(v) => setBoardOption('tileArt', { ...opts.tileArt, [industry]: v })}
                        columns={3}
                        options={variants.map((v) => ({
                          id: v.id,
                          label: t(`game.settings.variant.${v.id}`),
                          preview: (active) => <VariantPreview industry={industry} variant={v} active={active} />,
                        }))}
                      />
                    ))}
                    <ChoiceCards<SlotArt>
                      label={t('game.settings.slotArt')}
                      hint={t('game.settings.slotArtHint')}
                      value={opts.slotArt}
                      onChange={(v) => setBoardOption('slotArt', v)}
                      options={(['engraved', 'painted'] as SlotArt[]).map((id) => ({
                        id,
                        label: t(`game.settings.slot.${id}`),
                        preview: (active) => <SlotPreview art={id} active={active} />,
                      }))}
                    />
                    <ChoiceCards<ChipStyle>
                      label={t('game.settings.chipStyle')}
                      hint={t('game.settings.chipStyleHint')}
                      value={opts.chipStyle}
                      onChange={(v) => setBoardOption('chipStyle', v)}
                      options={(['band', 'chips'] as ChipStyle[]).map((id) => ({
                        id,
                        label: t(`game.settings.chip.${id}`),
                        preview: (active) => <ChipPreview style={id} active={active} />,
                      }))}
                    />
                    <OptionRow label={t('game.settings.bigChips')} hint={t('game.settings.bigChipsHint')}>
                      <Switch on={opts.bigChips} onClick={() => setBoardOption('bigChips', !opts.bigChips)} label={t('game.settings.bigChips')} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.cardGrain')} hint={t('game.settings.cardGrainHint')}>
                      <Switch on={opts.cardGrain} onClick={() => setBoardOption('cardGrain', !opts.cardGrain)} label={t('game.settings.cardGrain')} />
                    </OptionRow>
                    <ChoiceCards<StockStyle>
                      label={t('game.settings.stockBadge')}
                      hint={t('game.settings.stockBadgeHint')}
                      value={opts.stockStyle}
                      onChange={(v) => setBoardOption('stockStyle', v)}
                      columns={3}
                      options={STOCK_STYLE_IDS.map((id) => ({
                        id,
                        label: t(`board.stockStyle.${id}`),
                        preview: (active) => <StockPreview style={id} active={active} />,
                      }))}
                    />
                    <OptionRow label={t('game.settings.matStyle')} hint={t('game.settings.matStyleHint')}>
                      <Segmented<MatStyle>
                        value={opts.matStyle}
                        onChange={(v) => setBoardOption('matStyle', v)}
                        options={MAT_STYLES.map((id) => ({ id, label: t(`game.settings.matStyles.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.matOrder')} hint={t('game.settings.matOrderHint')}>
                      <button
                        type="button"
                        onClick={() => setBoardOption('matOrder', [...MAT_ORDER_DEFAULT])}
                        className="rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 transition-colors hover:text-brass-400"
                      >
                        {t('game.settings.matOrderReset')}
                      </button>
                    </OptionRow>
                    {opts.matStyle === 'cards' && (
                      <OptionRow label={t('game.settings.matCount')} hint={t('game.settings.matCountHint')}>
                        <Switch on={opts.matCount} onClick={() => setBoardOption('matCount', !opts.matCount)} label={t('game.settings.matCount')} />
                      </OptionRow>
                    )}
                  </>
                )}

                {section === 'board' && (
                  <>
                    <OptionRow label={t('game.settings.colorBlind')} hint={t('game.settings.colorBlindHint')}>
                      <Switch on={opts.colorBlind} onClick={() => setBoardOption('colorBlind', !opts.colorBlind)} label={t('game.settings.colorBlind')} />
                    </OptionRow>
                    {opts.colorBlind && (
                      <div className="mb-1 ml-3 border-l-2 border-brass-400/40 pl-3">
                        <OptionRow label={t('game.settings.colorBlindTiles')} hint={t('game.settings.colorBlindTilesHint')}>
                          <Switch on={opts.sealTiles} onClick={() => setBoardOption('sealTiles', !opts.sealTiles)} label={t('game.settings.colorBlindTiles')} />
                        </OptionRow>
                        <OptionRow label={t('game.settings.colorBlindLinks')} hint={t('game.settings.colorBlindLinksHint')}>
                          <Switch on={opts.sealLinks} onClick={() => setBoardOption('sealLinks', !opts.sealLinks)} label={t('game.settings.colorBlindLinks')} />
                        </OptionRow>
                      </div>
                    )}
                    <OptionRow label={t('game.settings.mapStyle')} hint={t('game.settings.mapStyleHint')}>
                      <Segmented<MapStyle>
                        value={opts.mapStyle}
                        onChange={(v) => setBoardOption('mapStyle', v)}
                        options={(['etched', 'painted'] as MapStyle[]).map((id) => ({ id, label: t(`game.settings.map.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.showUnbuilt')} hint={t('game.settings.showUnbuiltHint')}>
                      <Switch on={!opts.hideUnbuilt} onClick={() => setBoardOption('hideUnbuilt', !opts.hideUnbuilt)} label={t('game.settings.showUnbuilt')} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.greyMerch')} hint={t('game.settings.greyMerchHint')}>
                      <Switch on={opts.greyFreeMerchants} onClick={() => setBoardOption('greyFreeMerchants', !opts.greyFreeMerchants)} label={t('game.settings.greyMerch')} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.beginnerAid')} hint={t(online ? 'game.settings.beginnerAidTable' : 'game.settings.beginnerAidHint')}>
                      {online ? (
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream-100/50">{t(game?.assist ? 'setup.houseRules.assist.on' : 'setup.houseRules.assist.off')}</span>
                      ) : (
                        <Switch on={opts.beginnerAid} onClick={() => setBoardOption('beginnerAid', !opts.beginnerAid)} label={t('game.settings.beginnerAid')} />
                      )}
                    </OptionRow>
                    <OptionRow label={t('game.settings.traffic')} hint={t('game.settings.trafficHint')}>
                      <Segmented<TrafficLevel>
                        value={opts.traffic}
                        onChange={(v) => setBoardOption('traffic', v)}
                        options={(['none', 'light', 'busy'] as TrafficLevel[]).map((id) => ({ id, label: t(`game.settings.trafficLevel.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.followBots')} hint={t('game.settings.followBotsHint')}>
                      <Switch on={followBots} onClick={toggleFollowBots} label={t('game.settings.followBots')} />
                    </OptionRow>
                  </>
                )}

                {section === 'interface' && (
                  <>
                    <OptionRow label={t('game.settings.language')}>
                      <Segmented<'fr' | 'en'> value={lang} onChange={setLang} options={[{ id: 'fr', label: 'fr' }, { id: 'en', label: 'en' }]} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.minimapSize')}>
                      <Segmented<MinimapSize>
                        value={opts.minimapSize}
                        onChange={(v) => setBoardOption('minimapSize', v)}
                        options={(['s', 'm', 'l'] as MinimapSize[]).map((id) => ({ id, label: t(`game.settings.size.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.incomeSide')} hint={t('game.settings.incomeSideHint')}>
                      <Segmented<IncomeSide>
                        value={opts.incomeSide}
                        onChange={(v) => setBoardOption('incomeSide', v)}
                        options={(['bottom', 'left'] as IncomeSide[]).map((id) => ({ id, label: t(`game.settings.side.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.fullscreen')} hint={t('game.settings.fullscreenHint')}>
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="rounded-md border border-brass-700/60 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-cream-100/60 transition-colors hover:text-brass-400"
                      >
                        {t('game.settings.fullscreenBtn')}
                      </button>
                    </OptionRow>
                    <AbandonRow />
                  </>
                )}

                {section === 'keys' && <ShortcutEditor />}
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
