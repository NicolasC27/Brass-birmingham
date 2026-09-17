import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { lobby } from '@/online/lobby';
import { useSession } from '@/online/session';
import Button from '@/components/platform/Button';
import EmptyState from '@/components/platform/EmptyState';
import TableCard from '@/components/platform/TableCard';
import { readPresence } from '@/components/platform/presence';
import { demoTables, type DemoTable } from '@/components/platform/mockData';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 3 (play.md) — tables publiques (#tables) : compteur, chips  */
/* de filtres (filet laiton layoutId), tri, grille de TableCard avec   */
/* stagger 40 ms, état vide filtré, « Charger plus ».                  */
/* src/online/* n'expose aucun contrat de tables publiques : la grille */
/* consomme la démonstration documentée de mockData.ts (mention        */
/* `demoNote` affichée) ; « Rejoindre » passe par le flux lobby.join   */
/* existant → /online/:code.                                           */
/* ------------------------------------------------------------------ */

const PAGE = 6;

type Filter = 'all' | 'seats' | 'normal' | 'ranked' | 'region';
type Sort = 'recent' | 'latency';

function matches(table: DemoTable, filter: Filter, region: string): boolean {
  switch (filter) {
    case 'seats':
      return table.state === 'open' && table.seats.some((s) => s === null);
    case 'normal':
    case 'ranked':
      return table.mode === filter;
    case 'region':
      return table.region === region;
    default:
      return true;
  }
}

export default function PublicTables({ onToast }: { onToast: Notify }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const presence = readPresence();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [visible, setVisible] = useState(PAGE);
  const [joining, setJoining] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = demoTables.filter((tb) => matches(tb, filter, presence.region));
    return sort === 'latency' ? [...list].sort((a, b) => a.latencyMs - b.latencyMs) : list;
  }, [filter, sort, presence.region]);

  const openCount = demoTables.filter((tb) => tb.state === 'open').length;
  const shown = filtered.slice(0, visible);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: t('platform.play.tables.all') },
    { id: 'seats', label: t('platform.play.tables.freeSeats') },
    { id: 'normal', label: t('platform.mode.normal') },
    { id: 'ranked', label: t('platform.mode.ranked') },
    { id: 'region', label: t('platform.play.tables.myRegion') },
  ];

  const join = async (table: DemoTable) => {
    if (joining) return;
    if (!session) {
      navigate(`/account?table=${table.code}`);
      return;
    }
    setJoining(table.code);
    try {
      await lobby.join(table.code);
      navigate(`/online/${table.code}`);
    } catch (e) {
      onToast({ message: lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: 'error' });
      setJoining(null);
    }
  };

  return (
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-8 scroll-mt-28 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-paper-100">
            {t('platform.play.tables.title')}
          </h2>
          <p className="data-text mt-1 text-[12px] text-iron-400 tnums">{t('platform.play.tables.count', { count: openCount })}</p>
        </div>
        <p className="micro-label text-[10px] text-iron-600">{t('platform.demoNote')}</p>
      </div>

      {/* Barre de filtres — chips h-32 + tri ghost */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={filter === chip.id}
            onClick={() => {
              setFilter(chip.id);
              setVisible(PAGE);
            }}
            className={cn(
              'relative h-8 rounded-full px-3.5 font-ui text-[12px] font-semibold transition-colors duration-150',
              filter === chip.id ? 'text-brass-300' : 'text-paper-300 hover:text-paper-100',
            )}
          >
            {chip.label}
            {filter === chip.id && (
              <motion.span layoutId="play-tables-filter" className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-brass-500" aria-hidden />
            )}
          </button>
        ))}
        <span className="flex-1" />
        <Button
          variant="ghost"
          className="!h-8 px-3 text-[12px]"
          icon={<ChevronDown size={14} aria-hidden />}
          onClick={() => setSort((s) => (s === 'recent' ? 'latency' : 'recent'))}
        >
          {sort === 'recent' ? t('platform.play.tables.sortRecent') : t('platform.play.tables.sortLatency')}
        </Button>
      </div>

      {/* Grille */}
      {shown.length === 0 ? (
        <EmptyState
          className="mt-4"
          image="/empty-tables.png"
          title={t('platform.play.tables.emptyTitle')}
          copy={t('platform.play.tables.emptyCopy')}
          cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }}
        />
      ) : (
        <div className="mt-4 grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {shown.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.15, once: true }}
              transition={{ duration: 0.22, ease: 'easeOut', delay: (i % PAGE) * 0.04 }}
            >
              <TableCard table={table} onJoin={(tb) => void join(tb)} />
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length > visible && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={() => setVisible((v) => v + PAGE)}>
            {t('platform.play.tables.loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
