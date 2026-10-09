import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PortraitMedallion } from '@/components/game/PlayerRail';
import { useReducedMotion } from '@/components/game/useReducedMotion';
import { trackProgress } from '@/components/game/titleStage';
import type { TitleStage } from '@/components/game/titleStage';
import { eraRounds } from '@/game/data';
import { homeSnapshot, subscribeHome } from '@/game/home';
import { useGame } from '@/game/store';
import type { Era, GameState } from '@/game/types';
import { useTable } from '@/online/lobby';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The title card: what the table shows while it is being set, in      */
/* place of a bare line of type. An engraved plate on the lacquer — the */
/* era's frieze, the table's name, the players in their medallions —    */
/* and a length of line laid under it while the press engraves the map. */
/* The same plate, with other words, says a board gone dark or a        */
/* quarrel with the office.                                             */
/* ------------------------------------------------------------------ */

/** the card lingers on a finished line this long before it lifts */
const LINGER_MS = 260;
/** and lifts off the table in this long */
const LIFT_S = 0.3;

/** the name of the table and what the register knows before the game is read */
function useTableTitle(code: string | null, local: string | null) {
  const table = useTable(code);
  const register = useSyncExternalStore(subscribeHome, homeSnapshot, homeSnapshot);
  const home = local ? (register.find((r) => r.code === local) ?? null) : null;
  return {
    name: table?.name ?? home?.name ?? null,
    ticket: code ?? local,
    era: home?.era ?? null,
    round: home?.round ?? null,
    chairs: home?.seats.length ?? table?.seats.length ?? 0,
  };
}

/** the lacquered table under a card that covers it: the wood, the lamp's
 *  pool of light, and the shadow the vignette leaves at the edges */
function Lacquer() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-coal-950" />
      <div aria-hidden className="tex-wood pointer-events-none absolute inset-0 opacity-35" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 48% 52% at 50% 47%, rgba(221,190,126,.10), transparent 72%)' }} />
      <img aria-hidden alt="" src="/hero-vignette.webp" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-80 mix-blend-multiply" />
    </>
  );
}

/** a brass rule either side of a line of small capitals */
function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-brass-500/60" />
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-brass-400">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-brass-500/60" />
    </div>
  );
}

/** the players round the table: their medallions once the game is read,
 *  empty sockets for the chairs the register counts before that */
function Medallions({ game, chairs }: { game: GameState | null; chairs: number }) {
  const t = useT();
  const reduced = useReducedMotion();
  const players = game?.players ?? [];
  const count = players.length || chairs;
  if (!count) return null;
  return (
    <ul aria-label={players.length ? t('game.titre.seatsAria', { names: players.map((p) => p.name).join(', ') }) : undefined} className="flex h-10 items-center justify-center gap-4">
      {players.length
        ? players.map((p, i) => (
            <motion.li
              key={i}
              title={p.name}
              initial={reduced ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.28 }}
              className="flex"
            >
              <PortraitMedallion p={p} index={i} active={false} size={40} />
            </motion.li>
          ))
        : Array.from({ length: count }, (_, i) => <li key={i} aria-hidden className="h-10 w-10 rounded-full border border-dashed border-brass-500/35 bg-coal-950/40" />)}
    </ul>
  );
}

/** a run of sleepers in brass at the given strength: 3 px of timber every 11 */
const SLEEPERS = (alpha: string) => `repeating-linear-gradient(90deg, rgba(201,164,92,${alpha}) 0 3px, transparent 3px 11px)`;

/** the line laid under the card: sleepers the whole way, the rails laid
 *  as far as the table has come, a lamp at the railhead */
