import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { CheckCircle2, MailWarning } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import { isOnline, lobby, normalizeCode } from '@/online/lobby';
import { forgotPassword, resetPassword, signIn, signUp, useSession, useStranger, verifyEmail } from '@/online/session';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The register — sign it, or open a line in it. The two letters the   */
/* office sends (verify an address, choose a password again) land on   */
/* this page too, by their links. An invitation followed while signed  */
/* out waits in the query string and is honoured once the book is      */
/* signed.                                                             */
/* ------------------------------------------------------------------ */

type Mode = 'in' | 'up' | 'forgot';

const tabClass = (active: boolean) =>
  cn(
    'flex-1 border-b-2 px-2 pb-2 pt-1 font-sans text-[11px] font-bold uppercase tracking-[0.16em] transition-colors',
    active ? 'border-brass-400 text-brass-400' : 'border-transparent text-cream-100/45 hover:text-cream-100/80',
  );

export default function Account() {
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const stranger = useStranger();
  const invited = normalizeCode(params.get('table') ?? '');
  const verifying = pathname.includes('/verify/');
  const resetting = pathname.includes('/reset/');
  const mode: Mode = params.get('mode') === 'up' ? 'up' : params.get('mode') === 'forgot' ? 'forgot' : 'in';
  const setMode = (m: Mode) => {
    const next = new URLSearchParams(params);
    if (m === 'in') next.delete('mode');
    else next.set('mode', m);
    setParams(next, { replace: true });
    setError(null);
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verdict, setVerdict] = useState<'pending' | 'ok' | 'bad' | 'offline'>('pending');

  /* the letter's link: answered once, on arrival */
  useEffect(() => {
    if (!verifying || !isOnline) return;
    let alive = true;
    verifyEmail(token)
      .then(() => alive && setVerdict('ok'))
      .catch((e: Error) => alive && setVerdict(e.message === 'offline' ? 'offline' : 'bad'));
    return () => {
      alive = false;
    };
  }, [verifying, token]);

  /* signed in already: the desk is where you belong — unless a table waits */
  useEffect(() => {
    if (!isOnline || !session || verifying || resetting) return;
    if (invited.length === 4) {
      Promise.resolve(lobby.join(invited))
        .then(() => navigate(`/online/${invited}`, { replace: true }))
        .catch((e: Error) => setError(t(`site.desk.error.${e.message}`)));
      return;
    }
    navigate('/desk', { replace: true });
  }, [session, invited, verifying, resetting, navigate, t]);

  const fail = (e: unknown) => setError(t(`site.account.error.${(e as Error).message}`));

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (mode === 'up' && password !== again) {
      setError(t('site.account.mismatch'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(name, password);
      else if (mode === 'up') await signUp(name, email, password);
      else {
        await forgotPassword(email);
        setSent(true);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    if (password !== again) {
      setError(t('site.account.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      navigate('/desk', { replace: true });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (!isOnline) {
    return (
      <PageShell width="narrow" back={{ to: '/', label: t('site.account.back') }} eyebrow={t('site.account.eyebrow')} title={t('site.account.lineDownTitle')} lede={t('site.account.lineDownLede')}>
        <Link to="/online" className="btn-ledger">
          {t('site.account.localCta')}
        </Link>
      </PageShell>
    );
  }

  if (verifying) {
    const ok = verdict === 'ok';
    return (
      <PageShell width="narrow" back={{ to: '/', label: t('site.account.back') }} eyebrow={t('site.account.eyebrow')} title={verdict === 'pending' ? t('site.account.verifying') : ok ? t('site.account.verifiedTitle') : verdict === 'offline' ? t('site.account.lineDownTitle') : t('site.account.badLinkTitle')} lede={verdict === 'pending' ? undefined : ok ? t('site.account.verifiedLede') : verdict === 'offline' ? t('site.account.lineDownLede') : t('site.account.badLinkLede')}>
        {verdict !== 'pending' && (
          <div className="flex items-center gap-4">
            {ok ? <CheckCircle2 className="h-8 w-8 text-bottle-600 brightness-150" /> : <MailWarning className="h-8 w-8 text-rust-500 brightness-150" />}
            <Link to={ok ? '/desk' : '/desk'} className="btn-strike">
              {t('site.account.verifiedCta')}
            </Link>
          </div>
        )}
      </PageShell>
    );
  }

  if (resetting) {
    return (
      <PageShell width="narrow" back={{ to: '/account', label: t('site.account.backToSignIn') }} eyebrow={t('site.account.eyebrow')} title={t('site.account.resetTitle')} lede={t('site.account.resetLede')}>
        <Panel>
          <div className="grid gap-4">
            <Field id="reset-password" label={t('site.account.password')} hint={t('site.account.passwordHint')}>
              <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field id="reset-again" label={t('site.account.passwordAgain')}>
              <input id="reset-again" type="password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reset()} autoComplete="new-password" className={inputClass} />
            </Field>
            <Refusal text={error} />
            <button type="button" onClick={reset} disabled={busy || password.length < 8} className="btn-strike self-start disabled:cursor-not-allowed disabled:opacity-40">
              {t('site.account.resetCta')}
            </button>
          </div>
        </Panel>
      </PageShell>
    );
  }

  /* a token on its way back: not a stranger, not yet a name — wait */
  const waiting = !stranger && !session;

  return (
    <PageShell width="narrow" back={{ to: '/', label: t('site.account.back') }} eyebrow={t('site.account.eyebrow')} title={mode === 'up' ? t('site.account.titleUp') : mode === 'forgot' ? t('site.account.forgotTitle') : t('site.account.titleIn')} lede={mode === 'forgot' ? t('site.account.forgotLede') : t('site.account.lede')}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <Panel>
          {mode !== 'forgot' && (
            <div className="mb-5 flex gap-2">
              <button type="button" className={tabClass(mode === 'in')} onClick={() => setMode('in')}>
                {t('site.account.tabIn')}
              </button>
              <button type="button" className={tabClass(mode === 'up')} onClick={() => setMode('up')}>
                {t('site.account.tabUp')}
              </button>
            </div>
          )}

          {mode === 'forgot' ? (
            sent ? (
              <div>
                <p className="font-serif text-[15px] leading-relaxed text-cream-100/80">{t('site.account.forgotSent')}</p>
                <button type="button" onClick={() => setMode('in')} className="mt-4 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brass-400 hover:underline">
                  {t('site.account.backToSignIn')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                <Field id="forgot-email" label={t('site.account.email')}>
                  <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoComplete="email" className={inputClass} />
                </Field>
                <Refusal text={error} />
                <div className="flex items-center gap-4">
                  <button type="button" onClick={submit} disabled={busy || !email.includes('@')} className="btn-strike disabled:cursor-not-allowed disabled:opacity-40">
                    {t('site.account.forgotCta')}
                  </button>
                  <button type="button" onClick={() => setMode('in')} className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-cream-100/50 hover:text-brass-400">
                    {t('site.account.backToSignIn')}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="grid gap-4">
              <Field id="acc-name" label={mode === 'in' ? t('site.account.nameOrEmail') : t('site.account.name')} hint={mode === 'up' ? t('site.account.nameHint') : undefined}>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={mode === 'up' ? 20 : 120} placeholder={t('site.account.namePlaceholder')} autoComplete="username" disabled={waiting} className={inputClass} />
              </Field>
              {mode === 'up' && (
                <Field id="acc-email" label={t('site.account.email')} hint={t('site.account.emailHint')}>
                  <input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" className={inputClass} />
                </Field>
              )}
              <Field id="acc-password" label={t('site.account.password')} hint={mode === 'up' ? t('site.account.passwordHint') : undefined}>
                <input id="acc-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && mode === 'in' && submit()} maxLength={72} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} disabled={waiting} className={inputClass} />
              </Field>
              {mode === 'up' && (
                <Field id="acc-again" label={t('site.account.passwordAgain')}>
                  <input id="acc-again" type="password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} maxLength={72} autoComplete="new-password" className={inputClass} />
                </Field>
              )}
              <Refusal text={error} />
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || waiting || !name.trim() || password.length < 8 || (mode === 'up' && !email.includes('@'))}
                  className="btn-strike disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {mode === 'in' ? t('site.account.signIn') : t('site.account.signUp')}
                </button>
                {mode === 'in' && (
                  <button type="button" onClick={() => setMode('forgot')} className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-cream-100/50 hover:text-brass-400">
                    {t('site.account.forgot')}
                  </button>
                )}
              </div>
            </div>
          )}
        </Panel>
      </motion.div>
    </PageShell>
  );
}
