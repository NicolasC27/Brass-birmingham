import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { leftSheetStyle, useDockReserve, useLayer } from './useLayer';

/* ------------------------------------------------------------------ */
/* The notebook: a page of the reader's own for the whole game — plans,  */
/* things to remember, what a rival seems to be after. One page per     */
/* table, kept at the office beside the towns the reader pinned, so it  */
/* comes back on another machine and no one else ever reads it.         */
/* ------------------------------------------------------------------ */

export default function NotebookButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  /* the page belongs to the table, and travels with it */
  const text = useGame((s) => s.notebook);
  const setNotebook = useGame((s) => s.setNotebook);
  /* what is typed shows at once; the office hears a beat after the pen stops */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? text;
  const setText = (next: string) => setDraft(next);
  useEffect(() => {
    if (draft === null || draft === text) return;
    const id = window.setTimeout(() => setNotebook(draft), 300);
    return () => window.clearTimeout(id);
  }, [draft, text, setNotebook]);
  /* a sheet of the left edge: the pen lands on the page as it opens, and
     Escape (heard by the table, ahead of the page's own keys) puts it away */
  const sheet = useLayer(open, () => setOpen(false), { zone: 'left' });
  const reserve = useDockReserve();
  const filled = shown.trim().length > 0;
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-pressed={open} title={t('board.notebook.open')} aria-label={t('board.notebook.open')} className={cn(className, open && '!border-brass-400 !opacity-100')}>
        <NotebookPen className="h-4 w-4" />
        {filled && !open && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brass-400 shadow-[0_0_0_1px_rgba(0,0,0,.6)]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="notebook"
            ref={sheet}
            tabIndex={-1}
            initial={{ opacity: 0, x: -8, y: '-50%' }}
            animate={{ opacity: 1, x: 0, y: '-50%' }}
            exit={{ opacity: 0, x: -8, y: '-50%' }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label={t('board.notebook.title')}
            className="plate fixed left-3 z-[70] flex h-[min(46vh,420px)] w-[320px] flex-col p-3 shadow-e4"
            style={leftSheetStyle(reserve)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('board.notebook.title')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('board.notebook.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              autoFocus
              value={shown}
              onChange={(e) => setText(e.target.value.slice(0, 4000))}
              placeholder={t('board.notebook.placeholder')}
              aria-label={t('board.notebook.title')}
              className="paper min-h-0 flex-1 resize-none rounded-sm px-2.5 py-2 font-serif text-[13px] leading-snug text-ink-900 placeholder:text-ink-900/40"
              onKeyDown={(e) => e.stopPropagation()}
            />
            <p className="mt-1.5 font-sans text-[10px] uppercase tracking-[0.14em] text-cream-100/60">{t('board.notebook.kept')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
