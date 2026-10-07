import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import Button from '@/components/platform/Button';
import { resendLetter, useSession } from '@/online/session';
import { useT } from '@/i18n';
import { Refusal, inputClass } from './PageShell';

/* An address that has not answered its letter: the tables are shut until
   it does. The letter can leave again, or go to another address.
   Restyled « Club Industriel » — enamel panel, brass mark, same contract. */

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
    <div role="status" className="relative mb-6 overflow-hidden rounded-xl border border-brass-hairline-strong bg-enamel-800 p-4">
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-wrap items-start gap-4">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[14px] leading-snug text-paper-100">{session.email ? t('site.verify.banner', { email: session.email }) : t('site.verify.bannerNoEmail')}</p>
          {sent && <p className="mt-1 font-ui text-[12.5px] font-semibold text-bottle-ink">{t('site.verify.sent')}</p>}
          {changing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('site.verify.newEmail')} autoComplete="email" className={inputClass + ' max-w-xs'} />
              <Button variant="primary" className="!h-9 text-[13px]" onClick={() => send(email)} disabled={!email.includes('@')}>
                {t('site.verify.save')}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {session.email && (
                <Button variant="primary" className="!h-9 text-[13px]" onClick={() => send()}>
                  {t('site.verify.resend')}
                </Button>
              )}
              <Button variant="ghost" className="!h-9 text-[13px]" onClick={() => setChanging(true)}>
                {t('site.verify.change')}
              </Button>
            </div>
          )}
          <Refusal text={error} />
        </div>
      </div>
    </div>
  );
}
