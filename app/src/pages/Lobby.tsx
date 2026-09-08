import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Cog, Copy, Crown, LogOut, Plus, Send, X } from 'lucide-react';
import HouseRules from '@/components/setup/HouseRules';
import PlayerToken from '@/components/setup/PlayerToken';
import { DIFFICULTIES, PLAYER_COLORS, SETUP_STORAGE_KEY } from '@/components/setup/constants';
import type { BotDifficulty, PlayerColor } from '@/components/setup/constants';
import { MAX_SEATS, canStart, freeColor, isOnline, lobby, setupFromTable, useTable } from '@/online/lobby';
import { invite, useDesk, useStranger } from '@/online/session';
import type { Table, TableSeat } from '@/online/lobby';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Lobby — the room behind a table code. Place cards on parchment for  */
/* every seat (host seal, "ready" ink stamp, a clockwork badge for the */
/* bots, dashed empty chairs), the house rules the host sets, a brass  */
/* plaque with the code to pass around, and the bell to start. Guests  */
/* pick their colour and stamp themselves ready.                       */
/* ------------------------------------------------------------------ */

const BOT_NAMES = ['Ada', 'Bob', 'Cy', 'Di', 'Eli', 'Fay'];

function PlaceCard({
  seat,
  table,
  isMe,
  isHostSeat,
  iAmHost,
  onColor,
  onReady,
  onRemove,
  onDifficulty,
  onMinutes,
}: {
  seat: TableSeat;
  table: Table;
  isMe: boolean;
  isHostSeat: boolean;
  iAmHost: boolean;
  onColor: (c: PlayerColor) => void;
  onReady: () => void;
  onRemove: () => void;
  onDifficulty: (d: BotDifficulty) => void;
  onMinutes: (m: number | null | undefined) => void;
}) {
  const t = useT();
  const bot = seat.kind === 'bot';
  const taken = new Set(table.seats.filter((s) => s.id !== seat.id).map((s) => s.color));
  const ready = bot || seat.ready;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn('paper relative overflow-hidden p-4 pl-5', isMe && 'ring-2 ring-brass-400/70')}
    >
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.35]" />
      {/* the player's colour, a band down the left edge like the cards */}
      <span aria-hidden className="absolute bottom-2 left-2 top-2 w-[3px] rounded-full" style={{ backgroundColor: PLAYER_COLORS.find((c) => c.id === seat.color)?.hex }} />
      <div className="relative flex items-start gap-3">
        <PlayerToken color={seat.color} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-serif text-[20px] italic leading-tight text-ink-900">{seat.name || '…'}</span>
            {isHostSeat && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-ink-900/50 px-1.5 py-[1px] font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-ink-900/80" title={t('online.room.host')}>
                <Crown className="h-3 w-3" /> {t('online.room.host')}
              </span>
            )}
            {isMe && <span className="rounded-sm bg-ink-900/85 px-1.5 py-[1px] font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-cream-100">{t('online.room.you')}</span>}
            {bot && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-ink-900/40 px-1.5 py-[1px] font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-ink-900/70">
                <Cog className="h-3 w-3" /> {t('online.room.bot')}
              </span>
            )}
          </div>
          {/* the colour swatches: yours to pick, the host's for a bot */}
          {(isMe || (bot && iAmHost)) && (
            <div className="mt-2 flex items-center gap-1.5">
              {PLAYER_COLORS.map((c) => {
                const mine = c.id === seat.color;
                const busy = taken.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onColor(c.id)}
                    aria-label={t(`setup.colors.${c.id}`)}
                    aria-pressed={mine}
                    className={cn('h-5 w-5 rounded-full border-2 transition-transform', mine ? 'scale-110 border-ink-900' : busy ? 'cursor-not-allowed border-transparent opacity-30' : 'border-transparent hover:scale-110')}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
          )}
          {bot && iAmHost && (
            <div className="mt-2 flex gap-1">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={seat.difficulty === d.id}
                  onClick={() => onDifficulty(d.id)}
                  className={cn('rounded-sm border px-1.5 py-[2px] font-sans text-[9px] font-bold uppercase tracking-[0.12em]', seat.difficulty === d.id ? 'border-ink-900 bg-ink-900 text-cream-100' : 'border-ink-900/30 text-ink-900/60 hover:border-ink-900/60')}
                >
                  {t(`setup.difficulty.${d.id}.label`)}
                </button>
              ))}
            </div>
          )}
          {bot && !iAmHost && <p className="mt-1 font-sans text-[11px] text-ink-900/60">{t(`setup.difficulty.${seat.difficulty ?? 'industrialist'}.label`)}</p>}
          {/* this seat's candle: the table's, none (a beginner takes their time), or its own minutes */}
          {!bot && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="mr-1 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-900/50">{t('site.room.candle')}</span>
              {iAmHost ? (
                ([undefined, null, 3, 5, 10] as const).map((m) => {
                  const on = seat.minutes === m;
                  return (
                    <button
                      key={String(m)}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMinutes(m)}
                      className={cn('rounded-sm border px-1.5 py-[2px] font-sans text-[9px] font-bold uppercase tracking-[0.12em]', on ? 'border-ink-900 bg-ink-900 text-cream-100' : 'border-ink-900/30 text-ink-900/60 hover:border-ink-900/60')}
                    >
                      {m === undefined ? t('site.room.candleTable') : m === null ? t('site.room.candleNone') : t('site.room.candleMin', { n: m })}
                    </button>
                  );
                })
              ) : (
                <span className="font-sans text-[10px] text-ink-900/70">{seat.minutes === undefined ? t('site.room.candleTable') : seat.minutes === null ? t('site.room.candleNone') : t('site.room.candleMin', { n: seat.minutes })}</span>
              )}
            </div>
          )}
        </div>
        {/* remove: the host clears any seat but their own, a guest only leaves */}
        {iAmHost && !isHostSeat && (
          <button type="button" onClick={onRemove} aria-label={t('online.room.remove')} title={t('online.room.remove')} className="rounded-full p-1 text-ink-900/40 hover:bg-ink-900/10 hover:text-ink-900">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* the ink stamp: READY, or the pale "waiting" — yours is a button */}
      <div className="relative mt-3 flex items-center justify-between">
        {isMe ? (
          <button
            type="button"
            onClick={onReady}
            aria-pressed={seat.ready}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm border-2 px-2.5 py-1 font-sans text-[11px] font-black uppercase tracking-[0.2em] transition-colors',
              seat.ready ? 'rotate-[-2deg] border-bottle-600 text-bottle-600' : 'border-ink-900/30 text-ink-900/50 hover:border-ink-900/60 hover:text-ink-900/80',
            )}
          >
            {seat.ready ? <Check className="h-3.5 w-3.5" /> : null}
            {seat.ready ? t('online.room.ready') : t('online.room.imReady')}
          </button>
        ) : (
          <span className={cn('inline-flex items-center gap-1.5 rounded-sm border-2 px-2.5 py-1 font-sans text-[11px] font-black uppercase tracking-[0.2em]', ready ? 'rotate-[-2deg] border-bottle-600 text-bottle-600' : 'border-ink-900/20 text-ink-900/35')}>
            {ready && <Check className="h-3.5 w-3.5" />}
            {ready ? t('online.room.ready') : t('online.room.waiting')}
          </span>
        )}
      </div>
    </motion.li>
  );
}

