import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { BadgeCheck, Coins, LogOut, MailWarning } from 'lucide-react';
import { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import VerifyBanner from '@/components/site/VerifyBanner';
import Button from '@/components/platform/Button';
import MemberAvatar from '@/components/platform/MemberAvatar';
import RankBadge, { type RankTier } from '@/components/platform/RankBadge';
import StatTile from '@/components/platform/StatTile';
import { demoRating } from '@/components/platform/mockData';
import PlayerToken from '@/components/setup/PlayerToken';
import { PLAYER_COLORS } from '@/components/setup/constants';
import type { PlayerColor } from '@/components/setup/constants';
import { isOnline } from '@/online/lobby';
import { useWallet } from '@/platform/wallet';
import { changePassword, signOut, updateProfile, useDesk, useSession, useStranger } from '@/online/session';
import { HistoryLedger } from '@/pages/Desk';
import { useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Carte de membre & réglages (profile.md) — l'en-tête registre       */
/* (avatar, pseudo, rang honnête « SAISON 1 · BÊTA »), les             */
/* statistiques publiques, l'échelle des rangs, l'historique, puis     */
/* les réglages : identité (devise, couleur) et compte & sécurité      */
/* (mot de passe via session.ts, déconnexion). Contrats inchangés.     */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
const TIERS: RankTier[] = ['bronze', 'fer', 'acier', 'laiton', 'or', 'maitre'];

/* --------------------------- En-tête de membre --------------------------- */

function MemberCard() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const wallet = useWallet();
  if (!session) return null;
  const since = new Date(session.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease }}
      className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850"
    >
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-wrap items-center gap-x-8 gap-y-6 p-6 lg:p-8">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.28, ease }} className="relative shrink-0">
          <MemberAvatar avatar={wallet.equipped.avatar} frame={wallet.equipped.frame} size={88} />
          <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-bottle-400 ring-2 ring-enamel-850" title={t('platform.desk.friends.presenceOnline')} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.06 }} className="min-w-0 flex-1">
          <p className="micro-label text-brass-300">{t('platform.profile.eyebrow')}</p>
          <h1 className="mt-1 truncate font-fraunces text-[36px] font-semibold leading-tight text-paper-100">{session.name}</h1>
          {wallet.equipped.title !== 'title-none' && <p className="micro-label mt-1 text-brass-300">{t(`platform.comptoir.items.${wallet.equipped.title}`)}</p>}
          <p className="micro-label mt-1.5 text-iron-400">{t('platform.profile.memberSince', { date: since })}</p>
          {session.motto && <p className="mt-2.5 font-ui text-[14px] text-paper-300">« {session.motto} »</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.26, ease, delay: 0.1 }} className="flex shrink-0 items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-800 px-5 py-4">
          <RankBadge tier={demoRating.tier} division={demoRating.division} size={48} compact />
          <div>
            <p className="font-fraunces text-[24px] font-semibold leading-none text-paper-100">
              {t(`platform.rank.${demoRating.tier}`)} {demoRating.division}
            </p>
            <p className="data-text mt-1.5 text-[12px] tabular-nums text-iron-400">{t('platform.profile.season', { lp: demoRating.lp })}</p>
            <p className="micro-label mt-1.5 text-rust-400">{t('platform.profile.beta')}</p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

/* --------------------- Statistiques & échelle des rangs --------------------- */

