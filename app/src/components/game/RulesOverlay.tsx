import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';

/** `?` rules overlay — quick reference modal, links to the full codex. */
export default function RulesOverlay() {
  const t = useT();
  const open = useGame((s) => s.rulesOpen);
  const setOpen = useGame((s) => s.setRulesOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-coal-950/75 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label={t('game.rules.aria')}
        >
          <motion.div
            initial={{ scale: 0.92, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="paper relative w-full max-w-[560px] p-7 shadow-e4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t('game.rules.closeAria')}
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded p-1 text-ink-900/60 hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-2xl font-black text-ink-900">{t('game.rules.title')}</h2>
            <div className="mt-4 space-y-3 font-sans text-[13px] leading-relaxed text-ink-900/85">
              <p><strong>{t('game.rules.yourTurnLead')}</strong> — {t('game.rules.yourTurnBody')}</p>
              <p><strong>{t('game.rules.buildLead')}</strong> — {t('game.rules.buildBody')}</p>
              <p><strong>{t('game.rules.networkLead')}</strong> — {t('game.rules.networkBody')}</p>
              <p><strong>{t('game.rules.sellLead')}</strong> — {t('game.rules.sellBody')}</p>
              <p><strong>{t('game.rules.loanLead')}</strong> — {t('game.rules.loanBody')}</p>
              <p><strong>{t('game.rules.scoringLead')}</strong> — {t('game.rules.scoringBody')}</p>
              <p className="font-mono text-[11px] text-ink-900/60">{t('game.hand.keysHint')}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <Link to="/rules" className="btn-ledger !border-ink-900/40 !text-ink-900 hover:!bg-ink-900/10" onClick={() => setOpen(false)}>
                {t('game.rules.codex')}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
