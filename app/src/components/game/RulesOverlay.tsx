import { memo, useEffect, useRef, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { useLayer } from './useLayer';
import { passageFor, useWhy } from '@/game/refusalRules';
import { getActions, getChapters } from '@/components/rules/rulesData';

/** The small "why?" beside a refusal: opens the rule it rests on, at the table. */
export function WhyLink({ reason, verb, className }: { reason: string | null | undefined; verb?: string | null; className?: string }) {
  const t = useT();
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    useWhy.getState().ask(passageFor(reason, verb), e.currentTarget);
    useGame.getState().setRulesOpen(true);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('game.why.aria')}
      className={`pointer-events-auto whitespace-nowrap font-sans text-[11px] leading-[inherit] text-brass-300 underline decoration-brass-500/50 underline-offset-2 hover:text-cream-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brass-400 ${className ?? ''}`}
    >
      {t('game.why.link')}
    </button>
  );
}

/** The cited passage: the codex's own words for that chapter and action, lit for a moment. */
function Citation() {
  const t = useT();
  const passage = useWhy((s) => s.passage);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (passage) box.current?.scrollIntoView({ block: 'nearest' });
  }, [passage]);
  if (!passage) return null;
  const chapter = getChapters().find((c) => c.id === passage.chapter);
  const action = passage.action ? getActions().find((a) => a.id === passage.action) : undefined;
  return (
    <section ref={box} aria-labelledby="rules-why-title" className="rules-why mt-4 rounded border border-brass-700/40 px-4 py-3">
      <style>{`@keyframes rules-why-lit{from{background:rgba(201,152,63,.28)}to{background:rgba(201,152,63,.06)}}.rules-why{background:rgba(201,152,63,.06);animation:rules-why-lit 1.6s ease-out}@media (prefers-reduced-motion: reduce){.rules-why{animation:none}}`}</style>
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-ink-900/60">
        {t('game.why.cited')} · {chapter?.numeral} {chapter?.title}
      </p>
      {action && (
        <div className="mt-1.5 font-sans text-[13px] leading-relaxed text-ink-900/85">
          <h3 id="rules-why-title" className="font-display text-lg font-bold text-ink-900">{action.name}</h3>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-900/60">{t('game.why.steps')}</p>
          <ol className="ml-4 list-decimal">{action.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-900/60">{t('game.why.edges')}</p>
          <ul className="ml-4 list-disc">{action.edges.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {!action && <h3 id="rules-why-title" className="sr-only">{chapter?.title}</h3>}
      <Link to={`/rules#${passage.chapter}`} className="mt-2 inline-block font-sans text-[12px] text-ink-900 underline underline-offset-2">
        {t('game.why.codex')}
      </Link>
    </section>
  );
}

/** `?` rules overlay — quick reference modal, links to the full codex. */
function RulesOverlay() {
  const t = useT();
  const open = useGame((s) => s.rulesOpen);
  const setOpenRaw = useGame((s) => s.setRulesOpen);
  /* closing hands the keyboard back to the "why?" that opened the sheet */
  const setOpen = (next: boolean) => {
    setOpenRaw(next);
    if (next) return;
    const { opener } = useWhy.getState();
    useWhy.getState().clear();
    if (opener) setTimeout(() => { if (opener.isConnected) opener.focus(); }, 0);
  };
  /* a sheet across the whole table: it holds the keyboard while it is up */
  const sheet = useLayer(open, () => setOpen(false), { modal: true });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-coal-950/75 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          ref={sheet}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t('game.rules.aria')}
        >
          <motion.div
            initial={{ scale: 0.92, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="paper relative max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto p-7 shadow-e4"
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
            <Citation />
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

/* renders on its own subscriptions, not on every render of the page */
export default memo(RulesOverlay);
