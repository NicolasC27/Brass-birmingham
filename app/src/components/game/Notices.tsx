import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { BellRing, Hourglass, MapPin, X } from 'lucide-react';
import { INDUSTRY_ICON, PLAYER_COLORS, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { ledgerParts } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import type { GameState, IndustryType, LedgerEntry } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { GazettePaper } from './Gazette';
import { lastRound } from './handFan';
import { MAX_SHOWN, enqueue, shownOf, useGazetteDesk } from './noticeQueue';
import type { Incoming, Notice } from './noticeQueue';
import { useHudInsets } from './useHudInsets';
import { useReducedMotion } from './useReducedMotion';
import { useHudRects } from './useHudRects';
import type { HudRect } from './useHudRects';

/* ------------------------------------------------------------------ */
/* What happened that the reader should not miss, said in one place:   */
/* a single pile down the right of the board, under the exchange's      */
/* pill, clear of the banner, the hand, the minimap and the players.    */
/* The pile has a width of its own and keeps it whatever the rail on    */
/* the left is doing. What touches the reader stands first; three are   */
/* shown at most, the rest wait behind a "+n". Each stays as long as it */
/* takes to read, holds still under the pointer, and goes with its      */
/* cross or a flick to the right. The reader's income rising floats up  */
/* the middle of the board for a moment.                                */
/* ------------------------------------------------------------------ */

const FLOAT_MS = 2200;
/** the others' turns lasted this long, or the page was put away: the
 *  reader's turn is said when it comes back */
const TURN_WAIT_MS = 20_000;
const TURN_LIFE_MS = 7000;
const ERA_LIFE_MS = 14_000;
const GAZETTE_LIFE_MS = 11_000;
/** the pile's width: its own, never what a neighbour leaves over */
const WIDTH_MIN = 240;
const WIDTH_MAX = 360;
const GAP = 12;
/** a notice's height, give or take: how many the column has room for */
const ROW_H = 72;
/** a flick to the right this far, or this fast, puts a notice away */
const FLICK_PX = 80;
const FLICK_SPEED = 450;
const EASE = [0.22, 0.8, 0.3, 1] as const;
/** the verbs that are a move at the table, not the table's own business */
const MOVES = new Set<LedgerEntry['verb']>(['build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass']);

/** the window's measure, followed as it is resized */
function subscribeViewport(fn: () => void): () => void {
  window.addEventListener('resize', fn);
  return () => window.removeEventListener('resize', fn);
}
const viewportKey = (): string => `${window.innerWidth}x${window.innerHeight}`;
function useViewport(): { vw: number; vh: number } {
  const key = useSyncExternalStore(subscribeViewport, viewportKey, () => '1280x800');
  const [vw, vh] = key.split('x').map(Number);
  return { vw, vh };
}

/** the page put away (another tab, a minimised window) */
function subscribeHidden(fn: () => void): () => void {
  document.addEventListener('visibilitychange', fn);
  return () => document.removeEventListener('visibilitychange', fn);
}
const useHidden = (): boolean => useSyncExternalStore(subscribeHidden, () => document.hidden, () => false);

/** a line opened with a capital, whatever the template started with */
const cap = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

const overlapsX = (r: HudRect, left: number, right: number): boolean => r.right > left && r.left < right;

interface Place {
  top: number;
  right: number;
  width: number;
  /** how many notices the column has room for */
  room: number;
}

/** where the pile stands: along the right edge, stepped left of whatever
 *  holds that edge (the guide, the exchange or the ledger when open),
 *  under the banner and the exchange's pill, above the hand and the
 *  minimap, and never over the players on the left */
function placePile(o: {
  vw: number;
  vh: number;
  insets: { top: number; right: number; bottom: number };
  topbar: HudRect | null;
  pill: HudRect | null;
  market: HudRect | null;
  guide: HudRect | null;
  ledger: HudRect | null;
  minimap: HudRect | null;
  dock: HudRect | null;
  rail: HudRect | null;
}): Place {
  const { vw, vh, insets } = o;
  let right = insets.right;
  const edge = (left: number) => {
    right = Math.max(right, vw - left + GAP);
  };
  if (o.guide && o.guide.width > 0) edge(o.guide.left);
  if (o.market) edge(o.market.left);
  /* the ledger slides in from the right: its width is read, not its
     place, which is still on its way while it arrives */
  if (o.ledger) edge(vw - (insets.right - GAP) - o.ledger.width);
  let width = Math.round(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, vw * 0.28)));
  if (o.rail) width = Math.max(WIDTH_MIN, Math.min(width, vw - right - o.rail.right - GAP));
  const left = vw - right - width;
  let top = insets.top + 8;
  /* the rail counts too: on a narrow table (a tablet held upright) its
     medallions run along the top, and the pile then hangs under them */
  for (const r of [o.topbar, o.pill, o.rail]) if (r && overlapsX(r, left, vw - right)) top = Math.max(top, r.bottom + 10);
  let floor = vh - insets.bottom;
  for (const r of [o.minimap, o.dock]) if (r && r.top > top && overlapsX(r, left, vw - right)) floor = Math.min(floor, r.top - 10);
  const room = Math.max(1, Math.min(MAX_SHOWN, Math.floor((floor - top + 8) / ROW_H)));
  return { top, right, width, room };
}

