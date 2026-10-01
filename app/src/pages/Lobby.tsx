import { useEffect, useRef, useState } from 'react';
import { getBoardOptions } from '@/components/game/boardOptions';
import { steamWhistle } from '@/gl/sfx';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bot, Check, Copy, Factory, LogOut, Play, Search, Send, X } from 'lucide-react';
import HouseRules from '@/components/setup/HouseRules';
import { PERSONAS, PLAYER_COLORS, SETUP_STORAGE_KEY, recastSeat } from '@/components/setup/constants';
import { freePersona, personaName } from '@/game/data';
import { EXPERT } from '@/game/search';
import type { BotPersona, PlayerColor } from '@/components/setup/constants';
import { MAX_SEATS, canStart, freeColor, isOnline, lobby, setupFromTable, useTable } from '@/online/lobby';
import { invite, useDesk, useStranger } from '@/online/session';
import type { Table, TableSeat } from '@/online/lobby';
import Button from '@/components/platform/Button';
import SeatToken from '@/components/platform/SeatToken';
import Toast from '@/components/platform/Toast';
import type { ToastData } from '@/components/platform/Toast';
import { useLang, useT } from '@/i18n';
import { tableTitle } from '@/online/tableNames';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Salon d'attente « Club Industriel » (lobby.md) — refonte de        */
/* présentation UNIQUEMENT. Chaque contrat de l'ancienne salle tient  */
/* toujours : sièges et couleurs (freeColor), bots (the characters,        */
/* difficultés), ready, hôte, chandelle par siège, code copiable,     */
/* invitations d'amis, et le démarrage — status 'starting' → chaque   */
/* client écrit brassworks.setup.v1, supprime brassworks.resume.v1 et */
/* navigue. Les mutations ne passent que par lobby.update.            */
/* ------------------------------------------------------------------ */


const seatSpring = { type: 'spring', stiffness: 260, damping: 24 } as const;

/* Ellipse desktop : haut, droite, bas, gauche (mobile : grille 2×2). */
const ELLIPSE = [
  'lg:left-1/2 lg:top-0 lg:-ml-[70px]',
  'lg:right-0 lg:top-1/2 lg:-mt-[76px]',
  'lg:left-1/2 lg:bottom-0 lg:-ml-[70px]',
  'lg:left-0 lg:top-1/2 lg:-mt-[76px]',
] as const;
const POPOVER_ALIGN = ['left-1/2 -translate-x-1/2', 'right-0', 'left-1/2 -translate-x-1/2', 'left-0'] as const;

/* ---------------- Médaillon central de readiness (§S2) --------------- */

function ReadyMedallion({ ready, allReady }: { ready: number; allReady: boolean }) {
  const t = useT();
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const portion = Math.min(1, ready / MAX_SEATS);
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative flex h-[120px] w-[120px] items-center justify-center"
      role="img"
      aria-label={t('platform.lobby.medallion')}
    >
      {allReady && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          animate={{ boxShadow: ['0 0 0 0 rgba(62,138,102,0)', '0 0 22px 4px rgba(62,138,102,.45)', '0 0 0 0 rgba(62,138,102,0)'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div aria-hidden className="tex-ledger absolute inset-0 rounded-full opacity-40" />
      <div aria-hidden className="absolute inset-0 rounded-full border-2 border-dashed border-brass-hairline-strong bg-enamel-800/60" />
      <svg aria-hidden viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--brass-hairline)" strokeWidth="3" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#C9A24B"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - portion) }}
          transition={{ type: 'spring', stiffness: 120, damping: 26 }}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1">
        <Factory size={32} className="text-brass-500" aria-hidden />
        <span className="data-text tnums text-[12px] text-paper-300">{t('platform.lobby.readyCount', { ready, total: MAX_SEATS })}</span>
      </div>
    </motion.div>
  );
}

/* ------------------------ Siège + plaque (§S2) ----------------------- */

