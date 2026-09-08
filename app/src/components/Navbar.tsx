import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChevronDown, LogOut, MailWarning, ScrollText, UserRound } from 'lucide-react';
import PlayerToken from '@/components/setup/PlayerToken';
import { isOnline } from '@/online/lobby';
import { signOut, useLine, useSession } from '@/online/session';
import { cn } from '@/lib/utils';
import { useLang, useT, setLang } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The top bar: the wordmark, three doors, the language, and who you   */
/* are. Transparent over the title screen, coal everywhere else.       */
/* ------------------------------------------------------------------ */

const link = ({ isActive }: { isActive: boolean }) => cn('font-sans text-[11.5px] font-semibold uppercase tracking-[0.14em] transition-colors', isActive ? 'text-brass-400' : 'text-cream-100/70 hover:text-brass-500');

function AccountMenu() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const line = useLine();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!session) {
    return (
      <Link to="/account" className="btn-ledger !min-h-[32px] !px-3.5 !py-1 !text-[10.5px]">
        {t('site.nav.signIn')}
      </Link>
    );
  }
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('site.nav.menuAria')}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-brass-700/60 bg-coal-900/70 py-1 pl-1 pr-2.5 transition-colors hover:border-brass-400"
      >
        <span className="relative">
          <PlayerToken color={session.favoriteColor ?? 'brass'} size={22} />
          <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-coal-900', line === 'online' ? 'bg-bottle-600' : 'bg-rust-500')} title={t(`site.nav.line.${line}`)} />
        </span>
        <span className="max-w-[120px] truncate font-sans text-[11.5px] font-semibold text-cream-100">{session.name}</span>
        {!session.verified && <MailWarning className="h-3.5 w-3.5 text-rust-500 brightness-150" aria-label={t('site.nav.unverified')} />}
        <ChevronDown className={cn('h-3 w-3 text-cream-100/60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="plate absolute right-0 top-[calc(100%+6px)] z-[60] w-52 overflow-hidden py-1">
          <Link role="menuitem" to="/desk" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 font-sans text-[12px] text-cream-100/85 hover:bg-coal-800 hover:text-brass-400">
            <ScrollText className="h-4 w-4" /> {t('site.nav.desk')}
          </Link>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 font-sans text-[12px] text-cream-100/85 hover:bg-coal-800 hover:text-brass-400">
            <UserRound className="h-4 w-4" /> {t('site.nav.profile')}
          </Link>
          <div className="mx-3 my-1 h-px bg-brass-700/30" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
              navigate('/');
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left font-sans text-[12px] text-cream-100/70 hover:bg-coal-800 hover:text-rust-500"
          >
            <LogOut className="h-4 w-4" /> {t('site.nav.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const t = useT();
  const lang = useLang();
  const { pathname } = useLocation();
  const solid = scrolled || pathname !== '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('fixed top-0 z-50 h-14 w-full transition-colors duration-300', solid ? 'border-b border-brass-700/50 bg-coal-900/95 backdrop-blur-sm' : 'border-b border-transparent bg-transparent')}>
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="" className="h-7 w-7 transition-transform duration-500 group-hover:rotate-45" />
          <span className="engraved-brass font-display text-lg font-black tracking-wide text-brass-500">BRASSWORKS</span>
        </Link>

        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
          <NavLink to={isOnline ? '/desk' : '/online'} className={link}>
            {t('site.nav.desk')}
          </NavLink>
          {!isOnline && (
            <NavLink to="/setup" className={link}>
              {t('site.nav.play')}
            </NavLink>
          )}
          <NavLink to="/rules" className={link}>
            {t('site.nav.rules')}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <div role="group" aria-label={t('common.chrome.language')} className="flex items-center overflow-hidden rounded-md border border-brass-700/60">
            {(['fr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={cn('px-2 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] transition-colors', lang === l ? 'bg-brass-400 text-ink-900' : 'text-cream-100/60 hover:text-brass-400')}
              >
                {l}
              </button>
            ))}
          </div>
          {isOnline && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
