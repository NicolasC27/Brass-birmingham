import { Link, Outlet } from 'react-router';
import { Moon, Sun } from 'lucide-react';
import { LANGS, setLang, useLang, useT } from '@/i18n';
import { toggleTheme, useTheme } from '@/platform/theme';
import { usePageTitle } from '@/platform/title';
import { cn } from '@/lib/utils';
import { PREVIEW } from './office';

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
  const link = 'gz-hit micro-label text-iron-400 transition-colors hover:text-paper-100';
  return (
    <div className="platform-root relative flex min-h-[100dvh] flex-col bg-lacquer-900 font-ui text-paper-100">
      <div aria-hidden className="tex-lacquer pointer-events-none fixed inset-0 opacity-60" />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-enamel-850 focus:px-3 focus:py-2 focus:font-ui focus:text-[12px] focus:uppercase focus:tracking-[0.14em] focus:text-paper-100">
        {t('platform.a11y.skip')}
      </a>
      <header className="relative">
        <div className="gz-measure flex items-center justify-between gap-4 pt-3">
          <span className="micro-label text-iron-400">{t('landing.ear')}</span>
          <span className="flex items-center gap-2">
            <Languages />
            <button type="button" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'platform.theme.toLight' : 'platform.theme.toDark')} className="grid h-7 w-7 place-items-center text-paper-300 transition-colors hover:text-paper-100">
              <Icon size={13} aria-hidden />
            </button>
          </span>
        </div>
        <div className="gz-measure flex flex-col items-center pb-4 pt-5 text-center min-[900px]:pb-5 min-[900px]:pt-7">
          <Link to={PREVIEW} aria-label="Blackrail" className="flex items-center gap-5 min-[900px]:gap-8">
            <img src="/logo-blackrail.svg" alt="" className="hidden h-6 w-6 opacity-80 min-[600px]:block" />
            <span className="gz-wordmark">Blackrail</span>
            <img src="/logo-blackrail.svg" alt="" className="hidden h-6 w-6 opacity-80 min-[600px]:block" />
          </Link>
          <p className="mt-3 font-fell text-[13px] tracking-[0.14em] text-paper-300 min-[900px]:text-[14px]">{t('platform.masthead.motto')}</p>
        </div>
        <div className="gz-measure">
          <div className="gz-rule-double" aria-hidden />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="relative flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="relative mt-10 pb-8 pt-6">
        <div className="gz-measure">
          <div className="gz-rule-double" aria-hidden />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="micro-label text-iron-400">{t('platform.footer.copyright')}</span>
            <Link to="/legal" className={link}>
              {t('platform.footer.legal')}
            </Link>
            <Link to="/legal#privacy" className={link}>
              {t('platform.footer.privacy')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
