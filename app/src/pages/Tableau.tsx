import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLang, useT, localeOf } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useStranger, useTables } from '@/online/session';
import { toCards, type CardTable } from '@/platform/tables';
import { ephemerisOf } from '@/platform/almanac';
import type { Dispatch } from '@/online/table';

/* ------------------------------------------------------------------ */
/* /tableau — the departures board of the station, for a second screen: */
/* no chrome, the clock, the tables in play and about to leave on      */
/* flaps that turn when a letter changes, the telegraph's dispatches   */
/* running along the foot. It refreshes itself; nobody has to click.  */
/* ------------------------------------------------------------------ */

/** the rows a landscape screen shows; a portrait one shows as many as fit */
const ROWS = 10;

/* the columns, in leaves: the state says only the state, the progress of a
   table in play has its own column */
const COLS = [
  { key: 'colTrain', leaves: 24 },
  { key: 'colSeats', leaves: 5 },
  { key: 'colState', leaves: 8 },
  { key: 'colProgress', leaves: 16 },
  { key: 'colHost', leaves: 14 },
] as const;

/* a leaf is 0.72em wide (.flap) with 2px between two leaves, and the alley
   between two columns is ALLEY em: the type is sized so the leaves and the
   alleys fill the frame exactly, whatever the width of the screen. The floor
   keeps a tablet held upright (768px) inside its frame; past the ceiling the
   whole board, rules and all, stops widening and stands centred on the black,
   so the rules never run on beyond the leaves and the header keeps its
   proportion to them */
const ALLEY = 2;
const LEAVES = COLS.reduce((n, c) => n + c.leaves, 0);
const JOINS = (LEAVES - COLS.length) * 2;
const EMS = +(LEAVES * 0.72 + (COLS.length - 1) * ALLEY).toFixed(3);
const SIZE_MIN = 10;
const SIZE_MAX = 36;
const MEASURE = Math.ceil(SIZE_MAX * EMS + JOINS);
const colWidth = (leaves: number) => `calc(${+(leaves * 0.72 + ALLEY).toFixed(3)}em + ${(leaves - 1) * 2}px)`;

/* the height the board spends outside its rows: the plate's padding, the
   header, the status line, the column heads and the foot */
const CHROME = 360;

/** how many rows the screen holds: ten on a landscape screen, as many as fit
 *  on a portrait one, so the foot does not fall alone to the bottom */
function fitRows(): number {
  if (typeof window === 'undefined') return ROWS;
  const { innerWidth: w, innerHeight: h } = window;
  if (h <= w) return ROWS;
  const size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, (Math.min(w - 64, MEASURE) - JOINS) / EMS));
  const row = size * 1.3 + 17;
  return Math.min(30, Math.max(ROWS, Math.floor((h - CHROME) / row)));
}

