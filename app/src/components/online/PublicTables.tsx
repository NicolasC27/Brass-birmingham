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
import Button from '@/components/platform/Button';
import EmptyState from '@/components/platform/EmptyState';
import TableCard from '@/components/platform/TableCard';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 3 (play.md) — the tables, in two storeys.                    */
/* Above, what concerns the reader, as cards: their own tables, their   */
/* friends' and the most watched games. Below, the register: every      */
/* table of the house as a line, twenty a page, searched, filtered and  */
/* sorted by the office itself (useTables asks for one page), so a      */
/* thousand tables read like a ledger and cost one page on the wire.    */
/* "Seat me" takes the open table nearest to starting for whoever will  */
/* not choose among them.                                               */
/* ------------------------------------------------------------------ */

const FILTERS: TableFilter[] = ['all', 'seats', 'friends', 'ranked', 'rail', 'live'];

/** four dots: the seats taken in their colours, the free ones hollow */
function SeatDots({ table }: { table: CardTable }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {table.seats.map((s, i) =>
        s ? (
          <span key={i} className={cn('h-2.5 w-2.5 rounded-full ring-1 ring-black/30', s.kind === 'bot' && 'opacity-60')} style={{ backgroundColor: PLAYER_COLORS[s.color]?.hex ?? '#C9A45C' }} title={s.name} />
        ) : (
          <span key={i} className="h-2.5 w-2.5 rounded-full border border-iron-500/70" />
        ),
      )}
    </span>
  );
}

