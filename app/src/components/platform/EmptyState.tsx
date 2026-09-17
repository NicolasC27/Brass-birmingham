import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Button from './Button';

/* ------------------------------------------------------------------ */
/* EmptyState (design.md §7.8) — illustration + titre Fraunces 20px +  */
/* phrase + CTA primaire. Jamais de panneau vide muet. Variante `mini` */
/* pour les colonnes du tableau des tables (icône seule, home.md §S2). */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  title: string;
  copy?: string;
  /** illustration 240px — ex. /empty-tables.png */
  image?: string;
  cta?: { label: string; to?: string; onClick?: () => void; icon?: ReactNode };
  /** colonne compacte : icône 20px + phrase 13px, pas d'illustration */
  mini?: boolean;
  icon?: ReactNode;
  className?: string;
}

export default function EmptyState({ title, copy, image, cta, mini = false, icon, className }: EmptyStateProps) {
  if (mini) {
    return (
      <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
        {icon && <span className="text-iron-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        <p className="font-ui text-[13px] text-iron-400">{title}</p>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center gap-4 rounded-xl border border-brass-hairline bg-enamel-850 px-6 py-10 text-center', className)}>
      {image && <img src={image} alt="" className="w-60 rounded-lg border border-[rgb(var(--paper-100)/.07)]" width={240} />}
      <h3 className="font-fraunces text-[20px] font-semibold text-paper-100">{title}</h3>
      {copy && <p className="max-w-sm font-ui text-[13px] text-paper-300">{copy}</p>}
      {cta && (
        <Button variant="primary" to={cta.to} onClick={cta.onClick} icon={cta.icon}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}
