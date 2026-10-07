import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Eye, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { isOnline } from '@/online/lobby';
import { onlineWire } from '@/online/net';
import { listHomeGames, subscribeHome, type HomeTable } from '@/game/home';
import { startQuickGame } from '@/game/quickplay';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { colorDef } from '@/components/setup/constants';
import { toCards, type CardTable } from '@/platform/tables';
import Button from '@/components/platform/Button';
import Skeleton from '@/components/platform/Skeleton';

/* ------------------------------------------------------------------ */
/* The departures: the register of tables printed as a timetable —    */
/* one line a table, the seats as four marks, the state in small       */
/* capitals, the way to board at the end of the line. My tables come   */
/* first (platform/tables.ts). Under the board, my own place in the    */
/* queue; the office does not say who else waits.                      */
/* ------------------------------------------------------------------ */

const ROWS = 8;

/** the clock, ticking every second while something is timed */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [on]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* four marks: a filled disc in the player's colour, a hollow one for a free chair */
function Seats({ table }: { table: CardTable }) {
  const t = useT();
  const filled = table.seats.filter(Boolean).length;
  return (
    <span className="flex items-center gap-1.5" aria-label={t('platform.state.seats', { filled, total: table.seats.length })}>
      {table.seats.map((s, i) =>
        s ? (
          <span
            key={i}
            title={s.name}
            className={cn('block h-2.5 w-2.5 rounded-full', s.you && 'ring-2 ring-brass-300 ring-offset-1 ring-offset-[rgb(var(--enamel-850))]')}
            style={{ background: colorDef(s.color).hex }}
          />
        ) : (
          <span key={i} className="block h-2.5 w-2.5 rounded-full border border-[var(--gz-ink-soft)]" />
        ),
      )}
    </span>
  );
}

function Boarding({ table }: { table: CardTable }) {
  const t = useT();
  const navigate = useNavigate();
  const link = 'font-ui text-[10.5px] font-semibold uppercase tracking-label whitespace-nowrap transition-colors';
  if (table.mine) {
    const to = table.state === 'live' ? `/game/${table.code}` : `/online/${table.code}`;
    return (
      <Link to={to} className={cn(link, table.myTurn ? 'text-signal-ink hover:text-paper-100' : 'text-brass-300 hover:text-paper-100')}>
        {table.state === 'live' ? (table.myTurn ? t('platform.play.tables.yourTurn') : t('platform.action.resume')) : t('platform.action.lobbyShort')} →
      </Link>
    );
  }
  if (table.state === 'open') {
    return table.mode === 'ranked' ? (
      <span className={cn(link, 'text-iron-400')} title={t('platform.play.tables.viaQueueHint')}>
        {t('platform.play.tables.viaQueue')}
      </span>
    ) : (
      <button type="button" onClick={() => navigate(`/online/${table.code}`)} className={cn(link, 'text-brass-300 hover:text-paper-100')}>
        {t('platform.action.join')} →
      </button>
    );
  }
  if (table.state === 'live') {
    return (
      <button type="button" onClick={() => navigate(`/game/${table.code}`)} className={cn(link, 'inline-flex items-center gap-1 text-paper-300 hover:text-paper-100')}>
        <Eye size={12} aria-hidden />
        {t('platform.action.watch')}
      </button>
    );
  }
  return <span className={cn(link, 'text-iron-400')}>{t('platform.action.full')}</span>;
}

