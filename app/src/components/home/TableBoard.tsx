import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { CircleDashed, Loader2, RefreshCw, Swords, Unplug, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { onlineWire } from '@/online/net';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { toCards, type CardTable } from '@/platform/tables';
import Button from '@/components/platform/Button';
import Tabs from '@/components/platform/Tabs';
import TableCard from '@/components/platform/TableCard';
import EmptyState from '@/components/platform/EmptyState';

/* ------------------------------------------------------------------ */
/* Tableau des tables — le signe distinctif (home.md §S2).             */
/* 3 colonnes d'état (file / ouvertes / en cours), 2 colonnes          */
/* 760–1100px, onglets <760px. Chaque colonne défile (max-h 420px).    */
/* Données : le registre de l'office (useTables) et mon bureau         */
/* (useDesk). L'office ne dit pas qui attend en file : la colonne file */
/* ne montre que ma propre attente, ou l'invitation à en prendre une.  */
/* ------------------------------------------------------------------ */

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

function QueueColumn() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const queue = desk?.queue ?? null;
  const now = useNow(queue !== null);

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <CircleDashed className="h-5 w-5 text-iron-600" aria-hidden />
        <p className="font-ui text-[13px] text-iron-400">{t('platform.home.board.queue.signIn')}</p>
        <Button variant="ghost" className="!h-8 px-3 text-[12px]" to="/account">
          {t('platform.action.signIn')}
        </Button>
      </div>
    );
  }
  if (!queue) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <CircleDashed className="h-5 w-5 text-iron-600" aria-hidden />
        <p className="font-ui text-[13px] text-iron-400">{t('platform.home.board.queue.none')}</p>
        {desk && desk.hall.queued > 0 && (
          <p className="data-text text-[11px] text-iron-600 tnums">{t('platform.home.board.queue.house', { count: desk.hall.queued })}</p>
        )}
        <Button variant="ghost" className="!h-8 px-3 text-[12px]" to="/online">
          {t('platform.home.board.queue.enter')}
        </Button>
      </div>
    );
  }
  const mode = queue.mode === 'ranked' ? 'ranked' : 'normal';
  return (
    <div className="p-2">
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        role="status"
        className="rounded-lg border border-brass-hairline bg-enamel-800 px-3 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-ui text-[13px] font-semibold text-paper-100">
            <span className={cn('h-1.5 w-1.5 animate-pulse-signal rounded-full', mode === 'ranked' ? 'bg-rust-600' : 'bg-bottle-500')} aria-hidden />
            {t('platform.home.board.queue.mine', { mode: t(`platform.mode.${mode}`) })}
          </span>
          <span className="data-text text-[12px] text-brass-300 tnums">{mmss(now - queue.since)}</span>
        </div>
        <p className="mt-1.5 font-ui text-[12px] text-iron-400 tnums">
          {queue.waiting <= 1 ? t('platform.home.board.queue.alone') : t('platform.home.board.queue.others', { count: queue.waiting - 1 })}
        </p>
        <Button variant="ghost" className="mt-2 !h-8 px-3 text-[12px]" to="/online">
          {t('platform.home.board.queue.see')}
        </Button>
      </motion.div>
    </div>
  );
}

