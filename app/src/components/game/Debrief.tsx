import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Compass, Play, Sparkles, X } from 'lucide-react';
import { describeAction, useGame } from '@/game/store';
import { applyAction, setupOf } from '@/game/actions';
import { LOSS, followOn, positionsOf, roadsFrom, sameRoad, winChance } from '@/game/analysis';
import type { Followed, Road, Verdict } from '@/game/analysis';
import type { Note } from '@/game/analysisWorker';
import { turnsOf } from '@/game/debrief';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { PLAYER_COLORS } from '@/game/data';
import { useLang, useT } from '@/i18n';
import { forkLocalGame } from '@/game/local';
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
const EMPTY_DEEP: Record<number, number> = {};
const EMPTY_VERDICTS: Record<number, Verdict> = {};
const pct = (p: number) => Math.round(p * 100);
/** one decimal, in the reader's tongue: roads often sit under a point apart */
const fine = (p: number, lang: string) => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p * 100);

/* the game as a line: the reader's chance after every move, the half-way
   mark, the era's turn, their wider misses as dots; a click goes there */
function Curve({ chances, at, turns, marks, split, label, onPick }: { chances: number[]; at: number; turns: Set<number>; marks: Record<number, Verdict>; split: number; label: string; onPick: (k: number) => void }) {
  const W = 100;
  const H = 36;
  const last = Math.max(1, chances.length - 1);
  const x = (k: number) => (k / last) * W;
  const y = (c: number) => H - c * (H - 2) - 1;
  const line = chances.map((c, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(2)},${y(c).toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const misses = Object.values(marks).filter((m) => m.grade !== 'top' && m.grade !== 'good');
  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPick(Math.max(0, Math.min(last, Math.round(((e.clientX - r.left) / r.width) * last))));
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} onClick={pick} className="h-28 w-full cursor-crosshair rounded-sm border border-brass-700/40 bg-coal-900/70">
      <path d={area} fill="rgba(201,164,92,0.14)" />
      <line x1={0} x2={W} y1={y(0.5)} y2={y(0.5)} stroke="rgba(245,235,215,0.25)" strokeWidth={0.4} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
      {split > 0 && <line x1={x(split)} x2={x(split)} y1={0} y2={H} stroke="rgba(245,235,215,0.22)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />}
      <path d={line} fill="none" stroke="#C9A45C" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {misses.map((m) => (
        <circle key={m.at} cx={x(m.at + 1)} cy={y(chances[m.at + 1] ?? 0.5)} r={1.6} fill={m.grade === 'blunder' ? '#B4472E' : m.grade === 'mistake' ? '#C97A3B' : '#E7D6AE'} stroke="rgba(0,0,0,0.5)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
      ))}
      {[...turns].filter((k) => !marks[k]).map((k) => (
        <circle key={`t${k}`} cx={x(k + 1)} cy={y(chances[k + 1] ?? 0.5)} r={0.7} fill="rgba(201,164,92,0.7)" />
      ))}
      <line x1={x(at)} x2={x(at)} y1={0} y2={H} stroke="#F5EBD7" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Debrief({ game, me }: { game: GameState; me: number }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const setReview = useGame((s) => s.setReview);
  const flyToRegion = useGame((s) => s.flyToRegion);
  /* every position, once: positions[k] is the table after k moves */
  const positions = useMemo(() => positionsOf(game), [game]);
  const last = positions.length - 1;
  /* the long judge's figures as they land: a chance per position, a verdict per turn of the reader's */
  const [judged, setJudged] = useState<{ of: GameState; deep: Record<number, number>; verdicts: Record<number, Verdict>; done: number; total: number }>({ of: game, deep: {}, verdicts: {}, done: 0, total: 0 });
  const fresh = judged.of === game;
  const deep = fresh ? judged.deep : EMPTY_DEEP;
  const verdicts = fresh ? judged.verdicts : EMPTY_VERDICTS;
  const progress = fresh ? judged : { done: 0, total: 0 };
  const chances = useMemo(() => positions.map((p, k) => deep[k] ?? winChance(p, me)), [positions, me, deep]);
  const turns = useMemo(() => new Set(turnsOf(game, me)), [game, me]);
  const [at, setAt] = useState(last);
  /* the roads being explored: from which move, which one is picked (by what it does, so the judge's later figures keep the pick), and the tail played on */
  const [road, setRoad] = useState<{ from: number; picked: string | null; followed?: { moves: Followed[]; after: GameState } } | null>(null);
  const FOLLOW = 4;
  const machine = game.players.find((p) => p.isBot)?.name ?? t('game.debrief.machine');

  /* the long judge thinks on a thread of its own and posts as it goes */
  useEffect(() => {
    let w: Worker | null = null;
    try {
      w = new Worker(new URL('../../game/analysisWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    w.onmessage = (e: MessageEvent<Note>) => {
      const n = e.data;
      setJudged((j) => {
        const base = j.of === game ? j : { of: game, deep: {}, verdicts: {}, done: 0, total: 0 };
        if (n.kind === 'position') return { ...base, deep: { ...base.deep, [n.k]: n.chance }, done: n.done, total: n.total };
        if (n.kind === 'turn') return { ...base, verdicts: { ...base.verdicts, [n.verdict.at]: n.verdict }, done: n.done, total: n.total };
        if (n.kind === 'done') return { ...base, done: base.total };
        return base;
      });
    };
    w.postMessage({ setup: setupOf(game), seed: game.seed, actions: game.actions, me });
    return () => w?.terminate();
  }, [game, me]);
  const keyMoments = useMemo(() => Object.values(verdicts).filter((v) => v.loss > LOSS.good).sort((a, b) => b.loss - a.loss).slice(0, 3), [verdicts]);

  /* the roads from the position before move `from`: the long judge's once it
     has read that turn, the short judge's meanwhile; the pick follows by key */
  const roads = useMemo<Road[]>(() => {
    if (!road) return [];
    const from = positions[road.from - 1];
    if (!from) return [];
    const v = verdicts[road.from - 1];
    if (v) return v.roads.map((r) => ({ action: r.action, after: applyAction(from, me, r.action).state, chance: r.chance })).filter((r): r is Road => !!r.after);
    return roadsFrom(from, me, 8, game.actions[road.from - 1]);
  }, [road, positions, verdicts, me, game.actions]);
  const pickedAt = road?.picked ? roads.findIndex((r) => sameRoad(r.action) === road.picked) : -1;
  const branch = pickedAt >= 0 ? roads[pickedAt] : null;

  /* the board follows the pick: the table after move `at`, or the end of the branch taken */
  useEffect(() => {
    const state = branch ? (road?.followed?.after ?? branch.after) : positions[at];
    if (!state) return;
    const label = branch
      ? road?.followed
        ? t('game.debrief.branchOn', { move: describeAction(branch.action), n: road.followed.moves.length })
        : t('game.debrief.branch', { move: describeAction(branch.action) })
      : at === 0 ? t('game.debrief.start') : `${at}/${last} · ${describeAction(game.actions[at - 1])}`;
    const played = branch ? branch.action : game.actions[at - 1];
    const before = positions[at - 1];
    const tail = road?.followed?.moves.at(-1);
    const seat = tail ? tail.seat : played && before ? (played.kind === 'concede' ? played.player : before.current) : undefined;
    setReview({ at, round: state.round, state, label, ...(seat !== undefined ? { seat } : {}) });
    const where = regionOf(branch ? branch.action : game.actions[at - 1]);
    if (where) flyToRegion(where);
  }, [at, road, branch, positions, game.actions, game.players, setReview, flyToRegion, last, t]);
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

  const shown = branch ? (road?.followed?.after ?? branch.after) : positions[at];
  const chance = shown ? winChance(shown, me) : 0.5;
  const explore = () => setRoad({ from: at, picked: null });
  const canExplore = at > 0 && positions[at - 1]?.phase === 'action' && positions[at - 1]?.current === me;
  /* the move under the cursor, when the reader's and read wider than good:
     what was better, and how much more chance the judge gave it */
  const lesson = useMemo(() => {
    const v = at > 0 ? verdicts[at - 1] : undefined;
    if (!v || v.loss <= LOSS.good) return null;
    const better = v.roads[0];
    if (!better || sameRoad(better.action) === sameRoad(game.actions[at - 1])) return null;
    return { v, better: better.action, delta: Math.round(v.loss * 100) };
  }, [at, verdicts, game.actions]);
  const seeBetter = () => {
    if (lesson) setRoad({ from: at, picked: sameRoad(lesson.better) });
  };
  /* the position on show becomes a table of this device: the reader plays
     on from there, the machines with them */
  const playFrom = () => {
    if (!shown || shown.phase !== 'action') return;
    const code = forkLocalGame(shown);
    setDebriefOpen(false);
    navigate(`/game/local/${code}`);
  };
  const follow = () => {
    if (!road || !branch) return;
    setRoad({ ...road, followed: followOn(branch.after, FOLLOW) });
  };
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
        <div className="relative mt-2">
          <Curve chances={chances} at={at} turns={turns} marks={verdicts} split={positions.findIndex((p) => p.era === 'rail')} label={t('game.debrief.curve')} onPick={(k) => { setAt(k); setRoad(null); }} />
          <span className="pointer-events-none absolute left-1.5 top-1 font-fell text-[9px] uppercase tracking-[0.14em] text-cream-100/45">{t('game.topbar.eraCanal')}</span>
          {positions.some((p) => p.era === 'rail') && <span className="pointer-events-none absolute right-1.5 top-1 font-fell text-[9px] uppercase tracking-[0.14em] text-cream-100/45">{t('game.topbar.eraRail')}</span>}
          <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] text-cream-100/40">0 %</span>
          <span className="pointer-events-none absolute left-1.5 top-[calc(50%-6px)] font-mono text-[9px] text-cream-100/40">50 %</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" onClick={() => { setAt((k) => Math.max(0, k - 1)); setRoad(null); }} disabled={at === 0} aria-label={t('game.debrief.prev')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setAt((k) => Math.min(last, k + 1)); setRoad(null); }} disabled={at === last} aria-label={t('game.debrief.next')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {shown?.phase === 'action' && (
            <button type="button" onClick={playFrom} title={t('game.debrief.playFrom')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[10px]">
              <Play className="h-3.5 w-3.5" /> {t('game.debrief.playFrom')}
            </button>
          )}
          {progress.done < progress.total && <span className="ml-2 font-mono text-[10px] text-cream-100/45">{t('game.debrief.reading', { done: progress.done, total: progress.total })}</span>}
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

      {/* the move under the cursor, read wider than good: what was better */}
      {lesson && !road && (
        <div className="paper shrink-0 px-3 py-2">
          <p className="font-sans text-[11.5px] text-ink-900">
            <span className="font-fell text-[10px] uppercase tracking-[0.14em] text-rust-700">{t(`game.debrief.quality.${lesson.v.grade}`)}</span>
            {' · '}
            <span className="font-mono text-[10.5px] text-rust-700">{t('game.debrief.lost', { p: lesson.delta })}</span>
            {' · '}
            {t('game.debrief.betterWas', { move: describeAction(lesson.better) })}
          </p>
          <p className="mt-0.5 font-serif text-[12px] italic leading-snug text-ink-900/80">
            {t('game.debrief.whyGap', { name: machine, p: lesson.delta })} {t(`game.guide.suggest.why.${whyKey(lesson.better)}`, { name: machine })}
          </p>
          <button type="button" onClick={seeBetter} className="btn-strike mt-1.5 !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
            <Compass className="h-3 w-3" /> {t('game.debrief.seeBetter')}
          </button>
        </div>
      )}

      {/* the other roads from this turn of the reader's */}
      {road && (
        <div className="paper shrink-0 px-3 py-2">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.debrief.roads')}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {roads.map((r, i) => {
              const same = sameRoad(r.action) === sameRoad(game.actions[road.from - 1]);
              return (
                <li key={i}>
                  <button type="button" onClick={() => setRoad({ from: road.from, picked: pickedAt === i ? null : sameRoad(r.action) })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', pickedAt === i && 'bg-ink-900/10 ring-1 ring-brass-500')}>
                    <span className="w-10 shrink-0 font-mono text-[10.5px] font-semibold text-ink-900">{t('game.debrief.road', { p: fine(r.chance, lang) })}</span>
                    <span className="min-w-0 flex-1 truncate">{describeAction(r.action)}</span>
                    {same && <span className="shrink-0 font-fell text-[9px] uppercase tracking-[0.14em] text-ink-900/50">{t('game.debrief.played')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {branch && (
            <p className="mt-1.5 font-serif text-[12px] italic leading-snug text-ink-900/80">
              {t(`game.guide.suggest.why.${whyKey(branch.action)}`, { name: machine })}
            </p>
          )}
          {branch && !road.followed && branch.after.phase !== 'game-over' && (
            <button type="button" onClick={follow} className="btn-strike mt-1.5 !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
              {t('game.debrief.follow', { n: FOLLOW })}
            </button>
          )}
          {road.followed && (
            <p className="mt-1.5 font-sans text-[11px] leading-snug text-ink-900/85">
              {t('game.debrief.followed', { moves: road.followed.moves.map((f) => `${f.seat === me ? t('game.debrief.you') : game.players[f.seat]?.name} · ${describeAction(f.action)}`).join(' — ') })}
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
              <button key={m.at} type="button" onClick={() => { setAt(m.at + 1); setRoad(null); }} className={cn('rounded-md border px-2 py-1 text-left font-sans text-[10.5px] transition-colors', at === m.at + 1 ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/50 text-cream-100/75 hover:border-brass-400')}>
                {t('game.debrief.round', { round: m.round, era: t(m.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })} · <span className="text-rust-400">{t(`game.debrief.quality.${m.grade}`)}</span> <span className="font-mono text-[10px] text-rust-400/80">{t('game.debrief.lost', { p: Math.round(m.loss * 100) })}</span>
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
          const mine = seat === me;
          const v = mine ? verdicts[k] : undefined;
          const quality = v ? v.grade : null;
          const newRound = k === 0 || positions[k - 1]?.round !== before.round;
          return (
            <li key={k} data-at={k + 1}>
              {newRound && <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-cream-100/40">{t('game.debrief.round', { round: before.round, era: t(before.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })}</p>}
              <button type="button" onClick={() => { setAt(k + 1); setRoad(null); }} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] transition-colors', at === k + 1 && !road ? 'bg-brass-500/15 text-cream-100' : 'text-cream-100/70 hover:bg-coal-800/70')}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[p?.color]?.hex ?? '#C9A45C' }} />
                <span className={cn('w-14 shrink-0 truncate font-mono text-[10px]', mine ? 'text-brass-300' : 'text-cream-100/45')}>{mine ? t('game.debrief.you') : p?.name}</span>
                <span className="min-w-0 flex-1 truncate">{describeAction(a)}</span>
                {quality && quality !== 'top' && quality !== 'good' && <span className={cn('shrink-0 font-fell text-[9px] uppercase tracking-[0.14em]', quality === 'blunder' ? 'text-rust-400' : quality === 'mistake' ? 'text-copper-500' : 'text-cream-100/50')}>{t(`game.debrief.quality.${quality}`)}</span>}
                {v && v.loss > LOSS.good && <span className="shrink-0 font-mono text-[9.5px] text-rust-400/80">−{Math.round(v.loss * 100)}</span>}
                <span className={cn('w-8 shrink-0 text-right font-mono text-[10px]', deep[k + 1] !== undefined ? 'text-cream-100/70' : 'text-cream-100/35')}>{pct(chances[k + 1] ?? 0.5)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
