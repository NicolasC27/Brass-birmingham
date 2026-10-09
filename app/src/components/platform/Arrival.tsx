import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useT } from '@/i18n';
import { steamWhistle } from '@/gl/sfx';
import Button from './Button';

/* ------------------------------------------------------------------ */
/* The arrival: the first time a reader comes to the station, the      */
/* masthead unfolds over the page, three lines bid them welcome in the */
/* journal's voice, and one ticket is held out — the evening course —  */
/* beside the door into the hall. Once, and never again.               */
/*                                                                     */
/* While the curtain is up it holds the whole house: the page beneath  */
/* is inert, Tab turns inside the panel, Escape lets the reader out,   */
/* and the focus goes back where it was found.                         */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.arrived.v1';

/* what a reader may reach inside the panel */
const REACHABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const arrived = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
};

export default function Arrival() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !arrived());
  /* a reader who asked for stillness gets the words, not the curtain call */
  const reduce = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const leave = useCallback(
    (to?: string) => {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* private mode: the arrival plays again next time, no harm */
      }
      if (!reduce) steamWhistle();
      setOpen(false);
      if (to) navigate(to);
    },
    [navigate, reduce],
  );

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    /* whoever was reading when the curtain went up gets the page back after */
    const opener = document.activeElement as HTMLElement | null;
    /* the house behind the curtain is out of reach: nothing there answers
       to Tab, and no reader tabs blind through a page they cannot see */
    const behind = Array.from(overlay.parentElement?.children ?? []).filter((c) => c !== overlay);
    for (const el of behind) el.setAttribute('inert', '');
    panel.focus();

    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        leave();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(REACHABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      const outside = !panel.contains(here) || here === panel;
      if (e.shiftKey && (outside || here === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || here === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('keydown', keys);
      for (const el of behind) el.removeAttribute('inert');
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, [open, leave]);

  /* the curtain is choreographed on the three lines of welcome; stillness
     asked for, and everything is simply there */
  const at = (seconds: number) => (reduce ? 0 : seconds);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-lacquer-900 px-6"
        >
          <div aria-hidden className="tex-lacquer pointer-events-none absolute inset-0 opacity-60" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('platform.arrival.eyebrow')}
            tabIndex={-1}
            className="relative w-full max-w-[720px] text-center outline-none"
          >
            <Button
              variant="icon"
              aria-label={t('platform.action.close')}
              onClick={() => leave()}
              icon={<X size={16} aria-hidden />}
              className="absolute right-0 top-0"
            />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: at(0.2), duration: 0.5 }} className="eyebrow-fell">
              {t('platform.arrival.eyebrow')}
            </motion.p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: at(0.4), duration: 0.7, ease: 'easeOut' }} className="gz-rule-double mx-auto mt-5 max-w-[520px]" aria-hidden />
            <motion.h1
              initial={{ opacity: 0, letterSpacing: '0.6em' }}
              animate={{ opacity: 1, letterSpacing: '0.26em' }}
              transition={{ delay: at(0.7), duration: 1.1, ease: 'easeOut' }}
              className="gz-wordmark mt-6 !opacity-100"
            >
              Blackrail
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: at(1.5), duration: 0.5 }} className="mt-3 font-fell text-[14px] tracking-[0.14em] text-paper-300">
              {t('platform.masthead.motto')}
            </motion.p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: at(1.7), duration: 0.7, ease: 'easeOut' }} className="gz-rule-double mx-auto mt-6 max-w-[520px]" aria-hidden />
            <div className="mx-auto mt-8 max-w-[520px]">
              {['line1', 'line2', 'line3'].map((k, i) => (
                <motion.p key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: at(2.2 + i * 0.7), duration: 0.5 }} className="mt-3 font-serif text-[17px] italic leading-relaxed text-paper-100">
                  {t(`platform.arrival.${k}`)}
                </motion.p>
              ))}
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: at(4.4), duration: 0.5 }} className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button type="button" onClick={() => leave('/cours')} className="gz-ticket gz-ticket-brass">
                {t('platform.arrival.course')} →
              </button>
              <button type="button" onClick={() => leave()} className="gz-ticket">
                {t('platform.arrival.enter')} →
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
