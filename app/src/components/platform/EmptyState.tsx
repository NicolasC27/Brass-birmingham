import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Button from './Button';
import { useTheme } from '@/platform/theme';

/** the two plates an empty state may print: a table nobody sits at, a platform nobody waits on */
export type EmptyPlate = 'tables' | 'queue';

/* ------------------------------------------------------------------ */
/* EmptyState (design.md §7.8) — illustration + titre de carte (15px,  */
/* phrase + CTA primaire. Jamais de panneau vide muet. Variante `mini` */
/* pour les colonnes du tableau des tables (icône seule, home.md §S2). */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  title: string;
  copy?: string;
  /** the engraving printed above the words, in the register's own ink */
  plate?: EmptyPlate;
  cta?: { label: string; to?: string; onClick?: () => void; icon?: ReactNode };
  /** colonne compacte : icône 20px + phrase 13px, pas d'illustration */
  mini?: boolean;
  icon?: ReactNode;
  className?: string;
}

export default function EmptyState({ title, copy, plate, cta, mini = false, icon, className }: EmptyStateProps) {
  const theme = useTheme();
  if (mini) {
    return (
      <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
        {icon && <span className="text-iron-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        <p className="font-ui text-[13px] text-iron-400">{title}</p>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center gap-4 px-6 py-8 text-center', className)}>
      {plate && (
        <div className="gz-engraving w-full max-w-[460px]">
          <img src={`/empty-${plate}${theme === 'dark' ? '-night' : ''}.webp`} alt="" className="!aspect-[16/9]" />
        </div>
      )}
      <p className="title-card">{title}</p>
      {copy && <p className="max-w-sm font-serif text-[13.5px] italic text-paper-300">{copy}</p>}
      {cta && (
        <Button variant="primary" to={cta.to} onClick={cta.onClick} icon={cta.icon}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}
