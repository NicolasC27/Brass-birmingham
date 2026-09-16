import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { eraRounds } from '@/game/data';
import { startTutorial } from '@/game/quickplay';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import { lobby, normalizeCode } from '@/online/lobby';
import { deskErrorKey } from '@/online/errors';
import { answerInvitation, clearDealt, setQueue, useDealt, useDesk, useSession } from '@/online/session';
import type { TableSummary } from '@/online/table';
import { useT } from '@/i18n';
import { Seats } from '@/components/hall/pieces';
import { daysUntil, elapsed } from '@/components/hall/bits';

/* ------------------------------------------------------------------ */
/* Jouer — three counters (the quick queue, the ranked queue, a table  */
/* of one's own), then the tables I sit at, the letters, the friends,  */
/* and the house at a glance.                                          */
/* ------------------------------------------------------------------ */

function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [on]);
  return now;
}

function TableRow({ table, me }: { table: TableSummary; me: string }) {
  const t = useT();
  const cur = table.current !== undefined ? table.seats[table.current] : undefined;
  const line =
    table.status === 'open'
      ? t('hall.play.open')
      : table.status === 'over'
        ? t('hall.play.over')
        : `${t(`hall.play.era.${table.era ?? 'canal'}`)} · ${t('hall.play.round', { round: table.round ?? 1, total: eraRounds(table.seats.length) })} · `;
  const who = table.status === 'playing' ? (table.myTurn ? <span className="mark">{t('hall.play.yourMove')}</span> : cur ? t('hall.play.toAct', { name: cur.name }) : '') : null;
  const to = table.status === 'open' ? `/online/${table.code}` : `/game/${table.code}`;
  const label = table.status === 'open' ? t('hall.play.enterRoom') : table.myTurn ? t('hall.play.playNow') : t('hall.play.resume');
  return (
    <div className="hall-row">
      <span className="code">{table.code}</span>
      <div className="t">
        {table.name}
        {table.hostId === me && table.status === 'open' ? '' : ''}
        <small>
          {line}
          {who}
        </small>
      </div>
      <Seats seats={table.seats} />
      <Link to={to} className={`hall-btn${table.myTurn ? ' go' : ''}`}>
        {label}
      </Link>
    </div>
  );
}

