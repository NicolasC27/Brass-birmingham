import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Ticket } from 'lucide-react';
import { dictOf, useLang, useT } from '@/i18n';
import { useTheme } from '@/platform/theme';
import { inputClass } from '@/components/site/PageShell';
import { cn } from '@/lib/utils';
import { toOffice } from './office';

/* ------------------------------------------------------------------ */
/* The preview's front page: the engraving, the game in a headline and */
/* a standfirst, the waiting list as a ticket to fill, and the two     */
/* eras printed side by side above three short columns.                */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/** where this visitor came from: the link's own `?via=`, else the site that sent them */
function viaOf(): string {
  const via = new URLSearchParams(window.location.search).get('via');
  if (via) return via.slice(0, 60);
  try {
    const from = document.referrer ? new URL(document.referrer).hostname : '';
    return from && from !== window.location.hostname ? from : '';
  } catch {
    return '';
  }
}

type Sending = 'idle' | 'sending' | 'sent';

function WaitForm() {
  const t = useT();
  const lang = useLang();
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<Sending>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    setError(null);
    setState('sending');
    const status = await toOffice('/waitlist', { email: email.trim(), lang, via: viaOf(), website: trap });
    if (status === 202) {
      setState('sent');
      return;
    }
    setState('idle');
    setError(t(status === 400 ? 'landing.errors.email' : status === 429 ? 'landing.errors.busy' : 'landing.errors.down'));
  };

  if (state === 'sent') {
    return (
      <div role="status" className="grid gap-2">
        <p className="title-card">{t('landing.sent.title')}</p>
        <p className="font-serif text-[14px] italic leading-relaxed text-paper-300">{t('landing.sent.text')}</p>
        <button
          type="button"
          onClick={() => {
            setEmail('');
            setState('idle');
          }}
          className="micro-label mt-1 w-fit py-1 text-iron-400 underline decoration-[var(--gz-ink-soft)] underline-offset-4 transition-colors hover:text-paper-100"
        >
          {t('landing.sent.again')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <label htmlFor="wait-email" className="micro-label text-paper-300">
        {t('landing.form.label')}
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="wait-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('landing.form.placeholder')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'wait-error' : 'wait-note'}
          className={cn(inputClass, 'h-10 min-w-0 flex-1 basis-[240px] rounded-none')}
        />
        {/* no person sees this field: a machine that fills it is thanked and forgotten */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />
        <button type="submit" disabled={state === 'sending'} className={cn('gz-ticket gz-ticket-brass', state === 'sending' && 'is-off')}>
          <Ticket aria-hidden />
          {t(state === 'sending' ? 'landing.form.sending' : 'landing.form.submit')}
        </button>
      </div>
      {error && (
        <p id="wait-error" role="alert" className="font-ui text-[13px] text-rust-400">
          {error}
        </p>
      )}
      <p id="wait-note" className="font-ui text-[12.5px] leading-relaxed text-iron-400">
        {t('landing.form.note')}{' '}
        <Link to="/legal#privacy" className="text-paper-300 underline decoration-[var(--gz-ink-soft)] underline-offset-4 hover:text-paper-100">
          {t('landing.form.privacy')}
        </Link>
      </p>
    </form>
  );
}

export default function Front() {
  const t = useT();
  const lang = useLang();
  const theme = useTheme();
  const points = (dictOf(lang).landing as { points: { h: string; p: string }[] }).points;
  const night = theme === 'dark';
  return (
    <div className="gz-measure pb-10">
      <motion.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease }} className="gz-engraving mt-6 h-[200px] min-[900px]:h-[320px]">
        <img src={night ? '/plate-night-country.webp' : '/hero-diorama.webp'} alt="" style={{ objectPosition: 'center 40%' }} />
      </motion.figure>

      <div className="mt-8 grid gap-10 min-[1100px]:grid-cols-12 min-[1100px]:gap-x-7">
        <section className="flex flex-col gap-5 min-[1100px]:col-span-7">
          <p className="eyebrow-fell">{t('landing.eyebrow')}</p>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease, delay: 0.06 }} className="-mt-2 max-w-[600px] font-fraunces text-[30px] font-normal italic leading-[1.15] text-paper-100 min-[900px]:text-[38px]">
            {t('landing.headline')}
          </motion.h1>
          <p className="max-w-[600px] font-serif text-[16px] italic leading-relaxed text-paper-300">{t('landing.lede')}</p>
          {/* the game's three claims, under the standfirst: the column is as
              long as the ticket beside it, and says what the ticket is for */}
          <div className="mt-3 grid gap-6 border-t border-[var(--gz-ink-soft)] pt-6 min-[700px]:grid-cols-3 min-[700px]:gap-x-6">
            {points.map((p) => (
              <section key={p.h}>
                <h2 className="title-card">{p.h}</h2>
                <p className="mt-2 font-serif text-[14px] leading-relaxed text-paper-300">{p.p}</p>
              </section>
            ))}
          </div>
        </section>

        <aside className="gz-col-rule min-[1100px]:col-span-5 min-[1100px]:col-start-8">
          <section className="console console-ruled p-5 min-[900px]:p-6" aria-labelledby="trial-title">
            <h2 id="trial-title" className="title-card">
              {t('landing.trial.title')}
            </h2>
            <div className="mb-4 mt-3 h-px bg-brass-hairline" />
            <p className="mb-5 font-serif text-[14px] italic leading-relaxed text-paper-300">{t('landing.trial.text')}</p>
            <WaitForm />
          </section>
        </aside>
      </div>

      <div className="mt-[72px] grid gap-6 min-[700px]:grid-cols-2">
        {(
          [
            ['canal', night ? '/plate-night-canal.webp' : '/era-canal-banner.webp'],
            ['rail', night ? '/plate-night-rail.webp' : '/era-rail-banner.webp'],
          ] as const
        ).map(([era, src]) => (
          <figure key={era}>
            <div className="gz-engraving h-[180px] min-[900px]:h-[220px]">
              <img src={src} alt="" loading="lazy" />
            </div>
            <figcaption className="eyebrow-fell mt-3 text-center">{t(`landing.eras.${era}`)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
