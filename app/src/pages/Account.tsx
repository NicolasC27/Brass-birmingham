import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { CheckCircle2, MailWarning } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import Button from '@/components/platform/Button';
import Tabs, { TabPanel } from '@/components/platform/Tabs';
import { isOnline, lobby, normalizeCode } from '@/online/lobby';
import { forgotPassword, resetPassword, signIn, signUp, useSession, useStranger, verifyEmail } from '@/online/session';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Le registre « Club Industriel » — signin / signup / forgot, plus    */
/* les deux lettres du bureau (verify / reset) qui atterrissent ici    */
/* par leurs liens (/account/verify/:token, /account/reset/:token —    */
/* routes générées par le serveur, préservées). Une invitation         */
/* suivie hors connexion (?table=CODE) attend dans la query string et  */
/* est honorée une fois le registre signé. Logique inchangée, seule   */
/* la présentation passe à la DA plateforme.                           */
/* ------------------------------------------------------------------ */

type Mode = 'in' | 'up' | 'forgot';

/* a command set in words — back to the sign-in, the forgotten password — is
   written as a link is, underlined, and never in the capitals of a label:
   the one way out of a lost password must not read as a heading */
const textCommand = 'font-ui text-[13px] text-brass-300 underline decoration-brass-500/40 underline-offset-2 transition-colors duration-150 hover:text-paper-100 hover:decoration-current';

/** where a page that sent the stranger here asked to be taken back — a path of this site, nothing else */
function returnPath(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null;
}

