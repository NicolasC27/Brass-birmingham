import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Armchair, ChevronLeft, ChevronRight, Eye, Loader2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { lobby } from '@/online/lobby';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { TABLE_PAGE, type TableFilter, type TableSort } from '@/online/table';
import { PLAYER_COLORS } from '@/game/data';
import { eraRounds } from '@/game/data';
import { toCard, toCards, type CardTable } from '@/platform/tables';
import EmptyState from '@/components/platform/EmptyState';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 3 (play.md) — the tables, in two storeys.                    */
/* Above, what concerns the reader, three short timetables: their own   */
/* tables, their friends' and the most watched games. Below, the        */
/* register: every table of the house as a line of the timetable,       */
/* twenty a page, searched, filtered and                                */
/* sorted by the office itself (useTables asks for one page), so a      */
/* thousand tables read like a ledger and cost one page on the wire.    */
/* "Seat me" takes the open table nearest to starting for whoever will  */
/* not choose among them.                                               */
/* ------------------------------------------------------------------ */

const FILTERS: TableFilter[] = ['all', 'seats', 'friends', 'ranked', 'rail', 'live'];

/** the table as a train on the board: the engine, then a carriage a seat —
 *  painted in the passenger's colour once taken (a machine's paler), an
 *  empty outline while free, the reader's own ringed in brass */
function SeatTrain({ table }: { table: CardTable }) {
  const t = useT();
  const seats = table.seats;
  const w = 22 + seats.length * 17;
  return (
    <svg viewBox={`0 0 ${w} 14`} width={w * 1.15} height={16} className="block shrink-0 overflow-visible" role="img" aria-label={seats.map((s) => (s ? s.name : t('platform.seat.free'))).join(', ')}>
      {/* the engine, drawn as the rail's own */}
      <g fill="currentColor" className="text-paper-100">
        <rect x="0" y="6" width="5" height="4" />
        <rect x="6" y="3" width="4" height="7" />
        <rect x="9.5" y="5" width="10" height="5" rx="2" />
        <rect x="16.5" y="1" width="2" height="5" />
        <circle cx="8" cy="11.2" r="1.9" />
        <circle cx="14.5" cy="11.6" r="1.4" />
        <circle cx="18.5" cy="11.6" r="1.4" />
      </g>
      {seats.map((s, i) => {
        const x = 22 + i * 17;
        return (
          <g key={i}>
            {s ? (
              <>
                <title>{s.name}</title>
                <rect x={x} y="4" width="15" height="6" rx="1" fill={PLAYER_COLORS[s.color]?.hex ?? '#C9A45C'} opacity={s.kind === 'bot' ? 0.6 : 1} />
                {[x + 2.5, x + 6.5, x + 10.5].map((wx) => (
                  <rect key={wx} x={wx} y="5.5" width="2" height="2.6" rx="0.4" fill="rgb(var(--lacquer-900))" opacity="0.7" />
                ))}
                {s.you && <rect x={x - 1} y="3" width="17" height="8" rx="1.5" fill="none" stroke="rgb(var(--brass-300))" strokeWidth="1" />}
              </>
            ) : (
              <rect x={x} y="4" width="15" height="6" rx="1" fill="none" stroke="var(--gz-ink-soft)" strokeDasharray="1.5 1.5" />
            )}
            <circle cx={x + 3.5} cy="11.6" r="1.3" fill="currentColor" className="text-paper-100" opacity={s ? 1 : 0.3} />
            <circle cx={x + 11.5} cy="11.6" r="1.3" fill="currentColor" className="text-paper-100" opacity={s ? 1 : 0.3} />
          </g>
        );
      })}
    </svg>
  );
}

const boarding = 'font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition-colors disabled:opacity-50';
/** the lamp beside a state: lit and breathing for a game in play */
const LAMP: Record<string, string> = { live: 'bg-signal-400 shadow-[0_0_6px_rgb(var(--signal-400))] animate-pulse', open: 'bg-bottle-400', full: 'bg-iron-600' };

