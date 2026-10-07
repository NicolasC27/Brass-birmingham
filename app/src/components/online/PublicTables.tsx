import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Armchair, Bot, ChevronDown, ChevronLeft, ChevronRight, Copy, Crown, Eye, Link2, Loader2, Plus, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang, useT } from '@/i18n';
import { lobby } from '@/online/lobby';
import { invite, portraitUrl, useDesk, useLine, useSession, useStranger, useTables } from '@/online/session';
import { TABLE_PAGE, type TableFilter, type TableSort } from '@/online/table';
import { LINKS, MERCHANT_BY_ID, PLAYER_COLORS, TOWNS, TOWN_BY_ID, activeBoard } from '@/game/data';
import { MAP_URL, getBoardOptions } from '@/components/game/boardOptions';
import { WORLD_H, WORLD_W } from '@/components/game/boardView';
import { stationBell } from '@/gl/sfx';
import { toCard, toCards, type CardSeat, type CardTable } from '@/platform/tables';
import type { Friend } from '@/online/table';
import EmptyState from '@/components/platform/EmptyState';
import { ago } from '@/components/platform/ago';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 3 (play.md) — the departures board.                         */
/* One enamelled panel, a line a table: the platform number, the       */
/* destination (the table's name, the mode and the host beneath), the  */
/* track (the train — an engine, then a carriage a seat, each one the   */
/* passenger's likeness ringed in their colour), the departure (a split */
/* flap: OPEN, LIVE, FULL) and how far the run has gone. The reader's   */
/* own tables are pinned at the head of the board on every page; their  */
/* friends' follow when there are any; the most watched games only once */
/* the house is busy enough for the register not to say the same thing  */
/* twice. Every line unfolds on a click into the passenger list and the */
/* table's particulars. The register itself is searched, filtered and   */
/* sorted by the office (useTables asks for one page), so a thousand    */
/* tables read like a ledger and cost one page on the wire.             */
/* ------------------------------------------------------------------ */

const FILTERS: TableFilter[] = ['all', 'seats', 'friends', 'ranked', 'rail', 'live'];
/** the most watched games get a group of their own once the house holds this many tables */
const BUSY_HOUSE = 6;
/** the filter and the order the reader left the board on */
const BOARD_KEY = 'brassworks.tables.v1';
const readBoard = (): { filter: TableFilter; sort: TableSort } => {
  try {
    const raw = JSON.parse(localStorage.getItem(BOARD_KEY) ?? 'null') as { filter?: string; sort?: string } | null;
    const filter = FILTERS.find((f) => f === raw?.filter) ?? 'all';
    const sort: TableSort = raw?.sort === 'fresh' ? 'fresh' : 'filling';
    return { filter, sort };
  } catch {
    return { filter: 'all', sort: 'filling' };
  }
};
const keepBoard = (v: { filter: TableFilter; sort: TableSort }) => {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(v));
  } catch {
    /* a browser that keeps nothing */
  }
};
/** the invitation, as a link: the register is signed, then the seat taken */
const inviteLink = (code: string) => `${window.location.origin}/online?table=${code}`;

/* ------------------------------- the train ------------------------------- */

/** the engine, drawn as the rail's own */
function Engine({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 22 14" width={size * 1.3} height={size * 0.85} className="block shrink-0 text-paper-100" aria-hidden>
      <g fill="currentColor">
        <rect x="0" y="6" width="5" height="4" />
        <rect x="6" y="3" width="4" height="7" />
        <rect x="9.5" y="5" width="11" height="5" rx="2" />
        <rect x="16.5" y="1" width="2" height="5" />
        <circle cx="8" cy="11.2" r="1.9" />
        <circle cx="14.5" cy="11.6" r="1.4" />
        <circle cx="18.5" cy="11.6" r="1.4" />
      </g>
    </svg>
  );
}

/** a seat as a carriage: a medallion ringed in the passenger's colour, the
 *  likeness inside when the office serves one, the initial otherwise; a
 *  machine paler with its gear; a free chair a dashed outline; the reader's
 *  own ringed once more in brass */
