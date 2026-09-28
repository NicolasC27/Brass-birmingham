import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Compass, Play, Sparkles, UserRound, X } from 'lucide-react';
import { describeAction, useGame } from '@/game/store';
import { applyAction, setupOf } from '@/game/actions';
import { LOSS, PASSES, bandOf, followToTurn, gradeOfLoss, positionsOf, roadsFrom, sameRoad, winChance } from '@/game/analysis';
import type { Followed, Reading, Road, Verdict, Weighed } from '@/game/analysis';
import type { Grade } from '@/game/review';
import type { Note } from '@/game/analysisWorker';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { PLAYER_COLORS } from '@/game/data';
import { useLang, useT } from '@/i18n';
import { forkLocalGame } from '@/game/local';
import { analysisKey, keepAnalysis, readKept } from '@/game/analysisKeep';
import { PLAN_FAINT, PLAN_NAMES, planOf } from '@/game/plan';
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
const EMPTY_DEEP: Record<number, Reading> = {};
const EMPTY_VERDICTS: Record<number, Verdict> = {};
const EMPTY_ROADS: Record<string, Weighed[]> = {};
/** the entry no reading belongs to: what the panel holds before the judge has
    said a word, so the reading kept from last time is the one on show */
const NO_ENTRY = '';
const pct = (p: number) => Math.round(p * 100);
/** one decimal, in the reader's tongue: roads often sit under a point apart */
const fine = (p: number, lang: string) => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p * 100);
/* the game as a line, the way a chess site draws an evaluation: the
   reader's chance after every move, lit above the half-way mark and dark
   below it, the eras named, the wider misses as dots; a press picks, a
   drag scrubs, a hover reads the figure. The judge's own doubt is drawn
   too: a ribbon between the lowest and the highest of its passes, and a
   dashed line as long as a stretch has been read by one pass only */
