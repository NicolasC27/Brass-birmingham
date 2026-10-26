import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Binoculars, DraftingCompass, Hammer, Landmark, Pin, PinOff, Route, Scale, SkipForward, X, Undo2 } from 'lucide-react';
import { INDUSTRIES, INDUSTRY_ICON, TOWN_BY_ID, incomeLevel, marketBuyPrice } from '@/game/data';
import type { GameState } from '@/game/types';
import { townColor } from '@/game/townColors';
import { cardLabel, confirmSummary, developPlans, projectQueued, useGame, verbsForCard } from '@/game/store';
import { beerSources, buildTargets, ironSources, saleBeerSources, sellTargets, tileKey } from '@/game/engine';
import { MERCHANT_BY_ID } from '@/game/data';
import { aidOn } from '@/components/game/boardOptions';
import type { Card, IndustryType, Verb } from '@/game/types';
import { money, reasonText, tr, useT } from '@/i18n';
import { INDUSTRY_COLOR } from './townChrome';
import { industryFaceUrl } from '@/gl/faces';
import Tooltip from './Tooltip';
import { cn } from '@/lib/utils';
import { minimapWidth, useBoardOptions, useTableWidth } from './boardOptions';
import { useHudInsets } from './useHudInsets';
import { isKey, keyLabel, typing, useKeybindings } from './keybindings';
import { FIT_PAD_BOTTOM, setFitReserve } from './boardView';
import { levelMark, tileMark } from './levelMark';
import { buildCoalCubes, linkCoalCubes } from './coalPicks';
import type { CoalCube } from './coalPicks';
import { CARD_H, DOCK_FIXED, DOCK_OPEN_H, FAN_PAD, FAN_SLIDE_MIN, HINTS_W, cardArt, fanMeasure, nextTurnPlace, skylineOf } from './handFan';
import { useReducedMotion } from './useReducedMotion';
import { roman } from '@/gl/roman';

const PIN_KEY = 'brassworks.dockPinned';

const VERB_META: { verb: Verb; label: string; icon: typeof Hammer }[] = [
  { verb: 'build', label: 'game.hand.verbBuild', icon: Hammer },
  { verb: 'network', label: 'game.hand.verbNetwork', icon: Route },
  { verb: 'develop', label: 'game.hand.verbDevelop', icon: DraftingCompass },
  { verb: 'sell', label: 'game.hand.verbSell', icon: Scale },
  { verb: 'loan', label: 'game.hand.verbLoan', icon: Landmark },
  { verb: 'scout', label: 'game.hand.verbScout', icon: Binoculars },
  /* nothing to play: the card is discarded and the action skipped */
  { verb: 'pass', label: 'game.hand.verbPass', icon: SkipForward },
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

/** A town with no engraved plate yet (another board's towns, or a plate
 *  that did not load): its skyline cut on the card itself — gables, a
 *  spire, a chimney or two over a strip of water, hatched as the plates
 *  are. The same town always draws the same skyline. */
function EngravedSkyline({ town }: { town: string }) {
  const id = `sky-${town}`;
  const { ground, houses, spire, stacks } = skylineOf(town);
  const ink = '#3B2A1A';
  return (
    <svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden>
      <defs>
        {/* the burin's three cuts: close diagonals for the roofs, open
            verticals for the walls, level rules for sky and water */}
        <pattern id={`${id}-roof`} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="1.6" stroke={ink} strokeWidth="0.7" strokeOpacity="0.85" />
        </pattern>
        <pattern id={`${id}-wall`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <line x1="0.6" y1="0" x2="0.6" y2="2.4" stroke={ink} strokeWidth="0.4" strokeOpacity="0.4" />
        </pattern>
      </defs>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`s${i}`} x1="0" x2="100" y1={3 + i * 2.6} y2={3 + i * 2.6} stroke={ink} strokeOpacity={0.2 - i * 0.018} strokeWidth="0.45" />
      ))}
      {/* the church: its tower and spire above the roofs */}
      <rect x={spire} y={ground - 28} width="8" height="28" fill={`url(#${id}-wall)`} stroke={ink} strokeWidth="0.7" />
      <rect x={spire} y={ground - 28} width="8" height="28" fill="#EFE4C8" fillOpacity="0.4" />
      <path d={`M${spire - 0.6} ${ground - 28}L${spire + 4} ${ground - 50}L${spire + 8.6} ${ground - 28}Z`} fill={`url(#${id}-roof)`} stroke={ink} strokeWidth="0.7" />
      <rect x={spire + 2.8} y={ground - 24} width="2.4" height="4" rx="1.2" fill={ink} fillOpacity="0.75" />
      {stacks.map((c, i) => (
        <g key={`c${i}`}>
          <rect x={c.x} y={c.top} width="2.6" height={ground - c.top} fill={`url(#${id}-roof)`} stroke={ink} strokeWidth="0.6" />
          <path d={`M${c.x + 1.3} ${c.top - 1}c3 -3 6 -2 9 -5s6 -2 10 -4`} fill="none" stroke={ink} strokeOpacity="0.4" strokeWidth="0.7" />
        </g>
      ))}
      {houses.map((h, i) => (
        <g key={`h${i}`}>
          <rect x={h.x} y={h.top} width={h.w} height={ground - h.top} fill="#F1E7CD" />
          <rect x={h.x} y={h.top} width={h.w} height={ground - h.top} fill={`url(#${id}-wall)`} stroke={ink} strokeWidth="0.7" />
          <path d={`M${h.x - 1} ${h.top}L${h.x + h.w / 2} ${h.peak}L${h.x + h.w + 1} ${h.top}Z`} fill={`url(#${id}-roof)`} stroke={ink} strokeWidth="0.7" />
          {Array.from({ length: Math.max(0, Math.floor((ground - h.top - 5) / 6)) }, (_, k) => (
            <rect key={k} x={h.x + h.w / 2 - 1.2} y={h.top + 3 + k * 6} width="2.4" height="3" fill={ink} fillOpacity="0.8" />
          ))}
        </g>
      ))}
      {/* the water in front: level rules, broken by the reflections */}
      <line x1="0" x2="100" y1={ground} y2={ground} stroke={ink} strokeWidth="0.9" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`w${i}`} d={`M0 ${ground + 2.4 + i * 2.4}H${30 + (i % 3) * 6}M${36 + (i % 3) * 6} ${ground + 2.4 + i * 2.4}H100`} stroke={ink} strokeOpacity={0.55 - i * 0.05} strokeWidth="0.45" />
      ))}
    </svg>
  );
}

