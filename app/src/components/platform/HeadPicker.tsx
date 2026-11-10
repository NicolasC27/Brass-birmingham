import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { HEADS, bakeHead, headUrl, useBakedHeads } from '@/platform/heads';

/* ------------------------------------------------------------------ */
/* HeadPicker — the four heads of the house (the founder, the spinner, */
/* the forgemaster, the shipowner), one of which a member may wear at  */
/* the tables in place of a picture of their own. A head is a picture  */
/* like any other to the office: picked, it is cut to the same 160 px  */
/* of WebP and kept as the member's likeness, so every seat, rail and  */
/* plate that shows a likeness shows it without knowing it is a head.  */
/* ------------------------------------------------------------------ */

export interface HeadPickerProps {
  /** the likeness worn now (a data URL), to mark the head it is, if any */
  value: string | null;
  /** a head picked: its likeness, baked */
  onPick: (likeness: string) => void;
  /** the medallions' size in px */
  size?: number;
  className?: string;
}

export default function HeadPicker({ value, onPick, size = 40, className }: HeadPickerProps) {
  const t = useT();
  const heads = useBakedHeads();
  return (
    <div role="radiogroup" aria-label={t('platform.heads.title')} className={cn('flex items-center gap-1.5', className)}>
      {HEADS.map((n) => {
        const worn = value !== null && heads[n] === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={worn}
            title={t(`platform.heads.h${n}`)}
            onClick={() => void bakeHead(n).then(onPick)}
            className={cn(
              'rounded-full border p-[2px] transition-[opacity,border-color]',
              worn ? 'border-brass-500 bg-brass-500/15' : 'border-enamel-line opacity-60 hover:border-brass-hairline-strong hover:opacity-100',
            )}
          >
            <img src={headUrl(n)} alt={t(`platform.heads.h${n}`)} draggable={false} className="rounded-full object-cover" style={{ width: size, height: size }} />
          </button>
        );
      })}
    </div>
  );
}
