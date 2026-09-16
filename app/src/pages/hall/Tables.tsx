import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { eraRounds } from '@/game/data';
import { lobby } from '@/online/lobby';
import { deskErrorKey } from '@/online/errors';
import { useDesk, useLine, useSession, useTables } from '@/online/session';
import type { PublicTable } from '@/online/table';
import { useSiteTheme } from '@/site/theme';
import { useT } from '@/i18n';
import { Flap, Seats } from '@/components/hall/pieces';

/* ------------------------------------------------------------------ */
/* En cours — the register of every table in the house: the ones being */
/* played, to watch or to get back to, and the open ones, to join.     */
/* ------------------------------------------------------------------ */

type Filter = 'all' | 'friends' | 'ranked' | 'open';

export default function Tables() {
  const t = useT();
  const theme = useSiteTheme();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const tables = useTables();
  const line = useLine();
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  const mine = new Map((desk?.tables ?? []).map((x) => [x.code, x]));
  const friendNames = new Set((desk?.friends ?? []).filter((f) => f.status === 'friends').map((f) => f.account.name));
  const all = tables ?? [];
  const shown = all.filter((x) => (filter === 'friends' ? x.seats.some((s) => friendNames.has(s.name)) : filter === 'ranked' ? x.ranked : filter === 'open' ? x.status === 'open' : true));
  const counts: Record<Filter, number> = { all: all.length, friends: all.filter((x) => x.seats.some((s) => friendNames.has(s.name))).length, ranked: all.filter((x) => x.ranked).length, open: all.filter((x) => x.status === 'open').length };
  const join = async (code: string) => {
    setError(null);
    try {
      const table = await lobby.join(code, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      setError(t(deskErrorKey(e)));
    }
  };
  const action = (x: PublicTable) => {
    const me = mine.get(x.code);
    if (me) {
      if (x.status === 'open') return <Link to={`/online/${x.code}`} className="hall-btn">{t('hall.play.enterRoom')}</Link>;
      return (
        <Link to={`/game/${x.code}`} className={`hall-btn${me.myTurn ? ' go' : ''}`}>
          {me.myTurn ? t('hall.tables.play') : t('hall.tables.resume')}
        </Link>
      );
    }
    if (x.status === 'open')
      return (
        <button type="button" className="hall-btn go" disabled={x.seats.length >= 4 || x.ranked} onClick={() => join(x.code)}>
          {t('hall.tables.join')}
        </button>
      );
    return (
      <Link to={`/game/${x.code}`} className="hall-btn">
        {t('hall.tables.watch')}
      </Link>
    );
  };
  return (
    <>
      <div className="hall-head">
        <h1>{t(theme === 'cercle' ? 'hall.tables.titleCercle' : 'hall.tables.title')}</h1>
        <div role="group" aria-label={t('hall.tables.filters.all')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'friends', 'ranked', 'open'] as Filter[]).map((f) => (
            <button key={f} type="button" className="hall-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`hall.tables.filters.${f}`)} · {counts[f]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="hall-alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <div className="hall-board" aria-label={t('hall.tables.title')}>
        <div className="hd">
          <span>{t('hall.tables.cols.code')}</span>
          <span>{t('hall.tables.cols.table')}</span>
          <span>{t('hall.tables.cols.era')}</span>
          <span>{t('hall.tables.cols.seats')}</span>
          <span>{t('hall.tables.cols.watchers')}</span>
          <span />
        </div>
        {shown.length === 0 ? (
          <p className="empty">{tables === null && line !== 'online' ? t('hall.tables.offline') : t('hall.tables.none')}</p>
        ) : (
          shown.map((x, i) => {
            const cur = x.current !== undefined ? x.seats[x.current] : undefined;
            const total = eraRounds(x.seats.length);
            const done = x.status === 'playing' ? ((x.era === 'rail' ? total : 0) + (x.round ?? 0)) / (2 * total) : 0;
            return (
              <div key={x.code} className={`ln${x.ranked ? ' ranked' : ''}`}>
                <Flap code={x.code} offset={i * 4} />
                <div className="name" data-ranked={t('hall.tables.ranked')}>
                  {x.name}
                  <small>{x.status === 'open' ? t('hall.tables.openSeats', { n: 4 - x.seats.length, host: x.hostName }) : cur ? (cur.kind === 'bot' ? t('hall.tables.thinks', { name: cur.name }) : t('hall.tables.plays', { name: cur.name })) : ''}</small>
                </div>
                <div className="hall-era">
                  {x.status === 'playing' ? (
                    <>
                      {t(`hall.play.era.${x.era ?? 'canal'}`).toUpperCase()} {x.round}/{total}
                      <span className="bar">
                        <i style={{ width: `${Math.round(done * 100)}%` }} />
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
                <Seats seats={x.seats} />
                <div className="hall-watch">
                  <b>{x.watchers}</b>
                  {mine.has(x.code) ? ` · ${t('hall.tables.you')}` : ''}
                </div>
                {action(x)}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
