import { useDesk, useLeaderboard, useSession } from '@/online/session';
import type { LeaderRow, Tier } from '@/online/table';
import { useT } from '@/i18n';
import { TierMark, Trend } from '@/components/hall/pieces';
import { TIER_TONE, daysUntil, portraitFor } from '@/components/hall/bits';

/* ------------------------------------------------------------------ */
/* Classement — the roll of honour of the season, and the ranks.       */
/* ------------------------------------------------------------------ */

const TIERS: Tier[] = ['magnate', 'industrialist', 'foreman', 'journeyman', 'apprentice'];

export default function Ranking() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const board = useLeaderboard();
  if (!session) return null;
  const rows: (LeaderRow & { rank: number })[] = (board?.rows ?? []).map((r, i) => ({ ...r, rank: i + 1 }));
  const me = board?.me ?? null;
  const pinned = me && !rows.some((r) => r.id === me.id) ? me : null;
  const myTier: Tier = desk?.rating?.tier ?? 'journeyman';
  const gain = 'var(--h-gain)';
  const loss = 'var(--h-loss)';
  const flat = 'var(--h-muted)';
  const row = (r: LeaderRow & { rank: number }, i: number) => (
    <div key={r.id} className={`r${r.id === session.id ? ' you' : ''}`}>
      <span className="hall-pos">{r.rank}</span>
      <span className="hall-who">
        <img src={portraitFor(i)} alt="" />
        <span>{r.name}</span>
      </span>
      <TierMark tier={r.tier}>{t(`hall.tier.${r.tier}`)}</TierMark>
      <span className="hall-cote num">{r.rating}</span>
      <Trend values={r.trend} gain={gain} loss={loss} flat={flat} />
      <span className="hall-pct num">{r.games}</span>
      <span className={`hall-pct num${r.games && r.won / r.games >= 0.5 ? ' hall-gain' : ''}`}>{r.games ? `${Math.round((r.won / r.games) * 100)} %` : '—'}</span>
    </div>
  );
  return (
    <>
      <div className="hall-head">
        <h1>
          {t('hall.ranking.title')} {board?.season && <em>· {board.season.name}</em>}
        </h1>
        <div className="meta">
          {t('hall.ranking.meta', { n: board?.players ?? 0 })}
          {board?.season && (
            <>
              <br />
              {t('hall.tape.season', { season: board.season.name, days: daysUntil(board.season.endsAt) })}
            </>
          )}
        </div>
      </div>
      <div className="hall-season">
        <div className="hall-honour">
          <div className="hd">
            <span>{t('hall.ranking.cols.pos')}</span>
            <span>{t('hall.ranking.cols.player')}</span>
            <span>{t('hall.ranking.cols.tier')}</span>
            <span>{t('hall.ranking.cols.cote')}</span>
            <span>{t('hall.ranking.cols.trend')}</span>
            <span>{t('hall.ranking.cols.games')}</span>
            <span>{t('hall.ranking.cols.won')}</span>
          </div>
          {rows.length === 0 ? <p className="empty">{t('hall.ranking.none')}</p> : rows.map(row)}
          {pinned && (
            <>
              <div className="r">
                <span className="hall-pos">…</span>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              {row(pinned, pinned.rank)}
            </>
          )}
        </div>
        <aside className="hall-sheet hall-panel">
          <h3>{t('hall.ranking.tiers.title')}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t('hall.ranking.tiers.body')}
          </p>
          <div className="hall-ladder">
            {TIERS.map((tier) => (
              <div key={tier} className={tier === myTier && desk?.rating ? 'here' : undefined} data-you={t('hall.ranking.you')} style={{ ['--t' as string]: TIER_TONE[tier] }}>
                <i aria-hidden />
                {t(`hall.tier.${tier}`)}
                <span>{t(`hall.ranking.tiers.floor.${tier}`)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t('hall.ranking.tiers.reward')}
          </p>
        </aside>
      </div>
    </>
  );
}
