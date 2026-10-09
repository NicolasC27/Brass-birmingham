import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Tabs (design.md §7.8) — filet laiton 2px animé (layoutId), labels   */
/* Inter 600 13px.                                                     */
/*                                                                     */
/* The rail is named « tabs », so it keeps the bargain the name makes: */
/* a real tablist, an id on every heading, a panel that says which     */
/* heading it belongs to, one stop in the tab order, and the arrows,   */
/* Home and End to walk the rail. Pages that draw their own row of     */
/* buttons should come here instead.                                   */
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
  /** ce que le rail nomme, pour qui l'entend sans le voir */
  ariaLabel?: string;
  className?: string;
}

/* the ids the rail and its sheets agree on; kept in here, so the pair can
   never drift apart between a heading and the panel it opens */
const tabHeadingId = (groupId: string, id: string) => `${groupId}-tab-${id}`;
const tabPanelId = (groupId: string, id: string) => `${groupId}-panel-${id}`;

export default function Tabs({ tabs, active, onChange, groupId, ariaLabel, className }: TabsProps) {
  const rail = useRef<HTMLDivElement>(null);

  /* the arrows walk the rail and open as they go; Home and End take the ends */
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = tabs.findIndex((tab) => tab.id === active);
    if (at < 0) return;
    let next = at;
    if (e.key === 'ArrowRight') next = (at + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    rail.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabHeadingId(groupId, tabs[next].id))}`)?.focus();
  }

  return (
    <div
      ref={rail}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('flex gap-1 border-b border-[rgb(var(--paper-100)/.07)]', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            id={tabHeadingId(groupId, tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={tabPanelId(groupId, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-3 pb-2 pt-1 font-ui text-[12.5px] font-medium transition-colors duration-150',
              isActive ? 'text-paper-100' : 'text-iron-400 hover:text-paper-100',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && <span className="data-text ml-1.5 text-iron-400 tnums">{tab.badge}</span>}
            {isActive && (
              <motion.span
                layoutId={`tab-underline-${groupId}`}
                className="absolute inset-x-2 -bottom-px h-px bg-brass-300"
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** the sheet a heading opens — it names its heading and takes the caret */
export function TabPanel({
  groupId,
  id,
  className,
  children,
}: {
  groupId: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={tabPanelId(groupId, id)}
      role="tabpanel"
      aria-labelledby={tabHeadingId(groupId, id)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
