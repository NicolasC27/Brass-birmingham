import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, KeyRound, Loader2, WifiOff } from 'lucide-react';
import { useT } from '@/i18n';
import { lobby, normalizeCode } from '@/online/lobby';
import { onlineWire } from '@/online/net';
import { DEFAULT_OPTIONS } from '@/components/setup/constants';
import Button from '@/components/platform/Button';
import { lobbyErrorText, type Notify } from './notify';

/* ------------------------------------------------------------------ */
/* Section 4 (play.md) — repli local, quand aucun serveur de tables    */
/* n'est configuré (isOnline false). Le panneau « Serveur hors ligne » */
/* ouvre le flux local EXISTANT d'Online.tsx (nom, créer / rejoindre   */
/* une table à code 4 caractères, ?table= pré-rempli) — restylé Club   */
/* Industriel, fonctionnellement identique, mêmes clés localStorage.   */
/* ------------------------------------------------------------------ */

const inputClass =
  'w-full rounded-lg border border-[rgb(var(--paper-100)/.14)] bg-enamel-850 px-3 py-2 font-ui text-[15px] text-paper-100 placeholder:text-iron-600 focus:border-brass-400 focus:outline-none';

/* --------------------- flux local existant, restylé --------------------- */

function LocalOffice() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState(lobby.me.name);
  const [tableName, setTableName] = useState('');
  const [code, setCode] = useState(normalizeCode(params.get('table') ?? ''));
  const [error, setError] = useState<string | null>(null);
  const named = name.trim().length > 0;
  const commitName = () => lobby.setName(name.trim());

  const create = async () => {
    if (!named) return;
    commitName();
    try {
      const table = await lobby.create(tableName.trim() || t('site.desk.defaultName', { name: name.trim() }), DEFAULT_OPTIONS);
      navigate(`/online/${table.code}`);
    } catch (e) {
      setError(lobbyErrorText(t, e, t('platform.play.errorGeneric')));
    }
  };
  const join = async () => {
    if (!named || code.length < 4) return;
    commitName();
    try {
      await lobby.join(code);
      navigate(`/online/${code}`);
    } catch (e) {
      setError(lobbyErrorText(t, e, t('platform.play.errorGeneric')));
    }
  };

  return (
    <div className="mt-6 grid gap-4 min-[900px]:grid-cols-[320px_1fr]">
      {/* Registre des visiteurs */}
      <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-5">
        <label htmlFor="online-name" className="micro-label text-brass-300">
          {t('online.entry.yourName')}
        </label>
        <input
          id="online-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          maxLength={20}
          placeholder={t('online.entry.namePlaceholder')}
          autoComplete="nickname"
          className={`${inputClass} mt-3`}
        />
        <p className="mt-3 font-ui text-[12px] leading-relaxed text-iron-400">{t('online.entry.nameHint')}</p>
      </div>

      <div className="grid content-start gap-4">
        {/* Ouvrir une table locale */}
        <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-5">
          <h3 className="title-card">{t('site.desk.open')}</h3>
          <p className="mt-1 font-ui text-[13px] leading-relaxed text-paper-300">{t('site.desk.openCopy')}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="online-table" className="micro-label text-iron-400">
                {t('site.desk.tableName')}
              </label>
              <input
                id="online-table"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void create()}
                maxLength={28}
                placeholder={t('site.desk.tablePlaceholder')}
                className={`${inputClass} mt-2`}
              />
            </div>
            <Button variant="primary" disabled={!named} icon={<ArrowRight size={16} aria-hidden />} onClick={() => void create()}>
              {t('site.desk.openCta')}
            </Button>
          </div>
        </div>

        {/* Rejoindre par code (4 caractères) */}
        <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-5">
          <h3 className="title-card">{t('site.desk.join')}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <KeyRound size={16} aria-hidden className="text-brass-300" />
            <input
              aria-label={t('site.desk.code')}
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && void join()}
              maxLength={4}
              spellCheck={false}
              placeholder="····"
              className="w-[7.5rem] rounded-lg border border-brass-hairline bg-enamel-850 px-3 py-2 text-center font-mono text-[20px] font-medium uppercase tracking-[0.28em] text-brass-300 placeholder:text-iron-600 focus:border-brass-400 focus:outline-none"
            />
            <Button variant="ghost" disabled={!named || code.length < 4} onClick={() => void join()}>
              {t('site.desk.joinCta')}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="font-ui text-[13px] text-rust-400 min-[900px]:col-span-2">
          {error}
        </p>
      )}
      <p className="font-ui text-[12px] text-iron-600 min-[900px]:col-span-2">{t('online.entry.localNote')}</p>
    </div>
  );
}

/* -------------------------------- composant -------------------------------- */

export default function LocalFallback({ onToast }: { onToast: Notify }) {
  const t = useT();
  const [showLocal, setShowLocal] = useState(false);
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
      <div className="rounded-xl border border-brass-hairline bg-enamel-850 p-6 text-center">
        <WifiOff size={28} aria-hidden className="mx-auto text-rust-400" />
        <h1 className="mt-3 font-fraunces text-[24px] font-semibold text-paper-100">{t('platform.play.offline.title')}</h1>
        <p className="mx-auto mt-2 max-w-md font-ui text-[14px] leading-relaxed text-paper-300">{t('platform.play.offline.copy')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => setShowLocal((s) => !s)} aria-expanded={showLocal}>
            {t('platform.play.offline.localCta')}
          </Button>
          <Button variant="ghost" disabled={retrying} icon={retrying ? <Loader2 size={16} aria-hidden className="animate-spin" /> : undefined} onClick={retry}>
            {t('platform.play.offline.retry')}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showLocal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <LocalOffice />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
