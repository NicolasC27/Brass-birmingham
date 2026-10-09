import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* A small « ? » beside a word of the station: pressed, a bubble says   */
/* what the word means in the journal's voice, with the way to the     */
/* whole glossary. Terms live in platform.glossary.terms.<id>.          */
/* ------------------------------------------------------------------ */

export default function GlossMark({ id, className }: { id: string; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <span ref={ref} className={cn('relative inline-block align-middle', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('platform.glossary.what', { term: t(`platform.glossary.terms.${id}.name`) })}
        onClick={() => setOpen((o) => !o)}
        /* the disc stays a 16px mark in the line, the hand gets 24px round it:
           the margins give back what the zone adds, so the line keeps its height */
        className="group -my-1 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full"
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--gz-ink-soft)] font-ui text-[9px] font-semibold text-iron-400 transition-colors group-hover:border-brass-300 group-hover:text-paper-100"
        >
          ?
        </span>
      </button>
      {open && (
        <span
          role="note"
          className="absolute left-0 top-6 z-40 block w-[280px] border border-[var(--gz-ink-soft)] bg-enamel-850 p-4 text-left font-normal normal-case tracking-normal shadow-[inset_0_0_0_3px_rgb(var(--enamel-850)),inset_0_0_0_4px_var(--gz-ink-faint),0_8px_24px_var(--shadow-modal)]"
        >
          <span className="block font-fraunces text-[15px] font-medium text-paper-100">
            {t(`platform.glossary.terms.${id}.name`)}
          </span>
          <span className="mt-1 block font-serif text-[13px] italic leading-relaxed text-paper-300">{t(`platform.glossary.terms.${id}.def`)}</span>
          {/* the glossary opens on this very word, not at its top */}
          <Link to={`/glossaire#${id}`} className="mt-2 inline-block font-ui text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-300 transition-colors hover:text-paper-100">
            {t('platform.glossary.all')} →
          </Link>
        </span>
      )}
    </span>
  );
}
