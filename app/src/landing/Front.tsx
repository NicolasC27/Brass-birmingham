import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Maximize2, Play, Ticket } from 'lucide-react';
import { dictOf, useLang, useT } from '@/i18n';
import { inputClass } from '@/components/site/PageShell';
import { cn } from '@/lib/utils';
import { seatsLeft, toOffice, toTheTicket } from './office';
import { DISCORD_URL, DiscordTicket } from './Discord';

/* ------------------------------------------------------------------ */
/* The preview's front page. It sells the game with the game itself:   */
/* the board in the hero, a table annotated, the turn of the eras, the */
/* business up close, the machines, what follows a game — and the      */
/* waiting list twice, at the top and at the foot. Every picture is a  */
/* capture of a real game played out by the machines on the WebGL      */
/* board, the v3 tiles, the day register.                              */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
const MACHINES = [
  { id: 'boulton', name: 'Mr Boulton' },
  { id: 'wedgwood', name: 'Mrs Wedgwood' },
  { id: 'arkwright', name: 'Miss Arkwright' },
  { id: 'watt', name: 'Mr Watt' },
] as const;
/** the widths each capture is printed at: the small one for an ordinary
 *  screen, the large one (from a 3840×2160 capture) for a dense screen or
 *  a 4K window — the browser takes the one it needs */
const WIDTHS: Record<string, [number, number]> = { hero: [1000, 2000], ceremony: [700, 1296], 'close-stoke': [1050, 2100] };
const pic = (name: string, sizes = '100vw') => {
  const [sm, lg] = WIDTHS[name] ?? [1280, 2560];
  return { src: `/landing-${name}.webp`, srcSet: `/landing-${name}-sm.webp ${sm}w, /landing-${name}.webp ${lg}w`, sizes };
};

/** where the three marks of the annotated table stand, in % of the capture */
const MARKS = [
  { x: 30.5, y: 80.5 },
  { x: 5, y: 2.5 },
  { x: 82.5, y: 80.5 },
];

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

