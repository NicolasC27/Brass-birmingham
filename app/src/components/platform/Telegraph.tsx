import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Eye, EyeOff, Flag, MessageSquare, Radio, Send, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localeOf, useLang, useT } from '@/i18n';
import { befriend, invite, portraitUrl, useDesk, useLine, useSession } from '@/online/session';
import { deskErrorKey } from '@/online/errors';
import type { Friend, TableSummary } from '@/online/table';
import { HALL, MAX_LINE, friendRoom, roomOf } from '@/online/parlour';
import type { Line, Room } from '@/online/parlour';
import { hideMember, loadMore, markRead, reportLine, say, setDocked, showRoom, useParlour, useRoom, useUnreadTotal } from '@/online/talk';
import { tableTitle } from '@/online/tableNames';
import Button from './Button';

/* ------------------------------------------------------------------ */
/* The telegraph — the dock at the foot of every page but the table.   */
/*                                                                     */
/* Folded, a plate with the friends on line and what is unread; open,  */
/* the hall and the friends with a lamp each, and a word to any of     */
/* them, an invitation to the table one is hosting, a look at the game */
/* one is playing. A room on show reads as a tape: who said what, and  */
/* a line to send. The lines ride the office's wire (online/talk.ts).  */
/* ------------------------------------------------------------------ */

const ease = [0.2, 0, 0, 1] as const;

