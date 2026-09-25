import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Bot, Loader2, Sparkles } from 'lucide-react';
import { PLAYER_COLORS, TOWN_BY_ID } from '@/game/data';
import { describeAction } from '@/game/store';
import { reviewGame } from '@/game/review';
import type { Idle, Review as GameReview, SeatReview } from '@/game/review';
import type { Note, Second } from '@/game/reviewWorker';
import { FINAL_KEY } from '@/game/types';
import type { FinalPayload } from '@/game/types';
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
/** how long the machine may think about one move, by the reader's choice */
const THINK = { quick: 350, careful: 1500 } as const;
type Depth = keyof typeof THINK;

function readFinal(): FinalPayload | null {
  try {
    const raw = localStorage.getItem(FINAL_KEY);
    return raw ? (JSON.parse(raw) as FinalPayload) : null;
  } catch {
    return null;
  }
}

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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, left: 0 });
  const started = useRef(0);
  const [seconds, setSeconds] = useState<Second[] | null>(null);
  const [failed, setFailed] = useState(false);
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  if (!review || !final) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fell text-lg text-cream-100/80">{t('results.review.missing')}</p>
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
    worker.current?.terminate();
    worker.current = null;
  };

  const pick = (seat: number) => {
    stop();
    setPicked(seat);
    setBusy(false);
    setSeconds(null);
    setFailed(false);
    setProgress({ done: 0, total: 0, left: 0 });
  };

  const ask = () => {
    if (!final.setup || final.seed === undefined || !final.actions) return;
    stop();
    setBusy(true);
    setFailed(false);
    setSeconds(null);
    setProgress({ done: 0, total: 0, left: 0 });
    const w = new Worker(new URL('../game/reviewWorker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<Note>) => {
      const note = e.data;
      if (note.kind === 'progress') {
        /* what is left is measured, not guessed: the moves already read say
           how long a move takes at this table */
        /* the worker opens with an empty bar: that note is the starting gun */
        if (note.done === 0) started.current = performance.now();
        const spent = performance.now() - started.current;
        const left = note.done > 1 ? Math.round(((spent / note.done) * (note.total - note.done)) / 1000) : 0;
        setProgress({ done: note.done, total: note.total, left });
      }
      if (note.kind === 'done') {
        setSeconds(note.moves.filter((m) => m.gap > 0).sort((a, b) => b.gap - a.gap));
        setBusy(false);
        stop();
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
    w.postMessage({ setup: final.setup, seed: final.seed, actions: final.actions, seat: mineSeat, budgetMs: THINK[depth] });
  };

  const tileName = (x: Idle): string => t('results.review.tile', { works: t(`game.log.industry.${x.industry}`), level: x.level, town: TOWN_BY_ID[x.town]?.name ?? x.town });
  const widest = Math.max(1, ...(seconds ?? []).map((s) => s.gap));

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
                    <span className="ml-auto font-mono text-[12px] tnums" style={{ color: hexOf(colors[s.seat]) }}>
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
                <p className="flex items-center gap-1.5 font-fell text-[13.5px] text-cream-100/90">
                  <ShapeChip color={colors[s.seat]} size={10} />
                  {s.name}
                  <span className="ml-auto font-mono text-[11.5px] text-cream-100/60 tnums">
                    {s.idle.length === 0 ? t('results.review.idleNone') : t('results.review.idleSome', { n: s.idle.length, vp: s.idleVp })}
                  </span>
                </p>
                {s.idle.length > 0 && (
                  <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-cream-100/50">{s.idle.map(tileName).join(' · ')}</p>
                )}
                {s.sweptVp > 0 && (
                  <p className="mt-0.5 font-sans text-[11.5px] text-rust-400/90">{t('results.review.swept', { n: s.swept.length, vp: s.sweptVp })}</p>
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
                  <th className="border-b border-brass-700/40 py-1 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('results.review.colRound')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('results.review.colVp')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-400">{t('results.review.colProj')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('results.review.colIncome')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('results.review.colPurse')}</th>
                  <th className="border-b border-brass-700/40 py-1 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.14em]">{t('results.review.colSpent')}</th>
                </tr>
              </thead>
              <tbody>
                {review.rounds.map((r, i) => (
                  <tr key={`${r.era}-${r.round}-${i}`} className="text-cream-100/80">
                    <td className="border-b border-brass-700/15 py-1 text-left font-sans text-[11px] text-cream-100/60">
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
                  <td className="py-1.5 text-left font-sans text-[11px] uppercase tracking-[0.12em] text-brass-400">{t('results.review.colClose')}</td>
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
            <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-cream-100/45">{t('results.review.whichSeat')}</span>
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
            <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-cream-100/45">{t('results.review.howLong')}</span>
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
            <button type="button" onClick={ask} disabled={busy} className="btn-strike !h-9 !px-4 !text-[11px] disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? t('results.review.machineBusy') : t('results.review.machineAsk', { name: mine.name })}
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
              <span className="font-mono text-[11px] text-cream-100/55 tnums">
                {t('results.review.machineRead', { done: progress.done, total: progress.total })}
                {progress.left > 0 ? ` · ${t('results.review.machineLeft', { s: progress.left })}` : ''}
              </span>
            </div>
          )}

          {failed && <p className="mt-3 font-sans text-[12.5px] text-rust-400">{t('results.review.machineFailed')}</p>}

          {seconds && seconds.length === 0 && <p className="mt-3 font-sans text-[12.5px] text-cream-100/75">{t('results.review.machineAgrees', { name: mine.name })}</p>}

          {seconds && seconds.length > 0 && (
            <>
              <p className="mt-3 font-sans text-[12.5px] text-cream-100/70">{t('results.review.machineFound', { n: seconds.length, name: mine.name })}</p>
              <ol className="mt-2 flex flex-col gap-2">
                {seconds.slice(0, 8).map((s) => (
                  <li key={s.at} className="rounded-md border border-brass-700/40 bg-coal-900/50 px-3 py-2">
                    <p className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-100/40">
                      {t(s.era === 'canal' ? 'results.review.atCanal' : 'results.review.atRail', { round: s.round })}
                      <span aria-hidden className="relative ml-auto h-1 w-16 overflow-hidden rounded-sm bg-coal-800">
                        <span className="absolute inset-y-0 left-0 rounded-sm bg-brass-400/70" style={{ width: `${(s.gap / widest) * 100}%` }} />
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[11.5px] text-cream-100/85">{t('results.review.yours', { move: describeAction(s.yours) })}</p>
                    <p className="font-mono text-[11.5px] text-brass-400">{t('results.review.theirs', { move: s.theirs ? describeAction(s.theirs) : '—' })}</p>
                  </li>
                ))}
              </ol>
              {seconds.length > 8 && <p className="mt-2 font-sans text-[11.5px] text-cream-100/45">{t('results.review.andMore', { n: seconds.length - 8 })}</p>}
            </>
          )}
        </Section>

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