function Carriage({ seat, size = 24, title }: { seat: CardSeat | null; size?: number; title?: string }) {
  const [broken, setBroken] = useState(false);
  if (!seat) {
    return <span className="block shrink-0 rounded-full border border-dashed border-iron-600 bg-enamel-700/30" style={{ width: size, height: size }} title={title} />;
  }
  const hex = PLAYER_COLORS[seat.color]?.hex ?? '#C9A45C';
  const likeness = seat.kind === 'human' && !broken ? portraitUrl(seat.id) : null;
  return (
    <span
      className={cn('relative block shrink-0 overflow-hidden rounded-full bg-enamel-700', seat.you && 'ring-2 ring-brass-300 ring-offset-1 ring-offset-enamel-850')}
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${hex}`, opacity: seat.kind === 'bot' ? 0.75 : 1 }}
      title={title ?? seat.name}
    >
      {likeness ? (
        <img src={likeness} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" style={{ padding: 2, borderRadius: '50%' }} />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-fraunces text-[11px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
          {seat.kind === 'bot' ? <Bot size={size * 0.5} className="text-iron-400" aria-hidden /> : seat.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** the table as a train on the track: the engine, then a carriage a seat */
function SeatTrain({ table, size = 24 }: { table: CardTable; size?: number }) {
  const t = useT();
  return (
    <span className="flex items-center" role="img" aria-label={table.seats.map((s) => (s ? s.name : t('platform.seat.free'))).join(', ')}>
      <Engine size={size} />
      <span className="ml-1 flex items-center" style={{ gap: 3 }}>
        {table.seats.map((s, i) => (
          <Carriage key={i} seat={s} size={size} title={s ? s.name : t('platform.seat.free')} />
        ))}
      </span>
    </span>
  );
}

/* ----------------------------- the board's cells ----------------------------- */

/** a split flap: when the word changes, the old face folds away and the new one drops in */
function Flap({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('gz-flap', className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={text} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ rotateX: 90, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** the lamp beside a departure: lit and breathing for a game in play */
const LAMP: Record<string, string> = { live: 'bg-signal-400 shadow-[0_0_6px_rgb(var(--signal-400))] animate-pulse', open: 'bg-bottle-400', full: 'bg-iron-600' };
const LAMP_TEXT: Record<string, string> = { live: 'text-signal-400', open: 'text-bottle-400', full: 'text-iron-400' };

/** the notches of an era, the rounds played filled in */
function RoundTrack({ round, rounds }: { round: number; rounds: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: rounds }, (_, i) => (
        <span key={i} className={cn('block h-[9px] w-[5px] rounded-[1px]', i < round ? 'bg-paper-100' : 'bg-[var(--gz-ink-faint)]')} />
      ))}
    </span>
  );
}

const boarding = 'font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition-colors disabled:opacity-50';

type Hands = {
  busy: boolean;
  onJoin: (t: CardTable) => void;
  onResume: (t: CardTable) => void;
  onWatch: (t: CardTable) => void;
  onCopy: (code: string) => void;
  onLink: (code: string) => void;
  onInvite: (code: string, name: string) => Promise<boolean>;
};

/** the board in a few strokes: every town a faint dot, the held ones in their
 *  holder's colour, the links laid as strokes — the run seen from above */
function SketchPlate({ table }: { table: CardTable }) {
  const t = useT();
  const sk = table.sketch;
  if (!sk || (sk.board ?? activeBoard().id) !== activeBoard().id) return null;
  const colorOf = (owner: number) => PLAYER_COLORS[table.seats[owner]?.color ?? '']?.vivid ?? '#C9A45C';
  const held = new Map<string, string>();
  for (const [town, owner] of sk.towns) if (!held.has(town)) held.set(town, colorOf(owner));
  const maps = MAP_URL.relief;
  return (
    <figure className="gz-engraving w-[300px] max-w-full shrink-0" aria-label={t('platform.play.tables.sketch')}>
      <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className="block h-auto w-full" style={{ padding: 5 }}>
        <image href={table.era === 'rail' ? maps.rail : maps.canal} width={WORLD_W} height={WORLD_H} preserveAspectRatio="none" opacity="0.92" />
        {sk.links.map(([id, owner]) => {
          const def = LINKS.find((l) => l.id === id);
          const a = def && (TOWN_BY_ID[def.a] ?? MERCHANT_BY_ID[def.a]);
          const b = def && (TOWN_BY_ID[def.b] ?? MERCHANT_BY_ID[def.b]);
          if (!a || !b) return null;
          return (
            <g key={id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#100D0B" strokeWidth={54} strokeOpacity={0.7} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colorOf(owner)} strokeWidth={34} strokeLinecap="round" />
            </g>
          );
        })}
        {TOWNS.map((town) => {
          const c = held.get(town.id);
          return <circle key={town.id} cx={town.x} cy={town.y} r={c ? 62 : 26} fill={c ?? '#5b524a'} fillOpacity={c ? 1 : 0.55} stroke={c ? '#100D0B' : 'none'} strokeWidth={14} />;
        })}
      </svg>
    </figure>
  );
}

/** the friends who could be fetched: those online and not already aboard */
function InviteList({ table, onInvite }: { table: CardTable; onInvite: (code: string, name: string) => Promise<boolean> }) {
  const t = useT();
  const desk = useDesk();
  const [sent, setSent] = useState<Record<string, true>>({});
  const aboard = new Set(table.seats.filter((s): s is CardSeat => !!s).map((s) => s.id));
  const friends = (desk?.friends ?? []).filter((f: Friend) => f.status === 'friends' && f.online && !aboard.has(f.account.id));
  return (
    <div>
      <p className="micro-label text-iron-400">{t('platform.play.tables.friendsOnline')}</p>
      {friends.length === 0 ? (
        <p className="mt-2 font-serif text-[13px] italic text-iron-400">{t('platform.play.tables.noFriendsOnline')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5">
              <Carriage seat={{ id: f.account.id, name: f.account.name, color: 'brass', kind: 'human' }} size={24} />
              <span className="font-fraunces text-[14px] font-medium text-paper-100" style={{ fontVariationSettings: '"opsz" 48' }}>
                {f.account.name}
              </span>
              <button
                type="button"
                disabled={!!sent[f.id]}
                onClick={() => void onInvite(table.code, f.account.name).then((ok) => ok && setSent((m) => ({ ...m, [f.id]: true })))}
                className={cn(boarding, 'ml-auto inline-flex items-center gap-1', sent[f.id] ? 'text-bottle-400' : 'text-brass-300 hover:text-paper-100')}
              >
                <UserPlus size={12} aria-hidden />
                {sent[f.id] ? t('platform.lobby.invitedTag') : t('platform.lobby.inviteSend')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** the particulars under a line: who sits where, what the table was chartered as, the board while in play */
function Detail({ table, onCopy, onLink, onInvite }: { table: CardTable } & Pick<Hands, 'onCopy' | 'onLink' | 'onInvite'>) {
  const t = useT();
  const lang = useLang();
  const seated = table.seats.filter((s): s is CardSeat => !!s);
  const free = table.seats.length - seated.length;
  const facts: [string, string][] = [
    [t('platform.play.tables.eraLength'), t(table.eraLength === 'short' ? 'platform.play.tables.eraShort' : 'platform.play.tables.eraStandard')],
    [t('platform.play.tables.lastMove'), ago(t, lang, table.updatedAt)],
    [t('platform.play.tables.present'), String(table.watchers)],
  ];
  const canInvite = table.mine && table.state === 'open';
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4 px-[54px] py-4">
      <div className="min-w-[180px]">
        <p className="micro-label text-iron-400">{t('platform.play.tables.aboard')}</p>
        <ul className="mt-2 space-y-1.5">
          {seated.map((s, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <Carriage seat={s} size={28} />
              <span className={cn('font-fraunces text-[14px] font-medium', s.you ? 'text-brass-300' : 'text-paper-100')} style={{ fontVariationSettings: '"opsz" 48' }}>
                {s.name}
              </span>
              {s.host && <Crown size={12} className="text-brass-300" aria-label={t('platform.seat.host')} />}
              {s.kind === 'bot' && <span className="micro-label text-[9px] text-iron-600">{t('platform.seat.bot')}</span>}
              {table.toAct === s && <span className="micro-label text-[9px] text-signal-400">{t('platform.play.tables.playing')}</span>}
            </li>
          ))}
          {free > 0 && (
            <li className="flex items-center gap-2.5">
              <Carriage seat={null} size={28} />
              <span className="font-serif text-[13px] italic text-iron-400">{free === 1 ? t('platform.play.tables.freeSeatOne') : t('platform.play.tables.freeSeatsCount', { count: free })}</span>
            </li>
          )}
        </ul>
      </div>
      <dl className="grid min-w-[240px] grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 self-start">
        <dt className="micro-label text-iron-400">{t('platform.play.tables.modeLabel')}</dt>
        <dd className="data-text text-[12px] text-paper-100">{t(`platform.mode.${table.mode}`)}</dd>
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="micro-label text-iron-400">{k}</dt>
            <dd className="data-text text-[12px] text-paper-100 tnums">{v}</dd>
          </div>
        ))}
        <dt className="micro-label text-iron-400">{t('platform.play.tables.code')}</dt>
        <dd className="flex items-center gap-3">
          <span className="room-code !text-[14px] !tracking-[0.22em] text-paper-100">{table.code}</span>
          <button type="button" onClick={() => onCopy(table.code)} className="inline-flex items-center gap-1 text-iron-400 transition-colors hover:text-brass-300" title={t('platform.play.tables.copy')}>
            <Copy size={12} aria-hidden />
            <span className="micro-label text-[9px]">{t('platform.play.tables.copy')}</span>
          </button>
          {canInvite && (
            <button type="button" onClick={() => onLink(table.code)} className="inline-flex items-center gap-1 text-iron-400 transition-colors hover:text-brass-300" title={t('platform.play.tables.inviteLink')}>
              <Link2 size={12} aria-hidden />
              <span className="micro-label text-[9px]">{t('platform.play.tables.inviteLink')}</span>
            </button>
          )}
        </dd>
      </dl>
      {canInvite && (
        <div className="min-w-[200px]">
          <InviteList table={table} onInvite={onInvite} />
        </div>
      )}
      {table.state === 'live' && <SketchPlate table={table} />}
    </div>
  );
}

function Line({ table, i, fresh, busy, onJoin, onResume, onWatch, onCopy, onLink, onInvite }: { table: CardTable; i: number; fresh: boolean } & Hands) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  /* a departure that just changed flashes once */
  const [wasState, setWasState] = useState(table.state);
  const [flashes, setFlashes] = useState(0);
  const [doused, setDoused] = useState(0);
  if (wasState !== table.state) {
    setWasState(table.state);
    setFlashes((n) => n + 1);
  }
  useEffect(() => {
    if (flashes === 0) return;
    const id = window.setTimeout(() => setDoused(flashes), 1100);
    return () => window.clearTimeout(id);
  }, [flashes]);
  const flash = flashes > doused;
  const seated = table.seats.filter(Boolean).length;
  const free = table.seats.length - seated;
  const rounds = table.rounds ?? 10;
  const round = table.round ?? 0;
  /* the ticket at the end of the line: brass to board, plain to watch */
  const action = table.mine
    ? { label: t('platform.play.tables.resume'), go: () => onResume(table), brass: true }
    : table.state === 'live'
      ? { label: t('platform.play.tables.watch'), go: () => onWatch(table), brass: false, icon: true }
      : table.state === 'open' && table.mode !== 'ranked'
        ? { label: t('platform.play.tables.board'), go: () => onJoin(table), brass: true }
        : null;
  const progress =
    table.state === 'live'
      ? `${t(table.era === 'rail' ? 'platform.home.eraRail' : 'platform.home.eraCanal')} · ${t('platform.play.tables.roundOf', { round: Math.max(1, round), total: rounds })}`
      : free === 0
        ? t('platform.play.tables.full')
        : free === 1
          ? t('platform.play.tables.freeSeatOne')
          : t('platform.play.tables.freeSeatsCount', { count: free });
  return (
    <motion.li initial={fresh ? { opacity: 0, y: -18 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: fresh ? 0.36 : 0.2, ease: 'easeOut', delay: fresh ? 0 : 0.03 * i }} className="gz-board-line">
      <div className={cn('gz-board-row', table.mine && 'is-mine', open && 'is-open', (flash || fresh) && 'is-flash')}>
        <span className="data-text text-[13px] text-iron-600 tnums">{String(i + 1).padStart(2, '0')}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 text-left" title={t('platform.play.tables.details')}>
          <span className="flex items-center gap-2">
            <span className={cn('truncate font-fraunces text-[17px] font-medium leading-tight', table.mine ? 'text-brass-300' : 'text-paper-100')} style={{ fontVariationSettings: '"opsz" 48' }}>
              {table.name}
            </span>
            {table.myTurn && <span className="micro-label shrink-0 text-signal-400">{t('platform.play.tables.yourTurn')}</span>}
            <ChevronDown size={12} className={cn('shrink-0 text-iron-600 transition-transform', open && 'rotate-180')} aria-hidden />
          </span>
          <span className="data-text mt-0.5 block truncate text-[11px] text-iron-400">
            {t(`platform.mode.${table.mode}`)} · {t('platform.play.tables.host', { name: table.hostName })} · {ago(t, lang, table.updatedAt)}
          </span>
        </button>
        <SeatTrain table={table} />
        <span className={cn('micro-label flex items-center gap-2', LAMP_TEXT[table.state] ?? 'text-iron-400')}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', LAMP[table.state] ?? 'bg-iron-600')} aria-hidden />
          <Flap text={t(`platform.state.${table.state}`)} />
        </span>
        <span className="gz-board-col-progress">
          {table.state === 'live' && <RoundTrack round={round} rounds={rounds} />}
          <span className={cn('data-text block truncate text-[11px] tnums', table.state === 'live' ? 'mt-1 text-iron-400' : 'text-paper-100')}>
            <Flap text={progress} />
          </span>
        </span>
        <span className="flex items-center gap-2 justify-self-end">
          {table.mine && table.state === 'open' && (
            <button type="button" onClick={() => onLink(table.code)} className="gz-ticket gz-ticket-sm" title={t('platform.play.tables.inviteLink')}>
              <Link2 aria-hidden />
              {t('platform.lobby.inviteSend')}
            </button>
          )}
          {action ? (
            <button type="button" disabled={busy} onClick={action.go} className={cn('gz-ticket gz-ticket-sm', action.brass && 'gz-ticket-brass', table.mine && table.myTurn && 'gz-ticket-signal', busy && 'opacity-50')}>
              {action.icon && <Eye aria-hidden />}
              {action.label}
            </button>
          ) : table.state === 'open' ? (
            <span className={cn(boarding, 'text-iron-600')} title={t('platform.play.tables.viaQueueHint')}>
              {t('platform.play.tables.viaQueue')}
            </span>
          ) : null}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="gz-board-detail">
            <Detail table={table} onCopy={onCopy} onLink={onLink} onInvite={onInvite} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** the board: the lines given under the column heads, in groups each under a
 *  heading when there are several. A line that was not on the board a moment
 *  ago drops in from above, with the station's bell when the reader keeps the
 *  sounds on; a page turned or a filter changed is a new board, nothing drops. */
function Board({ groups, pageKey, ...hands }: { groups: { label: string; tables: CardTable[] }[]; pageKey: string } & Hands) {
  const t = useT();
  const parts = groups.filter((g) => g.tables.length > 0);
  const seen = useRef<{ key: string; codes: Set<string> } | null>(null);
  const codes = new Set(parts.flatMap((g) => g.tables.map((x) => x.code)));
  const known = seen.current && seen.current.key === pageKey ? seen.current.codes : null;
  const fresh = new Set(known ? [...codes].filter((c) => !known.has(c)) : []);
  const rang = useRef(0);
  useEffect(() => {
    seen.current = { key: pageKey, codes };
    if (fresh.size > 0 && getBoardOptions().sound && Date.now() - rang.current > 5000) {
      rang.current = Date.now();
      stationBell();
    }
  });
  let n = 0;
  return (
    <div className="gz-board">
      <div className="gz-board-head" aria-hidden>
        <span />
        <span>{t('platform.play.tables.colDestination')}</span>
        <span>{t('platform.play.tables.colTrack')}</span>
        <span>{t('platform.play.tables.colDeparture')}</span>
        <span className="gz-board-col-progress">{t('platform.play.tables.colProgress')}</span>
        <span />
      </div>
      {parts.map((g) => (
        <section key={g.label || 'register'} aria-label={g.label || t('platform.play.tables.register')}>
          {g.label && parts.length > 1 && <p className="gz-board-group">{g.label}</p>}
          <ul>
            {g.tables.map((table) => (
              <Line key={table.code} table={table} i={n++} fresh={fresh.has(table.code)} {...hands} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** the poster over the board: the open table nearest to leaving, in large type */
function NextDeparture({ table, busy, onJoin }: { table: CardTable; busy: boolean; onJoin: (t: CardTable) => void }) {
  const t = useT();
  const lang = useLang();
  const free = table.seats.filter((s) => !s).length;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }} className="gz-poster mt-5">
      <div className="min-w-0">
        <p className="eyebrow-fell">{t('platform.play.tables.nextDeparture')}</p>
        <p className="mt-1 truncate font-fraunces text-[28px] font-normal leading-none text-paper-100" style={{ fontVariationSettings: '"opsz" 144' }}>
          {table.name}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <SeatTrain table={table} size={30} />
          <span className="data-text text-[11px] text-iron-400">
            {t(`platform.mode.${table.mode}`)} · {t('platform.play.tables.host', { name: table.hostName })} · {ago(t, lang, table.updatedAt)}
          </span>
        </div>
        <p className="mt-2 font-serif text-[13px] italic text-paper-300">{free === 1 ? t('platform.play.tables.nextDepartureOne') : t('platform.play.tables.nextDepartureHint', { count: free })}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => onJoin(table)} className={cn('gz-ticket gz-ticket-brass', busy && 'opacity-50')}>
        <Armchair aria-hidden />
        {t('platform.play.tables.board')}
      </button>
    </motion.div>
  );
}

/* --------------------------------- the section --------------------------------- */

export default function PublicTables({ onToast }: { onToast: Notify }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const session = useSession();
  const desk = useDesk();
  const line = useLine();
  const stranger = useStranger();
  const [board, setBoard] = useState(readBoard);
  const { filter, sort } = board;
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => keepBoard(board), [board]);

  /* the search reaches the office a beat after the pen stops */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(typed.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [typed]);

  /* the slash brings the pen to the search; escape clears it */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const page = useTables({ filter, q, sort, offset, limit: TABLE_PAGE });
  const mine = useMemo(() => (page ? page.mine.map((x) => toCard(x, desk?.tables.find((m) => m.code === x.code), session?.name, lang)) : []), [page, desk?.tables, session?.name, lang]);
  /* the reader's tables are pinned at the head: the register does not list them again */
  const pinned = useMemo(() => new Set(mine.map((x) => x.code)), [mine]);
  const rows = useMemo(() => (page ? toCards(page.tables, desk?.tables, session?.name, lang).filter((x) => !pinned.has(x.code)) : []), [page, desk?.tables, session?.name, lang, pinned]);
  const friends = useMemo(() => (page ? toCards(page.friends, desk?.tables, session?.name, lang).filter((x) => !pinned.has(x.code)) : []), [page, desk?.tables, session?.name, lang, pinned]);
  const live = useMemo(() => (page && page.counts.all >= BUSY_HOUSE ? toCards(page.live, desk?.tables, session?.name, lang).filter((x) => !pinned.has(x.code)) : []), [page, desk?.tables, session?.name, lang, pinned]);
  /* the next train out: the open table with the most aboard, the oldest first, on the board's first page */
  const next = useMemo(() => {
    if (!page || filter !== 'all' || offset !== 0 || q) return null;
    const open = [...friends, ...rows].filter((x) => x.state === 'open' && x.mode === 'normal' && !x.mine && x.seats.some(Boolean) && x.seats.some((s) => !s));
    open.sort((a, b) => b.seats.filter(Boolean).length - a.seats.filter(Boolean).length || a.updatedAt - b.updatedAt);
    return open[0] ?? null;
  }, [page, filter, offset, q, friends, rows]);

  const join = async (table: CardTable) => {
    if (busy) return;
    if (!session) {
      navigate(`/account?table=${table.code}`);
      return;
    }
    if (table.mode === 'ranked' || table.state !== 'open') return;
    setBusy(table.code);
    try {
      await lobby.join(table.code, session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      onToast({ message: lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: 'error' });
      setBusy(null);
    }
  };
  const seatMe = async () => {
    if (busy || !session) return;
    setBusy('seatme');
    try {
      const table = await lobby.seatMe(session.favoriteColor ?? undefined);
      navigate(`/online/${table.code}`);
    } catch (e) {
      const none = e instanceof Error && e.message === 'not-found';
      onToast({ message: none ? t('platform.play.tables.seatMeNone') : lobbyErrorText(t, e, t('platform.play.errorGeneric')), kind: none ? 'info' : 'error' });
      setBusy(null);
    }
  };
  const resume = (table: CardTable) => navigate(table.state === 'live' ? `/game/${table.code}` : `/online/${table.code}`);
  const watch = (table: CardTable) => navigate(`/game/${table.code}`);
  const copy = (text: string, done: string) => {
    void navigator.clipboard?.writeText(text).then(() => onToast({ message: done, kind: 'info' }));
  };
  const send = async (code: string, name: string) => {
    try {
      await invite(code, name);
      onToast({ message: t('site.room.invited', { name }), kind: 'info' });
      return true;
    } catch (e) {
      onToast({ message: t(`site.desk.error.${(e as Error).message}`), kind: 'error' });
      return false;
    }
  };
  const hands: Hands = {
    busy: busy !== null,
    onJoin: (tb) => void join(tb),
    onResume: resume,
    onWatch: watch,
    onCopy: (code) => copy(code, t('platform.toast.copied')),
    onLink: (code) => copy(inviteLink(code), t('platform.play.tables.linkCopied')),
    onInvite: send,
  };

  const chips = FILTERS.map((id) => ({
    id,
    label: id === 'all' ? t('platform.play.tables.all') : id === 'seats' ? t('platform.play.tables.freeSeats') : id === 'ranked' ? t('platform.mode.ranked') : t(`platform.play.tables.${id}`),
    count: page?.counts[id],
  }));

  let body;
  if (stranger) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.signInTitle')} copy={t('platform.play.tables.signInCopy')} cta={{ label: t('platform.action.signIn'), to: '/account' }} />;
  } else if (page === null) {
    body = (
      <div className="mt-4 flex items-center justify-center gap-3 px-6 py-10">
        <Loader2 size={16} className="animate-spin text-brass-300" aria-hidden />
        <p className="font-serif text-[14px] italic text-paper-300">{line === 'online' ? t('platform.play.tables.loading') : t('platform.play.tables.waitingLine')}</p>
      </div>
    );
  } else if (page.counts.all === 0 && !q) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.noneTitle')} copy={t('platform.play.tables.noneCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else if (rows.length === 0 && mine.length === 0 && friends.length === 0) {
    body = <EmptyState className="mt-4" plate="tables" title={t('platform.play.tables.emptyTitle')} copy={t('platform.play.tables.emptyCopy')} cta={{ label: t('platform.action.createTable'), to: '/setup', icon: <Plus size={16} aria-hidden /> }} />;
  } else {
    const from = page.query.offset + 1;
    const to = page.query.offset + page.tables.length;
    body = (
      <div className="mt-4">
        <Board
          pageKey={JSON.stringify(page.query)}
          groups={[
            { label: t('platform.play.tables.mine'), tables: mine },
            { label: t('platform.play.tables.friendsTitle'), tables: friends.slice(0, 3) },
            { label: t('platform.play.tables.liveTitle'), tables: live.slice(0, 3) },
            { label: t('platform.play.tables.register'), tables: rows },
          ]}
          {...hands}
        />
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <span className="data-text text-[11px] text-iron-400 tnums">{t('platform.play.tables.pageOf', { from, to, total: page.total })}</span>
          <span className="flex items-center gap-4">
            <button type="button" disabled={page.query.offset === 0} onClick={() => setOffset(Math.max(0, page.query.offset - TABLE_PAGE))} className={cn(boarding, 'inline-flex items-center gap-1 text-brass-300 hover:text-paper-100')}>
              <ChevronLeft size={12} aria-hidden />
              {t('platform.play.tables.prev')}
            </button>
            <button type="button" disabled={to >= page.total} onClick={() => setOffset(page.query.offset + TABLE_PAGE)} className={cn(boarding, 'inline-flex items-center gap-1 text-brass-300 hover:text-paper-100')}>
              {t('platform.play.tables.next')}
              <ChevronRight size={12} aria-hidden />
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <section id="tables" aria-label={t('platform.play.tables.title')} className="mt-12 scroll-mt-28 pb-10">
      <h2 className="gz-head h2-section">{t('platform.play.tables.title')}</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="data-text text-[12px] text-iron-400 tnums">{page ? t('platform.play.tables.count', { count: page.counts.all - page.counts.live, live: page.counts.live }) : ' '}</p>
        {session && !stranger && (
          <button type="button" onClick={() => void seatMe()} disabled={busy !== null} title={t('platform.play.tables.seatMeHint')} className="gz-ticket gz-ticket-brass">
            <Armchair aria-hidden />
            {t('platform.play.tables.seatMe')}
          </button>
        )}
      </div>

      {/* the poster: the next train out, when one is filling */}
      {!stranger && next && <NextDeparture table={next} busy={busy !== null} onJoin={hands.onJoin} />}

      {/* the register's controls: filters, the search, the order */}
      {!stranger && (
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 border-y border-[var(--gz-ink-soft)] py-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => {
                setBoard((b) => ({ ...b, filter: chip.id }));
                setOffset(0);
              }}
              className={cn('gz-nav-link !py-1.5 !text-[10.5px]', filter === chip.id && 'is-active')}
            >
              {chip.label}
              {chip.count !== undefined && <span className="data-text ml-1.5 text-[10px] normal-case tracking-normal text-iron-600 tnums">{chip.count}</span>}
            </button>
          ))}
          <span className="flex-1" />
          <label className="relative" title={t('platform.play.tables.searchKey')}>
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-iron-400" />
            <input
              ref={search}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTyped('');
                  e.currentTarget.blur();
                }
              }}
              placeholder={t('platform.play.tables.search')}
              aria-label={t('platform.play.tables.search')}
              className="h-8 w-[220px] border-b border-[var(--gz-ink-soft)] bg-transparent pl-7 pr-7 font-serif text-[13px] italic text-paper-100 placeholder:text-iron-600 focus:border-brass-300 focus:outline-none"
            />
            <kbd aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 border border-[var(--gz-ink-faint)] px-1 font-mono text-[10px] leading-4 text-iron-600">
              /
            </kbd>
          </label>
          <span role="group" aria-label={t('platform.play.tables.sortFilling')} className="flex items-center gap-1 border-l border-[var(--gz-ink-faint)] pl-2">
            {(['filling', 'fresh'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={sort === id}
                onClick={() => {
                  setBoard((b) => ({ ...b, sort: id }));
                  setOffset(0);
                }}
                className={cn('gz-nav-link !py-1.5 !text-[10.5px]', sort === id && 'is-active')}
              >
                {t(id === 'filling' ? 'platform.play.tables.sortFilling' : 'platform.play.tables.sortFresh')}
              </button>
            ))}
          </span>
        </div>
      )}

      {body}
    </section>
  );
}
