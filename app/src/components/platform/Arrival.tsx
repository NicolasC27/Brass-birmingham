import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useT } from '@/i18n';
import { steamWhistle } from '@/gl/sfx';

/* ------------------------------------------------------------------ */
/* The arrival: the first time a reader comes to the station, the      */
/* masthead unfolds over the page, three lines bid them welcome in the */
/* journal's voice, and one ticket is held out — the evening course —  */
/* beside the door into the hall. Once, and never again.               */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.arrived.v1';

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

  const leave = (to?: string) => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private mode: the arrival plays again next time, no harm */
    }
    steamWhistle();
    setOpen(false);
    if (to) navigate(to);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-lacquer-900 px-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('platform.arrival.eyebrow')}
        >
          <div aria-hidden className="tex-lacquer pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative w-full max-w-[720px] text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="eyebrow-fell">
              {t('platform.arrival.eyebrow')}
            </motion.p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }} className="gz-rule-double mx-auto mt-5 max-w-[520px]" aria-hidden />
            <motion.h1
              initial={{ opacity: 0, letterSpacing: '0.6em' }}
              animate={{ opacity: 1, letterSpacing: '0.26em' }}
              transition={{ delay: 0.7, duration: 1.1, ease: 'easeOut' }}
              className="gz-wordmark mt-6 !opacity-100"
            >
              Blackrail
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.5 }} className="mt-3 font-fell text-[13px] uppercase tracking-[0.22em] text-paper-300">
              {t('platform.masthead.motto')}
            </motion.p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.7, duration: 0.7, ease: 'easeOut' }} className="gz-rule-double mx-auto mt-6 max-w-[520px]" aria-hidden />
            <div className="mx-auto mt-8 max-w-[520px]">
              {['line1', 'line2', 'line3'].map((k, i) => (
                <motion.p key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 + i * 0.7, duration: 0.5 }} className="mt-3 font-serif text-[17px] italic leading-relaxed text-paper-100">
                  {t(`platform.arrival.${k}`)}
                </motion.p>
              ))}
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4.4, duration: 0.5 }} className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button type="button" onClick={() => leave('/cours')} className="gz-ticket gz-ticket-brass">
                {t('platform.arrival.course')}
              </button>
              <button type="button" onClick={() => leave()} className="gz-ticket">
                {t('platform.arrival.enter')}
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
