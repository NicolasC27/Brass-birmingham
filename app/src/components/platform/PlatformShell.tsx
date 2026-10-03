import { Bell, Briefcase, Coins, LayoutGrid, Moon, Play, Plus, Sun, User } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { LANGS, localeOf, setLang, useLang, useT } from '@/i18n';
import { useDesk, useSession } from '@/online/session';
import { rankOf } from '@/platform/rank';
import { useWallet } from '@/platform/wallet';
import { toggleTheme, useTheme } from '@/platform/theme';
import Button from './Button';
import RankBadge from './RankBadge';
import { usePresence } from './presence';
import { ephemerisOf } from '@/platform/almanac';
import Arrival from './Arrival';
import { useEffect } from 'react';
import { syncPapers } from '@/platform/papers';

/** the club's Discord, when the build names one (VITE_DISCORD_URL); the rail shows it */
const DISCORD_URL = String(import.meta.env.VITE_DISCORD_URL ?? '').trim();

/* ------------------------------------------------------------------ */
/* PlatformShell — the site read as a journal of the Midlands. A       */
/* masthead (the ear line with the edition and the day's figures, the  */
/* wordmark, the motto) that scrolls away, a rail of headings that     */
/* stays at the top with the engine running under it, the page, and a */
/* colophon. Routes under /game keep the old shell (Layout.tsx).       */
/* ------------------------------------------------------------------ */

/* ------------------------------ The rail ------------------------------ */

/* The rule under the headings is a rail. Each time the page changes an
   engine crosses it, left to right, and is gone — an 1830s locomotive and
   its tender, drawn as one silhouette, smoke puffing from the chimney.
   Keyed on the path so every arrival gets its own run. */
function RailEngine() {
  const { pathname } = useLocation();
  return (
    <span key={pathname} className="rail-train" aria-hidden>
      <span className="smoke" />
      <span className="smoke" />
      <span className="smoke" />
      <svg viewBox="0 0 44 18" width="44" height="18" fill="currentColor" className="absolute bottom-px left-0">
        {/* tender */}
        <rect x="0" y="8" width="9" height="6" />
        <circle cx="2.5" cy="15.5" r="1.7" />
        <circle cx="6.5" cy="15.5" r="1.7" />
        {/* cab, boiler, chimney, steam dome */}
        <rect x="11" y="4" width="7" height="10" />
        <rect x="17" y="7" width="20" height="7" rx="3" />
        <rect x="32" y="1" width="3" height="7" />
        <rect x="25" y="4.5" width="4" height="3" rx="1.5" />
        {/* driving wheel and the small ones at the front */}
        <circle cx="16" cy="14" r="3.4" />
        <circle cx="16" cy="14" r="1.4" fill="rgb(var(--lacquer-950, 10 14 12))" />
        <circle cx="30" cy="15.2" r="2.2" />
        <circle cx="36" cy="15.2" r="2.2" />
        {/* the coupling rod */}
        <rect x="16" y="14.6" width="14" height="1" opacity="0.8" />
      </svg>
    </span>
  );
}

/* ---------------------------- The ear line ---------------------------- */

function PlayerToken() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const wallet = useWallet();
  /* the badge reads the office's cote: placements until the five are played */
  const rank = rankOf(desk?.rating);

  if (!session) {
    return (
      <Button variant="ghost" className="!h-7 px-3 !text-[10.5px]" to="/account">
        {t('platform.action.signIn')}
      </Button>
    );
  }
  return (
    <Link
      to="/profile"
      className="flex h-7 items-center gap-2 rounded-full border border-brass-hairline-strong bg-enamel-850 py-0.5 pl-0.5 pr-2.5 transition-colors duration-150 hover:border-brass-300"
    >
      <img src={`/${wallet.equipped.avatar}.svg`} alt="" className="h-[22px] w-[22px] rounded-full" />
      <span className="max-w-[110px] truncate font-ui text-[12px] font-medium text-paper-100">{session.name}</span>
      <RankBadge tier={rank.tier} division={rank.division} size={14} compact />
    </Link>
  );
}

