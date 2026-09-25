import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass, Sparkles, X } from 'lucide-react';
import { describeAction, useGame } from '@/game/store';
import { positionsOf, roadsFrom, sameRoad, winChance } from '@/game/analysis';
import type { Road } from '@/game/analysis';
import { readDebrief, turnsOf } from '@/game/debrief';
import type { Moment } from '@/game/debrief';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { PLAYER_COLORS } from '@/game/data';
import { useT } from '@/i18n';
import { GUIDE_RAIL, guideDock } from './guideKeys';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The analysis panel — a finished game read the way a chess game is.  */
/* Every move on a list; pick one (or step with the arrows) and the     */
/* board shows the table after it, with the judge's chance of winning   */
/* there. The reader's own moves are graded against the machine's best  */
/* as the machine reads them, and the widest gaps are the key moments.  */
/* At any turn of theirs, the other roads: what else could have been    */
/* played, each weighed — pick one and the board shows where it leads.  */
/* Nothing of this exists while the game runs.                          */
/* ------------------------------------------------------------------ */

const whyKey = (a: GameAction): string => {
  if (a.kind === 'build') return a.industry === 'coal' || a.industry === 'iron' || a.industry === 'brewery' ? a.industry : 'works';
  return a.kind;
};
/** where on the map a move happens, for the camera */
const regionOf = (a: GameAction | undefined): string | null => {
  switch (a?.kind) {
    case 'build':
      return a.town;
    case 'network':
      return a.link;
    case 'sell':
      return a.sales[0]?.town ?? null;
    default:
      return null;
  }
};
const pct = (p: number) => Math.round(p * 100);