function StatsAndRanks() {
  const t = useT();
  const desk = useDesk();
  const wallet = useWallet();
  const stats = desk?.stats;
  const rate = stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—';
  const tiles: { value: string | number; label: string }[] = [
    { value: stats?.played ?? 0, label: t('platform.profile.stats.played') },
    { value: stats?.won ?? 0, label: t('platform.profile.stats.won') },
    { value: rate, label: t('platform.profile.stats.rate') },
    { value: stats?.averageVp ?? 0, label: t('platform.profile.stats.average') },
    { value: stats?.bestVp ?? 0, label: t('platform.profile.stats.best') },
  ];

  return (
    <div className="mt-6 grid gap-6 min-[1100px]:grid-cols-12">
      <div className="grid content-start gap-4 min-[760px]:grid-cols-2 min-[1100px]:col-span-8 xl:grid-cols-3">
        {tiles.map((tile, i) => (
          <motion.div key={tile.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.22, ease, delay: i * 0.05 }}>
            <StatTile value={tile.value} label={tile.label} className="h-full" />
          </motion.div>
        ))}
        {/* la cote affiche partout sa mention honnête (design.md §10) */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.22, ease, delay: tiles.length * 0.05 }}>
          <div className="flex h-full items-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 p-4">
            <RankBadge tier={demoRating.tier} division={demoRating.division} lp={demoRating.lp} size={32} />
            <span className="micro-label ml-auto rounded bg-rust-700/50 px-1.5 py-0.5 text-rust-400">{t('platform.profile.beta')}</span>
          </div>
        </motion.div>
        {/* tuile bourse → Comptoir */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.22, ease, delay: (tiles.length + 1) * 0.05 }}>
          <Link
            to="/comptoir"
            aria-label={t('platform.comptoir.walletAria', { count: wallet.balance })}
            className="flex h-full items-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 p-4 transition-colors duration-150 hover:border-brass-hairline-strong hover:bg-enamel-800"
          >
            <Coins size={24} aria-hidden className="shrink-0 text-brass-300" />
            <span>
              <span className="tnums block font-fraunces text-[24px] font-semibold leading-none text-paper-100">{wallet.balance}</span>
              <span className="micro-label mt-1 block text-iron-400">{t('platform.comptoir.deskTile')}</span>
            </span>
          </Link>
        </motion.div>
      </div>

      <motion.aside
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.15, once: true }}
        transition={{ duration: 0.24, ease, delay: 0.08 }}
        className="rounded-xl border border-brass-hairline bg-enamel-850 p-5 min-[1100px]:col-span-4"
      >
        <h2 className="title-card">{t('platform.profile.ranksTitle')}</h2>
        <div className="mb-4 mt-3 h-px bg-brass-hairline" />
        <ul className="grid gap-1.5">
          {TIERS.map((tier, i) => {
            const current = tier === demoRating.tier;
            return (
              <motion.li
                key={tier}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, ease, delay: i * 0.04 }}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', current ? 'border-brass-hairline-strong bg-enamel-800' : 'border-transparent')}
              >
                <img src={`/rank-${tier}.svg`} alt="" width={24} height={24} className="h-6 w-6" />
                <span className={cn('font-ui text-[13px] font-semibold', current ? 'text-paper-100' : 'text-iron-400')}>{t(`platform.rank.${tier}`)}</span>
                {current && <span className="micro-label ml-auto text-brass-300">{t('platform.profile.season', { lp: demoRating.lp })}</span>}
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-4 border-t border-[rgb(var(--paper-100)/.07)] pt-3 font-ui text-[12px] leading-snug text-iron-400">{t('platform.profile.ranksFoot')}</p>
      </motion.aside>
    </div>
  );
}

/* ------------------------------ Réglages : identité ------------------------------ */

