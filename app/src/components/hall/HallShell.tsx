import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { BarChart3, Play, Radio, ShoppingBag, UserRound } from 'lucide-react';
import { isOnline } from '@/online/lobby';
import { signOut, useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { tierOf } from '@/online/table';
import { SITE_THEMES, setSiteTheme, useSiteTheme } from '@/site/theme';
import { setLang, useLang, useT } from '@/i18n';
import { daysUntil, portraitFor } from '@/components/hall/bits';

/* ------------------------------------------------------------------ */
/* The hall: the site as a game client. The telegraph tape across the  */
/* top says what is being played; the rail on the left opens the five  */
/* rooms; the stage shows one of them. Signed-in players only — a      */
/* stranger is sent to the office door, the code kept if any.          */
/* ------------------------------------------------------------------ */

const NAV = [
  { to: '/play', key: 'play', Icon: Play },
  { to: '/tables', key: 'tables', Icon: Radio },
  { to: '/ranking', key: 'ranking', Icon: BarChart3 },
  { to: '/counter', key: 'counter', Icon: ShoppingBag },
  { to: '/record', key: 'record', Icon: UserRound },
] as const;

function Tape() {
  const t = useT();
  const desk = useDesk();
  const tables = useTables();
  const line = useLine();
  const playing = (tables ?? []).filter((x) => x.status === 'playing');
  const lines: { key: string; node: React.ReactNode }[] = [];
  for (const x of playing.slice(0, 6)) {
    const cur = x.current !== undefined ? x.seats[x.current] : undefined;
    lines.push({
      key: x.code,
      node: (
        <>
          <b>{x.code}</b> {x.name} · {x.era ? t(`hall.play.era.${x.era}`).toLowerCase() : ''} {x.round ? `· ${x.round}` : ''} {cur ? <>· <i>{cur.kind === 'bot' ? t('hall.tape.thinks', { name: cur.name }) : t('hall.tape.plays', { name: cur.name })}</i></> : null}
        </>
      ),
    });
  }
  for (const x of (tables ?? []).filter((y) => y.status === 'open').slice(0, 3)) lines.push({ key: `o-${x.code}`, node: <><b>{x.code}</b> {x.name} · {t('hall.tape.open', { n: 4 - x.seats.length })}</> });
  if (desk?.hall.queued) lines.push({ key: 'q', node: <b>{t('hall.tape.queue', { n: desk.hall.queued })}</b> });
  if (desk?.season) lines.push({ key: 's', node: <>{t('hall.tape.season', { season: desk.season.name, days: daysUntil(desk.season.endsAt) })}</> });
  if (desk?.rating) lines.push({ key: 'c', node: <>{t('hall.tape.cote', { name: '·', rating: desk.rating.rating })}</> });
  const quiet = lines.length === 0;
  const run = quiet ? [{ key: 'quiet', node: <>{line === 'online' ? t('hall.tape.quiet') : t('hall.tables.offline')}</> }] : lines;
  return (
    <div className="hall-tape" aria-hidden>
      <div className="hall-tape-label">
        <span className={`hall-dot${line === 'online' ? '' : ' off'}`} /> {t('hall.tape.live')}
      </div>
      <div className="hall-tape-run">
        <div className="hall-tape-in">
          {[...run, ...run].map((l, i) => (
            <span key={`${l.key}-${i}`}>{l.node}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HallShell() {
  const t = useT();
  const lang = useLang();
  const theme = useSiteTheme();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();
  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
    else if (stranger) navigate('/account', { replace: true });
  }, [stranger, navigate]);
  const rating = desk?.rating ?? null;
  const tier = rating ? t(`hall.tier.${rating.tier}`) : t(`hall.tier.${tierOf(1200)}`);
  return (
    <div className="hall">
      <Tape />
      <div className="hall-frame">
        <aside className="hall-rail">
          <Link to="/" className="hall-brand">
            <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
            <span>
              <span className="name block">Brassworks</span>
              <span className="sub block">{t(`hall.nav.sub.${theme}`)}</span>
            </span>
          </Link>
          <nav className="hall-nav" aria-label={t('hall.nav.play')}>
            {NAV.map(({ to, key, Icon }) => (
              <NavLink key={key} to={to}>
                <Icon aria-hidden />
                <span>{t(`hall.nav.${key}`)}</span>
                {key === 'play' && desk && desk.tables.some((x) => x.myTurn) ? <span className="badge">{desk.tables.filter((x) => x.myTurn).length}</span> : key === 'tables' && desk ? <span className="badge">{desk.hall.playing || ''}</span> : <span />}
              </NavLink>
            ))}
          </nav>
          <div className="hall-rail-foot">
            {session && (
              <div className="hall-me">
                <img src={portraitFor(0)} alt="" />
                <span>
                  <span className="who block">{session.name}</span>
                  <span className="tier block">{rating ? `${tier} · ${rating.rating}` : t('hall.record.unranked')}</span>
                </span>
                <button type="button" onClick={() => { signOut(); navigate('/'); }} className="hall-btn" title={t('hall.nav.signOut')} aria-label={t('hall.nav.signOut')}>
                  ↦
                </button>
              </div>
            )}
            <div className="hall-rail-tools" role="group" aria-label={t('hall.nav.themeAria')}>
              {SITE_THEMES.map((th) => (
                <button key={th} type="button" aria-pressed={theme === th} onClick={() => setSiteTheme(th)}>
                  {t(`hall.nav.theme.${th}`)}
                </button>
              ))}
              <button type="button" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>{lang === 'fr' ? 'EN' : 'FR'}</button>
              <Link to="/rules">{t('hall.nav.rules')}</Link>
            </div>
          </div>
        </aside>
        <main className="hall-stage">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
