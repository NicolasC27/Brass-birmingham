import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, CircleMinus, Coins, Compass, FlaskConical, Hammer, Info, Landmark, Trophy, Waypoints } from 'lucide-react';
import { PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import type { LedgerEntry } from '@/game/types';
import { useT } from '@/i18n';
import { ledgerParts } from '@/game/ledgerText';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';
import { keyLabel, useKeybindings } from './keybindings';

const VERB_CLASS: Record<LedgerEntry['verb'], string> = {
  build: 'text-brass-400',
  network: 'text-bottle-600 brightness-150',
  develop: 'text-cream-100/85',
  sell: 'text-bottle-600 brightness-[1.7]',
  loan: 'text-rust-500 brightness-150',
  scout: 'text-cream-300',
  score: 'text-cream-100 font-semibold',
  system: 'text-cream-100/55 italic',
  pass: 'text-cream-100/45 italic',
};

const VERB_LABEL: Record<LedgerEntry['verb'], string> = {
  build: 'game.ledger.verbBuild',
  network: 'game.ledger.verbNetwork',
  develop: 'game.ledger.verbDevelop',
  sell: 'game.ledger.verbSell',
  loan: 'game.ledger.verbLoan',
  scout: 'game.ledger.verbScout',
  score: 'game.ledger.verbScore',
  system: 'game.ledger.verbSystem',
  pass: 'game.ledger.verbPass',
};

const VERB_ICON: Record<LedgerEntry['verb'], ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  build: Hammer,
  network: Waypoints,
  develop: FlaskConical,
  sell: Coins,
  loan: Landmark,
  scout: Compass,
  score: Trophy,
  system: Info,
  pass: CircleMinus,
};

/** the verbs' colours on the rounds grid */
const VERB_HEX: Record<LedgerEntry['verb'], string> = {
  build: '#DDBE7E',
  network: '#5FA37A',
  sell: '#8FD3A8',
  develop: '#F2EAD6',
  loan: '#E0604C',
  scout: '#C9B58C',
  pass: '#4A423A',
  score: '#6b5d45',
  system: '#3a3129',
};

/** Every player's every round at a glance, the way a contributions graph
 *  reads: one cell per player and round, split by the round's actions and
 *  coloured by what each was. Hover says the moves; a click opens the round. */