/** a line of a card's name, condensed on the line when the word is too
 *  long for the band — as a compositor would, never cut in two. The
 *  measure is the type's own, once the face has loaded. */
function FitLine({ text, width, className }: { text: string; width: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const fit = () => {
      if (!live || !el.parentElement) return;
      el.style.transform = '';
      const room = el.parentElement.clientWidth;
      const w = el.scrollWidth;
      el.style.transform = w > room ? `scaleX(${(room / w).toFixed(3)})` : '';
    };
    fit();
    void document.fonts?.ready.then(fit);
    return () => {
      live = false;
    };
  }, [text, width]);
  return (
    <span className={cn('block min-w-0 overflow-hidden whitespace-nowrap', className)}>
      <span ref={ref} className="inline-block origin-left">
        {text}
      </span>
    </span>
  );
}

/** a card's picture, printed on its paper: the town's plate, the trade's
 *  painting (two for a double card), a joker's own plate */
function CardArt({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  const art = cardArt(card);
  if (card.kind === 'industry' && card.industry) {
    const second = card.industry2 ? industryFaceUrl(card.industry2, {}) : null;
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {/* the ground the painting stands on, a soft pool of shade */}
        <span aria-hidden className="absolute bottom-[10%] left-1/2 h-[14%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(60,38,14,.38),transparent)]" />
        {second && <img src={second} alt="" draggable={false} className="absolute right-[4%] top-[6%] h-[62%] w-[62%] object-contain opacity-95 drop-shadow-[0_2px_2px_rgba(40,24,8,.35)]" />}
        <img
          src={art!}
          alt=""
          draggable={false}
          className={cn('relative object-contain drop-shadow-[0_3px_3px_rgba(40,24,8,.4)]', second ? '-translate-x-[16%] translate-y-[10%] h-[74%] w-[74%]' : 'h-[88%] w-[88%]')}
        />
      </div>
    );
  }
  if (!art || failed) return card.town ? <EngravedSkyline town={card.town} /> : null;
  return (
    <img
      src={art}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover mix-blend-multiply"
      /* the plate fades into the card's paper, as a vignette does */
      style={{ WebkitMaskImage: PLATE_FADE, maskImage: PLATE_FADE }}
    />
  );
}

const PLATE_FADE = 'radial-gradient(125% 115% at 50% 40%, #000 58%, transparent 100%)';

/** a colour's perceived lightness, 0 to 1 */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** the band a card's name is set on: the town's colour, the trade's, a
 *  joker's brass */
function bandOf(card: Card): { bg: string; ink: string } {
  if (card.kind === 'location' && card.town) {
    const bg = townColor(card.town);
    /* a pale band (the amber of the Black Country, a farm's cream) takes
       the ink; a dark one the cream */
    return { bg, ink: lightness(bg) > 0.5 ? '#2A241C' : '#F4ECD8' };
  }
  if (card.kind === 'industry' && card.industry) return { bg: '#2A241C', ink: '#F0E3C2' };
  return { bg: 'linear-gradient(180deg,#D8B36A,#A8843F)', ink: '#2A241C' };
}

/* the name's band across the top of a card, and the picture beneath it */
const BAND_H = 25;

