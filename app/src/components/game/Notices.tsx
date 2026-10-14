import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, BookOpen, ChevronDown, Hourglass, MapPin, Newspaper, X } from 'lucide-react';
import { INDUSTRY_ICON, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { ledgerParts } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import type { Era, GameState, IndustryType, LedgerEntry } from '@/game/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { GazettePaper } from './Gazette';
import { lastRound } from './handFan';
import { MAX_SHOWN, enqueue, fileWhere, filedOf, ordered, shownOf, useGazetteDesk } from './noticeQueue';
import type { Incoming, Notice } from './noticeQueue';
import { ShapeChip } from './TownInspector';
import { useHudInsets } from './useHudInsets';
import { useLayer } from './useLayer';
import { useReducedMotion } from './useReducedMotion';
import { useHudRects } from './useHudRects';
import type { HudRect } from './useHudRects';

/* ------------------------------------------------------------------ */
/* What happened that the reader should not miss, written in one small */
/* book down the right of the board, under the exchange's pill, clear  */
/* of the banner, the hand, the minimap and the players.                */
/*                                                                      */
/* The book is one slim plaque, not a stack of cards: a line of brass   */
/* at its head says how many notices are open, and under it the notices */
/* are ruled like the entries of a register. What touches the reader   */
/* stands first; three are open at most, the rest wait behind a "+n".  */
/* Nothing leaves on a clock: a notice stays until the reader files it  */
/* (its cross, or "file all"), or until a newer one of its kind makes it */
/* stale. Filed is not lost: the book's head opens every page kept,     */
/* the open ones and the filed ones, the round's paper among them.      */
/* With nothing open the book folds to a single brass stud.             */
/* The reader's income rising floats up the middle of the board.        */
/* ------------------------------------------------------------------ */

const FLOAT_MS = 2200;
/** the others' turns lasted this long, or the page was put away: the
 *  reader's turn is said when it comes back */
const TURN_WAIT_MS = 20_000;
/** the book's width: its own, never what a neighbour leaves over */
const WIDTH_MIN = 260;
const WIDTH_MAX = 320;
const GAP = 12;
/** the head's height and a notice's, give or take: how many the column
 *  has room for */
const HEAD_H = 34;
const ROW_H = 54;
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
  /** how many open notices the column has room for */
  room: number;
  /** the tallest the opened book may stand */
  tall: number;
}

/** where the book stands: along the right edge, stepped left of whatever
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
  let width = Math.round(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, vw * 0.22)));
  if (o.rail) width = Math.max(WIDTH_MIN, Math.min(width, vw - right - o.rail.right - GAP));
  const left = vw - right - width;
  let top = insets.top + 8;
  /* the rail counts too: on a narrow table (a tablet held upright) its
     medallions run along the top, and the book then hangs under them */
  for (const r of [o.topbar, o.pill, o.rail]) if (r && overlapsX(r, left, vw - right)) top = Math.max(top, r.bottom + 10);
  let floor = vh - insets.bottom;
  for (const r of [o.minimap, o.dock]) if (r && r.top > top && overlapsX(r, left, vw - right)) floor = Math.min(floor, r.top - 10);
  const room = Math.max(1, Math.min(MAX_SHOWN, Math.floor((floor - top - HEAD_H) / ROW_H)));
  return { top, right, width, room, tall: Math.max(HEAD_H + ROW_H, floor - top) };
}

/** the notice's mark: the industry's glyph, or the kind's own, with the
 *  seat's shape in its colour set at its foot */
