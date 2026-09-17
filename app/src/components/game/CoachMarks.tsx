import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';

const STEPS: { anchor: string; tip: string }[] = [
  { anchor: 'bottom-center', tip: 'game.coach.tipHand' },
  { anchor: 'right-top', tip: 'game.coach.tipExchange' },
  { anchor: 'right-bottom', tip: 'game.coach.tipLedger' },
  { anchor: 'top-center', tip: 'game.coach.tipConfirm' },
  { anchor: 'left', tip: 'game.coach.tipRail' },
];

function anchorClass(a: string): string {
  switch (a) {
    case 'top-center':
      return 'left-1/2 top-24 -translate-x-1/2 items-center';
    case 'right-top':
      return 'right-4 top-20 items-end';
    case 'right-bottom':
      return 'bottom-40 right-4 items-end';
    case 'bottom-center-up':
      return 'bottom-44 left-1/2 -translate-x-1/2 items-center';
    case 'left':
      return 'left-[76px] top-1/2 -translate-y-1/2 items-start';
    default:
      return 'bottom-4 left-1/2 -translate-x-1/2 items-center';
  }
}

/** First-game coach marks (game.md §8) — 5 skippable brass-ringed pulses. */
export default function CoachMarks() {
  const t = useT();
  const step = useGame((s) => s.coachStep);
  const setStep = useGame((s) => s.setCoachStep);
  const game = useGame((s) => s.game);
  if (step < 0 || !game || game.players[game.current]?.isBot) return null;
  const s = STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <AnimatePresence>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`pointer-events-none fixed z-[72] flex flex-col gap-2 ${anchorClass(s.anchor)}`}
      >
        <div className="pointer-events-auto max-w-[240px] rounded-md border-2 border-brass-400 bg-coal-900/95 p-3 shadow-[0_0_18px_rgba(201,164,92,.45)]">
          <p className="font-sans text-xs leading-snug text-cream-100">{t(s.tip)}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-brass-500">{step + 1} / {STEPS.length}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(-1)} className="font-sans text-[10px] font-semibold uppercase text-cream-100/50 hover:text-cream-100">
                {t('game.coach.skip')}
              </button>
              <button
                type="button"
                onClick={() => setStep(step + 1 >= STEPS.length ? -1 : step + 1)}
                className="font-sans text-[10px] font-bold uppercase text-brass-400 hover:text-brass-500"
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
