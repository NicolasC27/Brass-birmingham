import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { isOnline, normalizeCode } from '@/online/lobby';
import { useSession, useStranger } from '@/online/session';
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
/* Chaîne d'invitation préservée de bout en bout :                     */
/* `/online?table=CODE` → `/account?table=CODE`.                       */
/* ------------------------------------------------------------------ */

export default function Online() {
  const session = useSession();
  const stranger = useStranger();
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
    <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
      {isOnline ? (
        <>
          <Matchmaking onToast={notify} />
          <CodeJoin />
          <PublicTables onToast={notify} />
        </>
      ) : (
        <LocalFallback onToast={notify} />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
