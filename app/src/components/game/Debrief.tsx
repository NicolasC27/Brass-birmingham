import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Eye, Sparkles, X } from 'lucide-react';
import { describeAction, useGame } from '@/game/store';
import { readDebrief } from '@/game/debrief';
import type { Moment, Reading } from '@/game/debrief';
import type { GameAction } from '@/game/actions';
import type { Grade } from '@/game/review';
import type { GameState } from '@/game/types';
import { useT } from '@/i18n';
import { GUIDE_RAIL, guideDock } from './guideKeys';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The debrief panel — the guide turned reviewer once the game is over. */
/* It reads the reader's turns one by one (the machine thinks a beat at  */
/* each), keeps the three moments where another move read better, and    */
/* shows any of them on the board: the table as it stood, the move       */
/* played, the move that read best, and why.                             */
/*                                                                      */
/* The reading and the grades are the review page's own, so the panel    */
/* and the page never say different things about the same move.          */
/* ------------------------------------------------------------------ */

/** the grades as they read on paper (the review page wears its own tones
 *  against the dark) */
const GRADE_TONE: Record<Grade, string> = {
  top: 'border-bottle-700/45 text-bottle-700',
  good: 'border-bottle-700/35 text-bottle-700/80',
  inaccuracy: 'border-brass-700/50 text-brass-700',
  mistake: 'border-copper-700/55 text-copper-700',
  blunder: 'border-rust-700/55 text-rust-700',
};

const whyKey = (a: GameAction): string => {
  if (a.kind === 'build') return a.industry === 'coal' || a.industry === 'iron' || a.industry === 'brewery' ? a.industry : 'works';
  return a.kind;
};
/** where on the map a move happens, for the camera */
const regionOf = (a: GameAction): string | null => {
  switch (a.kind) {
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

export default function Debrief({ game, me }: { game: GameState; me: number }) {
  const t = useT();
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const review = useGame((s) => s.review);
  const setReview = useGame((s) => s.setReview);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const [read, setRead] = useState<Reading>({ done: 0, total: 0, moments: [] });
  const [done, setDone] = useState(false);
  const cancelled = useRef(false);
  /* the log is walked once, a turn read per tick, so the page keeps
     breathing while the machine thinks */
  useEffect(() => {
    cancelled.current = false;
    const reading = readDebrief(game, me, { budgetMs: 120 });
    const step = () => {
      if (cancelled.current) return;
      const next = reading.next();
      setRead(next.value);
      setDone(!!next.done);
      if (!next.done) window.setTimeout(step, 16);
    };
    const id = window.setTimeout(step, 30);
    return () => {
      cancelled.current = true;
      window.clearTimeout(id);
    };
  }, [game, me]);
  const machine = game.players.find((p) => p.isBot)?.name ?? t('game.debrief.machine');
  const show = (m: Moment) => {
    setReview({ at: m.at, round: m.round, state: m.before, mine: m.mine, better: m.better });
    const where = regionOf(m.better) ?? regionOf(m.mine);
    if (where) flyToRegion(where);
  };
  const close = () => setDebriefOpen(false);
  const width = Math.max(GUIDE_RAIL, guideDock());
  return (
    <aside data-debrief aria-label={t('game.debrief.title')} className="pointer-events-auto fixed inset-y-0 right-0 z-[80] flex flex-col gap-3 overflow-y-auto border-l border-brass-hairline bg-coal-950/92 px-3 py-3 backdrop-blur-md" style={{ width }}>
      <div className="flex shrink-0 items-center gap-2">
        <Sparkles className="h-4 w-4 text-brass-400" aria-hidden />
        <span className="font-fell text-[11px] uppercase tracking-[0.2em] text-cream-100/60">{t('game.debrief.title')}</span>
        <span className="flex-1" />
        <button type="button" onClick={close} aria-label={t('game.debrief.close')} title={t('game.debrief.close')} className="rounded-md border border-brass-700/50 p-1 text-brass-400/80 transition-colors hover:border-brass-400 hover:text-brass-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="font-serif text-[12.5px] leading-snug text-cream-100/70">{t('game.debrief.lede', { name: machine })}</p>
      {!done && (
        <p className="font-mono text-[11px] text-cream-100/50">
          {t('game.debrief.reading', { done: read.done, total: read.total })}
          <span className="ml-2 inline-block h-1 w-24 overflow-hidden rounded-full bg-coal-800 align-middle">
            <span className="block h-full bg-brass-400/80" style={{ width: `${read.total ? (read.done / read.total) * 100 : 0}%` }} />
          </span>
        </p>
      )}
      {done && read.moments.length === 0 && <p className="paper px-3 py-2 font-serif text-[12.5px] leading-snug text-ink-900">{t('game.debrief.none', { name: machine })}</p>}
      {read.moments.map((m, i) => {
        const shown = review?.at === m.at;
        return (
          <article key={m.at} className={cn('paper relative flex flex-col gap-1.5 px-3 py-2.5 shadow-e3', shown && 'ring-2 ring-brass-400')}>
            <div className="flex items-baseline gap-2">
              <span className="font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55">{t('game.debrief.moment', { n: i + 1 })}</span>
              <span className="font-display text-[13px] font-bold text-ink-900">{t('game.debrief.round', { round: m.round, era: t(m.era === 'canal' ? 'game.topbar.eraCanal' : 'game.topbar.eraRail') })}</span>
              <span className={cn('ml-auto rounded-sm border px-1.5 py-px font-sans text-[9.5px] font-semibold uppercase tracking-[0.12em]', GRADE_TONE[m.grade])}>{t(`results.review.grade.${m.grade}`)}</span>
            </div>
            <p className="font-sans text-[11px] text-ink-900/70">
              <span className="font-semibold text-ink-900">{t('game.debrief.you')}</span> {describeAction(m.mine)}
            </p>
            <p className="font-sans text-[11px] text-ink-900/70">
              <span className="font-semibold text-bottle-700">{t('game.debrief.better', { name: machine })}</span> {describeAction(m.better)}
            </p>
            <p className="font-serif text-[12px] leading-snug text-ink-900/85">
              {t(`game.guide.suggest.why.${whyKey(m.better)}`, { name: machine })}
            </p>
            <p className="font-sans text-[10.5px] text-ink-900/50">{t('results.review.among', { n: m.choices })}</p>
            <button type="button" onClick={() => (shown ? setReview(null) : show(m))} className="btn-ledger mt-1 !min-h-[30px] self-start !border-ink-900/50 !px-3 !py-1 !text-[10px] !text-ink-900 hover:!bg-ink-900/10">
              <Eye className="h-3.5 w-3.5" /> {shown ? t('game.debrief.back') : t('game.debrief.see')} <ChevronRight className="h-3 w-3" />
            </button>
          </article>
        );
      })}
    </aside>
  );
}
