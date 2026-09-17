import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { CircleDashed, RefreshCw, Swords, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import Button from '@/components/platform/Button';
import Tabs from '@/components/platform/Tabs';
import TableCard from '@/components/platform/TableCard';
import EmptyState from '@/components/platform/EmptyState';
import { demoQueue, demoTables, type DemoTable } from '@/components/platform/mockData';

/* ------------------------------------------------------------------ */
/* Tableau des tables — le signe distinctif (home.md §S2).             */
/* 3 colonnes d'état (file / ouvertes / en cours), 2 colonnes          */
/* 760–1100px, onglets <760px. Chaque colonne défile (max-h 420px).    */
/* Données : mockData (démo, voir en-tête de mockData.ts).             */
/* ------------------------------------------------------------------ */

/** temps d'attente des joueurs en file, croissant en direct */
function useWaitingTimes() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return demoQueue.map((q) => ({ ...q, waitedSec: q.waitedSec + tick }));
}

function QueueColumn() {
  const t = useT();
  const waiting = useWaitingTimes();
  if (waiting.length === 0) {
    return <EmptyState mini icon={<CircleDashed aria-hidden />} title={t('platform.empty.queue')} />;
  }
  return (
    <ul className="flex flex-col gap-1 p-2">
      {waiting.map((q) => (
        <motion.li
          key={q.id}
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-enamel-800"
        >
          <span className="flex items-center gap-2 font-ui text-[13px] text-paper-300">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', q.mode === 'ranked' ? 'bg-rust-600' : 'bg-bottle-500')}
              aria-hidden
            />
            {q.masked}
          </span>
          <span className="data-text text-[11px] text-iron-400 tnums">
            {String(Math.floor(q.waitedSec / 60)).padStart(2, '0')}:{String(q.waitedSec % 60).padStart(2, '0')}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

function TableColumn({ tables, live }: { tables: DemoTable[]; live?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  if (tables.length === 0) {
    return <EmptyState mini icon={live ? <Swords aria-hidden /> : <Users aria-hidden />} title={live ? t('platform.empty.live') : t('platform.empty.tables')} />;
  }
  return (
    <div className="flex flex-col gap-2 p-2">
      {tables.map((table, i) => (
        <TableCard
          key={table.id}
          table={table}
          pulse={i < 3 /* budget pulses : 3 max / viewport (§5) */}
          onJoin={(tb) => navigate(`/online/${tb.code}`)}
          onResume={(tb) => navigate(`/game/${tb.code}`)}
        />
      ))}
    </div>
  );
}

export default function TableBoard() {
  const t = useT();
  const [tab, setTab] = useState('open');
  const [spin, setSpin] = useState(0);

  const open = useMemo(() => demoTables.filter((tb) => tb.state === 'open'), []);
  const live = useMemo(() => demoTables.filter((tb) => tb.state !== 'open'), []);

  const columns = [
    { id: 'queue', label: t('platform.state.queue'), body: <QueueColumn />, count: demoQueue.length },
    { id: 'open', label: t('platform.state.openTables'), body: <TableColumn tables={open} />, count: open.length },
    { id: 'live', label: t('platform.state.live'), body: <TableColumn tables={live} live />, count: live.length },
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
          <span className="animate-presence-dot h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
          {t('platform.home.board.title')}
        </span>
        <span className="flex items-center gap-3">
          <span className="data-text text-[11px] text-iron-400 tnums">
            {t('platform.home.board.counts', { open: open.length, live: live.length })}
          </span>
          <Button
            variant="icon"
            className="!h-7 !w-7"
            aria-label={t('platform.home.board.refresh')}
            onClick={() => setSpin((n) => n + 1)}
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