function RoundsGrid({ rounds, players, onPick, t }: { rounds: { key: string; era: LedgerEntry['era']; round: number; items: LedgerEntry[] }[]; players: { name: string; color: string }[]; onPick: (key: string) => void; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (rounds.length < 2) return null;
  return (
    <div className="mb-2 overflow-x-auto" aria-label={t('game.ledger.gridAria')}>
      <table className="border-separate border-spacing-[2px]">
        <tbody>
          {players.map((p, pi) => (
            <tr key={pi}>
              <th scope="row" className="pr-1.5 text-left font-sans text-[9px] font-bold" style={{ color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C' }}>
                {p.name.slice(0, 8)}
              </th>
              {rounds.map((r) => {
                const moves = r.items.filter((e) => e.player === pi && e.verb !== 'system' && e.verb !== 'score');
                const title = `${t('game.ledger.roundSep', { era: r.era === 'canal' ? t('game.ledger.eraCanal') : t('game.ledger.eraRail'), round: r.round })} — ${p.name}: ${moves.length ? moves.map((e) => ledgerParts(e, t).head).join(' · ') : '—'}`;
                return (
                  <td key={r.key} className="p-0">
                    <button type="button" onClick={() => onPick(r.key)} title={title} aria-label={title} className={cn('flex h-[13px] w-[13px] overflow-hidden rounded-[2px] ring-1 ring-black/40 transition-transform hover:scale-125', r.era === 'rail' && 'ring-copper-500/50')}>
                      {moves.length ? moves.slice(0, 2).map((e) => <span key={e.id} className="h-full flex-1" style={{ background: VERB_HEX[e.verb] }} />) : <span className="h-full flex-1" style={{ background: '#2a231c' }} />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The Ledger (game.md §7) — right-rail action log, live region, filter chips.
 *
 * An entry reads in two lines: what was done, in a few words, and the
 * figures under it; the player is named once in their colour and their
 * following moves stack under that name. Everything written since the
 * reader last looked (or since their own last move) is marked new.
 */
export default function Ledger({ seen = 0 }: { seen?: number }) {
  const t = useT();
  const keys = useKeybindings();
  const game = useGame((s) => s.game);
  const ledgerFilter = useGame((s) => s.ledgerFilter);
  const setLedgerFilter = useGame((s) => s.setLedgerFilter);
  const setHover = useGame((s) => s.setHover);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const code = useGame((s) => s.code);
  const seat = useGame((s) => s.seat);
  const rollbackTable = useGame((s) => s.rollbackTable);
  const rollbackOpen = useGame((s) => s.mood.rollback !== null);
  const hostSeat = useGame((s) => s.mood.host);
  const listRef = useRef<HTMLOListElement>(null);
  const [flash, setFlash] = useState<number | null>(null);
  /* rounds the reader folded or unfolded by hand; the rest follow the rule above */
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.ledger.length]);

  if (!game) return null;

  const entries = game.ledger.filter((e) => {
    if (ledgerFilter === 'all') return true;
    if (ledgerFilter === 'economy') return e.verb === 'sell' || e.verb === 'loan' || e.verb === 'score';
    if (ledgerFilter === 'network') return e.verb === 'network' || e.verb === 'build';
    return e.player === Number(ledgerFilter.slice(1));
  });
  const newFrom = game.ledger[seen]?.id ?? Infinity;

  const visible = entries.slice(-80);
  /* the register reads by round: the one being played is open, the earlier
     ones fold to a heading and a row of who-did-what icons, unfolded on a
     click — and any round holding something new opens by itself */
  const rounds: { key: string; era: LedgerEntry['era']; round: number; items: LedgerEntry[] }[] = [];
  for (const e of visible) {
    const key = `${e.era}:${e.round}`;
    const last = rounds[rounds.length - 1];
    if (last && last.key === key) last.items.push(e);
    else rounds.push({ key, era: e.era, round: e.round, items: [e] });
  }
  const firstNew = visible.find((e) => e.id >= newFrom)?.id;
  const allRounds: typeof rounds = [];
  for (const e of game.ledger) {
    const key = `${e.era}:${e.round}`;
    const last = allRounds[allRounds.length - 1];
    if (last && last.key === key) last.items.push(e);
    else allRounds.push({ key, era: e.era, round: e.round, items: [e] });
  }
  const isOpen = (r: (typeof rounds)[number], i: number) => folded[r.key] === undefined ? i === rounds.length - 1 || r.items.some((e) => e.id >= newFrom) : !folded[r.key];

  return (
    <section aria-label={t('game.ledger.aria')} className="plate relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3">
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.06]" />
      <header className="relative mb-2">
        <div className="flex items-center justify-between">
          <h2 className="font-fell text-[15px] tracking-[0.08em] text-brass-400">{t('game.ledger.heading')}</h2>
          <span className="flex items-center gap-2">
            {/* the whole game so far, action by action, on the board */}
            <Link
              to="/replay?live=1"
              className="rounded-sm border border-brass-700/60 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider text-brass-400 transition-colors hover:border-brass-400"
              title={`${t('game.ledger.replay')} (${keyLabel(keys.replay)})`}
            >
              {t('game.ledger.replay')}
            </Link>
            <span className="font-mono text-[9px] text-cream-100/35" title={t('game.ledger.hashTitle')}>
              #{game.ledgerSeq.toString(36)}
            </span>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {[
            { id: 'all' as const, label: t('game.ledger.filterAll') },
            ...game.players.map((p, i) => ({ id: `p${i}` as const, label: p.name, color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C' })),
            { id: 'economy' as const, label: t('game.ledger.filterEconomy') },
            { id: 'network' as const, label: t('game.ledger.filterNetwork') },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLedgerFilter(f.id)}
              className={cn(
                'flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider transition-colors',
                ledgerFilter === f.id
                  ? 'border-brass-500 bg-brass-500/15 text-brass-400'
                  : 'border-brass-700/40 text-cream-100/55 hover:text-cream-100/85',
              )}
            >
              {'color' in f && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />}
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <RoundsGrid
        rounds={allRounds}
        players={game.players.map((p) => ({ name: p.name, color: p.color }))}
        t={t}
        onPick={(key) => {
          setFolded((f) => ({ ...f, [key]: false }));
          window.setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-round="${key}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
        }}
      />
      <ol ref={listRef} aria-live="polite" className="relative min-h-0 flex-1 overflow-y-auto pr-1 text-[12.5px]">
        {rounds.map((r, ri) => {
          const open = isOpen(r, ri);
          const acted = r.items.filter((e) => e.player !== undefined && e.verb !== 'system' && e.verb !== 'score');
          return (
            <li key={r.key} data-round={r.key} className="group relative mb-1">
              {/* the round's heading: click to fold or unfold; folded, hovering
                  it shows the round's moves in a plaque without unfolding */}
              <button
                type="button"
                onClick={() => setFolded((f) => ({ ...f, [r.key]: open }))}
                aria-expanded={open}
                className={cn('flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-brass-500/10', open ? 'mt-1' : 'mt-0.5')}
              >
                {open ? <ChevronDown className="h-3 w-3 shrink-0 text-brass-500" /> : <ChevronRight className="h-3 w-3 shrink-0 text-brass-500" />}
                <span className="font-fell text-[10.5px] tracking-[0.2em] text-brass-500/90">
                  {t('game.ledger.roundSep', { era: r.era === 'canal' ? t('game.ledger.eraCanal') : t('game.ledger.eraRail'), round: r.round })}
                </span>
                <span className="h-px flex-1 bg-brass-700/50" />
                <span className="font-mono text-[9px] text-cream-100/40">{t('game.ledger.roundCount', { n: acted.length })}</span>
              </button>
              {!open && acted.length > 0 && (
                <div className="plaque pointer-events-none absolute left-4 right-0 top-full z-20 hidden rounded-md p-2 group-hover:block">
                  {acted.map((e) => (
                    <p key={e.id} className="flex items-baseline gap-1.5 py-px font-sans text-[11px] leading-snug">
                      <span className="shrink-0 font-bold" style={{ color: PLAYER_COLORS[game.players[e.player!].color]?.hex ?? '#C9A45C' }}>
                        {game.players[e.player!].name}
                      </span>
                      <span className={cn('shrink-0 text-[8px] font-bold tracking-wider', VERB_CLASS[e.verb])}>{t(VERB_LABEL[e.verb])}</span>
                      <span className="min-w-0 truncate text-cream-100/85">{ledgerParts(e, t).head}</span>
                    </p>
                  ))}
                </div>
              )}
              {open && (
                <ol>
                  <AnimatePresence initial={false}>
                    {r.items.map((e, idx) => {
                      const fresh = e.id >= newFrom;
                      const prev = idx > 0 ? r.items[idx - 1] : undefined;
                      const named = e.player !== undefined && (!prev || prev.player !== e.player || e.id === firstNew);
                      const color = e.player !== undefined ? (PLAYER_COLORS[game.players[e.player].color]?.hex ?? '#C9A45C') : undefined;
                      const Icon = VERB_ICON[e.verb];
                      const { head, detail } = ledgerParts(e, t);
                      return (
                        <motion.li key={e.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
                          {e.id === firstNew && (
                            <div className="my-1.5 flex items-center gap-2">
                              <span className="h-px flex-1 bg-brass-400/70" />
                              <span className="font-sans text-[8.5px] font-bold tracking-[0.18em] text-brass-400">{t('game.ledger.newSince')}</span>
                              <span className="h-px flex-1 bg-brass-400/70" />
                            </div>
                          )}
                          {named && (
                            <p className={cn('mb-0.5 px-1 font-sans text-[11px] font-bold tracking-wide', prev && 'mt-2')} style={{ color }}>
                              {game.players[e.player!].name}
                            </p>
                          )}
                          <div className={cn('flex items-start gap-1', fresh && 'border-l-2 border-brass-400/80')}>
                            <button
                              type="button"
                              onClick={() => {
                                if (e.region) {
                                  flyToRegion(e.region); // camera glides to the town/link
                                  setHover(e.region); // board flashes the town/link region
                                  window.setTimeout(() => setHover(null), 900);
                                }
                                setFlash(e.id);
                                window.setTimeout(() => setFlash(null), 900);
                              }}
                              className={cn('flex min-w-0 flex-1 items-start gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-brass-500/10', flash === e.id && 'bg-brass-500/15')}
                            >
                              <Icon aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: color ?? 'rgba(244,236,216,0.45)' }} />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-1.5">
                                  <span className={cn('shrink-0 font-sans text-[8.5px] font-bold tracking-wider', VERB_CLASS[e.verb])}>{t(VERB_LABEL[e.verb])}</span>
                                  <span className={cn('font-sans leading-snug text-cream-100/90', (e.verb === 'system' || e.verb === 'score') && e.player === undefined && 'italic text-cream-100/65')}>{head}</span>
                                </span>
                                {detail && <span className="mt-0.5 block font-sans text-[10.5px] leading-snug text-cream-100/55">{detail}</span>}
                              </span>
                            </button>
                            {/* online, the host may propose to return the table to before this action */}
                            {code && seat !== null && seat === hostSeat && !rollbackOpen && e.at !== undefined && e.at < (game.actions?.length ?? 0) && e.verb !== 'system' && e.verb !== 'score' && game.phase === 'action' && (
                              <button
                                type="button"
                                onClick={() => rollbackTable('propose', e.at)}
                                title={t('game.mood.rollbackHere')}
                                aria-label={t('game.mood.rollbackHere')}
                                className="mt-1 shrink-0 rounded-sm border border-brass-700/40 px-1 font-mono text-[9px] text-cream-100/40 hover:border-rust-500 hover:text-rust-500"
                              >
                                ⟲
                              </button>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
