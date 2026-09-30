import { Bell, Briefcase, Coins, LayoutGrid, Moon, Play, Plus, Sun, User } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { LANGS, setLang, useLang, useT } from '@/i18n';
import { useDesk, useSession } from '@/online/session';
import { rankOf } from '@/platform/rank';
import { useWallet } from '@/platform/wallet';
import { toggleTheme, useTheme } from '@/platform/theme';
import Button from './Button';
import RankBadge from './RankBadge';
import { usePresence } from './presence';

/** the club's Discord, when the build names one (VITE_DISCORD_URL); the header shows it */
const DISCORD_URL = String(import.meta.env.VITE_DISCORD_URL ?? '').trim();

/* ------------------------------------------------------------------ */
/* PlatformShell — variante « platform » du shell (design.md §6.2).    */
/* TopBar 56px + StatusStrip 32px (≥900px) + contenu + footer 48px +   */
/* BottomTabBar mobile (<900px). Les routes /game gardent l'ancien     */
/* shell (voir Layout.tsx) — rien ici ne s'y monte.                    */
/* ------------------------------------------------------------------ */

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative whitespace-nowrap font-ui text-[11px] font-medium uppercase tracking-[0.16em] pb-1 transition-colors duration-150',
    isActive
      ? 'text-paper-100 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-brass-300'
      : 'text-iron-400 hover:text-paper-100',
  );

/* ------------------------------ TopBar ------------------------------ */

function PlayerToken() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const wallet = useWallet();
  /* the badge reads the office's cote: placements until the five are played */
  const rank = rankOf(desk?.rating);

  if (!session) {
    return (
      <Button variant="ghost" className="!h-8" to="/account">
        {t('platform.action.signIn')}
      </Button>
    );
  }
  return (
    <Link
      to="/profile"
      className="flex h-8 items-center gap-2 rounded-full border border-brass-hairline-strong bg-enamel-850 py-0.5 pl-0.5 pr-3 transition-colors duration-150 hover:border-brass-300"
    >
      <img src={`/${wallet.equipped.avatar}.svg`} alt="" className="h-[26px] w-[26px] rounded-full" />
      <span className="max-w-[110px] truncate font-ui text-[13px] font-medium text-paper-100">{session.name}</span>
      <RankBadge tier={rank.tier} division={rank.division} size={16} compact />
    </Link>
  );
}

/* puce bourse (comptoir) — les guinées de la bourse tenue par l'office, → /comptoir.
   Sans compte il n'y a pas de bourse : la puce ne s'affiche pas. */
function WalletChip() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  if (!session || !desk) return null;
  const guineas = desk.purse.guineas;
  return (
    <Link
      to="/comptoir"
      aria-label={t('platform.comptoir.walletAria', { count: guineas })}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-brass-hairline-strong bg-enamel-850 px-3 transition-colors duration-150 hover:border-brass-300"
    >
      <Coins size={14} aria-hidden className="text-brass-300" />
      <span className="data-text tnums text-[12px] text-paper-100">{guineas}</span>
    </Link>
  );
}

function InvitationBell() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const count = session ? (desk?.invitations.length ?? 0) : 0;

  return (
    <Link
      to="/desk"
      aria-label={t('platform.nav.invitations')}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-brass-hairline-strong text-paper-300 transition-colors duration-150 hover:bg-enamel-800 hover:text-paper-100"
    >
      <Bell size={15} aria-hidden />
      {count > 0 && (
        <span className="animate-pulse-signal absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-400 px-1 font-ui text-[10px] font-semibold text-[rgb(var(--ink-on-signal))] tnums">
          {count}
        </span>
      )}
    </Link>
  );
}

/* Bascule thème clair/sombre « registre de jour » (src/platform/theme.ts) */
function ThemeToggle() {
  const t = useT();
  const theme = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t(theme === 'dark' ? 'platform.theme.toLight' : 'platform.theme.toDark')}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-brass-hairline-strong text-paper-300 transition-colors duration-150 hover:bg-enamel-800 hover:text-paper-100"
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}

