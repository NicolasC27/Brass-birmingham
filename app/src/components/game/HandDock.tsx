import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Binoculars, DraftingCompass, Hammer, Landmark, Pin, PinOff, Route, Scale, X } from 'lucide-react';
import { INDUSTRY_ICON, INDUSTRY_LABEL } from '@/game/data';
import { townColor } from '@/game/townColors';
import { cardLabel, confirmSummary, useGame, verbsForCard } from '@/game/store';
import type { Card, IndustryType, Verb } from '@/game/types';
import { tr, useT } from '@/i18n';
import { INDUSTRY_COLOR } from './townChrome';
import Tooltip from './Tooltip';
import { cn } from '@/lib/utils';
import { hudInsets, useBoardOptions } from './boardOptions';
import { MM_W_FOR } from './Minimap';

const PIN_KEY = 'brassworks.dockPinned';

const VERB_META: { verb: Verb; label: string; icon: typeof Hammer }[] = [
  { verb: 'build', label: 'game.hand.verbBuild', icon: Hammer },
  { verb: 'network', label: 'game.hand.verbNetwork', icon: Route },
  { verb: 'develop', label: 'game.hand.verbDevelop', icon: DraftingCompass },
  { verb: 'sell', label: 'game.hand.verbSell', icon: Scale },
  { verb: 'loan', label: 'game.hand.verbLoan', icon: Landmark },
  { verb: 'scout', label: 'game.hand.verbScout', icon: Binoculars },
];

/* ------------------- collector engraving flavour lines ------------------- */

const TOWN_FLAVOR_KEY: Record<string, string> = {
  birmingham: 'game.hand.town.birmingham',
  stoke: 'game.hand.town.stoke',
  coalbrookdale: 'game.hand.town.coalbrookdale',
  burton: 'game.hand.town.burton',
  coventry: 'game.hand.town.coventry',
  wolverhampton: 'game.hand.town.wolverhampton',
};

const INDUSTRY_FLAVOR_KEY: Record<IndustryType, string> = {
  coal: 'game.hand.industry.coal',
  iron: 'game.hand.industry.iron',
  cotton: 'game.hand.industry.cotton',
  manufacturer: 'game.hand.industry.manufacturer',
  pottery: 'game.hand.industry.pottery',
  brewery: 'game.hand.industry.brewery',
};

function cardFlavor(card: Card): string {
  const label = cardLabel(card);
  if (card.kind === 'location')
    return tr('game.hand.cardTown', { label, flavor: tr(TOWN_FLAVOR_KEY[card.town!] ?? 'game.hand.town.fallback') });
  if (card.kind === 'industry') return tr('game.hand.cardIndustry', { label, flavor: tr(INDUSTRY_FLAVOR_KEY[card.industry!]) });
  if (card.kind === 'wild-location') return tr('game.hand.wildLocation');
  return tr('game.hand.wildIndustry');
}

/** engraved shield with the town initial (location cards) */
function ShieldEmblem({ initial }: { initial: string }) {
  return (
    <svg viewBox="0 0 36 42" className="h-11 w-9" aria-hidden>
      <path d="M18 2 L33 7 V20 C33 31 26 38 18 40 C10 38 3 31 3 20 V7 Z" fill="#F4ECD8" stroke="#8A6B33" strokeWidth={1.6} />
      <path d="M18 5.5 L29.5 9.8 V20 C29.5 28.8 24 34.4 18 36.4 C12 34.4 6.5 28.8 6.5 20 V9.8 Z" fill="none" stroke="#2A241C" strokeOpacity={0.55} strokeWidth={0.9} />
      <text x={18} y={25} textAnchor="middle" fontFamily="'IM Fell English SC',Georgia,serif" fontSize={16} fill="#2A241C">
        {initial}
      </text>
    </svg>
  );
}