function useRows(): number {
  const [rows, setRows] = useState(fitRows);
  useEffect(() => {
    const on = () => setRows(fitRows());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return rows;
}

/** a row of flaps: each character on its own leaf, which turns when it changes;
 *  the reader hears the words, not the leaves */
function Flaps({ text, width, className }: { text: string; width: number; className?: string }) {
  const chars = text.toUpperCase().padEnd(width).slice(0, width).split('');
  return (
    <span className={cn('inline-flex', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex gap-[2px]">
        {chars.map((c, i) => (
          <Flap key={i} c={c} />
        ))}
      </span>
    </span>
  );
}

/* a leaf keyed on its letter: a new letter mounts a new leaf, which turns in */
function Flap({ c }: { c: string }) {
  return (
    <span key={c} className="flap">
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
  const rows = useRows();
  const stranger = useStranger();
  const reduced = useReducedMotion();
  const page = useTables({ limit: rows, sort: 'filling' });
  const cards = page ? toCards(page.tables, undefined, undefined, lang) : [];
  const dispatches: Dispatch[] = page?.dispatches ?? [];
  const year = ephemerisOf().year;
  const say = (d: Dispatch) => t(`game.gazette.${d.key}`, { ...d.vars, goods: d.vars.goods ? t(`game.log.industry.${d.vars.goods}`) : '' });
  /* the table quoted in the language's own marks and spaces */
  const line = (d: Dispatch) => `${t('platform.tableau.quoted', { table: tableTitle(d.table, lang) })} — ${say(d)}`;

  /* one line under the header says what the board is showing: the three
     silences are not the same, and the reader is told the count */
  /* "open" counts what the board writes OUVERTE: every table not yet running
     and not full — the register's own "seats" filter leaves out the reader's
     tables and the ranked ones, which the board shows like any other */
  const open = page ? page.counts.all - page.counts.live - cards.filter((c) => c.state === 'full').length : 0;
  const status = stranger
    ? t('platform.home.board.signIn')
    : !page
      ? t('platform.home.board.loading')
      : cards.length === 0
        ? t('platform.tableau.empty')
        : t('platform.tableau.summary', { n: page.total, open });

  const progress = (c: CardTable) =>
    c.state === 'live' && c.round ? t('platform.tableau.progress', { era: t(c.era === 'rail' ? 'platform.tableau.rail' : 'platform.tableau.canal'), turn: t('platform.state.turn', { round: c.round }) }) : '';

  /* the ticker stops under the hand and under the keyboard; under reduced
     motion it does not run at all and the last three dispatches stand
     one above the other */
  const running = dispatches.length > 0 && !reduced;

  return (
    /* the board is a black plate in both registers — a station's board is
       black — so it wears the night on itself and every class below reads it */
    <div data-theme="dark" className="flex min-h-[100dvh] flex-col bg-lacquer-950 px-8 py-6 text-paper-100">
      <div className="mx-auto flex w-full flex-1 flex-col" style={{ maxWidth: MEASURE }}>
        <header className="flex items-end justify-between border-b-2 border-[rgb(var(--brass-plate))] pb-3">
          <div>
            <p className="eyebrow-fell uppercase">{t('platform.tableau.eyebrow', { year })}</p>
            <h1 className="mt-1 font-fraunces text-[44px] font-medium uppercase leading-none tracking-[0.2em]">{t('platform.tableau.title')}</h1>
          </div>
          {/* the board's dial: the one figure read from across the hall */}
          <p className="dial text-signal-400">
            <Clock />
          </p>
        </header>

        <p role="status" className="mt-3 font-serif text-[15px] italic text-paper-300">
          {status}
        </p>

        <div className="mt-5 [container-type:inline-size]">
          <table className="w-full table-fixed border-collapse font-mono leading-none" style={{ fontSize: `clamp(${SIZE_MIN}px, calc((100cqw - ${JOINS}px) / ${EMS}), ${SIZE_MAX}px)` }}>
            <caption className="sr-only">{t('platform.tableau.title')}</caption>
            <colgroup>
              {COLS.map((c, i) => (
                <col key={c.key} style={i < COLS.length - 1 ? { width: colWidth(c.leaves) } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className="micro-label px-0 pb-3 text-left text-iron-400">
                    {t(`platform.tableau.${c.key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => {
                const c = cards[i];
                const seats = c ? `${c.seats.filter(Boolean).length}/${c.seats.length}` : '';
                return (
                  <tr key={i} className="border-b border-paper-100/20">
                    <td className="px-0 py-2">
                      <Flaps text={c ? tableTitle(c.name, lang) : ''} width={COLS[0].leaves} />
                    </td>
                    <td className="px-0 py-2">
                      <Flaps text={seats} width={COLS[1].leaves} />
                    </td>
                    <td className="px-0 py-2">
                      <Flaps text={c ? t(`platform.state.${c.state}`) : ''} width={COLS[2].leaves} className={cn(c?.state === 'live' && 'text-signal-400', c?.state === 'open' && 'text-bottle-ink', c?.state === 'full' && 'text-iron-400')} />
                    </td>
                    <td className="px-0 py-2">
                      <Flaps text={c ? progress(c) : ''} width={COLS[3].leaves} className="text-signal-400" />
                    </td>
                    <td className="px-0 py-2">
                      <Flaps text={c ? c.hostName : ''} width={COLS[4].leaves} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="mt-auto border-t border-paper-100/20 pt-4">
          <div className="flex items-baseline gap-4 font-serif text-[18px] italic text-paper-300">
            <span className="micro-label shrink-0 not-italic text-brass-300">{t('platform.home.telegraph.title')}</span>
            {dispatches.length === 0 ? (
              <p className="min-w-0 flex-1">{t('platform.home.telegraph.none')}</p>
            ) : !running ? (
              <ul className="min-w-0 flex-1">
                {dispatches.slice(0, 3).map((d, i) => (
                  <li key={`${d.code}:${d.at}:${i}`}>{line(d)}</li>
                ))}
              </ul>
            ) : (
              <div role="marquee" tabIndex={0} aria-label={t('platform.home.telegraph.title')} className="min-w-0 flex-1 overflow-hidden whitespace-nowrap [&:focus-within_.ticker-run]:[animation-play-state:paused] [&:hover_.ticker-run]:[animation-play-state:paused]">
                <div className="ticker-run inline-block">
                  {dispatches.map((d, i) => (
                    <span key={`${d.code}:${d.at}:${i}`} className="mr-16">
                      {line(d)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link to="/" className="micro-label mt-2 inline-flex items-center gap-1.5 py-1.5 text-paper-300 transition-colors duration-150 hover:text-paper-100">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t('platform.account.back')}
          </Link>
        </footer>
      </div>
    </div>
  );
}