/** an empty chair — the host may seat a mechanical player there */
function EmptyChair({ iAmHost, onAddBot }: { iAmHost: boolean; onAddBot: () => void }) {
  const t = useT();
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-brass-700/50 bg-coal-950/30 p-4 text-center">
      <span className="font-fell text-[13px] uppercase tracking-[0.14em] text-cream-100/40">{t('online.room.emptySeat')}</span>
      {iAmHost && (
        <button type="button" onClick={onAddBot} className="inline-flex items-center gap-1.5 rounded-md border border-brass-700/60 px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-brass-400 transition-colors hover:border-brass-400">
          <Plus className="h-3.5 w-3.5" /> {t('online.room.addBot')}
        </button>
      )}
    </motion.li>
  );
}

/** a letter to a player by name — their desk gets it at once */
function InviteBox({ code, seated }: { code: string; seated: string[] }) {
  const t = useT();
  const desk = useDesk();
  const [name, setName] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (who = name) => {
    if (!who.trim()) return;
    try {
      await invite(code, who);
      setNote({ ok: true, text: t('site.room.invited', { name: who.trim() }) });
      setName('');
    } catch (e) {
      setNote({ ok: false, text: t(`site.desk.error.${(e as Error).message}`) });
    }
  };
  const friends = (desk?.friends ?? []).filter((f) => f.status === 'friends' && !seated.includes(f.account.id));
  return (
    <div className="relative mt-4 rounded-md border border-brass-700/50 bg-coal-950/50 px-4 py-3">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-400/80">{t('site.room.invite')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={20}
          placeholder={t('site.room.invitePlaceholder')}
          className="w-[14rem] rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-1.5 font-sans text-[13px] text-cream-100 placeholder:text-cream-100/30 focus:border-brass-400 focus:outline-none"
        />
        <button type="button" onClick={() => send()} disabled={!name.trim()} className="btn-ledger !min-h-[34px] !px-3.5 !py-1 !text-[10.5px] disabled:cursor-not-allowed disabled:opacity-40">
          <Send className="h-3.5 w-3.5" /> {t('site.room.inviteCta')}
        </button>
        <span className="font-sans text-[11px] text-cream-100/45">{t('site.room.inviteHint')}</span>
      </div>
      {friends.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.16em] text-cream-100/40">{t('site.friends.chips')}</span>
          {friends.map((f) => (
            <button key={f.id} type="button" onClick={() => send(f.account.name)} className="inline-flex items-center gap-1.5 rounded-full border border-brass-700/50 py-0.5 pl-2 pr-2.5 font-sans text-[11px] font-semibold text-cream-100/85 transition-colors hover:border-brass-400 hover:text-brass-400">
              <span className={cn('h-1.5 w-1.5 rounded-full', f.online ? 'bg-bottle-600' : 'bg-cream-100/25')} />
              {f.account.name}
            </button>
          ))}
        </div>
      )}
      {note && <p className={cn('mt-2 font-sans text-[12px]', note.ok ? 'text-bottle-600 brightness-150' : 'text-rust-500 brightness-150')}>{note.text}</p>}
    </div>
  );
}

