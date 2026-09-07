import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* One frame for every page of the house that is not the board: the   */
/* soot vignette, a back link, an eyebrow, a title set in Playfair and */
/* a lede set in Spectral. Pages fill the slot; nothing else differs.  */
/* ------------------------------------------------------------------ */

export default function PageShell({
  back,
  eyebrow,
  title,
  lede,
  aside,
  width = 'wide',
  children,
}: {
  back?: { to: string; label: string };
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** something at the right of the header (a plaque, a status) */
  aside?: React.ReactNode;
  width?: 'wide' | 'narrow';
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(16,13,11,0.75) 100%)' }} />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.05]" />
      <div className={cn('relative mx-auto px-6 py-10 lg:py-14', width === 'wide' ? 'max-w-[1180px]' : 'max-w-[720px]')}>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            {back && (
              <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-100/55 transition-colors hover:text-brass-400">
                <ArrowLeft className="h-3.5 w-3.5" />
                {back.label}
              </Link>
            )}
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="mt-2 font-display text-[40px] font-black leading-[1.05] tracking-[-0.01em] text-cream-100 lg:text-[46px]">{title}</h1>
            {lede && <p className="mt-3 max-w-2xl font-serif text-[16px] leading-relaxed text-cream-100/70">{lede}</p>}
          </div>
          {aside}
        </header>
        {children}
      </div>
    </div>
  );
}

/** a dark panel with a title rule — the plate the pages are built from */
export function Panel({ title, meta, children, className, tone = 'plate' }: { title?: React.ReactNode; meta?: React.ReactNode; children: React.ReactNode; className?: string; tone?: 'plate' | 'paper' }) {
  return (
    <section className={cn(tone === 'plate' ? 'plate' : 'paper', 'relative p-5 lg:p-6', className)}>
      <div aria-hidden className={cn('tex-paper pointer-events-none absolute inset-0 rounded-[8px]', tone === 'plate' ? 'opacity-[0.05]' : 'opacity-[0.35]')} />
      {title && (
        <header className="relative mb-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={cn('font-fell text-[17px] uppercase tracking-[0.06em]', tone === 'plate' ? 'text-cream-100' : 'text-ink-900')}>{title}</h2>
            {meta && <span className={cn('font-mono text-[11px]', tone === 'plate' ? 'text-cream-100/50' : 'text-ink-900/60')}>{meta}</span>}
          </div>
          <div className="divider-brass mt-3 !mx-0" />
        </header>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

/** a labelled field, the same on every page of the house */
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-400/80">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 font-sans text-[11.5px] leading-snug text-cream-100/50">{hint}</p>}
    </div>
  );
}

export const inputClass = 'w-full rounded-md border border-brass-700/60 bg-coal-950/70 px-3 py-2 font-sans text-[14px] text-cream-100 placeholder:text-cream-100/30 focus:border-brass-400 focus:outline-none disabled:opacity-50';

/** the office's own words for a refusal */
export function Refusal({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 rounded-md border border-rust-500/60 bg-rust-500/10 px-3 py-2 font-sans text-[12.5px] text-rust-500 brightness-150">
      {text}
    </p>
  );
}