export default function Debrief({ game, me }: { game: GameState; me: number }) {
  const t = useT();
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const setReview = useGame((s) => s.setReview);
  const flyToRegion = useGame((s) => s.flyToRegion);
  /* every position, once: positions[k] is the table after k moves */
  const positions = useMemo(() => positionsOf(game), [game]);
  const last = positions.length - 1;
  const turns = useMemo(() => new Set(turnsOf(game, me)), [game, me]);
  const [at, setAt] = useState(last);
  const [road, setRoad] = useState<{ from: number; roads: Road[]; picked: number | null } | null>(null);
  const machine = game.players.find((p) => p.isBot)?.name ?? t('game.debrief.machine');

  /* the reader's moves read one per tick by the debrief's own reader, the
     machine thinking a beat at each; it keeps the widest moments */
  const [grades, setGrades] = useState<{ done: number; total: number; byAt: Record<number, Moment> }>({ done: 0, total: 0, byAt: {} });
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    const reading = readDebrief(game, me, { budgetMs: 120, take: 3 });
    const step = () => {
      if (cancelled.current) return;
      const r = reading.next();
      const v = r.value;
      setGrades({ done: v.done, total: v.total, byAt: Object.fromEntries(v.moments.map((m) => [m.at, m])) });
      if (!r.done) window.setTimeout(step, 16);
    };
    const id = window.setTimeout(step, 30);
    return () => {
      cancelled.current = true;
      window.clearTimeout(id);
    };
  }, [game, me]);
  const keyMoments = useMemo(() => Object.values(grades.byAt).sort((a, b) => b.give - a.give), [grades.byAt]);

  /* the board follows the pick: the table after move `at`, or the end of the branch taken */
  useEffect(() => {
    const branch = road && road.picked !== null ? road.roads[road.picked] : null;
    const state = branch ? branch.after : positions[at];
    if (!state) return;
    const label = branch
      ? t('game.debrief.branch', { move: describeAction(branch.action) })
      : at === 0 ? t('game.debrief.start') : `${at}/${last} · ${describeAction(game.actions[at - 1])}`;
    setReview({ at, round: state.round, state, label, ...(grades.byAt[at - 1] ? { mine: grades.byAt[at - 1].mine, better: grades.byAt[at - 1].better } : {}) });
    const where = regionOf(branch ? branch.action : game.actions[at - 1]);
    if (where) flyToRegion(where);
  }, [at, road, positions, game.actions, grades.byAt, setReview, flyToRegion, last, t]);
  /* the arrows step through the game */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') setAt((k) => Math.max(0, k - 1));
      else if (e.key === 'ArrowRight') setAt((k) => Math.min(last, k + 1));
      else return;
      e.preventDefault();
      setRoad(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [last]);

  const shown = road && road.picked !== null ? road.roads[road.picked].after : positions[at];
  const chance = shown ? winChance(shown, me) : 0.5;
  const explore = () => {
    /* the other roads from the position before the reader's selected move */
    const from = positions[at - 1];
    if (!from) return;
    setRoad({ from: at, roads: roadsFrom(from, me, 8, game.actions[at - 1]), picked: null });
  };
  const canExplore = at > 0 && turns.has(at - 1) && positions[at - 1]?.phase === 'action';
  const close = () => setDebriefOpen(false);
  /* the board goes back to the live table when the panel goes */
  useEffect(() => () => setReview(null), [setReview]);
  const width = Math.max(GUIDE_RAIL, guideDock());
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-at="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  return (
    <aside data-debrief aria-label={t('game.debrief.title')} className="pointer-events-auto fixed inset-y-0 right-0 z-[80] flex flex-col gap-2 border-l border-brass-hairline bg-coal-950/92 px-3 py-3 backdrop-blur-md" style={{ width }}>
      <div className="flex shrink-0 items-center gap-2">
        <Sparkles className="h-4 w-4 text-brass-400" aria-hidden />
        <span className="font-fell text-[11px] uppercase tracking-[0.2em] text-cream-100/60">{t('game.debrief.title')}</span>
        <span className="flex-1" />
        <button type="button" onClick={close} aria-label={t('game.debrief.close')} title={t('game.debrief.close')} className="rounded-md border border-brass-700/50 p-1 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* the judge's chance, for the position on the board */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="font-sans text-[11px] text-cream-100/70">{t('game.debrief.chance', { p: pct(chance) })}</span>
          <span className="font-mono text-[10.5px] text-cream-100/45">{at === 0 ? t('game.debrief.start') : at === last && game.phase === 'game-over' ? t('game.debrief.endOf') : `${at}/${last}`}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-coal-800" aria-hidden>
          <div className="h-full rounded-full bg-brass-400 transition-[width] duration-300" style={{ width: `${pct(chance)}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" onClick={() => { setAt((k) => Math.max(0, k - 1)); setRoad(null); }} disabled={at === 0} aria-label={t('game.debrief.prev')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setAt((k) => Math.min(last, k + 1)); setRoad(null); }} disabled={at === last} aria-label={t('game.debrief.next')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {grades.done < grades.total && <span className="ml-2 font-mono text-[10px] text-cream-100/45">{t('game.debrief.reading', { done: grades.done, total: grades.total })}</span>}
          {canExplore && !road && (
            <button type="button" onClick={explore} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              <Compass className="h-3.5 w-3.5" /> {t('game.debrief.explore')}
            </button>
          )}
          {road && (
            <button type="button" onClick={() => setRoad(null)} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              {t('game.debrief.backToLine')}
            </button>
          )}
        </div>
      </div>

      {/* the other roads from this turn of the reader's */}
      {road && (
        <div className="paper shrink-0 px-3 py-2">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.debrief.roads')}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {road.roads.map((r, i) => {
              const same = sameRoad(r.action) === sameRoad(game.actions[road.from - 1]);
              return (
                <li key={i}>
                  <button type="button" onClick={() => setRoad({ ...road, picked: road.picked === i ? null : i })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', road.picked === i && 'bg-ink-900/10 ring-1 ring-brass-500')}>
                    <span className="w-10 shrink-0 font-mono text-[10.5px] font-semibold text-ink-900">{t('game.debrief.road', { p: pct(r.chance) })}</span>
                    <span className="min-w-0 flex-1 truncate">{describeAction(r.action)}</span>
                    {same && <span className="shrink-0 font-fell text-[9px] uppercase tracking-[0.14em] text-ink-900/50">{t('game.debrief.played')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {road.picked !== null && (
            <p className="mt-1.5 font-serif text-[12px] italic leading-snug text-ink-900/80">
              {t(`game.guide.suggest.why.${whyKey(road.roads[road.picked].action)}`, { name: machine })}
            </p>
          )}
        </div>
      )}

      {/* the key moments, the widest gaps once read */}
      {keyMoments.length > 0 && !road && (
        <div className="shrink-0">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.keyMoments')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {keyMoments.map((m) => (
              <button key={m.at} type="button" onClick={() => setAt(m.at + 1)} className={cn('rounded-md border px-2 py-1 text-left font-sans text-[10.5px] transition-colors', at === m.at + 1 ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/50 text-cream-100/75 hover:border-brass-400')}>
                {t('game.debrief.round', { round: m.round, era: t(m.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })} · <span className="text-rust-400">{t(`game.debrief.quality.${m.grade}`)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* the moves, one line each; the reader's graded */}
      <p className="mt-1 shrink-0 font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.moves')}</p>
      <ol ref={listRef} className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {game.actions.map((a, k) => {
          const before = positions[k];
          if (!before) return null;
          const seat = a.kind === 'concede' ? a.player : before.current;
          const p = game.players[seat];
          const mine = turns.has(k);
          const grade = grades.byAt[k];
          const quality = mine && grade ? grade.grade : null;
          const newRound = k === 0 || positions[k - 1]?.round !== before.round;
          return (
            <li key={k} data-at={k + 1}>
              {newRound && <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-cream-100/40">{t('game.debrief.round', { round: before.round, era: t(before.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })}</p>}
              <button type="button" onClick={() => { setAt(k + 1); setRoad(null); }} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] transition-colors', at === k + 1 && !road ? 'bg-brass-500/15 text-cream-100' : 'text-cream-100/70 hover:bg-coal-800/70')}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[p?.color]?.hex ?? '#C9A45C' }} />
                <span className={cn('w-14 shrink-0 truncate font-mono text-[10px]', mine ? 'text-brass-300' : 'text-cream-100/45')}>{mine ? t('game.debrief.you') : p?.name}</span>
                <span className="min-w-0 flex-1 truncate">{describeAction(a)}</span>
                {quality && quality !== 'top' && quality !== 'good' && <span className={cn('shrink-0 font-fell text-[9px] uppercase tracking-[0.14em]', quality === 'blunder' ? 'text-rust-400' : quality === 'mistake' ? 'text-copper-500' : 'text-cream-100/50')}>{t(`game.debrief.quality.${quality}`)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