export default function Lobby() {
  const t = useT();
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const stranger = useStranger();
  const table = useTable(code);
  const me = lobby.me;

  /* a room is no place for a stranger: the office signs you in first.
     A session on its way back is not a stranger — we wait for it. The code
     travels with them, so an invitation survives the visitors' book. */
  useEffect(() => {
    if (isOnline && stranger) navigate(`/online?table=${code}`, { replace: true });
  }, [stranger, code, navigate]);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);

  /* the table has been rung: everyone at it sits down to the game */
  useEffect(() => {
    if (!table || table.status !== 'starting') return;
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setupFromTable(table)));
      localStorage.removeItem('brassworks.resume.v1');
    } catch {
      /* the game page falls back to its defaults */
    }
    /* on a server the game is a place of its own: it carries the code */
    navigate(isOnline ? `/game/${table.code}` : '/game');
  }, [table, navigate]);

  if (!table) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fell text-2xl text-cream-100/85">{t('online.room.notFound')}</p>
        <Link to="/online" className="btn-ledger">
          {t('online.room.back')}
        </Link>
      </div>
    );
  }

  const mySeat = table.seats.find((s) => s.id === me.id);
  const iAmHost = table.hostId === me.id;
  const seated = table.seats.length;
  const empty = Math.max(0, MAX_SEATS - seated);
  const startable = canStart(table);
  const humansWaiting = table.seats.filter((s) => s.kind === 'human' && !s.ready).length;

  const edit = (patch: (tb: Table) => Table) => lobby.update(code, patch);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/online/${code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  };
  const sitDown = async () => {
    if (!me.name) {
      navigate('/online');
      return;
    }
    try {
      await lobby.join(code);
    } catch {
      /* full or started: the room says so */
    }
  };
  const addBot = () =>
    edit((tb) => {
      if (tb.seats.length >= MAX_SEATS) return tb;
      const used = new Set(tb.seats.map((s) => s.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${tb.seats.length + 1}`;
      return { ...tb, seats: [...tb.seats, { id: 'bot-' + Math.random().toString(36).slice(2, 8), name, color: freeColor(tb), kind: 'bot', difficulty: 'industrialist', ready: true, joinedAt: Date.now() }] };
    });
  const leave = () => {
    lobby.leave(code);
    navigate(isOnline ? '/desk' : '/online');
  };
  const start = () => startable && iAmHost && edit((tb) => ({ ...tb, status: 'starting' }));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(16,13,11,0.75) 100%)' }} />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.05]" />
      <div className="relative mx-auto max-w-[1180px] px-6 py-10 lg:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <Link to={isOnline ? '/desk' : '/online'} className="mb-4 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t(isOnline ? 'site.nav.desk' : 'online.room.back')}
            </Link>
            <p className="eyebrow">{t('online.room.eyebrow')}</p>
            {iAmHost && renaming ? (
              <input
                autoFocus
                defaultValue={table.name}
                maxLength={28}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name) edit((tb) => ({ ...tb, name }));
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                className="mt-2 w-full max-w-xl border-0 border-b-2 border-brass-400 bg-transparent px-0 font-display text-[44px] font-black leading-none tracking-[-0.01em] text-cream-100 focus:outline-none"
              />
            ) : (
              <h1
                className={cn('mt-2 font-display text-[44px] font-black leading-none tracking-[-0.01em] text-cream-100', iAmHost && 'cursor-text hover:text-brass-400')}
                title={iAmHost ? t('online.room.rename') : undefined}
                onClick={() => iAmHost && setRenaming(true)}
              >
                {table.name}
              </h1>
            )}
          </div>
          {/* the brass plaque with the code */}
          <div className="plaque plaque-rivets flex items-center gap-5 px-5 py-3">
            <div>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-400/80">{t('online.room.code')}</p>
              <p className="engraved-brass font-mono text-[34px] font-bold leading-none tracking-[0.35em]">{table.code}</p>
            </div>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-brass-700/60 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-brass-400 transition-colors hover:border-brass-400">
              <Copy className="h-3.5 w-3.5" /> {copied ? t('online.room.copied') : t('online.room.copy')}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[640px_1fr]">
          {/* the seats */}
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="plate relative p-6" aria-label={t('online.room.seats')}>
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]" />
            <header className="relative flex items-baseline justify-between">
              <h2 className="font-fell text-lg uppercase tracking-[0.06em] text-cream-100">{t('online.room.seats')}</h2>
              <span className="font-mono text-[11px] text-cream-100/50">
                {seated} / {MAX_SEATS}
              </span>
            </header>
            <div className="divider-brass mt-3 !mx-0" />
            <ul className="relative mt-4 grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {table.seats.map((seat) => (
                  <PlaceCard
                    key={seat.id}
                    seat={seat}
                    table={table}
                    isMe={seat.id === me.id}
                    isHostSeat={seat.id === table.hostId}
                    iAmHost={iAmHost}
                    onColor={(color) => edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === seat.id ? { ...s, color } : s)) }))}
                    onReady={() => edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === seat.id ? { ...s, ready: !s.ready } : s)) }))}
                    onRemove={() => edit((tb) => ({ ...tb, seats: tb.seats.filter((s) => s.id !== seat.id) }))}
                    onDifficulty={(difficulty) => edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === seat.id ? { ...s, difficulty } : s)) }))}
                    onMinutes={(minutes) =>
                      edit((tb) => ({
                        ...tb,
                        seats: tb.seats.map((s) => {
                          if (s.id !== seat.id) return s;
                          const next = { ...s };
                          if (minutes === undefined) delete next.minutes;
                          else next.minutes = minutes;
                          return next;
                        }),
                      }))
                    }
                  />
                ))}
                {Array.from({ length: empty }, (_, i) => (
                  <EmptyChair key={`empty-${i}`} iAmHost={iAmHost} onAddBot={addBot} />
                ))}
              </AnimatePresence>
            </ul>
            {!mySeat && (
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brass-700/50 bg-coal-950/50 px-4 py-3">
                <span className="font-sans text-[12.5px] text-cream-100/75">{table.seats.length >= MAX_SEATS ? t('online.entry.join.error.full') : t('online.room.notSeated')}</span>
                {table.seats.length < MAX_SEATS && (
                  <button type="button" onClick={sitDown} className="btn-ledger !h-10 !px-4">
                    {t('online.room.sitDown')}
                  </button>
                )}
              </div>
            )}
            {isOnline && mySeat && table.status === 'open' && seated < MAX_SEATS && <InviteBox code={code} seated={table.seats.map((s) => s.id)} />}
            <p className="relative mt-4 font-sans text-[12px] leading-relaxed text-cream-100/50">{t('online.room.shareHint')}</p>
          </motion.section>

          {/* the house rules: the host's pen, everyone's eyes */}
          <div className="relative">
            <HouseRules options={table.options} onChange={(patch) => iAmHost && edit((tb) => ({ ...tb, options: { ...tb.options, ...patch } }))} />
            {!iAmHost && (
              <div className="pointer-events-none absolute inset-0 rounded-[8px]" aria-hidden>
                <span className="absolute right-4 top-4 rounded-sm border border-brass-700/60 bg-coal-950/85 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brass-400/80">{t('online.room.hostSets')}</span>
              </div>
            )}
          </div>
        </div>

        {/* the bell */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="plaque plaque-rivets sticky bottom-4 mt-8 flex min-h-[88px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <AnimatePresence mode="popLayout">
              {table.seats.map((s) => (
                <motion.span
                  layout
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  className={cn('inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3', s.kind === 'bot' || s.ready ? 'border-bottle-600/70 bg-coal-900/85' : 'border-ink-900/40 bg-coal-900/60')}
                >
                  <PlayerToken color={s.color} size={18} />
                  <span className="font-sans text-[12px] font-semibold text-cream-100">{s.name}</span>
                  {(s.kind === 'bot' || s.ready) && <Check className="h-3 w-3 text-bottle-600 brightness-150" />}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-3">
            {mySeat && (
              <button type="button" onClick={leave} className="inline-flex items-center gap-1.5 rounded-md border border-brass-700/60 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream-100/70 transition-colors hover:border-rust-500 hover:text-rust-500">
                <LogOut className="h-3.5 w-3.5" /> {t('online.room.leave')}
              </button>
            )}
            {iAmHost ? (
              <button type="button" onClick={start} disabled={!startable} className="btn-strike !h-14 !rounded-lg !px-8 !font-display !text-xl !font-bold normal-case !tracking-normal disabled:cursor-not-allowed disabled:saturate-50 disabled:opacity-70" title={startable ? undefined : t('online.room.startHint', { n: humansWaiting, min: 2 })}>
                {t('online.room.start')}
              </button>
            ) : (
              <span className="font-fell text-[13px] italic text-cream-100/70">{t('online.room.waitingHost')}</span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
