import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { buildTargets, candleMinutes, developOptions, eraRounds, linkTargets, sellTargets } from '@/game/engine';
import { ledgerParts } from '@/game/ledgerText';
import { cardLabel, confirmCost, confirmSummary, projectQueued, useGame, verbsForCard, useShownGame } from '@/game/store';
import { WhyLink } from './RulesOverlay';
import type { GameState, Verb } from '@/game/types';
import { money, reasonText, useT } from '@/i18n';
import { aidOn, useBoardOptions } from './boardOptions';
import { drawText, moveHead, planDraws, saleText, type Draw, type DrawPicks, type DrawResource, type DrawSale } from './draws';
import { stripRoom } from './stripRoom';
import { useHudInsets } from './useHudInsets';
import { PortraitMedallion } from './PlayerRail';
import Tooltip from './Tooltip';
import BarTip from './BarTip';
import { cn } from '@/lib/utils';

/**
 * The turn strip, top centre, one line of 36px: the era and the round,
 * who plays and what is being done, and on the reader's own turn the
 * price and the button that settles it. The sentence gives way before
 * anything else grows. On someone else's turn it says what they last
 * did. The candle burns as a bar along the bottom edge.
 * Always fully opaque — game status must never look faded.
 */
const VERB_LABEL: Record<Verb, string> = {
  build: 'game.hand.verbBuild',
  network: 'game.hand.verbNetwork',
  develop: 'game.hand.verbDevelop',
  sell: 'game.hand.verbSell',
  loan: 'game.hand.verbLoan',
  scout: 'game.hand.verbScout',
  pass: 'game.hand.verbPass',
};

/** the free band between the player rail and the market, measured from
 *  the elements themselves so the banner never rides over either; on a
 *  narrow table the rail lies under the banner, which starts at the HUD's
 *  inset (beside the income track when it runs down the left edge) */
