import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, ChevronDown, Coins, GraduationCap, History, LayoutGrid, LogOut, Mail, MailOpen, MoreHorizontal, Send, UserX, Users, X } from 'lucide-react';
import VerifyBanner from '@/components/site/VerifyBanner';
import { Refusal, inputClass } from '@/components/site/PageShell';
import Button from '@/components/platform/Button';
import SeatToken from '@/components/platform/SeatToken';
import RankBadge from '@/components/platform/RankBadge';
import StatTile from '@/components/platform/StatTile';
import EmptyState from '@/components/platform/EmptyState';
import MemberAvatar from '@/components/platform/MemberAvatar';
import Modal from '@/components/platform/Modal';
import Toast, { type ToastData } from '@/components/platform/Toast';
import type { RankTier } from '@/components/platform/RankBadge';
import PlayerToken from '@/components/setup/PlayerToken';
import { PLACEMENTS, rankOf, type RankView } from '@/platform/rank';
import { collectRewards, useWallet } from '@/platform/wallet';
import { forgetLocalGame, listLocalGames } from '@/game/local';
import type { LocalTable } from '@/game/local';
import { startTutorial } from '@/game/quickplay';
import { isOnline, lobby } from '@/online/lobby';
import { answerInvitation, befriend, invite, unfriend, useDesk, useSession, useStranger } from '@/online/session';
import type { Friend, Invitation, PastGame, Rating, Season, TableSummary } from '@/online/table';
import { localeOf, useLang, useT, tr } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Le bureau du joueur (desk.md) — console à onglets qui réorganise   */
/* les données existantes du desk serveur : mes tables (mon tour       */
/* d'abord), invitations, amis, historique, statistiques. Aucune       */
/* donnée nouvelle ; les contrats src/online/* sont consommés tels     */
/* quels.                                                              */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
const TABS = ['tables', 'invitations', 'amis', 'historique', 'stats'] as const;
type TabId = (typeof TABS)[number];
const TAB_IDS: Record<TabId, string> = { tables: 'tables', invitations: 'invitations', amis: 'amis', historique: 'historique', stats: 'stats' };

function isTab(hash: string): hash is TabId {
  return (TABS as readonly string[]).includes(hash);
}

/** « il y a … » mono, sur les clés platform.time.* */
function useAgo() {
  const t = useT();
  return (ts: number) => {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return t('platform.time.now');
    if (m < 60) return t('platform.time.minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('platform.time.hoursAgo', { count: h });
    return t('platform.time.daysAgo', { count: Math.floor(h / 24) });
  };
}

/** jours pleins avant une échéance (la clôture de l'exercice) */
const daysUntil = (at: number): number => Math.max(0, Math.ceil((at - Date.now()) / 86_400_000));

/** une cote en chiffres tabulaires, à la française ou à l'anglaise */
const cote = (n: number, lang: string): string => n.toLocaleString(localeOf(lang));

const METALS: RankTier[] = ['bronze', 'fer', 'acier', 'laiton', 'or'];

/** la marche suivante de l'échelle : l'autre division, ou le rang au-dessus */
function nextOf(rank: RankView): { tier: RankTier; division: string } | null {
  if (rank.tier === 'placement' || rank.tier === 'or' || rank.tier === 'maitre') return null;
  if (rank.division === 'II') return { tier: rank.tier, division: 'I' };
  return { tier: METALS[METALS.indexOf(rank.tier) + 1], division: 'II' };
}

/** La tendance d'une cote en une ligne — le bureau et le classement s'en servent. */
export function Sparkline({ values, width = 72, height = 20, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return <span className={cn('data-text text-[11px] text-iron-600', className)}>—</span>;
  const min = Math.min(...values);
  const span = Math.max(1, Math.max(...values) - min);
  const pts = values.map((v, i) => `${1 + (i / (values.length - 1)) * (width - 2)},${height - 1 - ((v - min) / span) * (height - 2)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  const delta = values[values.length - 1] - values[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${values[0]} → ${values[values.length - 1]}`}
      className={cn('shrink-0 overflow-visible', delta > 0 ? 'text-bottle-400' : delta < 0 ? 'text-rust-400' : 'text-iron-400', className)}
    >
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2} fill="currentColor" />
    </svg>
  );
}

/* ------------------------- En-tête « carte de membre » ------------------------- */