/** the industry's glyph in a roundel ringed with the seat's colour */
function Glyph({ note, ring }: { note: Notice; ring: string }) {
  const industry = note.industry && note.industry in INDUSTRY_ICON ? (note.industry as IndustryType) : null;
  let inner: ReactNode;
  if (industry) {
    const url = `url(${INDUSTRY_ICON[industry]})`;
    inner = (
      <span
        className="block h-[18px] w-[18px]"
        style={{ WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', backgroundColor: '#F2EAD6' }}
      />
    );
  } else {
    const Icon = note.kind === 'turn' ? BellRing : note.kind === 'pin' ? MapPin : Hourglass;
    inner = <Icon className="h-4 w-4 text-brass-400" />;
  }
  return (
    <span aria-hidden className="mt-px flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-coal-950/70" style={{ boxShadow: `0 0 0 1.5px ${ring}, inset 0 1px 0 rgba(242,234,214,.08)` }}>
      {inner}
    </span>
  );
}

function Notices() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const code = useGame((s) => s.code);
  const pins = useGame((s) => s.pins);
  const issue = useGazetteDesk((s) => s.issue);
  const insets = useHudInsets();
  const { vw, vh } = useViewport();
  const hidden = useHidden();
  const still = useReducedMotion();
  const ledgerSel = `aside[aria-label="${typeof CSS !== 'undefined' ? CSS.escape(t('game.page.ledgerDrawerAria')) : ''}"]`;
  const [topbar, pill, market, guide, ledgerBox, minimap, dock, rail] = useHudRects(['[data-topbar]', '[data-market-pill]', '[data-market]', '[data-guide]', ledgerSel, '[data-minimap]', '[data-dock]', '[data-player-rail]']);
  const place = placePile({ vw, vh, insets, topbar, pill, market, guide, ledger: ledgerBox, minimap, dock, rail });

  const [notes, setNotes] = useState<Notice[]>([]);
  const seq = useRef(0);
  /* the last words given to the screen reader: said once, not on a loop */
  const [said, setSaid] = useState('');
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; n: number }[]>([]);
  const [incomeSeen, setIncomeSeen] = useState<number | null>(null);
  const ledger = game?.ledger;
  const players = game?.players;
  const me = seat ?? (players ? players.findIndex((p) => !p.isBot) : -1);
  const myIncome = me >= 0 && players ? incomeLevel(players[me].income) : null;

  const post = useCallback((items: Incoming[]) => {
    if (!items.length) return;
    setNotes((n) => {
      const next = enqueue(n, items, seq.current);
      seq.current = next.seq;
      return next.notes;
    });
    const lead = items.reduce((a, b) => (b.rank > a.rank ? b : a));
    setSaid(`${cap(lead.title)}. ${cap(lead.detail)}`);
  }, []);
  /* a notice put away under the pointer: the pile is no longer held by
     it (the element goes without a pointerleave) */
  const dismiss = useCallback((id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    setHeld(false);
  }, []);
  const dismissKind = useCallback((kind: Notice['kind']) => setNotes((n) => (n.some((x) => x.kind === kind) ? n.filter((x) => x.kind !== kind) : n)), []);

  /* the ledger, read from where the reader last was */
  useEffect(() => {
    if (!ledger || !players) return;
    if (seen === null) {
      const mark = window.setTimeout(() => setSeen(ledger.length ? ledger[ledger.length - 1].id + 1 : 0), 0);
      return () => window.clearTimeout(mark);
    }
    const last = ledger.length ? ledger[ledger.length - 1].id + 1 : seen;
    if (last === seen) return;
    const fresh = ledger.filter((e) => e.id >= seen && e.player !== undefined);
    const add = window.setTimeout(() => {
      setSeen(last);
      const items: Incoming[] = [];
      const myName = me >= 0 ? players[me]?.name : undefined;
      for (const e of fresh) {
        const who = e.player!;
        /* the reader has played: the word that it was their turn is spent */
        if (who === me && MOVES.has(e.verb)) dismissKind('turn');
        if (e.key === 'flip') {
          /* the works in the title, the owner and the reason under it */
          const { head } = ledgerParts(e, t);
          const why = t(`game.flip.why.${String(e.vars?.why ?? 'empties')}`, { merchant: String(e.vars?.merchant ?? '') });
          items.push({ id: `f${e.id}`, kind: 'flip', rank: who === me ? 2 : 1, owner: who, industry: String(e.vars?.industry ?? ''), title: t('game.flip.title', { what: head }), detail: t('game.flip.detail', { name: players[who].name, why, income: Number(e.vars?.income ?? 0) }) });
        }
        /* one of the reader's works built over by another seat */
        if (e.key === 'build' && who !== me && myName && e.vars?.overName === myName) {
          items.push({
            id: `o${e.id}`,
            kind: 'overbuilt',
            rank: 2,
            owner: who,
            industry: String(e.vars?.industry ?? ''),
            title: t('game.notice.overbuilt', { name: players[who].name }),
            detail: t('game.notice.overbuiltDetail', { industry: t(`game.log.industry.${String(e.vars?.industry ?? 'coal')}`), level: Number(e.vars?.overLevel ?? 0), town: String(e.vars?.town ?? '') }),
          });
        }
        /* a pinned town: whatever another player does there is reported */
        if (who !== me && e.region && pins[e.region] !== undefined && (e.key === 'build' || e.key === 'sell' || e.key === 'network' || e.key === 'flip')) {
          const { head, detail } = ledgerParts(e, t);
          items.push({ id: `p${e.id}`, kind: 'pin', rank: 1, owner: who, industry: e.vars?.industry ? String(e.vars.industry) : undefined, title: t('game.notice.pinned', { town: TOWN_BY_ID[e.region]?.name ?? e.region }), detail: `${head}${detail ? ' · ' + detail : ''}` });
        }
        if (e.key === 'sell' && who !== me && typeof e.vars?.beerFrom === 'string' && e.vars.beerFrom) {
          for (const bit of String(e.vars.beerFrom).split(',')) {
            const [owner, town] = bit.split(':');
            if (Number(owner) !== me) continue;
            items.push({ id: `b${e.id}:${town}`, kind: 'beer', rank: 2, owner: who, industry: 'brewery', title: t('game.notice.beerTaken', { name: players[who].name, town: TOWN_BY_ID[town]?.name ?? town }), detail: ledgerParts(e, t).head });
          }
        }
      }
      post(items);
    }, 0);
    return () => window.clearTimeout(add);
  }, [ledger, players, seen, me, t, pins, post, dismissKind]);

  /* the era's last round: said once, as it begins or as the table opens on it */
  const eraEnds = !!game && game.phase === 'action' && lastRound({ ...game, era: 'rail' });
  const gameEnds = !!game && eraEnds && lastRound(game);
  const era = game?.era;
  const eraSaid = useRef<string | null>(null);
  useEffect(() => {
    if (!eraEnds || !era || eraSaid.current === era) return;
    const id = window.setTimeout(() => {
      eraSaid.current = era;
      post([{ id: `e${era}`, kind: 'lastRound', rank: 2, title: t(gameEnds ? 'game.notice.lastGame' : 'game.notice.lastCanal'), detail: t(gameEnds ? 'game.notice.lastGameDetail' : 'game.notice.lastCanalDetail'), life: ERA_LIFE_MS }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [eraEnds, gameEnds, era, post, t]);

  /* the reader's turn, after a long wait or with the page put away: said
     with what the others played meanwhile, and gone at the reader's move */
  const humans = players ? players.filter((p) => !p.isBot).length : 0;
  const turnWatch = me >= 0 && !(code === null && humans > 1);
  const current = game?.current;
  const phase = game?.phase;
  const away = useRef<{ since: number; from: number; hidden: boolean } | null>(null);
  useEffect(() => {
    if (hidden && away.current) away.current.hidden = true;
  }, [hidden]);
  useEffect(() => {
    if (!turnWatch || current === undefined || !ledger) return;
    const mine = current === me && phase === 'action';
    if (!mine) {
      if (!away.current) away.current = { since: Date.now(), from: ledger.length ? ledger[ledger.length - 1].id + 1 : 0, hidden: document.hidden };
      const id = window.setTimeout(() => dismissKind('turn'), 0);
      return () => window.clearTimeout(id);
    }
    const was = away.current;
    if (!was) return;
    const id = window.setTimeout(() => {
      away.current = null;
      if (!was.hidden && Date.now() - was.since < TURN_WAIT_MS) return;
      const moves = new Set(ledger.filter((e) => e.id >= was.from && e.player !== undefined && e.player !== me && MOVES.has(e.verb)).map((e) => e.at ?? e.id)).size;
      if (moves) post([{ id: `t${was.from}`, kind: 'turn', rank: 2, owner: me, title: t('game.notice.turn'), detail: t('game.notice.turnDetail', { n: moves }), life: TURN_LIFE_MS }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [current, phase, turnWatch, me, ledger, post, dismissKind, t]);

  /* the round's paper, handed over by the Gazette: hung once, and taken
     down if the reader turns the paper off */
  const paperSaid = useRef<string | null>(null);
  useEffect(() => {
    if (issue && paperSaid.current === issue.id) return;
    const id = window.setTimeout(() => {
      paperSaid.current = issue?.id ?? null;
      if (!issue) {
        dismissKind('gazette');
        return;
      }
      post([{ id: `g${issue.id}`, kind: 'gazette', rank: 0, title: t('game.gazette.title'), detail: t('game.gazette.aria', { round: issue.round }), gazette: issue, life: GAZETTE_LIFE_MS }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [issue, post, dismissKind, t]);

  /* the reader's income climbing: a figure floats up the board */
  useEffect(() => {
    if (myIncome === null) return;
    if (incomeSeen === null) {
      const mark = window.setTimeout(() => setIncomeSeen(myIncome), 0);
      return () => window.clearTimeout(mark);
    }
    if (myIncome === incomeSeen) return;
    const go = window.setTimeout(() => {
      setIncomeSeen(myIncome);
      if (myIncome > incomeSeen) {
        const id = Date.now();
        setFloats((f) => [...f, { id, n: myIncome - incomeSeen }]);
        window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS);
      }
    }, 0);
    return () => window.clearTimeout(go);
  }, [myIncome, incomeSeen]);

  /* the clocks: one per notice on show, stopped (and what is left of it
     kept) while the pointer or the keyboard rests on the pile, while the
     page is put away, or while the notice waits behind the others */
  const clocks = useRef(new Map<string, { stamp: number; since: number; ms: number; timer: number }>());
  const left = useRef(new Map<string, number>());
  const paused = held || hidden;
  useEffect(() => {
    const running = clocks.current;
    const now = Date.now();
    const live = new Map(paused ? [] : shownOf(notes, place.room).shown.map((n) => [n.id, n] as const));
    for (const [id, c] of running) {
      const n = live.get(id);
      if (n && n.stamp === c.stamp) continue;
      window.clearTimeout(c.timer);
      running.delete(id);
      /* stopped, not refreshed: what was left is kept for later */
      if (!n) left.current.set(`${id}:${c.stamp}`, Math.max(600, c.ms - (now - c.since)));
    }
    for (const n of live.values()) {
      if (running.has(n.id)) continue;
      const ms = left.current.get(`${n.id}:${n.stamp}`) ?? n.life;
      running.set(n.id, { stamp: n.stamp, since: now, ms, timer: window.setTimeout(() => dismiss(n.id), ms) });
    }
    /* what is left of notices gone is forgotten */
    for (const key of left.current.keys()) if (!notes.some((n) => key.startsWith(`${n.id}:`))) left.current.delete(key);
  }, [notes, paused, place.room, dismiss]);
  useEffect(() => {
    const running = clocks.current;
    return () => {
      for (const c of running.values()) window.clearTimeout(c.timer);
      running.clear();
    };
  }, []);

  if (!game) return null;
  const { shown, waiting } = shownOf(notes, place.room);
  const flick = (id: string) => (_: unknown, info: PanInfo) => {
    if (info.offset.x > FLICK_PX || info.velocity.x > FLICK_SPEED) dismiss(id);
  };
  /* the flick: the notice follows the hand, or with motion reduced, only
     the gesture is read and the notice fades where it stands */
  const gesture = (id: string) =>
    still
      ? { onPanEnd: flick(id) }
      : { drag: 'x' as const, dragConstraints: { left: 0, right: 0 }, dragElastic: { left: 0.04, right: 0.7 }, dragSnapToOrigin: true, onDragEnd: flick(id) };
  const colour = (g: GameState, seatAt?: number) => (seatAt === undefined ? '#C9A45C' : (PLAYER_COLORS[g.players[seatAt]?.color]?.hex ?? '#C9A45C'));
  const card = (n: Notice) => {
    if (n.kind === 'gazette' && n.gazette) return <GazettePaper issue={n.gazette} onClose={() => dismiss(n.id)} />;
    const ring = colour(game, n.owner);
    const accent = n.kind === 'beer' ? '#C05B3C' : n.kind === 'lastRound' || n.kind === 'turn' ? '#DDBE7E' : ring;
    return (
      <div className={cn('plaque relative flex items-start gap-3 overflow-hidden rounded-lg py-2.5 pl-3.5 pr-8', n.rank === 2 && 'ring-1 ring-inset ring-brass-400/40')}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
        <Glyph note={n} ring={ring} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('font-fell text-[14.5px] leading-snug tracking-wide [text-wrap:balance]', n.kind === 'beer' ? 'text-rust-400' : 'text-cream-100')}>
            {cap(n.title)}
            {n.count > 1 && <span className="ml-1.5 inline-block rounded-sm bg-cream-100/10 px-1 align-[1px] font-mono text-[10.5px] leading-[15px] text-cream-100/70">×{n.count}</span>}
          </span>
          <span className="font-sans text-[11.5px] leading-snug text-cream-100/65 [text-wrap:pretty]">{cap(n.detail)}</span>
        </span>
        <button type="button" onClick={() => dismiss(n.id)} aria-label={t('game.notice.dismiss')} className="absolute right-1.5 top-1.5 rounded-full p-1 text-cream-100/45 transition-colors hover:text-brass-400 focus-visible:text-brass-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* one pile, one place: it glides when a sheet takes the edge */}
      <motion.section
        aria-label={t('game.notice.region')}
        className="pointer-events-none fixed z-[82] flex flex-col items-stretch gap-2"
        initial={false}
        animate={{ top: place.top, right: place.right }}
        transition={still ? { duration: 0 } : { duration: 0.24, ease: EASE }}
        style={{ width: place.width }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28, transition: { duration: 0.18, ease: EASE } }}
              transition={{ duration: 0.22, ease: EASE, layout: { duration: 0.22, ease: EASE } }}
              {...gesture(n.id)}
              onPointerEnter={() => setHeld(true)}
              onPointerLeave={() => setHeld(false)}
              onFocus={() => setHeld(true)}
              onBlur={() => setHeld(false)}
              className="pointer-events-auto touch-pan-y"
            >
              {card(n)}
            </motion.div>
          ))}
          {waiting > 0 && (
            <motion.div
              key="more"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: EASE, layout: { duration: 0.22, ease: EASE } }}
              className="self-end rounded-full border border-brass-700/60 bg-coal-950/85 px-2.5 py-0.5 font-mono text-[11px] text-brass-400 shadow-e3 backdrop-blur-md"
              role="note"
              aria-label={t('game.notice.moreAria', { n: waiting })}
            >
              {t('game.notice.more', { n: waiting })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
      {/* the screen reader hears each arrival once, never the pile again */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {said}
      </div>
      {/* income rising: the figure floats up the middle of the board */}
      <div className="pointer-events-none fixed left-1/2 top-[44%] z-[82] -translate-x-1/2">
        <AnimatePresence>
          {floats.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 24, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [24, -10, -40, -70], scale: [0.8, 1.15, 1.1, 1] }}
              transition={{ duration: FLOAT_MS / 1000, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
              className="font-fell text-[40px] tracking-wide text-bottle-600 brightness-150"
              style={{ textShadow: '0 2px 0 rgba(0,0,0,.8), 0 0 24px rgba(95,163,122,.55)' }}
            >
              {t('game.notice.income', { n: f.n })}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(Notices);
