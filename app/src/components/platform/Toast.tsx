import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';
import { platformPortalTarget } from './portalTarget';

/* ------------------------------------------------------------------ */
/* Toast (design.md §7.8 + §5) — bas-droite, fond enamel-800, icône    */
/* d'état, action optionnelle ; entrée x 24→0 200ms, sortie auto 4s.   */
/* ------------------------------------------------------------------ */

export interface ToastData {
  id: number;
  message: string;
  kind?: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

const ICONS = {
  info: Info,
  success: Check,
  error: AlertTriangle,
} as const;

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(id);
  }, [toast, onDismiss]);

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-brass-hairline bg-enamel-800 py-2.5 pl-3 pr-2 shadow-[0_8px_24px_var(--shadow-modal)]"
          >
            {(() => {
              const Icon = ICONS[toast.kind ?? 'info'];
              return (
                <Icon
                  size={16}
                  aria-hidden
                  className={cn(toast.kind === 'success' && 'text-bottle-ink', toast.kind === 'error' && 'text-rust-400', (!toast.kind || toast.kind === 'info') && 'text-brass-300')}
                />
              );
            })()}
            <span className="font-ui text-[13px] text-paper-100">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss();
                }}
                className="font-ui text-[13px] font-semibold text-brass-300 hover:text-brass-500"
              >
                {toast.action.label}
              </button>
            )}
            <Button variant="icon" className="!h-7 !w-7 border-0" aria-label="×" onClick={onDismiss} icon={<X size={14} aria-hidden />} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    platformPortalTarget(),
  );
}

export default Toast;