function WaitForm({ className }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
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
      <div role="status" className={cn('grid gap-2 border-l-2 border-brass-300 pl-4', className)}>
        <p className="title-card">{t('landing.sent.title')}</p>
        <p className="font-serif text-[15px] leading-relaxed text-paper-300">{t('landing.sent.text')}</p>
        {DISCORD_URL && (
          <div className="mt-2 grid gap-2 border-t border-[var(--gz-ink-soft)] pt-3">
            <p className="font-serif text-[15px] italic leading-relaxed text-paper-300">{t('landing.discord.wait')}</p>
            <DiscordTicket label={t('landing.discord.join')} className="gz-ticket-brass" />
          </div>
        )}
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
    <form onSubmit={submit} noValidate className={cn('grid gap-3', className)}>
      <label htmlFor={`${id}-email`} className="sr-only">
        {t('landing.form.label')}
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('landing.form.placeholder')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-note`}
          className={cn(inputClass, 'h-[52px] min-w-0 flex-1 basis-[240px] rounded-none text-[15px]')}
        />
        {/* no person sees this field: a machine that fills it is thanked and forgotten */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />
        <button type="submit" disabled={state === 'sending'} className={cn('gz-ticket gz-ticket-brass !h-[52px] !px-7 !text-[12px]', state === 'sending' && 'is-off')}>
          <Ticket aria-hidden />
          {t(state === 'sending' ? 'landing.form.sending' : 'landing.form.submit')}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="font-ui text-[13px] text-rust-400">
          {error}
        </p>
      )}
      <p id={`${id}-note`} className="font-ui text-[12.5px] leading-relaxed text-iron-400">
        {t('landing.form.note')}{' '}
        <Link to="/legal#privacy" className="text-paper-300 underline decoration-[var(--gz-ink-soft)] underline-offset-4 hover:text-paper-100">
          {t('landing.form.privacy')}
        </Link>
      </p>
    </form>
  );
}

/** the founders' offer: the first hundred confirmed get a year of Premium.
 *  No count is printed; the office only says when the seats are gone */
function FoundersOffer({ className }: { className?: string }) {
  const t = useT();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void seatsLeft().then((n) => live && setLeft(n));
    return () => {
      live = false;
    };
  }, []);
  const over = left === 0;
  return (
    <div className={cn('border border-brass-300/70 bg-[rgb(var(--brass-300)/.08)] px-4 py-3', className)}>
      <p className="eyebrow-fell">{t('landing.offer.badge')}</p>
      <p className="mt-1 font-fraunces text-[18px] leading-snug text-paper-100">{over ? t('landing.offer.ended') : t('landing.offer.title')}</p>
      {!over && <p className="mt-1 font-ui text-[12px] leading-relaxed text-iron-400">{t('landing.offer.note')}</p>}
    </div>
  );
}

/** the taste of the game: a picture of the table and a button until the
 *  visitor asks, then the real table in a frame — the game's code and art
 *  are fetched only then */
function DemoFrame() {
  const t = useT();
  const [on, setOn] = useState(false);
  if (!on) {
    return (
      <button type="button" onClick={() => setOn(true)} className="group relative block w-full overflow-hidden border border-[var(--gz-ink-soft)] bg-[rgb(var(--enamel-850))] p-1.5 text-left shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55)]">
        <img {...pic('table', '(min-width: 1240px) 1180px, 100vw')} alt="" loading="lazy" className="block h-auto w-full transition duration-300 group-hover:brightness-75" />
        <span className="micro-label absolute left-4 top-4 border border-brass-300/70 bg-[rgba(12,9,6,0.72)] px-2.5 py-1 text-brass-300">{t('landing.demo.alpha')}</span>
        <span className="absolute inset-0 grid place-items-center">
          <span className="gz-ticket gz-ticket-brass !h-14 !px-8 !text-[13px] shadow-2xl transition group-hover:scale-105">
            <Play aria-hidden />
            {t('landing.demo.play')}
          </span>
        </span>
      </button>
    );
  }
  return (
    <div>
      <div className="border border-[var(--gz-ink-soft)] bg-[rgb(var(--enamel-850))] p-1.5 shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55)]">
        <iframe src="/demo" title={t('landing.demo.title')} className="block h-[min(82vh,760px)] w-full border-0 bg-black" allow="fullscreen" />
      </div>
      <a href="/demo" target="_blank" rel="noreferrer" className="micro-label mt-3 inline-flex items-center gap-1.5 py-1 text-iron-400 transition-colors hover:text-paper-100">
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        {t('landing.demo.full')}
      </a>
    </div>
  );
}

/** a capture of the board, framed as a plate of the journal */
function Plate({ name, sizes, alt, className, eager }: { name: string; sizes?: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={cn('border border-[var(--gz-ink-soft)] bg-[rgb(var(--enamel-850))] p-1.5 shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55)]', className)}>
      <img {...pic(name, sizes)} alt={alt} loading={eager ? 'eager' : 'lazy'} className="block h-auto w-full" />
    </div>
  );
}

/** the canal era and the rail era on the same board and the same frame:
 *  the canal plate is cut back as the handle moves right */
function EraSlider() {
  const t = useT();
  const [at, setAt] = useState(50);
  return (
    <figure>
      <div className="relative select-none overflow-hidden border border-[var(--gz-ink-soft)] bg-[rgb(var(--enamel-850))] p-1.5 shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55)]">
        <div className="relative">
          <img {...pic('era-rail', '(min-width: 1100px) 800px, 100vw')} alt={t('landing.twist.railAlt')} loading="lazy" className="block h-auto w-full" draggable={false} />
          <img {...pic('era-canal', '(min-width: 1100px) 800px, 100vw')} alt={t('landing.twist.canalAlt')} loading="lazy" className="absolute inset-0 block h-full w-full" style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }} draggable={false} />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-brass-300" style={{ left: `${at}%` }}>
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[rgb(var(--lacquer-900))] bg-brass-300 px-2 py-1 font-ui text-[12px] font-semibold text-[rgb(var(--ink-on-brass))] shadow-lg">⇆</span>
          </div>
          <span className="eyebrow-fell pointer-events-none absolute left-3 top-3 bg-[rgb(var(--lacquer-900)/.92)] px-2.5 py-1">{t('landing.twist.canalCaption')}</span>
          <span className="eyebrow-fell pointer-events-none absolute right-3 top-3 bg-[rgb(var(--lacquer-900)/.92)] px-2.5 py-1">{t('landing.twist.railLabel')}</span>
          <input type="range" min={0} max={100} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label={t('landing.twist.slider')} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
        </div>
      </div>
      <figcaption className="eyebrow-fell mt-3 text-center">{t('landing.twist.railCaption')}</figcaption>
    </figure>
  );
}

function SectionHead({ plate, title, text, center }: { plate?: string; title: string; text?: string; center?: boolean }) {
  return (
    <header className={cn('max-w-[720px]', center && 'mx-auto text-center')}>
      {plate && <p className="eyebrow-fell">{plate}</p>}
      <h2 className="mt-2 font-fraunces text-[28px] font-normal leading-[1.15] text-paper-100 min-[900px]:text-[34px]">{title}</h2>
      {text && <p className="mt-3 font-serif text-[16.5px] leading-relaxed text-paper-300">{text}</p>}
    </header>
  );
}

type Point = { h: string; p: string };

export default function Front() {
  const t = useT();
  /* the demo's last card sends the player back here, to the ticket */
  useEffect(() => {
    if (window.location.hash === '#ticket') toTheTicket();
  }, []);
  const lang = useLang();
  const d = dictOf(lang).landing as {
    table: { marks: Point[] };
    economy: { points: Point[] };
    line: { points: Point[] };
    faq: { items: { q: string; a: string }[] };
  };

  return (
    <div className="pb-6">
      {/* the hero: the promise, the ticket and Mr Watt on the left; the board,
          up close, running off the right edge of the window */}
      <section className="grid items-center gap-10 min-[1100px]:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] min-[1100px]:gap-x-12">
        <div className="px-4 sm:px-8 min-[1100px]:py-14 min-[1100px]:pl-[max(32px,calc((100vw-1240px)/2+32px))] min-[1100px]:pr-0">
          <p className="eyebrow-fell">{t('landing.hero.eyebrow')}</p>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="mt-3 font-fraunces text-[34px] font-normal italic leading-[1.1] text-paper-100 min-[900px]:text-[42px]">
            {t('landing.hero.title')}
          </motion.h1>
          <p className="mt-5 max-w-[560px] font-serif text-[17px] leading-relaxed text-paper-300">{t('landing.hero.subhead')}</p>
          <p className="mt-3 max-w-[560px] font-ui text-[13px] text-iron-400">{t('landing.hero.kicker')}</p>
          <FoundersOffer className="mt-6 max-w-[600px]" />
          <WaitForm className="mt-4 max-w-[600px]" />
          <div className="mt-7 flex max-w-[600px] items-center gap-4 border-t border-[var(--gz-ink-soft)] pt-5">
            <img src="/portrait-watt.webp" alt={t('landing.machines.portrait', { name: 'Mr Watt' })} className="h-16 w-16 shrink-0 rounded-full border-2 border-brass-300 object-cover" />
            <p className="font-fraunces text-[17px] italic leading-snug text-paper-100">{t('landing.hero.watt')}</p>
          </div>
        </div>
        <motion.figure initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease, delay: 0.1 }} className="relative order-first mx-4 mt-4 sm:mx-8 min-[1100px]:order-none min-[1100px]:mx-0 min-[1100px]:mt-0">
          {/* on the wide page the plate runs off the right edge and melts into the paper on the left,
              so no town is seen cut off; above the words on a tablet, a short band of the board */}
          <img {...pic('hero', '(min-width: 1100px) 55vw, 100vw')} alt={t('landing.hero.alt')} className="block h-[280px] w-full object-cover shadow-[0_24px_60px_-24px_rgba(20,14,6,0.6)] min-[1100px]:h-[640px] min-[1100px]:shadow-none min-[1100px]:[mask-image:linear-gradient(to_right,transparent,#000_16%)]" />
          <figcaption className="eyebrow-fell absolute bottom-4 left-4 bg-[rgb(var(--lacquer-900)/.92)] px-3 py-1.5 min-[1100px]:left-auto min-[1100px]:right-8">{t('landing.hero.plate')}</figcaption>
        </motion.figure>
      </section>

      {/* the taste: two rounds of the real game, on this very page */}
      <section className="gz-measure mt-20">
        <SectionHead plate={t('landing.demo.kicker')} title={t('landing.demo.title')} text={t('landing.demo.text')} />
        <div className="mt-8">
          <DemoFrame />
        </div>
      </section>

      {/* a table, annotated: this is a game, and here is how a turn is played */}
      <section className="gz-measure mt-24">
        <SectionHead plate={t('landing.table.plate')} title={t('landing.table.title')} text={t('landing.table.text')} />
        <figure className="relative mt-8">
          <Plate name="table" sizes="(min-width: 1240px) 1180px, 100vw" alt={t('landing.table.alt')} />
          {MARKS.map((m, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute grid h-8 w-8 place-items-center rounded-full border-2 border-[rgb(var(--lacquer-900))] bg-brass-300 font-fraunces text-[15px] font-semibold text-[rgb(var(--ink-on-brass))] shadow-lg"
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              {i + 1}
            </span>
          ))}
        </figure>
        <ol className="mt-6 grid gap-6 min-[900px]:grid-cols-3 min-[900px]:gap-x-7">
          {d.table.marks.map((m, i) => (
            <li key={m.h} className="flex gap-3">
              <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brass-300 font-fraunces text-[14px] font-semibold text-[rgb(var(--ink-on-brass))]">
                {i + 1}
              </span>
              <div>
                <h3 className="title-card">{m.h}</h3>
                <p className="mt-1 font-serif text-[15px] leading-relaxed text-paper-300">{m.p}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* the turn of the eras: the same board, canals then rails, under one slider */}
      <section className="gz-measure mt-24 grid gap-10 min-[1100px]:grid-cols-12 min-[1100px]:gap-x-10">
        <div className="min-[1100px]:col-span-4">
          <SectionHead plate={t('landing.twist.plate')} title={t('landing.twist.title')} text={t('landing.twist.text')} />
          <figure className="mt-8 max-w-[360px]">
            <Plate name="ceremony" sizes="360px" alt={t('landing.twist.ceremonyAlt')} />
            <figcaption className="eyebrow-fell mt-3 text-center">{t('landing.twist.ceremonyCaption')}</figcaption>
          </figure>
        </div>
        <div className="min-[1100px]:col-span-8">
          <EraSlider />
        </div>
      </section>

      {/* the business, up close: one close-up at full width, the four trades under it */}
      <section className="gz-measure mt-24">
        <SectionHead plate={t('landing.economy.plate')} title={t('landing.economy.title')} />
        <Plate name="close-stoke" sizes="(min-width: 1240px) 1180px, 100vw" alt={t('landing.economy.stokeAlt')} className="mt-8" />
        <div className="mt-8 grid gap-6 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4 min-[1100px]:gap-x-7">
          {d.economy.points.map((p) => (
            <div key={p.h} className="border-t border-[var(--gz-ink-soft)] pt-4">
              <h3 className="title-card">{p.h}</h3>
              <p className="mt-1 font-serif text-[15px] leading-relaxed text-paper-300">{p.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the machines */}
      <section className="gz-measure mt-24">
        <SectionHead plate={t('landing.machines.plate')} title={t('landing.machines.title')} text={t('landing.machines.text')} center />
        <ul className="mt-10 flex flex-wrap items-end justify-center gap-8 min-[900px]:gap-14">
          {MACHINES.map((m) => {
            const watt = m.id === 'watt';
            return (
              <li key={m.id} className="flex flex-col items-center text-center">
                <img
                  src={`/portrait-${m.id}.webp`}
                  alt={t('landing.machines.portrait', { name: m.name })}
                  loading="lazy"
                  className={cn('rounded-full border-2 object-cover shadow-[0_12px_30px_-12px_rgba(20,14,6,0.6)]', watt ? 'h-40 w-40 border-brass-300' : 'h-28 w-28 border-[var(--gz-ink-soft)]')}
                />
                <p className={cn('mt-3 font-fraunces text-paper-100', watt ? 'text-[20px]' : 'text-[17px]')}>{m.name}</p>
                {watt && <p className="micro-label mt-1 text-brass-300">{t('landing.machines.watt')}</p>}
              </li>
            );
          })}
        </ul>
        <div className="mt-10 flex justify-center">
          <button type="button" onClick={toTheTicket} className="gz-ticket gz-ticket-brass !h-[52px] !px-7 !text-[12px]">
            <Ticket aria-hidden />
            {t('landing.machines.cta')}
          </button>
        </div>
      </section>

      {/* what follows a game */}
      <section className="gz-measure mt-24">
        <div className="gz-rule-double" aria-hidden />
        <div className="mt-8">
          <SectionHead title={t('landing.line.title')} />
        </div>
        <div className="mt-8 grid gap-x-7 gap-y-8 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {d.line.points.map((p) => (
            <div key={p.h}>
              <h3 className="title-card">{p.h}</h3>
              <p className="mt-1 font-serif text-[15px] leading-relaxed text-paper-300">{p.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* for every level, then the questions at the counter */}
      <section className="gz-measure mt-24 grid gap-12 min-[1100px]:grid-cols-12 min-[1100px]:gap-x-10">
        <div className="min-[1100px]:col-span-5">
          <SectionHead title={t('landing.levels.title')} text={t('landing.levels.text')} />
        </div>
        <div className="min-[1100px]:col-span-7">
          <h2 className="eyebrow-fell">{t('landing.faq.title')}</h2>
          <div className="mt-3 border-t border-[var(--gz-ink-soft)]">
            {d.faq.items.map((f) => (
              <details key={f.q} className="group border-b border-[var(--gz-ink-soft)] py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-fraunces text-[18px] text-paper-100 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-brass-300 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 font-serif text-[15.5px] leading-relaxed text-paper-300">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* the ticket again, over the works at Stoke */}
      <section className="relative mt-24 overflow-hidden">
        <img {...pic('close-stoke')} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-[rgba(14,11,7,0.78)]" />
        <div className="gz-measure relative flex flex-col items-center py-20 text-center">
          <h2 className="max-w-[720px] font-fraunces text-[30px] font-normal italic leading-[1.15] text-[#f4eee1] min-[900px]:text-[38px]">{t('landing.final.title')}</h2>
          {/* the ticket on its own panel, in the page's register, over the darkened plate */}
          <div className="console mt-8 w-full max-w-[600px] p-6 text-left">
            <FoundersOffer className="mb-4" />
            <WaitForm />
          </div>
        </div>
      </section>
    </div>
  );
}
