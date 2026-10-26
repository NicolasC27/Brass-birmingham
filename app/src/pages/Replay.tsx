import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { applyAction } from '@/game/actions';
import { INCOME_PAYOUT, fmtPay, incomeLevel } from '@/game/data';
import { newGame } from '@/game/engine';
import type { FinalPayload, GameState } from '@/game/types';
import { heldFinal as readFinal } from '@/game/final';
import { useT } from '@/i18n';
import { ledgerText } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import { setupOf } from '@/game/actions';
import { cn } from '@/lib/utils';
import { ShapeChip } from '@/components/game/TownInspector';
import { seatInk } from '@/components/results/ink';
import EmptyNotice from '@/components/results/EmptyNotice';
import { minimapWidth, useBoardOptions, useTableWidth } from '@/components/game/boardOptions';

const PixiBoard = lazy(() => import('@/gl/PixiBoard'));

/* ------------------------------------------------------------------ */
/* Replay — the finished game, action by action, on the real board.   */
/* The seed and the log rebuild every intermediate state up front;     */
/* a scrubber, play/pause and the arrow keys walk through them, the    */
/* camera flying to wherever each action landed. Also the debugging    */
/* window the online server will need: a state for every action.      */
/* ------------------------------------------------------------------ */

const SPEEDS = [1, 2, 4] as const;


/** every state of the game, from the set table to the last action */
function rebuild(final: FinalPayload): GameState[] | null {
  if (final.seed === undefined || !final.setup || !final.actions) return null;
  const states: GameState[] = [newGame(final.setup, final.seed)];
  for (const a of final.actions) {
    const s = states[states.length - 1];
    const r = applyAction(s, s.current, a);
    if (!r.state) return null;
    states.push(r.state);
  }
  return states;
}