function TopBar() {
  const t = useT();
  return (
    <header className="sticky top-0 z-50 h-[52px] border-b border-brass-hairline-strong bg-[rgb(var(--lacquer-950)/.88)] backdrop-blur-[12px]">
      <div className="mx-auto flex h-full max-w-[1240px] items-center gap-4 px-4 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Blackrail">
          <img src="/logo-blackrail.svg" alt="" className="h-5 w-5" />
          <span className="font-fraunces text-[14px] font-medium uppercase tracking-[0.22em] text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
            Blackrail
          </span>
        </Link>

        {/* in the flow between the wordmark and the chips, centred in what is left:
            it can never slide under the chips, whatever the viewport */}
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-center gap-5 min-[900px]:flex min-[1200px]:gap-7">
          <NavLink to="/online" className={navLink}>
            {t('platform.nav.play')}
          </NavLink>
          <NavLink to="/comptoir" className={navLink}>
            {t('platform.nav.comptoir')}
          </NavLink>
          <NavLink to="/online#tables" className={() => navLink({ isActive: false })}>
            {t('platform.nav.tables')}
          </NavLink>
          <NavLink to="/classement" className={navLink}>
            {t('platform.nav.ranking')}
          </NavLink>
          {DISCORD_URL && (
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={navLink({ isActive: false })}>
              {t('platform.nav.discord')}
            </a>
          )}
          <NavLink to="/desk" className={navLink}>
            {t('platform.nav.desk')}
          </NavLink>
          <NavLink to="/rules" className={navLink}>
            {t('platform.nav.rules')}
          </NavLink>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <WalletChip />
          <InvitationBell />
          <ThemeToggle />
          <span aria-hidden className="hidden h-5 w-px bg-brass-hairline-strong min-[900px]:block" />
          <PlayerToken />
          <Button variant="primary" className="!h-8 hidden min-[1100px]:inline-flex" to="/setup" icon={<Plus size={16} aria-hidden />}>
            {t('platform.nav.createTable')}
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------- StatusStrip ---------------------------- */

function StatusStrip() {
  const t = useT();
  const p = usePresence();

  return (
    <div className="hidden h-7 border-b border-brass-hairline bg-lacquer-950 min-[900px]:block">
      <div className="mx-auto flex h-full max-w-[1240px] items-center gap-2 px-8 font-mono text-[11px] text-iron-400">
        {!p.online ? (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-iron-600" aria-hidden />
            {t('platform.status.localMode')}
          </span>
        ) : (
          <>
            <Link to="/online" className="flex items-center gap-2 transition-colors hover:text-paper-100">
              <span className="animate-presence-dot h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
              <span className="tnums">{t('platform.status.playersOnline', { count: p.playersOnline })}</span>
            </Link>
            <span aria-hidden>·</span>
            <Link to="/online#tables" className="transition-colors hover:text-paper-100 tnums">
              {t('platform.status.playing', { count: p.playing })}
            </Link>
            <span aria-hidden>·</span>
            <Link to="/online#file-normale" className="transition-colors hover:text-paper-100 tnums">
              {t('platform.status.normalQueue', { count: p.normalQueue.count, minutes: p.normalQueue.estimateMin })}
            </Link>
            <span aria-hidden>·</span>
            <Link to="/online#file-classee" className="transition-colors hover:text-paper-100 tnums">
              {t('platform.status.rankedQueue', { count: p.rankedQueue.count })}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Footer compact 48px ------------------------- */

function CompactFooter() {
  const t = useT();
  const lang = useLang();
  return (
    <footer className="flex h-11 items-center border-t border-brass-hairline bg-lacquer-950">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-5 px-4 sm:px-8">
        <span className="micro-label text-iron-400">{t('platform.footer.copyright')}</span>
        <Link to="/rules" className="micro-label text-iron-400 transition-colors hover:text-paper-100">
          {t('platform.footer.rules')}
        </Link>
        <Link to="/account" className="micro-label text-iron-400 transition-colors hover:text-paper-100">
          {t('platform.footer.account')}
        </Link>
        <Link to="/legal" className="micro-label text-iron-400 transition-colors hover:text-paper-100">
          {t('platform.footer.legal')}
        </Link>
        <Link to="/legal#privacy" className="micro-label text-iron-400 transition-colors hover:text-paper-100">
          {t('platform.footer.privacy')}
        </Link>
        <span className="flex-1" />
        <span role="group" aria-label={t('common.chrome.language')} className="flex items-center gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={cn('micro-label transition-colors', lang === l ? 'text-brass-300' : 'text-iron-600 hover:text-iron-400')}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </span>
        <span className="micro-label text-iron-600">{t('platform.footer.version')}</span>
      </div>
    </footer>
  );
}

/* ------------------------- BottomTabBar (mobile) ------------------------- */

function BottomTabBar() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const invites = session ? (desk?.invitations.length ?? 0) : 0;
  const { pathname } = useLocation();

  const tabs = [
    { to: '/online', label: t('platform.tabs.play'), icon: Play },
    { to: '/online#tables', label: t('platform.tabs.tables'), icon: LayoutGrid },
    { to: '/desk', label: t('platform.tabs.desk'), icon: Briefcase, badge: invites },
    { to: '/profile', label: t('platform.tabs.profile'), icon: User },
  ];

  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-50 flex h-[60px] border-t border-brass-hairline bg-[rgb(var(--lacquer-950)/.92)] backdrop-blur-[12px] min-[900px]:hidden">
      {tabs.map(({ to, label, icon: Icon, badge }) => {
        const active = pathname === to.split('#')[0];
        return (
          <Link key={label} to={to} className="relative flex flex-1 flex-col items-center justify-center gap-0.5" aria-current={active ? 'page' : undefined}>
            {active && <span className="absolute top-0 h-0.5 w-8 bg-brass-500" aria-hidden />}
            <span className="relative">
              <Icon size={22} aria-hidden className={active ? 'text-brass-300' : 'text-iron-400'} />
              {!!badge && <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-signal-400" aria-hidden />}
            </span>
            <span className={cn('font-ui text-[10px] font-semibold', active ? 'text-paper-100' : 'text-iron-400')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------- Shell -------------------------------- */

export default function PlatformShell() {
  return (
    <div className="platform-root relative flex min-h-[100dvh] flex-col bg-lacquer-900 font-ui text-paper-100">
      <div aria-hidden className="tex-lacquer pointer-events-none fixed inset-0 opacity-60" />
      <TopBar />
      <StatusStrip />
      <main className="relative flex-1 pb-[60px] min-[900px]:pb-0">
        <Outlet />
      </main>
      <CompactFooter />
      <BottomTabBar />
    </div>
  );
}