function IdentitySettings() {
  const t = useT();
  const session = useSession();
  const [motto, setMotto] = useState<string | null>(null);
  const [color, setColor] = useState<PlayerColor | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;

  const mottoValue = motto ?? session.motto;
  const colorValue = color === undefined ? session.favoriteColor : color;
  const dirty = mottoValue !== session.motto || colorValue !== session.favoriteColor;

  const save = async () => {
    setError(null);
    try {
      await updateProfile({ motto: mottoValue, favoriteColor: colorValue });
      setMotto(null);
      setColor(undefined);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };

  return (
    <Panel title={t('platform.profile.settings.identity')}>
      <div className="grid gap-5">
        <Field id="profile-motto" label={t('platform.profile.settings.motto')} hint={t('platform.profile.settings.mottoHint')}>
          <input id="profile-motto" value={mottoValue} onChange={(e) => setMotto(e.target.value)} maxLength={80} placeholder={t('platform.profile.settings.mottoPlaceholder')} className={inputClass} />
        </Field>
        <div>
          <p className="micro-label text-brass-300/90">{t('platform.profile.settings.color')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={colorValue === c.id}
                onClick={() => setColor(colorValue === c.id ? null : c.id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors duration-150',
                  colorValue === c.id ? 'border-brass-500 bg-brass-500/10' : 'border-[rgb(var(--paper-100)/.14)] hover:border-brass-hairline-strong',
                )}
              >
                <PlayerToken color={c.id} size={22} />
                <span className="font-ui text-[12px] font-semibold text-paper-100">{t(`setup.colors.${c.id}`)}</span>
              </button>
            ))}
            <button type="button" onClick={() => setColor(null)} className={cn('micro-label transition-colors duration-150', colorValue === null ? 'text-brass-300' : 'text-iron-400 hover:text-paper-100')}>
              {t('platform.profile.settings.none')}
            </button>
          </div>
          <p className="mt-1.5 font-ui text-[12px] text-iron-400">{t('platform.profile.settings.colorHint')}</p>
        </div>
        <Refusal text={error} />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            {t('platform.profile.settings.save')}
          </Button>
          {saved && <span className="micro-label text-bottle-400">{t('platform.profile.settings.saved')}</span>}
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------- Réglages : compte & sécurité --------------------------- */

function SecuritySettings() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;

  const change = async () => {
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setChanged(true);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };

  return (
    <Panel title={t('platform.profile.settings.security')}>
      <div className="grid gap-5">
        <div>
          <p className="micro-label text-brass-300/90">{t('platform.profile.settings.email')}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className="data-text text-[13px] text-paper-100">{session.email ?? '—'}</span>
            <span className={cn('micro-label inline-flex items-center gap-1 rounded px-1.5 py-0.5', session.verified ? 'bg-bottle-700/60 text-bottle-400' : 'bg-rust-700/50 text-rust-400')}>
              {session.verified ? <BadgeCheck size={12} aria-hidden /> : <MailWarning size={12} aria-hidden />}
              {session.verified ? t('platform.profile.settings.verified') : t('platform.profile.settings.unverified')}
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pw-current" label={t('platform.profile.settings.current')}>
            <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} />
          </Field>
          <Field id="pw-next" label={t('platform.profile.settings.next')} hint={t('platform.profile.settings.passwordHint')}>
            <input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} />
          </Field>
        </div>
        <Refusal text={error} />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={change} disabled={!current || next.length < 8}>
            {t('platform.profile.settings.change')}
          </Button>
          {changed && <span className="micro-label text-bottle-400">{t('platform.profile.settings.changed')}</span>}
        </div>

        <div className="border-t border-[rgb(var(--paper-100)/.07)] pt-5">
          <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.profile.settings.signOutCopy')}</p>
          <Button
            variant="danger-ghost"
            className="mt-3"
            icon={<LogOut size={16} aria-hidden />}
            onClick={() => {
              signOut();
              navigate('/');
            }}
          >
            {t('platform.profile.settings.signOut')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function Profile() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();

  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
    else if (stranger) navigate('/account', { replace: true });
  }, [stranger, navigate]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-10 sm:px-8">
      <MemberCard />
      <div className="mt-4">
        <VerifyBanner />
      </div>
      <StatsAndRanks />

      <section className="mt-6">
        <h2 className="h2-section mb-4">{t('platform.profile.historyTitle')}</h2>
        <HistoryLedger history={desk?.history ?? []} me={session.id} />
      </section>

      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.24, ease }} className="mt-6 grid content-start gap-6 min-[900px]:grid-cols-2">
        <IdentitySettings />
        <SecuritySettings />
      </motion.div>
    </div>
  );
}
