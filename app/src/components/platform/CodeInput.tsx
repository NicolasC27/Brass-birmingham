import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import Button from './Button';

/* ------------------------------------------------------------------ */
/* CodeInput (design.md §7.6) — rejoindre par code. Cellules 44×52px,  */
/* Plex Mono 22px, cellule active bordure brass-400 (legacy). Coller   */
/* un code remplit tout ; complet → Rejoindre s'active ; erreur →      */
/* secousse x ±6px, 3 cycles, 200ms + bordure rust.                    */
/* NB : les codes réels de Brassworks font 4 caractères                */
/* (online/table.ts normalizeCode) — `length` reste réglable.          */
/* ------------------------------------------------------------------ */

const CELL = /^[A-Z0-9]$/;

export interface CodeInputProps {
  length?: number;
  onSubmit: (code: string) => void;
  className?: string;
}

export default function CodeInput({ length = 4, onSubmit, className }: CodeInputProps) {
  const t = useT();
  const [cells, setCells] = useState<string[]>(Array(length).fill(''));
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const complete = cells.every((c) => c !== '');

  const setAt = (i: number, v: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const focus = (i: number) => {
    const idx = Math.max(0, Math.min(length - 1, i));
    setCursor(idx);
    refs.current[idx]?.focus();
  };

  const fill = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    if (!clean) return;
    const next = Array(length).fill('');
    for (let i = 0; i < clean.length; i++) next[i] = clean[i];
    setCells(next);
    setError(false);
    focus(clean.length);
  };

  const submit = () => {
    if (complete) {
      onSubmit(cells.join(''));
    } else {
      setError(true);
      window.setTimeout(() => setError(false), 400);
      focus(cells.findIndex((c) => c === ''));
    }
  };

  return (
    <motion.div
      animate={error ? { x: [0, -6, 6, -6, 6, -6, 0] } : { x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex flex-col items-center gap-4', className)}
    >
      <div className="flex gap-2" role="group" aria-label={t('platform.code.title')}>
        {cells.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={c}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={1}
            aria-label={`${t('platform.code.title')} ${i + 1}`}
            aria-invalid={error}
            onFocus={() => setCursor(i)}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().slice(-1);
              if (v && !CELL.test(v)) return;
              setAt(i, v);
              setError(false);
              if (v) focus(i + 1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !c) focus(i - 1);
              if (e.key === 'ArrowLeft') focus(i - 1);
              if (e.key === 'ArrowRight') focus(i + 1);
              if (e.key === 'Enter') submit();
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(e.clipboardData.getData('text'));
            }}
            className={cn(
              'h-[52px] w-11 rounded-lg border bg-enamel-850 text-center font-mono text-[22px] font-medium uppercase text-paper-100 caret-signal-400',
              error ? 'border-rust-600' : cursor === i ? 'border-brass-400' : 'border-brass-hairline',
              c && !error && 'border-bottle-500',
            )}
          />
        ))}
      </div>
      {error && <p className="font-ui text-[13px] text-rust-400">{t('platform.code.invalid')}</p>}
      <Button variant="primary" disabled={!complete} onClick={submit}>
        {t('platform.code.join')}
      </Button>
    </motion.div>
  );
}
