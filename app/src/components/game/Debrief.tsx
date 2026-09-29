import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Compass, Eye, FileText, Gauge, HelpCircle, Link2, Play, Radio, Sparkles, Sun, SunDim, UserRound, X } from 'lucide-react';
import { describeAction, useGame } from '@/game/store';
import { applyAction, setupOf } from '@/game/actions';
import { LOSS, bandOf, followToTurn, judgeOf, positionsOf, roadsFrom, sameRoad, winChance } from '@/game/analysis';
import type { Cost, Followed, Reading, Road, Verdict, Weighed } from '@/game/analysis';
import type { Grade } from '@/game/review';
import type { Note } from '@/game/analysisWorker';
import type { GameAction } from '@/game/actions';
import type { GameState } from '@/game/types';
import { LINKS, MERCHANT_BY_ID, PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { useLang, useT } from '@/i18n';
import { forkLocalGame } from '@/game/local';
import { ledgerText } from '@/game/ledgerText';
import { shareFragment } from '@/game/share';
import { analysisKey, isWhole, readKept } from '@/game/analysisKeep';
import { keepRoads, onReading, readGame, reading as readingNow } from '@/game/analysisRun';
import { PLAN_FAINT, PLAN_NAMES, planOf } from '@/game/plan';
import { listProgress, motifsOf, recurring } from '@/game/progress';
import type { Motif } from '@/game/progress';
import type { PlanId } from '@/game/plan';
import { setBoardOption, useBoardOptions } from './boardOptions';
import { GUIDE_RAIL, REVIEW_CURVE_H, guideDock } from './guideKeys';
import AnalysisCurve from './AnalysisCurve';
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
const EMPTY_VERDICTS: Record<number, Verdict> = {};
const EMPTY_ALL: Record<number, Record<number, Verdict>> = {};
const EMPTY_ROADS: Record<string, Weighed[]> = {};
const EMPTY_SEATS: Record<number, Reading[]> = {};

const pct = (p: number) => Math.round(p * 100);
/** a difference with its sign, the nought bare */
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
/** one decimal, in the reader's tongue: roads often sit under a point apart */
const fine = (p: number, lang: string) => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p * 100);
export default function Debrief({ game: live, me: opened }: { game: GameState; me: number }) {
  /* the game as it stood when the panel opened. A game read at the turn of
     the eras is still being played: were the panel to follow every move, the
     judge would start over at each one. It reads the table it was opened on,
     and the next reading is asked for by opening it again. */
  const [game] = useState(live);
  /* the seat being read: mine, or the one the reader in charge is reading
     while I follow them */
  const [ownMe, setMe] = useState(opened);
  const ledSeat = useGame((s) => (s.following && s.shown && s.shown.seat !== undefined ? s.shown.seat : null));
  const me = ledSeat !== null && ledSeat >= 0 && ledSeat < live.players.length ? ledSeat : ownMe;
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  /* where this game is kept: the table it was played at, its deal and the seat read */
  const table = useGame((s) => s.code ?? s.local ?? 'x');
  /* one entry for the whole table: the positions are read for every seat at
     once, and only the verdicts belong to a seat */
  const judgeId = useGame((s) => s.judgeId);
  const setJudgeId = useGame((s) => s.setJudgeId);
  const keptKey = analysisKey(table, game.seed, judgeId);
  const setReview = useGame((s) => s.setReview);
  const flyToRegion = useGame((s) => s.flyToRegion);
  /* every position, once: positions[k] is the table after k moves */
  const positions = useMemo(() => positionsOf(game), [game]);
  const last = positions.length - 1;
  /* the long judge's figures as they land: a chance per position, a verdict
     per turn of the reader's — or, when this game was read before, the whole
     of the last reading, on the board before the first frame */
  /* the game is read once, by the reader the board started when the last move
     was played; the panel watches it rather than starting one of its own */
  const snap = useSyncExternalStore(onReading, readingNow, readingNow);
  const kept = useMemo(() => readKept(keptKey, game.actions.length), [keptKey, game]);
  const read = snap.key === keptKey && snap.moves === game.actions.length ? snap : kept;
  const seatsRead = read?.seats ?? EMPTY_SEATS;
  const verdicts = read?.verdicts[me] ?? EMPTY_VERDICTS;
  /* every seat's verdicts: the list marks them all, the review ranks the table */
  const allVerdicts = read?.verdicts ?? EMPTY_ALL;
  /* a reading under way for this key: its own figures. Another key's reading,
     or none: done only if the shelf holds this game whole — a judge just
     changed has its reading still to start, and the bar says so */
  const progress = snap.key === keptKey ? (snap.running ? { done: snap.done, total: snap.total } : { done: 1, total: 1 }) : isWhole(kept, game.actions.length) ? { done: 1, total: 1 } : { done: 0, total: 1 };
  /* the reading at each position, for the seat on show and for the others */
  const reads = useMemo(() => positions.map((_, k) => seatsRead[k]?.[me]), [positions, seatsRead, me]);
  const chances = useMemo(() => positions.map((p, k) => reads[k]?.chance ?? winChance(p, me)), [positions, me, reads]);
  /* the other seats, drawn faintly behind the line: the same reading, read
     from their chair — one continuation gives the whole table its chances */
  const rivals = useMemo(
    () =>
      game.players
        .map((p, i) => ({ seat: i, color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C', chances: positions.map((_, k) => seatsRead[k]?.[i]?.chance ?? null) }))
        .filter((r) => r.seat !== me && r.chances.some((c) => c !== null)),
    [game.players, positions, seatsRead, me],
  );
  /* a position is settled once every pass the chosen judge asks for has been
     through it — the quick judge asks for one, the others for three */
  const wantPasses = judgeOf(judgeId).passes.length;
  const settled = useMemo(() => reads.map((r) => !!r && r.passes >= wantPasses), [reads, wantPasses]);
  /* a link may point at a move: the panel opens there rather than at the end */
  const wanted = useGame((s) => s.reviewAt);
  const setReviewAt = useGame((s) => s.setReviewAt);
  const [ownAt, setOwnAt] = useState(wanted !== null && wanted >= 0 && wanted <= last ? wanted : last);
  /* the move on show: mine, or the one the reader in charge is showing while
     I follow them. A move of my own takes the wheel back at once */
  const followed = useGame((s) => (s.following && s.shown ? s.shown.at : null));
  const at = followed === null ? ownAt : Math.max(0, Math.min(last, followed));
  /* a branch of my own, or another seat: I stop following whoever was leading */
  const takeWheel = useCallback(<T,>(f: (x: T) => void) => (x: T) => {
    const st = useGame.getState();
    if (st.following) st.followReview(false);
    f(x);
  }, []);
  const setAt = useCallback((next: number | ((k: number) => number)) => {
    const st = useGame.getState();
    const from = st.following && st.shown ? Math.max(0, Math.min(last, st.shown.at)) : null;
    if (st.following) st.followReview(false);
    setOwnAt((k) => {
      const base = from ?? k;
      return typeof next === 'function' ? next(base) : next;
    });
  }, [last]);
  /* the roads being explored: from which move, which one is picked (by what it does, so the judge's later figures keep the pick), and the tail played on */
  /* the variation being explored, the way a chess line is: from which move
     it leaves the game, the moves played along it (the reader's picks and
     the machine's replies), the road picked at its tip, and which of its
     moves the board shows (null: the tip, or the pick) */
  const [ownVary, setVary] = useState<{ from: number; moves: Followed[]; picked: string | null; step: number | null } | null>(null);
  /* the line the reader in charge is exploring, played again here from its
     ground: a branch shown at the table is a branch everyone can read */
  const ledLine = useGame((s) => (s.following && s.shown ? (s.shown.line ?? null) : null));
  const followVary = useMemo(() => {
    if (!ledLine) return null;
    const ground = positions[ledLine.from - 1];
    if (!ground) return null;
    const moves: Followed[] = [];
    let cur = ground;
    for (const action of ledLine.moves) {
      const seat = cur.current;
      const after = applyAction(cur, seat, action).state;
      if (!after) break;
      moves.push({ seat, action, after });
      cur = after;
    }
    return { from: ledLine.from, moves, picked: null, step: null };
  }, [ledLine, positions]);
  const vary = ledLine ? followVary : ownVary;
  const setVaryMine = takeWheel(setVary);
  const setMeMine = takeWheel(setMe);
  /* roads read longer, by the line of moves that leads to them */
  const roadsRead = read?.roads[me] ?? EMPTY_ROADS;
  /* the lines already sent for a longer reading, so each goes once */
  const asked = useRef<Set<string>>(new Set());
  const machine = game.players.find((p) => p.isBot)?.name ?? t('game.debrief.machine');

  /* the reading is asked for, not started twice: the board may have it under
     way already, and a seat never judged has its turns read on their own */
  useEffect(() => {
    readGame(game, table, me, judgeId);
  }, [game, table, me, judgeId]);

  const workerRef = useRef<Worker | null>(null);
  /* what a miss cost, in points, by turn and seat: asked of the worker once,
     said under the lesson when it comes */
  const [costs, setCosts] = useState<Record<string, Cost | null>>({});
  /* the roads of a line, read longer, go to a worker of the panel's own: they
     are asked for as the reader explores, and join the one reading */
  useEffect(() => {
    let w: Worker | null = null;
    try {
      w = new Worker(new URL('../../game/analysisWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    w.onmessage = (e: MessageEvent<Note>) => {
      const n = e.data;
      /* a line read longer ranks what else could have been played there, and
         nothing else — the curve and the grades keep the one scale of the long
         judge, so no position ever shows two figures */
      if (n.kind === 'roads') keepRoads(keptKey, me, n.key, n.roads);
      if (n.kind === 'cost') setCosts((c) => ({ ...c, [n.key]: n.cost }));
    };
    workerRef.current = w;
    asked.current = new Set();
    return () => {
      w?.terminate();
      workerRef.current = null;
    };
  }, [game, me, keptKey]);
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
  /* the road actually played, when the line is a turn of the game: every other
     road is read against it */
  const playedRoad = vary && vary.moves.length === 0 ? (roads.find((r) => sameRoad(r.action) === sameRoad(game.actions[vary.from - 1]))?.chance ?? null) : null;
  const pickedAt = vary?.picked ? roads.findIndex((r) => sameRoad(r.action) === vary.picked) : -1;
  const branch = pickedAt >= 0 ? roads[pickedAt] : null;
  /* the tip's roads go to the worker for a longer reading, once per line */
  useEffect(() => {
    /* a turn of the game itself is already judged, roads and all, by the pass
       that read the game: only a branch the judge never saw is asked for */
    if (!vary || !tipMine || !roads.length || vary.moves.length === 0) return;
    const w = workerRef.current;
    if (!w || asked.current.has(lineKey)) return;
    asked.current.add(lineKey);
    const read = judgeOf(judgeId);
    w.postMessage({ setup: setupOf(game), seed: game.seed, actions: [...game.actions.slice(0, vary.from - 1), ...vary.moves.map((m) => m.action)], me, roads: roads.map((r) => r.action), key: lineKey, judge: read.judge, passes: read.passes });
  }, [vary, tipMine, roads, lineKey, game, me, judgeId]);
  const readingLonger = !!vary && tipMine && vary.moves.length > 0 && !roadsRead[lineKey];
  /* what the board shows */
  const stepMove = vary && vary.step !== null ? vary.moves[vary.step] : undefined;
  const shown = vary ? (stepMove?.after ?? branch?.after ?? tip) : positions[at];
  const firstPick = vary?.moves.find((m) => m.pick)?.action ?? branch?.action;
  /* the variation's own chances, for the curve: from the ground, move by move, the pick at the end */
  /* … and the other seats' along the same line: a move of mine moves
     everyone's chances, so their faint lines branch off with mine */
  const varyChances = useMemo(() => {
    if (!vary) return null;
    const line = [chances[vary.from - 1] ?? 0.5, ...vary.moves.map((m) => winChance(m.after, me))];
    if (branch && vary.step === null) line.push(branch.chance);
    const tail = [...vary.moves.map((m) => m.after), ...(branch && vary.step === null ? [branch.after] : [])];
    const seats = rivals.map((r) => ({ seat: r.seat, color: r.color, chances: [r.chances[vary.from - 1] ?? winChance(positions[vary.from - 1], r.seat), ...tail.map((st) => winChance(st, r.seat))] }));
    return { from: vary.from - 1, chances: line, seats };
  }, [vary, chances, branch, me, rivals, positions]);

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
    /* the hand the move was chosen from: the table before it, not after */
    const held = (vary ? (stepMove ? undefined : tip) : positions[at - 1]) ?? before ?? state;
    setReview({ at, round: state.round, state, label, reader: me, hand: held.players[me]?.hand, ...(seat !== undefined ? { seat } : {}) });
    const where = regionOf(played);
    if (where) flyToRegion(where);
  }, [at, vary, shown, stepMove, branch, firstPick, positions, tip, game.actions, setReview, flyToRegion, last, t, me]);
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
  /* every seat against the same judge: mean loss per move and the misses,
     the steadiest hand first — the seats not yet read wait with dots */
  const standings = useMemo(() => {
    return game.players
      .map((_, seat) => {
        const list = Object.values(allVerdicts[seat] ?? {});
        const lost = list.length ? Math.round((100 * list.reduce((sum, v) => sum + v.loss, 0)) / list.length) : 0;
        const misses = list.filter((v) => v.loss > LOSS.good).length;
        return { seat, n: list.length, lost, misses };
      })
      .sort((a, b) => (a.n && b.n ? a.lost - b.lost : b.n - a.n));
  }, [game.players, allVerdicts]);
  /* the motifs of this seat's misses here, and the ones that keep coming
     back over the last games on the sheet (this one included once read) */
  const motifs = useMemo(() => {
    const here = motifsOf(game, verdicts);
    const sheet = listProgress().filter((p) => p.seat === me || p.players === game.players.length);
    const back = recurring(sheet, 10);
    return { here: (Object.entries(here) as [Motif, number][]).sort((a, b) => b[1] - a[1]), back, games: Math.min(10, sheet.length) };
  }, [game, verdicts, me]);
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
    setVaryMine(null);
  };
  /* the arrows step through the game */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') setAt((k) => Math.max(0, k - 1));
      else if (e.key === 'ArrowRight') setAt((k) => Math.min(last, k + 1));
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const k = nextMiss(e.key === 'ArrowDown' ? 1 : -1);
        if (k === null) return;
        setAt(k);
      } else return;
      e.preventDefault();
      setVaryMine(null);
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
  const explore = () => setVaryMine({ from: at, moves: [], picked: null, step: null });
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
  /* what a move does, in the game's own words: the ledger lines it would
     have written from that position — the tile, its costs and where they
     came from, what flipped, what was earned */
  const linesOf = useCallback((before: GameState | undefined, seat: number, action: GameAction): string[] => {
    if (!before) return [];
    const after = applyAction(before, seat, action).state;
    if (!after) return [];
    const lines = after.ledger.slice(before.ledger.length).filter((e) => e.verb !== 'system').map((e) => ledgerText(e, t));
    /* a link's ledger line names its ends and no more: what it reaches and
       whom it serves is read off the table */
    if (action.kind === 'network') {
      for (const id of [action.link, action.second].filter((x): x is string => !!x)) {
        const def = LINKS.find((l) => l.id === id);
        if (!def) continue;
        for (const end of [def.a, def.b]) {
          const merchant = MERCHANT_BY_ID[end];
          if (merchant) {
            lines.push(t('game.debrief.reach', { merchant: merchant.name }));
            continue;
          }
          const town = TOWN_BY_ID[end];
          if (!town) continue;
          const n = town.slots.filter((_, i) => { const tile = before.tiles[`${end}:${i}`]; return tile && tile.owner === seat && !tile.flipped; }).length;
          if (n > 0) lines.push(t('game.debrief.serves', { n, town: town.name }));
        }
      }
    }
    return lines;
  }, [t]);
  const lessonLines = useMemo(() => (lesson ? linesOf(positions[at - 1], me, lesson.better) : []), [lesson, linesOf, positions, at, me]);
  const branchLines = useMemo(() => (branch && tip ? linesOf(tip, me, branch.action) : []), [branch, tip, linesOf, me]);
  const seeBetter = () => {
    if (lesson) setVaryMine({ from: at, moves: [], picked: sameRoad(lesson.better), step: null });
  };
  const costKey = lesson ? `${me}:${at - 1}` : '';
  const costAsked = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!lesson || !costKey || costAsked.current.has(costKey)) return;
    const w = workerRef.current;
    if (!w) return;
    costAsked.current.add(costKey);
    w.postMessage({ setup: setupOf(game), seed: game.seed, actions: game.actions.slice(0, at - 1), me, played: game.actions[at - 1], better: lesson.better, judge: judgeOf(judgeId).judge, key: costKey });
  }, [lesson, costKey, game, me, at, judgeId]);
  const cost = costKey ? costs[costKey] : undefined;
  /* reading together: one seat shows where it is looking, the others follow.
     Only at a table online, and only from a seat — a spectator may follow,
     never lead */
  const online = useGame((s) => s.code !== null);
  const mySeat = useGame((s) => s.seat);
  const showing = useGame((s) => s.shown);
  const sharing = useGame((s) => s.sharing);
  const following = useGame((s) => s.following);
  const shareReview = useGame((s) => s.shareReview);
  const followReview = useGame((s) => s.followReview);
  const showReviewAt = useGame((s) => s.showReviewAt);
  /* what I am reading goes out, at most ten times a second while scrubbing:
     the move, the seat I am reading and the line I am exploring */
  const line = useMemo(() => (vary ? { from: vary.from, moves: vary.moves.map((m) => m.action) } : null), [vary]);
  const toldAt = useRef<{ said: string; when: number } | null>(null);
  useEffect(() => {
    if (!sharing) return;
    const said = `${at}:${me}:${line ? `${line.from}|${line.moves.length}` : ''}`;
    const last = toldAt.current;
    if (last && last.said === said) return;
    const wait = last ? Math.max(0, 120 - (Date.now() - last.when)) : 0;
    const t = window.setTimeout(() => {
      toldAt.current = { said, when: Date.now() };
      showReviewAt(at, me, line);
    }, wait);
    return () => window.clearTimeout(t);
  }, [sharing, at, me, line, showReviewAt]);

  /* this moment in a link: the game and the move, so a reader arrives on the
     same position with the analysis open */
  const [linked, setLinked] = useState(false);
  /* the report in a link: the game and this moment on a page of its own */
  const [reported, setReported] = useState(false);
  const reportLink = () => {
    const url = `${window.location.origin}/report${shareFragment(game, at)}`;
    const done = () => {
      setReported(true);
      window.setTimeout(() => setReported(false), 2200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt(t('game.debrief.linkCopy'), url));
    else window.prompt(t('game.debrief.linkCopy'), url);
  };
  const linkHere = () => {
    const url = `${window.location.origin}/game/local/${table}${shareFragment(game, at)}`;
    const done = () => {
      setLinked(true);
      window.setTimeout(() => setLinked(false), 2200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt(t('game.debrief.linkCopy'), url));
    else window.prompt(t('game.debrief.linkCopy'), url);
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
    setVaryMine({ ...vary, moves: [...vary.moves, ...picked, ...more], picked: null, step: null });
  };
  /* back to one of the picks along the line: the roads there again, that pick selected */
  const backTo = (i: number) => {
    if (!vary) return;
    setVaryMine({ from: vary.from, moves: vary.moves.slice(0, i), picked: sameRoad(vary.moves[i].action), step: null });
  };
  const close = () => setDebriefOpen(false);
  /* the panel's two pages under the curve: the moves, or the seat's review;
     a line being explored takes the room above the moves */
  const [tab, setTab] = useState<'moves' | 'review'>('moves');
  /* the moves shown: all of them, one grade of the reader's, or the key moments */
  const [filter, setFilter] = useState<Grade | 'key' | null>(null);
  const [fivePlans, setFivePlans] = useState(false);
  /* the sheet that says how to read all this: the judges, the grades, a method */
  const [help, setHelp] = useState(false);
  const lit = useBoardOptions().reviewLit;
  const keyAt = useMemo(() => new Set(keyMoments.map((m) => m.k)), [keyMoments]);
  const listed = (k: number, v: Verdict | undefined): boolean => {
    if (!filter) return true;
    if (filter === 'key') return keyAt.has(k + 1);
    return !!v && v.grade === filter;
  };
  /* the panel goes: the board back to the live table, the moment a link
     pointed at spent, and nobody left waiting on a reading that has gone */
  useEffect(() => () => {
    setReview(null);
    setReviewAt(null);
    const st = useGame.getState();
    if (st.sharing) st.shareReview(false);
    st.followReview(false);
  }, [setReview, setReviewAt]);
  const width = Math.max(GUIDE_RAIL, guideDock());
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-at="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  /* the curve across the top of the board, where the VP track stood: wide,
     tall, and clear of the panel; the HUD keeps under it */
  const strip = createPortal(
    <div data-debrief-curve className="pointer-events-auto fixed left-0 top-0 z-[79] border-b border-brass-hairline bg-coal-950/92 px-2 pt-1 backdrop-blur-md" style={{ right: width, height: REVIEW_CURVE_H }}>
      <AnalysisCurve chances={chances} reads={reads} settled={settled} rivals={rivals} at={at} marks={verdicts} vary={varyChances} split={positions.findIndex((p) => p.era === 'rail')} label={t('game.debrief.curve')} eras={[t('game.topbar.eraCanal'), t('game.topbar.eraRail')]} height={REVIEW_CURVE_H - 10} onPick={(k) => { setAt(k); setVaryMine(null); }} />
    </div>,
    document.body,
  );

  return (
    <>
    {strip}
    <aside data-debrief aria-label={t('game.debrief.title')} className="pointer-events-auto fixed inset-y-0 right-0 z-[80] flex flex-col gap-2 border-l border-brass-hairline bg-coal-950/92 px-3 py-3 backdrop-blur-md" style={{ width }}>
      <div className="flex shrink-0 items-center gap-2">
        <Sparkles className="h-4 w-4 text-brass-400" aria-hidden />
        <span className="font-fell text-[11px] uppercase tracking-[0.2em] text-cream-100/60">{t('game.debrief.title')}</span>
        <span className="flex-1" />
        <label className="flex items-center gap-1 text-cream-100/60" title={t('game.debrief.seat')}>
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[me]?.color]?.hex ?? '#C9A45C' }} />
          <select aria-label={t('game.debrief.seat')} value={me} onChange={(e) => { setMeMine(Number(e.target.value)); setVaryMine(null); }} className="max-w-[120px] rounded border border-brass-700/50 bg-coal-900 px-1 py-0.5 font-sans text-[11px] text-cream-100">
            {game.players.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-cream-100/60" title={t(`game.debrief.judge.${judgeId}Tip`)}>
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          <select
            aria-label={t('game.debrief.judge.label')}
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value as 'quick' | 'long' | 'deep')}
            className="rounded border border-brass-700/50 bg-coal-900 px-1 py-0.5 font-sans text-[11px] text-cream-100"
          >
            {(['quick', 'long', 'deep'] as const).map((id) => (
              <option key={id} value={id} title={t(`game.debrief.judge.${id}Tip`)}>{t(`game.debrief.judge.${id}`)}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setHelp((o) => !o)} aria-pressed={help} aria-label={t('game.debrief.help.open')} title={t('game.debrief.help.open')} className={cn('rounded-md border p-1 transition-colors', help ? 'border-brass-400 text-brass-300' : 'border-brass-700/50 text-brass-400/80 hover:border-brass-400')}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
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
        <div className="mt-1">
          {/* how far the judge has got, a hair under the curve: it keeps its
              room once read, so nothing below it moves */}
          <div className={cn('mt-1 flex items-center gap-2 transition-opacity', progress.done < progress.total ? 'opacity-100' : 'opacity-0')} aria-live="polite">
            <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-coal-800">
              <div className="h-full rounded-full bg-brass-400/50 transition-[width] duration-300" style={{ width: `${progress.total ? Math.round((100 * progress.done) / progress.total) : 0}%` }} />
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-cream-100/45">{t('game.debrief.reading', { done: progress.done, total: progress.total })}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" onClick={() => { setAt((k) => Math.max(0, k - 1)); setVaryMine(null); }} disabled={at === 0} aria-label={t('game.debrief.prev')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setAt((k) => Math.min(last, k + 1)); setVaryMine(null); }} disabled={at === last} aria-label={t('game.debrief.next')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px] disabled:opacity-30">
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
          <button type="button" onClick={linkHere} aria-label={t('game.debrief.linkHere')} title={t('game.debrief.linkHere')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]">
            {linked ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={reportLink} aria-label={t('game.debrief.report')} title={t('game.debrief.report')} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]">
            {reported ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          </button>
          {online && mySeat !== null && mySeat >= 0 && (
            <button type="button" onClick={() => shareReview(!sharing)} aria-pressed={sharing} aria-label={t('game.debrief.share')} title={t('game.debrief.share')} className={cn('btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]', sharing && '!border-brass-400 !text-brass-300')}>
              <Radio className="h-3.5 w-3.5" />
            </button>
          )}
          {online && showing && !sharing && (
            <button type="button" onClick={() => followReview(!following)} aria-pressed={following} title={t('game.debrief.followRead', { name: game.players[showing.from]?.name ?? '' })} className={cn('btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[10px]', following && '!border-brass-400 !text-brass-300')}>
              <Eye className="h-3.5 w-3.5" /> {game.players[showing.from]?.name ?? ''}
            </button>
          )}
          <button type="button" onClick={() => setBoardOption('reviewLit', !lit)} aria-pressed={lit} aria-label={t(lit ? 'game.debrief.dim' : 'game.debrief.lit')} title={t(lit ? 'game.debrief.dim' : 'game.debrief.lit')} className={cn('btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]', lit && '!border-brass-400 !text-brass-300')}>
            {lit ? <Sun className="h-3.5 w-3.5" /> : <SunDim className="h-3.5 w-3.5" />}
          </button>
          {canExplore && !vary && (
            <button type="button" onClick={explore} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              <Compass className="h-3.5 w-3.5" /> {t('game.debrief.explore')}
            </button>
          )}
          {vary && (
            <button type="button" onClick={() => setVaryMine(null)} className="btn-strike ml-auto !min-h-[26px] !px-2.5 !py-0.5 !text-[10px]">
              {t('game.debrief.backToLine')}
            </button>
          )}
        </div>
      </div>

      {/* how to read all this: the judges, the grades, a method, and where the figures come from */}
      {help && (
        <div className="paper min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
          <p className="font-fell text-[11px] uppercase tracking-[0.2em] text-ink-900/60">{t('game.debrief.help.title')}</p>
          <h3 className="mt-2 font-fell text-[13px] text-ink-900">{t('game.debrief.help.judges.title')}</h3>
          <ul className="mt-1 flex flex-col gap-1 font-sans text-[11.5px] leading-snug text-ink-900/85">
            {(['quick', 'long', 'deep'] as const).map((id) => (
              <li key={id}><span className="font-semibold">{t(`game.debrief.judge.${id}`)}</span> — {t(`game.debrief.help.judges.${id}`)}</li>
            ))}
          </ul>
          <h3 className="mt-3 font-fell text-[13px] text-ink-900">{t('game.debrief.help.grades.title')}</h3>
          <p className="mt-1 font-sans text-[11.5px] leading-snug text-ink-900/85">{t('game.debrief.help.grades.how')}</p>
          <ul className="mt-1 flex flex-col gap-0.5 font-sans text-[11.5px] text-ink-900/85">
            {(['top', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map((g) => (
              <li key={g}><span className={cn('font-semibold', g === 'blunder' ? 'text-rust-700' : g === 'mistake' ? 'text-copper-700' : '')}>{t(`game.debrief.quality.${g}`)}</span> : {t(`game.debrief.gradeTip.${g}`)}</li>
            ))}
          </ul>
          <h3 className="mt-3 font-fell text-[13px] text-ink-900">{t('game.debrief.help.method.title')}</h3>
          <ol className="mt-1 flex list-decimal flex-col gap-1 pl-4 font-sans text-[11.5px] leading-snug text-ink-900/85">
            {(['s1', 's2', 's3', 's4', 's5'] as const).map((k) => (
              <li key={k}>{t(`game.debrief.help.method.${k}`)}</li>
            ))}
          </ol>
          <h3 className="mt-3 font-fell text-[13px] text-ink-900">{t('game.debrief.help.weigh.title')}</h3>
          <p className="mt-1 font-sans text-[11.5px] leading-snug text-ink-900/85">{t('game.debrief.help.weigh.text')}</p>
          <p className="mt-3 font-serif text-[11.5px] italic leading-snug text-ink-900/65">{t('game.debrief.help.note')}</p>
        </div>
      )}

      {/* the pages: the moves, or the seat's review; a line being explored sits above the moves */}
      {!help && !vary && (
        <div role="tablist" className="flex shrink-0 items-end gap-1 border-b border-brass-700/40">
          {(['moves', 'review'] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('-mb-px rounded-t px-3 py-1 font-fell text-[10.5px] uppercase tracking-[0.18em] transition-colors', tab === id ? 'border border-b-0 border-brass-700/40 bg-coal-900/80 text-brass-300' : 'text-cream-100/50 hover:text-cream-100/80')}>
              {t(`game.debrief.tabs.${id}`)}
            </button>
          ))}
        </div>
      )}

      {/* the variation: its picks as a trail, the roads at its tip, its moves */}
      {!help && vary && (
        <div className="paper max-h-[55%] shrink-0 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
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
                /* what the road would have changed, against the move played:
                   the figure the grade is read on, said plainly */
                const gap = playedRoad === null ? null : Math.round((r.chance - playedRoad) * 1000) / 10;
                return (
                  <li key={i}>
                    <button type="button" onClick={() => setVaryMine({ ...vary, picked: pickedAt === i ? null : sameRoad(r.action), step: null })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', pickedAt === i && vary.step === null && 'bg-ink-900/10 ring-1 ring-brass-500')}>
                      <span className="w-10 shrink-0 font-mono text-[10.5px] font-semibold text-ink-900">{t('game.debrief.road', { p: fine(r.chance, lang) })}</span>
                      <span className="min-w-0 flex-1 truncate">{describeAction(r.action)}</span>
                      {same ? (
                        <span className="shrink-0 font-fell text-[9px] uppercase tracking-[0.14em] text-ink-900/50">{t('game.debrief.played')}</span>
                      ) : (
                        gap !== null && <span className={cn('shrink-0 font-mono text-[10px]', gap > 0 ? 'text-bottle-700' : 'text-ink-900/35')}>{gap > 0 ? `+${fine(gap / 100, lang)}` : fine(gap / 100, lang)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {branch && (
            <div className="mt-1.5">
              {branchLines.length > 0 && (
                <ul className="flex flex-col gap-0.5 font-sans text-[11px] leading-snug text-ink-900/85">
                  {branchLines.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}
              <p className="mt-0.5 font-serif text-[11.5px] italic leading-snug text-ink-900/65">{t(`game.guide.suggest.why.${whyKey(branch.action)}`, { name: machine })}</p>
            </div>
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
                    <button type="button" onClick={() => setVaryMine({ ...vary, step: i })} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] text-ink-900/85 hover:bg-ink-900/10', on && 'bg-ink-900/10 ring-1 ring-brass-500')}>
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

      {/* the moves page: the reader's grades as filters, then every move */}
      {!help && (vary || tab === 'moves') && (
        <>
          {!vary && tally && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setFilter(null)} aria-pressed={filter === null} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px] transition-colors', filter === null ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/40 text-cream-100/55 hover:border-brass-400')}>
                {t('game.debrief.tally.all', { n: game.actions.length })}
              </button>
              {(['top', 'good', 'inaccuracy', 'mistake', 'blunder'] as Grade[]).filter((g) => tally.by[g] > 0).map((g) => (
                <button key={g} type="button" onClick={() => setFilter(filter === g ? null : g)} aria-pressed={filter === g} title={t(`game.debrief.gradeTip.${g}`)} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px] transition-colors', filter === g ? 'border-brass-400 bg-brass-500/15' : 'border-brass-700/40 hover:border-brass-400', g === 'blunder' ? 'text-rust-400' : g === 'mistake' ? 'text-copper-500' : g === 'inaccuracy' ? 'text-cream-100/70' : 'text-brass-300/80')}>
                  {t(`game.debrief.tally.${g}`, { n: tally.by[g] })}
                </button>
              ))}
              {keyMoments.length > 0 && (
                <button type="button" onClick={() => setFilter(filter === 'key' ? null : 'key')} aria-pressed={filter === 'key'} title={t('game.debrief.keyTip')} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px] transition-colors', filter === 'key' ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/40 text-cream-100/70 hover:border-brass-400')}>
                  {t('game.debrief.tally.key', { n: keyMoments.length })}
                </button>
              )}
              {tally.lost > 0 && <span className="ml-auto font-mono text-[10px] text-rust-400/80" title={t('game.debrief.tally.lostTip')}>{t('game.debrief.tally.lost', { p: tally.lost })}</span>}
            </div>
          )}
          <ol ref={listRef} className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {game.actions.map((a, k) => {
              const before = positions[k];
              if (!before) return null;
              const seat = a.kind === 'concede' ? a.player : before.current;
              const p = game.players[seat];
              const mine = seat === me;
              const v = allVerdicts[seat]?.[k];
              if (!listed(k, mine ? v : undefined)) return null;
              const quality = v ? v.grade : null;
              const newRound = k === 0 || positions[k - 1]?.round !== before.round || (filter !== null && !game.actions.slice(0, k).some((_, j) => positions[j]?.round === before.round && listed(j, seat === me ? verdicts[j] : undefined)));
              return (
                <li key={k} data-at={k + 1}>
                  {newRound && <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-cream-100/40">{t('game.debrief.round', { round: before.round, era: t(before.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })}</p>}
                  <button type="button" onClick={() => { setAt(k + 1); setVaryMine(null); }} className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-sans text-[11px] transition-colors', at === k + 1 && !vary ? 'bg-brass-500/15 text-cream-100' : 'text-cream-100/70 hover:bg-coal-800/70')}>
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
                      {lessonLines.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5 font-sans text-[11px] leading-snug text-ink-900/85">
                          {lessonLines.map((line, i) => <li key={i}>{line}</li>)}
                        </ul>
                      )}
                      <p className="mt-0.5 font-serif text-[11.5px] italic leading-snug text-ink-900/65">
                        {t('game.debrief.whyGap', { name: machine, p: lesson.delta })} {t(`game.guide.suggest.why.${whyKey(lesson.better)}`, { name: machine })}
                      </p>
                      {/* the miss in the game's coin: points, income and cash a few moves
                          on, and where the machine would have ended the game from there */}
                      {cost === undefined ? (
                        <p className="mt-1 font-mono text-[9.5px] text-ink-900/50">{t('game.debrief.cost.reading')}</p>
                      ) : cost ? (
                        <ul className="mt-1 flex flex-col gap-0.5 font-sans text-[11px] text-ink-900/80">
                          <li title={t('game.debrief.cost.shortTip', { n: cost.short.plies })}>
                            <span className="font-fell text-[9.5px] uppercase tracking-[0.14em] text-ink-900/55">{t('game.debrief.cost.short', { n: cost.short.plies })}</span>{' '}
                            <span className={cn('font-mono', cost.short.vp > 0 ? 'text-bottle-700' : cost.short.vp < 0 ? 'text-rust-700' : '')}>{signed(cost.short.vp)} {t('game.debrief.cost.vp')}</span>
                            {' · '}
                            <span className={cn('font-mono', cost.short.income > 0 ? 'text-bottle-700' : cost.short.income < 0 ? 'text-rust-700' : '')}>{signed(cost.short.income)} {t('game.debrief.cost.income')}</span>
                            {' · '}
                            <span className={cn('font-mono', cost.short.money > 0 ? 'text-bottle-700' : cost.short.money < 0 ? 'text-rust-700' : '')}>{signed(cost.short.money)} £</span>
                          </li>
                          {cost.long && (
                            <li title={t('game.debrief.cost.longTip')}>
                              <span className="font-fell text-[9.5px] uppercase tracking-[0.14em] text-ink-900/55">{t('game.debrief.cost.long')}</span>{' '}
                              {t('game.debrief.cost.longLine', { vp: cost.long.vps[me] ?? 0, actual: game.players[me]?.vp ?? 0, gap: signed((cost.long.vps[me] ?? 0) - (game.players[me]?.vp ?? 0)) })}
                              {' '}
                              <span className="text-ink-900/55">{t('game.debrief.cost.rivals', { list: game.players.map((p, i) => (i === me ? null : `${p.name} ${cost.long!.vps[i] ?? 0}`)).filter(Boolean).join(', ') })}</span>
                            </li>
                          )}
                        </ul>
                      ) : null}
                      <button type="button" onClick={seeBetter} className="btn-strike mt-1.5 !min-h-[24px] !px-2.5 !py-0.5 !text-[10px]">
                        <Compass className="h-3 w-3" /> {t('game.debrief.seeBetter')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* the review page: the plan the moves add up to, the guide's counted tips, the key moments */}
      {!help && !vary && tab === 'review' && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {plan.deeds.actions > 0 && (
            <section>
              <div className="flex items-center gap-2">
                <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.plan.label')}</p>
                <button type="button" onClick={() => setFivePlans((o) => !o)} aria-expanded={fivePlans} className="flex items-center gap-1 font-sans text-[10.5px] text-brass-400/80 hover:text-brass-300">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden /> {t('game.debrief.plan.fivePlans')}
                </button>
              </div>
              <p className="mt-1 font-serif text-[12px] italic leading-snug text-cream-100/60">{t('game.debrief.plan.lede')}</p>
              {fivePlans && (
                <ul className="mt-2 flex flex-col gap-1.5 rounded-md border border-brass-700/40 bg-coal-900/60 px-3 py-2">
                  {(Object.keys(PLAN_NAMES) as PlanId[]).map((id) => {
                    const read = plan.all.find((x) => x.id === id);
                    return (
                      <li key={id} className="font-sans text-[11px] leading-snug text-cream-100/75">
                        <span className={cn('font-fell text-[12px]', id === plan.best.id ? 'text-brass-300' : 'text-cream-100')}>{PLAN_NAMES[id]}</span>
                        {read && <span className="ml-1.5 font-mono text-[10px] text-cream-100/45">{Math.round(read.score * 100)} %</span>}
                        <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cream-100/40">{t(`game.debrief.plan.level.${id}`)}</span>
                        <br />
                        {t(`game.debrief.plan.about.${id}`)}
                      </li>
                    );
                  })}
                </ul>
              )}
              {plan.best.score < PLAN_FAINT ? (
                <p className="mt-2 font-serif text-[12px] italic leading-snug text-cream-100/60">{t('game.debrief.plan.faint')}</p>
              ) : (
                <>
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="font-fell text-[15px] text-brass-300">{PLAN_NAMES[plan.best.id]}</span>
                    <span className="font-mono text-[10.5px] text-cream-100/60" title={t('game.debrief.plan.scoreTip')}>{t('game.debrief.plan.score', { p: Math.round(plan.best.score * 100) })}</span>
                  </p>
                  <p className="mt-0.5 font-sans text-[11px] leading-snug text-cream-100/70">{t(`game.debrief.plan.about.${plan.best.id}`)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {plan.best.goals.map((g) => {
                      const met = g.done >= g.target;
                      return (
                        <span key={g.id} title={t(`game.debrief.plan.goalsTip.${g.id}`)} className={cn('rounded-md border px-2 py-0.5 font-sans text-[10.5px]', met ? 'border-brass-500/60 text-brass-300' : 'border-brass-700/40 text-cream-100/45')}>
                          <span className="font-mono">{g.done}/{g.target}</span> {t(`game.debrief.plan.goals.${g.id}`)}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              <ul className="mt-2 flex flex-col gap-0.5">
                {plan.tips.filter((tip) => !(tip.id === 'lowLeft' && tip.value === 0)).map((tip) => (
                  <li key={tip.id} title={t(`game.debrief.plan.tipsTip.${tip.id}`)} className={cn('font-sans text-[11px]', tip.met ? 'text-cream-100/70' : 'text-copper-500')}>
                    {t(`game.debrief.plan.tips.${tip.id}`, { value: tip.id === 'perAction' ? fine(tip.value / 100, lang) : tip.value, want: tip.want, n: tip.value })}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {standings.length > 1 && (
            <section className="mt-3">
              <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.standings.title')}</p>
              <table className="mt-1 w-full border-collapse font-sans text-[11px] text-cream-100/80">
                <thead>
                  <tr className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream-100/40">
                    <th className="py-0.5 text-left font-normal">{t('game.debrief.standings.seat')}</th>
                    <th className="py-0.5 text-right font-normal">{t('game.debrief.standings.vp')}</th>
                    <th className="py-0.5 text-right font-normal" title={t('game.debrief.tally.lostTip')}>{t('game.debrief.standings.lost')}</th>
                    <th className="py-0.5 text-right font-normal" title={t('game.debrief.standings.missesTip')}>{t('game.debrief.standings.misses')}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr key={row.seat} className={cn(row.seat === me && 'text-brass-300')}>
                      <td className="py-0.5">
                        <button type="button" onClick={() => { setMeMine(row.seat); setVaryMine(null); }} className="flex items-center gap-1.5 hover:text-brass-300">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[row.seat]?.color]?.hex ?? '#C9A45C' }} />
                          {game.players[row.seat]?.name}
                        </button>
                      </td>
                      <td className="py-0.5 text-right font-mono">{game.players[row.seat]?.vp ?? 0}</td>
                      <td className="py-0.5 text-right font-mono">{row.n ? `−${row.lost}` : '…'}</td>
                      <td className="py-0.5 text-right font-mono">{row.n ? row.misses : '…'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {tally && (
            <section className="mt-3">
              <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.tally.label')}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {(['top', 'good', 'inaccuracy', 'mistake', 'blunder'] as Grade[]).map((g) => (
                  <li key={g} className="flex items-center gap-2 font-sans text-[11px] text-cream-100/70">
                    <button type="button" onClick={() => { setFilter(g); setTab('moves'); }} disabled={tally.by[g] === 0} className={cn('w-28 shrink-0 text-left hover:text-brass-300 disabled:opacity-40', g === 'blunder' ? 'text-rust-400' : g === 'mistake' ? 'text-copper-500' : '')}>
                      {t(`game.debrief.tally.${g}`, { n: tally.by[g] })}
                    </button>
                    <span className="text-cream-100/45">{t(`game.debrief.gradeTip.${g}`)}</span>
                  </li>
                ))}
              </ul>
              {tally.lost > 0 && <p className="mt-1 font-mono text-[10px] text-rust-400/80" title={t('game.debrief.tally.lostTip')}>{t('game.debrief.tally.lost', { p: tally.lost })}</p>}
            </section>
          )}
          {(motifs.here.length > 0 || motifs.back.length > 0) && (
            <section className="mt-3">
              <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.motifs.title')}</p>
              {motifs.here.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 font-sans text-[11px] text-cream-100/75">
                  {motifs.here.slice(0, 3).map(([m, n]) => (
                    <li key={m}><span className="font-mono text-[10px] text-rust-400/80">×{n}</span> {t(`game.debrief.motifs.${m}`)}</li>
                  ))}
                </ul>
              )}
              {motifs.back.length > 0 && (
                <>
                  <p className="mt-1.5 font-serif text-[11.5px] italic text-cream-100/60">{t('game.debrief.motifs.back', { n: motifs.games })}</p>
                  <ul className="mt-0.5 flex flex-col gap-0.5 font-sans text-[11px] text-cream-100/75">
                    {motifs.back.slice(0, 3).map((r) => (
                      <li key={r.motif}><span className="font-mono text-[10px] text-copper-500">×{r.times}</span> {t(`game.debrief.motifs.${r.motif}`)} <span className="text-cream-100/45">{t('game.debrief.motifs.inGames', { n: r.games })}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {keyMoments.length > 0 && (
            <section className="mt-3">
              <p className="font-fell text-[10px] uppercase tracking-[0.2em] text-cream-100/50">{t('game.debrief.keyMoments')}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {keyMoments.map((m) => (
                  <button key={m.k} type="button" onClick={() => { setAt(m.k); setVaryMine(null); setTab('moves'); }} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-left font-sans text-[10.5px] transition-colors', at === m.k ? 'border-brass-400 bg-brass-500/15 text-brass-300' : 'border-brass-700/50 text-cream-100/75 hover:border-brass-400')}>
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[m.seat]?.color]?.hex ?? '#C9A45C' }} />
                    <span>{t('game.debrief.round', { round: m.round, era: t(m.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })} · {m.seat === me ? t('game.debrief.you') : game.players[m.seat]?.name}</span>
                    <span className="font-mono text-[10px] text-rust-400">{t('game.debrief.lost', { p: Math.round(m.drop * 100) })}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </aside>
    </>
  );
}