const GameCard = memo(function GameCard({
  card,
  index,
  width,
  selected,
  scoutMarked,
  disabled,
  canBuild,
  reduced,
  onPick,
  onFly,
}: {
  card: Card;
  index: number;
  width: number;
  selected: boolean;
  scoutMarked: boolean;
  disabled: boolean;
  /** the aid: this card can build something right now */
  canBuild?: boolean;
  /** the reader asks for stillness: no lift, no tilt */
  reduced: boolean;
  onPick: (id: string) => void;
  /** a town card's double-click: the camera flies to its town */
  onFly?: (card: Card) => void;
}) {
  const t = useT();
  const label = cardLabel(card);
  const band = bandOf(card);
  /* the name is set whole, from the left edge — a covered card still shows
     where its name begins. A double card names one trade a line (the slash
     would only eat the room); a single word too long for the band
     (Coalbrookdale, Wolverhampton) is condensed on the line, as a
     compositor would, never cut in two */
  const parts = label.split(' / ');
  const oneWord = parts.length === 1 && !/[\s-]/.test(label);
  const small = label.length > 12;
  /* the body keeps fourteen pixels over the cards: a chosen card rises by
     eight of them, so its ring and the light it catches stay in view */
  const lift = selected || scoutMarked ? -8 : 0;
  return (
    <motion.button
      layout="position"
      type="button"
      aria-label={t('game.hand.cardAria', { n: index + 1, label })}
      aria-pressed={selected}
      onClick={() => onPick(card.id)}
      onDoubleClick={onFly && card.town ? () => onFly(card) : undefined}
      disabled={disabled}
      initial={reduced ? false : { y: 40, opacity: 0 }}
      animate={{ y: lift, opacity: disabled ? 0.45 : 1, rotate: scoutMarked ? 0 : (index % 3 - 1) * 1.5 }}
      /* under the pointer the card rises a little, the faintest tilt, a
         soft shadow beneath it; the dock's body leaves exactly this room */
      whileHover={reduced || disabled ? undefined : { y: Math.min(lift, -6), rotate: -0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'group relative shrink-0 overflow-hidden rounded-[7px] text-left',
        'shadow-[0_0_0_1px_#8A6B33,0_4px_8px_rgba(0,0,0,.45)] transition-shadow duration-200 motion-reduce:transition-none',
        !disabled && !selected && !scoutMarked && 'hover:shadow-[0_0_0_1px_#C9A45C,0_14px_22px_rgba(0,0,0,.55)]',
        /* the chosen card: a ring of brass, and the light it catches */
        selected && 'shadow-[0_0_0_1px_#2A241C,0_0_0_3px_rgb(var(--brass-500)),0_0_14px_rgba(232,196,122,.45),0_16px_26px_rgba(0,0,0,.55)]',
        scoutMarked && 'brightness-[.55] saturate-50 shadow-[0_0_0_2px_#B5412F,0_10px_20px_rgba(0,0,0,.5)]',
      )}
      style={{ zIndex: selected ? 10 : scoutMarked ? 9 : index, width, height: CARD_H }}
      title={cardFlavor(card)}
    >
      {/* the card's stock: warm cream, a paper grain, corners browned by hands */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(165deg,#F4EBD3,#EADDBA_60%,#DDCB9C)]" />
      <div aria-hidden className="tex-paper absolute inset-0 opacity-[0.10]" />
      {/* the picture, under the band */}
      <div aria-hidden className="absolute inset-x-[4px] bottom-[4px] overflow-hidden rounded-b-[3px]" style={{ top: BAND_H + 5 }}>
        <CardArt card={card} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(130% 95% at 50% 45%, transparent 60%, rgba(120,82,32,.22) 88%, rgba(70,45,16,.4))' }}
      />
      {/* the name's band: the town's colour, the trade's ink, a joker's brass */}
      <div className="absolute inset-x-[3px] top-[3px] flex items-center overflow-hidden rounded-t-[4px] pl-[6px] pr-[4px]" style={{ height: BAND_H, background: band.bg, color: band.ink }}>
        {/* the trade's colour, as a rule under an industry's name */}
        {card.kind === 'industry' && card.industry && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 flex h-[3px]">
            <span className="flex-1" style={{ backgroundColor: INDUSTRY_COLOR[card.industry] }} />
            {card.industry2 && <span className="flex-1" style={{ backgroundColor: INDUSTRY_COLOR[card.industry2] }} />}
          </span>
        )}
        {parts.length === 2 ? (
          <p className="min-w-0 flex-1 font-fell text-[9px] uppercase leading-[10.5px]">
            <FitLine text={parts[0]} width={width} />
            <FitLine text={parts[1]} width={width} />
          </p>
        ) : oneWord ? (
          <p className="min-w-0 flex-1 font-fell text-[10px] uppercase leading-[11px] tracking-[0.03em]">
            <FitLine text={label} width={width} />
          </p>
        ) : (
          <p className={cn('line-clamp-2 min-w-0 flex-1 font-fell uppercase leading-[10.5px]', small ? 'text-[9px]' : 'text-[10px] tracking-[0.03em]')}>{label}</p>
        )}
      </div>
      {/* the engraved fillet round the whole face */}
      <div aria-hidden className="pointer-events-none absolute inset-[3px] rounded-[4px] border border-[#2A241C]/45" />
      {canBuild && (
        <span aria-hidden title={t('game.guide.canBuild')} className="absolute bottom-[6px] right-[6px] z-10 flex h-4 w-4 items-center justify-center rounded-full border border-[#8A6B33] bg-[#C9A45C] shadow-[0_1px_2px_rgba(0,0,0,.4)]">
          <Hammer className="h-2.5 w-2.5 text-[#2A241C]" />
        </span>
      )}
      {scoutMarked && (
        <>
          {/* discard stamp: red ✕ badge + diagonal "OUT" ribbon, unmistakable */}
          <span className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-brass-400/70 bg-rust-500 text-cream-100 shadow-e2">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-sm border-2 border-rust-500 bg-coal-950/85 px-2 py-0.5 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-rust-500 brightness-150">
            {t('game.hand.scoutOut')}
          </span>
        </>
      )}
    </motion.button>
  );
});

/** one cube of coal: the mine it is drawn from, among the nearest ones.
 *  The select shows the mine the table would draw from, named or not, so
 *  the choice reads before it is made. */
function CoalRow({ cube, named, game, label, onPick }: { cube: CoalCube; named: string | null; game: GameState; label: string; onPick: (key: string | null) => void }) {
  const t = useT();
  const value = named && cube.choices.some((c) => c.key === named) ? named : (cube.drawn ?? '');
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap font-sans text-[10px] text-ink-900/80">
      <img src={INDUSTRY_ICON.coal} alt="" className="h-3.5 w-3.5" />
      <span className="text-ink-900/45">←</span>
      <select
        value={value}
        onChange={(e) => onPick(e.target.value || null)}
        aria-label={label}
        className="max-w-[200px] rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
      >
        {cube.choices.map((c) => (
          <option key={c.key} value={c.key}>
            {t('game.hand.devIronWorks', { owner: game.players[c.owner].name, town: TOWN_BY_ID[c.town]?.name ?? c.town, cubes: c.cubes })}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Floating hand dock (map-v3 §2): bottom-centre, auto-collapses to a slim
 * brass strip (card count + selected verb) when idle; expands on hover,
 * click (pins), or hotkey (1–8 selects a card, which forces expansion).
 * The Confirm bar floats above it.
 */
function HandDock() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const preparing = useGame((s) => s.preparing);
  const queued = useGame((s) => s.queued);
  const setPreparing = useGame((s) => s.setPreparing);
  const planActor = useGame((s) => s.planActor());
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const developPick = useGame((s) => s.developPick);
  const developIron = useGame((s) => s.developIron);
  const buildIron = useGame((s) => s.buildIron);
  const setBuildIron = useGame((s) => s.setBuildIron);
  const buildCoal = useGame((s) => s.buildCoal);
  const setBuildCoal = useGame((s) => s.setBuildCoal);
  const linkCoal = useGame((s) => s.linkCoal);
  const setLinkCoal = useGame((s) => s.setLinkCoal);
  const linkBeer = useGame((s) => s.linkBeer);
  const setLinkBeer = useGame((s) => s.setLinkBeer);
  const sellBeer = useGame((s) => s.sellBeer);
  const setSellBeer = useGame((s) => s.setSellBeer);
  const setSellMerchant = useGame((s) => s.setSellMerchant);
  const addDevelop = useGame((s) => s.addDevelop);
  const dropDevelop = useGame((s) => s.dropDevelop);
  const setDevelopIron = useGame((s) => s.setDevelopIron);
  const scoutPick = useGame((s) => s.scoutPick);
  const selectCard = useGame((s) => s.selectCard);
  const setVerb = useGame((s) => s.setVerb);
  const setLoanPeek = useGame((s) => s.setLoanPeek);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const onlineCode = useGame((s) => s.code);
  const aid = !!game && aidOn(game.assist, onlineCode !== null);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.canUndo());
  const currentDevelops = useGame((s) => s.currentDevelops);

  /* -------------------- auto-collapse state -------------------- */
  const [hovered, setHovered] = useState(false);
  /* the card under the pointer comes forward, the cards after it slide aside */
  const [hoverCard, setHoverCard] = useState<number | null>(null);
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
  const [folded, setFolded] = useState(false);
  const [hoverMuted, setHoverMuted] = useState(false);
  /* unpinning folds the hand on the spot (the reader's own turn and the
     pointer resting on the strip would otherwise keep it open, and the
     pin would seem stuck); pinning opens it */
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const togglePin = () => {
    const next = !pinnedRef.current;
    setPinned(() => next);
    setFolded(!next);
    setHoverMuted(!next);
  };
  /* H pins / unpins the hand from anywhere (not while typing) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isKey(e, 'hand') || typing(e)) return;
      togglePin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const boardOpts = useBoardOptions();
  const keys = useKeybindings();
  const insets = useHudInsets();
  /* the dock lives in the band between the left edge and the minimap, and
     takes what it needs of it, centred */
  /* the room the hand has is the table's, which a guide lane may narrow —
     and widen again, folded or gone, with no resize of the window */
  const vw = useTableWidth();
  const bandRight = minimapWidth(boardOpts, vw) + 28;
  /* the dock sits in the middle of the screen when the rail and the minimap
     leave it room there; when they do not (a wide minimap), it takes the
     middle of what is left between them instead of squeezing its cards */
  const centredRoom = vw - 2 * Math.max(insets.left, bandRight);
  const centredOnScreen = centredRoom >= 780;
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
    setHoverMuted(false);
  };
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    },
    [],
  );

  const turnKey = game ? `${game.era}:${game.round}:${game.current}:${game.actionsLeft}` : '';
  useEffect(() => {
    const id = window.setTimeout(() => setFolded(false), 0);
    return () => window.clearTimeout(id);
  }, [turnKey]);

  /* a spectator holds no cards: no dock at all */
  const visible = !!game && !(seat !== null && seat < 0);
  /* the board is framed on the room the hand leaves it: the dock says how
     tall it stands open (not folded, so the map does not breathe with the
     hand), and takes the word back when it goes */
  useLayoutEffect(() => {
    if (!visible) return;
    setFitReserve(insets.bottom + DOCK_OPEN_H + 8);
    return () => setFitReserve(FIT_PAD_BOTTOM);
  }, [visible, insets.bottom]);
  /* whose cards to show: online, always my own — dimmed while I wait my turn.
     Here, the player to act when human; during a bot's turn the lone human
     keeps seeing their own hand. With several humans at one screen nothing
     is shown — the pass interstitial guards privacy. */
  const shown = useMemo(() => {
    if (!game) return null;
    const p = game.players[game.current];
    const humans = game.players.filter((x) => !x.isBot);
    return seat !== null ? game.players[seat] : !p.isBot ? p : humans.length === 1 ? humans[0] : null;
  }, [game, seat]);
  /* with moves already prepared, the hand plans on the table they leave */
  const planGame = useMemo<GameState | null>(() => (game && preparing && queued.length && planActor >= 0 ? projectQueued(game, planActor, queued) : game), [game, preparing, queued, planActor]);
  const usedByQueue = useMemo(() => new Set(queued.map((q) => ('card' in q.action ? q.action.card : undefined)).filter(Boolean)), [queued]);
  /* the aid's hammer: which cards can build now, worked out once per table
     rather than once per card on every pass of the pointer */
  const buildable = useMemo(() => {
    const out = new Set<string>();
    if (!aid || !planGame || planActor < 0 || !shown) return out;
    for (const c of shown.hand) if (!usedByQueue.has(c.id) && buildTargets(planGame, planActor, c).some((x) => x.valid)) out.add(c.id);
    return out;
  }, [aid, planGame, planActor, shown, usedByQueue]);
  const flyCard = useCallback(
    (card: Card) => {
      /* the two clicks before it toggle the card off, so re-select it
         (not in scout mode, where clicks toggle marks) */
      flyToRegion(card.town!);
      const st = useGame.getState();
      if (st.verb !== 'scout' && st.selectedCardId !== card.id) selectCard(card.id);
    },
    [flyToRegion, selectCard],
  );
  /* the purse's spending, told by a few coins that slide from the money to
     the tally of what was spent — only on a spend, never on a new round or
     an undo, and not at all for a reader who asks for stillness */
  const reduced = useReducedMotion();
  const shownSeat = game && shown ? game.players.indexOf(shown) : -1;
  const spentNow = shown?.spent ?? 0;
  const stripRef = useRef<HTMLButtonElement>(null);
  const moneyRef = useRef<HTMLSpanElement>(null);
  const spentRef = useRef<HTMLSpanElement>(null);
  const lastSpend = useRef<{ key: string; spent: number } | null>(null);
  const [coins, setCoins] = useState<{ id: number; from: [number, number]; to: [number, number] } | null>(null);
  const spendKey = game ? `${shownSeat}:${game.era}:${game.round}` : '';
  useEffect(() => {
    const prev = lastSpend.current;
    lastSpend.current = { key: spendKey, spent: spentNow };
    if (reduced || !prev || prev.key !== spendKey || spentNow <= prev.spent) return;
    const raf = window.requestAnimationFrame(() => {
      const strip = stripRef.current?.getBoundingClientRect();
      const a = moneyRef.current?.getBoundingClientRect();
      const b = spentRef.current?.getBoundingClientRect();
      if (!strip || !a || !b) return;
      setCoins({ id: Date.now(), from: [a.left + a.width / 2 - strip.left, a.top + a.height / 2 - strip.top], to: [b.left + b.width / 2 - strip.left, b.top + b.height / 2 - strip.top] });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [spendKey, spentNow, reduced]);
  useEffect(() => {
    if (!coins) return;
    const id = window.setTimeout(() => setCoins(null), 600);
    return () => window.clearTimeout(id);
  }, [coins]);

  if (!game || !planGame || !visible) return null;
  const p = game.players[game.current];
  const isHumanTurn = game.phase === 'action' && (seat === null ? !p.isBot : seat === game.current);
  /* a move may also be planned out of turn: it waits for my turn */
  const actor = planActor;
  const canPlan = actor >= 0;
  const verbs = verbsForCard({ game: planGame, selectedCardId, actor: actor >= 0 ? actor : undefined });
  const summary = confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, developIron, scoutPick, selectedCardId });
  const devOptions = verb === 'develop' ? currentDevelops() : [];

  const busy = !!selectedCardId || !!summary || verb === 'develop' || verb === 'scout' || preparing;
  /* open through the reader's own turn — a second action is still to play */
  /* folded by a click on the strip: holds through the reader's own turn
     (which otherwise keeps the hand open) until the next turn, a pick, or
     the pin. The hover that would reopen it is muted until the pointer has
     left once, so the click itself does not bounce the hand back open. */
  /* the focus view tucks the hand in even when pinned; the pin itself is
     kept, so the hand is back up the moment the view is left */
  const expanded = (pinned && !boardOpts.focus) || busy || (hovered && !hoverMuted) || (isHumanTurn && !folded && !boardOpts.focus);
  const verbLabel = verb ? VERB_META.find((v) => v.verb === verb)?.label : null;
  const nextPlace = shownSeat >= 0 ? nextTurnPlace(game, shownSeat) : null;
  /* the sentence around the sum, so the sum alone can be set in brass */
  const spentWords = t('game.main.spent').split('{money}');
  /* the fan's room: what the dock may take, less its fixed parts */
  const handSize = shown?.hand.length ?? 0;
  const hintsShown = handSize < 7 && verb !== 'develop' && vw >= 1280;
  const dockMax = centredOnScreen ? centredRoom : vw - insets.left - bandRight;
  const fan = fanMeasure(handSize, dockMax - DOCK_FIXED - (hintsShown ? HINTS_W : 0));
  const siding = Math.max(FAN_SLIDE_MIN, -fan.step);
  const parting = hoverCard !== null && hoverCard < handSize - 1 && fan.step < 0;
  /* the coal pickers: a mine to name only when two or more stand nearest */
  const buildCubes = verb === 'build' && canPlan && buildPick ? buildCoalCubes(planGame, buildPick, buildCoal) : null;
  const buildCoalShown = !!buildCubes?.some((c) => c.choices.length > 0);
  const linkCubes = verb === 'network' && canPlan && linkPick ? linkCoalCubes(planGame, linkPick, secondLinkPick, linkCoal) : [null, null];
  const linkCoalShown = linkCubes.some((c) => !!c && c.choices.length > 0);

  return (
    <footer data-dock data-lens="hand" aria-label={t('game.hand.dockAria')} className="pointer-events-none fixed z-[64] flex justify-center" style={centredOnScreen ? { bottom: insets.bottom, left: 0, right: 0 } : { bottom: insets.bottom, left: insets.left, right: bandRight }}>
      <motion.div
        initial={false}
        animate={{ height: expanded ? 180 : 32 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        /* centred on the screen, never wider than the room between the rail and the minimap */
        style={{ maxWidth: dockMax }}
        className="pointer-events-auto relative w-auto plaque overflow-hidden rounded-lg"
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.08]" />

        {/* collapsed brass strip */}
        <button
          ref={stripRef}
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? t('game.hand.foldDock') : t('game.hand.openDock')}
          onClick={() => {
            if (expanded) {
              if (pinned) togglePin();
              else {
                setFolded(true);
                setHoverMuted(true);
              }
            } else {
              setFolded(false);
              setHoverMuted(false);
            }
          }}
          className={cn(
            'relative flex h-[32px] w-full items-center justify-center gap-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            expanded ? 'text-brass-500/70 hover:text-brass-400' : 'text-brass-400 hover:text-brass-400',
          )}
        >
          <span className="engraved-brass font-fell normal-case tracking-[0.08em]">
            {preparing ? t('game.hand.preparing') : isHumanTurn ? t('game.hand.cardsInHand', { count: (shown ?? p).hand.length }) : t('game.hand.atTable', { name: p.name })}
          </span>
          {/* while others play: prepare a move for my turn (two at most) */}
          {!isHumanTurn && !preparing && shown && game.phase === 'action' && queued.length < 2 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setPreparing(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreparing(true);
                }
              }}
              className="rounded-sm border border-brass-700/60 px-2 py-[1px] font-sans text-[10px] font-bold normal-case tracking-wider text-brass-400 hover:border-brass-400"
            >
              {t('game.hand.prepare')}
            </span>
          )}
          {/* the purse, right where the eyes already are: money, income level */}
          {shown && (
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] normal-case tracking-normal" title={t('game.hand.purseTip', { name: shown.name })}>
              <span ref={moneyRef} className="rounded-sm border border-brass-700/60 bg-coal-950/70 px-1.5 py-[1px] font-bold text-brass-400">{money(shown.money)}</span>
              <span className="rounded-sm border border-brass-700/40 bg-coal-950/50 px-1.5 py-[1px] text-bottle-600 brightness-150">↗ {incomeLevel(shown.income)}</span>
            </span>
          )}
          {/* what the purse has spent this round, and the place it earns at
              the next: public figures, the order the engine will deal */}
          {shown && game.phase === 'action' && (
            <span className="flex items-center gap-1 whitespace-nowrap font-sans text-[10px] font-normal normal-case tracking-normal text-cream-100/55" title={t('game.main.orderTip', { name: shown.name })}>
              <span>
                {spentWords[0]}
                <span ref={spentRef} className="font-mono text-[10.5px] font-semibold text-brass-400 transition-colors delay-300 duration-300" style={coins ? { color: '#F2D38A' } : undefined}>
                  {money(spentNow)}
                </span>
                {spentWords[1]}
              </span>
              {nextPlace !== null && (
                <>
                  <span aria-hidden className="text-brass-700">·</span>
                  <span>{t('game.main.nextPlace', { place: t(`game.main.place${nextPlace}`) })}</span>
                </>
              )}
            </span>
          )}
          {coins &&
            [0, 1, 2].map((k) => (
              <motion.span
                key={`${coins.id}-${k}`}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-10 h-[7px] w-[7px] rounded-full border border-[#8A6B33] bg-[radial-gradient(circle_at_35%_35%,#F6DE9C,#C9A45C_60%,#8A6B33)] shadow-[0_1px_1px_rgba(0,0,0,.5)]"
                initial={{ x: coins.from[0] - 3.5 + (k - 1) * 3, y: coins.from[1] - 3.5, opacity: 0 }}
                animate={{ x: coins.to[0] - 3.5, y: [coins.from[1] - 3.5, Math.min(coins.from[1], coins.to[1]) - 11, coins.to[1] - 3.5], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.4, delay: k * 0.05, ease: 'easeInOut' }}
              />
            ))}
          {/* undo: back to before your last action, the bots' replies with it */}
          {canUndo && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t('game.hand.undo')}
              title={`${t('game.hand.undo')} (${keyLabel(keys.undo)})`}
              onClick={(e) => {
                e.stopPropagation();
                undo();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  undo();
                }
              }}
              className="absolute left-3 top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 rounded-full border border-brass-700/50 px-2 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-brass-500/80 transition-colors hover:border-brass-400 hover:text-brass-400"
            >
              <Undo2 className="h-3 w-3" />
              {t('game.hand.undoShort')}
              <kbd className="ml-0.5 rounded-[2px] border border-brass-700/60 px-1 font-mono text-[9px] leading-[11px] text-brass-500/80">{keyLabel(keys.undo)}</kbd>
            </span>
          )}
          {/* pin: keeps the dock open whatever the pointer does */}
          <span
            role="button"
            tabIndex={0}
            aria-pressed={pinned}
            aria-label={pinned ? t('game.hand.unpin') : t('game.hand.pin')}
            title={pinned ? t('game.hand.unpin') : t('game.hand.pin')}
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                togglePin();
              }
            }}
            className={cn(
              'absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition-colors',
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
              <img src="/card-back.webp" alt={t('game.hand.deckAlt')} className="h-full w-full rounded border border-brass-700/60 object-cover shadow-e2" />
              <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-brass-700 bg-coal-900 px-1 font-mono text-[10px] text-brass-400">
                {game.deck.length}
              </span>
            </div>
            <span className="font-mono text-[9px] uppercase text-cream-100/60">{t('game.hand.deckLabel')}</span>
          </div>

          {/* verb chips — a fixed 2×3 grid: nothing wraps behind the cards */}
          <div className="grid w-[216px] shrink-0 grid-cols-2 content-start gap-1">
            {VERB_META.map(({ verb: v, label, icon: Icon }) => {
              const meta = verbs.find((x) => x.verb === v);
              const ok = !!meta?.ok && canPlan;
              /* a verb nothing takes still answers the click: the banner
                 then says what blocks it, instead of a tooltip nobody sees */
              const clickable = ok || (!!meta?.tryable && canPlan);
              const chip = (
                <button
                  key={v}
                  type="button"
                  disabled={!clickable}
                  data-lens={v}
                  onClick={() => setVerb(verb === v ? null : v)}
                  onPointerEnter={v === 'loan' && ok ? () => setLoanPeek(true) : undefined}
                  onPointerLeave={v === 'loan' ? () => setLoanPeek(false) : undefined}
                  onFocus={v === 'loan' && ok ? () => setLoanPeek(true) : undefined}
                  onBlur={v === 'loan' ? () => setLoanPeek(false) : undefined}
                  className={cn(
                    /* 31px tall: four rows fill the body's 136px, and each verb
                       clears the target floor */
                    'flex min-h-[31px] w-full items-center gap-1.5 rounded-sm border px-2 py-[5px] font-sans text-[10px] font-bold uppercase tracking-wider transition-colors',
                    v === 'pass' && 'col-span-2 justify-center border-dashed',
                    verb === v
                      ? 'border-brass-400 bg-brass-500/20 text-brass-400 shadow-[0_0_8px_rgba(201,164,92,.3)]'
                      : ok
                        ? 'border-brass-700/70 bg-coal-800 text-cream-100/85 hover:border-brass-500 hover:text-brass-400'
                        : clickable
                          ? 'border-brass-700/40 bg-coal-800/70 text-cream-100/65 hover:border-brass-700 hover:text-cream-100/80'
                          : 'cursor-not-allowed border-brass-700/30 bg-coal-800/60 text-cream-100/45',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(label)}
                </button>
              );
              return !clickable && meta?.reason && canPlan ? (
                <Tooltip key={v} side="top" title={t(label)} content={reasonText(meta.reason)}>
                  {chip}
                </Tooltip>
              ) : (
                chip
              );
            })}
          </div>

          {/* the iron of a build: the rules let it come from any works on the
              board, so the reader names one — their own, to empty and flip it */}
          <AnimatePresence>
            {verb === 'build' && canPlan && buildPick?.valid && INDUSTRIES[buildPick.industry][buildPick.level - 1]?.iron === 1 && (
              <motion.div
                key="build-iron"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex shrink-0 flex-col gap-1.5 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.hand.buildIron')}</span>
                {(() => {
                  const sources = ironSources(planGame);
                  return (
                    <label className="flex items-center gap-1.5 whitespace-nowrap font-sans text-[10px] text-ink-900/80" title={t('game.topbar.ironTip')}>
                      <img src={INDUSTRY_ICON.iron} alt="" className="h-3.5 w-3.5" />
                      <span className="text-ink-900/45">←</span>
                      <select
                        value={buildIron ?? ''}
                        onChange={(e) => {
                          setBuildIron(e.target.value || null);
                          if (e.target.value && e.target.value !== 'market') flyToRegion(e.target.value.split(':')[0]);
                        }}
                        aria-label={t('game.topbar.ironTip')}
                        className="max-w-[200px] rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
                      >
                        <option value="">{t('game.hand.devIronAuto')}</option>
                        {sources.map((src) => (
                          <option key={src.key} value={src.key}>
                            {t('game.hand.devIronWorks', { owner: planGame.players[src.owner].name, town: TOWN_BY_ID[src.town]?.name ?? src.town, cubes: src.cubes })}
                          </option>
                        ))}
                        {sources.length === 0 && <option value="market">{t('game.hand.devIronMarket', { cost: marketBuyPrice('iron', planGame.market.iron) })}</option>}
                      </select>
                    </label>
                  );
                })()}
                <span className="font-sans text-[9.5px] leading-snug text-ink-900/55">{t('game.hand.buildIronHint')}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* the coal of a build: among the nearest connected mines the
              choice is the reader's — shown only when there is one to make */}
          <AnimatePresence>
            {buildCoalShown && (
              <motion.div
                key="build-coal"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex shrink-0 flex-col gap-1.5 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.main.buildCoal')}</span>
                {buildCubes!.map((cube, k) =>
                  cube.choices.length > 0 ? (
                    <CoalRow
                      key={k}
                      cube={cube}
                      named={buildCoal[k] ?? null}
                      game={planGame}
                      label={t('game.main.buildCoal')}
                      onPick={(key) => {
                        setBuildCoal(k, key);
                        if (key) flyToRegion(key.split(':')[0]);
                      }}
                    />
                  ) : null,
                )}
                <span className="max-w-[210px] font-sans text-[9.5px] leading-snug text-ink-900/55">{t('game.main.coalHint')}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* the coal of each rail link, the same way */}
          <AnimatePresence>
            {linkCoalShown && (
              <motion.div
                key="link-coal"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex shrink-0 flex-col gap-1.5 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.main.buildCoal')}</span>
                {linkCubes.map((cube, k) =>
                  cube && cube.choices.length > 0 ? (
                    <CoalRow
                      key={k}
                      cube={cube}
                      named={linkCoal[k] ?? null}
                      game={planGame}
                      label={t('game.main.buildCoal')}
                      onPick={(key) => {
                        setLinkCoal(k, key);
                        if (key) flyToRegion(key.split(':')[0]);
                      }}
                    />
                  ) : null,
                )}
                <span className="max-w-[210px] font-sans text-[9.5px] leading-snug text-ink-900/55">{t('game.main.coalHint')}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* the beer of a double rail: the player's breweries anywhere, or
              another's the second link connects to — the reader names one */}
          <AnimatePresence>
            {verb === 'network' && canPlan && linkPick && secondLinkPick && actor >= 0 && (
              <motion.div
                key="link-beer"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex shrink-0 flex-col gap-1.5 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.hand.linkBeer')}</span>
                {(() => {
                  const sources = beerSources(planGame, actor, linkPick.link, secondLinkPick.link);
                  return (
                    <label className="flex items-center gap-1.5 whitespace-nowrap font-sans text-[10px] text-ink-900/80" title={t('game.hand.linkBeerHint')}>
                      <img src={INDUSTRY_ICON.brewery} alt="" className="h-3.5 w-3.5" />
                      <span className="text-ink-900/45">←</span>
                      <select
                        value={linkBeer ?? ''}
                        onChange={(e) => {
                          setLinkBeer(e.target.value || null);
                          if (e.target.value) flyToRegion(e.target.value.split(':')[0]);
                        }}
                        aria-label={t('game.hand.linkBeer')}
                        className="max-w-[200px] rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
                      >
                        <option value="">{t('game.hand.beerAuto')}</option>
                        {sources.map((src) => (
                          <option key={src.key} value={src.key}>
                            {t('game.hand.devIronWorks', { owner: planGame.players[src.owner].name, town: TOWN_BY_ID[src.town]?.name ?? src.town, cubes: src.cubes })}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })()}
                <span className="font-sans text-[9.5px] leading-snug text-ink-900/55">{t('game.hand.linkBeerHint')}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* the sales: each picked tile goes to a merchant the reader names
              among those that take it and are connected, and drinks the beer
              they name — the merchant's barrel brings its bonus */}
          <AnimatePresence>
            {verb === 'sell' && canPlan && sellPicks.length > 0 && actor >= 0 && (
              <motion.div
                key="sell-choices"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                /* the strip takes the room the verbs leave and no more: at a
                   narrow table its rows wrap, the beer under the merchant,
                   rather than run past the dock's edge */
                className="paper flex max-h-[132px] min-w-0 flex-col gap-1.5 self-center overflow-y-auto rounded-md px-3 py-2"
              >
                {(() => {
                  const all = sellTargets(planGame, actor);
                  return sellPicks.map((pick) => {
                    const key = tileKey(pick.town, pick.slot);
                    const buyers = all.filter((x) => tileKey(x.town, x.slot) === key && x.valid);
                    const need = INDUSTRIES[pick.tile.industry][pick.tile.level - 1].beerToSell;
                    const sources = saleBeerSources(planGame, actor, pick.town, pick.merchant, pick.tile.industry);
                    const named = sellBeer[key] ?? [];
                    return (
                      <div key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[10px] text-ink-900/80">
                        <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">
                          {tileMark(tr(`game.log.industry.${pick.tile.industry}`), pick.tile.level)} · {TOWN_BY_ID[pick.town]?.name ?? pick.town}
                        </span>
                        <span className="text-ink-900/45">→</span>
                        <select
                          value={pick.merchant}
                          onChange={(e) => setSellMerchant(key, e.target.value)}
                          aria-label={t('game.hand.sellTo')}
                          title={t('game.hand.sellTo')}
                          className="rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
                        >
                          {buyers.map((b) => (
                            <option key={b.merchant} value={b.merchant}>
                              {MERCHANT_BY_ID[b.merchant].name} · {t('board.merchant.bonusIs', { bonus: MERCHANT_BY_ID[b.merchant].bonusLabel })}
                            </option>
                          ))}
                        </select>
                        {Array.from({ length: need }, (_, k) => (
                          <label key={k} className="flex items-center gap-1" title={t('game.hand.sellBeerHint')}>
                            <img src={INDUSTRY_ICON.brewery} alt="" className="h-3.5 w-3.5" />
                            <select
                              value={named[k] ?? ''}
                              onChange={(e) => setSellBeer(key, k, e.target.value || null)}
                              aria-label={t('game.hand.linkBeer')}
                              className="min-w-0 max-w-[240px] rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
                            >
                              <option value="">{t('game.hand.beerDefault')}</option>
                              {sources.map((src) =>
                                src.kind === 'merchant' ? (
                                  <option key="merchant" value="merchant">
                                    {t('game.hand.beerMerchant', { name: MERCHANT_BY_ID[pick.merchant].name })}
                                  </option>
                                ) : (
                                  <option key={src.key} value={src.key}>
                                    {t('game.hand.devIronWorks', { owner: planGame.players[src.owner!].name, town: TOWN_BY_ID[src.town!]?.name ?? src.town, cubes: src.cubes })}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        ))}
                      </div>
                    );
                  });
                })()}
                <span className="font-sans text-[9.5px] leading-snug text-ink-900/55">{t('game.hand.sellBeerHint')}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* develop drawer strip */}
          <AnimatePresence>
            {verb === 'develop' && canPlan && (
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                className="paper flex max-h-[164px] shrink-0 items-center gap-2 self-center rounded-md px-3 py-2"
              >
                <span className="font-fell text-[11px] uppercase tracking-wider text-ink-900/70">{t('game.hand.retire')}</span>
                {/* one tile per industry, painted as on the board: the one on
                    top of the stack, its level stamped, the one beneath named
                    under it, and how many of them this action retires — six
                    tiles on two rows of three, whatever room the fan leaves */}
                <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                  {devOptions.map((d) => {
                    const count = developPick.filter((x) => x === d.industry).length;
                    const stack = game.players[game.current].stacks[d.industry];
                    const next = stack[1];
                    const nextOk = next !== undefined && !INDUSTRIES[d.industry][next - 1].noDevelop;
                    const canAdd = developPick.length < 2 && (count === 0 ? d.valid : nextOk);
                    const usable = d.valid || count > 0;
                    return (
                      <div key={d.industry} className="flex flex-col items-center gap-1" title={d.reason ? reasonText(d.reason) : t(`game.industry.${d.industry}`)}>
                        <button
                          type="button"
                          disabled={!canAdd}
                          onClick={() => addDevelop(d.industry)}
                          aria-label={`${t(`game.industry.${d.industry}`)} ${levelMark(d.level)} — ${t('game.hand.devMore')}`}
                          className={cn(
                            'relative h-[44px] w-[44px] overflow-hidden rounded-md border-2 shadow-[0_2px_4px_rgba(0,0,0,.35)] transition-transform',
                            count ? 'border-rust-500 ring-2 ring-rust-500/40' : d.valid ? 'border-brass-700/70 hover:-translate-y-0.5 hover:border-brass-500' : 'border-brass-700/30',
                            !usable && 'opacity-40 grayscale-[.6]',
                            !canAdd && 'cursor-not-allowed',
                          )}
                          style={{ backgroundColor: INDUSTRY_COLOR[d.industry] }}
                        >
                          <img src={industryFaceUrl(d.industry, boardOpts.tileArt)} alt="" className="h-full w-full object-contain p-0.5" draggable={false} />
                          {/* the level, stamped top-left as on the board */}
                          <span className="absolute left-[3px] top-[3px] rounded-[3px] bg-ink-900/75 px-1 font-fell text-[10px] font-bold leading-[14px] text-cream-100">{roman(d.level)}</span>
                          {count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rust-500 px-1.5 font-sans text-[9px] font-bold leading-[14px] text-cream-100">×{count}</span>}
                        </button>
                        <span className="flex items-center gap-1 font-sans text-[9.5px] leading-none text-ink-900/60">
                          <button type="button" disabled={!count} onClick={() => dropDevelop(d.industry)} aria-label={t('game.hand.devLess')} title={t('game.hand.devLess')} className="rounded-sm border border-brass-700/50 px-1 leading-[12px] hover:bg-brass-500/20 disabled:cursor-not-allowed disabled:opacity-30">−</button>
                          <span>{next !== undefined ? t('game.hand.devNext', { level: next }) : t('game.hand.devDone')}</span>
                          <button type="button" disabled={!canAdd} onClick={() => addDevelop(d.industry)} aria-label={t('game.hand.devMore')} title={t('game.hand.devMore')} className="rounded-sm border border-brass-700/50 px-1 leading-[12px] hover:bg-brass-500/20 disabled:cursor-not-allowed disabled:opacity-30">+</button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* the iron each retirement takes: any works on the board that
                    holds some, whoever's, or the market */}
                {developPick.length > 0 && (
                  <div className="flex max-h-[148px] flex-col gap-1 overflow-y-auto border-l border-brass-700/40 pl-2">
                    {developPick.map((ind, k) => {
                      const depth = developPick.slice(0, k).filter((x) => x === ind).length;
                      const level = game.players[game.current].stacks[ind][depth];
                      const sources = ironSources(game);
                      const plan = developPlans(game, developIron)[k];
                      const marketCost = plan?.sources[0]?.kind === 'market' ? plan.sources[0].cost : marketBuyPrice('iron', game.market.iron);
                      return (
                        <label key={k} className="flex items-center gap-1.5 whitespace-nowrap font-sans text-[10px] text-ink-900/80" title={t('game.hand.devIron', { name: t(`game.industry.${ind}`), level })}>
                          <img src={INDUSTRY_ICON[ind]} alt="" className="h-3.5 w-3.5" />
                          <span className="font-semibold">{levelMark(level)}</span>
                          <span className="text-ink-900/45">←</span>
                          <select
                            value={developIron[k] ?? ''}
                            onChange={(e) => {
                              setDevelopIron(k, e.target.value || null);
                              /* the works picked: the camera glides to it */
                              if (e.target.value && e.target.value !== 'market') flyToRegion(e.target.value.split(':')[0]);
                            }}
                            className="rounded-sm border border-brass-700/60 bg-cream-100 px-1 py-0.5 font-sans text-[10px] text-ink-900"
                          >
                            <option value="">{t('game.hand.devIronAuto')}</option>
                            {sources.map((src) => (
                              <option key={src.key} value={src.key}>
                                {t('game.hand.devIronWorks', { owner: game.players[src.owner].name, town: TOWN_BY_ID[src.town]?.name ?? src.town, cubes: src.cubes })}
                              </option>
                            ))}
                            {/* the exchange only once the board has no cube left for this one */}
                            {sources.reduce((a, src) => a + src.cubes, 0) <= k && <option value="market">{t('game.hand.devIronMarket', { cost: marketCost })}</option>}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* the fan — centred while it fits, scrollable from the FIRST card
              once it overflows (a centred flex row would clip its left edge) */}
          <div ref={fanRef} className="relative flex min-w-0 flex-1 items-end overflow-x-auto pb-0.5" style={{ scrollSnapType: 'x proximity' }}>
            {/* the strip already names who is at the table; the fan only
                speaks when there is nothing to show */}
            {!isHumanTurn && !shown && (
              <p className="m-auto font-fell text-sm italic text-brass-500/60">
                {game.phase === 'action' ? t('game.hand.handsHidden') : t('game.hand.eraTurns')}
              </p>
            )}
            {shown && (
              /* the siding the cards part into under the pointer, laid half
                 on each side, so the fan at rest sits in the middle of it */
              <div className="mx-auto flex items-end" style={{ paddingLeft: FAN_PAD + Math.floor(siding / 2), paddingRight: Math.ceil(siding / 2) }}>
              {shown.hand.map((card, i) => (
                <div
                  key={card.id}
                  /* a flex box, so the card sits on the fan's floor with no
                     line's descent under it: the room goes over the cards */
                  className={cn('relative flex transition-transform duration-150 ease-out motion-reduce:transition-none', hoverCard === i && 'z-20')}
                  style={{
                    scrollSnapAlign: 'center',
                    marginLeft: i === 0 ? 0 : fan.step,
                    /* the card under the pointer comes forward, and the fan
                       parts at its right edge by exactly the overlap: half of
                       it to each side, the last card needing no parting */
                    transform: parting ? `translateX(${i <= (hoverCard ?? -1) ? -Math.floor(-fan.step / 2) : Math.ceil(-fan.step / 2)}px)` : undefined,
                  }}
                  onPointerEnter={() => setHoverCard(i)}
                  onPointerLeave={() => setHoverCard((h) => (h === i ? null : h))}
                >
                  <GameCard
                    card={card}
                    index={i}
                    width={fan.card}
                    selected={canPlan && selectedCardId === card.id}
                    scoutMarked={canPlan && scoutPick.includes(card.id)}
                    disabled={!canPlan || usedByQueue.has(card.id)}
                    canBuild={canPlan && buildable.has(card.id)}
                    reduced={reduced}
                    onPick={selectCard}
                    onFly={flyCard}
                  />
                </div>
              ))}
              </div>
            )}
          </div>

          {/* right status / hints */}
          <div className={cn('w-[190px] flex-col justify-center gap-1.5 border-l border-brass-700/40 pl-3', hintsShown ? 'flex' : 'hidden')}>
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

/* the dock re-renders on its own subscriptions, not on every render of the page */
export default memo(HandDock);