/* the purse held by the office, → /comptoir. No account, no purse: nothing shows. */
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
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-brass-hairline-strong bg-enamel-850 px-2.5 transition-colors duration-150 hover:border-brass-300"
    >
      <Coins size={13} aria-hidden className="text-brass-300" />
      <span className="data-text tnums text-[11.5px] text-paper-100">{guineas}</span>
    </Link>
  );
}

const earButton =
  'relative flex h-7 w-7 items-center justify-center rounded-full border border-brass-hairline-strong text-paper-300 transition-colors duration-150 hover:bg-enamel-800 hover:text-paper-100';

function InvitationBell() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const count = session ? (desk?.invitations.length ?? 0) : 0;
  return (
    <Link to="/desk" aria-label={t('platform.nav.invitations')} className={earButton}>
      <Bell size={13} aria-hidden />
      {count > 0 && (
        <span className="animate-pulse-signal absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-400 px-1 font-ui text-[10px] font-semibold text-[rgb(var(--ink-on-signal))] tnums">
          {count}
        </span>
      )}
    </Link>
  );
}

/* the day and night registers (src/platform/theme.ts) */
function ThemeToggle() {
  const t = useT();
  const theme = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'platform.theme.toLight' : 'platform.theme.toDark')} className={earButton}>
      <Icon size={13} aria-hidden />
    </button>
  );
}

/* the day's figures, as a journal prints them under its title */
function Figures() {
  const t = useT();
  const p = usePresence();
  if (!p.online) {
    return (
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-iron-600" aria-hidden />
        {t('platform.status.localMode')}
      </span>
    );
  }
  return (
    <>
      <Link to="/online" className="flex items-center gap-2 transition-colors hover:text-paper-100">
        <span className="animate-presence-dot h-1.5 w-1.5 rounded-full bg-signal-400" aria-hidden />
        <span className="tnums">{t('platform.status.playersOnline', { count: p.playersOnline })}</span>
      </Link>
      <span aria-hidden>·</span>
      <Link to="/online#tables" className="tnums transition-colors hover:text-paper-100">
        {t('platform.status.playing', { count: p.playing })}
      </Link>
      <span aria-hidden className="hidden min-[1100px]:inline">·</span>
      <Link to="/online#file-normale" className="tnums hidden transition-colors hover:text-paper-100 min-[1100px]:inline">
        {t('platform.status.normalQueue', { count: p.normalQueue.count, minutes: p.normalQueue.estimateMin })}
      </Link>
    </>
  );
}

/* ------------------------------ Masthead ------------------------------ */

function Masthead() {
  const t = useT();
  const lang = useLang();
  /* the edition is dated in the era: today's day and month, the almanac's year */
  const date = `${new Date().toLocaleDateString(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long' })} ${ephemerisOf().year}`;
  return (
    <header className="relative border-b border-[var(--gz-ink-faint)]">
      {/* the ear line: the edition on the left, the figures, the tools on the right */}
      <div className="border-b border-[var(--gz-ink-faint)]">
        <div className="mx-auto flex h-9 max-w-[1240px] items-center gap-4 px-4 font-mono text-[11px] text-iron-400 sm:px-8">
          <span className="hidden whitespace-nowrap min-[900px]:inline">{t('platform.masthead.edition', { date })}</span>
          <span aria-hidden className="hidden h-3 w-px bg-[var(--gz-ink-soft)] min-[900px]:block" />
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Figures />
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2" data-print="hide">
            <WalletChip />
            <InvitationBell />
            <ThemeToggle />
            <span aria-hidden className="mx-1 hidden h-3 w-px bg-[var(--gz-ink-soft)] min-[900px]:block" />
            <PlayerToken />
            <Button variant="primary" className="!h-7 hidden px-3 !text-[10.5px] min-[1100px]:inline-flex" to="/setup" icon={<Plus size={13} aria-hidden />}>
              {t('platform.nav.createTable')}
            </Button>
          </span>
        </div>
      </div>

      {/* the title, between its marks, and the motto */}
      <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 pb-4 pt-5 text-center sm:px-8 min-[900px]:pb-5 min-[900px]:pt-7">
        <Link to="/" aria-label="Blackrail" className="flex items-center gap-5 min-[900px]:gap-8">
          <img src="/logo-blackrail.svg" alt="" className="hidden h-6 w-6 opacity-80 min-[600px]:block" />
          <span className="gz-wordmark">Blackrail</span>
          <img src="/logo-blackrail.svg" alt="" className="hidden h-6 w-6 opacity-80 min-[600px]:block" />
        </Link>
        <p className="mt-3 font-fell text-[12px] uppercase tracking-[0.22em] text-paper-300 min-[900px]:text-[13px]">{t('platform.masthead.motto')}</p>
      </div>
    </header>
  );
}

