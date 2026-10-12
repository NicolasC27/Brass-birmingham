import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import EmptyState from '@/components/platform/EmptyState';
import MemberAvatar from '@/components/platform/MemberAvatar';
import RankBadge, { type RankTier } from '@/components/platform/RankBadge';
import RankEmblem from '@/components/platform/RankEmblem';
import Skeleton from '@/components/platform/Skeleton';
import PlayerToken from '@/components/setup/PlayerToken';
import { isOnline } from '@/online/lobby';
import { useDesk, useLeaderboard, useSession, useStranger } from '@/online/session';
import CompaniesPanel from '@/components/platform/CompaniesPanel';
import PageShell from '@/components/site/PageShell';
import type { LeaderRow } from '@/online/table';
import { rankOf, type RankView } from '@/platform/rank';
import { useWallet } from '@/platform/wallet';
import { Sparkline } from '@/pages/Desk';
import { localeOf, useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Classement — le tableau d'honneur de l'exercice : les cinquante     */
/* premiers, ma ligne épinglée sous un « … » quand je suis au-delà,    */
/* et l'échelle des cinq rangs avec leurs planchers. Les données       */
/* viennent de useLeaderboard() ; la route est posée par App.tsx.      */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
/** les cinq rangs, du haut vers le bas, dans les métaux du badge */
const TIERS: RankTier[] = ['or', 'laiton', 'acier', 'fer', 'bronze'];
const daysUntil = (at: number): number => Math.max(0, Math.ceil((at - Date.now()) / 86_400_000));
const locale = localeOf;

type Ranked = LeaderRow & { rank: number };

/** le badge d'une ligne du tableau : qui y figure a ses placements derrière lui */
const rankOfRow = (row: LeaderRow): RankView => rankOf({ rating: row.rating, tier: row.tier, games: row.games, won: row.won, placements: 0, trend: row.trend });

/* ------------------------------ Une ligne ------------------------------ */

function HonourRow({ row, mine, avatar }: { row: Ranked; mine: boolean; avatar: { avatar: string; frame: string } }) {
  const t = useT();
  const lang = useLang();
  const rank = rankOfRow(row);
  const pct = row.games ? Math.round((row.won / row.games) * 100) : null;
  return (
    <tr className={cn('border-b border-[rgb(var(--paper-100)/.06)] transition-colors duration-150 last:border-b-0', mine ? 'bg-[rgb(var(--signal-400)/.08)]' : 'hover:bg-enamel-700/50')}>
      <td className="py-2.5 pl-3 pr-2">
        <span className={cn('data-text tabular-nums', row.rank <= 3 ? 'font-semibold text-brass-300' : 'text-iron-400')}>{row.rank}</span>
      </td>
      <td className="py-2.5 pr-3">
        <span className="flex items-center gap-2.5">
          {mine ? (
            <MemberAvatar avatar={avatar.avatar} frame={avatar.frame} size={28} />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass-hairline bg-enamel-700 font-ui text-[12.5px] font-semibold text-paper-100" aria-hidden>
              {row.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate font-ui text-[13px] font-semibold text-paper-100">{row.name}</span>
          {row.color && <PlayerToken color={row.color} size={12} />}
          {mine && <span className="micro-label bg-[rgb(var(--signal-400)/.14)] px-1.5 py-0.5 text-signal-ink">{t('platform.ranking.you')}</span>}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <RankBadge tier={rank.tier} division={rank.division} size={22} />
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="tnums font-fraunces text-[15px] font-semibold text-paper-100">{row.rating.toLocaleString(locale(lang))}</span>
      </td>
      <td className="py-2.5 pr-3">
        <Sparkline values={row.trend} />
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="data-text tabular-nums text-paper-300">{row.games}</span>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className={cn('data-text tabular-nums', pct !== null && pct >= 50 ? 'text-bottle-ink' : 'text-paper-300')}>{pct === null ? '—' : `${pct} %`}</span>
      </td>
    </tr>
  );
}

/* ------------------------------ Le tableau ------------------------------ */

function HonourTable({ rows, pinned, me, avatar }: { rows: Ranked[]; pinned: Ranked | null; me: string; avatar: { avatar: string; frame: string } }) {
  const t = useT();
  const cols: { key: string; right?: boolean }[] = [{ key: 'rank' }, { key: 'player' }, { key: 'tier' }, { key: 'cote', right: true }, { key: 'trend' }, { key: 'games', right: true }, { key: 'won', right: true }];
  return (
    <div className="overflow-x-auto console">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-brass-hairline">
            {cols.map((c) => (
              <th key={c.key} className={cn('micro-label py-2.5 pr-3 text-iron-400', c.key === 'rank' ? 'pl-3' : '', c.right && 'text-right')}>
                {t(`platform.ranking.cols.${c.key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <HonourRow key={r.id} row={r} mine={r.id === me} avatar={avatar} />
          ))}
          {pinned && (
            <>
              <tr aria-hidden>
                <td colSpan={cols.length} className="data-text py-1 text-center leading-none text-iron-400">
                  …
                </td>
              </tr>
              <HonourRow row={pinned} mine avatar={avatar} />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ L'échelle ------------------------------ */

function Ladder({ mine }: { mine: RankView }) {
  const t = useT();
  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease, delay: 0.1 }}
      className="self-start console p-5 min-[900px]:col-span-4"
    >
      <h2 className="title-card">{t('platform.ranking.ladder.title')}</h2>
      <div className="mb-4 mt-3 h-px bg-brass-hairline" />
      <p className="font-ui text-[12.5px] leading-relaxed text-paper-300">{t('platform.ranking.ladder.body')}</p>
      <ul className="mt-4 grid gap-1.5">
        {TIERS.map((tier, i) => {
          const here = mine.tier === tier;
          return (
            <motion.li
              key={tier}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease, delay: 0.12 + i * 0.04 }}
              className={cn('flex items-center gap-3 border px-3 py-2', here ? 'border-brass-hairline-strong bg-enamel-800' : 'border-transparent')}
            >
              <RankEmblem tier={tier} size={24} />
              <span className={cn('font-ui text-[13px] font-semibold', here ? 'text-paper-100' : 'text-iron-400')}>{t(`platform.rank.${tier}`)}</span>
              <span className="data-text ml-auto tabular-nums text-iron-400">{t(`platform.ranking.ladder.floor.${tier}`)}</span>
              {here && <span className="micro-label text-brass-300">{t('platform.ranking.ladder.you')}</span>}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 border-t border-[rgb(var(--paper-100)/.07)] pt-3 font-ui text-[12.5px] leading-snug text-iron-400">{t('platform.ranking.ladder.reward')}</p>
    </motion.aside>
  );
}

/* ----------------------------------- Page ----------------------------------- */

/* The page goes through the journal's own frame, like its neighbours: an
   eyebrow, the title, a lede in the book face with the season's facts set
   under it, the reader's plaque at the right. The visitor is no longer sent
   away to the sign-in form without a word: the ladder is public and stays,
   the table and the companies — which the office only reads to members —
   give way to a plate that says where they are read. */

export default function Classement() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();
  const board = useLeaderboard();
  const wallet = useWallet();

  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
  }, [navigate]);

  const rows: Ranked[] = (board?.rows ?? []).map((r, i) => ({ ...r, rank: i + 1 }));
  const me = board?.me ?? null;
  const pinned = me && !rows.some((r) => r.id === me.id) ? me : null;
  const season = board?.season ?? desk?.season ?? null;
  const mine = rankOf(desk?.rating);
  const avatar = { avatar: wallet.equipped.avatar, frame: wallet.equipped.frame };

  const facts = [
    board ? t('platform.ranking.players', { count: board.players }) : session ? t('platform.ranking.loading') : null,
    season ? t('platform.ranking.daysLeft', { days: daysUntil(season.endsAt) }) : null,
  ].filter((x): x is string => x !== null);

  return (
    <PageShell
      eyebrow={t('platform.ranking.eyebrow')}
      title={
        <>
          {t('platform.ranking.title')}
          {season && <span className="text-iron-400"> · {season.name}</span>}
        </>
      }
      lede={
        <>
          {t('platform.ranking.lede')}
          <span className="mt-2 block font-serif text-[13px] not-italic text-iron-400 tnums">
            {facts.map((f) => `${f} · `).join('')}
            <Link to="/services" className="text-paper-100 underline decoration-[var(--gz-ink-soft)] underline-offset-4 transition-colors hover:decoration-[var(--gz-ink)]">
              {t('platform.seasons.link')} →
            </Link>
          </span>
        </>
      }
      aside={
        session && board ? (
          /* as wide as four of the twelve columns below (gap-8), so the plaque
             and the ladder under it stand on one axis; the badge above its
             sentence, which a third of the page would break in three */
          <div className="console flex w-full items-center gap-3 px-4 py-3 min-[1100px]:w-[calc((100%-22rem)/3+6rem)] min-[1100px]:flex-col min-[1100px]:items-start min-[1100px]:gap-2">
            <RankBadge tier={mine.tier} division={mine.division} lp={mine.lp} placementDone={mine.placementDone ?? undefined} size={32} className="shrink-0" />
            <span className="min-w-0 font-serif text-[13px] leading-snug text-paper-300">{me ? t('platform.ranking.myRank', { rank: me.rank, count: board.players }) : t('platform.ranking.unranked')}</span>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-8 min-[900px]:grid-cols-12">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease, delay: 0.06 }} className="min-w-0 min-[900px]:col-span-8">
          {stranger ? (
            <EmptyState plate="tables" title={t('platform.ranking.signInTitle')} copy={t('platform.ranking.signInCopy')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />
          ) : board === null || !session ? (
            <div className="grid gap-3 console p-5" aria-busy aria-label={t('platform.ranking.loading')}>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className={cn('h-8', i === 0 ? 'w-2/3' : 'w-full')} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState plate="tables" title={t('platform.ranking.emptyTitle')} copy={t('platform.ranking.emptyCopy')} cta={{ label: t('platform.ranking.emptyCta'), to: '/online' }} />
          ) : (
            <HonourTable rows={rows} pinned={pinned} me={session.id} avatar={avatar} />
          )}
        </motion.section>
        <Ladder mine={mine} />
      </div>
      {session && <CompaniesPanel />}
    </PageShell>
  );
}