function useBand(marketOpen: boolean, players: number, inset: number): { left: number; right: number } {
  const [band, setBand] = useState({ left: inset, right: 12 });
  useLayoutEffect(() => {
    const rail = document.querySelector('[data-player-rail]');
    const measure = () => {
      const narrow = window.innerWidth < 1024;
      const left = rail && !narrow ? Math.round(rail.getBoundingClientRect().right) + 12 : inset;
      /* the quotation strip is always there; the tray opens under the
         banner's rows, so the band never changes with it */
      const pill = document.querySelector('[data-market-pill]')?.getBoundingClientRect();
      const edge = Math.round(document.querySelector('[data-table]')?.getBoundingClientRect().right || window.innerWidth);
      const right = pill && pill.width > 0 ? Math.round(edge - pill.left) + 12 : 12;
      setBand((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    measure();
    /* once more when the market's slide is over */
    const later = window.setTimeout(measure, 450);
    const ro = new ResizeObserver(measure);
    if (rail) ro.observe(rail);
    for (const m of document.querySelectorAll('[data-market-pill]')) ro.observe(m);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(later);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [marketOpen, players, inset]);
  return band;
}

/** the candle: a bar along the banner's bottom edge that burns down by
 *  itself (one transform transition to the end, not a step a second), the
 *  figures for the last twenty seconds only. Nothing above it re-renders
 *  for the time passing. */
export type CandleProp = { end: number } | { left: number } | null;
function Candle({ candle, total }: { candle: CandleProp; total: number }) {
  const t = useT();
  const bar = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const end = candle && 'end' in candle ? candle.end : null;
  const still = candle && 'left' in candle ? candle.left : null;
  /* the bar: set where it stands, then let it run to nothing over what is left */
  useEffect(() => {
    const el = bar.current;
    if (!el || total <= 0) return;
    const left = end !== null ? Math.max(0, end - Date.now()) : (still ?? 0);
    const frac = Math.max(0, Math.min(1, left / (total * 1000)));
    el.style.transition = 'none';
    el.style.transform = `scaleX(${frac})`;
    if (end === null) return;
    /* a frame later, one linear run down to the end */
    const raf = requestAnimationFrame(() => {
      el.getBoundingClientRect();
      el.style.transition = `transform ${left}ms linear`;
      el.style.transform = 'scaleX(0)';
    });
    return () => cancelAnimationFrame(raf);
  }, [end, still, total]);
  /* the figures: a clock that only starts for the last twenty seconds */
  useEffect(() => {
    if (end === null) return;
    let iv = 0;
    const start = window.setTimeout(() => {
      setNow(Date.now());
      iv = window.setInterval(() => setNow(Date.now()), 250);
    }, Math.max(0, end - Date.now() - 20_500));
    return () => {
      window.clearTimeout(start);
      if (iv) window.clearInterval(iv);
    };
  }, [end]);
  if (!candle || total <= 0) return null;
  const leftMs = end !== null ? Math.max(0, end - now) : (still ?? 0);
  const seconds = Math.ceil(leftMs / 1000);
  const low = end !== null && leftMs < 20_000;
  return (
    <>
      {low && (
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center border-l border-brass-700/40 px-3">
          <span className="animate-pulse rounded-sm border border-rust-500 px-2 py-1 font-mono text-xs font-semibold text-rust-500 brightness-150" aria-label={t('game.topbar.secondsLeft', { seconds })}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-coal-950" aria-label={t('game.topbar.secondsLeft', { seconds })}>
        <span ref={bar} className={cn('block h-full origin-left rounded-r-full', low ? 'animate-pulse bg-rust-500' : 'bg-brass-400')} style={{ transform: 'scaleX(1)' }} />
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The era, laid as a length of line: one sleeper a round, the ones     */
/* run over filled with brass, the one underfoot lit. At the canal the  */
/* sleepers are lock gates across a cut of water with the towpath       */
/* above; at the rail, sleepers under a pair of rails. No words: the    */
/* era and the round are said to the ear and in the tooltip.            */
/* ------------------------------------------------------------------ */

const STEP = 7;
const EDGE = 3;
const LIT = { filter: 'drop-shadow(0 0 2px rgba(242,234,214,.85))' };

function EraTrack({ era, round, total }: { era: 'canal' | 'rail'; round: number; total: number }) {
  const w = EDGE * 2 + total * STEP;
  const at = (i: number) => EDGE + i * STEP + STEP / 2;
  const now = Math.min(total, Math.max(1, round)) - 1;
  /* the line run over so far ends at the middle of the current sleeper */
  const run = at(now);
  const state = (i: number) => (i < now ? 'past' : i === now ? 'now' : 'next');
  if (era === 'canal') {
    return (
      <svg width={w} height={20} viewBox={`0 0 ${w} 20`} aria-hidden className="block overflow-visible">
        {/* the towpath, a trodden dotted line above the cut */}
        <line x1={0} x2={w} y1={3.5} y2={3.5} className="stroke-brass-700/70" strokeWidth={0.8} strokeDasharray="1.2 1.6" />
        {/* the water: filled up to the lock the boat stands at */}
        <rect x={0} y={7} width={w} height={8} className="fill-player-steel/15" />
        <rect x={0} y={7} width={run} height={8} className="fill-player-steel/60" />
        <line x1={0} x2={run} y1={8.6} y2={8.6} className="stroke-cream-100/25" strokeWidth={0.6} />
        <line x1={0} x2={w} y1={7} y2={7} className="stroke-cream-100/30" strokeWidth={0.8} />
        <line x1={0} x2={w} y1={15} y2={15} className="stroke-cream-100/30" strokeWidth={0.8} />
        {Array.from({ length: total }, (_, i) => {
          const s = state(i);
          return (
            <rect
              key={i}
              x={at(i) - 1}
              y={5.5}
              width={2}
              height={11}
              rx={0.4}
              className={s === 'past' ? 'fill-brass-400' : s === 'now' ? 'fill-cream-100' : 'fill-transparent stroke-brass-700/80'}
              strokeWidth={s === 'next' ? 0.8 : 0}
              style={s === 'now' ? LIT : undefined}
            />
          );
        })}
      </svg>
    );
  }
  return (
    <svg width={w} height={20} viewBox={`0 0 ${w} 20`} aria-hidden className="block overflow-visible">
      {Array.from({ length: total }, (_, i) => {
        const s = state(i);
        return (
          <rect
            key={i}
            x={at(i) - 1.2}
            y={3.5}
            width={2.4}
            height={13}
            rx={0.4}
            className={s === 'past' ? 'fill-brass-400' : s === 'now' ? 'fill-cream-100' : 'fill-transparent stroke-brass-700/80'}
            strokeWidth={s === 'next' ? 0.8 : 0}
            style={s === 'now' ? LIT : undefined}
          />
        );
      })}
      {/* the two rails, laid over the sleepers: polished where the train has run */}
      {[7.5, 12.5].map((y) => (
        <g key={y}>
          <line x1={0} x2={w} y1={y} y2={y} className="stroke-cream-100/30" strokeWidth={1} />
          <line x1={0} x2={run} y1={y} y2={y} className="stroke-brass-300" strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The waybill tokens: what the move draws, one stamped token a siding, */
/* the resource's own glyph cut out of the plate and the figure beside  */
/* it, tinted by where it comes from — the seat's colour for a works    */
/* (filled when it is the reader's own), pewter for the exchange,       */
/* copper for a merchant's barrel.                                      */
/* ------------------------------------------------------------------ */

const GLYPH: Record<DrawResource, string> = { coal: '/icon-coal.svg', iron: '/icon-iron.svg', beer: '/beer-barrel.png' };

function ResourceGlyph({ resource }: { resource: DrawResource }) {
  const url = `url(${GLYPH[resource]})`;
  return (
    <span
      aria-hidden
      className="block h-3 w-3 shrink-0 bg-current"
      style={{ maskImage: url, WebkitMaskImage: url, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }}
    />
  );
}

/* the seats' inks, spelt out whole so the stylesheet keeps every one */
const SEAT_INK: Record<string, { own: string; rival: string }> = {
  brass: { own: 'text-player-brass border-player-brass/70 bg-player-brass/15', rival: 'text-player-brass border-player-brass/45' },
  oxblood: { own: 'text-player-oxblood border-player-oxblood/75 bg-player-oxblood/20', rival: 'text-player-oxblood border-player-oxblood/50' },
  verdigris: { own: 'text-player-verdigris border-player-verdigris/75 bg-player-verdigris/20', rival: 'text-player-verdigris border-player-verdigris/50' },
  steel: { own: 'text-player-steel border-player-steel/75 bg-player-steel/20', rival: 'text-player-steel border-player-steel/50' },
};

function tokenInk(d: Draw | DrawSale, game: GameState): string {
  if (!('source' in d)) return 'text-cream-100/80 border-cream-100/25';
  if (d.source === 'market') return 'text-cream-100/80 border-cream-100/25';
  if (d.source === 'merchant') return 'text-rust-400 border-rust-400/55';
  const seat = d.owner === undefined ? undefined : game.players[d.owner]?.color;
  const ink = SEAT_INK[seat ?? 'brass'] ?? SEAT_INK.brass;
  return d.source === 'own' ? ink.own : ink.rival;
}

function WaybillTokens({ draws, sale, game, box }: { draws: Draw[]; sale: DrawSale | null; game: GameState; box?: Ref<HTMLSpanElement> }) {
  const t = useT();
  const parts = [...draws.map((d) => drawText(d, game, t)), ...(sale ? [saleText(sale, t)] : [])];
  if (!parts.length) return null;
  const tokens: { key: string; resource: DrawResource; n: string; ink: string }[] = [
    ...draws.map((d, i) => ({ key: `d${i}`, resource: d.resource, n: String(d.n), ink: tokenInk(d, game) })),
    ...(sale ? [{ key: 'sale', resource: sale.resource, n: `→${sale.n}`, ink: tokenInk(sale, game) }] : []),
  ];
  const whole = parts.join(', ');
  return (
    <span ref={box} role="group" aria-label={t('game.bandeau.group', { list: whole })} className="flex shrink-0 items-center gap-[3px]">
      {tokens.map((tok, k) => (
        <Tooltip
          key={tok.key}
          side="bottom"
          title={t('game.bandeau.title')}
          content={parts.map((p, i) => (
            <span key={i} className={i === k ? 'text-brass-300' : 'text-cream-100/70'}>
              {p}
              {i < parts.length - 1 ? ', ' : ''}
            </span>
          ))}
        >
          <span
            tabIndex={0}
            aria-label={parts[k]}
            className={cn(
              'inline-flex h-[18px] items-center gap-[3px] rounded-[3px] border bg-coal-950/55 pl-[3px] pr-[4px] font-mono text-[11px] font-semibold leading-none',
              'shadow-[inset_0_1px_1.5px_rgba(0,0,0,.6),0_1px_0_rgba(242,234,214,.07)] outline-none focus-visible:ring-1 focus-visible:ring-brass-400',
              tok.ink,
            )}
          >
            <ResourceGlyph resource={tok.resource} />
            {tok.n}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* What the settled line has room for once the works, the town and the  */
/* tokens are set: the tile's price first, then the verb's chip. Taken  */
/* with the rule, not guessed from the width of the window — a short    */
/* town leaves room at 1024 px that a long line through three does not. */
/* An item left out is kept in the forme, out of the flow and unseen,   */
/* so its width can still be read.                                      */
/* ------------------------------------------------------------------ */

const OUT_OF_FLOW = 'pointer-events-none invisible absolute';

/* The house buttons lift 2px on hover and drop a shadow below them: on a
   36px strip that clips its overflow, the lift runs into the top edge and
   the shadow is cut at the bottom one. Here they answer in place: the
   ledger's wash, the strike's sheen and a touch of light, all inside.
   The keyboard's ring, drawn 2px off a 32px button, was cut the same way:
   here it hugs the button and ends on the strip's inner edge. */
const IN_STRIP = 'hover:!transform-none active:!transform-none focus-visible:!outline-offset-0';
const STRIKE_IN_STRIP =
  '!shadow-[inset_0_1px_0_rgba(242,234,214,.55),inset_0_-1px_0_rgba(0,0,0,.3)] hover:brightness-110 active:brightness-95';

interface RoomRefs {
  status: RefObject<HTMLSpanElement | null>;
  what: RefObject<HTMLSpanElement | null>;
  price: RefObject<HTMLSpanElement | null>;
  chip: RefObject<HTMLSpanElement | null>;
  tokens: RefObject<HTMLSpanElement | null>;
}

function useRoom({ status, what, price, chip, tokens }: RoomRefs) {
  const [room, setRoom] = useState({ price: true, verb: true });
  /* after every render of the strip, since the words may have changed,
     and whenever the band is reset: the window, the rail, the market */
  const watched = useRef<{ el: HTMLElement; ro: ResizeObserver } | null>(null);
  const shown = useRef(room);
  useLayoutEffect(() => {
    shown.current = room;
    const measure = () => {
      const st = status.current;
      const wh = what.current;
      if (!st || !wh) return;
      const width = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().width : 0);
      const { price: p, verb: v } = stripRoom({
        line: st.clientWidth,
        what: width(wh),
        tokens: tokens.current ? width(tokens.current) + 6 : 0,
        price: width(price.current),
        chip: chip.current ? width(chip.current) + 8 : 0,
        chipShown: shown.current.verb,
      });
      if (p !== shown.current.price || v !== shown.current.verb) setRoom({ price: p, verb: v });
    };
    measure();
    const el = status.current;
    if (watched.current?.el !== el) {
      watched.current?.ro.disconnect();
      watched.current = null;
      if (el) {
        const ro = new ResizeObserver(() => measure());
        ro.observe(el);
        watched.current = { el, ro };
        void document.fonts?.ready.then(() => measure());
      }
    }
  });
  useEffect(() => () => watched.current?.ro.disconnect(), []);
  return room;
}

function GameTopBar({ candle, marketOpen }: { candle: CandleProp; marketOpen: boolean }) {
  const t = useT();
  const statusRef = useRef<HTMLSpanElement>(null);
  const whatRef = useRef<HTMLSpanElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const tokensRef = useRef<HTMLSpanElement>(null);
  const room = useRoom({ status: statusRef, what: whatRef, price: priceRef, chip: chipRef, tokens: tokensRef });
  const game = useShownGame();
  const botHold = useGame((s) => s.botHold);
  const insets = useHudInsets();
  const band = useBand(marketOpen, game?.players.length ?? 0, insets.left);
  const mine = useGame((s) => s.planActor() >= 0);
  const planActor = useGame((s) => s.planActor());
  const preparing = useGame((s) => s.preparing);
  const queued = useGame((s) => s.queued);
  /* the table the hints count on: with moves prepared, the one they leave */
  const planGame = useMemo(() => (game && preparing && queued.length && planActor >= 0 ? projectQueued(game, planActor, queued) : game), [game, preparing, queued, planActor]);
  const code = useGame((s) => s.code);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const developPick = useGame((s) => s.developPick);
  const developIron = useGame((s) => s.developIron);
  const buildIron = useGame((s) => s.buildIron);
  const buildCoal = useGame((s) => s.buildCoal);
  const linkCoal = useGame((s) => s.linkCoal);
  const linkBeer = useGame((s) => s.linkBeer);
  const sellBeer = useGame((s) => s.sellBeer);
  const scoutPick = useGame((s) => s.scoutPick);
  const setVerb = useGame((s) => s.setVerb);
  const confirm = useGame((s) => s.confirm);
  const cancel = useGame((s) => s.cancel);
  const { beginnerAid } = useBoardOptions();
  if (!game) return null;
  /* the banner speaks for the seat the plan is made for: the one to act,
     or mine while a move is prepared out of turn */
  const me = planActor >= 0 ? planActor : game.current;
  const p = game.players[me];
  const color = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const total = eraRounds(game.players.length);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;
  const done = maxActions - game.actionsLeft;
  /* the beginner's aid: the table's house rule online, the reader's own setting at home */
  const aid = aidOn(game.assist, code !== null) || (code === null && beginnerAid);

  const card = selectedCardId ? p.hand.find((c) => c.id === selectedCardId) : undefined;
  const summaryFull = mine ? confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, developIron, scoutPick, selectedCardId }) : null;
  /* the verb chip already says it: the summary starts after the verb */
  const summary = summaryFull && verb && summaryFull.startsWith(`${t(VERB_LABEL[verb])} · `) ? summaryFull.slice(t(VERB_LABEL[verb]).length + 3) : summaryFull;
  /* the plan the move will run: the mines, works and breweries the reader
     named, on the table the prepared moves leave */
  const gp = planGame ?? game;
  const picks: DrawPicks = { verb, selectedCardId, buildPick, buildIron, buildCoal, linkPick, secondLinkPick, linkBeer, linkCoal, sellPicks, sellBeer, developPick, developIron };
  const cost = summary ? confirmCost({ verb, buildPick, buildIron, buildCoal, linkPick, secondLinkPick, linkBeer, linkCoal, developPick, developIron }, gp, me) : null;
  /* what the banner asks of the reader, in one line */
  const stage = !mine ? 'theirs' : summary ? 'ready' : verb ? 'target' : card ? 'verb' : 'card';
  /* once ready: the works and the place in words, what it draws as tokens */
  const head = stage === 'ready' ? moveHead(gp, me, picks, t) : null;
  const waybill = head ? planDraws(gp, me, picks) : null;

  /* someone else's turn: what they last did, from the ledger */
  const theirLast = !mine ? [...game.ledger].reverse().find((e) => e.player === me && e.verb !== 'system' && e.verb !== 'score') : undefined;
  const lastWhat = theirLast ? ledgerParts(theirLast, t).head : null;

  let line: string;
  /* what blocks the verb, when nothing takes it: the dictionary's own
     sentence, which names the cause and the way round it — on a line of
     its own under the strip, whole, never cut after its first words */
  let blocked: string | null = null;
  let blockedWhy: string | undefined;
  if (stage === 'theirs') {
    line = game.phase !== 'action' ? t(game.phase === 'game-over' ? 'game.topbar.over' : 'game.topbar.between') : p.isBot ? t(botHold ? 'game.topbar.waitsRead' : 'game.topbar.thinks', { name: p.name }) : t('game.topbar.plays', { name: p.name });
  } else if (stage === 'ready') {
    line = preparing ? t('game.topbar.hint.prepared') : t('game.topbar.hint.ready');
  } else if (stage === 'target') {
    line = t(`game.topbar.hint.${verb}`);
    if (card && (verb === 'build' || verb === 'network' || verb === 'sell' || verb === 'develop')) {
      const n =
        verb === 'build'
          ? buildTargets(gp, me, card).filter((x) => x.valid).length
          : verb === 'network'
            ? linkTargets(gp, me).filter((x) => x.valid).length
            : verb === 'sell'
              ? sellTargets(gp, me).filter((x) => x.valid).length
              : developOptions(gp, me).filter((x) => x.valid).length;
      /* nothing takes the verb: name what blocks it — the hand let the
         reader pick it so the answer lands here, not in a tooltip */
      if (n === 0) {
        const why = verbsForCard({ game: planGame ?? game, selectedCardId, actor: me }).find((v) => v.verb === verb)?.reason;
        /* the verb is on its chip and the card on the strip: the line
           under them says only why, and what would open the way */
        blocked = reasonText(why);
        blockedWhy = why;
        if (aid) blocked += ` — ${t(`game.topbar.aid.none.${verb}`)}`;
      } else if (aid) {
        /* the beginner's aid counts the choices */
        line = `${line} · ${t('game.topbar.aid.count', { n })}`;
      }
    }
  } else if (stage === 'verb') {
    line = t('game.topbar.hint.pickVerb', { card: card ? cardLabel(card) : '' });
  } else {
    line = preparing ? t('game.topbar.hint.preparing') : done === 1 && maxActions === 2 ? t('game.topbar.hint.second') : t('game.topbar.hint.pickCard');
  }

  /* the beginner's aid: coal bought at the market while a mine on the board
     still holds coal — a link to it would have made the coal free */
  let aidNote: string | null = null;
  if (aid && stage === 'ready') {
    const plan = verb === 'build' ? buildPick?.coalPlan : verb === 'network' ? linkPick?.coalPlan : undefined;
    const where = verb === 'build' ? buildPick?.town : verb === 'network' ? linkPick?.link.a : undefined;
    if (plan && where && plan.sources.some((s) => s.kind === 'market')) {
      const pit = Object.entries(game.tiles).find(([, tile]) => tile.industry === 'coal' && !tile.flipped && tile.cubes > 0);
      if (pit) aidNote = t('game.topbar.aid.coalMarket', { town: TOWN_BY_ID[where]?.name ?? where, mine: TOWN_BY_ID[pit[0].split(':')[0]]?.name ?? '' });
    }
  }

  /* the candle: a bar along the bottom edge, the figure only at the end */
  const candleTotal = (candleMinutes(game, me) ?? 0) * 60;
  /* the exchange's tray hangs at the right edge, 320px wide: the banner,
     centred in its band, stays narrow enough never to run under it */
  const trayLeft = typeof window === 'undefined' ? 9999 : window.innerWidth - 12 - 320;
  const mid = typeof window === 'undefined' ? 0 : (band.left + (window.innerWidth - band.right)) / 2;
  /* the tray hangs below the strip itself: only a second row (a refusal,
     the beginner's note) could run into it, so a single strip takes the
     whole band */
  const maxW = marketOpen && (blocked || aidNote) ? Math.max(520, Math.min(920, 2 * (trayLeft - 8 - mid))) : 920;
  /* the sentence, with the word that matters set apart: the card in hand
     while a place is looked for, the player while they play */
  const sentence = (() => {
    if (stage === 'theirs') {
      const rest = game.phase !== 'action' ? t(game.phase === 'game-over' ? 'game.topbar.over' : 'game.topbar.between') : p.isBot ? t('game.topbar.thinksRest') : t('game.topbar.playsRest');
      return (
        <>
          <b className="font-semibold" style={{ color }}>{game.phase !== 'action' ? '' : p.name}</b>
          {game.phase !== 'action' ? rest : ` ${rest}`}
          {/* a finished game has no last move to report: the register says the rest */}
          {lastWhat && game.phase !== 'game-over' && <span className="text-cream-100/60"> · {lastWhat}</span>}
        </>
      );
    }
    if (stage === 'target' && card) {
      return (
        <>
          <b className="font-semibold text-brass-400">{cardLabel(card)}</b>
          {!blocked && <span className="text-cream-100/85"> · {line}</span>}
        </>
      );
    }
    return <span className={stage === 'card' ? 'text-cream-100/70' : 'text-cream-100/90'}>{line}</span>;
  })();
  /* a turn spends cards: the actions as card stubs, played, in hand, to come */
  const stubs = Array.from({ length: maxActions }, (_, i) => (i < done ? 'played' : i === done ? 'current' : 'next') as 'played' | 'current' | 'next');
  const theirs = !mine;
  const eraTitle = t('game.topbar.eraRoundTitle', { era: game.era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail'), round: game.round, total });
  /* at the confirm, the portrait and the stubs step aside on a narrow
     table: the line is the move, its tokens and its price */
  const settle = mine && stage === 'ready';
  /* a move that costs nothing (a sale, a scout, a pass) prints no price */
  const priced = cost && cost.total > 0 ? cost : null;
  return (
    <div className="pointer-events-none fixed z-[64] flex justify-center" style={{ left: band.left, right: band.right, top: insets.top }}>
      <motion.div
        data-topbar
        key={mine ? 'mine' : 'theirs'}
        initial={{ y: -6, opacity: 0.4 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={cn('pointer-events-auto relative plaque flex flex-col overflow-hidden rounded-md', mine ? 'w-full' : 'max-w-full')}
        style={mine ? { maxWidth: maxW } : undefined}
      >
        {/* one strip, 36px: the era and the round, who plays and what is
            being done, and on the reader's turn the price and the button.
            Nothing grows; the sentence gives way. */}
        <div className="flex h-9 items-stretch">
          <Tooltip side="bottom" title={eraTitle} content={game.era === 'canal' ? t('game.topbar.canalTip') : t('game.topbar.railTip')}>
            <span tabIndex={0} role="img" aria-label={eraTitle} className="flex h-full items-center border-r border-brass-700/40 px-2 outline-none focus-visible:bg-brass-400/10">
              <EraTrack era={game.era} round={game.round} total={total} />
            </span>
          </Tooltip>

          {/* the fixed cluster is clipped before it can ride over the summary */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2">
            {/* the medallion is a flex box of its own, not an inline block on
                a line of text: sat on the baseline it rode 3.5px high. Its
                ring stands 3.5px outside the box, so the box keeps that much
                clear on either hand. Unlit here: the strip already says whose
                turn it is, and a glow would be cut by the strip's edge. */}
            <span className={cn('flex shrink-0 items-center pl-1 pr-0.5', settle && 'max-[1279px]:hidden')}>
              <PortraitMedallion p={p} index={me} active={false} size={22} />
            </span>
            {mine && (
              <span className={cn('flex shrink-0 items-center gap-1', settle && 'max-[1279px]:hidden')} aria-label={t('game.topbar.actionOf', { n: Math.min(maxActions, done + 1), max: maxActions })}>
                {stubs.map((st, i) => (
                  /* the stub in hand is lit, not swollen: nothing on the strip grows */
                  <span
                    key={i}
                    title={t(`game.topbar.stub.${st}`)}
                    className={cn('block h-4 w-[11px] overflow-hidden rounded-[2px] border', st === 'played' ? 'border-brass-400 bg-brass-400' : st === 'current' ? 'border-brass-400 shadow-[0_0_5px_rgba(221,190,126,.7)]' : 'border-brass-700/60')}
                  >
                    {st !== 'played' && <img src="/card-back.webp" alt="" className={cn('h-full w-full object-cover', st === 'next' && 'opacity-40')} />}
                  </span>
                ))}
              </span>
            )}
            {mine && verb && (
              <span
                ref={head ? chipRef : undefined}
                aria-hidden={head && !room.verb ? true : undefined}
                className={cn(
                  'shrink-0 rounded-sm border border-brass-700/70 px-1.5 py-px font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brass-400',
                  /* settled, the chip stays while the line has room for it */
                  head ? (room.verb ? 'inline' : OUT_OF_FLOW) : 'hidden min-[1180px]:inline',
                )}
              >
                {t(VERB_LABEL[verb])}
              </span>
            )}
            {head && waybill ? (
              /* the move, whole: the works and the place, the tile's price
                 when the line has room, then its tokens — no ellipsis; the
                 words give way only on a line too narrow for anything */
              <span ref={statusRef} role="status" className="flex min-w-0 flex-1 items-center gap-1.5" title={head.full ?? summaryFull ?? undefined}>
                <span className="min-w-0 truncate whitespace-nowrap font-fell text-[12.5px] leading-none text-cream-100/90 min-[1280px]:text-[13px]">
                  <span ref={whatRef}>{head.what}</span>
                  {head.price !== null && (
                    <span ref={priceRef} aria-hidden={room.price ? undefined : true} className={cn('whitespace-pre text-cream-100/60', room.price ? 'inline' : OUT_OF_FLOW)}>
                      {' · '}
                      <span className="font-mono text-[11px]">{money(head.price)}</span>
                    </span>
                  )}
                </span>
                <WaybillTokens box={tokensRef} draws={waybill.draws} sale={waybill.sale} game={gp} />
              </span>
            ) : (
              <span role="status" className={cn('min-w-0 flex-1 truncate font-fell text-[13px] leading-none', theirs && 'text-cream-100/85')} title={summaryFull ?? undefined}>
                {mine && summary ? <span className="text-cream-100/90">{summary}</span> : sentence}
              </span>
            )}
          </div>

          {mine && (
            <div className="flex shrink-0 items-center gap-1.5 pr-1.5">
              {stage === 'verb' && (
                <BarTip tip={t('game.topbar.passTip')}>
                  <button type="button" onClick={() => setVerb('pass')} className={cn('btn-ledger !min-h-[32px] !px-2.5 !py-0.5 text-[11px]', IN_STRIP)}>
                    {t('game.topbar.pass')}
                  </button>
                </BarTip>
              )}
              {/* on a narrow table the cancel is a struck cross; Esc says the same.
                  A disabled button lets the pointer through to the strip: it
                  has nothing to answer, and a disabled control swallows the
                  pointer's leaving, which would hold the neighbour's hint open */}
              <BarTip tip={t('game.topbar.cancel')} keys="Esc" off={stage === 'card' && !preparing}>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={stage === 'card' && !preparing}
                  aria-label={t('game.topbar.cancel')}
                  aria-keyshortcuts="Escape"
                  className={cn(
                    'btn-ledger !min-h-[32px] !py-0.5 text-[11px] disabled:pointer-events-none disabled:opacity-40',
                    IN_STRIP,
                    settle ? '!px-0 max-[1279px]:!w-8 min-[1280px]:!px-2.5' : '!px-2.5',
                  )}
                >
                  <X aria-hidden className={cn('h-3.5 w-3.5', settle ? 'min-[1280px]:hidden' : 'hidden')} />
                  <span className={settle ? 'max-[1279px]:hidden' : undefined}>{t('game.topbar.cancel')}</span>
                </button>
              </BarTip>
              {/* the strike carries the price it settles: the whole sum, cubes
                  bought included, and what the purse keeps */}
              {/* the strike already reads its word and its key: the slip
                  speaks only when there is a price to account for */}
              <BarTip tip={t('game.bandeau.priceTip')} keys="↵" off={stage !== 'ready' || !priced}>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={stage !== 'ready'}
                  aria-keyshortcuts="Enter"
                  className={cn(
                    'btn-strike !min-h-[32px] !px-2.5 !py-0 text-[11px] disabled:pointer-events-none disabled:opacity-40',
                    IN_STRIP,
                    STRIKE_IN_STRIP,
                    priced && '!flex-col !gap-0 leading-none',
                  )}
                >
                  <span className="whitespace-nowrap">
                    {t(preparing ? 'game.topbar.prepare' : 'game.topbar.confirm')}
                    <kbd className={cn('ml-1 font-mono text-[10px] opacity-75', priced && 'max-[1279px]:hidden')}>↵</kbd>
                  </span>
                  {priced && (
                    <motion.span
                      key={`${priced.total}:${priced.after}`}
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className={cn('mt-[3px] whitespace-nowrap font-mono text-[9px] font-semibold normal-case tracking-normal', priced.after < 0 ? 'text-rust-700' : 'text-ink-900/80')}
                    >
                      {money(priced.total)}
                      <span className="font-normal opacity-70"> · {t('game.bandeau.left', { sum: money(priced.after) })}</span>
                    </motion.span>
                  )}
                </button>
              </BarTip>
            </div>
          )}
        </div>
        {blocked && (
          <p role="status" className="border-t border-brass-700/30 px-3 py-1 font-sans text-[12px] leading-snug text-cream-100/90">
            {blocked}
            {' '}<WhyLink reason={blockedWhy} verb={verb} />
          </p>
        )}
        {aidNote && <p className="truncate border-t border-brass-700/30 px-3 py-0.5 font-sans text-[11px] text-brass-400/85" title={aidNote}>{aidNote}</p>}
        {/* the candle burns along the bottom edge, by itself */}
        <Candle candle={candle} total={candleTotal} />
      </motion.div>
    </div>
  );
}

/* the banner re-renders on its own subscriptions, not on every render of the page */
export default memo(GameTopBar);