function SeatSlot({
  slot,
  table,
  index,
  isMe,
  isHostSeat,
  iAmHost,
  popoverOpen,
  onTogglePopover,
  onColor,
  onRemove,
  onPersona,
  onMinutes,
  onAddBot,
}: {
  slot: TableSeat | null;
  table: Table;
  index: number;
  isMe: boolean;
  isHostSeat: boolean;
  iAmHost: boolean;
  popoverOpen: boolean;
  onTogglePopover: () => void;
  onColor: (c: PlayerColor) => void;
  onRemove: () => void;
  onPersona: (p: BotPersona) => void;
  onMinutes: (m: number | null | undefined) => void;
  onAddBot: () => void;
}) {
  const t = useT();

  /* the open chair: dashed token, the host may seat a mechanical player */
  if (!slot) {
    return (
      <motion.li
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ ...seatSpring, delay: index * 0.09 }}
        className={cn('group relative flex w-[140px] flex-col items-center justify-self-center lg:absolute lg:justify-self-auto', ELLIPSE[index])}
      >
        <SeatToken seat={null} size={64} index={index} />
        <div className="mt-2 flex h-[52px] flex-col items-center justify-start gap-1.5">
          <span className="micro-label text-[10px] text-iron-600">{t('platform.lobby.emptySeat')}</span>
          {iAmHost && (
            <button
              type="button"
              onClick={onAddBot}
              className="inline-flex items-center gap-1 rounded-full border border-bottle-500/70 bg-bottle-700/40 px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-bottle-400 transition-colors hover:border-bottle-400 hover:text-paper-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
            >
              <Bot size={12} aria-hidden /> {t('platform.lobby.addBot')}
            </button>
          )}
        </div>
      </motion.li>
    );
  }

  const bot = slot.kind === 'bot';
  const ready = bot || slot.ready;
  const taken = new Set(table.seats.filter((s) => s.id !== slot.id).map((s) => s.color));
  /* who holds a pen over this seat: its occupant, and the host over bots,
     removals and every candle */
  const canColor = isMe || (bot && iAmHost);
  const hasControls = !bot || iAmHost;
  const subLine = bot
    ? t('platform.lobby.botLine', { difficulty: t(slot.persona === EXPERT ? 'setup.persona.expertShort' : 'setup.persona.short') })
    : ready
      ? t('platform.lobby.readyTag')
      : t('platform.lobby.waiting');

  return (
    <motion.li
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ ...seatSpring, delay: index * 0.09 }}
      className={cn('relative flex w-[140px] flex-col items-center justify-self-center lg:absolute lg:justify-self-auto', ELLIPSE[index])}
    >
      <button
        type="button"
        onClick={onTogglePopover}
        aria-expanded={popoverOpen}
        aria-haspopup={hasControls ? 'dialog' : undefined}
        className={cn('relative rounded-full', isMe && !ready && 'shadow-[0_0_0_3px_var(--brass-hairline-strong)]')}
      >
        <SeatToken seat={{ name: slot.name || '…', color: slot.color, kind: slot.kind, ready, host: isHostSeat, you: isMe }} size={64} index={index} />
      </button>
      {/* la plaque : pseudo + sous-ligne d'état */}
      <div className="mt-2 flex h-[52px] w-full flex-col items-center">
        <span className="max-w-full truncate font-ui text-[14px] font-semibold text-paper-100">
          {slot.name || '…'}
          {isMe && <span className="micro-label ml-1.5 text-[9px] text-brass-300">{t('platform.seat.you')}</span>}
        </span>
        <span className={cn('data-text mt-0.5 text-[11px] uppercase', ready ? 'text-bottle-400' : 'text-iron-400')}>{subLine}</span>
      </div>

      {/* le pupitre du siège : couleur, tempo mécanique, chandelle, renvoi */}
      {popoverOpen && hasControls && (
        <>
          <button type="button" aria-label={t('platform.action.close')} onClick={onTogglePopover} className="fixed inset-0 z-10 cursor-default" />
          <div className={cn('absolute top-full z-20 mt-1 w-56 rounded-lg border border-brass-hairline bg-enamel-800 p-3 shadow-[0_8px_24px_var(--shadow-modal)]', POPOVER_ALIGN[index])}>
            {canColor && (
              <div className="flex items-center justify-center gap-2">
                {PLAYER_COLORS.map((c) => {
                  const mine = c.id === slot.color;
                  const busy = taken.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onColor(c.id)}
                      aria-label={t(`setup.colors.${c.id}`)}
                      aria-pressed={mine}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-transform',
                        mine ? 'scale-110 border-paper-100' : busy ? 'cursor-not-allowed border-transparent opacity-30' : 'border-transparent hover:scale-110',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            )}
            {bot && iAmHost && (
              <div className={cn('flex justify-center gap-1', canColor && 'mt-2.5')}>
                {PERSONAS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={slot.persona === d.id}
                    title={d.name}
                    onClick={() => onPersona(d.id)}
                    className={cn(
                      'rounded-full border p-[2px]',
                      slot.persona === d.id ? 'border-brass-500 bg-brass-500/15' : 'border-enamel-line opacity-60 hover:border-brass-hairline-strong hover:opacity-100',
                    )}
                  >
                    <img src={`/portrait-${d.id}.webp`} alt={d.name} draggable={false} className="h-6 w-6 rounded-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* this seat's candle: the table's, none, or its own minutes */}
            {!bot && (
              <div className={cn('flex flex-wrap items-center justify-center gap-1', (canColor || (bot && iAmHost)) && 'mt-2.5')}>
                <span className="micro-label mr-1 text-[9px] text-iron-600">{t('site.room.candle')}</span>
                {iAmHost ? (
                  ([undefined, null, 3, 5, 10] as const).map((m) => {
                    const on = slot.minutes === m;
                    return (
                      <button
                        key={String(m)}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onMinutes(m)}
                        className={cn(
                          'rounded border px-1.5 py-[2px] font-ui text-[9px] font-semibold uppercase tracking-[0.1em]',
                          on ? 'border-brass-500 bg-brass-500/15 text-brass-300' : 'border-enamel-line text-iron-400 hover:border-brass-hairline-strong hover:text-paper-300',
                        )}
                      >
                        {m === undefined ? t('site.room.candleTable') : m === null ? t('site.room.candleNone') : t('site.room.candleMin', { n: m })}
                      </button>
                    );
                  })
                ) : (
                  <span className="font-ui text-[11px] text-paper-300">
                    {slot.minutes === undefined ? t('site.room.candleTable') : slot.minutes === null ? t('site.room.candleNone') : t('site.room.candleMin', { n: slot.minutes })}
                  </span>
                )}
              </div>
            )}
            {iAmHost && !isHostSeat && (
              <button
                type="button"
                onClick={onRemove}
                className="mx-auto mt-2.5 flex items-center gap-1 rounded border border-[rgb(var(--rust-400)/.4)] px-2 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-rust-400 transition-colors hover:border-rust-400"
              >
                <X size={12} aria-hidden /> {t('online.room.remove')}
              </button>
            )}
          </div>
        </>
      )}
    </motion.li>
  );
}

/* --------------------- Invitations d'amis (§S3b) --------------------- */

function InvitePanel({ code, seated }: { code: string; seated: string[] }) {
  const t = useT();
  const desk = useDesk();
  const [name, setName] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [invited, setInvited] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((id) => window.clearTimeout(id));
  }, []);

  /* a letter to a player by name — their desk gets it at once */
  const send = async (who = name) => {
    if (!who.trim()) return;
    try {
      await invite(code, who);
      setNote({ ok: true, text: t('site.room.invited', { name: who.trim() }) });
      setName('');
      setInvited((m) => ({ ...m, [who.trim().toLowerCase()]: Date.now() }));
      window.clearTimeout(timers.current[who.trim().toLowerCase()]);
      timers.current[who.trim().toLowerCase()] = window.setTimeout(() => {
        setInvited((m) => {
          const next = { ...m };
          delete next[who.trim().toLowerCase()];
          return next;
        });
      }, 10_000);
    } catch (e) {
      setNote({ ok: false, text: t(`site.desk.error.${(e as Error).message}`) });
    }
  };

  const filter = name.trim().toLowerCase();
  const friends = (desk?.friends ?? []).filter((f) => f.status === 'friends' && !seated.includes(f.account.id) && (!filter || f.account.name.toLowerCase().includes(filter)));

  return (
    <section aria-label={t('platform.lobby.inviteTitle')}>
      <p className="micro-label text-brass-300/80">{t('platform.lobby.inviteTitle')}</p>
      <div className="relative mt-2.5">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-iron-600" aria-hidden />
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={20}
          placeholder={t('platform.lobby.inviteSearch')}
          className="h-10 w-full rounded-lg border border-brass-hairline bg-lacquer-950 pl-9 pr-3 font-ui text-[13px] text-paper-100 placeholder:text-iron-600 focus:border-brass-500 focus:outline-none"
        />
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {friends.map((f, i) => {
            const sent = invited[f.account.name.toLowerCase()] !== undefined;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.03 }}
                className="flex min-h-[36px] items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-enamel-700"
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', f.online ? 'bg-bottle-400' : 'bg-iron-600')} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-medium text-paper-100">{f.account.name}</span>
                {sent ? (
                  <span className="inline-flex items-center gap-1 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-bottle-400">
                    <Check size={13} aria-hidden /> {t('platform.lobby.invitedTag')}
                  </span>
                ) : (
                  <Button variant="icon" className="!h-8 !w-8 border-0" aria-label={`${t('platform.lobby.inviteSend')} ${f.account.name}`} onClick={() => send(f.account.name)} icon={<Send size={14} aria-hidden />} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {friends.length === 0 && <p className="px-2 py-1 font-ui text-[12px] text-iron-400">{t('platform.lobby.noFriends')}</p>}
      </div>
      {filter && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate font-ui text-[12px] text-iron-400">{name.trim()}</span>
          <Button variant="ghost" className="!h-8 shrink-0 !px-3 !text-[12px]" disabled={!name.trim()} onClick={() => send()} icon={<Send size={13} aria-hidden />}>
            {t('platform.lobby.inviteSend')}
          </Button>
        </div>
      )}
      {note && <p className={cn('mt-2 font-ui text-[12px]', note.ok ? 'text-bottle-400' : 'text-rust-400')}>{note.text}</p>}
    </section>
  );
}

/* ----------------------------- Le salon ------------------------------ */

export default function Lobby() {
  const t = useT();
  const lang = useLang();
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

  const [toast, setToast] = useState<ToastData | null>(null);
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  /* the table has been rung: everyone at it sits down to the game */
  useEffect(() => {
    if (!table || table.status !== 'starting') return;
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(setupFromTable(table)));
      localStorage.removeItem('brassworks.resume.v1');
    } catch {
      /* the game page falls back to its defaults */
    }
    /* the whistle: the train leaves the platform */
    if (getBoardOptions().sound) steamWhistle();
    /* on a server the game is a place of its own: it carries the code */
    navigate(isOnline ? `/game/${table.code}` : '/game');
  }, [table, navigate]);

  /* arrivals, departures and the crown passing — read aloud as toasts,
     heard straight from the lobby's own subscription */
  useEffect(() => {
    let prev = lobby.get(code);
    return lobby.subscribe(code, () => {
      const next = lobby.get(code);
      if (!next || next === prev) {
        prev = next;
        return;
      }
      const old = new Map((prev?.seats ?? []).map((s) => [s.id, s]));
      for (const s of next.seats) {
        if (!old.has(s.id) && s.kind === 'human') setToast({ id: Date.now(), message: t('platform.lobby.toastJoined', { name: s.name }), kind: 'info' });
      }
      for (const [id, s] of old) {
        if (!next.seats.some((n) => n.id === id)) setToast({ id: Date.now() + 1, message: t('platform.lobby.toastLeft', { name: s.name }), kind: 'info' });
      }
      if (prev && prev.hostId !== next.hostId) {
        const host = next.seats.find((s) => s.id === next.hostId);
        if (host && host.id !== me.id) setToast({ id: Date.now() + 2, message: t('platform.lobby.toastNewHost', { name: host.name }), kind: 'info' });
      }
      prev = next;
    });
  }, [code, t, me.id]);

  /* the launch countdown (§S3c): the console winds up, then the bell rings */
  useEffect(() => {
    if (countdown === null || !table) return;
    const id = window.setTimeout(() => {
      if (!canStart(table)) {
        setCountdown(null);
        return;
      }
      if (countdown <= 1) {
        setCountdown(null);
        if (table.hostId === me.id) lobby.update(code, (tb) => ({ ...tb, status: 'starting' }));
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown, table, code, me.id]);

  if (!table) {
    return (
      <div className="flex min-h-[calc(100vh-88px)] flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="display-page">{t('online.room.notFound')}</p>
        <Button variant="ghost" to="/online">
          {t('online.room.back')}
        </Button>
      </div>
    );
  }

  const mySeat = table.seats.find((s) => s.id === me.id);
  const iAmHost = table.hostId === me.id;
  const seated = table.seats.length;
  const startable = canStart(table);
  const humansWaiting = table.seats.filter((s) => s.kind === 'human' && !s.ready).length;
  const readyCount = table.seats.filter((s) => s.kind === 'bot' || s.ready).length;
  const counting = countdown !== null && startable;

  /* the host leads the procession around the medallion */
  const ordered = [...table.seats].sort((a, b) => Number(b.id === table.hostId) - Number(a.id === table.hostId));
  const slots: (TableSeat | null)[] = [...ordered, ...Array.from({ length: Math.max(0, MAX_SEATS - seated) }, () => null)];

  const edit = (patch: (tb: Table) => Table) => lobby.update(code, patch);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/online/${code}`);
      setToast({ id: Date.now(), message: t('platform.toast.copied'), kind: 'success' });
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
      const persona = freePersona(tb.seats.map((s) => s.persona));
      return { ...tb, seats: [...tb.seats, { id: 'bot-' + Math.random().toString(36).slice(2, 8), name: personaName(persona), color: freeColor(tb), kind: 'bot', persona, ready: true, joinedAt: Date.now() }] };
    });
  const leave = () => {
    lobby.leave(code);
    navigate(isOnline ? '/desk' : '/online');
  };
  const toggleReady = () => mySeat && edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === mySeat.id ? { ...s, ready: !s.ready } : s)) }));
  const beginCountdown = () => {
    if (startable && iAmHost) setCountdown(3);
  };

  const optionChips = [
    table.options.eraLength === 'short' ? t('setup.houseRules.eraLength.canalOnly') : t('setup.houseRules.eraLength.full'),
    t(`setup.houseRules.marketTemper.${table.options.marketTemper}`),
    table.options.timerMinutes === null ? t('setup.houseRules.timer.off') : t('setup.houseRules.timer.min', { n: table.options.timerMinutes }),
    ...(table.options.assist ? [t('setup.houseRules.assist.on')] : []),
  ];

  return (
    <div className="relative min-h-[calc(100vh-88px)]">
      <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-8 lg:px-8">
        {/* -------------------- En-tête du salon (§S1) -------------------- */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
              <Link to={isOnline ? '/desk' : '/online'} className="mb-3 inline-flex items-center gap-1.5 font-ui text-[12px] font-semibold uppercase tracking-[0.12em] text-iron-400 transition-colors hover:text-brass-300">
                <ArrowLeft size={14} aria-hidden />
                {t(isOnline ? 'site.nav.desk' : 'online.room.back')}
              </Link>
              <div className="flex items-center gap-3">
                <p className="eyebrow-fell">{t('platform.lobby.eyebrow')}</p>
                <span className="rounded-full bg-bottle-700 px-2.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-paper-100">{t('platform.state.open')}</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}>
              <h1 className="mt-2 font-fraunces text-[32px] font-semibold leading-[1.15] tracking-[-0.015em] text-paper-100">{tableTitle(table.name, lang)}</h1>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut', delay: 0.12 }} className="mt-3 flex flex-wrap items-center gap-1.5">
              {optionChips.map((chip) => (
                <span key={chip} className="rounded border border-brass-hairline bg-enamel-800 px-2 py-0.5 font-ui text-[11px] font-medium text-paper-300">
                  {chip}
                </span>
              ))}
            </motion.div>
          </div>
          {mySeat && (
            <Button variant="danger-ghost" className="shrink-0" onClick={leave} icon={<LogOut size={16} aria-hidden />}>
              {t('platform.lobby.leave')}
            </Button>
          )}
        </header>

        {/* code de salle en tête sur mobile */}
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-brass-hairline bg-lacquer-950 px-4 py-3 lg:hidden">
          <span className="room-code text-paper-100">{table.code}</span>
          <Button variant="ghost" className="!h-9 !px-3 !text-[12px]" onClick={copy} icon={<Copy size={14} aria-hidden />}>
            {t('platform.lobby.copy')}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* ---------------------- La table (§S2) ----------------------- */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className="console p-6 lg:col-span-8 lg:p-8"
            aria-label={t('online.room.seats')}
          >
            <ul className="grid grid-cols-2 gap-x-2 gap-y-6 lg:relative lg:block lg:h-[460px]">
              <li className="col-span-2 flex justify-center lg:absolute lg:left-1/2 lg:top-1/2 lg:-ml-[60px] lg:-mt-[60px] lg:block">
                <ReadyMedallion ready={readyCount} allReady={startable} />
              </li>
              <AnimatePresence>
                {slots.map((slot, i) => (
                  <SeatSlot
                    key={slot?.id ?? `empty-${i}`}
                    slot={slot}
                    table={table}
                    index={i}
                    isMe={slot?.id === me.id}
                    isHostSeat={slot?.id === table.hostId}
                    iAmHost={iAmHost}
                    popoverOpen={openSeat === (slot?.id ?? `empty-${i}`)}
                    onTogglePopover={() => setOpenSeat((cur) => (cur === (slot?.id ?? `empty-${i}`) ? null : (slot?.id ?? `empty-${i}`)))}
                    onColor={(color) => slot && edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === slot.id ? { ...s, color } : s)) }))}
                    onRemove={() => slot && edit((tb) => ({ ...tb, seats: tb.seats.filter((s) => s.id !== slot.id) }))}
                    onPersona={(persona) => slot && edit((tb) => ({ ...tb, seats: tb.seats.map((s) => (s.id === slot.id ? { ...s, ...recastSeat({ type: 'bot', name: s.name, color: s.color, persona: s.persona ?? persona }, persona) } : s)) }))}
                    onMinutes={(minutes) =>
                      slot &&
                      edit((tb) => ({
                        ...tb,
                        seats: tb.seats.map((s) => {
                          if (s.id !== slot.id) return s;
                          const next = { ...s };
                          if (minutes === undefined) delete next.minutes;
                          else next.minutes = minutes;
                          return next;
                        }),
                      }))
                    }
                    onAddBot={addBot}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>

          {/* ------------------- Console latérale (§S3) ------------------- */}
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut', delay: 0.05 }}
            className="lg:col-span-4"
          >
            <div className="flex flex-col gap-6 lg:sticky lg:top-[88px]">
              <div className="console p-5">
                {/* 3a — code de salle */}
                <section className="max-lg:hidden">
                  <p className="micro-label text-brass-300/80">{t('platform.lobby.codeLabel')}</p>
                  <div className="mt-2.5 flex h-14 items-center justify-center rounded-lg border border-brass-hairline bg-lacquer-950">
                    <span className="room-code text-paper-100">{table.code}</span>
                  </div>
                  <Button variant="ghost" className="mt-2.5 !h-9 w-full !text-[13px]" onClick={copy} icon={<Copy size={14} aria-hidden />}>
                    {t('platform.lobby.copy')}
                  </Button>
                  <p className="mt-2 font-ui text-[12px] text-iron-400">{t('platform.lobby.shareHint')}</p>
                </section>

                {/* 3b — invitations */}
                {isOnline && mySeat && table.status === 'open' && seated < MAX_SEATS && (
                  <div className="border-enamel-line max-lg:border-0 lg:mt-5 lg:border-t lg:pt-5">
                    <InvitePanel code={code} seated={table.seats.map((s) => s.id)} />
                  </div>
                )}

                {/* 3c — actions */}
                <div className="border-t border-enamel-line pt-5 max-lg:mt-5 lg:mt-5">
                  {!mySeat && (
                    <div className="flex flex-col gap-2.5">
                      <p className="font-ui text-[13px] text-paper-300">{table.seats.length >= MAX_SEATS ? t('online.entry.join.error.full') : t('online.room.notSeated')}</p>
                      {table.seats.length < MAX_SEATS && (
                        <Button variant="primary" className="!h-12 w-full" onClick={sitDown}>
                          {t('online.room.sitDown')}
                        </Button>
                      )}
                    </div>
                  )}
                  {mySeat && counting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="halo-signal flex flex-col items-center gap-1 rounded-lg border border-[rgb(var(--signal-400)/.5)] bg-enamel-800 px-4 py-5"
                    >
                      <p className="title-card !text-[20px]">{t('platform.lobby.countdownTitle')}</p>
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={countdown}
                          initial={{ scale: 1.15, opacity: 0.6 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="tnums font-fraunces text-[48px] font-semibold leading-none text-signal-400"
                        >
                          {countdown}
                        </motion.span>
                      </AnimatePresence>
                    </motion.div>
                  )}
                  {mySeat && !counting && (
                    <div className="flex flex-col gap-2.5">
                      {iAmHost ? (
                        <>
                          <Button
                            variant="primary"
                            className={cn('!h-12 w-full !text-[15px]', startable && 'animate-pulse-signal')}
                            onClick={beginCountdown}
                            disabled={!startable}
                            icon={<Play size={16} aria-hidden />}
                            title={startable ? undefined : t('online.room.startHint', { n: humansWaiting, min: 2 })}
                          >
                            {t('platform.lobby.start')}
                          </Button>
                          {!startable && <p className="text-center font-ui text-[12px] text-iron-400">{t('online.room.startHint', { n: humansWaiting, min: 2 })}</p>}
                        </>
                      ) : (
                        <>
                          {mySeat.ready ? (
                            <Button variant="ghost" className="!h-12 w-full border-bottle-500/70 !text-bottle-400 hover:!border-bottle-400" onClick={toggleReady} icon={<Check size={16} aria-hidden />}>
                              {t('platform.lobby.unready')}
                            </Button>
                          ) : (
                            <Button variant="primary" className="!h-12 w-full !text-[15px]" onClick={toggleReady}>
                              {t('platform.lobby.ready')}
                            </Button>
                          )}
                          <p className="text-center font-ui text-[12px] text-iron-400">{t('online.room.waitingHost')}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* les règles de la maison : la plume de l'hôte, les yeux de tous */}
              <div className="relative">
                <HouseRules options={table.options} onChange={(patch) => iAmHost && edit((tb) => ({ ...tb, options: { ...tb.options, ...patch } }))} />
                {!iAmHost && (
                  <div className="pointer-events-none absolute inset-0 rounded-[8px]" aria-hidden>
                    <span className="absolute right-4 top-4 rounded border border-brass-hairline bg-enamel-800 px-2 py-1 font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-brass-300/80">{t('online.room.hostSets')}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
