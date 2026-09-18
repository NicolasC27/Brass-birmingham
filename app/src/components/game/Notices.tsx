import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { PLAYER_COLORS, TOWN_BY_ID, incomeLevel } from '@/game/data';
import { ledgerParts } from '@/game/ledgerText';
import { useGame } from '@/game/store';
import { tileFaceUrl } from '@/gl/faces';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';

/* ------------------------------------------------------------------ */
/* What happened that the reader should not miss, said where it        */
/* belongs. The reader's own tiles turning over land under the banner; */
/* what the others did that matters — their tiles turning, a beer      */
/* drawn from the reader's brewery — stacks at the top right. Each note */
/* stays a dozen seconds, or until its cross is clicked. The reader's   */
/* income rising floats up the middle of the board for a moment.        */
/* ------------------------------------------------------------------ */

interface Note {
  id: string;
  side: 'mine' | 'others';
  kind: 'flip' | 'beer' | 'pin';
  owner: number;
  industry?: string;
  title: string;
  detail: string;
  /** a flip, once read in the middle, waits under the players on the left */
  docked?: boolean;
}
const SHOWN_MS = 12000;
const DOCK_MS = 5000;
const FLOAT_MS = 2200;

export default function Notices() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const { tileArt } = useBoardOptions();
  const pins = useGame((s) => s.pins);
  const insets = useHudInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  /* the banner's lower edge: the sales' notices hang right under it */
  const [under, setUnder] = useState<number | null>(null);
  const shown = notes.length > 0;
  useEffect(() => {
    /* the banner is remounted when the turn changes hands: it is looked up
       each time, and followed while a notice hangs under it */
    const measure = () => {
      const bar = document.querySelector('[data-topbar]');
      if (bar) setUnder(Math.round(bar.getBoundingClientRect().bottom));
    };
    measure();
    if (!shown) return;
    const iv = window.setInterval(measure, 400);
    return () => window.clearInterval(iv);
  }, [shown]);
  /* the player rail's foot: the flips settle under it once read */
  const [rail, setRail] = useState<{ left: number; top: number; width: number } | null>(null);
  const docked = notes.some((n) => n.kind === 'flip' && n.docked);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector('[data-player-rail]');
      if (el) {
        const r = el.getBoundingClientRect();
        setRail({ left: Math.round(r.left), top: Math.round(r.bottom), width: Math.round(r.width) });
      }
    };
    measure();
    if (!docked) return;
    const iv = window.setInterval(measure, 400);
    return () => window.clearInterval(iv);
  }, [docked]);
  const [seen, setSeen] = useState<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; n: number }[]>([]);
  const [incomeSeen, setIncomeSeen] = useState<number | null>(null);
  const ledger = game?.ledger;
  const players = game?.players;
  const me = seat ?? (players ? players.findIndex((p) => !p.isBot) : -1);
  const myIncome = me >= 0 && players ? incomeLevel(players[me].income) : null;

  /* the ledger, read from where the reader last was */
  useEffect(() => {
    if (!ledger || !players) return;
    if (seen === null) {
      const mark = window.setTimeout(() => setSeen(ledger.length ? ledger[ledger.length - 1].id + 1 : 0), 0);
      return () => window.clearTimeout(mark);
    }
    const last = ledger.length ? ledger[ledger.length - 1].id + 1 : seen;
    if (last === seen) return;
    const fresh = ledger.filter((e) => e.id >= seen && e.player !== undefined);
    const add = window.setTimeout(() => {
      setSeen(last);
      const items: Note[] = [];
      for (const e of fresh) {
        if (e.key === 'flip') {
          /* the works in the title, the owner and the reason under it */
          const { head } = ledgerParts(e, t);
          const why = t(`game.flip.why.${String(e.vars?.why ?? 'empties')}`, { merchant: String(e.vars?.merchant ?? '') });
          items.push({ id: `f${e.id}`, side: e.player === me ? 'mine' : 'others', kind: 'flip', owner: e.player!, industry: String(e.vars?.industry ?? ''), title: t('game.flip.title', { what: head }), detail: t('game.flip.detail', { name: players[e.player!].name, why, income: Number(e.vars?.income ?? 0) }) });
        }
        /* a pinned town: whatever another player does there is reported */
        if (e.player !== me && e.region && pins[e.region] !== undefined && (e.key === 'build' || e.key === 'sell' || e.key === 'network' || e.key === 'flip')) {
          const { head, detail } = ledgerParts(e, t);
          items.push({ id: `p${e.id}`, side: 'others', kind: 'pin', owner: e.player!, industry: e.vars?.industry ? String(e.vars.industry) : undefined, title: t('game.notice.pinned', { town: TOWN_BY_ID[e.region]?.name ?? e.region }), detail: `${head}${detail ? ' · ' + detail : ''}` });
        }
        if (e.key === 'sell' && e.player !== me && typeof e.vars?.beerFrom === 'string' && e.vars.beerFrom) {
          for (const bit of String(e.vars.beerFrom).split(',')) {
            const [owner, town] = bit.split(':');
            if (Number(owner) !== me) continue;
            items.push({ id: `b${e.id}:${town}`, side: 'others', kind: 'beer', owner: e.player!, industry: 'brewery', title: t('game.notice.beerTaken', { name: players[e.player!].name, town: TOWN_BY_ID[town]?.name ?? town }), detail: ledgerParts(e, t).head });
          }
        }
      }
      if (!items.length) return;
      setNotes((n) => [...n, ...items]);
      /* a tile flipped is read in the middle for a moment, then settles under
         the players until the reader closes it; the rest fades */
      for (const it of items) {
        if (it.kind === 'flip') window.setTimeout(() => setNotes((n) => n.map((x) => (x.id === it.id ? { ...x, docked: true } : x))), DOCK_MS);
        else window.setTimeout(() => setNotes((n) => n.filter((x) => x.id !== it.id)), SHOWN_MS);
      }
    }, 0);
    return () => window.clearTimeout(add);
  }, [ledger, players, seen, me, t, pins]);

  /* the reader's income climbing: a figure floats up the board */
  useEffect(() => {
    if (myIncome === null) return;
    if (incomeSeen === null) {
      const mark = window.setTimeout(() => setIncomeSeen(myIncome), 0);
      return () => window.clearTimeout(mark);
    }
    if (myIncome === incomeSeen) return;
    const go = window.setTimeout(() => {
      setIncomeSeen(myIncome);
      if (myIncome > incomeSeen) {
        const id = Date.now();
        setFloats((f) => [...f, { id, n: myIncome - incomeSeen }]);
        window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS);
      }
    }, 0);
    return () => window.clearTimeout(go);
  }, [myIncome, incomeSeen]);

  if (!game) return null;
  const dismiss = (id: string) => setNotes((n) => n.filter((x) => x.id !== id));
  const card = (f: Note) => {
    const color = PLAYER_COLORS[game.players[f.owner]?.color]?.hex ?? '#C9A45C';
    const accent = f.kind === 'beer' ? '#E0604C' : f.kind === 'pin' ? '#C9A45C' : color;
    return (
      <motion.div
        key={f.id}
        layout
        layoutId={f.id}
        initial={{ opacity: 0, y: -14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="plaque pointer-events-auto relative flex items-center gap-3 rounded-lg border border-cream-100/15 py-2 pl-2 pr-8"
        style={{ boxShadow: '0 3px 8px rgba(0,0,0,.35), 0 12px 28px rgba(0,0,0,.35)' }}
        role="status"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-l-lg" style={{ background: accent }} />
        {f.industry && (
          <span className="ml-1 h-11 w-11 shrink-0 overflow-hidden rounded-md" style={{ boxShadow: `0 0 0 1.5px ${color}` }}>
            <img src={tileFaceUrl(f.industry as never, tileArt, game.players[f.owner]?.color ?? 'brass')} alt="" className="h-full w-full object-cover" />
          </span>
        )}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn('font-fell text-[14.5px] tracking-wide', f.kind === 'beer' ? 'text-rust-500 brightness-150' : 'text-cream-100')}>{f.title}</span>
          <span className="font-sans text-[11px] tracking-wide text-cream-100/70">{f.detail}</span>
        </span>
        <button type="button" onClick={() => dismiss(f.id)} aria-label={t('game.notice.dismiss')} className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-cream-100/50 hover:text-brass-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    );
  };
  return (
    <>
      {/* the reader's own, under the banner */}
      <div className="pointer-events-none fixed left-1/2 z-[82] flex w-[min(520px,60vw)] -translate-x-1/2 flex-col items-center gap-2" style={{ top: (under ?? insets.top + 108) + 10 }} aria-live="polite">
        <AnimatePresence>{notes.filter((n) => (n.kind === 'flip' ? !n.docked : n.side === 'mine')).map(card)}</AnimatePresence>
      </div>
      {/* the flips already read, settled under the players and their tools */}
      <div className="pointer-events-none fixed z-[63] flex flex-col items-stretch gap-2" style={{ left: rail?.left ?? insets.left, top: (rail?.top ?? insets.top + 320) + 10, width: rail?.width ?? 300 }} aria-live="off">
        <AnimatePresence>{notes.filter((n) => n.kind === 'flip' && n.docked).map(card)}</AnimatePresence>
      </div>
      {/* the others', at the top right under the exchange */}
      <div className="pointer-events-none fixed right-3 z-[82] flex w-[min(340px,40vw)] flex-col items-stretch gap-2" style={{ top: insets.top + 52 }} aria-live="polite">
        <AnimatePresence>{notes.filter((n) => n.kind !== 'flip' && n.side === 'others').map(card)}</AnimatePresence>
      </div>
      {/* income rising: the figure floats up the middle of the board */}
      <div className="pointer-events-none fixed left-1/2 top-[44%] z-[82] -translate-x-1/2">
        <AnimatePresence>
          {floats.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 24, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [24, -10, -40, -70], scale: [0.8, 1.15, 1.1, 1] }}
              transition={{ duration: FLOAT_MS / 1000, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
              className="font-fell text-[40px] tracking-wide text-bottle-600 brightness-150"
              style={{ textShadow: '0 2px 0 rgba(0,0,0,.8), 0 0 24px rgba(95,163,122,.55)' }}
            >
              {t('game.notice.income', { n: f.n })}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