function Row({ table, i }: { table: CardTable; i: number }) {
  const t = useT();
  const detail =
    table.state === 'live'
      ? [
          table.era ? t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal') : null,
          table.round !== undefined ? (table.rounds ? t('platform.play.tables.roundOf', { round: table.round, total: table.rounds }) : t('platform.state.turn', { round: table.round })) : null,
        ]
      : [t('platform.play.tables.host', { name: table.hostName })];
  return (
    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut', delay: 0.04 * i }}>
      <td className="w-full max-w-0">
        <span className={cn('block truncate font-fraunces text-[14px] font-medium', table.mine ? 'text-brass-300' : 'text-paper-100')}>
          {table.name}
        </span>
        <span className="data-text block truncate text-[10.5px] text-iron-400">
          {[t(`platform.mode.${table.mode}`), ...detail].filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className="w-[76px]">
        <Seats table={table} />
      </td>
      <td className="w-[88px]">
        <span className={cn('micro-label flex items-center gap-1.5', table.state === 'live' ? 'text-signal-ink' : table.state === 'open' ? 'text-bottle-ink' : 'text-iron-400')}>
          {table.state === 'live' && <span className={cn('h-1.5 w-1.5 rounded-full bg-signal-400', i < 3 && 'animate-pulse-signal')} aria-hidden />}
          {t(`platform.state.${table.state}`)}
        </span>
      </td>
      <td className="w-px pr-2 text-right">
        <Boarding table={table} />
      </td>
    </motion.tr>
  );
}

/* the local edition: one line a saved game of this device */
function LocalRow({ table, i }: { table: HomeTable; i: number }) {
  const t = useT();
  const lang = useLang();
  return (
    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut', delay: 0.04 * i }}>
      <td className="w-full max-w-0">
        <span className="block truncate font-fraunces text-[14px] font-medium text-paper-100">
          {tableTitle(table.name, lang)}
        </span>
        <span className="data-text block truncate text-[10.5px] text-iron-400">
          {[t('platform.action.localGame'), t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal'), t('platform.state.turn', { round: table.round })].join(' · ')}
        </span>
      </td>
      <td className="w-[76px]">
        <span className="flex items-center gap-1.5">
          {table.seats.map((s, j) => (
            <span
              key={j}
              title={s.name}
              className="block h-2.5 w-2.5 rounded-full"
              /* a machine rides hollow, a passenger filled — the mark is drawn,
                 not dimmed; opacity only shifts the colour against the paper */
              style={s.kind === 'bot' ? { boxShadow: `inset 0 0 0 2px ${colorDef(s.color).hex}` } : { background: colorDef(s.color).hex }}
            />
          ))}
        </span>
      </td>
      <td className="w-[88px]">
        <span className="micro-label text-bottle-ink">{t('platform.state.open')}</span>
      </td>
      <td className="w-px pr-2 text-right">
        <Link to={`/game/local/${table.code}`} className="whitespace-nowrap font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
          {t('platform.action.resume')} →
        </Link>
      </td>
    </motion.tr>
  );
}

function LocalEdition() {
  const t = useT();
  const navigate = useNavigate();
  const games = useSyncExternalStore(subscribeHome, listHomeGames, listHomeGames);
  return (
    <>
      {games.length === 0 ? (
        <Notice text={t('platform.home.departures.localNone')} />
      ) : (
        <table className="gz-timetable">
          <thead>
            <tr>
              <th>{t('platform.home.departures.table')}</th>
              <th>{t('platform.home.departures.seats')}</th>
              <th>{t('platform.home.departures.state')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {games.slice(0, ROWS).map((g, i) => (
              <LocalRow key={g.code} table={g} i={i} />
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gz-ink-soft)] px-2 pt-3">
        <span className="font-serif text-[13px] text-paper-300">{t('platform.serverOffline')}</span>
        <button type="button" onClick={() => void startQuickGame().then((code) => navigate(`/game/local/${code}`))} className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
          {t('platform.home.departures.machines')} →
        </button>
      </div>
    </>
  );
}

/* a quiet line across the board when there is nothing to list */
function Notice({ text, cta }: { text: string; cta?: { label: string; to: string } }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="max-w-[300px] font-serif text-[14px] text-paper-300">{text}</p>
      {cta && (
        <Button variant="ghost" className="!h-8 px-3" to={cta.to}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}

/* my own wait, under the board */
function MyQueue() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const queue = desk?.queue ?? null;
  const now = useNow(queue !== null);
  const link = 'font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100';

  if (!session) return null;
  if (!queue) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gz-ink-soft)] px-2 pt-3">
        <span className="font-serif text-[13px] text-paper-300">
          {t('platform.home.departures.queueNone')}
          {desk && desk.hall.queued > 0 && <span className="data-text ml-2 text-[10.5px] not-italic text-iron-400 tnums">{t('platform.home.board.queue.house', { count: desk.hall.queued })}</span>}
        </span>
        <Link to="/online" className={link}>
          {t('platform.home.departures.enter')} →
        </Link>
      </div>
    );
  }
  const mode = queue.mode === 'ranked' ? 'ranked' : 'normal';
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gz-ink-soft)] px-2 pt-3">
      <span className="flex items-center gap-2 font-ui text-[12.5px] text-paper-100">
        <span className={cn('h-1.5 w-1.5 animate-pulse-signal rounded-full', mode === 'ranked' ? 'bg-rust-600' : 'bg-bottle-500')} aria-hidden />
        {t('platform.home.board.queue.mine', { mode: t(`platform.mode.${mode}`) })}
        <span className="data-text text-brass-300 tnums">{mmss(now - queue.since)}</span>
        <span className="data-text text-[10.5px] text-iron-400">
          {queue.waiting <= 1 ? t('platform.home.board.queue.alone') : t('platform.home.board.queue.others', { count: queue.waiting - 1 })}
        </span>
      </span>
      <Link to="/online" className={link}>
        {t('platform.home.board.queue.see')} →
      </Link>
    </div>
  );
}

export default function Departures() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const page = useTables({ limit: 12 });
  const tables = page?.tables ?? null;
  const [spin, setSpin] = useState(0);
  const lang = useLang();
  const cards = useMemo(() => toCards(tables ?? [], desk?.tables, session?.name, lang), [tables, desk?.tables, session?.name, lang]);
  const stranger = useStranger();
  const line = useLine();
  const waiting = tables === null && !stranger;
  const open = page ? page.counts.all - page.counts.live : cards.filter((tb) => tb.state !== 'live').length;
  const live = page?.counts.live ?? cards.filter((tb) => tb.state === 'live').length;

  const refresh = () => {
    setSpin((n) => n + 1);
    const w = onlineWire();
    w?.askTables({ limit: 12 });
    w?.askDesk();
  };

  /* no line to the office: the local edition takes the board */
  const local = !isOnline || (waiting && line !== 'online');

  let body: React.ReactNode;
  if (local) body = <LocalEdition />;
  else if (stranger) body = <Notice text={t('platform.home.board.signIn')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  /* the wait has its own drawing and says so once: the counts stay silent
     while the board is still being set */
  else if (waiting) body = <Skeleton shape="table" rows={4} className="px-2 py-2" label={t('platform.home.board.loading')} />;
  else if (cards.length === 0) body = <Notice text={t('platform.home.departures.none')} cta={{ label: t('platform.action.createTable'), to: '/setup' }} />;
  else
    body = (
      <table className="gz-timetable">
        <caption className="sr-only">{t('platform.home.board.title')}</caption>
        <thead>
          <tr>
            <th>{t('platform.home.departures.table')}</th>
            <th>{t('platform.home.departures.seats')}</th>
            <th>{t('platform.home.departures.state')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cards.slice(0, ROWS).map((tb, i) => (
            <Row key={tb.code} table={tb} i={i} />
          ))}
        </tbody>
      </table>
    );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.08 }}
      aria-label={t('platform.home.board.title')}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="micro-label flex items-center gap-2 text-paper-100">
          <span className={cn('h-1.5 w-1.5 rounded-full', tables ? 'animate-presence-dot bg-signal-400' : 'bg-iron-600')} aria-hidden />
          {t('platform.home.board.title')}
        </h2>
        <span className="flex items-center gap-3">
          <span className="data-text text-[10.5px] text-iron-400 tnums">{local ? t('platform.status.localMode') : waiting || stranger ? '' : t('platform.home.board.counts', { open, live })}</span>
          <button type="button" aria-label={t('platform.home.board.refresh')} onClick={refresh} className="text-iron-400 transition-colors hover:text-paper-100">
            <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="flex">
              <RefreshCw size={13} aria-hidden />
            </motion.span>
          </button>
          <Link to="/online#tables" className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
            {t('platform.home.board.seeAll')} →
          </Link>
        </span>
      </div>
      <div className="gz-rule-double mt-2" aria-hidden />
      <div className="mt-1">{body}</div>
      {!local && (
        <div className="mt-2">
          <MyQueue />
        </div>
      )}
    </motion.section>
  );
}