function Mark({ note, color }: { note: Notice; color: string | null }) {
  const industry = note.industry && note.industry in INDUSTRY_ICON ? (note.industry as IndustryType) : null;
  let inner: ReactNode;
  if (industry) {
    const url = `url(${INDUSTRY_ICON[industry]})`;
    inner = (
      <span
        className="block h-[17px] w-[17px]"
        style={{ WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', backgroundColor: note.kind === 'beer' ? '#E08A6A' : '#DDBE7E' }}
      />
    );
  } else {
    const Icon = note.kind === 'turn' ? BellRing : note.kind === 'pin' ? MapPin : note.kind === 'gazette' ? Newspaper : Hourglass;
    inner = <Icon className="h-4 w-4 text-brass-300" strokeWidth={1.75} />;
  }
  return (
    <span aria-hidden className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
      {inner}
      {color && (
        <span className="absolute -bottom-1 -right-1.5 flex">
          <ShapeChip color={color} size={9} vivid />
        </span>
      )}
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
  /* the whole book open, filed pages and all */
  const [leafing, setLeafing] = useState(false);
  /* the paper unfolded under its notice */
  const [unfolded, setUnfolded] = useState<string | null>(null);
  const [seen, setSeen] = useState<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; n: number }[]>([]);
  const [incomeSeen, setIncomeSeen] = useState<number | null>(null);
  const ledger = game?.ledger;
  const players = game?.players;
  const me = seat ?? (players ? players.findIndex((p) => !p.isBot) : -1);
  const myIncome = me >= 0 && players ? incomeLevel(players[me].income) : null;
  const closeBook = useCallback(() => setLeafing(false), []);
  const book = useLayer<HTMLElement>(leafing, closeBook);

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
  const file = useCallback((id: string) => setNotes((n) => fileWhere(n, (x) => x.id === id)), []);
  const fileKind = useCallback((kind: Notice['kind']) => setNotes((n) => fileWhere(n, (x) => x.kind === kind)), []);
  const fileAll = useCallback(() => setNotes((n) => fileWhere(n, () => true)), []);

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
        const when = { round: e.round, era: e.era };
        /* the reader has played: the word that it was their turn is spent */
        if (who === me && MOVES.has(e.verb)) fileKind('turn');
        if (e.key === 'flip') {
          /* the works in the title, the owner and the reason under it */
          const { head } = ledgerParts(e, t);
          const why = t(`game.flip.why.${String(e.vars?.why ?? 'empties')}`, { merchant: String(e.vars?.merchant ?? '') });
          items.push({ id: `f${e.id}`, kind: 'flip', rank: who === me ? 2 : 1, owner: who, industry: String(e.vars?.industry ?? ''), title: t('game.flip.title', { what: head }), detail: t('game.flip.detail', { name: players[who].name, why, income: Number(e.vars?.income ?? 0) }), ...when });
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
            ...when,
          });
        }
        /* a pinned town: whatever another player does there is reported */
        if (who !== me && e.region && pins[e.region] !== undefined && (e.key === 'build' || e.key === 'sell' || e.key === 'network' || e.key === 'flip')) {
          const { head, detail } = ledgerParts(e, t);
          items.push({ id: `p${e.id}`, kind: 'pin', rank: 1, owner: who, industry: e.vars?.industry ? String(e.vars.industry) : undefined, title: t('game.notice.pinned', { town: TOWN_BY_ID[e.region]?.name ?? e.region }), detail: `${head}${detail ? ' · ' + detail : ''}`, ...when });
        }
        if (e.key === 'sell' && who !== me && typeof e.vars?.beerFrom === 'string' && e.vars.beerFrom) {
          for (const bit of String(e.vars.beerFrom).split(',')) {
            const [owner, town] = bit.split(':');
            if (Number(owner) !== me) continue;
            items.push({ id: `b${e.id}:${town}`, kind: 'beer', rank: 2, owner: who, industry: 'brewery', title: t('game.notice.beerTaken', { name: players[who].name, town: TOWN_BY_ID[town]?.name ?? town }), detail: ledgerParts(e, t).head, ...when });
          }
        }
      }
      post(items);
    }, 0);
    return () => window.clearTimeout(add);
  }, [ledger, players, seen, me, t, pins, post, fileKind]);

  /* the era's last round: said once, as it begins or as the table opens
     on it, and filed once the era is over, when it has nothing left to say */
  const eraEnds = !!game && game.phase === 'action' && lastRound({ ...game, era: 'rail' });
  const gameEnds = !!game && eraEnds && lastRound(game);
  const era = game?.era;
  const round = game?.round;
  const eraSaid = useRef<string | null>(null);
  useEffect(() => {
    if (!eraEnds || !era) {
      const id = window.setTimeout(() => fileKind('lastRound'), 0);
      return () => window.clearTimeout(id);
    }
    if (eraSaid.current === era) return;
    const id = window.setTimeout(() => {
      eraSaid.current = era;
      post([{ id: `e${era}`, kind: 'lastRound', rank: 2, title: t(gameEnds ? 'game.notice.lastGame' : 'game.notice.lastCanal'), detail: t(gameEnds ? 'game.notice.lastGameDetail' : 'game.notice.lastCanalDetail'), round, era }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [eraEnds, gameEnds, era, round, post, fileKind, t]);

  /* the reader's turn, after a long wait or with the page put away: said
     with what the others played meanwhile, and filed at the reader's move */
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
      const id = window.setTimeout(() => fileKind('turn'), 0);
      return () => window.clearTimeout(id);
    }
    const was = away.current;
    if (!was) return;
    const id = window.setTimeout(() => {
      away.current = null;
      if (!was.hidden && Date.now() - was.since < TURN_WAIT_MS) return;
      const moves = new Set(ledger.filter((e) => e.id >= was.from && e.player !== undefined && e.player !== me && MOVES.has(e.verb)).map((e) => e.at ?? e.id)).size;
      if (moves) post([{ id: `t${was.from}`, kind: 'turn', rank: 2, owner: me, title: t('game.notice.turn'), detail: t('game.notice.turnDetail', { n: moves }), round, era }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [current, phase, turnWatch, me, ledger, round, era, post, fileKind, t]);

  /* the round's paper, handed over by the Gazette: laid in once (the next
     issue files the last), and filed if the reader turns the paper off */
  const paperSaid = useRef<string | null>(null);
  useEffect(() => {
    if (issue && paperSaid.current === issue.id) return;
    const id = window.setTimeout(() => {
      paperSaid.current = issue?.id ?? null;
      if (!issue) {
        fileKind('gazette');
        return;
      }
      const say = issue.lines[0];
      const lead = say ? t(`game.gazette.${say.key}`, { ...say.vars, goods: say.vars.goods ? t(`game.log.industry.${say.vars.goods}`) : '' }) : t('game.gazette.aria', { round: issue.round });
      post([{ id: `g${issue.id}`, kind: 'gazette', rank: 0, title: t('game.gazette.title'), detail: lead, gazette: issue, round: issue.round, era: issue.era }]);
    }, 0);
    return () => window.clearTimeout(id);
  }, [issue, post, fileKind, t]);

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

  if (!game) return null;
  const open = ordered(notes);
  const { shown, waiting } = shownOf(notes, place.room);
  const filed = leafing ? filedOf(notes) : [];
  const colour = (g: GameState, at?: number): string | null => (at === undefined ? null : (g.players[at]?.color ?? null));
  const eraName = (e: Era) => t(`game.topbar.${e === 'canal' ? 'eraCanal' : 'eraRail'}`);

  /* one ruled entry of the book: open (with its cross) or filed (dimmed,
     with the round it was said in) */
  const entry = (n: Notice, isFiled: boolean) => {
    const paper = n.kind === 'gazette' && n.gazette ? n.gazette : null;
    const unfold = paper && unfolded === n.id;
    return (
      <motion.li
        key={n.id}
        layout={still ? false : 'position'}
        initial={still ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.16, ease: EASE } }}
        transition={{ duration: 0.22, ease: EASE }}
        className={cn('relative border-t border-brass-700/30 first:border-t-0', isFiled && 'opacity-60')}
      >
        {/* what touches the reader carries a brass tick down its edge */}
        {n.rank === 2 && !isFiled && <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full" style={{ background: n.kind === 'beer' ? '#C05B3C' : '#DDBE7E' }} />}
        <div className="flex items-start gap-2.5 py-2 pl-3 pr-8">
          <Mark note={n} color={colour(game, n.owner)} />
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className={cn('font-fell text-[13.5px] leading-snug tracking-wide [text-wrap:balance]', n.kind === 'beer' ? 'text-rust-400' : 'text-cream-100')}>
              {cap(n.title)}
              {n.count > 1 && <span className="ml-1.5 font-mono text-[10.5px] text-brass-400/80">×{n.count}</span>}
            </span>
            <span className="font-sans text-[11.5px] leading-snug text-cream-100/60 [text-wrap:pretty]">{cap(n.detail)}</span>
            {isFiled && n.round !== undefined && n.era && <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cream-100/40">{t('game.gazette.issue', { round: n.round, era: eraName(n.era) })}</span>}
            {paper && (
              <button
                type="button"
                onClick={() => setUnfolded(unfold ? null : n.id)}
                aria-expanded={!!unfold}
                className="mt-1 inline-flex items-center gap-1 self-start rounded-sm font-sans text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brass-400 hover:text-brass-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brass-400"
              >
                {t(unfold ? 'game.notice.foldPaper' : 'game.notice.readPaper')}
                <ChevronDown aria-hidden className={cn('h-3 w-3 transition-transform', unfold && 'rotate-180')} />
              </button>
            )}
          </span>
        </div>
        {unfold && paper && (
          <div className="px-3 pb-3">
            <GazettePaper issue={paper} />
          </div>
        )}
        {!isFiled && (
          <button
            type="button"
            onClick={() => file(n.id)}
            aria-label={t('game.notice.file')}
            title={t('game.notice.file')}
            className="absolute right-1 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-cream-100/35 transition-colors hover:bg-cream-100/5 hover:text-brass-300 focus-visible:text-brass-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </motion.li>
    );
  };

  const hasPages = notes.length > 0;
  const folded = !leafing && open.length === 0;
  const list = leafing ? open : shown;

  return (
    <>
      {hasPages && (
        <motion.section
          ref={book}
          tabIndex={-1}
          aria-label={t('game.notice.region')}
          className="pointer-events-none fixed z-[82] flex flex-col items-end outline-none"
          initial={false}
          animate={{ top: place.top, right: place.right }}
          transition={still ? { duration: 0 } : { duration: 0.24, ease: EASE }}
          style={{ width: place.width }}
        >
          {folded ? (
            /* nothing open: the book is a stud of brass, the pages kept inside */
            <button
              type="button"
              onClick={() => setLeafing(true)}
              aria-label={t('game.notice.book')}
              aria-expanded={false}
              title={t('game.notice.book')}
              className="plaque pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-brass-400/80 transition-colors hover:text-brass-300"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : (
            <div className="plaque pointer-events-auto flex w-full flex-col overflow-hidden rounded-lg" style={{ maxHeight: leafing ? place.tall : undefined }}>
              {/* the head: how many are open, file them all, open the book */}
              <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-brass-700/45 pl-3 pr-1.5">
                <BellRing aria-hidden className="h-3.5 w-3.5 text-brass-400" strokeWidth={1.75} />
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-brass-400">{t(leafing ? 'game.notice.book' : 'game.notice.heading')}</span>
                {open.length > 0 && (
                  <span className="font-mono text-[11px] tabular-nums text-cream-100/70" aria-label={t('game.notice.openAria', { n: open.length })}>
                    {open.length}
                  </span>
                )}
                <span className="flex-1" />
                {open.length > 1 && (
                  <button type="button" onClick={fileAll} className="rounded-sm px-1.5 py-1 font-sans text-[10.5px] font-medium text-cream-100/55 transition-colors hover:text-brass-300 focus-visible:text-brass-300">
                    {t('game.notice.fileAll')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLeafing((v) => !v)}
                  aria-label={t('game.notice.book')}
                  aria-expanded={leafing}
                  title={t('game.notice.book')}
                  className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-cream-100/5 hover:text-brass-300', leafing ? 'text-brass-300' : 'text-cream-100/50')}
                >
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className={cn('min-h-0', leafing && 'overflow-y-auto overscroll-contain')}>
                <ul className="flex flex-col">
                  <AnimatePresence initial={false}>{list.map((n) => entry(n, false))}</AnimatePresence>
                </ul>
                {!leafing && waiting > 0 && (
                  <button
                    type="button"
                    onClick={() => setLeafing(true)}
                    aria-label={t('game.notice.moreAria', { n: waiting })}
                    className="flex w-full items-center justify-center border-t border-brass-700/30 py-1.5 font-mono text-[11px] text-brass-400 transition-colors hover:bg-cream-100/5 hover:text-brass-300"
                  >
                    {t('game.notice.more', { n: waiting })}
                  </button>
                )}
                {leafing && (
                  <>
                    {open.length === 0 && <p className="px-3 py-2.5 font-fell text-[13px] italic text-cream-100/55">{t('game.notice.empty')}</p>}
                    {filed.length > 0 && (
                      <>
                        <p className="border-t border-brass-700/45 px-3 pb-1 pt-2 font-sans text-[9.5px] font-semibold uppercase tracking-[0.24em] text-cream-100/40">{t('game.notice.filed')}</p>
                        <ul className="flex flex-col">{filed.map((n) => entry(n, true))}</ul>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </motion.section>
      )}
      {/* the screen reader hears each arrival once, never the book again */}
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
