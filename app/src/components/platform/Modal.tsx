import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import Button from './Button';
import { platformPortalTarget } from './portalTarget';

/* ------------------------------------------------------------------ */
/* Modal (design.md §7.8 + §5) — max-w 520px, centrée ; overlay        */
/* opacity 160ms, panneau y 16→0 + scale .98→1 220ms easeOut. Échap    */
/* et clic overlay ferment.                                            */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-lacquer-950/80 p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={cn(
              'console console-ruled w-full max-w-[520px] !bg-enamel-800 p-6 shadow-[0_8px_24px_var(--shadow-modal)]',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              {title ? <h2 className="title-card">{title}</h2> : <span />}
              <Button variant="icon" aria-label={t('platform.action.close')} onClick={onClose} icon={<X size={16} aria-hidden />} />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    platformPortalTarget(),
  );
}