function TableLine({ stage, quiet = false }: { stage: TitleStage; /** the line alone: the plate already says what is happening */ quiet?: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  /* time spent in the stretch the table is on, told by the clock below */
  const [elapsed, setElapsed] = useState(0);
  const [on, setOn] = useState(stage);
  if (on !== stage) {
    setOn(stage);
    setElapsed(0);
  }
  useEffect(() => {
    if (reduced || stage === 'ready') return;
    const id = window.setInterval(() => setElapsed((e) => e + 200), 200);
    return () => window.clearInterval(id);
  }, [reduced, stage]);
  const laid = trackProgress(stage, reduced ? 0 : elapsed);
  const said = stage === 'reading' ? t('game.page.settingTable') : stage === 'pressing' ? t('game.titre.pressing') : stage === 'engraving' ? t('game.titre.engraving') : t('game.titre.set');
  /* the rails and the lamp move on the same property, laid out together, so
     the lamp never runs ahead of its rails when the page is busy (a
     transform would ride the compositor while a clip waited on the page) */
  const reach = `${laid * 100}%`;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div role="progressbar" aria-label={t('game.titre.progressAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(laid * 100)} className="relative h-3 w-[300px] max-w-full">
        {/* the sleepers and the rails still to lay, faint */}
        <span aria-hidden className="absolute inset-x-0 top-[1px] h-2.5" style={{ background: SLEEPERS('.14') }} />
        <span aria-hidden className="absolute inset-x-0 top-[3px] h-px bg-brass-500/15" />
        <span aria-hidden className="absolute inset-x-0 top-[8px] h-px bg-brass-500/15" />
        {/* the length laid: the same track in brass, uncovered from the left */}
        <span aria-hidden className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: reach, transition: reduced ? undefined : 'width 240ms linear' }}>
          <span className="absolute left-0 top-[1px] h-2.5 w-[300px]" style={{ background: SLEEPERS('.5') }} />
          <span className="absolute left-0 top-[3px] h-px w-[300px] bg-brass-400" />
          <span className="absolute left-0 top-[8px] h-px w-[300px] bg-brass-400" />
        </span>
        {/* the lamp at the railhead */}
        <span aria-hidden className="absolute top-[3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-brass-300" style={{ left: reach, transition: reduced ? undefined : 'left 240ms linear', boxShadow: '0 0 8px 2px rgba(231,201,126,.55)' }} />
      </div>
      {!quiet && (
        <p aria-live="polite" className="font-fell text-[13px] italic text-brass-300/85">
          {said}
        </p>
      )}
    </div>
  );
}

/** the engraved plate itself: the era's frieze, what the table is, and
 *  under it whatever the moment has to say */
