import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { resendLetter, useSession } from '@/online/session';
import { useT } from '@/i18n';
import { Refusal, inputClass } from './PageShell';

/* An address that has not answered its letter: the tables are shut until
   it does. The letter can leave again, or go to another address. */

export default function VerifyBanner() {
  const t = useT();
  const session = useSession();
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session || session.verified) return null;

  const send = async (to?: string) => {
    setError(null);
    try {
      await resendLetter(to);
      setSent(true);
      setChanging(false);
    } catch (e) {
      setError(t(`site.account.error.${(e as Error).message}`));
    }
  };

  return (
    <div role="status" className="relative mb-6 overflow-hidden rounded-md border border-brass-500/60 bg-coal-950/70 p-4">
      <div aria-hidden className="tex-paper pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div className="relative flex flex-wrap items-start gap-4">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-brass-400" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[15px] leading-snug text-cream-100/90">{session.email ? t('site.verify.banner', { email: session.email }) : t('site.verify.bannerNoEmail')}</p>
          {sent && <p className="mt-1 font-sans text-[12px] text-bottle-600 brightness-150">{t('site.verify.sent')}</p>}
          {changing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('site.verify.newEmail')} autoComplete="email" className={inputClass + ' max-w-xs'} />
              <button type="button" onClick={() => send(email)} disabled={!email.includes('@')} className="btn-strike !min-h-[36px] !px-4 !py-1.5 !text-[11px] disabled:opacity-40">
                {t('site.verify.save')}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {session.email && (
                <button type="button" onClick={() => send()} className="btn-strike !min-h-[36px] !px-4 !py-1.5 !text-[11px]">
                  {t('site.verify.resend')}
                </button>
              )}
              <button type="button" onClick={() => setChanging(true)} className="btn-ledger !min-h-[36px] !px-4 !py-1.5 !text-[11px]">
                {t('site.verify.change')}
              </button>
            </div>
          )}
          <Refusal text={error} />
        </div>
      </div>
    </div>
  );
}
