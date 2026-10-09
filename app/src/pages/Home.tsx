import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Briefcase, GraduationCap, Hash, Play, Plus, RotateCcw, Trash2, User } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useSession } from '@/online/session';
import { forgetHomeGame, subscribeHome } from '@/game/home';
import { readResume } from '@/game/quickplay';
import Button from '@/components/platform/Button';
import Modal from '@/components/platform/Modal';
import CodeInput from '@/components/platform/CodeInput';
import ModeCard from '@/components/platform/ModeCard';
import RankBadge from '@/components/platform/RankBadge';
import Departures from '@/components/home/Departures';
import ChallengeNotice from '@/components/home/ChallengeNotice';
import NoticeBoard from '@/components/home/NoticeBoard';
import Ephemeris from '@/components/home/Ephemeris';
import ClubActivity from '@/components/home/ClubActivity';
import ProgressCard from '@/components/desk/ProgressCard';
import { usePresence } from '@/components/platform/presence';
import { PLACEMENTS, rankOf } from '@/platform/rank';
import { useTheme } from '@/platform/theme';
import { ephemerisOf } from '@/platform/almanac';
import { grantFromHistory } from '@/platform/patents';
import { preloadGame } from '@/platform/preload';

/* ------------------------------------------------------------------ */
/* The front page. Under the masthead: the notice board when one is    */
/* posted, the engraving of the day, then the leader — the headline,   */
/* what waits for me, the tickets — beside                             */
/* the departures; below, the queues and my standing, the club's news  */
/* in two columns, and the classifieds. Framer Motion only.            */
/*                                                                     */
/* Spectral is the standfirst's hand: the italic belongs to the line   */
/* that introduces a block and nowhere else. Set on every empty state, */
/* note and caption it marked nothing at all, so those are roman now.  */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/* the plates the front page prints, by the almanac's year: the canal while
   the century is young, the Black Country as the works rise, the rail once
   the lines are laid — each with its night impression for the dark register */
const PLATES = [
  { src: '/hero-diorama.webp', night: '/plate-night-country.webp', position: 'center 40%' },
  { src: '/era-canal-banner.webp', night: '/plate-night-canal.webp', position: 'center 50%' },
  { src: '/era-rail-banner.webp', night: '/plate-night-rail.webp', position: 'center 50%' },
];
const plateOfTheEra = () => {
  const year = ephemerisOf().year;
  return year < 1800 ? PLATES[1] : year < 1830 ? PLATES[0] : PLATES[2];
};

/* a printed ticket: the front page's way of saying « go » */
/* the front page's ticket is the platform's ticket, with the game warmed up
   under the hand; the tone is the only thing this page still says itself */
function Ticket({ to, onClick, tone, icon, children }: { to?: string; onClick?: () => void; tone?: 'brass' | 'signal'; icon: ReactNode; children: ReactNode }) {
  const warm = { onMouseEnter: preloadGame, onFocus: preloadGame };
  const variant = tone === 'brass' ? 'ticket-brass' : 'ticket';
  const cls = tone === 'signal' ? 'gz-ticket-signal' : undefined;
  return to ? (
    <Button variant={variant} to={to} icon={icon} className={cls} {...warm}>
      {children}
    </Button>
  ) : (
    <Button variant={variant} onClick={onClick} icon={icon} className={cls} {...warm}>
      {children}
    </Button>
  );
}

/* --------------------- The telegram: a game waits --------------------- */

