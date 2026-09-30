import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Hash } from 'lucide-react';
import { useT } from '@/i18n';
import { lobby, normalizeCode } from '@/online/lobby';
import { useSession } from '@/online/session';
import CodeInput from '@/components/platform/CodeInput';
import { lobbyErrorText } from './notify';

/* ------------------------------------------------------------------ */
/* Section 2 (play.md) — bandeau « Rejoindre avec un code ». Codes     */
/* réels = 4 caractères (normalizeCode) ; le submit passe par le flux  */
/* lobby.join existant → /online/:code. Sans session, la chaîne        */
/* d'invitation est préservée : /account?table=CODE.                   */
/* ------------------------------------------------------------------ */

export default function CodeJoin() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string) => {
    const code = normalizeCode(raw);
    if (code.length < 4 || busy) return;
    if (!session) {
      navigate(`/account?table=${code}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await lobby.join(code);
      navigate(`/online/${code}`);
    } catch (e) {
      setError(lobbyErrorText(t, e, t('platform.play.code.notFound')));
      setBusy(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.15, once: true }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-label={t('platform.play.code.title')}
      className="mt-6 console p-4"
    >
      <div className="flex flex-col gap-4 min-[900px]:min-h-[64px] min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-enamel-700 text-brass-300">
            <Hash size={20} aria-hidden />
          </span>
          <div>
            <h2 className="font-ui text-[15px] font-semibold text-paper-100">{t('platform.play.code.title')}</h2>
            <p className="font-ui text-[13px] text-iron-400">{t('platform.play.code.copy')}</p>
          </div>
        </div>
        <CodeInput onSubmit={(code) => void submit(code)} className="min-[900px]:flex-row min-[900px]:items-center" />
      </div>
      {error && (
        <p role="alert" className="mt-3 font-ui text-[13px] text-rust-400">
          {error}
        </p>
      )}
    </motion.section>
  );
}
