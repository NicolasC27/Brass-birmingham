import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { useDockReserve } from './useLayer';

const STEPS: { anchor: string; tip: string }[] = [
  /* above the hand it describes, never over its cards */
  { anchor: 'bottom-center-up', tip: 'game.coach.tipHand' },
  { anchor: 'right-top', tip: 'game.coach.tipExchange' },
  { anchor: 'right-bottom', tip: 'game.coach.tipLedger' },
  { anchor: 'top-center', tip: 'game.coach.tipConfirm' },
  { anchor: 'left', tip: 'game.coach.tipRail' },
];

/* where a mark stands. The centring rides on the entrance animation's own
   transform (x / y as percentages): a translate class would be overwritten
   by it, and the mark would stand half its width off its anchor */
interface Anchor {
  className: string;
  style?: { bottom?: number };
  x?: string;
  y?: string;
}
function anchorOf(a: string, reserve: number): Anchor {
  switch (a) {
    case 'top-center':
      return { className: 'left-1/2 top-24 items-center', x: '-50%' };
    case 'right-top':
      return { className: 'right-4 top-20 items-end' };
    case 'right-bottom':
      return { className: 'bottom-40 right-4 items-end' };
    case 'bottom-center-up':
      return { className: 'left-1/2 items-center', style: { bottom: reserve + 8 }, x: '-50%' };
    case 'left':
      return { className: 'left-[76px] top-1/2 items-start', y: '-50%' };
    default:
      return { className: 'left-1/2 items-center', style: { bottom: reserve + 8 }, x: '-50%' };
  }
}

/** First-game coach marks (game.md §8) — 5 skippable brass-ringed pulses. */
function CoachMarks() {
  const t = useT();
  const step = useGame((s) => s.coachStep);
  const setStep = useGame((s) => s.setCoachStep);
  const game = useGame((s) => s.game);
  const reserve = useDockReserve();
  if (step < 0 || !game || game.players[game.current]?.isBot) return null;
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const at = anchorOf(s.anchor, reserve);

  return (
    <AnimatePresence>
      <motion.div
        key={step}
        initial={{ opacity: 0, x: at.x ?? 0, y: at.y ?? 8 }}
        animate={{ opacity: 1, x: at.x ?? 0, y: at.y ?? 0 }}
        exit={{ opacity: 0 }}
        className={`pointer-events-none fixed z-[72] flex flex-col gap-2 ${at.className}`}
        style={at.style}
      >
        <div className="pointer-events-auto max-w-[240px] rounded-md border-2 border-brass-400 bg-coal-900/95 p-3 shadow-[0_0_18px_rgba(201,164,92,.45)]">
          <p className="font-sans text-xs leading-snug text-cream-100">{t(s.tip)}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-brass-400/80">{step + 1} / {STEPS.length}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(-1)} className="min-h-[24px] px-1 font-sans text-[10px] font-semibold uppercase text-cream-100/65 hover:text-cream-100">
                {t('game.coach.skip')}
              </button>
              <button
                type="button"
                onClick={() => setStep(step + 1 >= STEPS.length ? -1 : step + 1)}
                className="min-h-[24px] px-1 font-sans text-[10px] font-bold uppercase text-brass-400 hover:text-brass-500"
              >
                {t('game.coach.next')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* renders on its own subscriptions, not on every render of the page */
export default memo(CoachMarks);
