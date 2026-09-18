import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrainFront, Waves } from 'lucide-react';
import { PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { buildTargets, candleMinutes, developOptions, eraRounds, linkTargets, sellTargets } from '@/game/engine';
import { ledgerParts } from '@/game/ledgerText';
import { cardLabel, confirmCost, confirmSummary, projectQueued, useGame, verbsForCard } from '@/game/store';
import type { Verb } from '@/game/types';
import { reasonText, useT } from '@/i18n';
import { aidOn, useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';
import { PortraitMedallion } from './PlayerRail';
import Tooltip from './Tooltip';
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
 *  the elements themselves so the banner never rides over either */
function useBand(marketOpen: boolean, players: number): { left: number; right: number } {
  const [band, setBand] = useState({ left: 12, right: 12 });
  useLayoutEffect(() => {
    const rail = document.querySelector('[data-player-rail]');
    const measure = () => {
      const narrow = window.innerWidth < 1024;
      const left = rail && !narrow ? Math.round(rail.getBoundingClientRect().right) + 12 : 12;
      /* the quotation strip is always there; the tray opens under the
         banner's rows, so the band never changes with it */
      const pill = document.querySelector('[data-market-pill]')?.getBoundingClientRect();
      const right = pill && pill.width > 0 ? Math.round(window.innerWidth - pill.left) + 12 : 12;
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
  }, [marketOpen, players]);
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

export default function GameTopBar({ candle, marketOpen }: { candle: CandleProp; marketOpen: boolean }) {
  const t = useT();
  const game = useGame((s) => s.game);
  const band = useBand(marketOpen, game?.players.length ?? 0);
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
  const scoutPick = useGame((s) => s.scoutPick);
  const setVerb = useGame((s) => s.setVerb);
  const confirm = useGame((s) => s.confirm);
  const cancel = useGame((s) => s.cancel);
  const { beginnerAid } = useBoardOptions();
  const insets = useHudInsets();
  if (!game) return null;
  /* the banner speaks for the seat the plan is made for: the one to act,
     or mine while a move is prepared out of turn */
  const me = planActor >= 0 ? planActor : game.current;
  const p = game.players[me];
  const color = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const total = eraRounds(game.players.length);
  const roundFrac = Math.min(1, game.round / total);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;
  const done = maxActions - game.actionsLeft;
  /* the beginner's aid: the table's house rule online, the reader's own setting at home */
  const aid = aidOn(game.assist, code !== null) || (code === null && beginnerAid);

  const card = selectedCardId ? p.hand.find((c) => c.id === selectedCardId) : undefined;
  const summaryFull = mine ? confirmSummary({ verb, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, developPick, developIron, scoutPick, selectedCardId }) : null;
  /* the verb chip already says it: the summary starts after the verb */
  const summary = summaryFull && verb && summaryFull.startsWith(`${t(VERB_LABEL[verb])} · `) ? summaryFull.slice(t(VERB_LABEL[verb]).length + 3) : summaryFull;
  const cost = summary ? confirmCost({ verb, buildPick, linkPick, secondLinkPick, developPick, developIron }, game, me) : null;
  /* what the banner asks of the reader, in one line */
  const stage = !mine ? 'theirs' : summary ? 'ready' : verb ? 'target' : card ? 'verb' : 'card';

  /* someone else's turn: what they last did, from the ledger */
  const theirLast = !mine ? [...game.ledger].reverse().find((e) => e.player === me && e.verb !== 'system' && e.verb !== 'score') : undefined;
  const lastWhat = theirLast ? ledgerParts(theirLast, t).head : null;

  let line: string;
  if (stage === 'theirs') {
    line = game.phase !== 'action' ? t('game.topbar.between') : p.isBot ? t('game.topbar.thinks', { name: p.name }) : t('game.topbar.plays', { name: p.name });
  } else if (stage === 'ready') {
    line = preparing ? t('game.topbar.hint.prepared') : t('game.topbar.hint.ready');
  } else if (stage === 'target') {
    line = t(`game.topbar.hint.${verb}`);
    if (card && (verb === 'build' || verb === 'network' || verb === 'sell' || verb === 'develop')) {
      const gp = planGame ?? game;
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
        line = `${t('game.topbar.noWay', { verb: t(VERB_LABEL[verb]) })} ${reasonText(why)}`;
        if (aid) line += ` — ${t(`game.topbar.aid.none.${verb}`)}`;
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
  const maxW = Math.max(520, Math.min(920, 2 * (trayLeft - 8 - mid)));
  /* the sentence, with the word that matters set apart: the card in hand
     while a place is looked for, the player while they play */
  const sentence = (() => {
    if (stage === 'theirs') {
      const rest = game.phase !== 'action' ? t('game.topbar.between') : p.isBot ? t('game.topbar.thinksRest') : t('game.topbar.playsRest');
      return (
        <>
          <b className="font-semibold" style={{ color }}>{game.phase !== 'action' ? '' : p.name}</b>
          {game.phase !== 'action' ? rest : ` ${rest}`}
          {lastWhat && <span className="text-cream-100/60"> · {lastWhat}</span>}
        </>
      );
    }
    if (stage === 'target' && card) {
      return (
        <>
          <b className="font-semibold text-brass-400">{cardLabel(card)}</b>
          <span className="text-cream-100/85"> · {line}</span>
        </>
      );
    }
    return <span className={stage === 'card' ? 'text-cream-100/70' : 'text-cream-100/90'}>{line}</span>;
  })();
  /* a turn spends cards: the actions as card stubs, played, in hand, to come */
  const stubs = Array.from({ length: maxActions }, (_, i) => (i < done ? 'played' : i === done ? 'current' : 'next') as 'played' | 'current' | 'next');
  const theirs = !mine;
  const EraIcon = game.era === 'canal' ? Waves : TrainFront;
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
          <Tooltip
            side="bottom"
            title={t('game.topbar.eraRoundTitle', { era: game.era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail'), round: game.round, total })}
            content={game.era === 'canal' ? t('game.topbar.canalTip') : t('game.topbar.railTip')}
          >
            <span className="relative flex h-full items-center gap-1.5 whitespace-nowrap border-r border-brass-700/40 pl-3 pr-2.5">
              <EraIcon className={cn('h-3 w-3', game.era === 'canal' ? 'text-cream-100/70' : 'text-copper-500 brightness-150')} aria-hidden />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-cream-100/80">{game.era === 'canal' ? t('game.topbar.badgeCanal') : t('game.topbar.badgeRail')}</span>
              <span className="font-mono text-[11px] text-brass-400">
                {game.round}<span className="text-cream-100/35">/{total}</span>
              </span>
              {/* the era's progress, a hairline under the plaque */}
              <span className="absolute inset-x-0 bottom-0 h-px bg-brass-700/40">
                <motion.span className="block h-full bg-brass-400/80" animate={{ width: `${roundFrac * 100}%` }} transition={{ duration: 0.5 }} />
              </span>
            </span>
          </Tooltip>

          <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
            <PortraitMedallion p={p} index={me} active={mine} size={22} />
            {mine && (
              <span className="flex shrink-0 items-center gap-[3px]" aria-label={t('game.topbar.actionOf', { n: Math.min(maxActions, done + 1), max: maxActions })}>
                {stubs.map((st, i) => (
                  <motion.span
                    key={i}
                    title={t(`game.topbar.stub.${st}`)}
                    animate={st === 'current' ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className={cn('block h-[14px] w-[10px] overflow-hidden rounded-[2px] border', st === 'played' ? 'border-brass-400 bg-brass-400' : st === 'current' ? 'border-brass-400 shadow-[0_0_6px_rgba(221,190,126,.8)]' : 'border-brass-700/60')}
                  >
                    {st !== 'played' && <img src="/card-back.webp" alt="" className={cn('h-full w-full object-cover', st === 'next' && 'opacity-40')} />}
                  </motion.span>
                ))}
              </span>
            )}
            {mine && verb && <span className="shrink-0 rounded-sm border border-brass-700/70 px-1.5 py-px font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-brass-400">{t(VERB_LABEL[verb])}</span>}
            <span className={cn('min-w-0 flex-1 truncate font-fell text-[13px] leading-none', theirs && 'text-cream-100/85')} title={summaryFull ?? undefined}>
              {mine && summary ? <span className="text-cream-100/90">{summary}</span> : sentence}
            </span>
          </div>

          {mine && (
            <div className="flex shrink-0 items-center gap-1.5 pr-1.5">
              {cost && (
                <motion.span
                  key={`${cost.total}:${cost.after}`}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={cn('flex items-center gap-1 whitespace-nowrap font-mono text-[11px]', cost.after < 0 ? 'text-rust-500 brightness-150' : 'text-cream-100/90')}
                  title={t('game.hand.costTip')}
                >
                  <span className="font-semibold">{t('game.hand.total', { n: cost.total })}</span>
                  <span className="text-cream-100/35">·</span>
                  <span className={cost.after < 0 ? '' : 'text-cream-100/60'}>{t('game.hand.left', { n: cost.after })}</span>
                </motion.span>
              )}
              {stage === 'verb' && (
                <button type="button" onClick={() => setVerb('pass')} className="btn-ledger !min-h-[26px] !px-2.5 !py-0.5 text-[11px]" title={t('game.topbar.passTip')}>
                  {t('game.topbar.pass')}
                </button>
              )}
              <button type="button" onClick={cancel} disabled={stage === 'card' && !preparing} className="btn-ledger !min-h-[26px] !px-2.5 !py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-30" title={`${t('game.topbar.cancel')} — Esc`}>
                {t('game.topbar.cancel')}
              </button>
              <button type="button" onClick={confirm} disabled={stage !== 'ready'} className="btn-strike !min-h-[26px] !px-3 !py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-30" title={`${t(preparing ? 'game.topbar.prepare' : 'game.topbar.confirm')} — ↵`}>
                {t(preparing ? 'game.topbar.prepare' : 'game.topbar.confirm')} <kbd className="ml-1 font-mono text-[9px] opacity-60">↵</kbd>
              </button>
            </div>
          )}
        </div>
        {aidNote && <p className="truncate border-t border-brass-700/30 px-3 py-0.5 font-sans text-[10.5px] text-brass-400/85" title={aidNote}>{aidNote}</p>}
        {/* the candle burns along the bottom edge, by itself */}
        <Candle candle={candle} total={candleTotal} />
      </motion.div>
    </div>
  );
}
