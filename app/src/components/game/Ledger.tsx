import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import type { LedgerEntry } from '@/game/types';
import { useT } from '@/i18n';
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

const FILTERS = [
  { id: 'all', label: 'game.ledger.filterAll' },
  { id: 'me', label: 'game.ledger.filterMe' },
  { id: 'economy', label: 'game.ledger.filterEconomy' },
  { id: 'network', label: 'game.ledger.filterNetwork' },
] as const;

/**
 * The Ledger (game.md §7) — right-rail action log, live region, filter chips.
 */
export default function Ledger() {
  const t = useT();
  const keys = useKeybindings();
  const game = useGame((s) => s.game);
  const ledgerFilter = useGame((s) => s.ledgerFilter);
  const setLedgerFilter = useGame((s) => s.setLedgerFilter);
  const setHover = useGame((s) => s.setHover);
  const flyToRegion = useGame((s) => s.flyToRegion);
  const listRef = useRef<HTMLOListElement>(null);
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.ledger.length]);

  if (!game) return null;

  const entries = game.ledger.filter((e) => {
    if (ledgerFilter === 'all') return true;
    if (ledgerFilter === 'me') {
      const firstHuman = game.players.findIndex((p) => !p.isBot);
      return e.player === firstHuman;
    }
    if (ledgerFilter === 'economy') return e.verb === 'sell' || e.verb === 'loan' || e.verb === 'score';
    return e.verb === 'network' || e.verb === 'build';
  });

  const visible = entries.slice(-60);
  const roundBreak = new Set<number>();
  {
    let lastKey = '';
    for (const e of visible) {
      const k = `${e.era}:${e.round}`;
      if (k !== lastKey) {
        roundBreak.add(e.id);
        lastKey = k;
      }
    }
  }

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
        <div className="mt-1.5 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLedgerFilter(f.id)}
              className={cn(
                'rounded-sm border px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider transition-colors',
                ledgerFilter === f.id
                  ? 'border-brass-500 bg-brass-500/15 text-brass-400'
                  : 'border-brass-700/40 text-cream-100/55 hover:text-cream-100/85',
              )}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </header>

      <ol ref={listRef} aria-live="polite" className="relative min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[12px]">
        <AnimatePresence initial={false}>
          {visible.map((e, idx) => {
            const sep = roundBreak.has(e.id);
            const age = visible.length - idx;
            const color = e.player !== undefined ? (PLAYER_COLORS[game.players[e.player].color]?.hex ?? '#C9A45C') : 'transparent';
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: age > 30 ? 0.6 : age > 12 ? 0.8 : 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                {sep && (
                  <div className="my-1.5 flex items-center gap-2">
                    <span className="h-px flex-1 bg-brass-700/50" />
                    <span className="font-fell text-[10px] tracking-[0.2em] text-brass-500/80">
                      {t('game.ledger.roundSep', { era: e.era === 'canal' ? t('game.ledger.eraCanal') : t('game.ledger.eraRail'), round: e.round })}
                    </span>
                    <span className="h-px flex-1 bg-brass-700/50" />
                  </div>
                )}
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
                  className={cn(
                    'flex w-full items-baseline gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-brass-500/10',
                    flash === e.id && 'bg-brass-500/15',
                  )}
                >
                  <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                  <span className={cn('shrink-0 font-sans text-[9px] font-bold tracking-wider', VERB_CLASS[e.verb])}>
                    {t(VERB_LABEL[e.verb])}
                  </span>
                  <span className="font-sans leading-snug text-cream-100/80">{e.text}</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