function MemberHeader() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const desk = useDesk();
  const wallet = useWallet();
  if (!session) return null;
  const stats = desk?.stats;
  const rank = rankOf(desk?.rating);
  const since = new Date(session.createdAt).toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' });
  const rate = stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease }}
      className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850"
    >
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-5 p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.26, ease }}
          className="shrink-0"
        >
          <MemberAvatar avatar={wallet.equipped.avatar} frame={wallet.equipped.frame} size={64} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.06 }} className="min-w-0 flex-1">
          <p className="micro-label text-brass-300">{t('platform.desk.eyebrow')}</p>
          <h1 className="mt-1 truncate font-fraunces text-[28px] font-semibold leading-tight text-paper-100">{session.name}</h1>
          {wallet.equipped.title !== 'title-none' && <p className="micro-label mt-1 text-brass-300">{t(`platform.comptoir.items.${wallet.equipped.title}`)}</p>}
          <p className="micro-label mt-1 text-iron-400">{t('platform.desk.memberSince', { date: since })}</p>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RankBadge tier={rank.tier} division={rank.division} lp={rank.lp} placementDone={rank.placementDone ?? undefined} size={24} />
            {desk && <span className="micro-label rounded bg-enamel-700 px-1.5 py-0.5 text-iron-400">{t('platform.desk.season', { season: desk.season.name, days: daysUntil(desk.season.endsAt) })}</span>}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.12 }} className="hidden gap-3 min-[900px]:flex">
          <StatTile value={stats?.won ?? 0} label={t('platform.desk.stats.won')} className="!p-3 [&_.micro-label]:!text-[10px]" />
          <StatTile value={rate} label={t('platform.desk.stats.rate')} className="!p-3 [&_.micro-label]:!text-[10px]" />
          <StatTile value={stats?.played ?? 0} label={t('platform.desk.stats.played')} className="!p-3 [&_.micro-label]:!text-[10px]" />
        </motion.div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" to="/comptoir" icon={<Coins size={16} aria-hidden className="text-brass-300" />} aria-label={t('platform.comptoir.walletAria', { count: wallet.balance })}>
            <span className="tnums">{wallet.balance}</span>
          </Button>
          <Button variant="ghost" to="/profile">
            {t('platform.desk.editProfile')}
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------ Bandeau tutoriel ------------------------------ */

function TutorialStrip() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-850 px-5 py-4">
      <GraduationCap size={20} aria-hidden className="shrink-0 text-brass-300" />
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[14px] font-semibold text-paper-100">{t('platform.desk.tutorial.title')}</p>
        <p className="mt-0.5 font-ui text-[12px] text-iron-400">{t('platform.desk.tutorial.copy')}</p>
      </div>
      <Button
        variant="ghost"
        className="shrink-0"
        onClick={() => navigate(`/game/local/${startTutorial()}`)}
      >
        {t('platform.desk.tutorial.cta')}
      </Button>
    </div>
  );
}

/* -------------------------------- Rail d'onglets -------------------------------- */

