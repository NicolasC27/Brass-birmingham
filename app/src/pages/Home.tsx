import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { BookOpen, Briefcase, GraduationCap, Hash, Play, Plus, RotateCcw, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { useDesk, useSession } from '@/online/session';
import { forgetLocalGame } from '@/game/local';
import { readResume } from '@/game/quickplay';
import Button from '@/components/platform/Button';
import Modal from '@/components/platform/Modal';
import CodeInput from '@/components/platform/CodeInput';
import ModeCard from '@/components/platform/ModeCard';
import RankBadge from '@/components/platform/RankBadge';
import Departures from '@/components/home/Departures';
import ChallengeNotice from '@/components/home/ChallengeNotice';
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
/* The front page. Under the masthead: the engraving of the day, then  */
/* the leader — the headline, what waits for me, the tickets — beside  */
/* the departures; below, the queues and my standing, the club's news  */
/* in two columns, and the classifieds. Framer Motion only.            */
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
function Ticket({ to, onClick, tone, icon, children }: { to?: string; onClick?: () => void; tone?: 'brass' | 'signal'; icon: ReactNode; children: ReactNode }) {
  const cls = cn('gz-ticket', tone === 'brass' && 'gz-ticket-brass', tone === 'signal' && 'gz-ticket-signal');
  if (to) {
    return (
      <Link to={to} className={cls} onMouseEnter={preloadGame} onFocus={preloadGame}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} onMouseEnter={preloadGame} onFocus={preloadGame}>
      {icon}
      {children}
    </button>
  );
}

/* --------------------- The telegram: a game waits --------------------- */

function ResumeBanner() {
  const t = useT();
  const lang = useLang();
  const desk = useDesk();
  const [local, setLocal] = useState(readResume);
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
    if (local) forgetLocalGame(local.code);
    /* the next game of the register, if any, takes the banner */
    setLocal(readResume());
    setDiscarding(false);
  };

  return (
    <motion.div
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.26, ease, delay: 0.1 }}
      className="flex items-center gap-3 border-y border-[var(--gz-ink-soft)] py-3"
    >
      <RotateCcw size={15} className="animate-pulse-signal shrink-0 text-signal-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-fraunces text-[15px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
          {text}
        </p>
        <p className="data-text text-[11px] text-iron-400 tnums">{meta}</p>
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
    <div className="grid gap-4 border-y border-[var(--gz-ink-soft)] py-5 min-[900px]:grid-cols-3">
      <motion.div {...reveal(0)}>
        <ModeCard mode="normal" compact disabled={offline} queueCount={presence.normalQueue.count} estimateMin={presence.normalQueue.estimateMin} onSelect={() => navigate('/online')} />
      </motion.div>
      <motion.div {...reveal(1)}>
        <ModeCard mode="ranked" compact disabled={offline} queueCount={presence.rankedQueue.count} estimateMin={presence.rankedQueue.estimateMin} rank={badge} onSelect={() => navigate('/online')} />
      </motion.div>
      <motion.div {...reveal(2)}>
        {session ? (
          <div className="flex h-[76px] items-center gap-4 border border-[var(--gz-ink-soft)] p-4">
            <RankBadge tier={rank.tier} division={rank.division} size={32} compact />
            <div className="min-w-0 flex-1">
              <p className="title-card truncate">
                {rank.tier === 'placement'
                  ? rank.rating === null
                    ? t('platform.home.rating.none')
                    : t('platform.home.rating.placement', { done: rank.placementDone ?? 0, total: PLACEMENTS })
                  : rank.division
                    ? t('platform.home.rating.value', { tier: t(`platform.rank.${rank.tier}`), division: rank.division, lp: rank.lp ?? 0 })
                    : t('platform.home.rating.valueTop', { tier: t(`platform.rank.${rank.tier}`), lp: rank.lp ?? 0 })}
              </p>
              <div className="mt-2 h-px overflow-hidden bg-[var(--gz-ink-faint)]">
                <motion.div initial={{ width: 0 }} whileInView={{ width: `${rank.progress}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease }} className="h-full bg-brass-300" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[76px] items-center justify-between gap-3 border border-dashed border-[var(--gz-ink-soft)] p-4">
            <p className="font-serif text-[13px] italic text-paper-300">{t('platform.home.rating.signIn')}</p>
            <Button variant="ghost" className="!h-8 shrink-0" to="/account">
              {t('platform.action.signIn')}
            </Button>
          </div>
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

  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
      {/* the engraving of the day */}
      <motion.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease }} className="gz-engraving mt-6 h-[180px] min-[900px]:h-[300px]">
        <img src={theme === 'dark' ? plate.night : plate.src} alt="" style={{ objectPosition: plate.position }} />
      </motion.figure>

      {/* the leader beside the departures */}
      <div className="mt-8 grid gap-8 min-[1100px]:grid-cols-12 min-[1100px]:gap-10">
        <section className="flex flex-col gap-5 min-[1100px]:col-span-7">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, ease }} className="eyebrow-fell">
            {t('platform.home.eyebrow')}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease, delay: 0.06 }}
            className="-mt-2 max-w-[560px] font-fraunces text-[30px] font-normal italic leading-[1.15] text-paper-100 min-[900px]:text-[36px]"
            style={{ fontVariationSettings: '"opsz" 144' }}
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

        <aside className="gz-col-rule min-[1100px]:col-span-5">
          <Departures />
          <div className="mt-8">
            <Ephemeris />
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <ChallengeNotice />
      </div>

      <div className="mt-10">
        <QueueRankStrip />
      </div>

      <div className="mt-10">
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