export default function Account() {
  const t = useT();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
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
  /* the policy, read and accepted: the office asks for it too */
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verdict, setVerdict] = useState<'pending' | 'ok' | 'bad'>('pending');

  /* the letter's link: answered once, on arrival */
  useEffect(() => {
    if (!verifying || !isOnline) return;
    let alive = true;
    verifyEmail(token)
      .then(() => alive && setVerdict('ok'))
      .catch(() => alive && setVerdict('bad'));
    return () => {
      alive = false;
    };
  }, [verifying, token]);

  /* the register signed on this page, rather than a member arriving with
     a session already in hand */
  const [signedHere, setSignedHere] = useState(false);
  const back = returnPath(state);

  /* signed in: back to the page that sent you here, if one did; a table
     that waits, if one does; else the desk for one who has just signed, and
     the member's own card — where the account's settings are kept — for
     one who came to « Account » already signed in */
  useEffect(() => {
    if (!isOnline || !session || verifying || resetting) return;
    if (invited.length === 4) {
      Promise.resolve(lobby.join(invited))
        .then(() => navigate(`/online/${invited}`, { replace: true }))
        .catch((e: Error) => setError(t(`site.desk.error.${e.message}`)));
      return;
    }
    navigate(back ?? (signedHere ? '/desk' : '/profile'), { replace: true });
  }, [session, invited, verifying, resetting, navigate, t, back, signedHere]);

  const fail = (e: unknown) => setError(t(`site.account.error.${(e as Error).message}`));

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (mode === 'up' && password !== again) {
      setError(t('platform.account.mismatch'));
      return;
    }
    setBusy(true);
    try {
      if (mode !== 'forgot') setSignedHere(true);
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
      setError(t('platform.account.mismatch'));
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
      <PageShell width="narrow" back={{ to: '/', label: t('platform.account.back') }} eyebrow={t('platform.account.eyebrow')} title={t('platform.account.offlineTitle')} lede={t('platform.account.offlineLede')}>
        <Button variant="primary" to="/online">
          {t('platform.account.localCta')}
        </Button>
      </PageShell>
    );
  }

  if (verifying) {
    const ok = verdict === 'ok';
    return (
      <PageShell
        width="narrow"
        back={{ to: '/', label: t('platform.account.back') }}
        eyebrow={t('platform.account.eyebrow')}
        title={verdict === 'pending' ? t('platform.account.verifying') : ok ? t('platform.account.verifiedTitle') : t('platform.account.badLinkTitle')}
        lede={verdict === 'pending' ? undefined : ok ? t('platform.account.verifiedLede') : t('platform.account.badLinkLede')}
      >
        {verdict !== 'pending' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex items-center gap-4">
            {ok ? <CheckCircle2 className="h-8 w-8 text-bottle-ink" aria-hidden /> : <MailWarning className="h-8 w-8 text-rust-400" aria-hidden />}
            <Button variant="primary" to="/desk">
              {t('platform.account.verifiedCta')}
            </Button>
          </motion.div>
        )}
      </PageShell>
    );
  }

  if (resetting) {
    return (
      <PageShell width="narrow" back={{ to: '/account', label: t('platform.account.backToSignIn') }} eyebrow={t('platform.account.eyebrow')} title={t('platform.account.resetTitle')} lede={t('platform.account.resetLede')}>
        <Panel>
          <div className="grid gap-4">
            <Field id="reset-password" label={t('platform.account.password')} hint={t('platform.account.passwordHint')}>
              <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field id="reset-again" label={t('platform.account.passwordAgain')}>
              <input id="reset-again" type="password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reset()} autoComplete="new-password" className={inputClass} />
            </Field>
            <Refusal text={error} />
            <Button variant="primary" className="self-start justify-self-start" onClick={reset} disabled={busy || password.length < 8}>
              {t('platform.account.resetCta')}
            </Button>
          </div>
        </Panel>
      </PageShell>
    );
  }

  /* a token on its way back: not a stranger, not yet a name — wait */
  const waiting = !stranger && !session;

  return (
    <PageShell
      width="narrow"
      back={{ to: '/', label: t('platform.account.back') }}
      /* sent here by an invitation, the reader is told why the register
         stands between them and the table: a seat is kept for them */
      eyebrow={invited.length === 4 ? t('platform.account.invitedEyebrow') : t('platform.account.eyebrow')}
      title={mode === 'up' ? t('platform.account.titleUp') : mode === 'forgot' ? t('platform.account.forgotTitle') : t('platform.account.titleIn')}
      lede={mode === 'forgot' ? t('platform.account.forgotLede') : invited.length === 4 ? t('platform.account.invitedLede', { code: invited }) : t('platform.account.lede')}
    >
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
        <Panel>
          {/* the rail is the platform's, so the register keeps the bargain the
              word « onglets » makes: a tablist, an id per heading, and a sheet
              that names the heading it was opened by */}
          {mode !== 'forgot' && (
            <Tabs
              groupId="account"
              className="mb-5"
              ariaLabel={t('platform.account.eyebrow')}
              active={mode}
              onChange={(id) => setMode(id as Mode)}
              tabs={[
                { id: 'in', label: t('platform.account.tabIn') },
                { id: 'up', label: t('platform.account.tabUp') },
              ]}
            />
          )}

          {mode === 'forgot' ? (
            sent ? (
              <div>
                <p className="font-ui text-[14px] leading-relaxed text-paper-300">{t('platform.account.forgotSent')}</p>
                <button type="button" onClick={() => setMode('in')} className={cn(textCommand, 'mt-4')}>
                  {t('platform.account.backToSignIn')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                <Field id="forgot-email" label={t('platform.account.email')}>
                  <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoComplete="email" className={inputClass} />
                </Field>
                <Refusal text={error} />
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="primary" onClick={submit} disabled={busy || !email.includes('@')}>
                    {t('platform.account.forgotCta')}
                  </Button>
                  <button type="button" onClick={() => setMode('in')} className={textCommand}>
                    {t('platform.account.backToSignIn')}
                  </button>
                </div>
              </div>
            )
          ) : (
            <TabPanel groupId="account" id={mode} className="grid gap-4">
              <Field id="acc-name" label={mode === 'in' ? t('platform.account.nameOrEmail') : t('platform.account.name')} hint={mode === 'up' ? t('platform.account.nameHint') : undefined}>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={mode === 'up' ? 20 : 120} placeholder={t('platform.account.namePlaceholder')} autoComplete="username" disabled={waiting} className={inputClass} />
              </Field>
              {mode === 'up' && (
                <Field id="acc-email" label={t('platform.account.email')} hint={t('platform.account.emailHint')}>
                  <input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" className={inputClass} />
                </Field>
              )}
              <Field id="acc-password" label={t('platform.account.password')} hint={mode === 'up' ? t('platform.account.passwordHint') : undefined}>
                <input id="acc-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && mode === 'in' && submit()} maxLength={72} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} disabled={waiting} className={inputClass} />
              </Field>
              {mode === 'up' && (
                <Field id="acc-again" label={t('platform.account.passwordAgain')}>
                  <input id="acc-again" type="password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} maxLength={72} autoComplete="new-password" className={inputClass} />
                </Field>
              )}
              {mode === 'up' && (
                <label className="flex items-start gap-3 font-ui text-[13px] leading-relaxed text-paper-300">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-brass-500" />
                  <span>
                    {t('platform.account.accept', { privacy: '[[privacy]]' })
                      .split(/(\[\[privacy\]\])/)
                      .map((part, i) =>
                        part === '[[privacy]]' ? (
                          <Link key={i} to="/legal#privacy" className="text-brass-300 underline decoration-current decoration-1 underline-offset-2 transition-colors duration-150 hover:text-signal-ink">
                            {t('platform.account.acceptPrivacy')}
                          </Link>
                        ) : (
                          part
                        ),
                      )}
                  </span>
                </label>
              )}
              <Refusal text={error} />
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" onClick={submit} disabled={busy || waiting || !name.trim() || password.length < 8 || (mode === 'up' && (!email.includes('@') || !accepted))}>
                  {mode === 'in' ? t('platform.account.signIn') : t('platform.account.signUp')}
                </Button>
                {mode === 'in' && (
                  <button type="button" onClick={() => setMode('forgot')} className={textCommand}>
                    {t('platform.account.forgot')}
                  </button>
                )}
              </div>
            </TabPanel>
          )}
        </Panel>
      </motion.div>
    </PageShell>
  );
}
