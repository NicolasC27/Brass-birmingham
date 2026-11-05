import { useId, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { Scale } from 'lucide-react';
import { COSTS, TOWN_BY_ID } from '@/game/data';
import { useGame } from '@/game/store';
import { useWhy } from '@/game/refusalRules';
import type { GameState } from '@/game/types';
import { roman } from '@/gl/roman';
import { localeOf, money, useLang, useT } from '@/i18n';
import type { ChapterId } from '@/platform/cours';
import { cn } from '@/lib/utils';
import { courseKeyOf } from './lessonWords';
import { FULL_ROWS, PURSE_CAP, SHORT_ROWS, bySource, reckon } from './reckoning';
import type { Source, Sources } from './reckoning';

/* ------------------------------------------------------------------ */
/* Why the game was won or lost, told on paper once it is over: the     */
/* reader's points beside the rival's, source by source; what the       */
/* reader left on the table; and three things to do better, each sent  */
/* to the lesson that teaches it and to the rules' chapter, opened at   */
/* the table. A short game's account ends on its close; a full game's   */
/* is kept era by era, and counts no purse.                             */
/* ------------------------------------------------------------------ */

/** below a rail's price, money left at a full game's end buys nothing a line need name */
const RAIL_PRICE = COSTS.railLink;
/** the ledger's own figures: Spectral, lining and tabular */
const FIG = 'font-serif tabular-nums [font-variant-numeric:lining-nums_tabular-nums]';
/** a figure below nought with its true minus */
const figure = (n: number): string => (n < 0 ? `−${-n}` : `${n}`);

/** a row of the account, in points */
const pointsOf = (s: Sources, row: Source): number => bySource(s)[row] ?? 0;

/** the chapter of the rules, opened over the table with a link to the codex */
const openChapter = (chapter: ChapterId) => (e: MouseEvent<HTMLButtonElement>) => {
  useWhy.getState().ask({ chapter, action: null }, e.currentTarget);
  useGame.getState().setRulesOpen(true);
};

export default function ReckoningPaper({ game, me, wide = false, className }: { game: GameState; me: number; wide?: boolean; className?: string }) {
  const t = useT();
  const lang = useLang();
  const titleId = useId();
  const r = useMemo(() => reckon(game, me), [game, me]);
  if (!r) return null;
  const listed = (items: string[]) => new Intl.ListFormat(localeOf(lang), { type: 'conjunction' }).format(items);
  const { me: mine, rival, left } = r;
  const note = (s: Sources, row: Source): string | null => {
    if (row === 'tiles' || row === 'railTiles') return s.flips.map((f) => `${f.count} × ${roman(f.level)}`).join(' · ') || null;
    if (row === 'links') return t('game.reckoning.canals', { n: s.laid.length });
    if (row === 'canalLinks') return t('game.reckoning.canals', { n: s.eras?.canals ?? 0 });
    if (row === 'railLinks') return t('game.reckoning.rails', { n: s.laid.length });
    if (row === 'purse') return money(s.books.money);
    return null;
  };
  /* a payday missed is a row only where one was */
  const rows = (r.full ? FULL_ROWS : SHORT_ROWS).filter((row) => row !== 'owed' || mine.owed > 0 || rival.owed > 0);
  /* the two widest gaps each way, named */
  const said = (xs: typeof r.gaps): string => listed(xs.slice(0, 2).map((x) => t('game.reckoning.gap', { source: t(`game.reckoning.source.${x.source}`), gap: x.gap })));
  const [ours, theirs] = r.won ? [r.gaps, r.leads] : [r.leads, r.gaps];
  const betterYou = ours.length ? t('game.reckoning.yours', { list: said(ours) }) : null;
  const betterThem = theirs.length ? t('game.reckoning.theirs', { list: said(theirs), rival: rival.name }) : null;
  /* what the result was made on: the winner's widest gaps, then where the
     other did better; level on points, what settled it, then each side's */
  const lead = r.tie
    ? [t(`game.reckoning.tie.${r.tie.by}`, { vp: r.tie.vp, rival: rival.name, ...(r.tie.by === 'money' ? { mine: money(r.tie.mine), theirs: money(r.tie.theirs) } : { mine: r.tie.mine, theirs: r.tie.theirs }) }), betterYou, betterThem]
    : [r.gaps.length ? t('game.reckoning.lead', { list: said(r.gaps) }) : null, r.won ? betterThem : betterYou];
  const leadLine = lead.filter((x): x is string => !!x).join(' ');
  const idle = left.passes + left.bare.length;
  /* a full game's words where its account differs: no close, rails */
  const full = (key: string) => (r.full ? `${key}Full` : key);
  const leftLines = [
    ...(left.unflipped.length
      ? [t(`game.reckoning.left.${full('unflipped')}`, { n: left.unflipped.length, vp: left.worth, list: listed(left.unflipped.map((u) => t('game.reckoning.left.tile', { industry: t(`game.log.industry.${u.industry}`), level: roman(u.level), town: TOWN_BY_ID[u.town]?.name ?? u.town }))) })]
      : []),
    ...(left.swept ? [t('game.reckoning.left.swept', { vp: left.swept })] : []),
    ...(idle ? [t('game.reckoning.left.idle', { n: idle, what: listed([...(left.passes ? [t('game.reckoning.left.passes', { n: left.passes })] : []), ...(left.bare.length ? [t(`game.reckoning.left.${full('bare')}`, { n: left.bare.length })] : [])]) })] : []),
    ...(left.beyond ? [t('game.reckoning.left.beyond', { money: money(left.beyond), cap: money(PURSE_CAP) })] : []),
    /* a full game's purse counts nothing: a rail's price or more left in it is a line */
    ...(left.purse >= RAIL_PRICE ? [t('game.reckoning.left.purse', { money: money(left.purse) })] : []),
  ];
  const th = 'pb-1 font-sans text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-900/55';
  const label = 'font-fell text-[10px] uppercase tracking-[0.2em] text-ink-900/55';

  return (
    <section aria-labelledby={titleId} className={cn('paper relative px-4 py-3 text-left shadow-e3', className)}>
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.3]" />
      <div className="relative">
        <div className="flex items-baseline gap-2">
          <Scale aria-hidden className="h-4 w-4 shrink-0 self-center text-ink-900/70" />
          <h3 id={titleId} className="font-display text-[16px] font-bold leading-tight text-ink-900">
            {t(r.won ? 'game.reckoning.won' : 'game.reckoning.lost')}
          </h3>
        </div>
        {leadLine && <p className="mt-1 font-serif text-[13px] italic leading-snug text-ink-900/80">{leadLine}</p>}

        <div className={cn('mt-2 grid gap-x-6 gap-y-3', wide && 'min-[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
          {/* the account, source by source: the reader's column, then the rival's */}
          <table className="w-full border-collapse self-start text-ink-900">
            <thead>
              <tr className="border-b border-ink-900/25">
                <th scope="col" className={cn(th, 'text-left')}>
                  <span className="sr-only">{t('game.scoring.groupPoints')}</span>
                </th>
                <th scope="col" className={cn(th, 'px-2 text-right')}>{t('game.reckoning.you')}</th>
                <th scope="col" className={cn(th, 'max-w-[9rem] truncate pl-2 text-right')}>{rival.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const a = pointsOf(mine, row);
                const b = pointsOf(rival, row);
                const na = note(mine, row);
                const nb = note(rival, row);
                return (
                  <tr key={row} className="border-b border-ink-900/10 align-top" title={t(`game.reckoning.tips.${row}`)}>
                    <th scope="row" className="py-[3px] pr-2 text-left font-serif text-[12.5px] font-normal leading-tight text-ink-900/85">{t(`game.reckoning.rows.${row}`)}</th>
                    <td className={cn(FIG, 'px-2 py-[3px] text-right text-[14px] leading-tight', a < b ? 'text-rust-700' : 'text-ink-900')}>
                      {figure(a)}
                      {na && <span className="block whitespace-nowrap font-sans text-[9.5px] leading-tight text-ink-900/55">{na}</span>}
                    </td>
                    <td className={cn(FIG, 'py-[3px] pl-2 text-right text-[14px] leading-tight text-ink-900/80')}>
                      {figure(b)}
                      {nb && <span className="block whitespace-nowrap font-sans text-[9.5px] leading-tight text-ink-900/50">{nb}</span>}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row" className="pt-1 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-900/70">{t('game.reckoning.rows.total')}</th>
                <td className={cn(FIG, 'px-2 pt-1 text-right text-[16px] font-semibold text-ink-900')}>{figure(mine.vp)}</td>
                <td className={cn(FIG, 'pl-2 pt-1 text-right text-[16px] font-semibold text-ink-900/80')}>{figure(rival.vp)}</td>
              </tr>
            </tbody>
          </table>

          <div className="min-w-0">
            {/* what the reader left on the table */}
            <p className={label}>{t('game.reckoning.left.title')}</p>
            <ul className="mt-0.5 flex flex-col gap-1 font-serif text-[12.5px] leading-snug text-ink-900/85">
              {leftLines.length ? leftLines.map((line) => <li key={line}>{line}</li>) : <li>{t('game.reckoning.left.none')}</li>}
            </ul>

            {/* and what to do better, each sent where it is taught */}
            {r.advice.length > 0 && (
              <>
                <p className={cn(label, 'mt-2.5')}>{t('game.reckoning.next')}</p>
                <ol className="mt-0.5 flex flex-col gap-1.5">
                  {r.advice.map((a) => {
                    /* the chapter of the rules that teaches it, where there is one */
                    const cite = a.chapter ? { id: a.chapter, title: t(`rules.chapters.${a.chapter}`) } : null;
                    return (
                      <li key={a.id} className="font-serif text-[12.5px] leading-snug text-ink-900/90">
                        {t(`game.reckoning.advice.${a.key}`, { ...a.vars, rival: rival.name, money: money(a.vars.money ?? 0), cap: money(a.vars.cap ?? 0) })}
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-sans text-[10.5px] text-ink-900/60">
                          <span>{t('game.reckoning.lesson', { title: t(`game.guide.steps.${courseKeyOf(a.lesson)}.title`, { bot: rival.name }) })}</span>
                          {cite && (
                            <button type="button" onClick={openChapter(cite.id)} aria-label={t('game.reckoning.chapterAria', { title: cite.title })} className="underline decoration-ink-900/30 underline-offset-2 hover:text-ink-900 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink-900/60 coarse:min-h-[44px]">
                              {t('game.reckoning.chapter', { title: cite.title })}
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
