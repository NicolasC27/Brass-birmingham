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

/** four marks: the seats taken in their colours, the free ones hollow */
function SeatDots({ table }: { table: CardTable }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {table.seats.map((s, i) =>
        s ? (
          <span key={i} className={cn('block h-2.5 w-2.5 rounded-full', s.kind === 'bot' && 'opacity-60', s.you && 'ring-2 ring-brass-300 ring-offset-1 ring-offset-[rgb(var(--enamel-850))]')} style={{ backgroundColor: PLAYER_COLORS[s.color]?.hex ?? '#C9A45C' }} title={s.name} />
        ) : (
          <span key={i} className="block h-2.5 w-2.5 rounded-full border border-[var(--gz-ink-soft)]" />
        ),
      )}
    </span>
  );
}

const boarding = 'font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition-colors disabled:opacity-50';

function Row({ table, busy, i = 0, onJoin, onResume, onWatch }: { table: CardTable; busy: boolean; i?: number; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  const t = useT();
  const total = eraRounds(table.seats.filter(Boolean).length || 2);
  const detail =
    table.state === 'live'
      ? `${t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal')} · ${t('platform.play.tables.roundOf', { round: table.round ?? 1, total })}`
      : t('platform.play.tables.host', { name: table.hostName });
  const action = table.mine
    ? { label: t('platform.play.tables.resume'), go: () => onResume(table), tone: table.myTurn ? 'text-signal-400 hover:text-paper-100' : 'text-brass-300 hover:text-paper-100' }
    : table.state === 'live'
      ? { label: t('platform.play.tables.watch'), go: () => onWatch(table), tone: 'text-paper-300 hover:text-paper-100', icon: true }
      : table.state === 'open' && table.mode !== 'ranked'
        ? { label: t('platform.play.tables.join'), go: () => onJoin(table), tone: 'text-brass-300 hover:text-paper-100' }
        : null;
  return (
    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut', delay: 0.03 * i }} className={cn(table.mine && 'bg-brass-500/[.05]')}>
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
      <td className="w-[76px]">
        <SeatDots table={table} />
      </td>
      <td className="w-[96px]">
        <span className={cn('micro-label flex items-center gap-1.5', table.state === 'live' ? 'text-signal-400' : table.state === 'open' ? 'text-bottle-400' : 'text-iron-400')}>
          {table.state === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />}
          {t(`platform.state.${table.state}`)}
        </span>
      </td>
      <td className="hidden w-[140px] min-[900px]:table-cell">
        <span className="data-text block truncate text-[11px] text-iron-400">{table.hostName}</span>
      </td>
      <td className="w-px pr-2 text-right">
        {action ? (
          <button type="button" disabled={busy} onClick={action.go} className={cn(boarding, action.tone, action.icon && 'inline-flex items-center gap-1')}>
            {action.icon && <Eye size={12} aria-hidden />}
            {action.label}
            {!action.icon && ' →'}
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

/** a timetable: the lines given, under the column heads */
function Timetable({ tables, busy, onJoin, onResume, onWatch }: { tables: CardTable[]; busy: boolean; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  const t = useT();
  return (
    <table className="gz-timetable">
      <thead>
        <tr>
          <th>{t('platform.play.tables.colTable')}</th>
          <th>{t('platform.play.tables.colSeats')}</th>
          <th>{t('platform.play.tables.colState')}</th>
          <th className="hidden min-[900px]:table-cell">{t('platform.play.tables.colHost')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {tables.map((table, i) => (
          <Row key={table.code} table={table} i={i} busy={busy} onJoin={onJoin} onResume={onResume} onWatch={onWatch} />
        ))}
      </tbody>
    </table>
  );
}

function Band({ title, tables, busy, onJoin, onResume, onWatch }: { title: string; tables: CardTable[]; busy: boolean; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  if (!tables.length) return null;
  return (
    <div>
      <p className="micro-label text-paper-100">{title}</p>
      <div className="gz-rule-double mt-2" aria-hidden />
      <Timetable tables={tables.slice(0, 3)} busy={busy} onJoin={onJoin} onResume={onResume} onWatch={onWatch} />
    </div>
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
    body = <EmptyState className="mt-4" image="/empty-tables.png" title={t('platform.play.tables.signInTitle')} copy={t('platform.play.tables.signInCopy')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  } else if (page === null) {
    body = (
      <div className="mt-4 flex items-center justify-center gap-3 px-6 py-10">
        <Loader2 size={16} className="animate-spin text-brass-300" aria-hidden />
        <p className="font-serif text-[14px] italic text-paper-300">{line === 'online' ? t('platform.play.tables.loading') : t('platform.play.tables.waitingLine')}</p>
      </div>
    );
  } else if (page.counts.all === 0 && !q) {
    body = <EmptyState className="mt-4" image="/empty-tables.png" title={t('platform.play.tables.noneTitle')} copy={t('platform.play.tables.noneCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else if (rows.length === 0) {
    body = <EmptyState className="mt-4" image="/empty-tables.png" title={t('platform.play.tables.emptyTitle')} copy={t('platform.play.tables.emptyCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else {
    const from = page.query.offset + 1;
    const to = page.query.offset + rows.length;
    body = (
      <div className="mt-3">
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
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-8 scroll-mt-28 pb-10">
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

      {/* the first storey: what concerns the reader */}
      {page && !stranger && (mine.length > 0 || friends.length > 0 || live.length > 0) && (
        <div className="mt-6 grid gap-8 min-[900px]:grid-cols-3">
          <Band title={t('platform.play.tables.mine')} tables={mine} busy={busy !== null} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          <Band title={t('platform.play.tables.friendsTitle')} tables={friends} busy={busy !== null} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          <Band title={t('platform.play.tables.liveTitle')} tables={live} busy={busy !== null} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
        </div>
      )}

      {/* the second storey: the register, one page at a time */}
      {!stranger && (
        <div className="mt-8 flex flex-wrap items-center gap-2 border-y border-[var(--gz-ink-soft)] py-2">
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
