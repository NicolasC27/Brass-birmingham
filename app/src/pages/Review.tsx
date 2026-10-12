import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Bot, Eye, Loader2, Sparkles } from 'lucide-react';
import { TOWN_BY_ID } from '@/game/data';
import { describeAction } from '@/game/store';
import { reviewGame, swingsFor } from '@/game/review';
import type { Grade, Idle, Review as GameReview, SeatReview } from '@/game/review';
import ReviewCurve from '@/components/results/ReviewCurve';
import type { Mark } from '@/components/results/ReviewCurve';
import type { Note, Second } from '@/game/reviewWorker';
import { heldFinal as readFinal } from '@/game/final';
import { ShapeChip } from '@/components/game/TownInspector';
import EmptyNotice from '@/components/results/EmptyNotice';
import { seatInk } from '@/components/results/ink';
import Segmented from '@/components/setup/Segmented';
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
/* each told in an ink of the register, so the day reads them as the night */
const GRADE_TONE: Record<Grade, string> = {
  top: 'border-bottle-ink/70 text-bottle-ink',
  good: 'border-bottle-ink/40 text-bottle-ink',
  inaccuracy: 'border-brass-300/60 text-brass-300',
  mistake: 'border-signal-ink/70 text-signal-ink',
  blunder: 'border-rust-400/70 text-rust-400',
};
/** which judge reads the moves, by the reader's choice: the quick one
 *  weighs the table as it stands, the long one plays the replies out first */
const THINK = { quick: 'quick', careful: 'long' } as const;
type Depth = keyof typeof THINK;
/** whose moves the reading goes through: one place, or every one of them */
type Scope = 'seat' | 'table';


