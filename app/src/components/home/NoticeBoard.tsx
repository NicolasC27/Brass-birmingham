import { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, X } from 'lucide-react';
import { localeOf, useLang, useT } from '@/i18n';
import { markRead, standingNotice } from '@/platform/notices';

/* ------------------------------------------------------------------ */
/* L'avis au public, placardé en tête de la une : ce qui se construit, */
/* à quel stade, et sans date promise. Le lecteur peut le décrocher ;  */
/* il ne revient pas.                                                  */
/* ------------------------------------------------------------------ */

export default function NoticeBoard() {
  const t = useT();
  const lang = useLang();
  const [notice, setNotice] = useState(standingNotice);
  if (!notice) return null;

  const take = () => {
    markRead(notice.id);
    setNotice(null);
  };

  const posted = new Date(notice.at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      aria-label={t('platform.notices.eyebrow')}
      className="gz-classified mt-6 !items-stretch !p-0 !text-left"
    >
      <div className="grid gap-6 p-6 min-[900px]:grid-cols-12 min-[900px]:gap-8 min-[900px]:p-7">
        <div className="min-[900px]:col-span-8">
          <p className="eyebrow-fell flex items-center gap-2">
            <Megaphone size={13} aria-hidden />
            {t('platform.notices.eyebrow')}
          </p>
          <p className="micro-label mt-3 text-iron-400">
            {t(`platform.notices.stage.${notice.stage}`)}
            <span className="text-iron-600"> · {posted}</span>
          </p>
          <h2 className="mt-1 font-fraunces text-[26px] font-medium leading-tight text-paper-100" style={{ fontVariationSettings: '"opsz" 96' }}>
            {t(`platform.notices.items.${notice.id}.title`)}
          </h2>
          <p className="mt-3 max-w-[560px] font-serif text-[14.5px] italic leading-relaxed text-paper-300">{t(`platform.notices.items.${notice.id}.copy`)}</p>
        </div>

        <div className="flex flex-col justify-between gap-4 min-[900px]:col-span-4 min-[900px]:border-l min-[900px]:border-[var(--gz-ink-soft)] min-[900px]:pl-8">
          <div>
            <p className="micro-label text-iron-400">{t('platform.notices.serviceLabel')}</p>
            <p className="mt-1 font-fraunces text-[18px] font-medium leading-tight text-brass-300">{t('platform.notices.noDate')}</p>
            <p className="mt-3 font-ui text-[12.5px] leading-relaxed text-paper-300">{t(`platform.notices.items.${notice.id}.studying`)}</p>
          </div>
          <button type="button" onClick={take} className="inline-flex items-center gap-2 self-start font-ui text-[12.5px] text-iron-400 transition-colors hover:text-paper-100">
            <X size={14} aria-hidden />
            {t('platform.notices.dismiss')}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
