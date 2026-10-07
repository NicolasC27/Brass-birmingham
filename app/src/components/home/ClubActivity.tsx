import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import type { PastGame, PublicTable } from '@/online/table';
import ActivityFeedItem from '@/components/platform/ActivityFeedItem';
import Button from '@/components/platform/Button';
import Post from './Post';
import Feuilleton from './Feuilleton';
import PatentsWall from './PatentsWall';
import Telegraph from './Telegraph';
import ClubEdition from './ClubEdition';
import Portrait from './Portrait';
import { storyOfGame, storyOfTable, winStreak } from '@/platform/chronicle';
import { useTheme } from '@/platform/theme';

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
      <p className="max-w-[280px] font-serif text-[14px] text-paper-300">{copy}</p>
      {/* the same errand is the same brick: the front page prints this
          departure on a perforated ticket, and so does the column beside it */}
      {cta && (
        <Button variant="ticket" className="gz-ticket-sm" to={cta.to}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}

/* ----------------------------- mes parties ----------------------------- */

function GameItem({ game, me, streak }: { game: PastGame; me: string; streak: number }) {
  const navigate = useNavigate();
  const lang = useLang();
  const won = game.players[game.winner]?.id === me;
  const story = storyOfGame(game, me, streak, tableTitle(game.name, lang));
  return (
    <ActivityFeedItem
      kind={won ? 'gameWon' : 'gameOver'}
      vars={story.vars}
      textKey={story.key}
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
  /* a run of wins is a story of its own, told on the latest game */
  const streak = session && desk ? winStreak(desk.history, session.id) : 0;

  if (stranger) return <Empty copy={t('platform.home.activity.signIn')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  if (!session || !desk) return <Empty copy={line === 'online' ? t('platform.home.activity.loading') : t('platform.serverOffline')} />;
  if (games.length === 0) return <Empty copy={t('platform.home.activity.emptyGames')} cta={{ label: t('platform.action.playNow'), to: '/online' }} />;
  return (
    <>
      {games.map((g, i) => (
        <Reveal key={g.code + g.finishedAt} i={i + 1}>
          <GameItem game={g} me={session.id} streak={i === 0 ? streak : 0} />
        </Reveal>
      ))}
    </>
  );
}

/* ---------------------------- les tables en cours ---------------------------- */

function LiveItem({ table }: { table: PublicTable }) {
  const navigate = useNavigate();
  const lang = useLang();
  const story = storyOfTable(table, tableTitle(table.name, lang));
  return (
    <ActivityFeedItem
      kind="tableLive"
      vars={story.vars}
      textKey={story.key}
      at={table.updatedAt}
      onClick={() => navigate(`/game/${table.code}`)}
    />
  );
}

function LiveTables() {
  const t = useT();
  const theme = useTheme();
  const stranger = useStranger();
  const line = useLine();
  /* the office names the most watched tables beside any page: one line asked, three tables back */
  /* the office keeps one register at a time: every reader on this page
     asks for the same page, or the last asking blanks the others */
  const tables = useTables({ limit: 12 });
  const live = tables?.live ?? [];

  return (
    <div aria-label={t('platform.home.activity.liveTitle')}>
      <div className="flex items-center justify-between gap-3 pb-2">
        <h2 className="micro-label text-paper-100">{t('platform.home.activity.liveTitle')}</h2>
        {live.length > 0 && (
          <span className="micro-label flex items-center gap-1.5 text-signal-ink">
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
          <div className="gz-engraving w-full max-w-[320px]">
            <img src={`/empty-queue${theme === 'dark' ? '-night' : ''}.webp`} alt="" className="!aspect-[16/9]" />
          </div>
          <p className="max-w-[260px] font-serif text-[14px] text-paper-300">{t('platform.home.activity.liveEmpty')}</p>
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
          <h3 className="micro-label mt-3 text-paper-100">{t('platform.home.activity.mine')}</h3>
        </Reveal>
        <div className="mt-1 border-t border-[var(--gz-ink-soft)]">
          <MyGames />
        </div>
        <Reveal i={FEED + 1} className="mt-3">
          <Link to="/desk#historique" className="font-ui text-[10.5px] font-semibold uppercase tracking-label text-brass-300 transition-colors hover:text-paper-100">
            {t('platform.home.activity.seeHistory')} →
          </Link>
        </Reveal>
        <div className="mt-8">
          <Feuilleton />
        </div>
        <div className="mt-8">
          <Post />
        </div>
      </section>
      <motion.section
        className="gz-col-rule-900 min-[900px]:col-span-5 min-[900px]:pt-[52px]"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.15, once: true }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.08 }}
      >
        <Portrait />
        <div className="mt-8">
          <Telegraph />
        </div>
        <div className="mt-8">
          <ClubEdition />
        </div>
        <div className="mt-8">
          <LiveTables />
        </div>
        <div className="mt-8">
          <PatentsWall />
        </div>
      </motion.section>
    </div>
  );
}
