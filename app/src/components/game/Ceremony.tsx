import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useReducedMotion } from './useReducedMotion';

/**
 * Era transition ceremony (game.md §9) — 2400ms scrim, canal banner,
 * per-player scoring tickers, then the rail banner locks in.
 * Reduced motion: single crossfade. Skippable after 800ms.
 */
export default function Ceremony() {
  const t = useT();
  const ceremony = useGame((s) => s.ceremony);
  const game = useGame((s) => s.game);
  const endCeremony = useGame((s) => s.endCeremony);
  const setDebriefOpen = useGame((s) => s.setDebriefOpen);
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);

  // reset stages when a new ceremony begins (render-time adjustment pattern)
  if (ceremony !== seen) {
    setSeen(ceremony);
    setStage(0);
    setCanSkip(false);
  }

  useEffect(() => {
    if (!ceremony) return;
    /* an assisted table reads the figures at its own pace */
    const wait = !!game?.assist;
    if (reduced) {
      /* no motion to wait on: the figures and the button are there at once */
      const shown = [window.setTimeout(() => setStage(2), 0), window.setTimeout(() => setCanSkip(true), 0)];
      if (!wait) shown.push(window.setTimeout(() => endCeremony(), 900));
      return () => shown.forEach((t) => window.clearTimeout(t));
    }
    const timers = [
      window.setTimeout(() => setCanSkip(true), 800),
      window.setTimeout(() => setStage(1), 500),
      window.setTimeout(() => setStage(2), 2100),
      ...(wait ? [] : [window.setTimeout(() => endCeremony(), 3400)]),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ceremony, reduced, endCeremony, game?.assist]);

  if (!ceremony || !game) return null;
  const scores = game.canalScores ?? game.players.map(() => 0);
  /* an initiation game closes on this ceremony: no rail era follows it */
  const short = game.eraLength === 'short';
  const split = game.canalSplit;
  const me = game.players.findIndex((p) => !p.isBot);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto py-6 [justify-content:safe_center] bg-coal-950/80 backdrop-blur-md"
      role="dialog"
      aria-label={t('game.ceremony.aria')}
    >
      {/* canal banner sweeps across */}
      <motion.div
        initial={{ x: '-110%' }}
        animate={{ x: stage >= 2 ? '110%' : '0%', height: stage >= 2 ? 0 : 'auto', opacity: stage >= 2 ? 0 : 1 }}
        transition={{ duration: reduced ? 0.15 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-[min(860px,90vw)] overflow-hidden"
      >
        {/* banners are capped in height so the whole ceremony (both banners
            never show together) fits a 900px-tall window with its button */}
        <img src="/era-canal-banner.webp" alt={t('game.ceremony.canalAlt')} className="mx-auto max-h-[30vh] w-auto max-w-full rounded-md border border-brass-700/60 shadow-e4" />
      </motion.div>

      <motion.h2
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: reduced ? 0.15 : 1.0, delay: reduced ? 0 : 0.4 }}
        className="mt-6 font-fell text-3xl tracking-wide text-cream-100"
      >
        {t(short ? 'game.ceremony.headlineShort' : 'game.ceremony.headline')}
      </motion.h2>

      {/* scoring tickers */}
      <div className="mt-6 flex flex-col items-center gap-2">
        {game.players.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={stage >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: reduced ? 0 : i * 0.35, type: 'spring', stiffness: 260, damping: 24 }}
            className="flex items-center gap-3 rounded-md border border-brass-700/50 bg-coal-800/90 px-4 py-2"
          >
            <span className="h-3 w-3 rounded-full" style={{ background: PLAYER_COLORS[p.color]?.hex }} />
            <span className="w-36 font-sans text-sm font-semibold text-cream-100">{p.name}</span>
            <span className="font-mono text-xs text-cream-100/70">{t('game.ceremony.canalEra')}</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={stage >= 1 ? { opacity: 1 } : {}}
              transition={{ delay: reduced ? 0 : i * 0.35 + 0.25 }}
              className="font-display text-2xl font-black text-brass-400"
            >
              +{scores[i]}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {split && me >= 0 && (
        <p className="mt-4 max-w-[min(680px,90vw)] text-center font-serif text-sm leading-snug text-cream-100/85">
          {t('game.ceremony.mine', { vp: scores[me] ?? 0, tiles: split[me]?.tiles ?? 0, links: split[me]?.links ?? 0 })}
          {(split[me]?.pending ?? 0) > 0 ? ` ${t('game.ceremony.pending', { vp: split[me].pending })}` : ''}
        </p>
      )}
      <p className="mt-5 font-sans text-xs text-cream-100/60">
        {t(short ? 'game.ceremony.sublineShort' : 'game.ceremony.subline')}
      </p>

      {/* rail banner locks in — an initiation game has no era after this one */}
      <motion.div
        initial={{ x: '110%', opacity: 0 }}
        animate={stage >= 2 ? { x: '0%', opacity: 1 } : {}}
        transition={{ duration: reduced ? 0.15 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        className={cn('mt-6 w-[min(860px,90vw)]', short && 'hidden')}
      >
        <img src="/era-rail-banner.webp" alt={t('game.ceremony.railAlt')} className="mx-auto max-h-[30vh] w-auto max-w-full rounded-md border border-copper-500/70 shadow-e4" />
        <p className="mt-2 text-center font-display text-2xl font-black tracking-wide text-copper-500 brightness-125">
          {t('game.ceremony.railEra')}
        </p>
      </motion.div>

      {canSkip && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={endCeremony} className="btn-ledger !min-h-[36px] !px-4 !py-1.5 text-xs">
            {t('game.ceremony.continue')}
          </button>
          {/* a table that plays with assistance may read the canal era before
              the rail one begins: a training aid, hence the setting */}
          {game?.assist && ceremony === 'canal-end' && (
            <button
              type="button"
              onClick={() => {
                endCeremony();
                setDebriefOpen(true);
              }}
              className="btn-strike !min-h-[36px] !px-4 !py-1.5 text-xs"
            >
              {t('game.ceremony.readCanal')}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
