import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* PageShell « Club Industriel » (design.md §2–§4) — the shared frame  */
/* of the account pages: a back link, a micro-label eyebrow, a         */
/* Fraunces page title and an Inter lede, on the lacquer floor. Pages  */
/* fill the slot with `Panel` consoles; the API (Panel / Field /       */
/* inputClass / Refusal) is stable — other pages build on it.          */
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
    <div className={cn('mx-auto px-4 pb-24 pt-10 sm:px-8', width === 'wide' ? 'max-w-[1240px]' : 'max-w-[640px]')}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          {back && (
            <Link to={back.to} className="micro-label mb-4 inline-flex items-center gap-1.5 text-iron-400 transition-colors duration-150 hover:text-brass-300">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {back.label}
            </Link>
          )}
          {eyebrow && <p className="eyebrow-fell">{eyebrow}</p>}
          <h1 className="display-page mt-2">{title}</h1>
          {lede && <p className="mt-3 max-w-2xl font-serif text-[15px] italic leading-relaxed text-paper-300">{lede}</p>}
        </div>
        {aside}
      </header>
      {children}
    </div>
  );
}

/** an enamel console with a title rule — the panel the pages are built from */
export function Panel({ title, meta, children, className, tone = 'plate' }: { title?: React.ReactNode; meta?: React.ReactNode; children: React.ReactNode; className?: string; tone?: 'plate' | 'paper' }) {
  return (
    <section className={cn('console console-ruled relative overflow-hidden p-5 lg:p-6', className)}>
      {tone === 'paper' && <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-50" />}
      {title && (
        <header className="relative mb-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="title-card">{title}</h2>
            {meta && <span className="data-text text-[12px] tabular-nums text-iron-400">{meta}</span>}
          </div>
          <div className="mt-3 h-px bg-brass-hairline" />
        </header>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

/** a labelled field, the same on every page of the club */
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="micro-label block text-brass-300/90">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 font-ui text-[12px] leading-snug text-iron-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-brass-hairline-strong bg-lacquer-950/70 px-3 py-2 font-ui text-[13px] text-paper-100 transition-colors duration-150 placeholder:text-iron-600 focus:border-brass-500 focus:outline-none disabled:opacity-50';

/** the office's own words for a refusal */
export function Refusal({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-rust-400/50 bg-rust-600/10 px-3 py-2 font-ui text-[13px] text-rust-400">
      {text}
    </p>
  );
}
