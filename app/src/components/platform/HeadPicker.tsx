import { Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { HEADS, headUrl } from '@/platform/heads';

/* ------------------------------------------------------------------ */
/* HeadPicker — the four heads of the house, one to wear at the        */
/* tables. A head worn by another seat of the same table is not        */
/* offered; « none » gives the head back, so another may be picked.    */
/* ------------------------------------------------------------------ */

export interface HeadPickerProps {
  /** the head worn now, if any */
  value: number | null;
  /** the heads other seats of the table wear: not to be picked */
  taken?: ReadonlySet<number>;
  /** a head picked, or none */
  onPick: (head: number | null) => void;
  /** « none » offered, to give a head back */
  none?: boolean;
  /** the medallions' size in px */
  size?: number;
  className?: string;
}

export default function HeadPicker({ value, taken, onPick, none = false, size = 40, className }: HeadPickerProps) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('platform.heads.title')} className={cn('flex items-center gap-1.5', className)}>
      {HEADS.map((n) => {
        const worn = value === n;
        const busy = !worn && !!taken?.has(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={worn}
            disabled={busy}
            title={busy ? `${t(`platform.heads.h${n}`)} — ${t('platform.heads.taken')}` : t(`platform.heads.h${n}`)}
            onClick={() => onPick(n)}
            className={cn(
              'rounded-full border p-[2px] transition-[opacity,border-color]',
              worn ? 'border-brass-500 bg-brass-500/15' : busy ? 'cursor-not-allowed border-transparent opacity-25 grayscale' : 'border-enamel-line opacity-60 hover:border-brass-hairline-strong hover:opacity-100',
            )}
          >
            <img src={headUrl(n)} alt={t(`platform.heads.h${n}`)} draggable={false} className="rounded-full object-cover" style={{ width: size, height: size }} />
          </button>
        );
      })}
      {none && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          title={t('platform.heads.none')}
          onClick={() => onPick(null)}
          className={cn(
            'flex items-center justify-center rounded-full border text-iron-400 transition-[opacity,border-color]',
            value === null ? 'border-brass-500 bg-brass-500/15 text-brass-300' : 'border-enamel-line opacity-60 hover:border-brass-hairline-strong hover:opacity-100',
          )}
          style={{ width: size + 6, height: size + 6 }}
        >
          <Ban aria-hidden style={{ width: size * 0.5, height: size * 0.5 }} />
        </button>
      )}
    </div>
  );
}
