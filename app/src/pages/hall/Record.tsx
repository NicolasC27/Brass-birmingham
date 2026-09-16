import { useState } from 'react';
import { Link } from 'react-router';
import { INDUSTRIES, TOWN_BY_ID } from '@/game/data';
import type { IndustryType } from '@/game/types';
import { deskErrorKey } from '@/online/errors';
import { befriend, unfriend, useDesk, useSession } from '@/online/session';
import { useLang, useT } from '@/i18n';
import { TierMark } from '@/components/hall/pieces';
import { portraitFor } from '@/components/hall/bits';

/* ------------------------------------------------------------------ */
/* Ma fiche — who I am at the tables: the cote and its line over the   */
/* season, the figures, the way I play, the towns I build in, the      */
/* record against everyone met, and my friends.                        */
/* ------------------------------------------------------------------ */

function TrendChart({ values, none }: { values: number[]; none: string }) {
  if (values.length < 2)
    return (
      <p className="muted" style={{ margin: 0, fontStyle: 'italic' }}>
        {none}
      </p>
    );
  const min = Math.min(...values, 1200) - 40;
  const max = Math.max(...values, 1200) + 40;
  const x = (i: number) => 40 + (i / (values.length - 1)) * 540;
  const y = (v: number) => 130 - ((v - min) / (max - min)) * 110;
  const ticks = [min + 40, (min + max) / 2, max - 40].map((v) => Math.round(v / 50) * 50);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox="0 0 600 150" aria-label={`${values[0]} → ${values[values.length - 1]}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={40} y1={y(v)} x2={600} y2={y(v)} stroke="var(--h-paper-line)" strokeWidth={1} />
          <text x={0} y={y(v) + 4} fill="var(--h-paper-muted)" fontFamily="var(--h-mono)" fontSize={10}>
            {v}
          </text>
        </g>
      ))}
      <path d={`M${pts.split(' ').join(' L')} L${x(values.length - 1)} 150 L40 150 Z`} fill="var(--h-accent-soft)" />
      <polyline points={pts} fill="none" stroke="var(--h-accent)" strokeWidth={2} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3.5} fill="var(--h-accent)" />
    </svg>
  );
}

export default function Record() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const desk = useDesk();
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  if (!session) return null;
  const rating = desk?.rating ?? null;
  const stats = desk?.stats;
  const tally = stats?.tally ?? null;
  const n = Math.max(1, stats?.tallied || stats?.played || 1);
  const per = (v: number) => (Math.round((v / n) * 10) / 10).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB');
  const inds = tally ? (Object.keys(INDUSTRIES) as IndustryType[]).map((k) => [k, tally.industries[k] ?? 0] as const) : [];
  const most = Math.max(1, ...inds.map(([, v]) => v));
  const towns = tally
    ? Object.entries(tally.towns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const since = new Date(session.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const ask = async () => {
    if (!name.trim()) return;
    setNote(null);
    try {
      await befriend(name);
      setName('');
    } catch (e) {
      setNote(t(deskErrorKey(e)));
    }
  };
  return (
    <>
      <div className="hall-head">
        <h1>{t('hall.record.title')}</h1>
        <div className="meta">
          {t('hall.record.since', { date: since })}
          <br />
          <Link to="/profile" className="hall-btn" style={{ marginTop: 6 }}>
            {t('hall.record.settings')}
          </Link>
        </div>
      </div>
      <div className="hall-record">
        <div className="col">
          <section className="hall-sheet hall-panel">
            <div className="hall-seal" aria-hidden>
              B
            </div>
            <div className="hall-id">
              <img src={portraitFor(0)} alt="" />
              <div>
                <div className="n">{session.name}</div>
                {session.motto && <div className="m">« {session.motto} »</div>}
                <div style={{ marginTop: 8 }}>{rating ? <TierMark tier={rating.tier}>{t(`hall.tier.${rating.tier}`)}{desk?.season ? ` · ${desk.season.name}` : ''}</TierMark> : <span className="label">{t('hall.record.unranked')}</span>}</div>
              </div>
              <div className="big">
                <b className="num">{rating ? rating.rating : '—'}</b>
                <span>{t('hall.record.cote').toUpperCase()}{rating && rating.trend.length > 1 ? ` · ${rating.rating - rating.trend[rating.trend.length - 2] >= 0 ? '▲' : '▼'} ${Math.abs(rating.rating - rating.trend[rating.trend.length - 2])}` : ''}</span>
              </div>
            </div>
          </section>
          <section className="hall-sheet hall-panel hall-chart">
            <h3>{t('hall.record.trend')}</h3>
            <TrendChart values={rating?.trend ?? []} none={t('hall.record.trendNone')} />
          </section>
          <section className="hall-sheet hall-panel">
            <h3>{t('hall.record.figures')}</h3>
            <div className="hall-figures">
              <div>
                <b className="num">{stats?.played ?? 0}</b>
                <span>{t('hall.record.played')}</span>
              </div>
              <div>
                <b className="num">{stats?.won ?? 0}</b>
                <span>{t('hall.record.won')}</span>
              </div>
              <div>
                <b className="num">{stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—'}</b>
                <span>{t('hall.record.rate')}</span>
              </div>
              <div>
                <b className="num">{stats?.averageVp ?? 0}</b>
                <span>{t('hall.record.average')}</span>
              </div>
              <div>
                <b className="num">{stats?.bestVp ?? 0}</b>
                <span>{t('hall.record.best')}</span>
              </div>
              <div>
                <b className="num">{stats?.averagePlace ? `${stats.averagePlace}` : '—'}</b>
                <span>{t('hall.record.place')}</span>
              </div>
            </div>
            {!stats?.played && (
              <p className="muted" style={{ margin: 0, fontStyle: 'italic', fontSize: 13 }}>
                {t('hall.record.noFigures')}
              </p>
            )}
          </section>
          {tally && (
            <section className="hall-sheet hall-panel">
              <h3>
                {t('hall.record.manner')} <span className="label" style={{ marginLeft: 8 }}>{t('hall.record.perGame', { n: stats?.tallied || stats?.played || 0 })}</span>
              </h3>
              <div className="hall-figures">
                <div>
                  <b>{per(tally.built)}</b>
                  <span>{t('hall.record.built')}</span>
                </div>
                <div>
                  <b>{per(tally.links)}</b>
                  <span>{t('hall.record.links')}</span>
                </div>
                <div>
                  <b>{per(tally.sold)}</b>
                  <span>{t('hall.record.sold')}</span>
                </div>
                <div>
                  <b>{per(tally.loans)}</b>
                  <span>{t('hall.record.loans')}</span>
                </div>
                <div>
                  <b>{per(tally.flipped)}</b>
                  <span>{t('hall.record.flipped')}</span>
                </div>
              </div>
            </section>
          )}
        </div>
        <div className="col">
          {tally && (
            <section className="hall-sheet hall-panel">
              <h3>{t('hall.record.industries')}</h3>
              <div className="hall-bars">
                {inds.map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontFamily: 'inherit', textAlign: 'left', color: 'inherit', fontSize: 12.5 }}>{t(`game.settings.industry.${k}`)}</span>
                    <span className="b">
                      <i style={{ width: `${Math.round((v / most) * 100)}%` }} />
                    </span>
                    <span>{per(v)}</span>
                  </div>
                ))}
              </div>
              {towns.length > 0 && (
                <>
                  <span className="label">{t('hall.record.towns')}</span>
                  <ul className="hall-towns" style={{ margin: 0, padding: 0 }}>
                    {towns.map(([id, v]) => (
                      <li key={id}>
                        {TOWN_BY_ID[id]?.name ?? id} ×{v}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          <section className="hall-sheet hall-panel hall-rivals">
            <h3>{t('hall.record.rivals')}</h3>
            {!stats || stats.rivals.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontStyle: 'italic', fontSize: 13 }}>
                {t('hall.record.rivalsNone')}
              </p>
            ) : (
              stats.rivals.map((r) => (
                <div key={r.id}>
                  <span>
                    {r.name} · {r.played === 1 ? t('hall.record.games.one') : t('hall.record.games.many', { n: r.played })}
                  </span>
                  <b className={r.won > r.lost ? 'hall-gain' : r.won < r.lost ? 'hall-loss' : undefined}>
                    {r.won} – {r.lost}
                  </b>
                </div>
              ))
            )}
          </section>
          <section className="hall-sheet hall-panel">
            <h3>{t('hall.record.friends')}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={20} placeholder={t('hall.record.friendPlaceholder')} className="hall-input" />
              <button type="button" className="hall-btn go" disabled={!name.trim()} onClick={ask}>
                {t('hall.record.addFriend')}
              </button>
            </div>
            {note && (
              <p role="alert" className="hall-alert" style={{ margin: 0 }}>
                {note}
              </p>
            )}
            {(desk?.friends ?? []).map((f) => (
              <div key={f.id} className="hall-friend">
                <span>
                  <span className={`on${f.online ? ' yes' : ''}`} aria-hidden />
                  {f.account.name}
                  {f.status !== 'friends' && <span className="label" style={{ marginLeft: 8 }}>{t(`site.friends.${f.status}`)}</span>}
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  {f.status === 'asks' && (
                    <button type="button" className="hall-btn go" onClick={() => befriend(f.account.name).catch((e) => setNote(t(deskErrorKey(e))))}>
                      {t('site.friends.accept')}
                    </button>
                  )}
                  <button type="button" className="hall-btn" onClick={() => unfriend(f.id).catch((e) => setNote(t(deskErrorKey(e))))} aria-label={t('site.friends.remove')}>
                    ×
                  </button>
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