function ResumeBanner() {
  const t = useT();
  const lang = useLang();
  const desk = useDesk();
  const local = useSyncExternalStore(subscribeHome, readResume, readResume);
  const [discarding, setDiscarding] = useState(false);

  const table = desk?.tables.find((tb) => tb.myTurn && tb.status === 'playing');
  if (!table && !local) return null;

  /* the game at home is a table like the others: it has a name and a code */
  const localName = local ? tableTitle(local.name, lang) : '';
  const text = table ? t('platform.home.resumeBanner', { name: tableTitle(table.name, lang) }) : t('platform.home.resumeLocal', { name: localName });
  const saveMeta = local ? t('platform.home.resumeSaveMeta', { era: local.era === 'rail' ? t('platform.home.eraRail') : t('platform.home.eraCanal'), round: local.round }) : '';
  const meta = table ? t('platform.home.resumeMeta', { round: table.round ?? 1, opponents: table.seats.length - 1 }) : local ? `${local.code} · ${saveMeta}` : '';
  const to = table ? `/game/${table.code}` : local ? `/game/local/${local.code}` : '/game';

  const discard = () => {
    /* the next game of the register, if any, takes the banner */
    if (local) void forgetHomeGame(local.code);
    setDiscarding(false);
  };

  return (
    <motion.div
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.26, ease, delay: 0.1 }}
      className="flex items-center gap-3 border-y border-[var(--gz-ink-soft)] py-3"
    >
      <RotateCcw size={15} className="animate-pulse-signal shrink-0 text-signal-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-fraunces text-[15px] font-medium text-paper-100">
          {text}
        </p>
        <p className="data-text text-iron-400 tnums">{meta}</p>
      </div>
      {!table && (
        <button type="button" aria-label={t('platform.home.discard')} title={t('platform.home.discard')} onClick={() => setDiscarding(true)} className="text-iron-400 transition-colors hover:text-rust-400">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
      <Ticket to={to} tone="signal" icon={<Play aria-hidden />}>
        {t('platform.action.resume')}
      </Ticket>
      <Modal open={discarding} onClose={() => setDiscarding(false)} title={t('platform.home.discardTitle', { name: localName })}>
        <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.home.discardCopy')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger-ghost" icon={<Trash2 size={16} aria-hidden />} onClick={discard}>
            {t('platform.home.discardConfirm')}
          </Button>
          <Button variant="ghost" onClick={() => setDiscarding(false)}>
            {t('platform.action.close')}
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}

/* --------------------- The queues, and my standing --------------------- */

function QueueRankStrip() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const presence = usePresence();
  /* a width is neither a transform nor a layout: framer's own reduced-motion
     setting lets it through, so the bar is told here */
  const reduced = useReducedMotion();
  const offline = !presence.online;
  const rank = rankOf(desk?.rating);
  const badge = rank.tier === 'placement' ? undefined : { tier: rank.tier, division: rank.division };

  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { amount: 0.15, once: true },
    transition: { duration: 0.22, ease, delay: i * 0.06 },
  });

  return (
    <div className="grid gap-4 min-[900px]:grid-cols-3">
      <motion.div {...reveal(0)}>
        <ModeCard mode="normal" compact disabled={offline} queueCount={presence.normalQueue.count} estimateMin={presence.normalQueue.estimateMin} onSelect={() => navigate('/online')} />
      </motion.div>
      <motion.div {...reveal(1)}>
        <ModeCard mode="ranked" compact disabled={offline} queueCount={presence.rankedQueue.count} estimateMin={presence.rankedQueue.estimateMin} rank={badge} onSelect={() => navigate('/online')} />
      </motion.div>
      <motion.div {...reveal(2)}>
        {session ? (
          /* my standing is a way in too — to the rankings — so it wears the
             queues' paper and rule, its title set on the same line as theirs;
             the progress is a thread along its foot, drawn only once there is
             some, or an empty bar read as one more rule */
          <Link
            to="/classement"
            className="relative flex h-full min-h-[76px] items-center gap-4 border border-[var(--gz-line-control)] bg-enamel-850 p-4 transition-colors duration-150 hover:border-[var(--gz-ink)] hover:bg-enamel-800"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <RankBadge tier={rank.tier} division={rank.division} size={32} compact />
            </span>
            <span className="min-w-0 flex-1">
              <span className="title-card block truncate">
                {rank.tier === 'placement'
                  ? rank.rating === null
                    ? t('platform.home.rating.none')
                    : t('platform.home.rating.placement', { done: rank.placementDone ?? 0, total: PLACEMENTS })
                  : rank.division
                    ? t('platform.home.rating.value', { tier: t(`platform.rank.${rank.tier}`), division: rank.division, lp: rank.lp ?? 0 })
                    : t('platform.home.rating.valueTop', { tier: t(`platform.rank.${rank.tier}`), lp: rank.lp ?? 0 })}
              </span>
              <span className="mt-0.5 block truncate font-ui text-[12.5px] text-paper-300">{t('platform.home.rating.ladder')} →</span>
            </span>
            {rank.progress > 0 && (
              <span className="absolute inset-x-4 bottom-2 h-px overflow-hidden bg-[var(--gz-ink-faint)]" aria-hidden>
                <motion.span initial={reduced ? false : { width: 0 }} whileInView={{ width: `${rank.progress}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease }} className="block h-full bg-brass-300" />
              </span>
            )}
          </Link>
        ) : (
          /* a stranger's cell stays the dashed one of a door not yet open, but
             the whole of it is the way in: a third button beside the queues'
             cards crowded the sentence into three lines at a tablet's width */
          <Link
            to="/account"
            className="flex h-full min-h-[76px] items-center border border-dashed border-[var(--gz-ink-soft)] p-4 font-serif text-[13px] leading-snug text-paper-300 transition-colors duration-150 hover:border-[var(--gz-ink)] hover:bg-enamel-800 hover:text-paper-100"
          >
            {`${t('platform.home.rating.signIn')}\u00a0→`}
          </Link>
        )}
      </motion.div>
    </div>
  );
}

/* --------------------------- The classifieds --------------------------- */

function Classifieds() {
  const t = useT();
  /* the evening course holds the guided game, and the rest of the programme */
  const ads = [
    { key: '/cours', icon: GraduationCap, title: t('platform.home.shortcuts.guided'), copy: t('platform.home.shortcuts.guidedCopy') },
    { key: '/rules', icon: BookOpen, title: t('platform.home.shortcuts.rules'), copy: t('platform.home.shortcuts.rulesCopy') },
    { key: '/desk', icon: Briefcase, title: t('platform.home.shortcuts.desk'), copy: t('platform.home.shortcuts.deskCopy') },
    { key: '/profile', icon: User, title: t('platform.home.shortcuts.profile'), copy: t('platform.home.shortcuts.profileCopy') },
  ];
  return (
    <div className="mt-10 grid gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-4">
      {ads.map(({ key, icon: Icon, title, copy }, i) => {
        const inner = (
          <>
            <Icon size={18} strokeWidth={1.5} aria-hidden className="text-brass-300" />
            <span className="title-card mt-1">{title}</span>
            <span className="font-serif text-[12.5px] italic leading-snug text-paper-300">{copy}</span>
          </>
        );
        return (
          <motion.div key={key} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.2, once: true }} transition={{ duration: 0.22, ease, delay: i * 0.06 }}>
            <Link to={key} className="gz-classified h-full">
              {inner}
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function Home() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  /* the office's history read through for the wall, whenever it arrives */
  useEffect(() => {
    if (session && desk) grantFromHistory(desk.history, session.id);
  }, [session, desk]);
  const [codeOpen, setCodeOpen] = useState(false);
  const [plate] = useState(plateOfTheEra);
  const theme = useTheme();
  /* an anchor on the front page (/#defi): the columns arrive after the
     first paint, so the scroll is asked again once they have */
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const scroll = () => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    scroll();
    const retry = window.setTimeout(scroll, 350);
    return () => window.clearTimeout(retry);
  }, [hash]);

  return (
    <div className="gz-measure">
      {/* the notice board, placarded at the door before anything else */}
      <NoticeBoard />

      {/* the engraving of the day */}
      <motion.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease }} className="gz-engraving mt-6 h-[180px] min-[900px]:h-[300px]">
        <img src={theme === 'dark' ? plate.night : plate.src} alt="" style={{ objectPosition: plate.position }} />
      </motion.figure>

      {/* the leader beside the departures. One gutter for every pair of
          columns on the page, the width of the rule's own indent, so the rule
          stands in the middle of it and on the same vertical as the club's.
          The almanac's line is printed under the tickets rather than under
          the board: the leader is the short column, and left alone it opened
          a well of paper beside a long timetable. */}
      <div className="mt-8 grid gap-10 min-[1100px]:grid-cols-12 min-[1100px]:grid-rows-[auto_1fr] min-[1100px]:gap-x-7">
        <section className="flex flex-col gap-5 min-[1100px]:col-span-7">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, ease }} className="eyebrow-fell">
            {t('platform.home.eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease, delay: 0.06 }}
            className="-mt-2 max-w-[560px] font-fraunces text-[30px] font-normal italic leading-[1.15] text-paper-100 min-[900px]:text-[36px]"
          >
            {t('platform.home.tagline')}
          </motion.h1>

          <ResumeBanner />
          <ProgressCard quiet />

          <div className="flex flex-wrap gap-3">
            {[
              <Ticket key="play" to="/online" tone="signal" icon={<Play aria-hidden />}>
                {t('platform.action.playNow')}
              </Ticket>,
              <Ticket key="create" to="/setup" tone="brass" icon={<Plus aria-hidden />}>
                {t('platform.action.createTable')}
              </Ticket>,
              <Ticket key="code" onClick={() => setCodeOpen(true)} icon={<Hash aria-hidden />}>
                {t('platform.action.joinWithCode')}
              </Ticket>,
            ].map((btn, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.12 + i * 0.05 }}>
                {btn}
              </motion.div>
            ))}
          </div>
        </section>

        <aside className="gz-col-rule min-[1100px]:col-span-5 min-[1100px]:col-start-8 min-[1100px]:row-span-2 min-[1100px]:row-start-1">
          <Departures />
        </aside>

        <div className="self-start min-[1100px]:col-span-7 min-[1100px]:row-start-2">
          <Ephemeris />
        </div>
      </div>

      {/* two steps of rhythm only: 40px between blocks of a rank, 72px
          before a rubric that carries its own title */}
      <div className="mt-10">
        <ChallengeNotice />
      </div>

      <div className="mt-10">
        <QueueRankStrip />
      </div>

      <div className="mt-[72px]">
        <ClubActivity />
      </div>

      <Classifieds />

      <Modal open={codeOpen} onClose={() => setCodeOpen(false)} title={t('platform.code.title')}>
        <p className="mb-5 font-ui text-[13px] text-paper-300">{t('platform.code.hint')}</p>
        <CodeInput
          onSubmit={(code) => {
            setCodeOpen(false);
            navigate(`/online/${code}`);
          }}
        />
      </Modal>
    </div>
  );
}
