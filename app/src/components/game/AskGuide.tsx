import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, MessageCircleQuestion, X } from 'lucide-react';
import { faqBest, faqFor, passagesOf, rulesMatch } from '@/game/faq';
import { dictOf, useLang, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* A question to the guide, at any table: the guided game's column has  */
/* gone, but the rules it knows have not. A small plate opened from the */
/* tools, answered from the written rules first, then the codex.        */
/* ------------------------------------------------------------------ */

export default function AskGuide({ className }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const passages = useMemo(() => passagesOf((dictOf(lang) as { rules?: unknown }).rules), [lang]);
  const put = () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    const written = faqBest(q, faqFor(lang));
    const passage = written ? null : rulesMatch(q, passages);
    const a = written ? written.entry.answer : passage ? (passage.title ? `${passage.title} — ${passage.body}` : passage.body) : t('game.guide.ask.answer.none');
    setThread((prev) => [...prev.slice(-5), { q, a }]);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-pressed={open} title={t('game.guide.ask.open')} aria-label={t('game.guide.ask.open')} className={cn(className, open && '!border-brass-400 !opacity-100')}>
        <MessageCircleQuestion className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="ask-guide"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label={t('game.guide.ask.open')}
            className="plate fixed left-3 top-1/2 z-[70] flex max-h-[min(60vh,520px)] w-[340px] -translate-y-1/2 flex-col p-3 shadow-e4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('game.guide.ask.open')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('game.guide.ask.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {thread.length === 0 && <p className="font-serif text-[12.5px] leading-snug text-cream-100/60">{t('game.guide.ask.hint')}</p>}
              {thread.map((m, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="ml-6 rounded-md border border-bottle-600/50 bg-bottle-600/10 px-2.5 py-1.5 font-serif text-[12px] text-bottle-400">{m.q}</p>
                  <p className="rounded-md border border-brass-700/40 bg-coal-900/70 px-2.5 py-1.5 font-serif text-[12.5px] leading-snug text-cream-100/85">{m.a}</p>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                put();
              }}
              className="mt-2 flex shrink-0 items-center gap-2"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('game.guide.ask.placeholder')}
                aria-label={t('game.guide.ask.placeholder')}
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded-md border border-brass-700/60 bg-coal-900/90 px-3 py-1.5 font-sans text-[12px] text-cream-100 placeholder:text-cream-100/35 focus:border-brass-400 focus:outline-none"
              />
              <button type="submit" disabled={!question.trim()} aria-label={t('game.guide.ask.send')} title={t('game.guide.ask.send')} className="btn-strike !min-h-[32px] shrink-0 !px-3 !py-1 !text-[10px] disabled:opacity-40">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
