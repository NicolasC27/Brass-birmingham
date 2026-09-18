import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The notebook: a page of the reader's own for the whole game — plans,  */
/* things to remember, what a rival seems to be after. One page per     */
/* table (the code online, the home table otherwise), kept on this      */
/* device and back at the next reload. The pins carry a word per town;  */
/* this carries the rest.                                               */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.notebook.v1';
const keyFor = (code: string | null) => (code ? `${KEY}:${code}` : KEY);
const read = (code: string | null): string => {
  try {
    return localStorage.getItem(keyFor(code)) ?? '';
  } catch {
    return '';
  }
};
const write = (code: string | null, text: string) => {
  try {
    if (text) localStorage.setItem(keyFor(code), text);
    else localStorage.removeItem(keyFor(code));
  } catch {
    /* not kept, still on screen */
  }
};

export default function NotebookButton({ className }: { className?: string }) {
  const t = useT();
  const code = useGame((s) => s.code);
  const [open, setOpen] = useState(false);
  /* the page belongs to the table: another table, another page */
  const [page, setPage] = useState(() => ({ code, text: read(code) }));
  if (page.code !== code) setPage({ code, text: read(code) });
  const text = page.text;
  const setText = (next: string) => setPage({ code, text: next });
  const box = useRef<HTMLTextAreaElement>(null);
  /* the page is written a beat after the pen stops */
  useEffect(() => {
    const id = window.setTimeout(() => write(code, text), 300);
    return () => window.clearTimeout(id);
  }, [code, text]);
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const filled = text.trim().length > 0;
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
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-label={t('board.notebook.title')}
            className="plate fixed left-3 top-1/2 z-[70] flex h-[min(46vh,420px)] w-[320px] -translate-y-1/2 flex-col p-3 shadow-e4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-fell text-[15px] tracking-wide text-brass-400">{t('board.notebook.title')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('board.notebook.close')} className="rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              ref={box}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 4000))}
              placeholder={t('board.notebook.placeholder')}
              aria-label={t('board.notebook.title')}
              className="paper min-h-0 flex-1 resize-none rounded-sm px-2.5 py-2 font-fell text-[13px] leading-snug text-ink-900 outline-none placeholder:text-ink-900/40 focus:ring-1 focus:ring-brass-400"
              onKeyDown={(e) => e.stopPropagation()}
            />
            <p className="mt-1.5 font-sans text-[9.5px] uppercase tracking-[0.14em] text-cream-100/40">{t('board.notebook.kept')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