const hexOf = seatInk;

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
            <span className="truncate font-ui text-[13px] font-medium text-paper-100">{s.name}</span>
          </span>
          <span className="relative h-3.5 flex-1 overflow-hidden border border-[var(--gz-ink-faint)] bg-enamel-700/60">
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-500"
              style={{ width: `${(of(s) / most) * 100}%`, background: hexOf(colors[s.seat]), opacity: 0.85 }}
            />
            {mark !== undefined && mark > 0 && (
              <span aria-hidden className="absolute inset-y-0 w-px bg-paper-100/70" style={{ left: `${(mark / most) * 100}%` }} />
            )}
          </span>
          <span className="w-[150px] shrink-0 text-right font-mono text-[12px] text-paper-300 tnums">{label(s)}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="h2-section">{title}</h2>
      <div aria-hidden className="gz-rule-double mt-2" />
      {lead && <p className="mt-3 max-w-[72ch] font-ui text-[13.5px] leading-relaxed text-paper-300">{lead}</p>}
      <div className="mt-5">{children}</div>
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
      <EmptyNotice
        eyebrow={t('results.empty.eyebrow')}
        title={t('results.review.title')}
        actions={[
          { to: '/results', label: t('results.review.back') },
          { to: '/setup', label: t('platform.action.createTable') },
        ]}
      >
        {t('results.review.missing')}
      </EmptyNotice>
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
    <div className="gz-measure pb-16 pt-8">
      <div>
        <Link to="/results" className="micro-label inline-flex items-center gap-1.5 text-iron-400 transition-colors hover:text-paper-100">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('results.review.back')}
        </Link>

        <header className="mt-6">
          <p className="eyebrow-fell">{t('results.empty.eyebrow')}</p>
          <h1 className="display-page mt-2">{t('results.review.title')}</h1>
          <p className="mt-2 max-w-[72ch] font-serif text-[15px] italic leading-relaxed text-paper-300">{t('results.review.lead')}</p>
          <div aria-hidden className="gz-rule-double mt-5" />
        </header>

        {/* how the game ran, move by move */}
        <Section title={t('results.review.curve')} lead={t('results.review.curveLead')}>
          {/* the chart is drawn to a fixed box and scales with it: held to
              the reading width, its figures stay at the size of the text */}
          <div className="max-w-[880px]">
            <ReviewCurve curve={review.curve} seats={review.seats.map((x) => ({ name: x.name, color: colors[x.seat] }))} seat={mineSeat} marks={marks} onPick={board} />
          </div>
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {review.seats.map((x) => (
              <li key={x.seat} className="flex items-center gap-1.5 font-ui text-[12.5px] text-paper-300">
                <span aria-hidden className="h-0.5 w-5" style={{ background: hexOf(colors[x.seat]) }} />
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
                <li key={s.seat} className="border-b border-[var(--gz-ink-faint)] pb-3 last:border-0 last:pb-0">
                  <p className="title-card flex items-center gap-1.5">
                    <ShapeChip color={colors[s.seat]} size={10} />
                    {s.name}
                    <span className="ml-auto font-mono text-[12.5px] tnums" style={{ color: hexOf(colors[s.seat]) }}>
                      {t('results.review.vp', { vp: s.vp })}
                    </span>
                  </p>
                  <p className="mt-1 font-ui text-[13px] leading-relaxed text-paper-300">
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
                <p className="title-card flex items-center gap-1.5">
                  <ShapeChip color={colors[s.seat]} size={10} />
                  {s.name}
                  <span className="ml-auto font-mono text-[12px] font-normal text-paper-300 tnums">
                    {s.idle.length === 0 ? t('results.review.idleNone') : t('results.review.idleSome', { n: s.idle.length, vp: s.idleVp })}
                  </span>
                </p>
                {s.idle.length > 0 && (
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-iron-400">{s.idle.map(tileName).join(' · ')}</p>
                )}
                {s.sweptVp > 0 && (
                  <p className="mt-0.5 font-ui text-[12px] text-rust-400">{t('results.review.swept', { n: s.swept.length, vp: s.sweptVp })}</p>
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
            <table className="gz-timetable min-w-[420px] font-mono text-[12px] tnums [&_td]:py-1.5">
              <thead>
                <tr>
                  <th>{t('results.review.colRound')}</th>
                  <th className="!text-right">{t('results.review.colVp')}</th>
                  <th className="!text-right !text-brass-300">{t('results.review.colProj')}</th>
                  <th className="!text-right">{t('results.review.colIncome')}</th>
                  <th className="!text-right">{t('results.review.colPurse')}</th>
                  <th className="!text-right">{t('results.review.colSpent')}</th>
                </tr>
              </thead>
              <tbody>
                {review.rounds.map((r, i) => (
                  <tr key={`${r.era}-${r.round}-${i}`} className="text-paper-100">
                    <td className="text-left font-ui text-[12px] text-paper-300">
                      {t(r.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: r.round })}
                    </td>
                    <td className="text-right">{r.vp[mineSeat] ?? 0}</td>
                    <td className="text-right text-brass-300">{r.proj[mineSeat] ?? 0}</td>
                    <td className="text-right">{r.income[mineSeat] ?? 0}</td>
                    <td className="text-right">£{r.money[mineSeat] ?? 0}</td>
                    <td className="text-right text-iron-400">£{mine.spent[i] ?? 0}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-paper-100 [&>td]:border-t [&>td]:border-[var(--gz-ink)]">
                  <td className="micro-label text-left text-brass-300">{t('results.review.colClose')}</td>
                  <td className="text-right">{mine.vp}</td>
                  <td className="text-right text-brass-300">{mine.vp}</td>
                  <td className="text-right">{mine.income}</td>
                  <td className="text-right">£{mine.money}</td>
                  <td className="text-right text-iron-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* the machine's own reading, asked for by hand */}
        <Section title={t('results.review.machine')} lead={t('results.review.machineLead')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="micro-label mr-1 text-iron-400">{t('results.review.whichSeat')}</span>
            {review.seats.map((s) => (
              <button
                key={s.seat}
                type="button"
                aria-pressed={s.seat === mineSeat}
                onClick={() => pick(s.seat)}
                className={cn(
                  'flex items-center gap-1.5 border px-2.5 py-1 font-ui text-[13px] font-medium transition-colors',
                  /* the place being read is set in full ink on a ruled ground */
                  s.seat === mineSeat ? 'border-[rgb(var(--paper-100))] bg-enamel-700 text-paper-100' : 'border-[var(--gz-line-control)] text-paper-300 hover:border-[var(--gz-ink)] hover:text-paper-100',
                )}
              >
                <ShapeChip color={colors[s.seat]} size={9} />
                {s.name}
                {s.bot && <Bot className="h-3 w-3 opacity-60" />}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="micro-label mr-1 text-iron-400">{t('results.review.howLong')}</span>
            <Segmented<Depth>
              ariaLabel={t('results.review.howLong')}
              value={depth}
              onChange={setDepth}
              options={(Object.keys(THINK) as Depth[]).map((d) => ({ value: d, label: t(`results.review.depth.${d}`) }))}
            />
            <Segmented<Scope>
              className="ml-3"
              ariaLabel={t('results.review.whichSeat')}
              value={scope}
              onChange={setScope}
              options={(['seat', 'table'] as Scope[]).map((k) => ({ value: k, label: t(`results.review.scope.${k}`) }))}
            />
            <button type="button" onClick={ask} disabled={busy} className="gz-ticket gz-ticket-brass ml-auto disabled:cursor-wait disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? t('results.review.machineBusy') : scope === 'table' ? t('results.review.machineAskAll') : t('results.review.machineAsk', { name: mine.name })}
            </button>
          </div>

          {busy && (
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="relative h-2 overflow-hidden border border-[var(--gz-ink-faint)] bg-enamel-700/60">
                <span
                  className="absolute inset-y-0 left-0 bg-brass-400/80 transition-[width] duration-200"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 4}%` }}
                />
              </span>
              <span className="font-mono text-[11px] text-iron-400 tnums">
                {t('results.review.machineRead', { done: progress.done, total: progress.total })}
                {progress.left > 0 ? ` · ${t('results.review.machineLeft', { s: progress.left })}` : ''}
              </span>
            </div>
          )}

          {failed && <p className="mt-3 font-ui text-[13px] text-rust-400">{t('results.review.machineFailed')}</p>}

          {graded.length > 0 && (
            <>
              {/* the card a chess review opens with */}
              <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-[var(--gz-ink-soft)] pt-4">
                <p className="flex flex-col">
                  <span className="font-fraunces text-[30px] leading-none text-brass-300 tnums">{rightness}%</span>
                  <span className="micro-label mt-1 text-iron-400">{t('results.review.rightness')}</span>
                </p>
                <ul className="flex flex-wrap items-center gap-1.5">
                  {counts.map((x) => (
                    <li
                      key={x.grade}
                      className={cn('border px-2 py-1 font-ui text-[11.5px]', x.n === 0 ? 'border-[var(--gz-ink-faint)] text-iron-400' : GRADE_TONE[x.grade])}
                    >
                      <span className="font-mono font-bold tnums">{x.n}</span> {t(`results.review.grade.${x.grade}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 max-w-[72ch] font-ui text-[12.5px] leading-relaxed text-paper-300">{t('results.review.rightnessLead', { n: graded.length })}</p>

              {readSeats.length > 1 && (
                <div className="mt-4 border-t border-[var(--gz-ink-soft)] pt-3">
                  <p className="micro-label mb-2 text-iron-400">{t('results.review.everySeat')}</p>
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
                                <span className={cn('truncate font-ui text-[13px] font-medium', x.seat === mineSeat ? 'text-paper-100' : 'text-paper-300')}>{x.name}</span>
                              </span>
                              <span className="relative h-3 flex-1 overflow-hidden border border-[var(--gz-ink-faint)] bg-enamel-700/60">
                                <span className="absolute inset-y-0 left-0" style={{ width: `${pc}%`, background: hexOf(colors[x.seat]), opacity: x.seat === mineSeat ? 0.9 : 0.5 }} />
                              </span>
                              <span className="w-[92px] shrink-0 text-right font-mono text-[12px] text-paper-300 tnums">
                                {t('results.review.seatScore', { pc, n: (reading[x.seat] ?? []).length })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}

              {worst.length === 0 && <p className="mt-3 font-ui text-[13px] text-paper-300">{t('results.review.machineAgrees', { name: mine.name })}</p>}

              {worst.length > 0 && (
                <>
                  <p className="title-card mt-6">{t('results.review.otherwise')}</p>
                  <ol className="mt-2 flex flex-col gap-2">
                    {worst.map((m) => (
                      <li key={m.at} className="border border-[var(--gz-ink-soft)] bg-enamel-850 px-3 py-2">
                        <p className="micro-label flex flex-wrap items-center gap-2 text-iron-400">
                          {t(m.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: m.round })}
                          <span className={cn('border px-1.5 py-px', GRADE_TONE[m.grade])}>{t(`results.review.grade.${m.grade}`)}</span>
                          <button type="button" onClick={() => board(m.at)} className="ml-auto flex items-center gap-1 text-paper-300 underline decoration-[var(--gz-ink-soft)] underline-offset-[3px] hover:text-paper-100">
                            <Eye className="h-3 w-3" /> {t('results.review.onTheBoard')}
                          </button>
                        </p>
                        <p className="mt-1 font-mono text-[12px] text-paper-100">{t('results.review.yours', { move: describeAction(m.yours) })}</p>
                        <p className="font-mono text-[12px] text-brass-300">{t('results.review.theirs', { move: m.theirs ? describeAction(m.theirs) : '—' })}</p>
                        <p className="mt-0.5 font-ui text-[11.5px] text-iron-400">
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
                <li key={x.at} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--gz-ink-faint)] pb-2 last:border-0 last:pb-0">
                  {/* the turn and the seat are columns: the names and the
                      moves start at one place down the list */}
                  <span className="micro-label w-[5.5rem] shrink-0 text-iron-400">
                    {t(x.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: x.round })}
                  </span>
                  <span className="flex min-w-[9.5rem] items-center gap-1.5 font-ui text-[13px] font-medium text-paper-100">
                    <ShapeChip color={colors[x.by]} size={9} />
                    {review.seats[x.by]?.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-paper-300">{moveOf(x.at)}</span>
                  <span className={cn('font-mono text-[12.5px] font-bold tnums', x.shift > 0 ? 'text-bottle-ink' : 'text-rust-400')}>
                    {x.shift > 0 ? '+' : ''}
                    {x.shift}
                  </span>
                  <button type="button" onClick={() => board(x.at)} className="micro-label text-paper-300 underline decoration-[var(--gz-ink-soft)] underline-offset-[3px] hover:text-paper-100">
                    {t('results.review.onTheBoard')}
                  </button>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-[var(--gz-ink-soft)] pt-6">
          <Link to="/replay" className="gz-ticket">
            {t('results.page.replay')}
          </Link>
          <Link to="/results" className="gz-ticket">
            {t('results.review.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