function Row({ table, busy, onJoin, onResume, onWatch }: { table: CardTable; busy: boolean; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  const t = useT();
  const total = eraRounds(table.seats.filter(Boolean).length || 2);
  const state =
    table.state === 'live'
      ? `${t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal')} · ${t('platform.play.tables.roundOf', { round: table.round ?? 1, total })}`
      : table.state === 'full'
        ? t('platform.play.tables.full')
        : t('platform.play.tables.open');
  const action = table.mine
    ? { label: t('platform.play.tables.resume'), go: () => onResume(table), primary: table.myTurn }
    : table.state === 'live'
      ? { label: t('platform.play.tables.watch'), go: () => onWatch(table), primary: false }
      : table.state === 'open' && table.mode !== 'ranked'
        ? { label: t('platform.play.tables.join'), go: () => onJoin(table), primary: true }
        : null;
  return (
    <li className={cn('grid grid-cols-[minmax(0,1.6fr)_88px_minmax(0,1fr)_minmax(0,1fr)_96px] items-center gap-3 px-3 py-2 font-ui text-[13px]', table.mine && 'bg-brass-500/[.06]')}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-semibold text-paper-100">{table.name}</span>
        <span className={cn('micro-label shrink-0 rounded px-1.5 py-0.5', table.mode === 'ranked' ? 'bg-rust-700/50 text-rust-400' : 'bg-bottle-700/60 text-bottle-400')}>{t(`platform.mode.${table.mode}`)}</span>
        {table.myTurn && <span className="micro-label shrink-0 text-signal-400">{t('platform.play.tables.yourTurn')}</span>}
      </span>
      <SeatDots table={table} />
      <span className="flex min-w-0 items-center gap-1.5 truncate text-paper-300">
        {table.state === 'live' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-400" aria-hidden />}
        <span className="truncate">{state}</span>
        {table.watchers > 0 && (
          <span className="data-text ml-1 flex shrink-0 items-center gap-1 text-[11px] text-iron-400">
            <Eye size={12} aria-hidden />
            {table.watchers}
          </span>
        )}
      </span>
      <span className="truncate text-iron-400">{table.hostName}</span>
      <span className="flex justify-end">
        {action && (
          <Button variant={action.primary ? 'primary' : 'ghost'} className="!h-7 px-2.5 text-[12px]" disabled={busy} onClick={action.go}>
            {action.label}
          </Button>
        )}
      </span>
    </li>
  );
}

function Band({ title, tables, onJoin, onResume, onWatch }: { title: string; tables: CardTable[]; onJoin: (t: CardTable) => void; onResume: (t: CardTable) => void; onWatch: (t: CardTable) => void }) {
  if (!tables.length) return null;
  return (
    <div>
      <p className="micro-label text-iron-400">{title}</p>
      <div className="mt-2 grid gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {tables.slice(0, 3).map((table, i) => (
          <motion.div key={table.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
            <TableCard table={table} pulse={i === 0} onJoin={onJoin} onResume={onResume} onWatch={onWatch} />
          </motion.div>
        ))}
      </div>
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
      <div className="mt-4 flex items-center justify-center gap-3 console px-6 py-10">
        <Loader2 size={18} className="animate-spin text-brass-300" aria-hidden />
        <p className="font-ui text-[13px] text-paper-300">{line === 'online' ? t('platform.play.tables.loading') : t('platform.play.tables.waitingLine')}</p>
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
      <div className="mt-4 overflow-hidden console">
        <div className="grid grid-cols-[minmax(0,1.6fr)_88px_minmax(0,1fr)_minmax(0,1fr)_96px] gap-3 border-b border-brass-hairline px-3 py-2">
          {[t('platform.play.tables.colTable'), t('platform.play.tables.colSeats'), t('platform.play.tables.colState'), t('platform.play.tables.colHost'), ''].map((h, i) => (
            <span key={i} className="micro-label text-iron-400">
              {h}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-brass-hairline">
          {rows.map((table) => (
            <Row key={table.code} table={table} busy={busy !== null} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-brass-hairline px-3 py-2">
          <span className="data-text text-[12px] text-iron-400 tnums">{t('platform.play.tables.pageOf', { from, to, total: page.total })}</span>
          <span className="flex items-center gap-1">
            <Button variant="ghost" className="!h-7 px-2 text-[12px]" disabled={page.query.offset === 0} onClick={() => setOffset(Math.max(0, page.query.offset - TABLE_PAGE))} icon={<ChevronLeft size={14} aria-hidden />}>
              {t('platform.play.tables.prev')}
            </Button>
            <Button variant="ghost" className="!h-7 px-2 text-[12px]" disabled={to >= page.total} onClick={() => setOffset(page.query.offset + TABLE_PAGE)}>
              {t('platform.play.tables.next')} <ChevronRight size={14} aria-hidden />
            </Button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-8 scroll-mt-28 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-paper-100">{t('platform.play.tables.title')}</h2>
          <p className="data-text mt-1 text-[12px] text-iron-400 tnums">{page ? t('platform.play.tables.count', { count: page.counts.all - page.counts.live, live: page.counts.live }) : ' '}</p>
        </div>
        {session && !stranger && (
          <Button variant="primary" onClick={() => void seatMe()} disabled={busy !== null} title={t('platform.play.tables.seatMeHint')} icon={<Armchair size={16} aria-hidden />}>
            {t('platform.play.tables.seatMe')}
          </Button>
        )}
      </div>

      {/* the first storey: what concerns the reader */}
      {page && !stranger && (mine.length > 0 || friends.length > 0 || live.length > 0) && (
        <div className="mt-5 flex flex-col gap-5">
          <Band title={t('platform.play.tables.mine')} tables={mine} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          <Band title={t('platform.play.tables.friendsTitle')} tables={friends} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          <Band title={t('platform.play.tables.liveTitle')} tables={live} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
        </div>
      )}

      {/* the second storey: the register, one page at a time */}
      {!stranger && (
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <p className="micro-label mr-2 text-iron-400">{t('platform.play.tables.register')}</p>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => {
                setFilter(chip.id);
                setOffset(0);
              }}
              className={cn('relative h-8 rounded-full px-3 font-ui text-[12px] font-semibold transition-colors duration-150', filter === chip.id ? 'text-brass-300' : 'text-paper-300 hover:text-paper-100')}
            >
              {chip.label}
              {chip.count !== undefined && <span className="data-text ml-1.5 text-[11px] text-iron-400 tnums">{chip.count}</span>}
              {filter === chip.id && <motion.span layoutId="play-tables-filter" className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-brass-500" aria-hidden />}
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
              className="h-8 w-[240px] rounded-full border border-brass-hairline bg-enamel-850 pl-8 pr-3 font-ui text-[12px] text-paper-100 placeholder:text-iron-600 focus:border-brass-400 focus:outline-none"
            />
          </label>
          <span role="group" aria-label={t('platform.play.tables.sortFilling')} className="flex overflow-hidden rounded-full border border-brass-hairline">
            {(['filling', 'fresh'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={sort === id}
                onClick={() => {
                  setSort(id);
                  setOffset(0);
                }}
                className={cn('h-8 px-3 font-ui text-[12px] font-semibold transition-colors', sort === id ? 'bg-brass-500/15 text-brass-300' : 'text-paper-300 hover:text-paper-100')}
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