export function TitlePlate({ game, code, local, kicker, tone = 'brass', compact = false, children }: { game: GameState | null; code: string | null; local: string | null; /** in place of the era and the round */ kicker?: string; /** rust: the office or the board has something wrong to say */ tone?: 'brass' | 'rust'; /** the name alone, for a plate laid over a live table */ compact?: boolean; children: ReactNode }) {
  const t = useT();
  const title = useTableTitle(code, local);
  const era: Era = game?.era ?? title.era ?? 'canal';
  const round = game?.round ?? title.round;
  const eraName = era === 'canal' ? t('game.topbar.eraCanal') : t('game.topbar.eraRail');
  /* the register already knows the round and the chairs: the line reads the
     same before the game is read as after, and does not jump */
  const seats = game?.players.length ?? title.chairs;
  const line = kicker ?? (round && seats ? t('game.topbar.eraRoundTitle', { era: eraName, round, total: eraRounds(seats) }) : eraName);
  const name = title.name ?? (title.ticket ? t('game.titre.ticket', { code: title.ticket }) : null);
  return (
    <div className={cn('plate plaque-rivets relative w-[min(460px,calc(100vw-32px))] px-7 pb-6 pt-5 text-center shadow-e4', tone === 'rust' && 'border-rust-500/70')}>
      {/* the plate's other two rivets: the house plaque has two, a title plate is fixed at all four corners */}
      <span aria-hidden className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full shadow-[0_1px_1px_rgba(0,0,0,.5)]" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--brass-400)), var(--brass-700))' }} />
      <span aria-hidden className="absolute bottom-[7px] left-[7px] h-[5px] w-[5px] rounded-full shadow-[0_1px_1px_rgba(0,0,0,.5)]" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--brass-400)), var(--brass-700))' }} />
      {/* the era's frieze, an old print laid into the plate */}
      <div className="relative overflow-hidden rounded-[3px]" style={{ aspectRatio: '10 / 3', boxShadow: '0 0 0 1px rgba(10,7,5,.9), 0 0 0 2px rgba(201,164,92,.35)' }}>
        <img
          src={era === 'canal' ? '/era-canal-banner.webp' : '/era-rail-banner.webp'}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{ filter: tone === 'rust' ? 'sepia(.45) saturate(.6) brightness(.62) contrast(1.05)' : 'sepia(.35) saturate(.75) brightness(.8) contrast(1.06)' }}
        />
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 22px rgba(16,13,11,.55)' }} />
      </div>
      <div className="mt-4">
        <Kicker>{line}</Kicker>
      </div>
      {name && <h2 className="mt-2 font-fell text-[30px] leading-tight text-cream-100 [text-shadow:0_1px_0_rgba(0,0,0,.6)]">{name}</h2>}
      {!compact && title.name && title.ticket && <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-brass-500/75">{t('game.titre.ticket', { code: title.ticket })}</div>}
      {/* empty sockets say a game on its way: a plate with trouble to tell
          and no game read shows none */}
      {!compact && (game || tone === 'brass') && (
        <div className="mt-4">
          <Medallions game={game} chairs={title.chairs} />
        </div>
      )}
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** the card over the whole table while it is set: it lingers a beat on a
 *  finished line, then lifts and the table shows through */
export default function TitleCard({ stage, game, code, local }: { stage: TitleStage; game: GameState | null; code: string | null; local: string | null }) {
  const reduced = useReducedMotion();
  const [lifted, setLifted] = useState(false);
  const [on, setOn] = useState(stage);
  if (on !== stage) {
    setOn(stage);
    if (stage !== 'ready') setLifted(false);
  }
  useEffect(() => {
    if (stage !== 'ready') return;
    const id = window.setTimeout(() => setLifted(true), reduced ? 0 : LINGER_MS);
    return () => window.clearTimeout(id);
  }, [stage, reduced]);
  return (
    <AnimatePresence>
      {!lifted && (
        <motion.div
          key="title-card"
          data-title-card
          data-stage={stage}
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: LIFT_S, ease: 'easeOut', delay: reduced ? 0 : 0.06 }}
          role="status"
          aria-busy={stage !== 'ready'}
          /* once the table is set the card lets the pointer through, even while
             it fades: a lift that stalls (a tab in the background stops the
             frames) must never leave a sheet of glass over the game */
          className={cn('fixed inset-0 z-[96] flex items-center justify-center p-4', stage === 'ready' && 'pointer-events-none')}
        >
          <Lacquer />
          {/* the plate goes first, so the table never shows through its type */}
          <motion.div initial={false} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: 'easeIn' }} className="relative">
            <TitlePlate game={game} code={code} local={local}>
              <TableLine stage={stage} />
            </TitlePlate>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** a plate on the lacquer with something wrong to say and the roads out of
 *  it — the office that would not hand a game over */
export function TroubleCard({ game, code, local, children }: { game: GameState | null; code: string | null; local: string | null; children: ReactNode }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <Lacquer />
      <TitlePlate game={game} code={code} local={local} kicker={t('game.titre.troubleKicker')} tone="rust">
        {children}
      </TitlePlate>
    </div>
  );
}

/** the board went dark (the GPU took its context back): the same plate over
 *  the board, the line laid again while it is set up afresh, and the page
 *  itself offered if the browser never hands the context back */
export function BoardLostPlate({ game }: { game: GameState }) {
  const t = useT();
  const code = useGame((s) => s.code);
  const local = useGame((s) => s.local);
  return (
    <div role="alert" className="absolute inset-0 z-30 flex items-start justify-center px-4 pt-[14vh]">
      <Lacquer />
      <TitlePlate game={game} code={code} local={local} kicker={t('game.titre.lostKicker')} compact>
        <p className="font-sans text-sm leading-relaxed text-cream-100/85">{t('board.glLost')}</p>
        <div className="mt-4">
          <TableLine stage="engraving" quiet />
        </div>
        <button type="button" onClick={() => window.location.reload()} className="btn-ledger mt-4 !min-h-[36px] !px-4 !py-1.5 text-xs">
          {t('platform.boundary.reload')}
        </button>
      </TitlePlate>
    </div>
  );
}
