import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Crown, GraduationCap, KeyRound, Mail, Send, UserPlus, X } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import VerifyBanner from '@/components/site/VerifyBanner';
import PlayerToken from '@/components/setup/PlayerToken';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import { startTutorial } from '@/game/quickplay';
import { isOnline, lobby, normalizeCode } from '@/online/lobby';
import { answerInvitation, befriend, invite, unfriend, useDesk, useLine, useSession, useStranger } from '@/online/session';
import type { Friend, PastGame, TableSummary } from '@/online/table';
import { useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The desk — the player's own room in the house. Whose move it is,   */
/* first; then the tables, the letters, a door to open a table or to   */
/* answer a code, and the ledger of past games.                        */
/* ------------------------------------------------------------------ */

function Status({ table }: { table: TableSummary }) {
  const t = useT();
  const tone = table.myTurn ? 'border-brass-400 bg-brass-500/20 text-brass-400' : table.status === 'playing' ? 'border-bottle-600/70 text-bottle-600 brightness-150' : table.status === 'over' ? 'border-cream-100/20 text-cream-100/45' : 'border-brass-700/60 text-cream-100/70';
  return <span className={cn('rounded-sm border px-1.5 py-[2px] font-sans text-[9.5px] font-bold uppercase tracking-[0.14em]', tone)}>{table.myTurn ? t('site.desk.yourMove') : t(`site.desk.status.${table.status}`)}</span>;
}

function TableCard({ table, me }: { table: TableSummary; me: string }) {
  const t = useT();
  const toAct = table.current !== undefined ? table.seats[table.current] : null;
  const to = table.status === 'open' ? `/online/${table.code}` : `/game/${table.code}`;
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('plate relative p-4', table.myTurn && 'ring-1 ring-brass-400/70')}>
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-[19px] font-bold text-cream-100">{table.name}</h3>
            <Status table={table} />
            {table.hostId === me && <Crown className="h-3.5 w-3.5 text-brass-400" aria-label={t('online.room.host')} />}
          </div>
          <p className="mt-1 font-mono text-[11px] text-cream-100/50">
            {t('site.desk.code')} <span className="tracking-[0.3em] text-brass-400">{table.code}</span>
            {table.era && (
              <>
                {' · '}
                {t(`site.desk.era.${table.era}`)} {t('site.desk.round', { round: table.round ?? 1 })}
              </>
            )}
            {toAct && table.status === 'playing' && !table.myTurn && <> · {t('site.desk.toAct', { name: toAct.name })}</>}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {table.seats.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-brass-700/40 bg-coal-900/70 py-0.5 pl-1 pr-2.5">
                <PlayerToken color={s.color} size={16} />
                <span className={cn('font-sans text-[11.5px] font-semibold', s.id === me ? 'text-brass-400' : 'text-cream-100/85')}>{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link to={to} className={cn(table.myTurn ? 'btn-strike' : 'btn-ledger', '!min-h-[38px] !px-4 !py-1.5 !text-[11px]')}>
          {table.status === 'open' ? t('site.desk.room') : table.status === 'over' ? t('site.desk.results') : t('site.desk.enter')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.li>
  );
}

function PastRow({ game, me }: { game: PastGame; me: string }) {
  const t = useT();
  const lang = useLang();
  const mine = game.players.findIndex((p) => p.id === me);
  const won = game.winner === mine;
  const date = new Date(game.finishedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <tr className="border-b border-brass-700/20 last:border-b-0">
      <td className="py-2.5 pr-3 font-mono text-[11px] text-cream-100/45">{date}</td>
      <td className="py-2.5 pr-3">
        <span className="font-display text-[15px] font-bold text-cream-100">{game.name}</span>
        <span className="ml-2 font-mono text-[10px] tracking-[0.2em] text-cream-100/40">{game.code}</span>
      </td>
      <td className="py-2.5 pr-3">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {game.players.map((p, i) => (
            <li key={i} className={cn('inline-flex items-center gap-1 font-sans text-[11.5px]', i === game.winner ? 'text-brass-400' : 'text-cream-100/70')}>
              <PlayerToken color={p.color} size={12} />
              {p.name} <span className="font-mono text-[10px] opacity-70">{p.vp}</span>
            </li>
          ))}
        </ul>
      </td>
      <td className="py-2.5 text-right">
        <span className={cn('rounded-sm border px-1.5 py-[2px] font-sans text-[9.5px] font-bold uppercase tracking-[0.14em]', game.abandoned ? 'border-cream-100/20 text-cream-100/45' : won ? 'border-brass-400 text-brass-400' : 'border-rust-500/60 text-rust-500 brightness-150')}>
          {game.abandoned ? t('site.desk.abandoned') : won ? t('site.desk.won') : t('site.desk.lost')}
        </span>
      </td>
    </tr>
  );
}

/** the friends: ask by name, answer, and one click to a table I host */
function FriendsPanel({ friends, table }: { friends: Friend[]; table: TableSummary | null }) {
  const t = useT();
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const fail = (e: unknown) => setNote(t(`site.desk.error.${(e as Error).message}`));
  const ask = async () => {
    if (!name.trim()) return;
    setNote(null);
    try {
      await befriend(name);
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
      setSent((s) => new Set(s).add(f.id));
    } catch (e) {
      fail(e);
    }
  };
  return (
    <Panel title={t('site.friends.title')} meta={friends.filter((f) => f.status === 'friends').length}>
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 shrink-0 text-brass-400" />
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={20} placeholder={t('site.friends.placeholder')} className={inputClass} />
        <button type="button" onClick={ask} disabled={!name.trim()} className="btn-ledger !min-h-[38px] !px-3 !py-1.5 !text-[11px] disabled:cursor-not-allowed disabled:opacity-40">
          {t('site.friends.addCta')}
        </button>
      </div>
      <Refusal text={note} />
      {friends.length === 0 ? (
        <p className="mt-3 font-serif text-[14px] italic text-cream-100/55">{t('site.friends.none')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {friends.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brass-700/40 bg-coal-950/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', f.online ? 'bg-bottle-600' : 'bg-cream-100/25')} title={t(f.online ? 'site.friends.online' : 'site.friends.offline')} />
                <span className="font-sans text-[12.5px] font-semibold text-cream-100">{f.account.name}</span>
                {f.status !== 'friends' && <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-cream-100/45">{t(`site.friends.${f.status}`)}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                {f.status === 'asks' && (
                  <button type="button" onClick={() => befriend(f.account.name).catch(fail)} className="btn-strike !min-h-[28px] !px-2.5 !py-0.5 !text-[10px]">
                    {t('site.friends.accept')}
                  </button>
                )}
                {f.status === 'friends' && table && !table.seats.some((s) => s.id === f.account.id) && (
                  <button type="button" onClick={() => toTable(f)} disabled={sent.has(f.id)} className="btn-ledger !min-h-[28px] !px-2.5 !py-0.5 !text-[10px] disabled:opacity-50">
                    {sent.has(f.id) ? t('site.friends.invited') : t('site.friends.inviteToTable', { table: table.name })}
                  </button>
                )}
                <button type="button" onClick={() => unfriend(f.id).catch(fail)} aria-label={f.status === 'asks' ? t('site.friends.decline') : t('site.friends.remove')} title={f.status === 'asks' ? t('site.friends.decline') : t('site.friends.remove')} className="rounded-full p-1 text-cream-100/35 hover:text-rust-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {friends.some((f) => f.status === 'friends') && !table && <p className="mt-2 font-sans text-[11px] text-cream-100/45">{t('site.friends.noTable')}</p>}
    </Panel>
  );
}

export default function Desk() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const stranger = useStranger();
  const line = useLine();
  const desk = useDesk();
  const [tableName, setTableName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) navigate('/online', { replace: true });
    else if (stranger) navigate('/account', { replace: true });
  }, [stranger, navigate]);

  const fail = (e: unknown) => setError(t(`site.desk.error.${(e as Error).message}`));
  const create = async () => {
    if (!session) return;
    setError(null);
    try {
      const table = await lobby.create(tableName.trim() || t('site.desk.defaultName', { name: session.name }), { ...DEFAULT_OPTIONS }, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      fail(e);
    }
  };
  const join = async () => {
    if (code.length < 4) return;
    setError(null);
    try {
      await lobby.join(code, session?.favoriteColor ?? undefined);
      navigate(`/online/${code}`);
    } catch (e) {
      fail(e);
    }
  };
  const answer = async (id: string, accept: boolean) => {
    setError(null);
    try {
      const to = await answerInvitation(id, accept);
      if (to) navigate(`/online/${to}`);
    } catch (e) {
      fail(e);
    }
  };

  if (!session) return null;
  const me = session.id;
  const tables = desk?.tables ?? [];
  const mine = tables.filter((x) => x.myTurn);
  const rest = tables.filter((x) => !x.myTurn);
  const stats = desk?.stats;
  /* the open table I host, if any: friends can be asked to it in one click */
  const hosting = tables.find((x) => x.status === 'open' && x.hostId === me && x.seats.length < 4) ?? null;

  return (
    <PageShell
      eyebrow={t('site.desk.eyebrow')}
      title={t('site.desk.title', { name: session.name })}
      lede={t('site.desk.lede')}
      aside={
        <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.16em]', line === 'online' ? 'border-bottle-600/70 text-bottle-600 brightness-150' : 'border-rust-500/70 text-rust-500 brightness-150')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', line === 'online' ? 'bg-bottle-600' : 'bg-rust-500', line === 'connecting' && 'animate-pulse')} />
          {t(`site.nav.line.${line}`)}
        </span>
      }
    >
      <VerifyBanner />
      <Refusal text={error} />

      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          {mine.length > 0 && (
            <Panel title={t('site.desk.yourMove')} meta={mine.length}>
              <ul className="grid gap-3">
                {mine.map((x) => (
                  <TableCard key={x.code} table={x} me={me} />
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={t('site.desk.yourTables')} meta={tables.length}>
            {rest.length === 0 && mine.length === 0 ? (
              <p className="font-serif text-[15px] italic text-cream-100/55">{t('site.desk.noTables')}</p>
            ) : (
              <ul className="grid gap-3">
                {rest.map((x) => (
                  <TableCard key={x.code} table={x} me={me} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t('site.desk.history')} meta={desk?.history.length ?? 0}>
            {!desk || desk.history.length === 0 ? (
              <p className="font-serif text-[15px] italic text-cream-100/55">{t('site.desk.noHistory')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <tbody>
                    {desk.history.map((g) => (
                      <PastRow key={g.code + g.finishedAt} game={g} me={me} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title={t('site.tutorial.title')} tone="paper">
            <p className="font-serif text-[14px] leading-relaxed text-ink-900/75">{t('site.tutorial.copy')}</p>
            <button
              type="button"
              onClick={() => {
                startTutorial();
                navigate('/game');
              }}
              className="btn-ledger mt-3 !border-ink-900/60 !text-ink-900 hover:!bg-ink-900/10"
            >
              <GraduationCap className="h-4 w-4" /> {t('site.tutorial.cta')}
            </button>
          </Panel>

          <Panel title={t('site.desk.open')}>
            <p className="font-serif text-[14px] leading-relaxed text-cream-100/65">{t('site.desk.openCopy')}</p>
            <div className="mt-4 grid gap-3">
              <Field id="desk-table" label={t('site.desk.tableName')}>
                <input id="desk-table" value={tableName} onChange={(e) => setTableName(e.target.value)} maxLength={28} placeholder={t('site.desk.tablePlaceholder')} onKeyDown={(e) => e.key === 'Enter' && create()} className={inputClass} />
              </Field>
              <button type="button" onClick={create} disabled={!session.verified} className="btn-strike disabled:cursor-not-allowed disabled:opacity-40">
                {t('site.desk.openCta')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </Panel>

          <Panel title={t('site.desk.join')}>
            <p className="font-serif text-[14px] leading-relaxed text-cream-100/65">{t('site.desk.joinCopy')}</p>
            <div className="mt-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-brass-400" />
              <input
                aria-label={t('site.desk.code')}
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                maxLength={4}
                spellCheck={false}
                placeholder="····"
                className="w-[7.5rem] rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-1.5 text-center font-mono text-[20px] font-bold uppercase tracking-[0.4em] text-brass-400 placeholder:text-brass-700/50 focus:border-brass-400 focus:outline-none"
              />
              <button type="button" onClick={join} disabled={code.length < 4 || !session.verified} className="btn-ledger !min-h-[38px] !px-4 !py-1.5 !text-[11px] disabled:cursor-not-allowed disabled:opacity-40">
                {t('site.desk.joinCta')}
              </button>
            </div>
          </Panel>

          <Panel title={t('site.desk.invitations')} meta={desk?.invitations.length ?? 0}>
            {!desk || (desk.invitations.length === 0 && desk.sent.length === 0) ? (
              <p className="font-serif text-[14px] italic text-cream-100/55">{t('site.desk.noInvitations')}</p>
            ) : (
              <ul className="grid gap-3">
                {desk.invitations.map((i) => (
                  <li key={i.id} className="rounded-md border border-brass-500/50 bg-coal-950/50 p-3">
                    <p className="flex items-start gap-2 font-serif text-[14px] leading-snug text-cream-100/90">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
                      {t('site.desk.invitedBy', { from: i.from.name, table: i.tableName })}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 pl-6">
                      <button type="button" onClick={() => answer(i.id, true)} className="btn-strike !min-h-[32px] !px-3 !py-1 !text-[10.5px]">
                        {t('site.desk.accept')}
                      </button>
                      <button type="button" onClick={() => answer(i.id, false)} className="font-sans text-[10.5px] font-bold uppercase tracking-[0.14em] text-cream-100/50 hover:text-rust-500">
                        {t('site.desk.decline')}
                      </button>
                    </div>
                  </li>
                ))}
                {desk.sent.length > 0 && (
                  <li>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-100/40">{t('site.desk.sent')}</p>
                    <ul className="mt-1.5 grid gap-1">
                      {desk.sent.map((i) => (
                        <li key={i.id} className="flex items-center gap-2 font-sans text-[12px] text-cream-100/65">
                          <Send className="h-3 w-3 text-brass-400/70" />
                          {t('site.desk.sentTo', { to: i.to.name, table: i.tableName })}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            )}
          </Panel>

          <FriendsPanel friends={desk?.friends ?? []} table={hosting} />

          <Panel title={t('site.desk.stats.title')} tone="paper">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(
                [
                  ['played', stats?.played ?? 0],
                  ['won', stats?.won ?? 0],
                  ['rate', stats && stats.played ? `${Math.round((stats.won / stats.played) * 100)} %` : '—'],
                  ['average', stats?.averageVp ?? 0],
                  ['best', stats?.bestVp ?? 0],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900/55">{t(`site.desk.stats.${k}`)}</dt>
                  <dd className="font-display text-[24px] font-black leading-none text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
