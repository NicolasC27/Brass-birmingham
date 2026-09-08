import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug, Lightbulb, X } from 'lucide-react';
import { isOnline } from '@/online/lobby';
import { sendFeedback, useSession } from '@/online/session';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The suggestion box. An idea or a bug, written from any page, goes   */
/* to the house (the server keeps it); without a server, or for those  */
/* who prefer it, the repository's issues are one link away.           */
/* ------------------------------------------------------------------ */

const ISSUES = 'https://github.com/NicolasC27/Brass-birmingham/issues/new';

export function FeedbackButton({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={t('site.feedback.title')} aria-label={t('site.feedback.title')} className={className}>
        <Lightbulb className="h-3.5 w-3.5" />
        {!compact && t('site.feedback.button')}
      </button>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { pathname } = useLocation();
  const session = useSession();
  const [kind, setKind] = useState<'idea' | 'bug'>('idea');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'failed'>('idle');
  const canSend = isOnline && !!session;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      await sendFeedback(pathname, kind, text);
      setState('sent');
      setText('');
    } catch {
      setState('failed');
    }
  };
  const issueUrl = `${ISSUES}?title=${encodeURIComponent(`[${kind}] `)}&body=${encodeURIComponent(`${text}\n\n(page: ${pathname})`)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] flex items-center justify-center bg-coal-950/70 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.98 }} role="dialog" aria-label={t('site.feedback.title')} className="plate relative w-full max-w-[520px] p-5">
            <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-[8px] opacity-[0.05]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow !text-[10px]">{t('site.feedback.eyebrow')}</p>
                  <h2 className="mt-1 font-display text-[22px] font-bold text-cream-100">{t('site.feedback.title')}</h2>
                </div>
                <button type="button" onClick={onClose} aria-label={t('game.hand.cancel')} className="rounded-full p-1 text-cream-100/50 hover:text-brass-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                {(['idea', 'bug'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-[10.5px] font-bold uppercase tracking-[0.12em]', kind === k ? 'border-brass-400 bg-brass-500/20 text-brass-400' : 'border-brass-700/60 text-cream-100/60 hover:text-cream-100/90')}
                  >
                    {k === 'idea' ? <Lightbulb className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}
                    {t(`site.feedback.${k}`)}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setState('idle');
                }}
                rows={5}
                maxLength={4000}
                placeholder={t(`site.feedback.placeholder.${kind}`)}
                className="mt-3 w-full resize-y rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-2 font-serif text-[14px] leading-relaxed text-cream-100 placeholder:text-cream-100/30 focus:border-brass-400 focus:outline-none"
              />
              <p className="mt-1.5 font-sans text-[11px] text-cream-100/45">{t(canSend ? 'site.feedback.hintOnline' : 'site.feedback.hintOffline')}</p>
              {state === 'sent' && <p className="mt-2 font-sans text-[12px] font-semibold text-bottle-600 brightness-150">{t('site.feedback.sent')}</p>}
              {state === 'failed' && <p className="mt-2 font-sans text-[12px] font-semibold text-rust-500 brightness-150">{t('site.feedback.failed')}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {canSend && (
                  <button type="button" onClick={send} disabled={!text.trim()} className="btn-strike !min-h-[38px] !px-4 !py-1.5 !text-[11px] disabled:cursor-not-allowed disabled:opacity-40">
                    {t('site.feedback.send')}
                  </button>
                )}
                <a href={issueUrl} target="_blank" rel="noreferrer" className="btn-ledger !min-h-[38px] !px-4 !py-1.5 !text-[11px]">
                  {t('site.feedback.github')}
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
