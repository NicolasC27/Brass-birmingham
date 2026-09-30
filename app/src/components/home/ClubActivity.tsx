import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import type { PastGame, PublicTable } from '@/online/table';
import ActivityFeedItem from '@/components/platform/ActivityFeedItem';
import Button from '@/components/platform/Button';

/* ------------------------------------------------------------------ */
/* Activité du club (home.md §S4) — mes dernières parties (gauche :    */
/* vainqueur, PV, date, depuis desk.history) + les tables en cours     */
/* dans la maison (droite : nom, tour, depuis le registre). Rien       */
/* n'est inventé : sans partie ni table, l'état vide le dit.           */
/* ------------------------------------------------------------------ */

const FEED = 5;
const LIVE = 6;

const item = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' as const, delay: i * 0.04 },
  }),
};

function Reveal({ i, children, className }: { i: number; children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ amount: 0.15, once: true }} variants={item} custom={i} className={className}>
      {children}
    </motion.div>
  );
}

function Empty({ copy, cta }: { copy: string; cta?: { label: string; to: string } }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="max-w-[280px] font-serif text-[14px] italic text-paper-300">{copy}</p>
      {cta && (
        <Button variant="ghost" className="!h-8 px-3 text-[12px]" to={cta.to}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}

/* ----------------------------- mes parties ----------------------------- */

function GameItem({ game, me }: { game: PastGame; me: string }) {
  const navigate = useNavigate();
  const lang = useLang();
  const winner = game.players[game.winner];
  const won = winner?.id === me;
  return (
    <ActivityFeedItem
      kind={won ? 'gameWon' : 'gameOver'}
      vars={{ table: tableTitle(game.name, lang), name: winner?.name ?? '—', vp: winner?.vp ?? 0 }}
      at={game.finishedAt}
      onClick={() => navigate('/desk#historique')}
    />
  );
}

function MyGames() {
  const t = useT();
  const session = useSession();
  const stranger = useStranger();
  const line = useLine();
  const desk = useDesk();
  const games = (desk?.history ?? []).slice(0, FEED);

  if (stranger) return <Empty copy={t('platform.home.activity.signIn')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  if (!session || !desk) return <Empty copy={line === 'online' ? t('platform.home.activity.loading') : t('platform.serverOffline')} />;
  if (games.length === 0) return <Empty copy={t('platform.home.activity.emptyGames')} cta={{ label: t('platform.action.playNow'), to: '/online' }} />;
  return (
    <>
      {games.map((g, i) => (
        <Reveal key={g.code + g.finishedAt} i={i + 1}>
          <GameItem game={g} me={session.id} />
        </Reveal>
      ))}
    </>
  );
}

/* ---------------------------- les tables en cours ---------------------------- */

function LiveItem({ table }: { table: PublicTable }) {
  const navigate = useNavigate();
  const lang = useLang();
  const cur = table.current !== undefined ? table.seats[table.current] : undefined;
  return (
    <ActivityFeedItem
      kind="tableLive"
      vars={{ table: tableTitle(table.name, lang), round: table.round ?? 1, name: cur?.name ?? '—' }}
      at={table.updatedAt}
      onClick={() => navigate(`/game/${table.code}`)}
    />
  );
}

function LiveTables() {
  const t = useT();
  const stranger = useStranger();
  const line = useLine();
  /* the office names the most watched tables beside any page: one line asked, three tables back */
  const tables = useTables({ limit: 1 });
  const live = tables?.live ?? [];

  return (
    <div aria-label={t('platform.home.activity.liveTitle')}>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="micro-label text-paper-100">{t('platform.home.activity.liveTitle')}</span>
        {live.length > 0 && (
          <span className="micro-label flex items-center gap-1.5 text-signal-400">
            <span className="animate-pulse-signal h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
            {t('platform.home.activity.live')}
          </span>
        )}
      </div>
      {stranger ? (
        <Empty copy={t('platform.home.activity.liveSignIn')} />
      ) : tables === null ? (
        <Empty copy={line === 'online' ? t('platform.home.activity.loading') : t('platform.serverOffline')} />
      ) : live.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          <img src="/empty-queue.png" alt="" width={200} className="w-[200px] border border-[var(--gz-ink-soft)] p-1" />
          <p className="max-w-[260px] font-serif text-[14px] italic text-paper-300">{t('platform.home.activity.liveEmpty')}</p>
        </div>
      ) : (
        live.slice(0, LIVE).map((x, i) => (
          <Reveal key={x.code} i={i + 1}>
            <LiveItem table={x} />
          </Reveal>
        ))
      )}
    </div>
  );
}

export default function ClubActivity() {
  const t = useT();

  return (
    <div className="grid gap-6 min-[900px]:grid-cols-12">
      <section className="min-[900px]:col-span-7" aria-label={t('platform.home.activity.title')}>
        <Reveal i={0}>
          <h2 className="gz-head h2-section">{t('platform.home.activity.title')}</h2>
          <p className="micro-label mt-3 text-paper-100">{t('platform.home.activity.mine')}</p>
        </Reveal>
        <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
          <MyGames />
        </div>
        <Reveal i={FEED + 1} className="mt-3">
          <Link to="/desk#historique" className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-300 transition-colors hover:text-paper-100">
            {t('platform.home.activity.seeHistory')}
          </Link>
        </Reveal>
      </section>
      <motion.section
        className="gz-col-rule min-[900px]:col-span-5 min-[900px]:pt-[52px]"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.15, once: true }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.08 }}
      >
        <LiveTables />
      </motion.section>
    </div>
  );
}