function TableColumn({ tables, live, waiting }: { tables: CardTable[]; live?: boolean; waiting: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const stranger = useStranger();
  const line = useLine();
  if (stranger) {
    return <EmptyState mini icon={live ? <Swords aria-hidden /> : <Users aria-hidden />} title={t('platform.home.board.signIn')} />;
  }
  if (waiting && line !== 'online') {
    return <EmptyState mini icon={<Unplug aria-hidden />} title={t('platform.serverOffline')} />;
  }
  if (waiting) {
    return <EmptyState mini icon={<Loader2 className="animate-spin" aria-hidden />} title={t('platform.home.board.loading')} />;
  }
  if (tables.length === 0) {
    return <EmptyState mini icon={live ? <Swords aria-hidden /> : <Users aria-hidden />} title={live ? t('platform.empty.live') : t('platform.empty.tables')} />;
  }
  return (
    <div className="flex flex-col gap-2 p-2">
      {tables.map((table, i) => (
        <TableCard
          key={table.code}
          table={table}
          pulse={i < 3 /* budget pulses : 3 max / viewport (§5) */}
          onJoin={(tb) => navigate(`/online/${tb.code}`)}
          onResume={(tb) => navigate(tb.state === 'live' ? `/game/${tb.code}` : `/online/${tb.code}`)}
          onWatch={(tb) => navigate(`/game/${tb.code}`)}
        />
      ))}
    </div>
  );
}

export default function TableBoard() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const page = useTables({ limit: 12 });
  const tables = page?.tables ?? null;
  const [tab, setTab] = useState('open');
  const [spin, setSpin] = useState(0);

  const lang = useLang();
  const cards = useMemo(() => toCards(tables ?? [], desk?.tables, session?.name, lang), [tables, desk?.tables, session?.name, lang]);
  const open = useMemo(() => cards.filter((tb) => tb.state !== 'live'), [cards]);
  const live = useMemo(() => cards.filter((tb) => tb.state === 'live'), [cards]);
  const stranger = useStranger();
  const waiting = tables === null && !stranger;

  const refresh = () => {
    setSpin((n) => n + 1);
    const w = onlineWire();
    w?.askTables({ limit: 12 });
    w?.askDesk();
  };

  const columns = [
    { id: 'queue', label: t('platform.state.queue'), body: <QueueColumn />, count: desk?.hall.queued ?? 0 },
    { id: 'open', label: t('platform.state.openTables'), body: <TableColumn tables={open} waiting={waiting} />, count: page ? page.counts.all - page.counts.live : open.length },
    { id: 'live', label: t('platform.state.live'), body: <TableColumn tables={live} live waiting={waiting} />, count: page?.counts.live ?? live.length },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.08 }}
      className="overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850"
      aria-label={t('platform.home.board.title')}
    >
      {/* header interne 44px */}
      <div className="flex h-11 items-center justify-between gap-3 border-b border-brass-hairline px-4">
        <span className="micro-label flex items-center gap-2 text-brass-300">
          <span className={cn('h-1.5 w-1.5 rounded-full', tables ? 'animate-presence-dot bg-signal-400' : 'bg-iron-600')} aria-hidden />
          {t('platform.home.board.title')}
        </span>
        <span className="flex items-center gap-3">
          <span className="data-text text-[11px] text-iron-400 tnums">
            {waiting ? t('platform.home.board.loading') : stranger ? '' : t('platform.home.board.counts', { open: open.length, live: live.length })}
          </span>
          <Button
            variant="icon"
            className="!h-7 !w-7"
            aria-label={t('platform.home.board.refresh')}
            onClick={refresh}
            icon={
              <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="flex">
                <RefreshCw size={14} aria-hidden />
              </motion.span>
            }
          />
          <Button variant="ghost" className="!h-7 px-2 text-[12px]" to="/online#tables">
            {t('platform.home.board.seeAll')}
          </Button>
        </span>
      </div>

      {/* 3 colonnes ≥1100px · 2 colonnes 760–1100px */}
      <div className="hidden grid-cols-2 divide-x divide-[rgb(var(--paper-100)/.07)] min-[760px]:grid min-[1100px]:grid-cols-3">
        {columns.map((col, i) => (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut', delay: 0.08 * i }}
            className={cn(i === 2 && 'max-[1100px]:col-span-2 max-[1100px]:border-t max-[1100px]:border-[rgb(var(--paper-100)/.07)]')}
          >
            <p className="micro-label border-b border-[rgb(var(--paper-100)/.07)] px-4 py-2 text-iron-400">
              {col.label} <span className="text-iron-600 tnums">{col.count}</span>
            </p>
            <div className="scroll-thin max-h-[420px] overflow-y-auto">{col.body}</div>
          </motion.div>
        ))}
      </div>

      {/* onglets <760px */}
      <div className="min-[760px]:hidden">
        <Tabs
          groupId="table-board"
          tabs={columns.map((c) => ({ id: c.id, label: c.label, badge: c.count }))}
          active={tab}
          onChange={setTab}
          className="px-2"
        />
        <div className="scroll-thin max-h-[420px] overflow-y-auto">{columns.find((c) => c.id === tab)?.body}</div>
      </div>
    </motion.section>
  );
}
