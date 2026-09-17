import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Tabs (design.md §7.8) — filet laiton 2px animé (layoutId), labels   */
/* Inter 600 13px.                                                     */
/* ------------------------------------------------------------------ */

export interface TabItem {
  id: string;
  label: string;
  /** pastille optionnelle (compteur) */
  badge?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  /** layoutId partagé — unique par groupe d'onglets rendu */
  groupId: string;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, groupId, className }: TabsProps) {
  return (
    <div role="tablist" className={cn('flex gap-1 border-b border-[rgb(var(--paper-100)/.07)]', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-3 pb-2 pt-1 font-ui text-[13px] font-semibold transition-colors duration-150',
              isActive ? 'text-paper-100' : 'text-iron-400 hover:text-paper-100',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && <span className="data-text ml-1.5 text-[11px] text-iron-600 tnums">{tab.badge}</span>}
            {isActive && (
              <motion.span
                layoutId={`tab-underline-${groupId}`}
                className="absolute inset-x-2 -bottom-px h-0.5 bg-brass-500"
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