function TabRail({ active, onChange, turnCount, inviteCount, onlineCount }: { active: TabId; onChange: (id: TabId) => void; turnCount: number; inviteCount: number; onlineCount: number }) {
  const t = useT();
  const items: { id: TabId; icon: typeof LayoutGrid; label: string; badge?: number; note?: string }[] = [
    { id: 'tables', icon: LayoutGrid, label: t('platform.desk.tabs.tables'), badge: turnCount || undefined },
    { id: 'invitations', icon: Mail, label: t('platform.desk.tabs.invitations'), badge: inviteCount || undefined },
    { id: 'amis', icon: Users, label: t('platform.desk.tabs.friends'), note: onlineCount ? t('platform.desk.friendsOnline', { count: onlineCount }) : undefined },
    { id: 'historique', icon: History, label: t('platform.desk.tabs.history') },
    { id: 'stats', icon: BarChart3, label: t('platform.desk.tabs.stats') },
  ];

  const badge = (n?: number, signal = false) =>
    n !== undefined && (
      <span className={cn('data-text ml-auto rounded-full px-1.5 py-px text-[11px] tabular-nums', signal ? 'animate-pulse-signal bg-[rgb(var(--signal-400)/.14)] text-signal-400' : 'bg-enamel-700 text-iron-400')}>{n}</span>
    );

  return (
    <>
      {/* rail latéral desktop */}
      <nav aria-label={t('platform.nav.desk')} className="sticky top-24 hidden w-60 shrink-0 flex-col gap-1 self-start min-[900px]:flex">
        {items.map(({ id, icon: Icon, label, badge: n, note }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-ui text-[13px] font-semibold transition-colors duration-150',
                isActive ? 'bg-enamel-850 text-paper-100' : 'text-iron-400 hover:bg-enamel-850/60 hover:text-paper-100',
              )}
            >
              {isActive && <motion.span layoutId="desk-rail-filet" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brass-500" transition={{ type: 'spring', stiffness: 260, damping: 24 }} />}
              <Icon size={16} aria-hidden className={cn('shrink-0', isActive ? 'text-brass-300' : 'text-iron-600')} />
              <span className="truncate">{label}</span>
              {badge(n, id === 'tables' || id === 'invitations')}
              {note && !n && <span className="data-text ml-auto whitespace-nowrap text-[11px] text-iron-600">{note}</span>}
            </button>
          );
        })}
      </nav>

      {/* onglets horizontaux mobile */}
      <div role="tablist" className="scroll-thin -mx-4 flex gap-1 overflow-x-auto border-b border-[rgb(var(--paper-100)/.07)] px-4 min-[900px]:hidden">
        {items.map(({ id, icon: Icon, label, badge: n }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={cn('relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 pb-2.5 pt-1 font-ui text-[13px] font-semibold transition-colors duration-150', isActive ? 'text-paper-100' : 'text-iron-400 hover:text-paper-100')}
            >
              <Icon size={16} aria-hidden className={isActive ? 'text-brass-300' : 'text-iron-600'} />
              {label}
              {n !== undefined && <span className={cn('data-text rounded-full px-1.5 py-px text-[11px] tabular-nums', id === 'tables' || id === 'invitations' ? 'bg-[rgb(var(--signal-400)/.14)] text-signal-400' : 'bg-enamel-700 text-iron-400')}>{n}</span>}
              {isActive && <motion.span layoutId="desk-tab-filet" className="absolute inset-x-2 -bottom-px h-0.5 bg-brass-500" transition={{ type: 'spring', stiffness: 260, damping: 24 }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------ Panneau A — Mes tables ------------------------------ */

/** une table du bureau : celle du serveur, ou la partie jouée sur cet appareil */
type DeskTable = TableSummary & { local?: boolean };

/** une partie de cet appareil, présentée comme une table : son code, son nom, ses sièges */
function localTable(local: LocalTable, me: string): DeskTable {
  let mine = false;
  return {
    code: local.code,
    name: local.name,
    hostId: me,
    seats: local.seats.map((s, i) => {
      /* le premier siège humain est le mien ; en chaise tournante, les autres sont les invités */
      const you = s.kind === 'human' && !mine;
      if (you) mine = true;
      return { id: you ? me : `local-${i}`, name: s.name, color: s.color, kind: s.kind };
    }),
    status: 'playing',
    era: local.era,
    round: local.round,
    myTurn: false,
    updatedAt: local.updatedAt,
    local: true,
  };
}

function TableRibbon({ table, pulse }: { table: DeskTable; pulse: boolean }) {
  const t = useT();
  if (table.local) {
    return <span className="micro-label flex h-[22px] shrink-0 items-center rounded-full bg-enamel-700 px-2.5 text-brass-300">{t('platform.desk.tables.local')}</span>;
  }
  if (table.myTurn) {
    return (
      <span className="micro-label flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-[rgb(var(--signal-400)/.12)] px-2.5 text-signal-400">
        <span className={cn('h-1.5 w-1.5 rounded-full bg-signal-400', pulse && 'animate-pulse-signal')} aria-hidden />
        {t('platform.desk.tables.yourTurn')}
      </span>
    );
  }
  const styles: Record<TableSummary['status'], string> = {
    playing: 'bg-[rgb(var(--signal-400)/.12)] text-signal-400',
    open: 'bg-bottle-700/60 text-bottle-400',
    over: 'bg-enamel-700 text-iron-400',
  };
  const labels: Record<TableSummary['status'], string> = {
    playing: t('platform.desk.tables.live'),
    open: t('platform.desk.tables.waiting'),
    over: t('platform.desk.tables.over'),
  };
  return <span className={cn('micro-label flex h-[22px] shrink-0 items-center rounded-full px-2.5', styles[table.status])}>{labels[table.status]}</span>;
}

function TableRow({ table, me, pulse, onLeave }: { table: DeskTable; me: string; pulse: boolean; onLeave: (table: DeskTable) => void }) {
  const t = useT();
  const lang = useLang();
  const ago = useAgo();
  const [menu, setMenu] = useState(false);
  const toAct = table.current !== undefined ? table.seats[table.current] : null;
  const to = table.local ? `/game/local/${table.code}` : table.status === 'open' ? `/online/${table.code}` : `/game/${table.code}`;
  const meta = [
    table.era ? t(table.era === 'rail' ? 'platform.desk.tables.eraRail' : 'platform.desk.tables.eraCanal') : null,
    table.status === 'playing' ? t('platform.desk.tables.round', { round: table.round ?? 1 }) : null,
    table.local ? t('platform.desk.tables.localHint') : ago(table.updatedAt),
    toAct && table.status === 'playing' && !table.myTurn ? t('platform.desk.tables.toAct', { name: toAct.name }) : null,
  ].filter(Boolean);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease }}
      className={cn(
        'rounded-xl border bg-enamel-850 p-4 transition-colors duration-150 ease-out hover:bg-enamel-800',
        table.myTurn ? 'halo-signal border-[rgb(var(--signal-400)/.5)]' : 'border-brass-hairline hover:border-brass-hairline-strong',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex items-center gap-2">
            <h3 className="title-card truncate">{tableTitle(table.name, lang)}</h3>
            <TableRibbon table={table} pulse={pulse} />
          </div>
          <p className="data-text mt-1.5 text-[11px] text-iron-400">
            <span className="tracking-[0.28em] text-brass-300">{table.code}</span>
            {meta.length > 0 && <span className="text-iron-600"> · {meta.join(' · ')}</span>}
          </p>
          <div className="mt-3 flex items-end gap-2">
            {table.seats.map((s, i) => (
              <SeatToken key={s.id} index={i} size={32} seat={{ name: s.name, color: s.color, kind: s.kind, host: s.id === table.hostId, you: s.id === me }} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {table.status === 'playing' ? (
            <Button variant="live" to={to} className="!h-9 text-[13px]">
              {t('platform.desk.tables.resume')}
            </Button>
          ) : (
            <>
              {table.status === 'over' && (
                <Button variant="ghost" to={`${to}?analyse=1`} className="!h-9 text-[13px]">
                  {t('platform.desk.tables.analysis')}
                </Button>
              )}
              <Button variant="ghost" to={to} className="!h-9 text-[13px]">
                {table.status === 'open' ? t('platform.desk.tables.room') : t('platform.desk.tables.results')}
              </Button>
            </>
          )}
          <div className="relative">
            <Button variant="icon" aria-label={t('platform.desk.tables.leave')} aria-expanded={menu} onClick={() => setMenu((m) => !m)} icon={<MoreHorizontal size={16} aria-hidden />} />
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-10 z-40 w-52 rounded-lg border border-brass-hairline bg-enamel-800 p-1 shadow-[0_8px_24px_var(--shadow-modal)]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onLeave(table);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-ui text-[13px] font-semibold text-rust-400 transition-colors duration-150 hover:bg-rust-600/10"
                  >
                    <LogOut size={14} aria-hidden />
                    {t('platform.desk.tables.leave')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.li>
  );
}

/** ce que quitter veut dire, selon l'état de la table */
const LEAVE_COPY: Record<DeskTable['status'], string> = { open: 'platform.desk.tables.leaveCopy', playing: 'platform.desk.tables.leaveCopyPlaying', over: 'platform.desk.tables.leaveCopyOver' };
const LEAVE_CONFIRM: Record<DeskTable['status'], string> = { open: 'platform.desk.tables.leaveConfirm', playing: 'platform.desk.tables.leaveConfirm', over: 'platform.desk.tables.leaveConfirmOver' };

function TablesPanel({ tables, me }: { tables: TableSummary[]; me: string }) {
  const t = useT();
  const lang = useLang();
  const [leaving, setLeaving] = useState<DeskTable | null>(null);
  /* les parties jouées sur cet appareil siègent au bureau comme les autres */
  const [locals, setLocals] = useState(listLocalGames);
  const rank = (x: TableSummary) => (x.myTurn ? 0 : x.status === 'playing' ? 1 : x.status === 'open' ? 2 : 3);
  const sorted: DeskTable[] = [...tables].sort((a, b) => rank(a) - rank(b));
  for (const local of locals) sorted.push(localTable(local, me));

  if (sorted.length === 0) {
    return <EmptyState image="/empty-tables.png" title={t('platform.desk.tables.emptyTitle')} copy={t('platform.desk.tables.emptyCopy')} cta={{ label: t('platform.desk.tables.emptyCta'), to: '/online' }} />;
  }

  const leave = () => {
    if (leaving?.local) {
      forgetLocalGame(leaving.code);
      setLocals(listLocalGames());
    } else if (leaving) lobby.leave(leaving.code);
    setLeaving(null);
  };

  return (
    <>
      <ul className="grid gap-3">
        {sorted.map((x, i) => (
          <TableRow key={x.local ? `local:${x.code}` : x.code} table={x} me={me} pulse={i < 3} onLeave={setLeaving} />
        ))}
      </ul>
      <Modal open={leaving !== null} onClose={() => setLeaving(null)} title={leaving ? t('platform.desk.tables.leaveTitle', { name: tableTitle(leaving.name, lang) }) : undefined}>
        <p className="font-ui text-[13px] leading-relaxed text-paper-300">{leaving && t(leaving.local ? 'platform.desk.tables.leaveCopyLocal' : LEAVE_COPY[leaving.status])}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger-ghost" icon={<LogOut size={16} aria-hidden />} onClick={leave}>
            {leaving && t(leaving.local ? 'platform.desk.tables.leaveConfirmLocal' : LEAVE_CONFIRM[leaving.status])}
          </Button>
          <Button variant="ghost" onClick={() => setLeaving(null)}>
            {t('platform.desk.tables.cancel')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------- Panneau B — Invitations --------------------------- */

function InvitationsPanel({ invitations, sent, onAnswer }: { invitations: Invitation[]; sent: Invitation[]; onAnswer: (id: string, accept: boolean) => void }) {
  const t = useT();
  const lang = useLang();
  const ago = useAgo();
  const [showSent, setShowSent] = useState(false);

  if (invitations.length === 0 && sent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 px-6 py-12 text-center">
        <MailOpen size={28} aria-hidden className="text-iron-600" />
        <p className="font-ui text-[14px] font-semibold text-paper-100">{t('platform.desk.invitations.emptyTitle')}</p>
        <p className="max-w-sm font-ui text-[13px] text-iron-400">{t('platform.desk.invitations.emptyCopy')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        <AnimatePresence initial={false}>
          {invitations.map((i) => (
            <motion.li
              key={i.id}
              layout
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.24, ease }}
              className="rounded-xl border border-[rgb(var(--signal-400)/.4)] bg-enamel-850 p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brass-500/60 bg-enamel-700 font-ui text-[14px] font-semibold text-paper-100" aria-hidden>
                  {i.from.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="micro-label text-signal-400">{t('platform.nav.invitations')}</p>
                  <p className="mt-0.5 truncate font-ui text-[14px] font-semibold text-paper-100">{t('platform.desk.invitations.invitedBy', { from: i.from.name, table: tableTitle(i.tableName, lang) })}</p>
                  <p className="data-text mt-0.5 text-[11px] text-iron-400">{ago(i.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="live" className="!h-9 text-[13px]" onClick={() => onAnswer(i.id, true)}>
                    {t('platform.desk.invitations.accept')}
                  </Button>
                  <Button variant="danger-ghost" className="!h-9 text-[13px]" onClick={() => onAnswer(i.id, false)}>
                    {t('platform.desk.invitations.decline')}
                  </Button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {sent.length > 0 && (
        <div className="rounded-xl border border-brass-hairline bg-enamel-850">
          <button type="button" onClick={() => setShowSent((s) => !s)} aria-expanded={showSent} className="flex w-full items-center gap-2 px-4 py-3 font-ui text-[13px] font-semibold text-iron-400 transition-colors duration-150 hover:text-paper-100">
            <ChevronDown size={16} aria-hidden className={cn('transition-transform duration-200', showSent && 'rotate-180')} />
            {t('platform.desk.invitations.sentTitle')}
            <span className="data-text ml-auto text-[11px] tabular-nums text-iron-600">{sent.length}</span>
          </button>
          <motion.div initial={false} animate={{ height: showSent ? 'auto' : 0, opacity: showSent ? 1 : 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
            <ul className="grid gap-1.5 px-4 pb-4">
              {sent.map((i) => (
                <li key={i.id} className="flex items-center gap-2 font-ui text-[13px] text-paper-300">
                  <Send size={12} aria-hidden className="shrink-0 text-brass-300/70" />
                  <span className="truncate">{t('platform.desk.invitations.sentTo', { to: i.to.name, table: tableTitle(i.tableName, lang) })}</span>
                  <span className="micro-label ml-auto shrink-0 rounded bg-enamel-700 px-1.5 py-0.5 text-iron-400">{t('platform.desk.invitations.pending')}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Panneau C — Amis ------------------------------ */

function FriendRow({ friend, table, sent, onInvite, onRemove, onAccept }: { friend: Friend; table: TableSummary | null; sent: boolean; onInvite: () => void; onRemove: () => void; onAccept: () => void }) {
  const t = useT();
  const [menu, setMenu] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-brass-hairline bg-enamel-850 px-3 py-2.5 transition-colors duration-150 hover:bg-enamel-800">
      <span className="relative shrink-0">
        <img src="/avatar-default.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-full border border-brass-hairline" />
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-enamel-850 transition-colors duration-300', friend.online ? 'bg-bottle-400' : 'bg-iron-600')} title={t(friend.online ? 'platform.desk.friends.presenceOnline' : 'platform.desk.friends.presenceOffline')} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-[13px] font-semibold text-paper-100">{friend.account.name}</p>
        <p className="data-text text-[11px] text-iron-400">
          {friend.status === 'asks' ? t('platform.desk.friends.asks') : friend.status === 'asked' ? t('platform.desk.friends.asked') : t(friend.online ? 'platform.desk.friends.presenceOnline' : 'platform.desk.friends.presenceOffline')}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {friend.status === 'asks' && (
          <Button variant="primary" className="!h-8 px-3 text-[12px]" onClick={onAccept}>
            {t('platform.desk.friends.accept')}
          </Button>
        )}
        {friend.status === 'friends' && (
          <Button
            variant="ghost"
            className="!h-8 px-3 text-[12px]"
            disabled={!table || sent}
            title={!table ? t('platform.desk.friends.inviteDisabled') : undefined}
            onClick={onInvite}
          >
            {sent ? t('platform.desk.friends.invited') : t('platform.desk.friends.invite')}
          </Button>
        )}
        <div className="relative">
          <Button variant="icon" className="!h-8 !w-8 border-0" aria-label={t('platform.desk.friends.remove')} aria-expanded={menu} onClick={() => setMenu((m) => !m)} icon={<MoreHorizontal size={16} aria-hidden />} />
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-9 z-40 w-44 rounded-lg border border-brass-hairline bg-enamel-800 p-1 shadow-[0_8px_24px_var(--shadow-modal)]">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onRemove();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-ui text-[13px] font-semibold text-rust-400 transition-colors duration-150 hover:bg-rust-600/10"
                >
                  <X size={14} aria-hidden />
                  {t('platform.desk.friends.remove')}
                </button>
              </div>
            </>
          )}
        </div>
      </span>
    </li>
  );
}

function FriendGroup({ label, tone, friends, children }: { label: string; tone: 'bottle' | 'iron' | 'brass'; friends: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const dot = tone === 'bottle' ? 'bg-bottle-400' : tone === 'brass' ? 'bg-brass-300' : 'bg-iron-600';
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 py-1.5 font-ui text-[13px] font-semibold text-iron-400 transition-colors duration-150 hover:text-paper-100">
        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
        <span className="micro-label">{label}</span>
        <ChevronDown size={14} aria-hidden className={cn('ml-auto transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
        {friends > 0 ? <ul className="grid gap-2 pb-2 pt-1">{children}</ul> : null}
      </motion.div>
    </div>
  );
}

function FriendsPanel({ friends, table, onToast }: { friends: Friend[]; table: TableSummary | null; onToast: (message: string, kind: ToastData['kind']) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [invitedTo, setInvitedTo] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Friend | null>(null);
  const fail = (e: unknown) => setNote(t(`site.desk.error.${(e as Error).message}`));

  const ask = async () => {
    if (!name.trim()) return;
    setNote(null);
    try {
      await befriend(name);
      onToast(t('platform.desk.friends.sent', { name: name.trim() }), 'success');
      setName('');
    } catch (e) {
      fail(e);
    }
  };
  const toTable = async (f: Friend) => {
    if (!table) return;
    setNote(null);
    try {
      await invite(table.code, f.account.name);
      setInvitedTo((s) => new Set(s).add(f.id));
    } catch (e) {
      fail(e);
    }
  };

  const requests = friends.filter((f) => f.status !== 'friends');
  const online = friends.filter((f) => f.status === 'friends' && f.online);
  const offline = friends.filter((f) => f.status === 'friends' && !f.online);

  const row = (f: Friend) => (
    <FriendRow
      key={f.id}
      friend={f}
      table={table && !table.seats.some((s) => s.id === f.account.id) ? table : null}
      sent={invitedTo.has(f.id)}
      onInvite={() => toTable(f)}
      onRemove={() => setRemoving(f)}
      onAccept={() => befriend(f.account.name).catch(fail)}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          maxLength={20}
          placeholder={t('platform.desk.friends.addPlaceholder')}
          aria-label={t('platform.desk.friends.addPlaceholder')}
          className={inputClass}
        />
        <Button variant="primary" className="shrink-0" onClick={ask} disabled={!name.trim()}>
          {t('platform.desk.friends.send')}
        </Button>
      </div>
      <Refusal text={note} />

      {friends.length === 0 ? (
        <EmptyState mini icon={<Users size={20} aria-hidden />} title={t('platform.desk.friends.emptyTitle')} className="!py-10" />
      ) : (
        <div className="grid gap-1">
          {requests.length > 0 && (
            <FriendGroup label={t('platform.desk.friends.requests', { count: requests.length })} tone="brass" friends={requests.length}>
              {requests.map(row)}
            </FriendGroup>
          )}
          <FriendGroup label={t('platform.desk.friends.online', { count: online.length })} tone="bottle" friends={online.length}>
            {online.map(row)}
          </FriendGroup>
          <FriendGroup label={t('platform.desk.friends.offline', { count: offline.length })} tone="iron" friends={offline.length}>
            {offline.map(row)}
          </FriendGroup>
        </div>
      )}
      {friends.some((f) => f.status === 'friends') && !table && <p className="font-ui text-[12px] text-iron-400">{t('platform.desk.friends.noTable')}</p>}

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={removing ? t('platform.desk.friends.removeTitle', { name: removing.account.name }) : undefined}>
        <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.desk.friends.removeCopy')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="danger-ghost"
            onClick={() => {
              if (removing) unfriend(removing.id).catch(fail);
              setRemoving(null);
            }}
          >
            {t('platform.desk.friends.remove')}
          </Button>
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            {t('platform.desk.tables.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------ Registre d'historique (partagé) ------------------------ */

type HistoryFilter = 'all' | 'won' | 'lost' | 'abandoned';

function HistoryRow({ game, me }: { game: PastGame; me: string }) {
  const t = useT();
  const lang = useLang();
  const mine = game.players.findIndex((p) => p.id === me);
  const won = game.winner === mine;
  const date = new Date(game.finishedAt).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short' });
  const time = new Date(game.finishedAt).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });
  const pastille = game.abandoned
    ? { letter: 'A', label: t('platform.desk.history.abandonedGame'), cls: 'border-iron-600 text-iron-400' }
    : won
      ? { letter: 'V', label: t('platform.desk.history.won'), cls: 'border-bottle-500 bg-bottle-700/40 text-bottle-400' }
      : { letter: 'D', label: t('platform.desk.history.lost'), cls: 'border-rust-600/70 bg-rust-700/25 text-rust-400' };

  return (
    <tr className="border-b border-[rgb(var(--paper-100)/.06)] transition-colors duration-150 last:border-b-0 hover:bg-enamel-700/50">
      <td className="py-2.5 pl-2 pr-3">
        <span title={pastille.label} className={cn('flex h-6 w-6 items-center justify-center rounded-full border font-ui text-[12px] font-semibold', pastille.cls)}>
          {pastille.letter}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <span className="font-ui text-[13px] font-semibold text-paper-100">{tableTitle(game.name, lang)}</span>
        <span className="data-text ml-2 text-[10px] uppercase tracking-[0.2em] text-iron-600">{game.code}</span>
      </td>
      <td className="py-2.5 pr-3">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {game.players.map((p, i) => (
            <li key={i} className={cn('inline-flex items-center gap-1 font-ui text-[12px]', i === game.winner ? 'text-brass-300' : 'text-paper-300/80')}>
              <PlayerToken color={p.color} size={12} />
              {p.name} <span className="data-text text-[10px] opacity-70">{t('platform.desk.history.vp', { vp: p.vp })}</span>
            </li>
          ))}
        </ul>
      </td>
      <td className="py-2.5 pr-2 text-right">
        <span className="data-text whitespace-nowrap text-[11px] text-iron-400">
          {date} · {time}
        </span>
      </td>
    </tr>
  );
}

/** Le registre des parties passées — utilisé par le bureau et le profil. */
export function HistoryLedger({ history, me, pageSize = 10 }: { history: PastGame[]; me: string; pageSize?: number }) {
  const t = useT();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [shown, setShown] = useState(pageSize);

  const matches = (g: PastGame) => {
    const won = g.players.findIndex((p) => p.id === me) === g.winner;
    if (filter === 'won') return won && !g.abandoned;
    if (filter === 'lost') return !won && !g.abandoned;
    if (filter === 'abandoned') return g.abandoned;
    return true;
  };
  const filtered = history.filter(matches);
  const chips: { id: HistoryFilter; label: string }[] = [
    { id: 'all', label: t('platform.desk.history.all') },
    { id: 'won', label: t('platform.desk.history.wins') },
    { id: 'lost', label: t('platform.desk.history.losses') },
    { id: 'abandoned', label: t('platform.desk.history.abandoned') },
  ];

  if (history.length === 0) {
    return <EmptyState image="/empty-tables.png" title={t('platform.desk.history.emptyTitle')} copy={t('platform.desk.history.emptyCopy')} cta={{ label: t('platform.desk.history.emptyCta'), to: '/online' }} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('platform.desk.tabs.history')}>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => {
              setFilter(c.id);
              setShown(pageSize);
            }}
            className={cn(
              'rounded-full border px-3 py-1 font-ui text-[12px] font-semibold transition-colors duration-150',
              filter === c.id ? 'border-brass-500 bg-brass-500/10 text-brass-300' : 'border-[rgb(var(--paper-100)/.14)] text-iron-400 hover:border-[rgb(var(--paper-100)/.3)] hover:text-paper-100',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center font-ui text-[13px] text-iron-400">{t('platform.desk.history.emptyTitle')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brass-hairline bg-enamel-850">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-brass-hairline">
                <th className="micro-label py-2.5 pl-2 pr-3 text-iron-400">{t('platform.desk.history.result')}</th>
                <th className="micro-label py-2.5 pr-3 text-iron-400">{t('platform.desk.history.table')}</th>
                <th className="micro-label py-2.5 pr-3 text-iron-400">{t('platform.desk.history.players')}</th>
                <th className="micro-label py-2.5 pr-2 text-right text-iron-400">{t('platform.desk.history.date')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, shown).map((g, i) => (
                <HistoryRow key={g.code + g.finishedAt + i} game={g} me={me} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > shown && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => setShown((n) => n + pageSize)}>
            {t('platform.desk.history.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Panneau E — Statistiques --------------------------- */

/** La carte de cote : le chiffre, le rang et sa division, les placements, la saison. */
function RatingCard({ rating, season }: { rating: Rating | null; season: Season | null }) {
  const t = useT();
  const lang = useLang();
  const rank = rankOf(rating);
  const head = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="title-card">{t('platform.desk.rating.title')}</h3>
        {season && <span className="data-text text-[12px] tabular-nums text-iron-400">{t('platform.desk.rating.season', { season: season.name, days: daysUntil(season.endsAt) })}</span>}
      </div>
      <div className="mt-3 h-px bg-brass-hairline" />
    </>
  );

  if (!rating) {
    return (
      <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-5">
        {head}
        <p className="py-8 text-center font-ui text-[13px] text-iron-400">{t('platform.desk.rating.empty')}</p>
      </div>
    );
  }

  const prev = rating.trend.length > 1 ? rating.trend[rating.trend.length - 2] : null;
  const delta = prev === null ? 0 : rating.rating - prev;
  const next = nextOf(rank);
  const placing = rank.placementDone !== null;

  return (
    <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-5">
      {head}
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
        <div>
          <p className="micro-label text-iron-400">{t('platform.desk.rating.cote')}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-fraunces text-[40px] font-semibold leading-none text-paper-100 tnums">{cote(rating.rating, lang)}</span>
            {delta !== 0 && (
              <span className={cn('data-text text-[13px]', delta > 0 ? 'text-bottle-400' : 'text-rust-400')}>
                {delta > 0 ? `+${delta}` : delta} <span className="text-iron-600">· {t('platform.desk.rating.lastGame')}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RankBadge tier={rank.tier} division={rank.division} size={48} compact />
          <div>
            {placing ? (
              <p className="micro-label text-brass-300">{t('platform.rank.placement', { done: rank.placementDone ?? 0, total: PLACEMENTS })}</p>
            ) : (
              <p className="font-fraunces text-[22px] font-semibold leading-none text-paper-100">
                {t(`platform.rank.${rank.tier}`)}
                {rank.division ? ` ${rank.division}` : ''}
              </p>
            )}
            <p className="data-text mt-1.5 text-[12px] text-iron-400">
              {placing ? t('platform.desk.rating.placements', { done: rank.placementDone ?? 0, total: PLACEMENTS }) : t('platform.desk.rating.firm', { won: rating.won, games: rating.games })}
            </p>
          </div>
        </div>
        <div className="ml-auto" title={t('platform.desk.rating.trend')}>
          <Sparkline values={rating.trend} width={120} height={32} />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="micro-label text-iron-400">
            {placing ? t('platform.rank.placement', { done: rank.placementDone ?? 0, total: PLACEMENTS }) : next ? t('platform.desk.rating.toNext', { tier: t(`platform.rank.${next.tier}`), division: next.division }) : t('platform.desk.rating.top')}
          </span>
          {rank.lp !== undefined && <span className="data-text text-[12px] tabular-nums text-iron-400">{t('platform.rank.lp', { lp: rank.lp })}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-enamel-700">
          <motion.div initial={{ width: 0 }} animate={{ width: `${rank.progress}%` }} transition={{ duration: 0.5, ease }} className="h-full rounded-full bg-brass-500" />
        </div>
      </div>
    </div>
  );
}

function StatsPanel() {
  const t = useT();
  const desk = useDesk();
  const stats = desk?.stats;
  const rate = stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—';
  const tiles: { value: string | number; label: string }[] = [
    { value: stats?.played ?? 0, label: t('platform.desk.stats.played') },
    { value: stats?.won ?? 0, label: t('platform.desk.stats.won') },
    { value: rate, label: t('platform.desk.stats.rate') },
    { value: stats?.averageVp ?? 0, label: t('platform.desk.stats.average') },
    { value: stats?.bestVp ?? 0, label: t('platform.desk.stats.best') },
    { value: stats?.averagePlace ? stats.averagePlace : '—', label: t('platform.desk.stats.place') },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 min-[760px]:grid-cols-3">
        {tiles.map((tile, i) => (
          <motion.div key={tile.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: i * 0.05 }}>
            <StatTile value={tile.value} label={tile.label} className="h-full" />
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: tiles.length * 0.05 }}>
        <RatingCard rating={desk?.rating ?? null} season={desk?.season ?? null} />
      </motion.div>
    </div>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function Desk() {
  const t = useT();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const session = useSession();
  const stranger = useStranger();
  const desk = useDesk();
  const [active, setActive] = useState<TabId>(() => (isTab(hash.slice(1)) ? (hash.slice(1) as TabId) : 'tables'));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, kind: ToastData['kind'] = 'info') => setToast({ id: Date.now(), message, kind });

  /* pas de serveur, pas de bureau : le hall local prend le relais (contrat) */
  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
  }, [navigate]);

  /* comptoir : encaisse les jetons de la dernière partie (idempotent) */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const gain = collectRewards();
      if (gain) showToast(tr('platform.comptoir.toastCollected', { count: gain.delta }), 'success');
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /* une ancre (#tables, #invitations, #amis, #historique, #stats) ouvre l'onglet */
  useEffect(() => {
    const id = hash.slice(1);
    if (!isTab(id)) return;
    const raf = requestAnimationFrame(() => {
      setActive(id as TabId);
      requestAnimationFrame(() => document.getElementById(TAB_IDS[id as TabId])?.scrollIntoView({ block: 'start' }));
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);

  const answer = async (id: string, accept: boolean) => {
    setError(null);
    try {
      const to = await answerInvitation(id, accept);
      if (to) navigate(`/online/${to}`);
      else if (!accept) showToast(t('platform.desk.invitations.declined'));
    } catch (e) {
      setError(t(`site.desk.error.${(e as Error).message}`));
    }
  };

  /* le jeton est en chemin : attendre avant de trancher membre / étranger */
  if (!stranger && !session) return null;

  if (stranger || !session) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-850 px-8 py-12 text-center">
          <UserX size={32} aria-hidden className="text-iron-600" />
          <h1 className="h2-section">{t('platform.desk.stranger.title')}</h1>
          <p className="font-ui text-[13px] text-paper-300">{t('platform.desk.stranger.copy')}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button variant="primary" to="/account">
              {t('platform.desk.stranger.signIn')}
            </Button>
            <Button variant="ghost" to="/online">
              {t('platform.desk.stranger.guest')}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const me = session.id;
  const tables = desk?.tables ?? [];
  const turnCount = tables.filter((x) => x.myTurn).length;
  const inviteCount = desk?.invitations.length ?? 0;
  const onlineCount = (desk?.friends ?? []).filter((f) => f.status === 'friends' && f.online).length;
  /* la table ouverte que j'héberge, s'il y en a une : les amis y sont invités en un clic */
  const hosting = tables.find((x) => x.status === 'open' && x.hostId === me && x.seats.length < 4) ?? null;

  const panels: Record<TabId, React.ReactNode> = {
    tables: <TablesPanel tables={tables} me={me} />,
    invitations: <InvitationsPanel invitations={desk?.invitations ?? []} sent={desk?.sent ?? []} onAnswer={answer} />,
    amis: <FriendsPanel friends={desk?.friends ?? []} table={hosting} onToast={showToast} />,
    historique: <HistoryLedger history={desk?.history ?? []} me={me} />,
    stats: <StatsPanel />,
  };

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
      <MemberHeader />
      <TutorialStrip />
      <div className="mt-4">
        <VerifyBanner />
      </div>
      <Refusal text={error} />

      <div className="mt-8 flex flex-col gap-8 min-[900px]:flex-row">
        <TabRail active={active} onChange={setActive} turnCount={turnCount} inviteCount={inviteCount} onlineCount={onlineCount} />
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.section key={active} id={TAB_IDS[active]} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease }} className="scroll-mt-24">
              {panels[active]}
            </motion.section>
          </AnimatePresence>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