export default function Replay() {
  const t = useT();
  const navigate = useNavigate();
  /* ?live=1: the table in play, as far as it got — otherwise the finished
     game saved with the results */
  const [params] = useSearchParams();
  const live = params.get('live') === '1';
  const liveGame = useGame((s) => s.game);
  const final = useMemo<FinalPayload | null>(() => {
    if (!live) return readFinal();
    if (!liveGame) return null;
    return { players: [], eras: [], winnerIndex: 0, timeline: [], history: liveGame.history, seed: liveGame.seed, setup: setupOf(liveGame), actions: liveGame.actions };
  }, [live, liveGame]);
  /* ?at=N opens the reel on the table as it stood once move N was played,
     which is how the debrief points at a move */
  const at = Number(params.get('at'));
  const from = params.get('from');
  const backTo = from === 'review' ? '/review' : live ? '/game' : '/results';
  const states = useMemo(() => (final ? rebuild(final) : null), [final]);
  const [i, setI] = useState(() => {
    if (live && states) return states.length - 1;
    if (!states || !Number.isFinite(at)) return 0;
    return Math.max(0, Math.min(states.length - 1, at + 1));
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const n = states ? states.length - 1 : 0;
  const step = (d: number) => setI((k) => Math.max(0, Math.min(n, k + d)));
  /* the reel keeps to the band left of the minimap's plate, as the hand
     does at the table: centred on the screen, it ran under the plate on a
     tablet. The plate's width follows the window, so a resize re-reads it */
  const boardOpts = useBoardOptions();
  const table = useTableWidth();
  const reelRight = minimapWidth(boardOpts, table) + 28;

  /* auto-play: one action every 1.2 s at ×1 */
  useEffect(() => {
    if (!playing || i >= n) return;
    const tm = window.setTimeout(() => {
      setI(i + 1);
      if (i + 1 >= n) setPlaying(false); // the reel stops on the last action
    }, 1200 / speed);
    return () => window.clearTimeout(tm);
  }, [playing, i, n, speed]);

  /* keys: space plays, arrows step, home/end jump, escape leaves */
  useEffect(() => {
    const step = (d: number) => setI((k) => Math.max(0, Math.min(n, k + d)));
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(n);
      else if (e.key === 'Escape') navigate(backTo);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, navigate, backTo]);

  const backLabel = from === 'review' ? t('results.review.backToReview') : live ? t('results.page.replayBackGame') : t('results.page.replayBack');

  if (!final || !states) {
    return (
      <EmptyNotice
        eyebrow={t('results.empty.eyebrow')}
        title={t('results.page.replay')}
        actions={[
          { to: backTo, label: backLabel },
          { to: '/setup', label: t('platform.action.createTable') },
        ]}
      >
        {t('results.page.replayMissing')}
      </EmptyNotice>
    );
  }

  const game = states[i];
  const entry = i === 0 ? null : game.ledger[game.ledger.length - 1];
  const focus = game.lastFx ? { at: game.lastFx.at, seq: game.fxSeq } : null;

  return (
    /* the board keeps its own night; the reel and the chips laid over it
       are the register's paper, so they turn with the reader's register */
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-coal-950">
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-ui text-cream-100/70">…</div>}>
          <PixiBoard game={game} targets={[]} linkTargetsList={[]} sellTargetsList={[]} ghost={null} onInvalid={() => {}} keyboard={false} focus={focus} />
        </Suspense>
      </div>

      {/* players at this point of the game */}
      <div className="pointer-events-none fixed left-3 top-3 z-[64] flex flex-col gap-1.5">
        {game.players.map((p, k) => {
          const toAct = game.phase === 'action' && game.current === k;
          return (
            <div key={k} className={cn('flex items-center gap-2 border bg-enamel-850/95 px-2 py-1 backdrop-blur-md', toAct ? 'border-[rgb(var(--paper-100))]' : 'border-[var(--gz-ink-soft)]')}>
              <ShapeChip color={p.color} size={11} />
              <span className="font-fraunces text-[13px] font-medium text-paper-100">{p.name}</span>
              <span className="font-mono text-[11px] font-semibold" style={{ color: seatInk(p.color) }}>
                £{p.money}
              </span>
              <span className="font-mono text-[11px] text-bottle-ink">
                ↗ {incomeLevel(p.income)} ({fmtPay(INCOME_PAYOUT[p.income])})
              </span>
              <span className="font-mono text-[11px] text-paper-300">{p.vp}{t('game.mat.vpShort')}</span>
            </div>
          );
        })}
      </div>

      {/* back */}
      <div className="fixed right-3 top-3 z-[64]">
        <Link to={backTo} className="gz-ticket gz-ticket-sm">
          <ArrowLeft aria-hidden /> {backLabel}
        </Link>
      </div>

      {/* the reel: what just happened, the scrubber, transport */}
      <div className="pointer-events-none fixed bottom-4 left-3 z-[64] flex justify-center" style={{ right: reelRight }}>
      <div className="pointer-events-auto flex w-full max-w-[760px] flex-col gap-2 border border-[var(--gz-ink-soft)] bg-enamel-850/95 px-4 py-3 shadow-[inset_0_0_0_3px_rgb(var(--enamel-850)),inset_0_0_0_4px_var(--gz-ink-faint)] backdrop-blur-md" role="region" aria-label={t('results.page.replayAria')}>
        <div className="flex items-baseline gap-3">
          <span className="micro-label shrink-0 text-brass-300">
            {t('results.page.replayStep', { i, n })}
            <span className="ml-2 text-iron-400">
              {t('platform.tableau.progress', { era: t(game.era === 'canal' ? 'platform.tableau.canal' : 'platform.tableau.rail'), turn: t('platform.state.turn', { round: game.round }) })}
            </span>
          </span>
          <span className="min-w-0 truncate font-mono text-[12px] text-paper-100">{entry ? ledgerText(entry, t) : t('results.page.replayStart')}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => step(-1)} aria-label="−1" className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gz-line-control)] text-paper-100 hover:bg-enamel-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t('results.page.replayPause') : t('results.page.replayPlay')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-400 bg-brass-400/15 text-brass-300 hover:bg-brass-400/25"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => step(1)} aria-label="+1" className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gz-line-control)] text-paper-100 hover:bg-enamel-700">
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={n}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            aria-label={t('results.page.replayStep', { i, n })}
            className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--brass-400))]"
          />
          <div className="flex overflow-hidden border border-[var(--gz-line-control)]" role="group" aria-label={t('results.page.replaySpeed')}>
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                aria-pressed={speed === sp}
                onClick={() => setSpeed(sp)}
                className={cn('px-2 py-0.5 font-mono text-[11px] font-bold', speed === sp ? 'bg-paper-100 text-lacquer-900' : 'text-paper-300 hover:text-paper-100')}
              >
                ×{sp}
              </button>
            ))}
          </div>
        </div>
        <div className="micro-label !text-[9.5px] text-iron-400">{t('results.page.replayKeys')}</div>
      </div>
      </div>
    </div>
  );
}
