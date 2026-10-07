import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Bot, Eye, Loader2, Sparkles } from 'lucide-react';
import { PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { describeAction } from '@/game/store';
import { reviewGame, swingsFor } from '@/game/review';
import type { Grade, Idle, Review as GameReview, SeatReview } from '@/game/review';
import ReviewCurve from '@/components/results/ReviewCurve';
import type { Mark } from '@/components/results/ReviewCurve';
import type { Note, Second } from '@/game/reviewWorker';
import { heldFinal as readFinal } from '@/game/final';
import { ShapeChip } from '@/components/game/TownInspector';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The post-mortem — where the points went, and what a second reader   */
/* would have played instead.                                          */
/*                                                                     */
/* The first half is arithmetic: the log is replayed and every figure   */
/* read off the table as it stood. The second half is the machine's     */
/* opinion, asked for by hand and labelled as an opinion, because that  */
/* is all it is: the search plays about as well as a strong table and   */
/* no better, and it is wrong often enough to be worth doubting.        */
/* ------------------------------------------------------------------ */

/** the bar a strong table clears: about five points out of every action */
const BAR = 5;
/** the grades, from the move the machine would have played to the worst */
const GRADE_ORDER: Grade[] = ['top', 'good', 'inaccuracy', 'mistake', 'blunder'];
const GRADE_TONE: Record<Grade, string> = {
  top: 'border-bottle-600/70 text-bottle-ink',
  good: 'border-bottle-600/40 text-bottle-ink',
  inaccuracy: 'border-brass-400/60 text-brass-400',
  mistake: 'border-copper-500/70 text-copper-500',
  blunder: 'border-rust-500/70 text-rust-400',
};
/** which judge reads the moves, by the reader's choice: the quick one
 *  weighs the table as it stands, the long one plays the replies out first */
const THINK = { quick: 'quick', careful: 'long' } as const;
type Depth = keyof typeof THINK;
/** whose moves the reading goes through: one place, or every one of them */
type Scope = 'seat' | 'table';


const hexOf = (color: string | undefined): string => (color && PLAYER_COLORS[color]?.hex) || '#C9A45C';

/** a row of bars, longest against the widest figure on the table */
function Bars({
  seats,
  colors,
  of,
  label,
  mark,
}: {
  seats: SeatReview[];
  colors: string[];
  of: (s: SeatReview) => number;
  label: (s: SeatReview) => string;
  mark?: number;
}) {
  /* the bar the notch stands for is never the very edge: it must be seen */
  const most = Math.max(1, ...seats.map(of), (mark ?? 0) * 1.08);
  return (
    <ul className="flex flex-col gap-2">
      {seats.map((s) => (
        <li key={s.seat} className="flex items-center gap-2.5">
          <span className="flex w-[130px] shrink-0 items-center gap-1.5">
            <ShapeChip color={colors[s.seat]} size={10} />
            <span className="truncate font-fell text-[13px] tracking-wide text-cream-100/90">{s.name}</span>
          </span>
          <span className="relative h-3.5 flex-1 overflow-hidden rounded-sm border border-brass-700/40 bg-coal-900/70">
            <span
              className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
              style={{ width: `${(of(s) / most) * 100}%`, background: colors[s.seat] ? hexOf(colors[s.seat]) : '#C9A45C', opacity: 0.85 }}
            />
            {mark !== undefined && mark > 0 && (
              <span aria-hidden className="absolute inset-y-0 w-px bg-cream-100/45" style={{ left: `${(mark / most) * 100}%` }} />
            )}
          </span>
          <span className="w-[150px] shrink-0 text-right font-mono text-[11.5px] text-cream-100/70 tnums">{label(s)}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="plate mt-6 rounded-lg px-5 py-4">
      <h2 className="font-fell text-[15px] uppercase tracking-[0.08em] text-cream-100">{title}</h2>
      {lead && <p className="mt-1 max-w-[62ch] font-sans text-[12.5px] leading-relaxed text-cream-100/60">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Review() {
  const t = useT();
  const navigate = useNavigate();
  const final = useMemo(() => readFinal(), []);
  const colors = useMemo(() => (final?.players ?? []).map((p) => p.color), [final]);
  const review = useMemo<GameReview | null>(() => {
    if (!final?.setup || final.seed === undefined || !final.actions?.length) return null;
    try {
      return reviewGame(final.setup, final.seed, final.actions);
    } catch {
      return null;
    }
  }, [final]);

  /* the seat being read: the reader's own unless another is asked for */
  const [picked, setPicked] = useState<number | null>(null);
  const [depth, setDepth] = useState<Depth>('quick');
  const [scope, setScope] = useState<Scope>('seat');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, left: 0 });
  const started = useRef(0);
  /* the reading, seat by seat: a place already read is switched to at once */
  const [reading, setReading] = useState<Record<number, Second[]>>({});
  const [failed, setFailed] = useState(false);
  /* one thread per seat, so reading the whole table costs about what
     reading one place costs: the threads run beside each other */
  const pool = useRef<Worker[]>([]);
  const tally = useRef<Record<number, { done: number; total: number }>>({});

  useEffect(() => {
    const live = pool;
    return () => {
      for (const w of live.current) w.terminate();
      live.current = [];
    };
  }, []);

  if (!review || !final) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        {/* no felt is laid for this one: the notice stands on the club's own
            page, so it takes the page's ink — cream measured 1.02 on the day's
            paper, and the sentence simply was not there */}
        <p className="font-fell text-lg text-paper-100">{t('results.review.missing')}</p>
        <Link to="/results" className="btn-ledger">
          {t('results.review.back')}
        </Link>
      </div>
    );
  }

  const seats = [...review.seats].sort((a, b) => b.vp - a.vp);
  const mineSeat = picked ?? review.seats.find((s) => !s.bot)?.seat ?? 0;
  const mine = review.seats[mineSeat] ?? review.seats[0];

  const stop = () => {
    for (const w of pool.current) w.terminate();
    pool.current = [];
  };

  /* switching places never throws a reading away: the picker only changes
     which of them the page is showing */
  const pick = (seat: number) => setPicked(seat);

  const ask = () => {
    if (!final.setup || final.seed === undefined || !final.actions) return;
    stop();
    const wanted = scope === 'table' ? review.seats.map((x) => x.seat) : [mineSeat];
    setBusy(true);
    setFailed(false);
    setReading({});
    setProgress({ done: 0, total: 0, left: 0 });
    tally.current = {};
    started.current = 0;
    let left = wanted.length;
    const stride = () => {
      const rows = Object.values(tally.current);
      const done = rows.reduce((a, r) => a + r.done, 0);
      const total = rows.reduce((a, r) => a + r.total, 0);
      /* what remains is measured from the moves already read, not guessed */
      if (!started.current) started.current = performance.now();
      const spent = performance.now() - started.current;
      const over = done > 1 ? Math.round(((spent / done) * (total - done)) / 1000) : 0;
      setProgress({ done, total, left: over });
    };
    for (const seat of wanted) {
      const w = new Worker(new URL('../game/reviewWorker.ts', import.meta.url), { type: 'module' });
      pool.current.push(w);
      w.onmessage = (e: MessageEvent<Note>) => {
        const note = e.data;
        if (note.kind === 'progress') {
          tally.current[seat] = { done: note.done, total: note.total };
          stride();
        }
        if (note.kind === 'done') {
          setReading((was) => ({ ...was, [seat]: note.moves }));
          left -= 1;
          if (left <= 0) {
            setBusy(false);
            stop();
          }
        }
        if (note.kind === 'failed') {
          setFailed(true);
          setBusy(false);
          stop();
        }
      };
      w.onerror = () => {
        setFailed(true);
        setBusy(false);
        stop();
      };
      w.postMessage({ setup: final.setup, seed: final.seed, actions: final.actions, seat, judge: THINK[depth] });
    }
  };

  const tileName = (x: Idle): string => t('results.review.tile', { works: t(`game.log.industry.${x.industry}`), level: x.level, town: TOWN_BY_ID[x.town]?.name ?? x.town });

  /* the reading, sorted into the grades a chess review would use */
  const gradesOf = (list: Second[]) => list;
  const soundness = (list: Second[]): number => {
    const g = gradesOf(list);
    return g.length ? Math.round((g.filter((m) => m.grade === 'top' || m.grade === 'good').length / g.length) * 100) : 0;
  };
  const graded = gradesOf(reading[mineSeat] ?? []);
  const counts = GRADE_ORDER.map((g) => ({ grade: g, n: graded.filter((m) => m.grade === g).length }));
  const rightness = soundness(reading[mineSeat] ?? []);
  /* every place the reading has been through, for the comparison */
  const readSeats = review.seats.filter((x) => reading[x.seat]?.length);
  const marks: Mark[] = graded.filter((m) => m.grade === 'inaccuracy' || m.grade === 'mistake' || m.grade === 'blunder').map((m) => ({ at: m.at, grade: m.grade as Mark['grade'] }));
  /* the moves it would have played otherwise, worst reading first. A move
     it would have played itself is not one to look at again, whatever the
     one-move reading makes of it: it chose that move for the whole turn. */
  const worst = graded
    .filter((m) => m.theirs && m.loss > 0)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 6);
  /* the moves that moved the lead most, whoever played them */
  const turns = swingsFor(review, mineSeat)
    .filter((x) => Math.abs(x.shift) >= 1)
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
    .slice(0, 5);
  const moveOf = (at: number): string => {
    const a = final.actions?.[at];
    return a ? describeAction(a) : '—';
  };
  const board = (at: number) => navigate(`/replay?at=${at}&from=review`);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] pb-24">
      <div aria-hidden className="tex-felt pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 20%, transparent 40%, rgba(16,13,11,0.82) 100%)' }}
      />

      <div className="relative mx-auto max-w-[900px] px-6 pt-10">
        <Link to="/results" className="mb-6 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('results.review.back')}
        </Link>

        <header>
          <h1 className="font-fell text-[clamp(28px,4vw,42px)] leading-tight text-cream-100">{t('results.review.title')}</h1>
          <div aria-hidden className="divider-brass mt-3 !mx-0 max-w-md" />
          <p className="mt-3 max-w-[64ch] font-sans text-[13px] leading-relaxed text-cream-100/65">{t('results.review.lead')}</p>
        </header>

        {/* how the game ran, move by move */}
        <Section title={t('results.review.curve')} lead={t('results.review.curveLead')}>
          <ReviewCurve curve={review.curve} seats={review.seats.map((x) => ({ name: x.name, color: colors[x.seat] }))} seat={mineSeat} marks={marks} onPick={board} />
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {review.seats.map((x) => (
              <li key={x.seat} className="flex items-center gap-1.5 font-sans text-[11.5px] text-cream-100/70">
                <span aria-hidden className="h-0.5 w-5 rounded-sm" style={{ background: hexOf(colors[x.seat]) }} />
                {x.name}
              </li>
            ))}
          </ul>
        </Section>

        {/* what an action was worth */}
        <Section title={t('results.review.perAction')} lead={t('results.review.perActionLead', { bar: BAR })}>
          <Bars
            seats={seats}
            colors={colors}
            of={(s) => s.perAction}
            mark={BAR}
            label={(s) => t('results.review.perActionValue', { n: s.perAction.toFixed(1), actions: s.actions })}
          />
        </Section>

        {/* where the points came from */}
        <Section title={t('results.review.sources')} lead={t('results.review.sourcesLead')}>
          <ul className="flex flex-col gap-3">
            {seats.map((s) => {
              const canal = s.canal.tiles + s.canal.links;
              const rail = s.rail ? s.rail.tiles + s.rail.links : 0;
              return (
                <li key={s.seat} className="border-b border-brass-700/25 pb-3 last:border-0 last:pb-0">
                  <p className="flex items-center gap-1.5 font-fell text-[14px] text-cream-100">
                    <ShapeChip color={colors[s.seat]} size={10} />
                    {s.name}
                    <span className="ml-auto font-mono text-[12.5px] tnums" style={{ color: hexOf(colors[s.seat]) }}>
                      {t('results.review.vp', { vp: s.vp })}
                    </span>
                  </p>
                  <p className="mt-1 font-sans text-[12.5px] leading-relaxed text-cream-100/70">
                    {t('results.review.sourcesCanal', { total: canal, tiles: s.canal.tiles, links: s.canal.links })}
                    {s.rail ? ` · ${t('results.review.sourcesRail', { total: rail, tiles: s.rail.tiles, links: s.rail.links })}` : ''}
                    {s.bonus > 0 ? ` · ${t(review.short ? 'results.review.sourcesClose' : 'results.review.sourcesBonus', { n: s.bonus })}` : ''}
                    {s.penalty > 0 ? ` · ${t('results.review.sourcesPenalty', { n: s.penalty })}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* what never flipped */}
        <Section title={t('results.review.idle')} lead={t('results.review.idleLead')}>
          <ul className="flex flex-col gap-2.5">
            {seats.map((s) => (
              <li key={s.seat}>
                <p className="flex items-center gap-1.5 font-fell text-[13px] text-cream-100/90">
                  <ShapeChip color={colors[s.seat]} size={10} />
                  {s.name}
                  <span className="ml-auto font-mono text-[11.5px] text-cream-100/60 tnums">
                    {s.idle.length === 0 ? t('results.review.idleNone') : t('results.review.idleSome', { n: s.idle.length, vp: s.idleVp })}
                  </span>
                </p>
                {s.idle.length > 0 && (
                  <p className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-cream-100/50">{s.idle.map(tileName).join(' · ')}</p>
                )}
                {s.sweptVp > 0 && (
                  <p className="mt-0.5 font-sans text-[11.5px] text-rust-400">{t('results.review.swept', { n: s.swept.length, vp: s.sweptVp })}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>

        {/* who opened the rounds */}
        <Section title={t('results.review.opened')} lead={t('results.review.openedLead')}>
          <Bars
            seats={seats}
            colors={colors}
            of={(s) => s.opened}
            label={(s) => t('results.review.openedValue', { n: s.opened, rounds: review.rounds.length })}
          />
        </Section>

        {/* the chosen seat, round by round */}
        <Section title={t('results.review.rounds', { name: mine.name })} lead={t('results.review.roundsLead')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse font-mono text-[11.5px] tnums">
              <thead>
                <tr className="text-cream-100/45">
                  <th className="border-b border-brass-700/40 py-1 text-left font-sans text-[10.5px] font-semibold uppercase tracking-label">{t('results.review.colRound')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10.5px] font-semibold uppercase tracking-label">{t('results.review.colVp')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10.5px] font-semibold uppercase tracking-label text-brass-400">{t('results.review.colProj')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10.5px] font-semibold uppercase tracking-label">{t('results.review.colIncome')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10.5px] font-semibold uppercase tracking-label">{t('results.review.colPurse')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10.5px] font-semibold uppercase tracking-label">{t('results.review.colSpent')}</th>
                </tr>
              </thead>
              <tbody>
                {review.rounds.map((r, i) => (
                  <tr key={`${r.era}-${r.round}-${i}`} className="text-cream-100/80">
                    <td className="border-b border-brass-700/15 py-1 text-left font-sans text-[10.5px] text-cream-100/60">
                      {t(r.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: r.round })}
                    </td>
                    <td className="border-b border-brass-700/15 py-1 text-right">{r.vp[mineSeat] ?? 0}</td>
                    <td className="border-b border-brass-700/15 py-1 text-right text-brass-400">{r.proj[mineSeat] ?? 0}</td>
                    <td className="border-b border-brass-700/15 py-1 text-right">{r.income[mineSeat] ?? 0}</td>
                    <td className="border-b border-brass-700/15 py-1 text-right">£{r.money[mineSeat] ?? 0}</td>
                    <td className="border-b border-brass-700/15 py-1 text-right text-cream-100/55">£{mine.spent[i] ?? 0}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-cream-100">
                  <td className="py-1.5 text-left font-sans text-[10.5px] uppercase tracking-[0.12em] text-brass-400">{t('results.review.colClose')}</td>
                  <td className="py-1.5 text-right">{mine.vp}</td>
                  <td className="py-1.5 text-right text-brass-400">{mine.vp}</td>
                  <td className="py-1.5 text-right">{mine.income}</td>
                  <td className="py-1.5 text-right">£{mine.money}</td>
                  <td className="py-1.5 text-right text-cream-100/40">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* the machine's own reading, asked for by hand */}
        <Section title={t('results.review.machine')} lead={t('results.review.machineLead')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans text-[10.5px] uppercase tracking-label text-cream-100/45">{t('results.review.whichSeat')}</span>
            {review.seats.map((s) => (
              <button
                key={s.seat}
                type="button"
                aria-pressed={s.seat === mineSeat}
                onClick={() => pick(s.seat)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 font-fell text-[12.5px] transition-colors',
                  s.seat === mineSeat ? 'border-brass-400 bg-brass-500/15 text-cream-100' : 'border-brass-700/50 text-cream-100/60 hover:text-brass-400',
                )}
              >
                <ShapeChip color={colors[s.seat]} size={9} />
                {s.name}
                {s.bot && <Bot className="h-3 w-3 opacity-60" />}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-sans text-[10.5px] uppercase tracking-label text-cream-100/45">{t('results.review.howLong')}</span>
            <div className="flex overflow-hidden rounded-md border border-brass-700/60">
              {(Object.keys(THINK) as Depth[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={depth === d}
                  onClick={() => setDepth(d)}
                  className={cn('px-2.5 py-1 font-sans text-[10.5px] font-bold uppercase tracking-[0.1em]', depth === d ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400')}
                >
                  {t(`results.review.depth.${d}`)}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-md border border-brass-700/60">
              {(['seat', 'table'] as Scope[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={scope === k}
                  onClick={() => setScope(k)}
                  className={cn('px-2.5 py-1 font-sans text-[10.5px] font-bold uppercase tracking-[0.1em]', scope === k ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400')}
                >
                  {t(`results.review.scope.${k}`)}
                </button>
              ))}
            </div>
            <button type="button" onClick={ask} disabled={busy} className="btn-strike !h-9 !px-4 !text-[10.5px] disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? t('results.review.machineBusy') : scope === 'table' ? t('results.review.machineAskAll') : t('results.review.machineAsk', { name: mine.name })}
            </button>
          </div>

          {busy && (
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="relative h-2 overflow-hidden rounded-sm border border-brass-700/40 bg-coal-900/70">
                <span
                  className="absolute inset-y-0 left-0 rounded-sm bg-brass-400/80 transition-[width] duration-200"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 4}%` }}
                />
              </span>
              <span className="font-mono text-[10.5px] text-cream-100/55 tnums">
                {t('results.review.machineRead', { done: progress.done, total: progress.total })}
                {progress.left > 0 ? ` · ${t('results.review.machineLeft', { s: progress.left })}` : ''}
              </span>
            </div>
          )}

          {failed && <p className="mt-3 font-sans text-[12.5px] text-rust-400">{t('results.review.machineFailed')}</p>}

          {graded.length > 0 && (
            <>
              {/* the card a chess review opens with */}
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-brass-700/30 pt-4">
                <p className="flex flex-col">
                  <span className="font-fell text-[30px] leading-none text-brass-400 tnums">{rightness}%</span>
                  <span className="mt-1 font-sans text-[10.5px] uppercase tracking-label text-cream-100/50">{t('results.review.rightness')}</span>
                </p>
                <ul className="flex flex-wrap items-center gap-1.5">
                  {counts.map((x) => (
                    <li
                      key={x.grade}
                      className={cn('rounded-md border px-2 py-1 font-sans text-[10.5px]', GRADE_TONE[x.grade], x.n === 0 && 'opacity-35')}
                    >
                      <span className="font-mono font-bold tnums">{x.n}</span> {t(`results.review.grade.${x.grade}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 font-sans text-[11.5px] leading-relaxed text-cream-100/50">{t('results.review.rightnessLead', { n: graded.length })}</p>

              {readSeats.length > 1 && (
                <div className="mt-4 border-t border-brass-700/30 pt-3">
                  <p className="mb-2 font-sans text-[10.5px] uppercase tracking-label text-cream-100/45">{t('results.review.everySeat')}</p>
                  <ul className="flex flex-col gap-1.5">
                    {[...readSeats]
                      .sort((a, b) => soundness(reading[b.seat] ?? []) - soundness(reading[a.seat] ?? []))
                      .map((x) => {
                        const pc = soundness(reading[x.seat] ?? []);
                        return (
                          <li key={x.seat}>
                            <button
                              type="button"
                              onClick={() => pick(x.seat)}
                              aria-pressed={x.seat === mineSeat}
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <span className="flex w-[130px] shrink-0 items-center gap-1.5">
                                <ShapeChip color={colors[x.seat]} size={10} />
                                <span className={cn('truncate font-fell text-[13px]', x.seat === mineSeat ? 'text-cream-100' : 'text-cream-100/65')}>{x.name}</span>
                              </span>
                              <span className="relative h-3 flex-1 overflow-hidden rounded-sm border border-brass-700/40 bg-coal-900/70">
                                <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${pc}%`, background: hexOf(colors[x.seat]), opacity: x.seat === mineSeat ? 0.9 : 0.5 }} />
                              </span>
                              <span className="w-[92px] shrink-0 text-right font-mono text-[11.5px] text-cream-100/70 tnums">
                                {t('results.review.seatScore', { pc, n: (reading[x.seat] ?? []).length })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}

              {worst.length === 0 && <p className="mt-3 font-sans text-[12.5px] text-cream-100/75">{t('results.review.machineAgrees', { name: mine.name })}</p>}

              {worst.length > 0 && (
                <>
                  <p className="mt-5 font-fell text-[13px] uppercase tracking-[0.08em] text-cream-100/85">{t('results.review.otherwise')}</p>
                  <ol className="mt-2 flex flex-col gap-2">
                    {worst.map((m) => (
                      <li key={m.at} className="rounded-md border border-brass-700/40 bg-coal-900/50 px-3 py-2">
                        <p className="flex flex-wrap items-center gap-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.16em] text-cream-100/40">
                          {t(m.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: m.round })}
                          <span className={cn('rounded-sm border px-1.5 py-px tracking-[0.1em]', GRADE_TONE[m.grade])}>{t(`results.review.grade.${m.grade}`)}</span>
                          <button type="button" onClick={() => board(m.at)} className="ml-auto flex items-center gap-1 tracking-[0.1em] text-cream-100/45 hover:text-brass-400">
                            <Eye className="h-3 w-3" /> {t('results.review.onTheBoard')}
                          </button>
                        </p>
                        <p className="mt-1 font-mono text-[11.5px] text-cream-100/85">{t('results.review.yours', { move: describeAction(m.yours) })}</p>
                        <p className="font-mono text-[11.5px] text-brass-400">{t('results.review.theirs', { move: m.theirs ? describeAction(m.theirs) : '—' })}</p>
                        <p className="mt-0.5 font-sans text-[10.5px] text-cream-100/40">
                          {t('results.review.cost', { pc: Math.round(m.loss * 100) })} · {t('results.review.among', { n: m.choices })}
                        </p>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </Section>

        {/* where the lead changed hands */}
        {turns.length > 0 && (
          <Section title={t('results.review.turns', { name: mine.name })} lead={t('results.review.turnsLead')}>
            <ol className="flex flex-col gap-2">
              {turns.map((x) => (
                <li key={x.at} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-brass-700/20 pb-2 last:border-0 last:pb-0">
                  <span className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.16em] text-cream-100/40">
                    {t(x.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: x.round })}
                  </span>
                  <span className="flex items-center gap-1.5 font-fell text-[13px] text-cream-100/90">
                    <ShapeChip color={colors[x.by]} size={9} />
                    {review.seats[x.by]?.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-cream-100/70">{moveOf(x.at)}</span>
                  <span className={cn('font-mono text-[12.5px] font-bold tnums', x.shift > 0 ? 'text-bottle-ink' : 'text-rust-400')}>
                    {x.shift > 0 ? '+' : ''}
                    {x.shift}
                  </span>
                  <button type="button" onClick={() => board(x.at)} className="font-sans text-[10.5px] uppercase tracking-[0.12em] text-cream-100/40 hover:text-brass-400">
                    {t('results.review.onTheBoard')}
                  </button>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/replay" className="btn-ledger !h-11">
            {t('results.page.replay')}
          </Link>
          <Link to="/results" className="btn-ledger !h-11">
            {t('results.review.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
