import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, Keyboard, Map, MonitorCog, Volume2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setLang, useLang, useT, LANGS } from '@/i18n';
import type { Lang } from '@/i18n';
import { setBoardOption, useBoardOptions } from './boardOptions';
import { narrowRailTop, useHudInsets } from './useHudInsets';
import { useLayer } from './useLayer';
import { useNarrow } from '@/hooks/use-narrow';
import type { IncomeSide, MinimapSize, RailMode } from './boardOptions';
import { RAIL_MODES } from './railLogic';
import type { TrafficLevel } from '@/gl/ambiance';
import { KEY_ACTIONS, RESERVED_KEYS, eventKey, keyLabel, resetKeybindings, setKeybinding, useKeybindings } from './keybindings';
import type { KeyAction } from './keybindings';
import type { SlotArt } from '@/gl/faces';
import { useGame } from '@/game/store';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Board settings — a panel docked beside the board, its sections     */
/* across the top (board / sounds / interface / shortcuts), one row    */
/* per option: label, a one-line hint, the control. The empty slots'   */
/* art carries a live mini preview so the reader can pick without      */
/* trying each one on the board.                                       */
/* ------------------------------------------------------------------ */

type SectionId = 'board' | 'sounds' | 'interface' | 'keys';
const SECTIONS: { id: SectionId; icon: LucideIcon }[] = [
  { id: 'board', icon: Map },
  { id: 'sounds', icon: Volume2 },
  { id: 'interface', icon: MonitorCog },
  { id: 'keys', icon: Keyboard },
];

/* ----------------------------- previews ---------------------------- */

const CARD = 'relative block h-12 w-12 shrink-0 overflow-hidden rounded-md border';

/** the cotton mill painting: full colour, or the engraved sepia print */
function SlotPreview({ art, active }: { art: SlotArt; active: boolean }) {
  return (
    <span aria-hidden className={cn(CARD, 'bg-[#12100C]', active ? 'border-brass-400' : 'border-brass-700/50')}>
      <span
        className="absolute inset-1 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/tile-cotton-cut.png)',
          filter: art === 'engraved' ? 'grayscale(1) sepia(0.55) brightness(0.72) contrast(0.95)' : art === 'mono' ? 'grayscale(1) brightness(1.05) contrast(1.35)' : undefined,
          opacity: art === 'painted' ? 1 : 0.9,
        }}
      />
    </span>
  );
}

/* ----------------------------- controls ---------------------------- */

/** one option: label + hint on the left, its control on the right */
/* a control too wide for what is left of the row drops under the words,
   rather than squeezing them to one letter a line */
function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-brass-700/25 py-2.5 last:border-b-0">
      <div className="min-w-[10rem] flex-1 basis-[10rem]">
        <div className="font-sans text-[12px] font-semibold text-cream-100/90">{label}</div>
        {hint && <div className="mt-0.5 font-sans text-[10.5px] leading-snug text-cream-100/50">{hint}</div>}
      </div>
      <div className="min-w-0 max-w-full shrink-0">{children}</div>
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

/** a level on a brass rule, 0 to 1, in tenths */
function Level({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      type="range"
      min={0}
      max={10}
      step={1}
      value={Math.round(value * 10)}
      aria-label={label}
      aria-valuetext={`${Math.round(value * 100)} %`}
      onChange={(e) => onChange(Number(e.target.value) / 10)}
      className="h-5 w-32 cursor-pointer accent-brass-400"
    />
  );
}

/** segmented control */
/* many choices wrap onto a second line instead of running off the panel */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex max-w-full flex-wrap overflow-hidden rounded-md border border-brass-700/60">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'whitespace-nowrap px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
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
  /* a keycap listening is a ticket of its own on the spike: Escape gives
     up the listening, and leaves the panel open */
  useLayer(listening !== null, () => setListening(null), { focus: false });
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
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