/** the account's small likeness, or the house's default */
function Likeness({ id, online }: { id: string; online?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = !broken ? portraitUrl(id) : null;
  return (
    <span className="relative shrink-0">
      <img src={src ?? '/avatar-default.svg'} alt="" width={28} height={28} onError={() => setBroken(true)} className="h-7 w-7 rounded-full border border-brass-hairline object-cover" />
      {online !== undefined && <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-enamel-850 transition-colors duration-300', online ? 'bg-bottle-400' : 'bg-iron-600')} aria-hidden />}
    </span>
  );
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="data-text ml-auto rounded-full bg-signal-400 px-1.5 py-px tabular-nums text-[rgb(var(--ink-on-signal))]">{n > 99 ? '99+' : n}</span>;
}

/* ------------------------------- the list ------------------------------- */

function FriendLine({ friend, hosting, invited, onWrite, onInvite, onAccept }: { friend: Friend; hosting: TableSummary | null; invited: boolean; onWrite: () => void; onInvite: () => void; onAccept: () => void }) {
  const t = useT();
  const lang = useLang();
  const p = useParlour();
  const unread = p.unread[friendRoom(friend.id)] ?? 0;
  const act = 'flex h-7 w-7 items-center justify-center rounded-md text-iron-400 transition-colors hover:bg-enamel-700 hover:text-paper-100 disabled:opacity-40 disabled:hover:bg-transparent';
  const canInvite = !!hosting && !hosting.seats.some((s) => s.id === friend.account.id);
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-enamel-800">
      <Likeness id={friend.account.id} online={friend.online} />
      <button type="button" onClick={friend.status === 'friends' ? onWrite : undefined} className="min-w-0 flex-1 text-left" disabled={friend.status !== 'friends'}>
        <span className="flex items-center gap-2">
          <span className="truncate font-ui text-[13px] font-semibold text-paper-100">{friend.account.name}</span>
          <Badge n={unread} />
        </span>
        <span className="data-text block truncate text-iron-400">
          {friend.status === 'asks' ? t('platform.desk.friends.asks') : friend.status === 'asked' ? t('platform.desk.friends.asked') : friend.playing ? t('platform.telegraph.atTable', { table: tableTitle(friend.playing.name, lang) }) : t(friend.online ? 'platform.desk.friends.presenceOnline' : 'platform.desk.friends.presenceOffline')}
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {friend.status === 'asks' && (
          <button type="button" onClick={onAccept} title={t('platform.desk.friends.accept')} aria-label={t('platform.desk.friends.accept')} className={cn(act, 'text-bottle-400')}>
            <Check size={15} aria-hidden />
          </button>
        )}
        {friend.status === 'friends' && (
          <>
            <button type="button" onClick={onWrite} title={t('platform.telegraph.write')} aria-label={t('platform.telegraph.write', { name: friend.account.name })} className={act}>
              <MessageSquare size={15} aria-hidden />
            </button>
            {friend.playing ? (
              <Link to={`/game/${friend.playing.code}`} title={t('platform.telegraph.watch')} aria-label={t('platform.telegraph.watchAria', { name: friend.account.name })} className={act}>
                <Eye size={15} aria-hidden />
              </Link>
            ) : (
              <button type="button" onClick={onInvite} disabled={!canInvite || invited} title={invited ? t('platform.desk.friends.invited') : canInvite ? t('platform.desk.friends.invite') : t('platform.desk.friends.inviteDisabled')} aria-label={t('platform.desk.friends.invite')} className={act}>
                <UserPlus size={15} aria-hidden />
              </button>
            )}
          </>
        )}
      </span>
    </li>
  );
}

function Group({ label, children, open, onToggle, count }: { label: string; children: React.ReactNode; open: boolean; onToggle: () => void; count: number }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:text-paper-100">
        <span className="micro-label text-iron-400">{label}</span>
        <span className="data-text tabular-nums text-iron-400">{count}</span>
        <ChevronDown size={13} aria-hidden className={cn('ml-auto text-iron-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && count > 0 && <ul className="grid gap-0.5 pb-1">{children}</ul>}
    </div>
  );
}

function Roster({ onOpen }: { onOpen: (room: Room) => void }) {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const p = useParlour();
  const hall = useRoom(HALL);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const friends = desk?.friends ?? [];
  const requests = friends.filter((f) => f.status !== 'friends');
  const online = friends.filter((f) => f.status === 'friends' && f.online);
  const offline = friends.filter((f) => f.status === 'friends' && !f.online);
  const me = session?.id ?? '';
  const hosting = desk?.tables.find((x) => x.status === 'open' && x.hostId === me && x.seats.length < 4) ?? null;
  const fail = (e: unknown) => setNote(t(deskErrorKey(e)));
  const last = hall.lines[hall.lines.length - 1];

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
  const row = (f: Friend) => (
    <FriendLine
      key={f.id}
      friend={f}
      hosting={hosting}
      invited={invited.has(f.id)}
      onWrite={() => onOpen(friendRoom(f.id))}
      onAccept={() => befriend(f.account.name).catch(fail)}
      onInvite={() => {
        if (!hosting) return;
        invite(hosting.code, f.account.name)
          .then(() => setInvited((s) => new Set(s).add(f.id)))
          .catch(fail);
      }}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* the hall first: everyone's room */}
        <button type="button" onClick={() => onOpen(HALL)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-enamel-800">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brass-hairline bg-enamel-800 text-brass-300">
            <Users size={14} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-ui text-[13px] font-semibold text-paper-100">{t('platform.telegraph.hall')}</span>
              <Badge n={p.unread[HALL] ?? 0} />
            </span>
            <span className="data-text block truncate text-iron-400">{last ? `${last.from.name} : ${last.text}` : t('platform.telegraph.hallLede')}</span>
          </span>
        </button>
        <div className="mx-2 my-1.5 h-px bg-[var(--gz-ink-faint)]" aria-hidden />
        {friends.length === 0 ? (
          <p className="px-2 py-3 font-ui text-[12.5px] leading-relaxed text-iron-400">{t('platform.telegraph.noFriends')}</p>
        ) : (
          <>
            {requests.length > 0 && (
              <Group label={t('platform.telegraph.requests')} count={requests.length} open onToggle={() => undefined}>
                {requests.map(row)}
              </Group>
            )}
            <Group label={t('platform.telegraph.online')} count={online.length} open onToggle={() => undefined}>
              {online.map(row)}
            </Group>
            <Group label={t('platform.telegraph.offline')} count={offline.length} open={offlineOpen} onToggle={() => setOfflineOpen((o) => !o)}>
              {offline.map(row)}
            </Group>
          </>
        )}
      </div>
      <div className="border-t border-[var(--gz-ink-faint)] p-2">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={t('platform.desk.friends.addPlaceholder')} aria-label={t('platform.desk.friends.addPlaceholder')} className={field} />
          <Button type="submit" variant="ghost" size="sm" disabled={!name.trim()} icon={<UserPlus aria-hidden />} aria-label={t('platform.desk.friends.send')} className="!px-2" />
        </form>
        {note && (
          <p role="alert" className="mt-1.5 font-ui text-[12px] text-rust-400">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

const field = 'h-8 min-w-0 flex-1 rounded-md border border-brass-hairline-strong bg-lacquer-950/70 px-2.5 font-ui text-[13px] text-paper-100 transition-colors duration-150 placeholder:text-iron-400 focus:border-brass-500';

/* ------------------------------- a room ------------------------------- */

/** lines in a row from one member within a few minutes read as one breath */
const TOGETHER_MS = 3 * 60 * 1000;

export function Tape({ room, lines, more, readOnly, placeholder, emptyText, onSaid }: { room: Room; lines: Line[]; more: boolean; readOnly?: boolean; placeholder: string; emptyText: string; onSaid?: () => void }) {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const p = useParlour();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const hidden = useMemo(() => new Set(p.hidden), [p.hidden]);
  const shown = useMemo(() => lines.filter((l) => !hidden.has(l.from.id)), [lines, hidden]);

  /* the tape is read from its end: a new line keeps it there unless the
     reader has scrolled up to read the old ones */
  const stuck = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, room]);
  useEffect(() => {
    stuck.current = true;
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
    input.current?.focus();
  }, [room]);

  const submit = async () => {
    const line = text.trim();
    if (!line || sending) return;
    setNote(null);
    setSending(true);
    try {
      await say(room, line);
      setText('');
      stuck.current = true;
      onSaid?.();
    } catch (e) {
      setNote(t(deskErrorKey(e)));
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };
  const report = (id: number) => {
    reportLine(id)
      .then(() => setReported((s) => new Set(s).add(id)))
      .catch(() => undefined);
  };
  const time = (at: number) => new Date(at).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={box}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {more && (
          <button type="button" onClick={() => loadMore(room)} className="micro-label mb-2 block w-full py-1 text-center text-iron-400 transition-colors hover:text-paper-100">
            {t('platform.telegraph.older')}
          </button>
        )}
        {shown.length === 0 && <p className="py-6 text-center font-serif text-[13px] italic text-iron-400">{emptyText}</p>}
        <ol className="grid gap-0.5">
          {shown.map((l, i) => {
            const prev = shown[i - 1];
            const mine = l.from.id === session?.id;
            const together = !!prev && prev.from.id === l.from.id && l.at - prev.at < TOGETHER_MS;
            return (
              <li key={l.id} className={cn('group relative rounded-md px-2 py-0.5 transition-colors hover:bg-enamel-800', !together && i > 0 && 'mt-2')}>
                {!together && (
                  <p className="flex items-baseline gap-2">
                    <span className={cn('font-ui text-[12.5px] font-semibold', mine ? 'text-paper-300' : 'text-brass-300')}>{mine ? t('platform.telegraph.you') : l.from.name}</span>
                    <span className="data-text text-iron-400">{time(l.at)}</span>
                  </p>
                )}
                <p className="break-words font-ui text-[13px] leading-snug text-paper-100">{l.text}</p>
                {!mine && (
                  <span className="absolute -top-2 right-1 hidden items-center gap-0.5 rounded-md border border-brass-hairline bg-enamel-850 p-0.5 group-hover:flex">
                    <button type="button" onClick={() => report(l.id)} disabled={reported.has(l.id)} title={reported.has(l.id) ? t('platform.telegraph.reported') : t('platform.telegraph.report')} aria-label={t('platform.telegraph.report')} className="flex h-6 w-6 items-center justify-center rounded text-iron-400 hover:text-rust-400 disabled:opacity-50">
                      <Flag size={12} aria-hidden />
                    </button>
                    <button type="button" onClick={() => hideMember(l.from.id, true)} title={t('platform.telegraph.hide', { name: l.from.name })} aria-label={t('platform.telegraph.hide', { name: l.from.name })} className="flex h-6 w-6 items-center justify-center rounded text-iron-400 hover:text-paper-100">
                      <EyeOff size={12} aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {hidden.size > 0 && lines.length !== shown.length && (
          <p className="mt-2 flex items-center gap-1.5 font-ui text-[11.5px] text-iron-400">
            <EyeOff size={11} aria-hidden />
            {t('platform.telegraph.hiddenLines', { count: lines.length - shown.length })}
            <button type="button" onClick={() => lines.forEach((l) => hidden.has(l.from.id) && hideMember(l.from.id, false))} className="underline-offset-2 hover:text-paper-100 hover:underline">
              {t('platform.telegraph.unhide')}
            </button>
          </p>
        )}
      </div>
      <div className="border-t border-[var(--gz-ink-faint)] p-2">
        {readOnly ? (
          <p className="px-1 py-1 font-ui text-[12px] text-iron-400">{t('platform.telegraph.readOnly')}</p>
        ) : (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_LINE} placeholder={placeholder} aria-label={placeholder} autoComplete="off" className={field} />
            <Button type="submit" variant="primary" size="sm" disabled={!text.trim() || sending} icon={<Send aria-hidden />} aria-label={t('platform.telegraph.send')} className="!px-2" />
          </form>
        )}
        {note && (
          <p role="alert" className="mt-1.5 font-ui text-[12px] text-rust-400">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

function RoomPane({ room, onBack }: { room: Room; onBack: () => void }) {
  const t = useT();
  const desk = useDesk();
  const view = useRoom(room);
  const r = roomOf(room);
  const friend = r?.kind === 'friend' ? desk?.friends.find((f) => f.id === r.id && f.status === 'friends') : null;
  /* a friends' room whose friendship is over leads back to the list */
  useEffect(() => {
    if (r?.kind === 'friend' && desk && !friend) onBack();
  }, [r?.kind, desk, friend, onBack]);
  const title = r?.kind === 'hall' ? t('platform.telegraph.hall') : r?.kind === 'table' ? r.code : (friend?.account.name ?? '');
  return (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--gz-ink-faint)] px-2 py-1.5">
        <button type="button" onClick={onBack} aria-label={t('platform.telegraph.back')} className="flex h-7 w-7 items-center justify-center rounded-md text-iron-400 transition-colors hover:bg-enamel-800 hover:text-paper-100">
          <ArrowLeft size={15} aria-hidden />
        </button>
        {friend && <Likeness id={friend.account.id} online={friend.online} />}
        <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-semibold text-paper-100">{title}</span>
        {r?.kind === 'hall' && <span className="data-text text-iron-400">{t('platform.telegraph.hallCount', { count: desk?.hall.online ?? 0 })}</span>}
      </div>
      <Tape room={room} lines={view.lines} more={view.more} placeholder={friend ? t('platform.telegraph.placeholderTo', { name: friend.account.name }) : t('platform.telegraph.placeholder')} emptyText={r?.kind === 'hall' ? t('platform.telegraph.hallEmpty') : t('platform.telegraph.roomEmpty', { name: friend?.account.name ?? '' })} />
    </>
  );
}

/* -------------------------------- the dock -------------------------------- */

export default function Telegraph() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const line = useLine();
  const p = useParlour();
  const unread = useUnreadTotal();
  const { pathname } = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const onlineCount = desk?.friends.filter((f) => f.status === 'friends' && f.online).length ?? 0;
  /* a room still on show in a tab that was folded is read when it opens */
  useEffect(() => {
    if (p.docked && p.open) showRoom(p.open);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* the page coming back into view reads the room on show */
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible' && p.docked && p.open) markRead(p.open);
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [p.docked, p.open]);
  /* Escape folds the dock when the keyboard is in it */
  useEffect(() => {
    if (!p.docked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) setDocked(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.docked]);

  /* members only, with the line up; the preview and the departures board stand alone */
  if (!session || !session.verified || line !== 'online' || pathname === '/tableau') return null;
  const label = p.docked ? t('platform.telegraph.fold') : t('platform.telegraph.unfold');

  return (
    <div className="fixed bottom-[68px] right-3 z-[70] flex flex-col items-end min-[900px]:bottom-0 min-[900px]:right-6" data-print="hide">
      <AnimatePresence initial={false}>
        {p.docked && (
          <motion.div
            key="panel"
            ref={panel}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease }}
            role="region"
            aria-label={t('platform.telegraph.title')}
            className="mb-[-1px] flex h-[min(480px,calc(100dvh-140px))] w-[340px] flex-col overflow-hidden rounded-t-lg border border-b-0 border-brass-hairline-strong bg-enamel-850 shadow-[0_-8px_28px_var(--shadow-modal)]"
          >
            {p.open ? <RoomPane room={p.open} onBack={() => showRoom(null)} /> : <Roster onOpen={showRoom} />}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setDocked(!p.docked)}
        aria-expanded={p.docked}
        aria-label={label}
        className={cn(
          'flex h-9 w-[340px] items-center gap-2.5 rounded-t-lg border border-b-0 border-brass-hairline-strong px-3 text-left transition-colors duration-150',
          p.docked ? 'bg-enamel-800 text-paper-100' : 'bg-enamel-850 text-paper-100 shadow-[0_-4px_18px_var(--shadow-modal)] hover:bg-enamel-800',
        )}
      >
        <Radio size={14} aria-hidden className="shrink-0 text-brass-300" />
        <span className="font-fell text-[13px] tracking-[0.08em]">{t('platform.telegraph.title')}</span>
        <span className="data-text flex items-center gap-1.5 text-iron-400">
          <span className={cn('h-1.5 w-1.5 rounded-full', onlineCount ? 'animate-presence-dot bg-bottle-400' : 'bg-iron-600')} aria-hidden />
          <span className="tabular-nums">{t('platform.telegraph.onlineCount', { count: onlineCount })}</span>
        </span>
        {unread > 0 && !p.docked && <span className="animate-pulse-signal data-text ml-auto rounded-full bg-signal-400 px-1.5 py-px tabular-nums text-[rgb(var(--ink-on-signal))]">{unread > 99 ? '99+' : unread}</span>}
        <span className={cn('text-iron-400', unread > 0 && !p.docked ? 'ml-1' : 'ml-auto')}>{p.docked ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}</span>
      </button>
    </div>
  );
}
