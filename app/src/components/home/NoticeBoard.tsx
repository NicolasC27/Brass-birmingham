import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Megaphone, X } from 'lucide-react';
import Modal from '@/components/platform/Modal';
import { localeOf, useLang, useT } from '@/i18n';
import { markRead, standingNotice } from '@/platform/notices';

/* ------------------------------------------------------------------ */
/* L'avis au public — une ligne sous le bandeau : le titre de ce qui   */
/* se construit et son stade, rien de plus. Qui veut savoir où en est  */
/* le chantier clique et lit l'avis en entier ; qui s'en moque le      */
/* décroche, et il ne revient pas dans ce navigateur.                  */
/* ------------------------------------------------------------------ */

export default function NoticeBoard() {
  const t = useT();
  const lang = useLang();
  const [notice, setNotice] = useState(standingNotice);
  const [open, setOpen] = useState(false);
  if (!notice) return null;

  const take = () => {
    markRead(notice.id);
    setOpen(false);
    setNotice(null);
  };

  const title = t(`platform.notices.items.${notice.id}.title`);
  const posted = new Date(notice.at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="mt-5 flex items-center gap-2 rounded-lg border border-dashed border-brass-hairline bg-enamel-850/60 px-3 py-2"
      >
        <button type="button" onClick={() => setOpen(true)} className="group flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`${t('platform.notices.eyebrow')} — ${title}`}>
          <Megaphone size={14} aria-hidden className="shrink-0 text-brass-300" />
          <span className="micro-label shrink-0 text-brass-300">{t('platform.notices.eyebrow')}</span>
          <span className="truncate font-serif text-[13px] text-paper-300 transition-colors group-hover:text-paper-100">{title}</span>
          <span className="micro-label hidden shrink-0 text-iron-400 min-[760px]:inline">· {t(`platform.notices.stage.${notice.stage}`)}</span>
          <ChevronRight size={14} aria-hidden className="shrink-0 text-iron-400 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button type="button" onClick={take} aria-label={t('platform.notices.dismiss')} title={t('platform.notices.dismiss')} className="shrink-0 rounded p-1 text-iron-400 transition-colors hover:text-paper-100">
          <X size={14} aria-hidden />
        </button>
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="micro-label text-iron-400">
          {t(`platform.notices.stage.${notice.stage}`)}
          <span className="text-iron-400"> · {posted}</span>
        </p>
        <p className="mt-3 font-serif text-[15px] italic leading-relaxed text-paper-300">{t(`platform.notices.items.${notice.id}.copy`)}</p>

        <div className="mt-5 rounded-lg border border-[rgb(var(--paper-100)/.07)] bg-enamel-850 p-4">
          <p className="micro-label text-iron-400">{t('platform.notices.serviceLabel')}</p>
          <p className="mt-1 font-fraunces text-[20px] font-medium leading-tight text-brass-300">{t('platform.notices.noDate')}</p>
          <p className="mt-3 font-ui text-[13px] leading-relaxed text-paper-300">{t(`platform.notices.items.${notice.id}.studying`)}</p>
        </div>

        <button type="button" onClick={take} className="mt-5 inline-flex items-center gap-2 font-ui text-[12.5px] text-iron-400 transition-colors hover:text-paper-100">
          <X size={14} aria-hidden />
          {t('platform.notices.dismiss')}
        </button>
      </Modal>
    </>
  );
}
