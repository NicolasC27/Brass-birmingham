import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The running head — the name a page carries in the tab, the history  */
/* and the bookmarks, where ten identical lines are ten lines nobody   */
/* can tell apart. One entry per address, taken from the words the     */
/* page already prints; an address nobody listed runs under the        */
/* paper's name alone.                                                 */
/* ------------------------------------------------------------------ */

const PAPER = 'Blackrail';

/** address → the key the page is already titled by */
const HEADS = new Map<string, string>([
  ['/setup', 'platform.setup.title'],
  ['/rules', 'platform.nav.rules'],
  ['/cours', 'platform.cours.title'],
  ['/almanach', 'platform.almanach.title'],
  ['/defis', 'platform.defis.title'],
  ['/tableau', 'platform.tableau.title'],
  ['/glossaire', 'platform.glossary.title'],
  ['/services', 'platform.seasons.title'],
  ['/legal', 'platform.legal.title'],
  ['/results', 'results.empty.eyebrow'],
  ['/replay', 'results.page.replay'],
  ['/review', 'results.review.title'],
  ['/report', 'platform.desk.report.title'],
  ['/online', 'platform.play.title'],
  ['/account', 'platform.footer.account'],
  ['/desk', 'platform.nav.desk'],
  ['/office', 'platform.nav.desk'],
  ['/profile', 'platform.nav.profile'],
  ['/comptoir', 'platform.comptoir.title'],
  ['/classement', 'platform.ranking.title'],
]);

/** the addresses that carry something after them — a table's code, a token */
const TRAILS: ReadonlyArray<readonly [string, string]> = [
  ['/online/', 'platform.lobby.eyebrow'],
  ['/account/', 'platform.footer.account'],
];

/** the key a path is headed by, none when the address is not listed */
export function headKey(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const exact = HEADS.get(path);
  if (exact) return exact;
  for (const [trail, key] of TRAILS) if (path.startsWith(trail)) return key;
  return null;
}

/** the shell writes the running head on every arrival */
export function usePageTitle(): void {
  const t = useT();
  const { pathname } = useLocation();
  useEffect(() => {
    const key = headKey(pathname);
    const head = key ? t(key) : '';
    document.title = head ? `${head} · ${PAPER}` : PAPER;
  }, [pathname, t]);
}
