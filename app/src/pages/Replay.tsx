import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { applyAction } from '@/game/actions';
import { INCOME_PAYOUT, PLAYER_COLORS, fmtPay, incomeLevel } from '@/game/data';
import { newGame } from '@/game/engine';
import type { FinalPayload, GameState } from '@/game/types';
import { heldFinal as readFinal } from '@/game/final';
import { useT } from '@/i18n';
import { ledgerText } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import { setupOf } from '@/game/actions';
import { cn } from '@/lib/utils';
import { ShapeChip } from '@/components/game/TownInspector';

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

  if (!final || !states) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fell text-lg text-cream-100/80">{t('results.page.replayMissing')}</p>
        <Link to={backTo} className="btn-ledger">
          {from === 'review' ? t('results.review.backToReview') : live ? t('results.page.replayBackGame') : t('results.page.replayBack')}
        </Link>
      </div>
    );
  }

  const game = states[i];
  const entry = i === 0 ? null : game.ledger[game.ledger.length - 1];
  const focus = game.lastFx ? { at: game.lastFx.at, seq: game.fxSeq } : null;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-coal-950">
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-fell text-brass-400">…</div>}>
          <PixiBoard game={game} targets={[]} linkTargetsList={[]} sellTargetsList={[]} ghost={null} onInvalid={() => {}} keyboard={false} focus={focus} />
        </Suspense>
      </div>

      {/* players at this point of the game */}
      <div className="pointer-events-none fixed left-3 top-3 z-[64] flex flex-col gap-1.5">
        {game.players.map((p, k) => {
          const col = PLAYER_COLORS[p.color]?.hex ?? '#C9A45C';
          const toAct = game.phase === 'action' && game.current === k;
          return (
            <div key={k} className={cn('flex items-center gap-2 rounded-md border bg-coal-900/85 px-2 py-1 backdrop-blur-md', toAct ? 'border-brass-400' : 'border-brass-700/40')}>
              <ShapeChip color={p.color} size={11} />
              <span className="font-fell text-[12px] tracking-wide text-cream-100">{p.name}</span>
              <span className="font-mono text-[10px]" style={{ color: col }}>
                £{p.money}
              </span>
              <span className="font-mono text-[10px] text-bottle-600 brightness-150">
                ↗ {incomeLevel(p.income)} ({fmtPay(INCOME_PAYOUT[p.income])})
              </span>
              <span className="font-mono text-[10px] text-cream-100/75">{p.vp} VP</span>
            </div>
          );
        })}
      </div>

      {/* back */}
      <Link to={backTo} className="plate fixed right-3 top-3 z-[64] flex items-center gap-1.5 px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-cream-100/75 hover:text-brass-400">
        <ArrowLeft className="h-3 w-3" /> {from === 'review' ? t('results.review.backToReview') : live ? t('results.page.replayBackGame') : t('results.page.replayBack')}
      </Link>

      {/* the reel: what just happened, the scrubber, transport */}
      <div className="plate fixed bottom-4 left-1/2 z-[64] flex w-[min(760px,94vw)] -translate-x-1/2 flex-col gap-2 px-4 py-3" role="region" aria-label={t('results.page.replayAria')}>
        <div className="flex items-baseline gap-3">
          <span className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400">
            {t('results.page.replayStep', { i, n })}
            <span className="ml-2 text-cream-100/45">
              {game.era === 'canal' ? 'Canal' : 'Rail'} · R{game.round}
            </span>
          </span>
          <span className="min-w-0 truncate font-mono text-[11.5px] text-cream-100/90">{entry ? ledgerText(entry, t) : t('results.page.replayStart')}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => step(-1)} aria-label="−1" className="flex h-7 w-7 items-center justify-center rounded-full border border-brass-700/60 text-brass-400 hover:bg-coal-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t('results.page.replayPause') : t('results.page.replayPlay')}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brass-400 bg-brass-500/20 text-brass-400 hover:bg-brass-500/30"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => step(1)} aria-label="+1" className="flex h-7 w-7 items-center justify-center rounded-full border border-brass-700/60 text-brass-400 hover:bg-coal-800">
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
            className="h-1.5 flex-1 cursor-pointer accent-[#C9A45C]"
          />
          <div className="flex overflow-hidden rounded-md border border-brass-700/60" aria-label={t('results.page.replaySpeed')}>
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                aria-pressed={speed === sp}
                onClick={() => setSpeed(sp)}
                className={cn('px-2 py-0.5 font-mono text-[10px] font-bold', speed === sp ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400')}
              >
                ×{sp}
              </button>
            ))}
          </div>
        </div>
        <div className="font-sans text-[8.5px] uppercase tracking-[0.14em] text-cream-100/35">{t('results.page.replayKeys')}</div>
      </div>
    </div>
  );
}