export default function Play() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const [tableName, setTableName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queue = desk?.queue ?? null;
  const now = useNow(queue !== null);
  /* the office dealt a table from the queue: straight to it */
  const dealt = useDealt();
  useEffect(() => {
    if (!dealt) return;
    clearDealt();
    navigate(`/game/${dealt}`);
  }, [dealt, navigate]);
  if (!session) return null;
  const verified = session.verified;
  const tables = desk?.tables ?? [];
  const waiting = tables.filter((x) => x.myTurn).length;
  const rating = desk?.rating ?? null;
  const fail = (e: unknown) => setError(t(deskErrorKey(e)));
  const create = async () => {
    setError(null);
    try {
      const table = await lobby.create(tableName.trim() || t('site.desk.defaultName', { name: session.name }), DEFAULT_OPTIONS, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      fail(e);
    }
  };
  const join = async () => {
    if (code.length < 4) return;
    setError(null);
    try {
      const table = await lobby.join(code, session.favoriteColor ?? undefined);
      navigate(table.status === 'open' ? `/online/${table.code}` : `/game/${table.code}`);
    } catch (e) {
      fail(e);
    }
  };
  const answer = async (id: string, accept: boolean) => {
    setError(null);
    try {
      const at = await answerInvitation(id, accept);
      if (at) navigate(`/online/${at}`);
    } catch (e) {
      fail(e);
    }
  };
  const friendsOnline = (desk?.friends ?? []).filter((f) => f.status === 'friends' && f.online);
  const last = desk?.history[0];
  const lastMine = last ? last.players.findIndex((p) => p.id === session.id) : -1;
  const lastPlace = last && lastMine >= 0 ? 1 + last.players.filter((p) => p.vp > last.players[lastMine].vp).length : null;
  const counter = (mode: 'quick' | 'ranked') => {
    const inThis = queue?.mode === mode;
    return inThis && queue ? (
      <div className="hall-queue" role="status">
        <span>{t('hall.play.queue.waiting', { time: elapsed(queue.since, now) })}</span>
        <b>{t('hall.play.queue.others', { n: queue.waiting })}</b>
        <button type="button" className="hall-btn" onClick={() => setQueue(mode, false)}>
          {t('hall.play.queue.leave')}
        </button>
      </div>
    ) : (
      <button type="button" className={`hall-cta${mode === 'quick' ? ' primary' : ''}`} disabled={!verified} title={verified ? undefined : t('hall.play.queue.verifyFirst')} onClick={() => setQueue(mode, true)}>
        {t(`hall.play.${mode}.cta`)} <span className="arrow">→</span>
      </button>
    );
  };
  return (
    <>
      <div className="hall-head">
        <h1>
          {t('hall.play.greeting', { name: session.name })} <em>{waiting === 0 ? t('hall.play.tablesWait.none') : waiting === 1 ? t('hall.play.tablesWait.one') : t('hall.play.tablesWait.many', { n: waiting })}</em>
        </h1>
        <div className="meta">
          {desk?.season && (
            <>
              {t('hall.play.seasonMeta', { season: desk.season.name, days: daysUntil(desk.season.endsAt) })}
              <br />
            </>
          )}
          {rating ? (rating.placements > 0 ? t('hall.play.coteMeta', { rating: rating.rating, tier: t(`hall.tier.${rating.tier}`), placements: rating.placements }) : t('hall.play.coteFirm', { rating: rating.rating, tier: t(`hall.tier.${rating.tier}`) })) : t('hall.play.unranked')}
        </div>
      </div>
      {error && (
        <p role="alert" className="hall-alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <div className="hall-play">
        <div>
          <div className="hall-counters hall-sheet">
            <section className="hall-counter">
              <span className="eyebrow">{t('hall.play.quick.eyebrow')}</span>
              <h2 className="k">{t('hall.play.quick.title')}</h2>
              <p className="muted">{t('hall.play.quick.body')}</p>
              <div className="spec muted">
                <div>
                  {t('hall.play.quick.players')} <b>{t('hall.play.quick.playersValue')}</b>
                </div>
                <div>
                  {t('hall.play.quick.wait')} <b>{t('hall.play.quick.waitValue')}</b>
                </div>
                <div>
                  {t('hall.play.quick.candle')} <b>{t('hall.play.quick.candleValue')}</b>
                </div>
              </div>
              {counter('quick')}
            </section>
            <section className="hall-counter">
              <span className="eyebrow">{t('hall.play.ranked.eyebrow')}</span>
              <h2 className="k">{t('hall.play.ranked.title')}</h2>
              <p className="muted">{t('hall.play.ranked.body')}</p>
              <div className="spec muted">
                <div>
                  {t('hall.play.ranked.players')} <b>{t('hall.play.ranked.playersValue')}</b>
                </div>
                <div>
                  {t('hall.play.ranked.placements')} <b>{t('hall.play.ranked.placementsValue', { n: rating?.placements ?? 5 })}</b>
                </div>
                <div>
                  {t('hall.play.ranked.candle')} <b>{t('hall.play.ranked.candleValue')}</b>
                </div>
              </div>
              {counter('ranked')}
            </section>
            <section className="hall-counter">
              <span className="eyebrow">{t('hall.play.privateTable.eyebrow')}</span>
              <h2 className="k">{t('hall.play.privateTable.title')}</h2>
              <p className="muted">{t('hall.play.privateTable.body')}</p>
              <div className="spec">
                <input aria-label={t('hall.play.privateTable.name')} value={tableName} onChange={(e) => setTableName(e.target.value)} maxLength={28} placeholder={t('hall.play.privateTable.namePlaceholder')} onKeyDown={(e) => e.key === 'Enter' && create()} className="hall-input" />
                <div style={{ display: 'flex', gap: 8, borderTop: 0, paddingTop: 0 }}>
                  <input aria-label={t('hall.play.privateTable.code')} value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && join()} maxLength={4} spellCheck={false} placeholder="····" className="hall-input mono" style={{ width: 96, textAlign: 'center', letterSpacing: '0.3em' }} />
                  <button type="button" className="hall-btn" disabled={code.length < 4 || !verified} onClick={join}>
                    {t('hall.play.privateTable.join')}
                  </button>
                </div>
              </div>
              <button type="button" className="hall-cta" disabled={!verified} onClick={create}>
                {t('hall.play.privateTable.open')} <span className="arrow">→</span>
              </button>
            </section>
          </div>
          <section className="hall-mine" style={{ marginTop: 24 }}>
            <div className="hall-head" style={{ marginBottom: 6, paddingBottom: 10 }}>
              <h2 className="hall-h2">{t('hall.play.yourTables')}</h2>
              {waiting > 0 && <span className="label">◇ {t('hall.play.yourMoveHint')}</span>}
            </div>
            {tables.length === 0 ? (
              <p className="muted" style={{ fontStyle: 'italic', color: 'var(--h-muted)' }}>
                {t('hall.play.noTables')}
              </p>
            ) : (
              <div className="hall-rows">
                {[...tables].sort((a, b) => Number(b.myTurn) - Number(a.myTurn)).map((x) => (
                  <TableRow key={x.code} table={x} me={session.id} />
                ))}
              </div>
            )}
          </section>
          {desk && (desk.invitations.length > 0 || desk.sent.length > 0) && (
            <section className="hall-sheet hall-panel" style={{ marginTop: 24 }}>
              <h3>{t('hall.play.letters.title')}</h3>
              {desk.invitations.map((i) => (
                <div key={i.id} className="hall-letter">
                  <span>{t('hall.play.letters.invitedBy', { from: i.from.name, table: i.tableName })}</span>
                  <span className="acts">
                    <button type="button" className="hall-btn go" onClick={() => answer(i.id, true)}>
                      {t('hall.play.letters.accept')}
                    </button>
                    <button type="button" className="hall-btn" onClick={() => answer(i.id, false)}>
                      {t('hall.play.letters.decline')}
                    </button>
                  </span>
                </div>
              ))}
              {desk.sent.map((i) => (
                <div key={i.id} className="hall-letter muted">
                  {t('hall.play.letters.sentTo', { to: i.to.name, table: i.tableName })}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="hall-sheet hall-panel">
          <h3>{t('hall.play.board.title')}</h3>
          <div className="hall-stat">
            <span>{t('hall.play.board.online')}</span>
            <b className="num">{desk?.hall.online ?? '—'}</b>
          </div>
          <div className="hall-stat">
            <span>{t('hall.play.board.playing')}</span>
            <b className="num">{desk?.hall.playing ?? '—'}</b>
          </div>
          <div className="hall-stat">
            <span>{t('hall.play.board.queued')}</span>
            <b className="num">{desk?.hall.queued ?? '—'}</b>
          </div>
          <div className="hall-kv">
            <div>
              <span>{t('hall.play.board.friends')}</span>
              <b>{friendsOnline.length ? friendsOnline.map((f) => f.account.name).join(' · ') : t('hall.play.board.nobody')}</b>
            </div>
            <div>
              <span>{t('hall.play.board.letters')}</span>
              <b>{!desk || desk.invitations.length === 0 ? t('hall.play.board.letter.none') : desk.invitations.length === 1 ? t('hall.play.board.letter.one') : t('hall.play.board.letter.many', { n: desk.invitations.length })}</b>
            </div>
            <div>
              <span>{t('hall.play.board.last')}</span>
              <b>{last && lastPlace ? t('hall.play.board.lastValue', { place: `${lastPlace}${lastPlace === 1 ? 'ᵉʳ' : 'ᵉ'}`, vp: last.players[lastMine].vp }) : t('hall.play.board.noGame')}</b>
            </div>
          </div>
          {desk && desk.friends.some((f) => f.status === 'friends') && (
            <div>
              <span className="label">{t('hall.play.friends.title')}</span>
              {desk.friends
                .filter((f) => f.status === 'friends')
                .map((f) => (
                  <div key={f.id} className="hall-friend">
                    <span>
                      <span className={`on${f.online ? ' yes' : ''}`} aria-hidden />
                      {f.account.name}
                    </span>
                    {f.playing && !tables.some((x) => x.code === f.playing?.code) && (
                      <Link to={`/game/${f.playing.code}`} className="hall-btn">
                        {t('hall.play.friends.watch')}
                      </Link>
                    )}
                  </div>
                ))}
            </div>
          )}
          <button
            type="button"
            className="hall-cta"
            onClick={() => {
              startTutorial();
              navigate('/game');
            }}
          >
            {t('hall.play.privateTable.tutorial')} <span className="arrow">→</span>
          </button>
        </aside>
      </div>
    </>
  );
}
