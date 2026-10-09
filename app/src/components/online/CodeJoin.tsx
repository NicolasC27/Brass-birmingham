import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useT } from '@/i18n';
import { lobby, normalizeCode } from '@/online/lobby';
import { useSession } from '@/online/session';
import CodeInput from '@/components/platform/CodeInput';
import { lobbyErrorText } from './notify';
import GlossMark from '@/components/platform/GlossMark';

/* ------------------------------------------------------------------ */
/* The code window of the play hall: four cells for a table's code,    */
/* real codes being four glyphs (normalizeCode); the submit goes        */
/* through lobby.join → /online/:code. Without a session the chain of  */
/* invitation is kept: /account?table=CODE.                            */
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
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut', delay: 0.12 }} aria-label={t('platform.play.code.title')}>
      <h2 className="micro-label text-paper-100">
        {t('platform.play.code.title')}
        <GlossMark id="billet" />
      </h2>
      <div className="gz-rule-double mt-2" aria-hidden />
      <p className="mt-4 font-serif text-[13px] italic leading-relaxed text-paper-300">{t('platform.play.code.copy')}</p>
      {/* the cells keep to the measure of the words above them, left-aligned */}
      <CodeInput className="mt-4 items-start" onSubmit={(code) => void submit(code)} />
      {error && (
        <p role="alert" className="mt-3 font-serif text-[13px] italic text-rust-400">
          {error}
        </p>
      )}
    </motion.section>
  );
}