function GameCard({
  card,
  index,
  selected,
  scoutMarked,
  disabled,
  onClick,
  onDoubleClick,
}: {
  card: Card;
  index: number;
  selected: boolean;
  scoutMarked: boolean;
  disabled: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  const t = useT();
  const wild = card.kind.startsWith('wild');
  const industry = card.kind === 'industry' ? card.industry! : null;
  const label = cardLabel(card);
  return (
    <motion.button
      layout="position"
      type="button"
      aria-label={t('game.hand.cardAria', { n: index + 1, label })}
      aria-pressed={selected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: selected || scoutMarked ? -12 : 0, opacity: disabled ? 0.45 : 1, rotate: scoutMarked ? 0 : (index % 3 - 1) * 2 }}
      whileHover={{ y: -12, rotate: scoutMarked ? 0 : -1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      className={cn(
        'relative h-[120px] w-[84px] shrink-0 overflow-hidden rounded-md border border-[#A8843F] text-left shadow-e3',
        selected && 'shadow-[0_0_0_2px_var(--brass-500),0_18px_34px_rgba(0,0,0,.55)]',
        scoutMarked && 'brightness-[.55] saturate-50 shadow-[0_0_0_2px_#B5412F,0_10px_20px_rgba(0,0,0,.5)]',
      )}
      style={{ zIndex: selected ? 10 : scoutMarked ? 9 : index }}
      title={cardFlavor(card)}
    >
      {/* aged parchment: cream gradient + paper grain + browned corners */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(165deg,#F2E8CE,#E7D8B2_55%,#D9C491)]" />
      <div aria-hidden className="tex-paper absolute inset-0 opacity-[0.12]" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 42%, transparent 52%, rgba(120,82,32,.32) 86%, rgba(70,45,16,.5))' }}
      />
      {/* double engraved border: brass outer edge + charcoal inner fillet */}
      <div aria-hidden className="pointer-events-none absolute inset-[3px] rounded-[5px] border border-[#2A241C]/55" />
      {/* industry liseré down the left edge, tinted with the trade colour */}
      {industry && (
        <span aria-hidden className="absolute bottom-[4px] left-[4px] top-[4px] w-[3px] rounded-full" style={{ backgroundColor: INDUSTRY_COLOR[industry] }} />
      )}
      {/* location liseré: the town's own colour code (matches the board's
          slot frames + ribbon dash — physical Brass location colours) */}
      {card.town && (
        <span aria-hidden className="absolute bottom-[4px] left-[4px] top-[4px] w-[3px] rounded-full" style={{ backgroundColor: townColor(card.town) }} />
      )}
      {/* top band: name in small caps over an engraved rule */}
      <div className="absolute inset-x-[8px] top-[6px] border-b border-[#8A6B33]/60 pb-[2px]">
        <p className="truncate text-center font-fell text-[10px] uppercase leading-tight tracking-[0.05em] text-[#2A241C]">
          {label}
        </p>
      </div>
      {/* emblem: tinted trade icon / town shield / engraved wild star */}
      <div className="absolute inset-x-0 top-[26px] flex h-[52px] items-center justify-center">
        {card.industry2 && (
          <span
            aria-hidden
            className="absolute right-[10px] top-[30px] block h-5 w-5"
            style={{
              WebkitMaskImage: `url(${INDUSTRY_ICON[card.industry2]})`,
              maskImage: `url(${INDUSTRY_ICON[card.industry2]})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              backgroundColor: INDUSTRY_COLOR[card.industry2],
            }}
          />
        )}
        {industry && (
          <span
            aria-hidden
            className={card.industry2 ? 'block h-8 w-8 -translate-x-2' : 'block h-9 w-9'}
            style={{
              WebkitMaskImage: `url(${INDUSTRY_ICON[industry]})`,
              maskImage: `url(${INDUSTRY_ICON[industry]})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              backgroundColor: INDUSTRY_COLOR[industry],
              filter: 'drop-shadow(0 1px 0 rgba(244,236,216,.5))',
            }}
          />
        )}
        {card.kind === 'location' && <ShieldEmblem initial={label.slice(0, 1)} />}
        {wild && (
          <span
            aria-hidden
            className="font-display text-[26px] font-black text-[#2A241C]/80"
            style={{ textShadow: '0 1px 0 rgba(244,236,216,.55), 0 -1px 1px rgba(0,0,0,.25)' }}
          >
            ✦
          </span>
        )}
      </div>
      {/* flavour line, fine italics */}
      <p className="absolute inset-x-[8px] bottom-[5px] line-clamp-2 text-center font-serif text-[8px] italic leading-tight text-[#5A4A30]">
        {cardFlavor(card)}
      </p>
      {scoutMarked && (
        <>
          {/* discard stamp: red ✕ badge + diagonal "OUT" ribbon, unmistakable */}
          <span className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-cream-100/70 bg-rust-500 text-cream-100 shadow-e2">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-sm border-2 border-rust-500 bg-coal-950/85 px-2 py-0.5 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-rust-500 brightness-150">
            {t('game.hand.scoutOut')}
          </span>
        </>
      )}
    </motion.button>
  );
}

/**
 * Floating hand dock (map-v3 §2): bottom-centre, auto-collapses to a slim
 * brass strip (card count + selected verb) when idle; expands on hover,
 * click (pins), or hotkey (1–8 selects a card, which forces expansion).
 * The Confirm bar floats above it.
 */
export default function HandDock() {
  const t = useT();
  const game = useGame((s) => s.game);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const developPick = useGame((s) => s.developPick);
  const scoutPick = useGame((s) => s.scoutPick);
  const selectCard = useGame((s) => s.selectCard);
  const setVerb = useGame((s) => s.setVerb);
  const setLoanPeek = useGame((s) => s.setLoanPeek);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const toggleDevelop = useGame((s) => s.toggleDevelop);
  const cancel = useGame((s) => s.cancel);
  const confirm = useGame((s) => s.confirm);
  const currentDevelops = useGame((s) => s.currentDevelops);

  /* -------------------- auto-collapse state -------------------- */
  const [hovered, setHovered] = useState(false);
  /* pinned = never folds by itself; remembered across games */
  const [pinned, setPinnedState] = useState(() => {
    try {
      return localStorage.getItem(PIN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setPinned = (fn: (v: boolean) => boolean) =>
    setPinnedState((v) => {
      const next = fn(v);
      try {
        localStorage.setItem(PIN_KEY, next ? '1' : '0');
      } catch {
        /* non-fatal */
      }
      return next;
    });
  const leaveTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  /* H pins / unpins the hand from anywhere (not while typing) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      setPinned((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const boardOpts = useBoardOptions();
  const insets = hudInsets(boardOpts);
  /* never wider than the room between the minimap and its mirror on the left */
  const maxW = `min(1360px, calc(100vw - ${2 * (MM_W_FOR[boardOpts.minimapSize] + 28)}px))`;
  /* the fan scrolls sideways with a plain mouse wheel (no shift needed) */
  const fanRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fanRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      el.scrollLeft += d;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* hover intent: the collapsed strip sits right above the income track, so
     a pointer merely crossing it on the way down must NOT pop the hand open.
     It expands only once the pointer has rested on it for a beat. */
  const onEnter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    if (enterTimer.current === null) enterTimer.current = window.setTimeout(() => setHovered(true), 260);
  };
  const onLeave = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    enterTimer.current = null;
    // small grace period so the strip doesn't snap shut between cards
    leaveTimer.current = window.setTimeout(() => setHovered(false), 350);
  };
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    },
    [],
  );

  if (!game) return null;
  const p = game.players[game.current];
  const isHumanTurn = !p.isBot && game.phase === 'action';
  /* whose cards to show: the player to act when human; during a bot's turn
     the lone human keeps seeing their own hand (dimmed). With several humans
     at one screen nothing is shown — the pass interstitial guards privacy. */
  const humans = game.players.filter((x) => !x.isBot);
  const shown = !p.isBot ? p : humans.length === 1 ? humans[0] : null;
  const verbs = verbsForCard({ game, selectedCardId });
  const summary = confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, scoutPick, selectedCardId });
  const devOptions = verb === 'develop' ? currentDevelops() : [];

  const busy = !!selectedCardId || !!summary || verb === 'develop' || verb === 'scout';
  const expanded = pinned || hovered || busy;
  const verbLabel = verb ? VERB_META.find((v) => v.verb === verb)?.label : null;

  return (
    <footer
      aria-label={t('game.hand.dockAria')}
      className="fixed left-1/2 z-[64] -translate-x-1/2"
      style={{ bottom: insets.bottom, width: maxW }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {/* Confirm bar floats above the dock */}
      <AnimatePresence>
        {isHumanTurn && summary && (
          <motion.div
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="absolute -top-[52px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-brass-700/70 bg-coal-900/85 px-4 py-2 shadow-e3 backdrop-blur-md"
          >
            <span className="max-w-[46vw] truncate font-mono text-xs text-cream-100/90">{summary}</span>
            <button type="button" onClick={confirm} className="btn-strike !min-h-[34px] !px-4 !py-1.5 text-xs">
              {t('game.hand.strike')}
            </button>
            <button type="button" onClick={cancel} className="btn-ledger !min-h-[34px] !px-3 !py-1.5 text-xs">
              {t('game.hand.cancel')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ height: expanded ? 180 : 32 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative overflow-hidden rounded-lg border border-brass-700/60 bg-coal-900/85 shadow-e3 backdrop-blur-md"
      >
        <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.08]" />

        {/* collapsed brass strip */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? t('game.hand.foldDock') : t('game.hand.openDock')}
          onClick={() => setPinned((v) => !v)}
          className={cn(
            'relative flex h-[32px] w-full items-center justify-center gap-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            expanded ? 'text-brass-500/70 hover:text-brass-400' : 'text-brass-400 hover:text-brass-400',
          )}
        >
          <span className="engraved-brass font-fell normal-case tracking-[0.08em]">
            {isHumanTurn ? t('game.hand.cardsInHand', { count: p.hand.length }) : t('game.hand.atTable', { name: p.name })}
          </span>
          {/* pin: keeps the dock open whatever the pointer does */}
          <span
            role="button"
            tabIndex={0}
            aria-pressed={pinned}
            aria-label={pinned ? t('game.hand.unpin') : t('game.hand.pin')}
            title={pinned ? t('game.hand.unpin') : t('game.hand.pin')}
            onClick={(e) => {
              e.stopPropagation();
              setPinned((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setPinned((v) => !v);
              }
            }}
            className={cn(
              'absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border transition-colors',
              pinned ? 'border-brass-400 bg-brass-500/25 text-brass-400' : 'border-brass-700/50 text-brass-500/60 hover:text-brass-400',
            )}
          >
            {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          </span>
          {verbLabel && (
            <span className="rounded-sm border border-brass-500/60 bg-brass-500/15 px-1.5 py-0.5 text-[9px] text-brass-400">
              {t(verbLabel)}
            </span>
          )}
          <span aria-hidden className={cn('text-brass-500/60 transition-transform duration-200', expanded && 'rotate-180')}>▾</span>
        </button>

        {/* expanded dock body */}
        {/* body tall enough for a full 120px card PLUS the 12px lift of a
            selected one — nothing gets cropped at the top any more */}
        <div className="relative flex h-[148px] items-stretch gap-3 px-4 pb-3">
          {/* deck plate */}
          <div className="flex w-[64px] flex-col items-center justify-center gap-1">
            <div className="relative h-[74px] w-[52px]">
              <img src="/card-back.png" alt={t('game.hand.deckAlt')} className="h-full w-full rounded border border-brass-700/60 object-cover shadow-e2" />
              <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-brass-700 bg-coal-900 px-1 font-mono text-[10px] text-brass-400">
                {game.deck.length}
              </span>
            </div>
            <span className="font-mono text-[9px] uppercase text-cream-100/45">{t('game.hand.deckLabel')}</span>
          </div>

          {/* verb chips — a fixed 2×3 grid: nothing wraps behind the cards */}
          <div className="grid w-[216px] shrink-0 grid-cols-2 content-start gap-1">
            {VERB_META.map(({ verb: v, label, icon: Icon }) => {
              const meta = verbs.find((x) => x.verb === v);
              const ok = !!meta?.ok && isHumanTurn;
              const chip = (
                <button
                  key={v}
                  type="button"
                  disabled={!ok}
                  onClick={() => setVerb(verb === v ? null : v)}
                  onPointerEnter={v === 'loan' && ok ? () => setLoanPeek(true) : undefined}
                  onPointerLeave={v === 'loan' ? () => setLoanPeek(false) : undefined}
                  onFocus={v === 'loan' && ok ? () => setLoanPeek(true) : undefined}
                  onBlur={v === 'loan' ? () => setLoanPeek(false) : undefined}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-sm border px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wider transition-colors',
                    verb === v
                      ? 'border-brass-400 bg-brass-500/20 text-brass-400 shadow-[0_0_8px_rgba(201,164,92,.3)]'
                      : ok
                        ? 'border-brass-700/70 bg-coal-800 text-cream-100/85 hover:border-brass-500 hover:text-brass-400'
                        : 'cursor-not-allowed border-brass-700/30 bg-coal-800/60 text-cream-100/30',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(label)}
                </button>
              );
              return !ok && meta?.reason && isHumanTurn ? (
                <Tooltip key={v} side="top" title={t(label)} content={meta.reason}>
                  {chip}
                </Tooltip>
              ) : (
                chip
              );
            })}
          </div>

          {/* develop drawer strip */}
          <AnimatePresence>
            {verb === 'develop' && isHumanTurn && (
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex items-center gap-2 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.hand.retire')}</span>
                {devOptions.map((d) => (
                  <button
                    key={d.industry}
                    type="button"
                    disabled={!d.valid}
                    onClick={() => toggleDevelop(d.industry)}
                    className={cn(
                      'flex items-center gap-1 rounded-sm border px-1.5 py-1 font-sans text-[10px] font-semibold',
                      developPick.includes(d.industry)
                        ? 'border-rust-500 bg-rust-500/15 text-ink-900'
                        : d.valid
                          ? 'border-brass-700/60 text-ink-900/85 hover:bg-brass-500/20'
                          : 'cursor-not-allowed border-brass-700/30 text-ink-900/35',
                    )}
                    title={d.reason ?? t('game.hand.devOption', { name: INDUSTRY_LABEL[d.industry], level: d.level, cost: d.iron.totalCost })}
                  >
                    <img src={INDUSTRY_ICON[d.industry]} alt="" className="h-3.5 w-3.5" />
                    L{d.level}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* the fan — centred while it fits, scrollable from the FIRST card
              once it overflows (a centred flex row would clip its left edge) */}
          <div ref={fanRef} className="relative flex min-w-0 flex-1 items-end overflow-x-auto pb-1" style={{ scrollSnapType: 'x proximity' }}>
            {/* the strip already names who is at the table; the fan only
                speaks when there is nothing to show */}
            {!isHumanTurn && !shown && (
              <p className="m-auto font-fell text-sm italic text-brass-500/60">
                {game.phase === 'action' ? t('game.hand.handsHidden') : t('game.hand.eraTurns')}
              </p>
            )}
            {shown && (
              <div className="mx-auto flex items-end pl-1 pr-1">
              {shown.hand.map((card, i) => (
                <div key={card.id} className="-ml-4 first:ml-0" style={{ scrollSnapAlign: 'center' }}>
                  <GameCard
                    card={card}
                    index={i}
                    selected={isHumanTurn && selectedCardId === card.id}
                    scoutMarked={isHumanTurn && scoutPick.includes(card.id)}
                    disabled={!isHumanTurn}
                    onClick={() => isHumanTurn && selectCard(card.id)}
                    /* double-click a town card = camera flies to that town.
                       The two clicks before it toggle the card off, so
                       re-select it (not in scout mode, where clicks toggle marks) */
                    onDoubleClick={
                      card.town
                        ? () => {
                            flyToRegion(card.town!);
                            const st = useGame.getState();
                            if (st.verb !== 'scout' && st.selectedCardId !== card.id) selectCard(card.id);
                          }
                        : undefined
                    }
                  />
                </div>
              ))}
              </div>
            )}
          </div>

          {/* right status / hints */}
          <div className="hidden w-[190px] flex-col justify-center gap-1.5 border-l border-brass-700/40 pl-3 xl:flex">
            {game.round === 1 && game.era === 'canal' ? (
              <p className="paper px-2 py-1.5 font-fell text-[11px] italic leading-snug text-ink-900/85">
                {t('game.hand.firstRound')}
              </p>
            ) : (
              <p className="font-mono text-[10px] text-cream-100/55">
                {t('game.hand.actionsLeftPrefix')} <span className="text-brass-400">{game.actionsLeft}</span>
              </p>
            )}
            <p className="font-sans text-[10px] leading-snug text-cream-100/45">
              {t('game.hand.keysHint')}
            </p>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