function Row({ table, busy, i = 0, onJoin, onResume, onWatch }: { table: CardTable; busy: boolean; i?: number; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  const t = useT();
  const total = eraRounds(table.seats.filter(Boolean).length || 2);
  const detail =
    table.state === 'live'
      ? `${t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal')} · ${t('platform.play.tables.roundOf', { round: table.round ?? 1, total })}`
      : t('platform.play.tables.host', { name: table.hostName });
  /* the ticket at the end of the line: brass to board, plain to watch */
  const action = table.mine
    ? { label: t('platform.play.tables.resume'), go: () => onResume(table), brass: true }
    : table.state === 'live'
      ? { label: t('platform.play.tables.watch'), go: () => onWatch(table), brass: false, icon: true }
      : table.state === 'open' && table.mode !== 'ranked'
        ? { label: t('platform.play.tables.join'), go: () => onJoin(table), brass: true }
        : null;
  return (
    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut', delay: 0.03 * i }} className={cn(table.mine && 'bg-brass-500/[.05]')}>
      <td className="w-[36px] pr-0">
        <span className="data-text text-[11px] text-iron-600 tnums">{String(i + 1).padStart(2, '0')}</span>
      </td>
      <td className="max-w-0">
        <span className="flex items-center gap-2">
          <span className={cn('truncate font-fraunces text-[14px] font-medium', table.mine ? 'text-brass-300' : 'text-paper-100')} style={{ fontVariationSettings: '"opsz" 48' }}>
            {table.name}
          </span>
          {table.myTurn && <span className="micro-label shrink-0 text-signal-400">{t('platform.play.tables.yourTurn')}</span>}
        </span>
        <span className="data-text block truncate text-[11px] text-iron-600">
          {t(`platform.mode.${table.mode}`)} · {detail}
          {table.watchers > 0 && ` · ${t('platform.play.tables.watchers', { count: table.watchers })}`}
        </span>
      </td>
      <td className="w-[130px]">
        <SeatTrain table={table} />
      </td>
      <td className="w-[110px]">
        <span className={cn('micro-label flex items-center gap-2', table.state === 'live' ? 'text-signal-400' : table.state === 'open' ? 'text-bottle-400' : 'text-iron-400')}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', LAMP[table.state] ?? 'bg-iron-600')} aria-hidden />
          {t(`platform.state.${table.state}`)}
        </span>
      </td>
      <td className="hidden w-[140px] min-[900px]:table-cell">
        <span className="data-text block truncate text-[11px] text-iron-400">{table.hostName}</span>
      </td>
      <td className="w-px pr-2 text-right">
        {action ? (
          <button type="button" disabled={busy} onClick={action.go} className={cn('gz-ticket gz-ticket-sm', action.brass && 'gz-ticket-brass', table.mine && table.myTurn && 'gz-ticket-signal', busy && 'opacity-50')}>
            {action.icon && <Eye aria-hidden />}
            {action.label}
          </button>
        ) : table.state === 'open' ? (
          <span className={cn(boarding, 'text-iron-600')} title={t('platform.play.tables.viaQueueHint')}>
            {t('platform.play.tables.viaQueue')}
          </span>
        ) : null}
      </td>
    </motion.tr>
  );
}

type Hands = { busy: boolean; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void };

/** a timetable: the lines given under the column heads — in groups, each
 *  under a heading of its own, when there are several */
function Timetable({ tables, groups, busy, onJoin, onResume, onWatch }: { tables?: CardTable[]; groups?: { label: string; tables: CardTable[] }[] } & Hands) {
  const t = useT();
  const parts = groups ?? [{ label: '', tables: tables ?? [] }];
  let n = 0;
  return (
    <table className="gz-timetable">
      <caption className="sr-only">{t('platform.play.tables.title')}</caption>
      <thead>
        <tr>
          <th className="pr-0" aria-hidden />
          <th>{t('platform.play.tables.colTable')}</th>
          <th>{t('platform.play.tables.colSeats')}</th>
          <th>{t('platform.play.tables.colState')}</th>
          <th className="hidden min-[900px]:table-cell">{t('platform.play.tables.colHost')}</th>
          <th />
        </tr>
      </thead>
      {parts
        .filter((g) => g.tables.length > 0)
        .map((g) => (
          <tbody key={g.label}>
            {g.label && (
              <tr>
                <th colSpan={6} className="!border-b-0 !pb-1 !pt-4 !text-paper-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rotate-45 bg-brass-300" aria-hidden />
                    {g.label}
                  </span>
                </th>
              </tr>
            )}
            {g.tables.map((table) => (
              <Row key={table.code} table={table} i={n++} busy={busy} onJoin={onJoin} onResume={onResume} onWatch={onWatch} />
            ))}
          </tbody>
        ))}
    </table>
  );
}

export default function PublicTables({ onToast }: { onToast: Notify }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const line = useLine();
  const stranger = useStranger();
  const [filter, setFilter] = useState<TableFilter>('all');
  const [sort, setSort] = useState<TableSort>('filling');
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  /* the search reaches the office a beat after the pen stops */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(typed.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [typed]);

  const page = useTables({ filter, q, sort, offset, limit: TABLE_PAGE });
  const rows = useMemo(() => (page ? toCards(page.tables, desk?.tables, session?.name, lang) : []), [page, desk?.tables, session?.name, lang]);
  const mine = useMemo(() => (page ? page.mine.map((x) => toCard(x, desk?.tables.find((m) => m.code === x.code), session?.name, lang)) : []), [page, desk?.tables, session?.name, lang]);
  const friends = useMemo(() => (page ? toCards(page.friends, desk?.tables, session?.name, lang) : []), [page, desk?.tables, session?.name, lang]);
  const live = useMemo(() => (page ? toCards(page.live, desk?.tables, session?.name, lang) : []), [page, desk?.tables, session?.name, lang]);

  const join = async (table: CardTable) => {
    if (busy) return;
    if (!session) {
      navigate(`/account?table=${table.code}`);
      return;
    }
    if (table.mode === 'ranked' || table.state !== 'open') return;
    setBusy(table.code);
    try {
      await lobby.join(table.code, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      onToast({ message: lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: 'error' });
      setBusy(null);
    }
  };
  const seatMe = async () => {
    if (busy || !session) return;
    setBusy('seatme');
    try {
      const table = await lobby.seatMe(session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      const none = e instanceof Error && e.message === 'not-found';
      onToast({ message: none ? t('platform.play.tables.seatMeNone') : lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: none ? 'info' : 'error' });
      setBusy(null);
    }
  };
  const resume = (table: CardTable) => navigate(table.state === 'live' ? `/game/${table.code}` : `/online/${table.code}`);
  const watch = (table: CardTable) => navigate(`/game/${table.code}`);

  const chips = FILTERS.map((id) => ({
    id,
    label: id === 'all' ? t('platform.play.tables.all') : id === 'seats' ? t('platform.play.tables.freeSeats') : id === 'ranked' ? t('platform.mode.ranked') : t(`platform.play.tables.${id}`),
    count: page?.counts[id],
  }));

  let body;
  if (stranger) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.signInTitle')} copy={t('platform.play.tables.signInCopy')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  } else if (page === null) {
    body = (
      <div className="mt-4 flex items-center justify-center gap-3 px-6 py-10">
        <Loader2 size={16} className="animate-spin text-brass-300" aria-hidden />
        <p className="font-serif text-[14px] italic text-paper-300">{line === 'online' ? t('platform.play.tables.loading') : t('platform.play.tables.waitingLine')}</p>
      </div>
    );
  } else if (page.counts.all === 0 && !q) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.noneTitle')} copy={t('platform.play.tables.noneCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else if (rows.length === 0) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.emptyTitle')} copy={t('platform.play.tables.emptyCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else {
    const from = page.query.offset + 1;
    const to = page.query.offset + rows.length;
    body = (
      <div className="mt-2">
        <Timetable tables={rows} busy={busy !== null} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--gz-ink-soft)] px-2 py-2">
          <span className="data-text text-[11px] text-iron-400 tnums">{t('platform.play.tables.pageOf', { from, to, total: page.total })}</span>
          <span className="flex items-center gap-4">
            <button type="button" disabled={page.query.offset === 0} onClick={() => setOffset(Math.max(0, page.query.offset - TABLE_PAGE))} className={cn(boarding, 'inline-flex items-center gap-1 text-brass-300 hover:text-paper-100')}>
              <ChevronLeft size={12} aria-hidden />
              {t('platform.play.tables.prev')}
            </button>
            <button type="button" disabled={to >= page.total} onClick={() => setOffset(page.query.offset + TABLE_PAGE)} className={cn(boarding, 'inline-flex items-center gap-1 text-brass-300 hover:text-paper-100')}>
              {t('platform.play.tables.next')}
              <ChevronRight size={12} aria-hidden />
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-12 scroll-mt-28 pb-10">
      <h2 className="gz-head h2-section">{t('platform.play.tables.title')}</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="data-text text-[12px] text-iron-400 tnums">{page ? t('platform.play.tables.count', { count: page.counts.all - page.counts.live, live: page.counts.live }) : ' '}</p>
        {session && !stranger && (
          <button type="button" onClick={() => void seatMe()} disabled={busy !== null} title={t('platform.play.tables.seatMeHint')} className="gz-ticket gz-ticket-brass">
            <Armchair aria-hidden />
            {t('platform.play.tables.seatMe')}
          </button>
        )}
      </div>

      {/* the first storey: what concerns the reader, one timetable in groups */}
      {page && !stranger && (mine.length > 0 || friends.length > 0 || live.length > 0) && (
        <div className="mt-5">
          <div className="gz-rule-double" aria-hidden />
          <Timetable
            groups={[
              { label: t('platform.play.tables.mine'), tables: mine.slice(0, 3) },
              { label: t('platform.play.tables.friendsTitle'), tables: friends.slice(0, 3) },
              { label: t('platform.play.tables.liveTitle'), tables: live.slice(0, 3) },
            ]}
            busy={busy !== null}
            onJoin={(tb) => void join(tb)}
            onResume={resume}
            onWatch={watch}
          />
        </div>
      )}

      {/* the second storey: the register, one page at a time */}
      {!stranger && (
        <div className="mt-10 flex flex-wrap items-center gap-2 border-y border-[var(--gz-ink-soft)] py-2">
          <p className="micro-label mr-2 text-paper-100">{t('platform.play.tables.register')}</p>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => {
                setFilter(chip.id);
                setOffset(0);
              }}
              className={cn('gz-nav-link !py-1.5 !text-[10.5px]', filter === chip.id && 'is-active')}
            >
              {chip.label}
              {chip.count !== undefined && <span className="data-text ml-1.5 text-[10px] normal-case tracking-normal text-iron-600 tnums">{chip.count}</span>}
            </button>
          ))}
          <span className="flex-1" />
          <label className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-iron-400" />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('platform.play.tables.search')}
              aria-label={t('platform.play.tables.search')}
              className="h-8 w-[240px] border-b border-[var(--gz-ink-soft)] bg-transparent pl-7 pr-2 font-serif text-[13px] italic text-paper-100 placeholder:text-iron-600 focus:border-brass-300 focus:outline-none"
            />
          </label>
          <span role="group" aria-label={t('platform.play.tables.sortFilling')} className="flex items-center gap-1">
            {(['filling', 'fresh'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={sort === id}
                onClick={() => {
                  setSort(id);
                  setOffset(0);
                }}
                className={cn('gz-nav-link !py-1.5 !text-[10.5px]', sort === id && 'is-active')}
              >
                {t(id === 'filling' ? 'platform.play.tables.sortFilling' : 'platform.play.tables.sortFresh')}
              </button>
            ))}
          </span>
        </div>
      )}

      {body}
    </section>
  );
}
