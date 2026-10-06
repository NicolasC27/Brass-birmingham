import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import { useT } from '@/i18n';
import { onlineWire } from '@/online/net';
import Button from '@/components/platform/Button';
import { type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* L'office ne répond pas.                                             */
/*                                                                     */
/* Les parties, les papiers et les notes sont à l'office : un          */
/* navigateur qui ne l'atteint pas n'a rien à montrer et rien à jouer. */
/* Il n'y a plus de table de repli à ouvrir ici — elle promettait une  */
/* partie et rendait un plateau vide.                                  */
/* ------------------------------------------------------------------ */

/* -------------------------------- composant -------------------------------- */

export default function LocalFallback({ onToast }: { onToast: Notify }) {
  const t = useT();
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    window.setTimeout(() => {
      setRetrying(false);
      /* isOnline est figé au chargement : si un fil est apparu entre-temps,
         on recharge pour repartir sur le client serveur */
      if (onlineWire()) window.location.reload();
      else onToast({ message: t('platform.play.offline.retryFailed'), kind: 'error' });
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className="mx-auto mt-12 max-w-[640px] pb-10"
    >
      <div className="console p-6 text-center">
        <WifiOff size={28} aria-hidden className="mx-auto text-rust-400" />
        <h1 className="mt-3 font-fraunces text-[24px] font-semibold text-paper-100">{t('platform.play.offline.title')}</h1>
        <p className="mx-auto mt-2 max-w-md font-ui text-[14px] leading-relaxed text-paper-300">{t('platform.play.offline.copy')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="primary" disabled={retrying} icon={retrying ? <Loader2 size={16} aria-hidden className="animate-spin" /> : undefined} onClick={retry}>
            {t('platform.play.offline.retry')}
          </Button>
        </div>
      </div>

    </motion.div>
  );
}
