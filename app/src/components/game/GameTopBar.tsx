import { useLayoutEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { buildTargets, candleMinutes, developOptions, eraRounds, linkTargets, sellTargets } from '@/game/engine';
import { ledgerParts } from '@/game/ledgerText';
import { cardLabel, confirmCost, confirmSummary, describeAction, describeUnless, projectQueued, useGame, verbsForCard } from '@/game/store';
import type { Unless } from '@/game/store';
import { TOWNS } from '@/game/data';
import type { Verb } from '@/game/types';
import { reasonText, useT } from '@/i18n';
import { aidOn, useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';
import { PortraitMedallion } from './PlayerRail';
import Tooltip from './Tooltip';
import { cn } from '@/lib/utils';

/**
 * The turn banner, top centre: who plays, what they are doing, what it
 * costs, and the one button that settles it. Read left to right — the era
 * and the round, the player and their action pips, then (on the reader's
 * own turn) the action being prepared with Confirm and Cancel on a second
 * row. On someone else's turn the banner folds to one line and says what
 * they last did. The candle burns as a bar along the bottom edge.
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

/** the small form behind "unless…": that player, that deed, there or anywhere */
function UnlessEditor({ at, players, value, onChange, onClose }: { at: { x: number; y: number }; players: { idx: number; name: string }[]; value: Unless | null; onChange: (u: Unless | null) => void; onClose: () => void }) {
  const t = useT();
  const [player, setPlayer] = useState<number>(value?.player ?? players[0]?.idx ?? 0);
  const [kind, setKind] = useState<Unless['kind']>(value?.kind ?? 'build');
  const [town, setTown] = useState<string>(value?.town ?? '');
  const sel = 'rounded-sm border border-brass-700/60 bg-coal-950 px-1 py-0.5 font-sans text-[11px] text-cream-100';
  return (
    <div role="dialog" aria-label={t('game.topbar.unlessTitle')} className="plaque fixed z-[90] flex w-[300px] flex-col gap-1.5 rounded-md p-2 text-left shadow-e4" style={{ left: Math.min(at.x, window.innerWidth - 316), top: at.y }} onClick={(e) => e.stopPropagation()}>
      <p className="engraved-brass font-fell text-[11px] uppercase tracking-[0.12em]">{t('game.topbar.unlessTitle')}</p>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessWho')}
        <select value={player} onChange={(e) => setPlayer(Number(e.target.value))} className={sel}>
          {players.map((p) => (
            <option key={p.idx} value={p.idx}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessDoes')}
        <select value={kind} onChange={(e) => setKind(e.target.value as Unless['kind'])} className={sel}>
          {(['build', 'sell', 'network'] as const).map((k) => (
            <option key={k} value={k}>{t(`game.topbar.unlessKind.${k}`)}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessWhere')}
        <select value={town} onChange={(e) => setTown(e.target.value)} className={sel}>
          <option value="">{t('game.topbar.unlessAnywhere')}</option>
          {TOWNS.filter((x) => !x.farm).map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </label>
      <div className="mt-1 flex justify-end gap-1.5">
        {value && (
          <button type="button" onClick={() => { onChange(null); onClose(); }} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]">
            {t('game.topbar.unlessNone')}
          </button>
        )}
        <button type="button" onClick={() => { onChange({ player, kind, town: town || undefined }); onClose(); }} className="btn-strike !min-h-[26px] !px-3 !py-0.5 text-[11px]">
          {t('game.topbar.unlessOk')}
        </button>
      </div>
    </div>
  );
}

export default function GameTopBar({ secondsLeft, marketOpen }: { secondsLeft: number | null; marketOpen: boolean }) {
  const t = useT();
  const game = useGame((s) => s.game);
  const band = useBand(marketOpen, game?.players.length ?? 0);
  const mine = useGame((s) => s.planActor() >= 0);
  const planActor = useGame((s) => s.planActor());
  const preparing = useGame((s) => s.preparing);
  const queued = useGame((s) => s.queued);
  const dropQueued = useGame((s) => s.dropQueued);
  const setUnless = useGame((s) => s.setUnless);
  const seat = useGame((s) => s.seat);
  /* the table the hints count on: with moves prepared, the one they leave */
  const planGame = useMemo(() => (game && preparing && queued.length && planActor >= 0 ? projectQueued(game, planActor, queued) : game), [game, preparing, queued, planActor]);
  /* which prepared move has its condition open for editing */
  const [unlessOpen, setUnlessOpen] = useState<{ index: number; x: number; y: number } | null>(null);
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
  const candleFrac = secondsLeft !== null && candleTotal > 0 ? Math.max(0, Math.min(1, secondsLeft / candleTotal)) : null;
  const candleLow = secondsLeft !== null && secondsLeft < 20;

  const rowH = mine ? 52 : 36;
  /* the exchange's tray hangs at the right edge, 320px wide: the banner,
     centred in its band, stays narrow enough never to run under it */
  const trayLeft = typeof window === 'undefined' ? 9999 : window.innerWidth - 12 - 320;
  const mid = typeof window === 'undefined' ? 0 : (band.left + (window.innerWidth - band.right)) / 2;
  const maxW = Math.max(520, Math.min(920, 2 * (trayLeft - 8 - mid)));
  return (
    <div className="pointer-events-none fixed z-[64] flex justify-center" style={{ left: band.left, right: band.right, top: insets.top }}>
      <motion.div
        key={mine ? 'mine' : 'theirs'}
        initial={{ scale: 0.97, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={cn('pointer-events-auto relative plaque flex flex-col overflow-hidden rounded-lg', mine ? 'w-full' : 'max-w-full')}
        style={mine ? { maxWidth: maxW } : undefined}
      >
        <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-lg opacity-[0.05]" />
        <motion.div className="flex items-stretch" initial={false} animate={{ height: rowH }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
          {/* era and round */}
          <Tooltip
            side="bottom"
            title={t('game.topbar.eraRoundTitle', { era: game.era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail'), round: game.round, total })}
            content={game.era === 'canal' ? t('game.topbar.canalTip') : t('game.topbar.railTip')}
          >
            <span className={cn('plaque-brass relative m-1 flex items-center justify-center whitespace-nowrap rounded-md px-3 leading-none', mine ? 'flex-col' : 'gap-2')}>
              <span
                className={cn('font-fell text-[12px] tracking-[0.18em]', game.era === 'canal' ? 'text-cream-100' : 'text-copper-500 brightness-150')}
                style={{ textShadow: '0 1px 0 rgba(0,0,0,.8), 0 0 8px rgba(201,164,92,.25)' }}
              >
                {game.era === 'canal' ? t('game.topbar.badgeCanal') : t('game.topbar.badgeRail')}
              </span>
              <span className={cn('font-fell text-[11px] tracking-[0.14em] text-brass-400', mine && 'mt-1')}>{t('game.topbar.roundShort', { round: game.round, total })}</span>
              {mine && (
                <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-coal-950">
                  <motion.span className="block h-full rounded-full bg-brass-400" animate={{ width: `${roundFrac * 100}%` }} transition={{ duration: 0.5 }} />
                </span>
              )}
            </span>
          </Tooltip>

          {/* the player and their turn */}
          <div className="relative flex min-w-0 items-center gap-2.5 px-3">
            <PortraitMedallion p={p} index={me} active={mine} size={mine ? 34 : 24} />
            <div className={cn('flex min-w-0 justify-center leading-tight', mine ? 'flex-col' : 'items-baseline gap-2')}>
              <motion.span
                key={`${me}:${mine}`}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="flex shrink-0 items-center gap-2 font-sans text-[12px] font-semibold"
                style={{ color }}
              >
                <span className="truncate">{mine ? t('game.topbar.yours') : p.name}</span>
                {/* action pips: done, current, to come */}
                <span className="flex items-center gap-1" aria-label={t('game.topbar.actionOf', { n: Math.min(maxActions, done + 1), max: maxActions })}>
                  {Array.from({ length: maxActions }, (_, i) => (
                    <motion.span
                      key={i}
                      animate={i === done && mine ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                      transition={{ duration: 0.6 }}
                      className={cn('h-2 w-2 rounded-full border', i < done ? 'border-brass-400 bg-brass-400' : i === done ? 'border-brass-400 bg-transparent' : 'border-brass-700/60 bg-transparent')}
                    />
                  ))}
                </span>
              </motion.span>
              <span className={cn('truncate font-mono text-[10.5px]', stage === 'theirs' ? 'text-cream-100/55' : 'text-cream-100/80')}>
                {line}
                {lastWhat && <span className="text-cream-100/75"> · {t('game.topbar.last', { what: lastWhat })}</span>}
              </span>
            </div>
          </div>

          <span className="flex-1" />
          {/* the last seconds of the candle, in figures */}
          {secondsLeft !== null && candleLow && (
            <span className="relative flex items-center border-l border-brass-700/40 px-3">
              <span className="animate-pulse rounded-sm border border-rust-500 px-2 py-1 font-mono text-xs font-semibold text-rust-500 brightness-150" aria-label={t('game.topbar.secondsLeft', { seconds: secondsLeft })}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </span>
          )}
        </motion.div>

        {/* the note: the action being prepared, and the button that settles it —
            its own row, so the banner never grows past the band */}
        {mine && stage !== 'card' && (
          <div className="relative flex min-w-0 flex-col border-t border-brass-700/40 px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {verb && <span className="shrink-0 rounded-sm border border-brass-700/70 px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brass-400">{t(VERB_LABEL[verb])}</span>}
              {summary && (
                <span className="line-clamp-2 min-w-0 flex-1 font-mono text-[11px] leading-snug text-cream-100/90" title={summaryFull ?? undefined}>
                  {summary}
                </span>
              )}
              {!summary && <span className="min-w-0 flex-1" />}
              {cost && (
                <span
                  className={cn('flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]', cost.after < 0 ? 'border-rust-500/70 text-rust-500 brightness-150' : 'border-brass-700/60 text-brass-400')}
                  title={t('game.hand.costTip')}
                >
                  <span>{t('game.hand.total', { n: cost.total })}</span>
                  <span className="text-cream-100/40">·</span>
                  <span className={cost.after < 0 ? '' : 'text-cream-100/75'}>{t('game.hand.left', { n: cost.after })}</span>
                </span>
              )}
              {stage === 'ready' && (
                <button type="button" onClick={confirm} className="btn-strike !min-h-[32px] !px-4 !py-1 text-xs">
                  {t(preparing ? 'game.topbar.prepare' : 'game.topbar.confirm')} <kbd className="ml-1 font-mono text-[9px] opacity-60">↵</kbd>
                </button>
              )}
              {stage === 'verb' && (
                <button type="button" onClick={() => setVerb('pass')} className="btn-ledger !min-h-[32px] !px-3 !py-1 text-xs" title={t('game.topbar.passTip')}>
                  {t('game.topbar.pass')}
                </button>
              )}
              <button type="button" onClick={cancel} className="btn-ledger !min-h-[32px] !px-3 !py-1 text-xs">
                {t('game.topbar.cancel')} <kbd className="ml-1 font-mono text-[9px] opacity-60">Esc</kbd>
              </button>
            </div>
            {aidNote && <p className="mt-1 truncate font-sans text-[10.5px] text-brass-400/85" title={aidNote}>{aidNote}</p>}
          </div>
        )}
        {/* the moves ready for my turn, each with its cross — shown while
            the others play too, that is when they matter */}
        {queued.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 px-3 pb-1.5 font-sans text-[10.5px] text-cream-100/80">
            <span className="font-mono text-[9px] uppercase tracking-wider text-brass-400/80">{t('game.topbar.queued')}</span>
            {queued.map((q, i) => (
              <span key={i} className="relative flex items-center gap-1 rounded-sm border border-brass-700/60 bg-coal-950/60 px-1.5 py-px">
                <span>{describeAction(q.action)}</span>
                {/* the condition: set, shown, or offered */}
                <button
                  type="button"
                  onClick={(e) => {
                    /* the editor floats over the page (the banner clips its overflow) */
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setUnlessOpen((o) => (o?.index === i ? null : { index: i, x: r.left, y: r.bottom + 6 }));
                  }}
                  aria-expanded={unlessOpen?.index === i}
                  className={cn('rounded-sm border px-1 font-sans text-[9.5px]', q.unless ? 'border-rust-500/70 text-rust-500 brightness-150' : 'border-brass-700/50 text-brass-400/80 hover:text-brass-400')}
                >
                  {q.unless ? describeUnless(q.unless, game) : t('game.topbar.unlessAdd')}
                </button>
                <button type="button" onClick={() => dropQueued(i)} aria-label={t('game.topbar.queueDrop')} title={t('game.topbar.queueDrop')} className="text-cream-100/45 hover:text-rust-500">×</button>
                {unlessOpen?.index === i && (
                  <UnlessEditor
                    at={unlessOpen}
                    players={game.players.map((x, idx) => ({ idx, name: x.name })).filter((x) => x.idx !== (seat ?? game.players.findIndex((y) => !y.isBot)))}
                    value={q.unless ?? null}
                    onChange={(u) => setUnless(i, u)}
                    onClose={() => setUnlessOpen(null)}
                  />
                )}
              </span>
            ))}
          </p>
        )}

        {/* the candle burns along the bottom edge */}
        {candleFrac !== null && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-coal-950" aria-label={t('game.topbar.secondsLeft', { seconds: secondsLeft ?? 0 })}>
            <span className={cn('block h-full rounded-r-full transition-[width] duration-1000 ease-linear', candleLow ? 'animate-pulse bg-rust-500' : 'bg-brass-400')} style={{ width: `${candleFrac * 100}%` }} />
          </span>
        )}
      </motion.div>
    </div>
  );
}
