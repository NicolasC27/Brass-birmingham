import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Moon, Sun, Ticket } from 'lucide-react';
import { LANGS, setLang, useLang, useT } from '@/i18n';
import { toggleTheme, useTheme } from '@/platform/theme';
import { usePageTitle } from '@/platform/title';
import { cn } from '@/lib/utils';
import { PREVIEW, toTheTicket } from './office';
import { DISCORD_URL, DiscordMark } from './Discord';

/* ------------------------------------------------------------------ */
/* The preview's own sheet: the journal's title and motto, no rail —   */
/* none of its rooms is open yet — and a colophon with the law, the     */
/* policy and the four languages.                                      */
/* ------------------------------------------------------------------ */

function Languages() {
  const t = useT();
  const lang = useLang();
  return (
    <span role="group" aria-label={t('common.chrome.language')} className="flex items-center gap-1">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={cn('micro-label px-2 py-1.5 transition-colors', lang === l ? 'text-brass-300' : 'text-paper-300 hover:text-paper-100')}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}

export default function LandingShell() {
  const t = useT();
  const theme = useTheme();
  usePageTitle();
  const Icon = theme === 'dark' ? Sun : Moon;
  const { pathname } = useLocation();
  /* the front page keeps the title the search engines read, in the reader's language */
  useEffect(() => {
    if (pathname === PREVIEW) document.title = t('landing.pageTitle');
  }, [pathname, t]);
  /* once the hero and its ticket have scrolled away, the bar carries a small one */
  const [far, setFar] = useState(false);
  useEffect(() => {
    const look = () => setFar(window.scrollY > 700);
    window.addEventListener('scroll', look, { passive: true });
    return () => window.removeEventListener('scroll', look);
  }, []);
  const link = 'gz-hit micro-label text-iron-400 transition-colors hover:text-paper-100';
  return (
    <div className="platform-root relative flex min-h-[100dvh] flex-col bg-lacquer-900 font-ui text-paper-100">
      <div aria-hidden className="tex-lacquer pointer-events-none fixed inset-0 opacity-60" />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-enamel-850 focus:px-3 focus:py-2 focus:font-ui focus:text-[12px] focus:uppercase focus:tracking-[0.14em] focus:text-paper-100">
        {t('platform.a11y.skip')}
      </a>
      {/* a thin bar: the name, the languages and the lamp — the page itself sells */}
      <header className="sticky top-0 z-40 border-b border-[var(--gz-ink-soft)] bg-[rgb(var(--lacquer-900)/.94)] backdrop-blur-[10px]">
        <div className="gz-measure flex items-center justify-between gap-4 py-3">
          <Link to={PREVIEW} aria-label="Blackrail" className="flex items-center gap-2.5">
            <img src="/logo-blackrail.svg" alt="" className="h-5 w-5 opacity-80" />
            <span className="font-fraunces text-[20px] tracking-[0.12em] text-paper-100">Blackrail</span>
          </Link>
          <span className="flex items-center gap-2">
            {far && pathname === PREVIEW && (
              <button type="button" onClick={toTheTicket} className="gz-ticket gz-ticket-brass gz-ticket-sm mr-2">
                <Ticket aria-hidden />
                {t('landing.bar')}
              </button>
            )}
            {DISCORD_URL && (
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="micro-label mr-1 flex items-center gap-1.5 px-2 py-1.5 text-paper-300 transition-colors hover:text-paper-100">
                <DiscordMark className="h-3.5 w-3.5" />
                <span className="hidden min-[700px]:inline">Discord</span>
              </a>
            )}
            <Languages />
            <button type="button" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'platform.theme.toLight' : 'platform.theme.toDark')} className="grid h-7 w-7 place-items-center text-paper-300 transition-colors hover:text-paper-100">
              <Icon size={13} aria-hidden />
            </button>
          </span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="relative flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="relative pb-8 pt-6">
        <div className="gz-measure">
          <div className="gz-rule-double" aria-hidden />
          <p className="mt-4 text-center font-fell text-[13px] tracking-[0.14em] text-paper-300">{t('landing.motto')}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="micro-label text-iron-400">{t('platform.footer.copyright')}</span>
            <Link to="/legal" className={link}>
              {t('platform.footer.legal')}
            </Link>
            <Link to="/legal#privacy" className={link}>
              {t('platform.footer.privacy')}
            </Link>
            {DISCORD_URL && (
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={link}>
                Discord
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
