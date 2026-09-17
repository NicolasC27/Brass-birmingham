import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { lobby } from '@/online/lobby';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { toCards, type CardTable } from '@/platform/tables';
import Button from '@/components/platform/Button';
import EmptyState from '@/components/platform/EmptyState';
import TableCard from '@/components/platform/TableCard';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 3 (play.md) — tables publiques (#tables) : compteur, chips  */
/* de filtres (filet laiton layoutId), grille de TableCard avec        */
/* stagger 40 ms, état vide filtré, « Charger plus ».                  */
/* Le registre vient de l'office (useTables) : mes tables en tête avec */
/* « Reprendre », les ouvertes se rejoignent par lobby.join →          */
/* /online/:code, celles en cours se regardent → /game/:code.          */
/* ------------------------------------------------------------------ */

const PAGE = 6;

type Filter = 'all' | 'seats' | 'normal' | 'ranked';

function matches(table: CardTable, filter: Filter): boolean {
  switch (filter) {
    case 'seats':
      return table.state === 'open' && table.mode === 'normal' && table.seats.some((s) => s === null);
    case 'normal':
    case 'ranked':
      return table.mode === filter;
    default:
      return true;
  }
}

export default function PublicTables({ onToast }: { onToast: Notify }) {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const tables = useTables();
  const line = useLine();
  const stranger = useStranger();
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);
  const [joining, setJoining] = useState<string | null>(null);

  const lang = useLang();
  const cards = useMemo(() => toCards(tables ?? [], desk?.tables, session?.name, lang), [tables, desk?.tables, session?.name, lang]);
  const filtered = useMemo(() => cards.filter((tb) => matches(tb, filter)), [cards, filter]);

  const openCount = cards.filter((tb) => tb.state === 'open').length;
  const shown = filtered.slice(0, visible);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: t('platform.play.tables.all') },
    { id: 'seats', label: t('platform.play.tables.freeSeats') },
    { id: 'normal', label: t('platform.mode.normal') },
    { id: 'ranked', label: t('platform.mode.ranked') },
  ];

  const join = async (table: CardTable) => {
    if (joining) return;
    if (!session) {
      navigate(`/account?table=${table.code}`);
      return;
    }
    /* the card already says so; the office would refuse anyway */
    if (table.mode === 'ranked' || table.state !== 'open') return;
    setJoining(table.code);
    try {
      await lobby.join(table.code, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      onToast({ message: lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: 'error' });
      setJoining(null);
    }
  };
  const resume = (table: CardTable) => navigate(table.state === 'live' ? `/game/${table.code}` : `/online/${table.code}`);
  const watch = (table: CardTable) => navigate(`/game/${table.code}`);

  let body;
  if (stranger) {
    body = (
      <EmptyState
        className="mt-4"
        image="/empty-tables.png"
        title={t('platform.play.tables.signInTitle')}
        copy={t('platform.play.tables.signInCopy')}
        cta={{ label: t('platform.action.signIn'), to: '/account' }}
      />
    );
  } else if (tables === null) {
    body = (
      <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 px-6 py-10">
        <Loader2 size={18} className="animate-spin text-brass-300" aria-hidden />
        <p className="font-ui text-[13px] text-paper-300">{line === 'online' ? t('platform.play.tables.loading') : t('platform.play.tables.waitingLine')}</p>
      </div>
    );
  } else if (cards.length === 0) {
    body = (
      <EmptyState
        className="mt-4"
        image="/empty-tables.png"
        title={t('platform.play.tables.noneTitle')}
        copy={t('platform.play.tables.noneCopy')}
        cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }}
      />
    );
  } else if (shown.length === 0) {
    body = (
      <EmptyState
        className="mt-4"
        image="/empty-tables.png"
        title={t('platform.play.tables.emptyTitle')}
        copy={t('platform.play.tables.emptyCopy')}
        cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }}
      />
    );
  } else {
    body = (
      <div className="mt-4 grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {shown.map((table, i) => (
          <motion.div
            key={table.code}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.15, once: true }}
            transition={{ duration: 0.22, ease: 'easeOut', delay: (i % PAGE) * 0.04 }}
          >
            <TableCard table={table} pulse={i < 3} onJoin={(tb) => void join(tb)} onResume={resume} onWatch={watch} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-8 scroll-mt-28 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-paper-100">
            {t('platform.play.tables.title')}
          </h2>
          <p className="data-text mt-1 text-[12px] text-iron-400 tnums">
            {tables === null ? ' ' : t('platform.play.tables.count', { count: openCount, live: cards.length - openCount })}
          </p>
        </div>
      </div>

      {/* Barre de filtres — chips h-32 */}
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
      </div>

      {body}

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
