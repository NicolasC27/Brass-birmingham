import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { BookOpen, Briefcase, ChevronRight, Hash, Play, Plus, RotateCcw, Trash2, User } from 'lucide-react';
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
import TableBoard from '@/components/home/TableBoard';
import ClubActivity from '@/components/home/ClubActivity';
import { usePresence } from '@/components/platform/presence';
import { PLACEMENTS, rankOf } from '@/platform/rank';

/* ------------------------------------------------------------------ */
/* Accueil « hall du club » (home.md) — tableau de bord plateforme :   */
/* jouer / reprendre / rejoindre au-dessus de la ligne de flottaison,  */
/* tableau des tables vivant, strip files & rang, activité. Motion :   */
/* Framer Motion uniquement — Lenis/GSAP n'ont pas cours ici.          */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/* --------------------- Bandeau « Reprendre » (§S1) --------------------- */

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
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.26, ease, delay: 0.1 }}
      className="halo-signal flex h-16 items-center gap-3 rounded-xl border border-[rgb(var(--signal-400)/.5)] bg-enamel-850 px-4"
    >
      <RotateCcw size={18} className="animate-pulse-signal shrink-0 text-signal-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-[14px] font-semibold text-paper-100">{text}</p>
        <p className="data-text text-[11px] text-iron-400 tnums">{meta}</p>
      </div>
      {!table && (
        <Button variant="icon" aria-label={t('platform.home.discard')} title={t('platform.home.discard')} onClick={() => setDiscarding(true)} icon={<Trash2 size={16} aria-hidden />} />
      )}
      <Button variant="live" className="!h-9 shrink-0" to={to}>
        {t('platform.action.resume')}
      </Button>
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

/* ------------------- Section 3 — strip files & rang ------------------- */

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
    <div className="mt-6 grid gap-4 min-[900px]:grid-cols-3">
      <motion.div {...reveal(0)}>
        <ModeCard
          mode="normal"
          compact
          disabled={offline}
          queueCount={presence.normalQueue.count}
          estimateMin={presence.normalQueue.estimateMin}
          onSelect={() => navigate('/online')}
        />
      </motion.div>
      <motion.div {...reveal(1)}>
        <ModeCard
          mode="ranked"
          compact
          disabled={offline}
          queueCount={presence.rankedQueue.count}
          estimateMin={presence.rankedQueue.estimateMin}
          rank={badge}
          onSelect={() => navigate('/online')}
        />
      </motion.div>
      <motion.div {...reveal(2)}>
        {session ? (
          <div className="flex h-[88px] items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-850 p-4">
            <RankBadge tier={rank.tier} division={rank.division} size={32} compact />
            <div className="min-w-0 flex-1">
              <p className="truncate font-ui text-[14px] font-semibold text-paper-100">
                {rank.tier === 'placement'
                  ? rank.rating === null
                    ? t('platform.home.rating.none')
                    : t('platform.home.rating.placement', { done: rank.placementDone ?? 0, total: PLACEMENTS })
                  : rank.division
                    ? t('platform.home.rating.value', { tier: t(`platform.rank.${rank.tier}`), division: rank.division, lp: rank.lp ?? 0 })
                    : t('platform.home.rating.valueTop', { tier: t(`platform.rank.${rank.tier}`), lp: rank.lp ?? 0 })}
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-enamel-700">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${rank.progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease }}
                  className="h-full rounded-full bg-gradient-to-r from-brass-300 via-brass-500 to-brass-600"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[88px] items-center justify-between gap-3 rounded-xl border border-dashed border-[rgb(var(--paper-100)/.14)] bg-transparent p-4">
            <p className="font-ui text-[13px] text-iron-400">{t('platform.home.rating.signIn')}</p>
            <Button variant="ghost" className="!h-9 shrink-0" to="/account">
              {t('platform.action.signIn')}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* --------------------- Section 5 — raccourcis du club --------------------- */

function Shortcuts() {
  const t = useT();
  const cards = [
    { to: '/rules', icon: BookOpen, title: t('platform.home.shortcuts.rules'), copy: t('platform.home.shortcuts.rulesCopy') },
    { to: '/desk', icon: Briefcase, title: t('platform.home.shortcuts.desk'), copy: t('platform.home.shortcuts.deskCopy') },
    { to: '/profile', icon: User, title: t('platform.home.shortcuts.profile'), copy: t('platform.home.shortcuts.profileCopy') },
  ];
  return (
    <div className="mb-2 mt-8 grid gap-4 min-[760px]:grid-cols-3">
      {cards.map(({ to, icon: Icon, title, copy }, i) => (
        <motion.div
          key={to}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.2, once: true }}
          transition={{ duration: 0.22, ease, delay: i * 0.06 }}
        >
          <Link
            to={to}
            className="group flex h-24 items-center gap-4 rounded-xl border border-[rgb(var(--paper-100)/.14)] px-5 transition-colors duration-150 hover:bg-enamel-800"
          >
            <Icon size={20} aria-hidden className="shrink-0 text-brass-300 transition-colors duration-150 group-hover:text-brass-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-ui text-[14px] font-semibold text-paper-100">{title}</span>
              <span className="mt-0.5 block truncate font-ui text-[12px] text-iron-400">{copy}</span>
            </span>
            <ChevronRight size={16} aria-hidden className="shrink-0 text-iron-600 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function Home() {
  const t = useT();
  const navigate = useNavigate();
  const [codeOpen, setCodeOpen] = useState(false);

  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
      {/* Section 1 + 2 — console d'accueil & tableau des tables */}
      <div className="grid gap-8 pb-6 pt-10 min-[1100px]:grid-cols-12">
        <section className="flex flex-col justify-center gap-5 min-[1100px]:col-span-5">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease }}
            className="micro-label text-brass-300"
          >
            {t('platform.home.eyebrow')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease, delay: 0.06 }}>
            <h1 className="display-hero">{t('platform.home.title')}</h1>
            <p className="mt-3 max-w-md font-ui text-[15px] leading-relaxed text-paper-300">{t('platform.home.tagline')}</p>
          </motion.div>

          <ResumeBanner />

          <div className="flex flex-wrap gap-3">
            {[
              <Button key="play" variant="live" to="/online" icon={<Play size={16} aria-hidden />}>
                {t('platform.action.playNow')}
              </Button>,
              <Button key="create" variant="primary" to="/setup" icon={<Plus size={16} aria-hidden />}>
                {t('platform.action.createTable')}
              </Button>,
              <Button key="code" variant="ghost" icon={<Hash size={16} aria-hidden />} onClick={() => setCodeOpen(true)}>
                {t('platform.action.joinWithCode')}
              </Button>,
            ].map((btn, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease, delay: 0.12 + i * 0.05 }}
              >
                {btn}
              </motion.div>
            ))}
          </div>
        </section>

        <div className={cn('min-[1100px]:col-span-7')}>
          <TableBoard />
        </div>
      </div>

      {/* Section 3 — bandeau files & classement */}
      <QueueRankStrip />

      {/* Section 4 — activité du club */}
      <div className="mt-8">
        <ClubActivity />
      </div>

      {/* Section 5 — raccourcis */}
      <Shortcuts />

      {/* Modale « rejoindre avec un code » */}
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