/* ------------------------------ Nav rail ------------------------------ */

const rail = ({ isActive }: { isActive: boolean }) => cn('gz-nav-link', isActive && 'is-active');

function NavRail() {
  const t = useT();
  return (
    <div className="sticky top-0 z-50 hidden overflow-x-clip bg-[rgb(var(--lacquer-900)/.94)] backdrop-blur-[10px] min-[900px]:block" data-print="hide">
      <div className="gz-rule-double mx-auto max-w-[1240px]" aria-hidden />
      <div className="mx-auto max-w-[1240px] px-8">
        <nav aria-label="Primary" className="flex items-center justify-center gap-7 min-[1100px]:gap-10">
          <NavLink to="/online" className={rail}>
            {t('platform.nav.play')}
          </NavLink>
          <NavLink to="/comptoir" className={rail}>
            {t('platform.nav.comptoir')}
          </NavLink>
          <NavLink to="/online#tables" className={() => rail({ isActive: false })}>
            {t('platform.nav.tables')}
          </NavLink>
          <NavLink to="/classement" className={rail}>
            {t('platform.nav.ranking')}
          </NavLink>
          {DISCORD_URL && (
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={rail({ isActive: false })}>
              {t('platform.nav.discord')}
            </a>
          )}
          <NavLink to="/desk" className={rail}>
            {t('platform.nav.desk')}
          </NavLink>
          <NavLink to="/rules" className={rail}>
            {t('platform.nav.rules')}
          </NavLink>
        </nav>
      </div>
      <div className="relative mx-auto max-w-[1240px]">
        <div className="h-px bg-[var(--gz-ink)]" aria-hidden />
        <RailEngine />
      </div>
    </div>
  );
}

/* ------------------------------ Colophon ------------------------------ */

function Colophon() {
  const t = useT();
  const lang = useLang();
  const link = 'micro-label text-iron-400 transition-colors hover:text-paper-100';
  return (
    <footer className="mt-10 pb-8 pt-6">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <div className="gz-rule-double" aria-hidden />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <span className="micro-label text-iron-400">{t('platform.footer.copyright')}</span>
          <Link to="/rules" className={link}>
            {t('platform.footer.rules')}
          </Link>
          <Link to="/account" className={link}>
            {t('platform.footer.account')}
          </Link>
          <Link to="/legal" className={link}>
            {t('platform.footer.legal')}
          </Link>
          <Link to="/legal#privacy" className={link}>
            {t('platform.footer.privacy')}
          </Link>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3" data-print="hide">
          <span role="group" aria-label={t('common.chrome.language')} className="flex items-center gap-2">
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
          <span aria-hidden className="h-3 w-px bg-[var(--gz-ink-soft)]" />
          <span className="micro-label text-iron-600">{t('platform.footer.version')}</span>
        </div>
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
  const t = useT();
  const session = useSession();
  /* signed in: the papers the office keeps are folded into this browser's */
  useEffect(() => {
    if (session) void syncPapers();
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="platform-root relative flex min-h-[100dvh] flex-col bg-lacquer-900 font-ui text-paper-100">
      <div aria-hidden className="tex-lacquer pointer-events-none fixed inset-0 opacity-60" />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-enamel-850 focus:px-3 focus:py-2 focus:font-ui focus:text-[12px] focus:uppercase focus:tracking-[0.14em] focus:text-paper-100">
        {t('platform.a11y.skip')}
      </a>
      <Masthead />
      <NavRail />
      <main id="main" tabIndex={-1} className="relative flex-1 pb-[60px] outline-none min-[900px]:pb-0">
        <Outlet />
      </main>
      <Colophon />
      <BottomTabBar />
      <Arrival />
    </div>
  );
}