function BoardSettings() {
  const opts = useBoardOptions();
  const lang = useLang();
  const t = useT();
  const followBots = useGame((s) => s.followBots);
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.code !== null);
  const toggleFollowBots = useGame((s) => s.toggleFollowBots);
  const [section, setSection] = useState<SectionId>('board');
  const open = opts.settingsOpen;
  const insets = useHudInsets();
  const narrow = useNarrow();
  const close = () => setBoardOption('settingsOpen', false);
  /* the settings hold the left edge: opening them sends the mat or a tool's
     sheet away, and Escape closes them when they are on top */
  const sheet = useLayer(open, close, { zone: 'left' });

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
          className="plate fixed z-[70] flex flex-col overflow-hidden shadow-e4"
          /* beside the income track when it runs down the left edge, not over it */
          style={{ left: insets.left, width: `min(460px, calc(100vw - ${insets.left + 12}px))`, top: narrow ? narrowRailTop(insets) : insets.top + 8, bottom: insets.bottom + 8 }}
          ref={sheet}
          tabIndex={-1}
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

                {section === 'board' && (
                  <>
                    <ChoiceCards<SlotArt>
                      label={t('game.settings.slotArt')}
                      hint={t('game.settings.slotArtHint')}
                      value={opts.slotArt}
                      onChange={(v) => setBoardOption('slotArt', v)}
                      options={(['engraved', 'mono', 'painted'] as SlotArt[]).map((id) => ({
                        id,
                        label: t(`game.settings.slot.${id}`),
                        preview: (active) => <SlotPreview art={id} active={active} />,
                      }))}
                    />
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
                    <OptionRow label={t('game.settings.vpTrack')} hint={t('game.settings.vpTrackHint')}>
                      <Switch on={opts.vpTrack} onClick={() => setBoardOption('vpTrack', !opts.vpTrack)} label={t('game.settings.vpTrack')} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.telegrams')} hint={t('game.settings.telegramsHint')}>
                      <Switch on={opts.telegrams} onClick={() => setBoardOption('telegrams', !opts.telegrams)} label={t('game.settings.telegrams')} />
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

                {section === 'sounds' && (
                  <>
                    <OptionRow label={t('game.settings.sound')} hint={t('game.settings.sounds.hint')}>
                      <Switch on={opts.sound} onClick={() => setBoardOption('sound', !opts.sound)} label={t('game.settings.sound')} />
                    </OptionRow>
                    {opts.sound && (
                      <div className="mb-1 ml-3 border-l-2 border-brass-400/40 pl-3">
                        <OptionRow label={t('game.settings.sounds.ambience')} hint={t('game.settings.sounds.ambienceHint')}>
                          <Switch on={opts.ambience} onClick={() => setBoardOption('ambience', !opts.ambience)} label={t('game.settings.sounds.ambience')} />
                        </OptionRow>
                        {/* the townsfolk are heard on the ambience's level */}
                        <OptionRow label={t('game.settings.sounds.voices')} hint={t('game.settings.sounds.voicesHint')}>
                          <Switch on={opts.voices} onClick={() => setBoardOption('voices', !opts.voices)} label={t('game.settings.sounds.voices')} />
                        </OptionRow>
                        {(opts.ambience || opts.voices) && (
                          <OptionRow label={t('game.settings.sounds.volAmbience')}>
                            <Level value={opts.volAmbience} onChange={(v) => setBoardOption('volAmbience', v)} label={t('game.settings.sounds.volAmbience')} />
                          </OptionRow>
                        )}
                        <OptionRow label={t('game.settings.sounds.music')} hint={t('game.settings.sounds.musicHint')}>
                          <Switch on={opts.music} onClick={() => setBoardOption('music', !opts.music)} label={t('game.settings.sounds.music')} />
                        </OptionRow>
                        {opts.music && (
                          <OptionRow label={t('game.settings.sounds.volMusic')}>
                            <Level value={opts.volMusic} onChange={(v) => setBoardOption('volMusic', v)} label={t('game.settings.sounds.volMusic')} />
                          </OptionRow>
                        )}
                        <OptionRow label={t('game.settings.sounds.volGestures')} hint={t('game.settings.sounds.volGesturesHint')}>
                          <Level value={opts.volGestures} onChange={(v) => setBoardOption('volGestures', v)} label={t('game.settings.sounds.volGestures')} />
                        </OptionRow>
                        <OptionRow label={t('game.settings.sounds.volMoments')} hint={t('game.settings.sounds.volMomentsHint')}>
                          <Level value={opts.volMoments} onChange={(v) => setBoardOption('volMoments', v)} label={t('game.settings.sounds.volMoments')} />
                        </OptionRow>
                      </div>
                    )}
                  </>
                )}

                {section === 'interface' && (
                  <>
                    <OptionRow label={t('game.settings.language')}>
                      <Segmented<Lang> value={lang} onChange={setLang} options={LANGS.map((id) => ({ id, label: id }))} />
                    </OptionRow>
                    <OptionRow label={t('game.settings.minimapSize')}>
                      <Segmented<MinimapSize>
                        value={opts.minimapSize}
                        onChange={(v) => {
                          setBoardOption('minimapWidth', 0);
                          setBoardOption('minimapSize', v);
                        }}
                        options={(['s', 'm', 'l'] as MinimapSize[]).map((id) => ({ id, label: t(`game.settings.size.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.railLane.setting')} hint={t('game.railLane.settingHint')}>
                      <Segmented<RailMode>
                        value={opts.railMode}
                        onChange={(v) => setBoardOption('railMode', v)}
                        options={RAIL_MODES.map((id) => ({ id, label: t(id === 'medals' ? 'game.railLane.modeMedals' : id === 'cards' ? 'game.railLane.modeCards' : 'game.railLane.modeSlip') }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.incomeSide')} hint={t('game.settings.incomeSideHint')}>
                      <Segmented<IncomeSide>
                        value={opts.incomeSide}
                        onChange={(v) => setBoardOption('incomeSide', v)}
                        options={(['bottom', 'left'] as IncomeSide[]).map((id) => ({ id, label: t(`game.settings.side.${id}`) }))}
                      />
                    </OptionRow>
                    <OptionRow label={t('game.settings.incomePinned')} hint={t('game.settings.incomePinnedHint')}>
                      <Switch on={opts.incomePinned} onClick={() => setBoardOption('incomePinned', !opts.incomePinned)} label={t('game.settings.incomePinned')} />
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

/* renders on its own subscriptions, not on every render of the page */
export default memo(BoardSettings);
