import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { WifiOff } from 'lucide-react';
import { useT } from '@/i18n';
import { isOnline, normalizeCode } from '@/online/lobby';
import { useLine, useSession, useStranger } from '@/online/session';
import Toast, { type ToastData } from '@/components/platform/Toast';
import Matchmaking from '@/components/online/Matchmaking';
import CodeJoin from '@/components/online/CodeJoin';
import PublicTables from '@/components/online/PublicTables';
import LocalFallback from '@/components/online/LocalFallback';

/* ------------------------------------------------------------------ */
/* `/online` — hub Jouer « salle des machines » (play.md) :            */
/*   1. console de matchmaking (files normale / classée, QueuePanel),  */
/*   2. bandeau « rejoindre avec un code »,                            */
/*   3. tables publiques (#tables),                                    */
/*   4. repli local quand aucun serveur n'est configuré.               */
/* Un serveur configuré mais dont la ligne n'est pas ouverte           */
/* (useLine() !== 'online') garde le hub, sous un bandeau « hors       */
/* ligne » : le fil se rétablit seul, les files rouvrent alors.        */
/* Chaîne d'invitation préservée de bout en bout :                     */
/* `/online?table=CODE` → `/account?table=CODE`.                       */
/* ------------------------------------------------------------------ */

/* the line to the office is not open: say so, once, above the hall */
function LineNotice({ line }: { line: 'offline' | 'connecting' }) {
  const t = useT();
  return (
    <div role="status" className="mt-6 flex items-center gap-3 border-y border-rust-600/50 px-1 py-3 font-serif text-[13px] italic text-paper-300">
      <WifiOff size={16} aria-hidden className="shrink-0 text-rust-400" />
      <span>{t(line === 'connecting' ? 'platform.play.lineConnecting' : 'platform.play.lineDown')}</span>
    </div>
  );
}

export default function Online() {
  const t = useT();
  const session = useSession();
  const stranger = useStranger();
  const line = useLine();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const [toast, setToast] = useState<ToastData | null>(null);
  const notify = useCallback((data: Omit<ToastData, 'id'>) => setToast({ ...data, id: Date.now() }), []);

  /* ancres (#tables, #file-*) : le shell y mène, on s'assure du défilement */
  useEffect(() => {
    if (!hash) return;
    const scroll = () => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    scroll();
    const retry = window.setTimeout(scroll, 350);
    return () => window.clearTimeout(retry);
  }, [hash]);

  const table = normalizeCode(params.get('table') ?? '');

  /* une invitation en poche : on signe d'abord le registre, comme avant.
     Hors ligne, pas de registre — le code pré-remplit le flux local. */
  if (isOnline && table) {
    if (!session && !stranger) return null; /* un jeton est en route */
    return <Navigate to={`/account?table=${table}`} replace />;
  }

  return (
    <div className="gz-measure">
      {isOnline ? (
        <>
          <header className="pt-10">
            <p className="eyebrow-fell">{t('platform.play.eyebrow')}</p>
            <h1 className="display-page mt-2">{t('platform.play.title')}</h1>
            <p className="mt-2 font-serif text-[15px] italic text-paper-300">{t('platform.play.lede')}</p>
          </header>
          {line !== 'online' && <LineNotice line={line} />}
          <div className="mt-8 grid gap-8 min-[1100px]:grid-cols-12 min-[1100px]:gap-10">
            <div className="min-[1100px]:col-span-8">
              <Matchmaking onToast={notify} />
            </div>
            <aside className="gz-col-rule min-[1100px]:col-span-4">
              <CodeJoin />
            </aside>
          </div>
          <PublicTables onToast={notify} />
        </>
      ) : (
        <LocalFallback onToast={notify} />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
