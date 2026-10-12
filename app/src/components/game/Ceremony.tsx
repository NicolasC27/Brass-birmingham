import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/game/data';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useLayer } from './useLayer';
import { useReducedMotion } from './useReducedMotion';

/* ------------------------------------------------------------------ */
/* The end of the canal era (game.md §9): the canal frieze sweeps       */
/* across, each seat's era figure comes in, the order settles once on   */
/* the standing, then the rail frieze locks in. The half-time of the    */
/* game waits for the reader: nothing closes it but Continue (or        */
/* Escape). Reduced motion keeps the same wait, without the slides.     */
/* A game reopened on this moment waits for the title card to lift.     */
/* ------------------------------------------------------------------ */

/** Continue shows once the figures have had a moment to land */
const SKIP_MS = 800;

function Ceremony({ ready = true }: { /** the table is set and in view: the ceremony starts then, not under the title card */ ready?: boolean }) {
  const t = useT();
  const ceremony = useGame((s) => s.ceremony);
  const game = useGame((s) => s.game);
  const endCeremony = useGame((s) => s.endCeremony);
  const home = useGame((s) => !s.code && !!s.local);
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [asked, setAsked] = useState(false);
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const live = !!ceremony && ready;
  /* Escape is Continue: the scene holds the table until it is answered */
  const box = useLayer(
    live,
    () => {
      endCeremony();
      setAsked(true);
    },
    { modal: true },
  );
  const go = useRef<HTMLButtonElement | null>(null);

  // reset stages when a new ceremony begins (render-time adjustment pattern)
  if (ceremony !== seen) {
    setSeen(ceremony);
    setStage(0);
    setCanSkip(false);
    setAsked(false);
    setHeld(false);
  }

  const seats = game?.players.length ?? 0;
  useEffect(() => {
    if (!live) return;
    if (reduced) {
      /* no motion to wait on: the figures, the order and the button at once */
      const shown = [window.setTimeout(() => setStage(3), 0), window.setTimeout(() => setCanSkip(true), 0)];
      return () => shown.forEach((id) => window.clearTimeout(id));
    }
    /* the figures land seat after seat, the order settles, then the rail frieze */
    const posted = 500 + seats * 350 + 500;
    const timers = [
      window.setTimeout(() => setStage(1), 500),
      window.setTimeout(() => setCanSkip(true), SKIP_MS),
      window.setTimeout(() => setStage(2), posted),
      window.setTimeout(() => setStage(3), posted + 1100),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [live, reduced, seats]);

  /* the keyboard goes to Continue as soon as it is there */
  useEffect(() => {
    if (live && canSkip) go.current?.focus({ preventScroll: true });
  }, [live, canSkip]);

  /* a move still on its way to the office holds the era open: say so rather
     than leave a button that does nothing */
  useEffect(() => {
    if (!asked || !home) return;
    const id = window.setTimeout(() => setHeld(true), 700);
    return () => window.clearTimeout(id);
  }, [asked, home]);

  if (!ceremony || !game) return null;
  const scores = game.canalScores ?? game.players.map(() => 0);
  /* an initiation game closes on this ceremony: no rail era follows it */
  const short = game.eraLength === 'short';
  const split = game.canalSplit;
  const me = game.players.findIndex((p) => !p.isBot);
  const seatsInOrder = game.players.map((p, i) => ({ p, i }));
  const order = stage >= 2 ? [...seatsInOrder].sort((a, b) => b.p.vp - a.p.vp || a.i - b.i) : seatsInOrder;
  const next = () => {
    endCeremony();
    setAsked(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      ref={box}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto pt-6 [justify-content:safe_center] bg-coal-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t('game.ceremony.aria')}
    >
      {/* canal banner sweeps across */}
      <motion.div
        initial={reduced ? false : { x: '-110%' }}
        animate={{ x: stage >= 3 && !reduced ? '110%' : '0%', height: stage >= 3 ? 0 : 'auto', opacity: stage >= 3 ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-[min(860px,90vw)] shrink-0 overflow-hidden"
      >
        {/* banners are capped in height so the whole ceremony (both banners
            never show together) fits a 768px-tall window with its button */}
        <img src="/era-canal-banner.webp" alt={t('game.ceremony.canalAlt')} className="mx-auto max-h-[26vh] w-auto max-w-full rounded-md border border-brass-700/60 shadow-e4" />
      </motion.div>

      <motion.h2
        initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: reduced ? 0 : 1.0, delay: reduced ? 0 : 0.4 }}
        className="mt-5 shrink-0 px-4 text-center font-fell text-3xl tracking-wide text-cream-100"
      >
        {t(short ? 'game.ceremony.headlineShort' : 'game.ceremony.headline')}
      </motion.h2>

      {/* the era's figures: the gain, then where it leaves each seat */}
      <div role="table" aria-label={t('game.ceremony.canalEra')} className="mt-5 flex shrink-0 flex-col items-stretch gap-1.5">
        <div role="row" className="grid grid-cols-[1fr_7rem_5.5rem] items-end gap-3 px-4 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-400/85">
          <span role="columnheader" className="sr-only">
            {t('game.scoring.thPlayer')}
          </span>
          <span role="columnheader" className="col-start-2 whitespace-nowrap text-right">
            {t('game.ceremony.canalEra')}
          </span>
          <span role="columnheader" className="text-right">
            {t('game.ceremony.totalHead')}
          </span>
        </div>
        {order.map(({ p, i }) => (
          <motion.div
            key={i}
            role="row"
            layout={reduced ? false : 'position'}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={stage >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: reduced || stage >= 2 ? 0 : i * 0.35, type: 'spring', stiffness: 260, damping: 24, layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
            className="grid w-[min(480px,90vw)] grid-cols-[1fr_7rem_5.5rem] items-center gap-3 rounded-md border border-brass-700/50 bg-coal-800/90 px-4 py-2"
          >
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[p.color]?.hex }} />
              <span className="truncate font-sans text-sm font-semibold text-cream-100">{p.name}</span>
            </span>
            <motion.span
              role="cell"
              initial={reduced ? false : { opacity: 0 }}
              animate={stage >= 1 ? { opacity: 1 } : {}}
              transition={{ delay: reduced || stage >= 2 ? 0 : i * 0.35 + 0.25 }}
              className="text-right font-display text-2xl font-black text-brass-400"
            >
              +{scores[i]}
            </motion.span>
            <motion.span
              role="cell"
              initial={reduced ? false : { opacity: 0 }}
              animate={stage >= 1 ? { opacity: 1 } : {}}
              transition={{ delay: reduced || stage >= 2 ? 0 : i * 0.35 + 0.45 }}
              className="text-right font-serif text-lg tabular-nums text-cream-100/85"
            >
              {t('game.ceremony.total', { vp: p.vp })}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {split && me >= 0 && (
        <p className="mt-4 max-w-[min(680px,90vw)] shrink-0 px-4 text-center font-serif text-sm leading-snug text-cream-100/85">
          {t('game.ceremony.mine', { vp: scores[me] ?? 0, tiles: split[me]?.tiles ?? 0, links: split[me]?.links ?? 0 })}
          {(split[me]?.pending ?? 0) > 0 ? ` ${t('game.ceremony.pending', { vp: split[me].pending })}` : ''}
        </p>
      )}
      <p className="mt-4 max-w-[min(760px,90vw)] shrink-0 px-4 text-center font-sans text-xs text-cream-100/60">{t(short ? 'game.ceremony.sublineShort' : 'game.ceremony.subline')}</p>

      {/* rail banner locks in — an initiation game has no era after this one */}
      <motion.div
        initial={reduced ? false : { x: '110%', opacity: 0 }}
        animate={stage >= 3 ? { x: '0%', opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        className={cn('mt-5 w-[min(860px,90vw)] shrink-0', short && 'hidden', stage < 3 && 'h-0 overflow-hidden')}
      >
        <img src="/era-rail-banner.webp" alt={t('game.ceremony.railAlt')} className="mx-auto max-h-[26vh] w-auto max-w-full rounded-md border border-copper-500/70 shadow-e4" />
        <p className="mt-2 text-center font-display text-2xl font-black uppercase tracking-wide text-copper-500 brightness-125">{t('game.ceremony.railEra')}</p>
      </motion.div>

      {/* Continue stays in view at the foot of the scene, whatever its height */}
      <div className="sticky bottom-0 mt-5 flex w-full shrink-0 flex-col items-center gap-1.5 pb-5">
        {canSkip && (
          <button ref={go} type="button" onClick={next} aria-keyshortcuts="Escape" className="btn-ledger !min-h-[36px] !bg-coal-950/90 !px-5 !py-1.5 text-xs shadow-e3">
            {t('game.ceremony.continue')}
          </button>
        )}
        {held && (
          <p role="status" className="font-fell text-[12.5px] italic text-brass-300/85">
            {t('game.homeTrouble.waiting')}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(Ceremony);
