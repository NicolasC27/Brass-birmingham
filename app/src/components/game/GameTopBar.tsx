import { useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { eraRounds } from '@/game/engine';
import { cardLabel, confirmCost, confirmSummary, useGame } from '@/game/store';
import type { Verb } from '@/game/types';
import { useT } from '@/i18n';
import { PortraitMedallion } from './PlayerRail';
import Tooltip from './Tooltip';
import { cn } from '@/lib/utils';

/**
 * The turn banner, top centre: who plays, what they are doing, what it
 * costs, and the one button that settles it. Read left to right — the era
 * and the round, the player and their action pips, then (on the reader's
 * own turn) the action being prepared with Confirm and Cancel.
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
      /* the market is a pill or a drawer, and both exist for the moment one
         gives way to the other: take whichever is laid out, leftmost */
      const markets = [...document.querySelectorAll('[data-market]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.left > window.innerWidth / 2);
      const right = markets.length ? Math.round(window.innerWidth - Math.min(...markets.map((r) => r.left))) + 12 : 12;
      setBand((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    measure();
    /* once more when the market's slide is over */
    const later = window.setTimeout(measure, 450);
    const ro = new ResizeObserver(measure);
    if (rail) ro.observe(rail);
    for (const m of document.querySelectorAll('[data-market]')) ro.observe(m);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(later);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [marketOpen, players]);
  return band;
}

export default function GameTopBar({ secondsLeft, marketOpen }: { secondsLeft: number | null; marketOpen: boolean }) {
  const t = useT();
  const game = useGame((s) => s.game);
  const band = useBand(marketOpen, game?.players.length ?? 0);
  const mine = useGame((s) => s.myTurn());
  const selectedCardId = useGame((s) => s.selectedCardId);
  const verb = useGame((s) => s.verb);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const developPick = useGame((s) => s.developPick);
  const scoutPick = useGame((s) => s.scoutPick);
  const setVerb = useGame((s) => s.setVerb);
  const confirm = useGame((s) => s.confirm);
  const cancel = useGame((s) => s.cancel);
  if (!game) return null;
  const p = game.players[game.current];
  const color = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
  const total = eraRounds(game.players.length);
  const roundFrac = Math.min(1, game.round / total);
  const maxActions = game.round === 1 && game.era === 'canal' ? 1 : 2;
  const done = maxActions - game.actionsLeft;

  const card = selectedCardId ? p.hand.find((c) => c.id === selectedCardId) : undefined;
  const summary = mine
    ? confirmSummary({
        verb,
        buildPick,
        linkPick,
        secondLinkPick,
        sellPick,
        sellPicks,
        developPick,
        scoutPick,
        selectedCardId,
      })
    : null;
  const cost = summary ? confirmCost({ verb, buildPick, linkPick, secondLinkPick, developPick }, game) : null;
  /* what the banner asks of the reader, in one line */
  const stage = !mine ? 'theirs' : summary ? 'ready' : verb ? 'target' : card ? 'verb' : 'card';
  const line =
    stage === 'theirs'
      ? game.phase !== 'action'
        ? t('game.topbar.between')
        : p.isBot
          ? t('game.topbar.thinks', { name: p.name })
          : t('game.topbar.plays', { name: p.name })
      : stage === 'ready'
        ? t('game.topbar.hint.ready')
        : stage === 'target'
          ? t(`game.topbar.hint.${verb}`)
          : stage === 'verb'
            ? t('game.topbar.hint.pickVerb', {
                card: card ? cardLabel(card) : '',
              })
            : t('game.topbar.hint.pickCard');

  return (
    <div className="pointer-events-none fixed top-[44px] z-[64] flex justify-center" style={{ left: band.left, right: band.right }}>
      <div className="pointer-events-auto relative flex w-full max-w-[920px] flex-col rounded-lg border border-brass-700/60 bg-coal-900/90 shadow-e3 backdrop-blur-md">
        <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-lg opacity-[0.05]" />
        <div className="flex h-[52px] items-stretch">
          {/* era and round */}
          <Tooltip
            side="bottom"
            title={t('game.topbar.eraRoundTitle', {
              era: game.era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail'),
              round: game.round,
              total,
            })}
            content={game.era === 'canal' ? t('game.topbar.canalTip') : t('game.topbar.railTip')}
          >
            <span className="relative flex h-full flex-col items-center justify-center whitespace-nowrap border-r border-brass-700/40 px-3 leading-none">
              <span
                className={cn('font-fell text-[12px] tracking-[0.18em]', game.era === 'canal' ? 'text-cream-100' : 'text-copper-500 brightness-150')}
                style={{
                  textShadow: '0 1px 0 rgba(0,0,0,.8), 0 0 8px rgba(201,164,92,.25)',
                }}
              >
                {game.era === 'canal' ? t('game.topbar.badgeCanal') : t('game.topbar.badgeRail')}
              </span>
              <span className="mt-1 font-fell text-[11px] tracking-[0.14em] text-brass-400">{t('game.topbar.roundShort', { round: game.round, total })}</span>
              <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-coal-950">
                <motion.span className="block h-full rounded-full bg-brass-400" animate={{ width: `${roundFrac * 100}%` }} transition={{ duration: 0.5 }} />
              </span>
            </span>
          </Tooltip>

          {/* the player and their turn */}
          <div className="relative flex items-center gap-2.5 px-3">
            <PortraitMedallion p={p} index={game.current} active={mine} size={34} />
            <div className="flex min-w-0 flex-col justify-center leading-tight">
              <motion.span
                key={`${game.current}:${mine}`}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="flex items-center gap-2 font-sans text-[12px] font-semibold"
                style={{ color }}
              >
                <span className="truncate">{mine ? t('game.topbar.yours') : p.name}</span>
                {/* action pips: done, current, to come */}
                <span
                  className="flex items-center gap-1"
                  aria-label={t('game.topbar.actionOf', {
                    n: Math.min(maxActions, done + 1),
                    max: maxActions,
                  })}
                >
                  {Array.from({ length: maxActions }, (_, i) => (
                    <span
                      key={i}
                      className={cn('h-2 w-2 rounded-full border', i < done ? 'border-brass-400 bg-brass-400' : i === done ? 'border-brass-400 bg-transparent' : 'border-brass-700/60 bg-transparent')}
                    />
                  ))}
                </span>
              </motion.span>
              <span className={cn('truncate font-mono text-[10.5px]', stage === 'theirs' ? 'text-cream-100/55' : 'text-cream-100/80')}>{line}</span>
            </div>
          </div>

          <span className="flex-1" />
          {/* the candle */}
          {secondsLeft !== null && (
            <span className="relative flex items-center border-l border-brass-700/40 px-3">
              <span
                className={cn(
                  'rounded-sm border px-2 py-1 font-mono text-xs font-semibold',
                  secondsLeft < 20 ? 'animate-pulse border-rust-500 text-rust-500 brightness-150' : 'border-brass-700 text-brass-400',
                )}
                aria-label={t('game.topbar.secondsLeft', {
                  seconds: secondsLeft,
                })}
              >
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </span>
          )}
        </div>

        {/* the note: the action being prepared, and the button that settles it —
          its own row, so the banner never grows past the band */}
        {mine && stage !== 'card' && (
          <div className="relative flex min-w-0 items-center gap-2.5 border-t border-brass-700/40 px-3 py-1.5">
            {verb && (
              <span className="shrink-0 rounded-sm border border-brass-700/70 px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brass-400">{t(VERB_LABEL[verb])}</span>
            )}
            {summary && (
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-cream-100/90" title={summary}>
                {summary}
              </span>
            )}
            {!summary && <span className="min-w-0 flex-1" />}
            {cost && (
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]',
                  cost.after < 0 ? 'border-rust-500/70 text-rust-500 brightness-150' : 'border-brass-700/60 text-brass-400',
                )}
                title={t('game.hand.costTip')}
              >
                <span>{t('game.hand.total', { n: cost.total })}</span>
                <span className="text-cream-100/40">·</span>
                <span className={cost.after < 0 ? '' : 'text-cream-100/75'}>{t('game.hand.left', { n: cost.after })}</span>
              </span>
            )}
            {stage === 'ready' && (
              <button type="button" onClick={confirm} className="btn-strike !min-h-[32px] !px-4 !py-1 text-xs">
                {t('game.topbar.confirm')}
              </button>
            )}
            {stage === 'verb' && (
              <button type="button" onClick={() => setVerb('pass')} className="btn-ledger !min-h-[32px] !px-3 !py-1 text-xs" title={t('game.topbar.passTip')}>
                {t('game.topbar.pass')}
              </button>
            )}
            <button type="button" onClick={cancel} className="btn-ledger !min-h-[32px] !px-3 !py-1 text-xs">
              {t('game.topbar.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