function Curve({ chances, reads, settled, at, marks, split, label, eras, vary, onPick }: { chances: number[]; reads: (Reading | undefined)[]; settled: boolean[]; at: number; marks: Record<number, Verdict>; split: number; label: string; eras: [string, string]; vary: { from: number; chances: number[] } | null; onPick: (k: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setW(Math.round(width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState<number | null>(null);
  const H = 112;
  const TOP = 16;
  const BOTTOM = 6;
  const last = Math.max(1, chances.length - 1);
  const x = (k: number) => (k / last) * w;
  const y = (c: number) => TOP + (1 - c) * (H - TOP - BOTTOM);
  const mid = y(0.5);
  /* a soft line through the points: Catmull-Rom turned into cubic curves */
  const smooth = (pts: (readonly [number, number])[]): string => {
    if (!pts.length) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const pts = chances.map((c, k) => [x(k), y(c)] as const);
  const line = smooth(pts);
  const areaDown = `${line} L${w},${H} L0,${H} Z`;
  const areaUp = `${line} L${w},0 L0,0 Z`;
  /* the judge's doubt: the passes' highest edge out, their lowest back */
  const doubt = reads.some((r) => r && r.high > r.low)
    ? `${smooth(chances.map((c, k) => [x(k), y(reads[k]?.high ?? c)] as const))} ${smooth(chances.map((c, k) => [x(k), y(reads[k]?.low ?? c)] as const).reverse()).replace(/^M/, 'L')} Z`
    : '';
  /* how far the reading has settled: every position up to here has been
     read by every pass, so the line is drawn full rather than dashed */
  let front = -1;
  while (front + 1 < chances.length && settled[front + 1]) front += 1;
  const misses = Object.values(marks).filter((m) => m.grade !== 'top' && m.grade !== 'good');
  const kAt = (el: Element, clientX: number) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(last, Math.round(((clientX - r.left) / r.width) * last)));
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser does not track: the press still picks */
    }
    onPick(kAt(e.currentTarget, e.clientX));
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const k = kAt(e.currentTarget, e.clientX);
    if (e.buttons & 1) onPick(k);
    else setHover(k);
  };
  /* a marker: the hairline, the bead on the line, the figure beside it */
  const mark = (k: number, strong: boolean) => {
    const cx = x(k);
    const cy = y(chances[k] ?? 0.5);
    /* the spread between the passes, when they disagreed by a point or more */
    const r = reads[k];
    const band = r ? Math.round(((r.high - r.low) / 2) * 100) : 0;
    const text = `${k} · ${Math.round((chances[k] ?? 0.5) * 100)} %${band > 0 ? ` ± ${band}` : ''}`;
    const right = cx > w - 56;
    return (
      <g key={strong ? 'at' : 'hover'} pointerEvents="none">
        <line x1={cx} x2={cx} y1={TOP - 4} y2={H} stroke={strong ? '#F5EBD7' : 'rgba(245,235,215,0.45)'} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3} fill={strong ? '#F5EBD7' : '#C9A45C'} stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
        <text x={right ? cx - 5 : cx + 5} y={TOP - 5} textAnchor={right ? 'end' : 'start'} fill={strong ? '#F5EBD7' : 'rgba(245,235,215,0.7)'} fontSize={9.5} fontFamily="ui-monospace, monospace">
          {text}
        </text>
      </g>
    );
  };
  return (
    <div ref={box} className="w-full">
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerLeave={() => setHover(null)} className="block h-28 w-full cursor-crosshair touch-none select-none rounded-sm border border-brass-700/40 bg-coal-900/80">
        <defs>
          <clipPath id="curve-above">
            <rect x={0} y={0} width={w} height={mid} />
          </clipPath>
          <clipPath id="curve-below">
            <rect x={0} y={mid} width={w} height={H - mid} />
          </clipPath>
        </defs>
        {/* the ground: lit where the reader stood above even, dark below */}
        <path d={areaDown} fill="rgba(201,164,92,0.28)" clipPath="url(#curve-above)" />
        <path d={areaUp} fill="rgba(20,14,10,0.55)" clipPath="url(#curve-below)" />
        {[0.25, 0.75].map((c) => (
          <line key={c} x1={0} x2={w} y1={y(c)} y2={y(c)} stroke="rgba(245,235,215,0.08)" strokeWidth={1} />
        ))}
        <line x1={0} x2={w} y1={mid} y2={mid} stroke="rgba(245,235,215,0.35)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={4} y={mid - 3} fill="rgba(245,235,215,0.4)" fontSize={9} fontFamily="ui-monospace, monospace">50 %</text>
        {/* the eras */}
        {split > 0 && <line x1={x(split)} x2={x(split)} y1={0} y2={H} stroke="rgba(245,235,215,0.22)" strokeWidth={1} />}
        <text x={4} y={H - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[0].toUpperCase()}</text>
        {split > 0 && <text x={x(split) + 4} y={H - 4} fill="rgba(245,235,215,0.4)" fontSize={8} fontFamily="IM Fell English, serif" letterSpacing={1.2}>{eras[1].toUpperCase()}</text>}
        {doubt && <path d={doubt} fill="rgba(231,201,120,0.22)" stroke="none" />}
        {/* the line: dashed while a stretch is read by one pass only */}
        <path d={line} fill="none" stroke="#E7C978" strokeOpacity={0.45} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        {front > 0 && <path d={smooth(pts.slice(0, front + 1))} fill="none" stroke="#E7C978" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
        {misses.map((m) => (
          <circle key={m.at} cx={x(m.at + 1)} cy={y(chances[m.at + 1] ?? 0.5)} r={3} fill={m.grade === 'blunder' ? '#B4472E' : m.grade === 'mistake' ? '#C97A3B' : '#E7D6AE'} stroke="rgba(0,0,0,0.6)" strokeWidth={1}>
            <title>{`${m.at + 1} · −${Math.round(m.loss * 100)} %`}</title>
          </circle>
        ))}
        {/* the variation, dashed, leaving the game where it does */}
        {vary && vary.chances.length > 1 && (
          <g pointerEvents="none">
            <path d={vary.chances.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(vary.from + i).toFixed(1)},${y(c).toFixed(1)}`).join(' ')} fill="none" stroke="#F5EBD7" strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />
            <circle cx={x(vary.from + vary.chances.length - 1)} cy={y(vary.chances[vary.chances.length - 1])} r={3} fill="#F5EBD7" stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
          </g>
        )}
        {hover !== null && hover !== at && mark(hover, false)}
        {mark(at, true)}
      </svg>
    </div>
  );
}

export default function Debrief({ game, me: opened }: { game: GameState; me: number }) {
  const [me, setMe] = useState(opened);
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  /* where this game is kept: the table it was played at, its deal and the seat read */
  const table = useGame((s) => s.code ?? s.local ?? 'x');
  const keptKey = analysisKey(table, game.seed, me);
  const setReview = useGame((s) => s.setReview);
  const flyToRegion = useGame((s) => s.flyToRegion);
  /* every position, once: positions[k] is the table after k moves */
  const positions = useMemo(() => positionsOf(game), [game]);
  const last = positions.length - 1;
  /* the long judge's figures as they land: a chance per position, a verdict
     per turn of the reader's — or, when this game was read before, the whole
     of the last reading, on the board before the first frame */
  const [judged, setJudged] = useState<{ of: GameState; key: string; deep: Record<number, Reading>; verdicts: Record<number, Verdict>; done: number; total: number }>({ of: game, key: NO_ENTRY, deep: {}, verdicts: {}, done: 0, total: 0 });
  /* the last reading of this game and this seat, if this browser kept one */
  const kept = useMemo(() => readKept(keptKey, game.actions.length), [keptKey, game]);
  const fresh = judged.of === game && judged.key === keptKey;
  const deep = fresh ? judged.deep : (kept?.deep ?? EMPTY_DEEP);
  const verdicts = fresh ? judged.verdicts : (kept?.verdicts ?? EMPTY_VERDICTS);
  const progress = fresh ? judged : { done: kept?.total ?? 0, total: kept?.total ?? 0 };
  const chances = useMemo(() => positions.map((p, k) => deep[k]?.chance ?? winChance(p, me)), [positions, me, deep]);
  /* the reading at each position, and whether every pass has been through it */
  const reads = useMemo(() => positions.map((_, k) => deep[k]), [positions, deep]);
  const settled = useMemo(() => reads.map((r) => !!r && r.passes > 1), [reads]);
  const [at, setAt] = useState(last);
  /* the roads being explored: from which move, which one is picked (by what it does, so the judge's later figures keep the pick), and the tail played on */
  /* the variation being explored, the way a chess line is: from which move
     it leaves the game, the moves played along it (the reader's picks and
     the machine's replies), the road picked at its tip, and which of its
     moves the board shows (null: the tip, or the pick) */
  const [vary, setVary] = useState<{ from: number; moves: Followed[]; picked: string | null; step: number | null } | null>(null);
  /* roads read longer, by the line of moves that leads to them */
  const [deeper, setDeeper] = useState<{ of: GameState; key: string; byKey: Record<string, Weighed[]> }>({ of: game, key: NO_ENTRY, byKey: {} });
  const roadsRead = deeper.of === game && deeper.key === keptKey ? deeper.byKey : (kept?.roads ?? EMPTY_ROADS);
  /* the lines already sent for a longer reading, so each goes once */
  const asked = useRef<Set<string>>(new Set());
  const machine = game.players.find((p) => p.isBot)?.name ?? t('game.debrief.machine');

  /* the long judge thinks on a thread of its own and posts as it goes */
  useEffect(() => {
    /* what a note lands on: the reading under way, or the one kept from last
       time — a road read longer joins a reading that came off the shelf */
    const ground = (j: { of: GameState; key: string }) => (j.of === game && j.key === keptKey ? null : { of: game, key: keptKey, deep: kept?.deep ?? {}, verdicts: kept?.verdicts ?? {}, done: kept?.total ?? 0, total: kept?.total ?? 0 });
    let w: Worker | null = null;
    try {
      w = new Worker(new URL('../../game/analysisWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    w.onmessage = (e: MessageEvent<Note>) => {
      const n = e.data;
      if (n.kind === 'roads') {
        setDeeper((d) => ({ of: game, key: keptKey, byKey: { ...(d.of === game && d.key === keptKey ? d.byKey : (kept?.roads ?? {})), [n.key]: n.roads } }));
        /* the longer reading of one of the game's own turns is the best
           reading there is of it: the curve, the list and the grade take it,
           so the same position never shows two figures */
        const own = /^(\d+)\|$/.exec(n.key);
        if (own) {
          const k = Number(own[1]);
          const played = game.actions[k];
          const mine = played ? n.roads.find((r) => sameRoad(r.action) === sameRoad(played)) : undefined;
          if (mine && n.roads.length) {
            const best = Math.max(mine.chance, n.roads[0].chance);
            const loss = Math.max(0, best - mine.chance);
            setJudged((j) => {
              const base = ground(j) ?? j;
              const v = base.verdicts[k];
              return { ...base, deep: { ...base.deep, [k + 1]: { chance: mine.chance, low: mine.chance, high: mine.chance, passes: PASSES.length } }, verdicts: v ? { ...base.verdicts, [k]: { ...v, roads: n.roads, mine: mine.chance, best, loss, grade: gradeOfLoss(loss) } } : base.verdicts };
            });
          }
        }
        return;
      }
      setJudged((j) => {
        const base = ground(j) ?? j;
        if (n.kind === 'position') return { ...base, deep: { ...base.deep, [n.k]: { chance: n.chance, low: n.low, high: n.high, passes: n.passes } }, done: n.done, total: n.total };
        if (n.kind === 'turn') return { ...base, verdicts: { ...base.verdicts, [n.verdict.at]: n.verdict }, done: n.done, total: n.total };
        if (n.kind === 'done') return { ...base, done: base.total };
        return base;
      });
    };
    /* read before, by this judge, on this game: the figures stand as they were
       and nothing is thought again — only the roads of a line never explored
       still go to the worker */
    const before = readKept(keptKey, game.actions.length);
    if (!before) w.postMessage({ setup: setupOf(game), seed: game.seed, actions: game.actions, me });
    workerRef.current = w;
    asked.current = new Set(Object.keys(before?.roads ?? {}));
    return () => {
      w?.terminate();
      workerRef.current = null;
    };
  }, [game, me, keptKey, kept]);
  const workerRef = useRef<Worker | null>(null);
  /* the reading kept, once it is whole: the panel opens on it next time, and
     a road read longer since joins it */
  useEffect(() => {
    if (!progress.total || progress.done < progress.total) return;
    keepAnalysis(keptKey, game.actions.length, { deep, verdicts, roads: roadsRead, total: progress.total });
  }, [deep, verdicts, roadsRead, progress.done, progress.total, keptKey, game]);
  /* the key moments: where the curve fell hardest, whoever moved — the
     reader's own miss or a rival's stroke */
  const keyMoments = useMemo(() => {
    const drops: { k: number; drop: number }[] = [];
    for (let k = 1; k < chances.length; k++) {
      const drop = chances[k - 1] - chances[k];
      if (drop > LOSS.good) drops.push({ k, drop });
    }
    return drops
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 3)
      .map(({ k, drop }) => {
        const before = positions[k - 1];
        const a = game.actions[k - 1];
        const seat = a?.kind === 'concede' ? a.player : before.current;
        return { k, drop, round: before.round, era: before.era, seat };
      });
  }, [chances, positions, game.actions]);

  /* the variation's ground and tip */
  const base = vary ? positions[vary.from - 1] : undefined;
  const tip = vary ? (vary.moves.length ? vary.moves[vary.moves.length - 1].after : base) : undefined;
  const tipMine = !!tip && tip.phase === 'action' && tip.current === me;
  /* the line of moves that leads to the tip, as the worker names it */
  const lineKey = vary ? `${vary.from - 1}|${vary.moves.map((m) => JSON.stringify(m.action)).join(';')}` : '';
  /* the roads at the tip: the longer reading once it has come, the pass's
     verdict where the tip is the game's own position, the short judge's meanwhile */
  const roads = useMemo<Road[]>(() => {
    if (!vary || !tip || !tipMine) return [];
    const weighed = roadsRead[lineKey] ?? (vary.moves.length === 0 ? verdicts[vary.from - 1]?.roads : undefined);
    if (weighed) return weighed.map((r) => ({ action: r.action, after: applyAction(tip, me, r.action).state, chance: r.chance })).filter((r): r is Road => !!r.after);
    return roadsFrom(tip, me, 8, vary.moves.length === 0 ? game.actions[vary.from - 1] : undefined);
  }, [vary, tip, tipMine, lineKey, verdicts, roadsRead, me, game]);
  const pickedAt = vary?.picked ? roads.findIndex((r) => sameRoad(r.action) === vary.picked) : -1;
  const branch = pickedAt >= 0 ? roads[pickedAt] : null;
  /* the tip's roads go to the worker for a longer reading, once per line */
  useEffect(() => {
    if (!vary || !tipMine || !roads.length) return;
    const w = workerRef.current;
    if (!w || asked.current.has(lineKey)) return;
    asked.current.add(lineKey);
    w.postMessage({ setup: setupOf(game), seed: game.seed, actions: [...game.actions.slice(0, vary.from - 1), ...vary.moves.map((m) => m.action)], me, roads: roads.map((r) => r.action), key: lineKey });
  }, [vary, tipMine, roads, lineKey, game, me]);
  const readingLonger = !!vary && tipMine && !roadsRead[lineKey];
  /* what the board shows */
  const stepMove = vary && vary.step !== null ? vary.moves[vary.step] : undefined;
  const shown = vary ? (stepMove?.after ?? branch?.after ?? tip) : positions[at];
  const firstPick = vary?.moves.find((m) => m.pick)?.action ?? branch?.action;
  /* the variation's own chances, for the curve: from the ground, move by move, the pick at the end */
  const varyChances = useMemo(() => {
    if (!vary) return null;
    const line = [chances[vary.from - 1] ?? 0.5, ...vary.moves.map((m) => winChance(m.after, me))];
    if (branch && vary.step === null) line.push(branch.chance);
    return { from: vary.from - 1, chances: line };
  }, [vary, chances, branch, me]);

  /* the board follows: the table after move `at`, or the variation's move on show */
  useEffect(() => {
    const state = shown;
    if (!state) return;
    const n = vary ? (stepMove ? vary.step! + 1 : vary.moves.length + (branch ? 1 : 0)) : 0;
    const label = vary && firstPick
      ? n <= 1
        ? t(vary.moves.length && !stepMove ? 'game.debrief.branchOnOne' : 'game.debrief.branch', { move: describeAction(firstPick) })
        : t(n === 1 ? 'game.debrief.branchOnOne' : 'game.debrief.branchOn', { move: describeAction(firstPick), n })
      : at === 0 ? t('game.debrief.start') : `${at}/${last} · ${describeAction(game.actions[at - 1])}`;
    const onShow = vary ? (stepMove ?? (branch ? { seat: me, action: branch.action } : vary.moves[vary.moves.length - 1])) : undefined;
    const played = onShow ? onShow.action : game.actions[at - 1];
    const before = positions[at - 1];
    const seat = onShow ? onShow.seat : played && before ? (played.kind === 'concede' ? played.player : before.current) : undefined;
    setReview({ at, round: state.round, state, label, ...(seat !== undefined ? { seat } : {}) });
    const where = regionOf(played);
    if (where) flyToRegion(where);
  }, [at, vary, shown, stepMove, branch, firstPick, positions, game.actions, setReview, flyToRegion, last, t, me]);
  /* the seat's own game in one line: how its moves were graded, and what
     they left on the table all told */
  const tally = useMemo(() => {
    const list = Object.values(verdicts);
    if (!list.length) return null;
    const by = { top: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 } as Record<Grade, number>;
    let lost = 0;
    for (const v of list) {
      by[v.grade] += 1;
      lost += v.loss;
    }
    /* the mean, not the sum: chances lost by ten moves do not add up to a
       tenth of anything, and a total past a hundred per cent reads broken */
    return { by, lost: Math.round((100 * lost) / list.length) };
  }, [verdicts]);
  /* the plan the seat played, as the strategy guide names them: counted from
     the moves alone, and read against what each plan asks for */
  const plan = useMemo(() => planOf(game, me), [game, me]);
  /* the moves that cost more than a good one: what the arrows jump between */
  const misses = useMemo(() => Object.values(verdicts).filter((v) => v.loss > LOSS.good).map((v) => v.at + 1).sort((a, b) => a - b), [verdicts]);
  const nextMiss = useCallback((dir: 1 | -1): number | null => (dir > 0 ? misses.find((k) => k > at) : [...misses].reverse().find((k) => k < at)) ?? null, [misses, at]);
  const jump = (dir: 1 | -1) => {
    const k = nextMiss(dir);
    if (k === null) return;
    setAt(k);
    setVary(null);
  };
  /* the arrows step through the game */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') setAt((k) => Math.max(0, k - 1));
      else if (e.key === 'ArrowRight') setAt((k) => Math.min(last, k + 1));
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const k = nextMiss(e.key === 'ArrowDown' ? 1 : -1);
        if (k === null) return;
        setAt(k);
      } else return;
      e.preventDefault();
      setVary(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    /* the jump reads the misses and where the cursor stands, so the listener
       is bound again whenever either moves */
  }, [last, nextMiss]);

  /* the figure in the header, on the same reading as the curve and the roads */
  const chance = vary ? (stepMove ? winChance(stepMove.after, me) : branch ? branch.chance : vary.moves.length && tip ? winChance(tip, me) : (chances[at] ?? 0.5)) : (chances[at] ?? 0.5);
  /* how sure that figure is: half the spread of the passes, in points, and
     nothing at all along a variation, which is read once */
  const band = vary || !reads[at] ? 0 : Math.round(bandOf(reads[at]) * 100);
  /* the figure of a position still being read is held lightly */
  const reading = !vary && !settled[at];
  const explore = () => setVary({ from: at, moves: [], picked: null, step: null });
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
    if (lesson) setVary({ from: at, moves: [], picked: sameRoad(lesson.better), step: null });
  };
  /* the position on show becomes a table of this device: the reader plays
     on from there, the machines with them */
  const playFrom = () => {
    if (!shown || shown.phase !== 'action') return;
    const code = forkLocalGame(shown);
    setDebriefOpen(false);
    navigate(`/game/local/${code}`);
  };
  /* the pick joins the line and the machine answers until the reader's next
     turn; with no pick at a tip of theirs, the machine plays them too */
  const follow = () => {
    if (!vary || !tip) return;
    const picked: Followed[] = branch ? [{ seat: me, action: branch.action, after: branch.after, pick: true }] : [];
    const from = branch ? branch.after : tip;
    const more = followToTurn(from, me);
    if (!picked.length && !more.length) return;
    setVary({ ...vary, moves: [...vary.moves, ...picked, ...more], picked: null, step: null });
  };
  /* back to one of the picks along the line: the roads there again, that pick selected */
  const backTo = (i: number) => {
    if (!vary) return;
    setVary({ from: vary.from, moves: vary.moves.slice(0, i), picked: sameRoad(vary.moves[i].action), step: null });
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
        <label className="flex items-center gap-1 text-cream-100/60" title={t('game.debrief.seat')}>
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[me]?.color]?.hex ?? '#C9A45C' }} />
          <select aria-label={t('game.debrief.seat')} value={me} onChange={(e) => { setMe(Number(e.target.value)); setVary(null); }} className="max-w-[120px] rounded border border-brass-700/50 bg-coal-900 px-1 py-0.5 font-sans text-[11px] text-cream-100">
            {game.players.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={close} aria-label={t('game.debrief.close')} title={t('game.debrief.close')} className="rounded-md border border-brass-700/50 p-1 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* the judge's chance, for the position on the board */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className={cn('font-sans text-[11px] transition-colors', reading ? 'text-cream-100/40' : 'text-cream-100/70')} title={reading ? t('game.debrief.stillReading') : band ? t('game.debrief.spread', { passes: reads[at]?.passes ?? 1, band }) : undefined}>
            {band ? t('game.debrief.chanceBand', { p: pct(chance), band }) : t('game.debrief.chance', { p: pct(chance) })}
          </span>
          <span className="font-mono text-[10.5px] text-cream-100/45">{at === 0 ? t('game.debrief.start') : at === last && game.phase === 'game-over' ? t('game.debrief.endOf') : `${at}/${last}`}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-coal-800" aria-hidden>
          <div className="h-full rounded-full bg-brass-400 transition-[width] duration-300" style={{ width: `${pct(chance)}%` }} />
        </div>
        <div className="mt-2">
          <Curve chances={chances} reads={reads} settled={settled} at={at} marks={verdicts} vary={varyChances} split={positions.findIndex((p) => p.era === 'rail')} label={t('game.debrief.curve')} eras={[t('game.topbar.eraCanal'), t('game.topbar.eraRail')]} onPick={(k) => { setAt(k); setVary(null); }} />
          {/* how far the judge has got, a hair under the curve: it keeps its
              room once read, so nothing below it moves */}
          <div className={cn('mt-1 h-[3px] w-full overflow-hidden rounded-full bg-coal-800 transition-opacity', progress.done < progress.total ? 'opacity-100' : 'opacity-0')} title={t('game.debrief.reading', { done: progress.done, total: progress.total })}>
            <div className="h-full rounded-full bg-brass-400/50 transition-[width] duration-300" style={{ width: `${progress.total ? Math.round((100 * progress.done) / progress.total) : 0}%` }} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" onClick={() => { setAt((k) => Math.max(0, k - 1)); setVary(null); }} disabled={at === 0} aria-label={t('game.debrief.prev')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setAt((k) => Math.min(last, k + 1)); setVary(null); }} disabled={at === last} aria-label={t('game.debrief.next')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {/* faute à faute, the way a game is read again: the arrows up and down */}
          <button type="button" onClick={() => jump(-1)} disabled={nextMiss(-1) === null} aria-label={t('game.debrief.prevMiss')} title={t('game.debrief.prevMiss')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => jump(1)} disabled={nextMiss(1) === null} aria-label={t('game.debrief.nextMiss')} title={t('game.debrief.nextMiss')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
          {shown?.phase === 'action' && (
            <button type="button" onClick={playFrom} title={t('game.debrief.playFrom')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[10px]">
              <Play className="h-3.5 w-3.5" /> {t('game.debrief.playFrom')}
            </button>
          )}
          {canExplore && !vary && (
            <button type="button" onClick={explore} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              <Compass className="h-3.5 w-3.5" /> {t('game.debrief.explore')}
            </button>
          )}
          {vary && (
            <button type="button" onClick={() => setVary(null)} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              {t('game.debrief.backToLine')}
            </button>
          )}
        </div>
      </div>

      {/* the seat's game in one line: its moves graded, and what they cost */}
      {tally && !vary && (
        <div className="shrink-0">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.tally.label')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(['top', 'good', 'inaccuracy', 'mistake', 'blunder'] as Grade[]).filter((g) => tally.by[g] > 0).map((g) => (
              <span key={g} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px]', g === 'blunder' ? 'border-rust-700/60 text-rust-400' : g === 'mistake' ? 'border-copper-500/50 text-copper-500' : g === 'inaccuracy' ? 'border-brass-700/50 text-cream-100/70' : 'border-brass-700/40 text-cream-100/50')}>
                {t(`game.debrief.tally.${g}`, { n: tally.by[g] })}
              </span>
            ))}
            {tally.lost > 0 && <span className="font-mono text-[10px] text-rust-400/80">{t('game.debrief.tally.lost', { p: tally.lost })}</span>}
          </div>
        </div>
      )}

      {/* the plan the moves add up to, against the guide's five */}
      {!vary && plan.deeds.actions > 0 && (
        <div className="shrink-0">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.plan.label')}</p>
          {plan.best.score < PLAN_FAINT ? (
            <p className="mt-1 font-serif text-[12px] italic leading-snug text-cream-100/60">{t('game.debrief.plan.faint')}</p>
          ) : (
            <>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-fell text-[13px] text-brass-300">{PLAN_NAMES[plan.best.id]}</span>
                <span className="font-mono text-[10.5px] text-cream-100/60">{t('game.debrief.plan.score', { p: Math.round(plan.best.score * 100) })}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {plan.best.goals.map((g) => {
                  const met = g.done >= g.target;
                  return (
                    <span key={g.id} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px]', met ? 'border-brass-500/60 text-brass-300' : 'border-brass-700/40 text-cream-100/45')}>
                      <span className="font-mono">{g.done}/{g.target}</span> {t(`game.debrief.plan.goals.${g.id}`)}
                    </span>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-1 font-mono text-[10px] text-cream-100/45">
            {plan.tips.map((tip) => t(`game.debrief.plan.tips.${tip.id}`, { value: tip.id === 'perAction' ? fine(tip.value / 100, lang) : tip.value, want: tip.want, n: tip.value })).join(' · ')}
          </p>
        </div>
      )}

      {/* the variation: its picks as a trail, the roads at its tip, its moves */}
      {vary && (
        <div className="paper shrink-0 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1 font-sans text-[10.5px] text-ink-900/70">
            <span className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.debrief.roads')}</span>
            {vary.moves.map((m, i) => (m.pick ? (
              <span key={i} className="flex items-center gap-1">
                <span aria-hidden>›</span>
                <button type="button" onClick={() => backTo(i)} className="rounded border border-ink-900/25 px-1.5 py-0.5 hover:bg-ink-900/10">
                  {t('game.debrief.roundShort', { round: (i === 0 ? base : vary.moves[i - 1].after)?.round ?? '' })} · {describeAction(m.action)}
                </button>
              </span>
            ) : null))}
            {branch && <span className="flex items-center gap-1"><span aria-hidden>›</span><span className="rounded border border-brass-500 bg-brass-500/15 px-1.5 py-0.5">{t('game.debrief.roundShort', { round: tip?.round ?? '' })} · {describeAction(branch.action)}</span></span>}
          </div>
          {tipMine && (
            <ul className="mt-1 flex flex-col gap-1">
              {roads.map((r, i) => {
                const same = vary.moves.length === 0 && sameRoad(r.action) === sameRoad(game.actions[vary.from - 1]);
                return (
                  <li key={i}>
                    <button type="button" onClick={() => setVary({ ...vary, picked: pickedAt === i ? null : sameRoad(r.action), step: null })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', pickedAt === i && vary.step === null && 'bg-ink-900/10 ring-1 ring-brass-500')}>
                      <span className="w-10 shrink-0 font-mono text-[10.5px] font-semibold text-ink-900">{t('game.debrief.road', { p: fine(r.chance, lang) })}</span>
                      <span className="min-w-0 flex-1 truncate">{describeAction(r.action)}</span>
                      {same && <span className="shrink-0 font-fell text-[9px] uppercase tracking-[0.14em] text-ink-900/50">{t('game.debrief.played')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {branch && (
            <p className="mt-1.5 font-serif text-[12px] italic leading-snug text-ink-900/80">
              {t(`game.guide.suggest.why.${whyKey(branch.action)}`, { name: machine })}
            </p>
          )}
          {readingLonger && <p className="mt-1 font-mono text-[9.5px] text-ink-900/50">{t('game.debrief.deeper')}</p>}
          {(branch || (vary.moves.length > 0 && tip?.phase !== 'game-over')) && (
            <button type="button" onClick={follow} className="btn-strike mt-1.5 !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
              {branch ? t('game.debrief.follow') : t('game.debrief.followMore')}
            </button>
          )}
          {vary.moves.length > 0 && (
            <ol className="mt-1.5 flex flex-col gap-0.5">
              {vary.moves.map((f, i) => {
                const on = vary.step === i || (vary.step === null && !branch && i === vary.moves.length - 1);
                return (
                  <li key={i}>
                    <button type="button" onClick={() => setVary({ ...vary, step: i })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', on && 'bg-ink-900/10 ring-1 ring-brass-500')}>
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[f.seat]?.color]?.hex ?? '#C9A45C' }} />
                      <span className="w-14 shrink-0 truncate font-mono text-[10px] text-ink-900/60">{f.seat === me ? t('game.debrief.you') : game.players[f.seat]?.name}</span>
                      <span className="min-w-0 flex-1 truncate">{describeAction(f.action)}</span>
                      {f.pick && <Compass className="h-3 w-3 shrink-0 text-brass-700" aria-hidden />}
                      <span className="shrink-0 font-mono text-[10px] text-ink-900/70">{pct(winChance(f.after, me))}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* the key moments, the widest gaps once read */}
      {keyMoments.length > 0 && !vary && (
        <div className="shrink-0">
          <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.keyMoments')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {keyMoments.map((m) => (
              <button key={m.k} type="button" onClick={() => { setAt(m.k); setVary(null); }} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-left font-sans text-[10.5px] transition-colors', at === m.k ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/50 text-cream-100/75 hover:border-brass-400')}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[m.seat]?.color]?.hex ?? '#C9A45C' }} />
                <span>{t('game.debrief.round', { round: m.round, era: t(m.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })} · {m.seat === me ? t('game.debrief.you') : game.players[m.seat]?.name}</span>
                <span className="font-mono text-[10px] text-rust-400">{t('game.debrief.lost', { p: Math.round(m.drop * 100) })}</span>
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
              <button type="button" onClick={() => { setAt(k + 1); setVary(null); }} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] transition-colors', at === k + 1 && !vary ? 'bg-brass-500/15 text-cream-100' : 'text-cream-100/70 hover:bg-coal-800/70')}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[p?.color]?.hex ?? '#C9A45C' }} />
                <span className={cn('w-14 shrink-0 truncate font-mono text-[10px]', mine ? 'text-brass-300' : 'text-cream-100/45')}>{mine ? t('game.debrief.you') : p?.name}</span>
                <span className="min-w-0 flex-1 truncate">{describeAction(a)}</span>
                {quality && quality !== 'top' && quality !== 'good' && <span className={cn('shrink-0 font-fell text-[9px] uppercase tracking-[0.14em]', quality === 'blunder' ? 'text-rust-400' : quality === 'mistake' ? 'text-copper-500' : 'text-cream-100/50')}>{t(`game.debrief.quality.${quality}`)}</span>}
                {v && v.loss > LOSS.good && <span className="shrink-0 font-mono text-[9.5px] text-rust-400/80">−{Math.round(v.loss * 100)}</span>}
                <span className={cn('w-8 shrink-0 text-right font-mono text-[10px]', settled[k + 1] ? 'text-cream-100/70' : 'text-cream-100/35')}>{pct(chances[k + 1] ?? 0.5)}</span>
              </button>
              {/* what was better, under the move it was played instead of: the
                  lesson stays where the eye already is and nothing shifts */}
              {lesson && !vary && at === k + 1 && (
                <div className="paper my-1 px-3 py-2">
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
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
