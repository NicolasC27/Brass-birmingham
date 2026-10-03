import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useLang, useT, localeOf } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useTables } from '@/online/session';
import { toCards } from '@/platform/tables';
import { ephemerisOf } from '@/platform/almanac';
import type { Dispatch } from '@/online/table';

/* ------------------------------------------------------------------ */
/* /tableau — the departures board of the station, for a second screen: */
/* no chrome, the clock, the tables in play and about to leave on      */
/* flaps that turn when a letter changes, the telegraph's dispatches   */
/* running along the foot. It refreshes itself; nobody has to click.  */
/* ------------------------------------------------------------------ */

const ROWS = 10;
const WIDTH = 22;

/** a row of flaps: each character on its own leaf, which turns when it changes */
function Flaps({ text, width = WIDTH, className }: { text: string; width?: number; className?: string }) {
  const chars = text.toUpperCase().padEnd(width).slice(0, width).split('');
  return (
    <span className={cn('inline-flex gap-[2px]', className)} aria-label={text}>
      {chars.map((c, i) => (
        <Flap key={i} c={c} />
      ))}
    </span>
  );
}

/* a leaf keyed on its letter: a new letter mounts a new leaf, which turns in */
function Flap({ c }: { c: string }) {
  return (
    <span key={c} aria-hidden className="flap">
      {c === ' ' ? ' ' : c}
    </span>
  );
}

function Clock() {
  const lang = useLang();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tnums">{new Date(now).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>;
}

export default function Tableau() {
  const t = useT();
  const lang = useLang();
  const page = useTables({ limit: ROWS, sort: 'filling' });
  const cards = page ? toCards(page.tables, undefined, undefined, lang) : [];
  const dispatches: Dispatch[] = page?.dispatches ?? [];
  const year = ephemerisOf().year;
  const say = (d: Dispatch) => t(`game.gazette.${d.key}`, { ...d.vars, goods: d.vars.goods ? t(`game.log.industry.${d.vars.goods}`) : '' });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0a0e0c] px-8 py-6 text-[#ede6d6]">
      <header className="flex items-end justify-between border-b-2 border-[#C9A24B] pb-3">
        <div>
          <p className="font-fell text-[14px] uppercase tracking-[0.3em] text-[#C9A24B]">{t('platform.tableau.eyebrow', { year })}</p>
          <h1 className="font-fraunces text-[44px] font-medium uppercase leading-none tracking-[0.2em]" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t('platform.tableau.title')}
          </h1>
        </div>
        <p className="font-mono text-[40px] leading-none text-[#F0A92E]">
          <Clock />
        </p>
      </header>

      <table className="mt-6 w-full border-collapse font-mono text-[22px] leading-none" aria-live="polite">
        <caption className="sr-only">{t('platform.tableau.title')}</caption>
        <thead>
          <tr className="text-[12px] uppercase tracking-[0.3em] text-[#8b948c]">
            <th className="pb-3 text-left font-normal">{t('platform.tableau.colTrain')}</th>
            <th className="pb-3 text-left font-normal">{t('platform.tableau.colSeats')}</th>
            <th className="pb-3 text-left font-normal">{t('platform.tableau.colState')}</th>
            <th className="pb-3 text-left font-normal">{t('platform.tableau.colHost')}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }, (_, i) => {
            const c = cards[i];
            const seats = c ? `${c.seats.filter(Boolean).length}/${c.seats.length}` : '';
            const state = c ? (c.state === 'live' ? `${t(c.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal')} ${c.round ?? ''}` : t(`platform.state.${c.state}`)) : '';
            return (
              <tr key={i} className="border-b border-[#1c2521]">
                <td className="py-2">
                  <Flaps text={c ? tableTitle(c.name, lang) : ''} width={24} />
                </td>
                <td className="py-2">
                  <Flaps text={seats} width={4} />
                </td>
                <td className="py-2">
                  <Flaps text={state} width={16} className={cn(c?.state === 'live' && 'text-[#F0A92E]', c?.state === 'open' && 'text-[#3e8a66]')} />
                </td>
                <td className="py-2">
                  <Flaps text={c ? c.hostName : ''} width={14} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="mt-auto border-t border-[#1c2521] pt-4">
        <div className="flex items-center gap-4 overflow-hidden whitespace-nowrap font-serif text-[18px] italic text-[#c8bfac]">
          <span className="shrink-0 font-ui text-[11px] not-italic uppercase tracking-[0.3em] text-[#C9A24B]">{t('platform.home.telegraph.title')}</span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className={cn('inline-block', dispatches.length > 0 && 'ticker-run')}>
              {dispatches.length === 0 ? t('platform.home.telegraph.none') : dispatches.map((d, i) => <span key={`${d.code}:${d.at}:${i}`} className="mr-16">« {tableTitle(d.table, lang)} » — {say(d)}</span>)}
            </div>
          </div>
        </div>
        <p className="mt-3 font-ui text-[10px] uppercase tracking-[0.3em] text-[#5a635c]">
          <Link to="/" className="hover:text-[#ede6d6]">
            Blackrail
          </Link>
        </p>
      </footer>
    </div>
  );
}
