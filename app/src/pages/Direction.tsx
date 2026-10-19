import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { Download, RefreshCw, Send, TestTube2 } from 'lucide-react';
import PageShell, { Field, Panel, Refusal, inputClass } from '@/components/site/PageShell';
import { onlineWire } from '@/online/net';
import type { Me } from '@/online/table';
import { MAX_BODY, MAX_SUBJECT, WAIT_LANGS, reach } from '@/online/waitlist';
import type { Audience, Circular, Entrant, WaitBook, WaitLang } from '@/online/waitlist';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* /direction — the direction's desk: the waiting list and its         */
/* circulars. Open to the accounts BLACKRAIL_ADMINS names, once their  */
/* address is verified; the office checks it on every request, the     */
/* page only spares the others a desk they could not use.              */
/*                                                                     */
/* One language, the owner's, as the test bench: nothing here is ever  */
/* shown to a player, and keeping it out of the dictionaries keeps it   */
/* out of every player's download.                                     */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;
/** the book is read again this often while the desk is open */
const REFRESH_MS = 20_000;
const LANG_NAMES: Record<WaitLang, string> = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand' };

const date = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const stamp = (t: number) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('fr-FR')} ${Math.abs(n) < 2 ? one : many}`;

/** the book as a spreadsheet: one line an address, the fields quoted */
function csvOf(rows: Entrant[]): string {
  const cell = (v: string | number | null) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const head = ['email', 'langue', 'provenance', 'inscrit', 'confirme', 'lettres'];
  const iso = (t: number | null) => (t === null ? '' : new Date(t).toISOString());
  return [head.map(cell).join(','), ...rows.map((e) => [e.email, e.lang, e.source, iso(e.createdAt), iso(e.confirmedAt), e.letters].map(cell).join(','))].join('\n') + '\n';
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const button = 'inline-flex min-h-8 items-center gap-2 border border-[var(--gz-line-control)] px-3 font-ui text-[12px] uppercase tracking-[0.12em] text-paper-100 transition-colors hover:border-brass-300 disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5';

/* ------------------------------- figures ------------------------------ */

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="console px-4 py-3">
      <p className="micro-label text-iron-400">{label}</p>
      <p className="mt-1 font-fraunces text-[28px] leading-none tabular-nums text-paper-100">{value}</p>
      {note && <p className="mt-1.5 font-ui text-[12px] text-iron-400">{note}</p>}
    </div>
  );
}

/** the addresses left each day of the last thirty: one bar a day, the
 *  answered part in brass and the rest in outline, a title on each */
function Arrivals({ entrants }: { entrants: Entrant[] }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const first = start.getTime() - 29 * DAY_MS;
    const out = Array.from({ length: 30 }, (_, i) => ({ at: first + i * DAY_MS, all: 0, confirmed: 0 }));
    for (const e of entrants) {
      const i = Math.floor((e.createdAt - first) / DAY_MS);
      if (i < 0 || i >= 30) continue;
      out[i].all += 1;
      if (e.confirmedAt !== null) out[i].confirmed += 1;
    }
    return out;
  }, [entrants]);
  const top = Math.max(1, ...days.map((d) => d.all));
  return (
    <figure>
      <div className="flex h-[120px] items-end gap-[2px] border-b border-[var(--gz-ink-soft)]" role="img" aria-label="Inscriptions par jour sur trente jours">
        {days.map((d) => (
          <div key={d.at} className="group relative flex h-full flex-1 flex-col justify-end" title={`${date(d.at)} — ${plural(d.all, 'inscription', 'inscriptions')}, ${plural(d.confirmed, 'confirmée', 'confirmées')}`}>
            {d.all > d.confirmed && <div className="rounded-t-[3px] border border-b-0 border-brass-300/70" style={{ height: `${((d.all - d.confirmed) / top) * 100}%` }} />}
            {d.confirmed > 0 && <div className={cn('bg-brass-300 group-hover:bg-brass-200', d.all === d.confirmed && 'rounded-t-[3px]')} style={{ height: `${(d.confirmed / top) * 100}%` }} />}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between font-ui text-[11.5px] text-iron-400">
        <span>{date(days[0].at)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 bg-brass-300" /> confirmées
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 border border-brass-300/70" /> sans réponse
          </span>
        </span>
        <span>aujourd’hui</span>
      </figcaption>
    </figure>
  );
}

/** the confirmed addresses by country, the largest first: one brass bar
 *  each, the count at its end; the unknown ones (left before the countries
 *  were read, or from an address no database places) come last */
function Countries({ entrants }: { entrants: Entrant[] }) {
  const rows = useMemo(() => {
    const names = new Intl.DisplayNames(['fr'], { type: 'region' });
    const by = new Map<string, number>();
    for (const e of entrants) if (e.confirmedAt !== null) by.set(e.country, (by.get(e.country) ?? 0) + 1);
    const known = [...by].filter(([c]) => c).sort((a, b) => b[1] - a[1]);
    const shown = known.slice(0, 12);
    const others = known.slice(12).reduce((n, [, k]) => n + k, 0);
    const out = shown.map(([c, n]) => ({ key: c, label: names.of(c) ?? c, code: c, n }));
    if (others) out.push({ key: 'others', label: `Autres pays (${known.length - 12})`, code: '', n: others });
    if (by.get('')) out.push({ key: 'unknown', label: 'Inconnu', code: '', n: by.get('') ?? 0 });
    return out;
  }, [entrants]);
  if (!rows.length) return <p className="font-serif text-[14px] italic text-paper-300">Rien encore.</p>;
  const top = Math.max(...rows.map((r) => r.n));
  const total = rows.reduce((n, r) => n + r.n, 0);
  return (
    <ol className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 font-ui text-[13px]" title={`${r.label} — ${plural(r.n, 'inscrit', 'inscrits')}, ${Math.round((r.n / total) * 100)} %`}>
          <span className={cn('truncate', r.code ? 'text-paper-100' : 'text-iron-400')}>
            {r.code && <span className="mr-1.5 font-mono text-[11px] text-iron-400">{r.code}</span>}
            {r.label}
          </span>
          <span className="h-3 bg-[var(--gz-ink-faint)]">
            <span className={cn('block h-full rounded-r-[3px]', r.code ? 'bg-brass-300' : 'bg-iron-400/60')} style={{ width: `${(r.n / top) * 100}%` }} />
          </span>
          <span className="tabular-nums text-paper-300">{r.n}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ circulars ----------------------------- */

function Composer({ book, onBook }: { book: WaitBook; onBook: (b: WaitBook) => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [lang, setLang] = useState<WaitLang | ''>('');
  const [fresh, setFresh] = useState(true);
  const [limit, setLimit] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cut = Number.parseInt(limit, 10);
  const audience: Audience = { lang: lang || null, fresh, limit: Number.isInteger(cut) && cut > 0 ? cut : null };
  const count = reach(book.entrants, audience).length;
  const days = Math.max(1, Math.ceil(count / Math.max(1, book.cap)));
  const ready = subject.trim() !== '' && body.trim() !== '' && subject.length <= MAX_SUBJECT && body.length <= MAX_BODY;

  /* any change to the letter or its audience disarms the second click */
  useEffect(() => setArmed(false), [subject, body, lang, fresh, limit]);

  const run = async (what: 'trial' | 'send') => {
    const w = onlineWire();
    if (!w || !ready) return;
    setBusy(true);
    setError(null);
    setSaid(null);
    try {
      if (what === 'trial') {
        await w.adminTrial(subject.trim(), body.trim(), audience);
        setSaid('Essai envoyé à votre adresse.');
      } else {
        onBook(await w.adminCircular(subject.trim(), body.trim(), audience));
        setSaid(`Circulaire au départ : ${plural(count, 'lettre', 'lettres')}.`);
        setSubject('');
        setBody('');
      }
    } catch (e) {
      const m = (e as Error).message;
      setError(m === 'nobody' ? 'Personne dans ce public.' : m === 'bad-circular' ? 'Objet ou texte manquant, ou trop long.' : `L’office a refusé : ${m}`);
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <Panel title="Écrire une circulaire" meta={`${book.sentToday} / ${book.cap} envoyées sur 24 h`}>
      <div className="grid gap-4">
        <Field id="c-subject" label="Objet">
          <input id="c-subject" className={inputClass} maxLength={MAX_SUBJECT} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Blackrail — votre place pour le voyage d’essai" />
        </Field>
        <Field id="c-body" label="Texte" hint="En texte brut. Le lien de désinscription est ajouté en bas de chaque lettre, dans la langue de chacun.">
          <textarea id="c-body" className={cn(inputClass, 'min-h-[180px] font-mono text-[12.5px] leading-relaxed')} maxLength={MAX_BODY} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="grid gap-4 min-[700px]:grid-cols-3">
          <Field id="c-lang" label="Langue">
            <select id="c-lang" className={inputClass} value={lang} onChange={(e) => setLang(e.target.value as WaitLang | '')}>
              <option value="">Toutes</option>
              {WAIT_LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-limit" label="Nombre max." hint="Vide : tout le public. Les plus anciens d’abord.">
            <input id="c-limit" className={inputClass} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} placeholder="tous" />
          </Field>
          <label className="flex items-center gap-2 self-center font-ui text-[13px] text-paper-100">
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brass-300))]" />
            Seulement ceux qui n’ont encore rien reçu
          </label>
        </div>
        <p className="font-ui text-[13px] text-paper-300">
          Partira à <strong className="text-paper-100">{plural(count, 'adresse confirmée', 'adresses confirmées')}</strong>
          {count > 0 && <>, en {plural(days, 'jour', 'jours')} environ au rythme de {book.cap} par jour</>}.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={button} disabled={!ready || busy} onClick={() => void run('trial')}>
            <TestTube2 aria-hidden /> M’envoyer un essai
          </button>
          {armed ? (
            <button type="button" className="gz-ticket gz-ticket-brass" disabled={busy} onClick={() => void run('send')}>
              <Send aria-hidden /> Confirmer : {plural(count, 'lettre', 'lettres')}
            </button>
          ) : (
            <button type="button" className={cn('gz-ticket', (!ready || count === 0 || busy) && 'is-off')} disabled={!ready || count === 0 || busy} onClick={() => setArmed(true)}>
              <Send aria-hidden /> Mettre au départ
            </button>
          )}
        </div>
        {said && (
          <p role="status" className="font-ui text-[13px] text-verdigris-300">
            {said}
          </p>
        )}
        <Refusal text={error} />
      </div>
    </Panel>
  );
}

function audienceText(a: Audience): string {
  return [a.lang ? LANG_NAMES[a.lang] : 'toutes langues', a.fresh ? 'jamais écrits' : null, a.limit ? `${a.limit} premiers` : null].filter(Boolean).join(' · ');
}

function Circulars({ circulars, onStop }: { circulars: Circular[]; onStop: (id: string) => void }) {
  if (!circulars.length) return <p className="font-serif text-[14px] italic text-paper-300">Aucune circulaire écrite pour l’instant.</p>;
  return (
    <ul className="grid gap-3">
      {circulars.map((c) => {
        const left = c.total - c.sent - c.failed;
        const state = c.stoppedAt ? 'arrêtée' : left > 0 ? 'en cours' : 'terminée';
        return (
          <li key={c.id} className="border-b border-[var(--gz-ink-faint)] pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-ui text-[14px] text-paper-100">{c.subject}</p>
              <span className="micro-label text-iron-400">{state}</span>
            </div>
            <p className="mt-1 font-ui text-[12px] text-iron-400">
              {stamp(c.createdAt)} · {audienceText(c.audience)}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 bg-[var(--gz-ink-faint)]" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={c.sent} aria-label={`${c.sent} lettres envoyées sur ${c.total}`}>
                <div className="h-full bg-brass-300" style={{ width: `${c.total ? (c.sent / c.total) * 100 : 0}%` }} />
              </div>
              <span className="font-mono text-[12px] tabular-nums text-paper-300">
                {c.sent}/{c.total}
                {c.failed > 0 && <span className="text-rust-400"> · {c.failed} en échec</span>}
              </span>
              {!c.stoppedAt && left > 0 && (
                <button type="button" className={button} onClick={() => onStop(c.id)}>
                  Arrêter
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------- the list ----------------------------- */

type Show = 'all' | 'confirmed' | 'pending';

function Book({ entrants, onStrike }: { entrants: Entrant[]; onStrike: (e: Entrant) => void }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [armed, setArmed] = useState<string | null>(null);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entrants.filter((e) => (show === 'all' || (show === 'confirmed') === (e.confirmedAt !== null)) && (!needle || e.email.toLowerCase().includes(needle) || e.source.toLowerCase().includes(needle)));
  }, [entrants, q, show]);
  const shown = rows.slice(0, 500);
  return (
    <Panel title="La liste" meta={plural(rows.length, 'adresse', 'adresses')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={cn(inputClass, 'max-w-[320px]')} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une adresse, une provenance…" aria-label="Chercher" />
        <select className={cn(inputClass, 'w-auto')} value={show} onChange={(e) => setShow(e.target.value as Show)} aria-label="Filtrer">
          <option value="all">Toutes</option>
          <option value="confirmed">Confirmées</option>
          <option value="pending">Sans réponse</option>
        </select>
        <button type="button" className={button} disabled={!rows.length} onClick={() => download(`blackrail-liste-${new Date().toISOString().slice(0, 10)}.csv`, csvOf(rows))}>
          <Download aria-hidden /> Exporter en CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-ui text-[13px]">
          <thead>
            <tr className="border-b border-[var(--gz-ink-soft)] text-left">
              {['Adresse', 'Langue', 'Provenance', 'Inscrit', 'Confirmé', 'Lettres', ''].map((h) => (
                <th key={h} scope="col" className="micro-label whitespace-nowrap px-2 py-2 font-normal text-iron-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className="border-b border-[var(--gz-ink-faint)]">
                <td className="max-w-[280px] truncate px-2 py-2 text-paper-100">{e.email}</td>
                <td className="px-2 py-2 uppercase text-paper-300">{e.lang}</td>
                <td className="max-w-[160px] truncate px-2 py-2 text-paper-300">{e.source || '—'}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums text-paper-300">{date(e.createdAt)}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums text-paper-300">{e.confirmedAt ? date(e.confirmedAt) : <span className="text-iron-400">en attente</span>}</td>
                <td className="px-2 py-2 tabular-nums text-paper-300">
                  {e.letters}
                  {e.awaiting > 0 && <span className="text-iron-400"> (+{e.awaiting})</span>}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => (armed === e.id ? (setArmed(null), onStrike(e)) : setArmed(e.id))}
                    onBlur={() => setArmed((a) => (a === e.id ? null : a))}
                    className={cn('micro-label whitespace-nowrap px-2 py-1 transition-colors', armed === e.id ? 'text-rust-400' : 'text-iron-400 hover:text-paper-100')}
                  >
                    {armed === e.id ? 'Confirmer' : 'Rayer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && <p className="mt-3 font-ui text-[12px] text-iron-400">Les {shown.length} plus récentes sont affichées ; l’export CSV les contient toutes.</p>}
      {!rows.length && <p className="mt-4 font-serif text-[14px] italic text-paper-300">Personne ici pour l’instant.</p>}
    </Panel>
  );
}

/* ------------------------------ the door ------------------------------ */

/* the desk signs in on its own, straight on the wire: the account page and
   the session hooks carry the game's store with them, and the preview is
   built without a line of the game */
const never = () => () => {};
function useMe(): Me | null {
  return useSyncExternalStore(
    (cb) => onlineWire()?.onSession(cb) ?? never(),
    () => onlineWire()?.session ?? null,
    () => null,
  );
}

function Door({ me }: { me: Me | null }) {
  /* the first time, the direction opens its account here: the address
     BLACKRAIL_ADMINS names, then the letter answered */
  const [opening, setOpening] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = onlineWire();
    if (!w || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (opening) await w.signUp(name.trim(), email.trim(), password);
      else await w.signIn(name.trim(), password);
    } catch (err) {
      const m = (err as Error).message;
      setError(m === 'offline' ? 'L’office ne répond pas.' : opening ? `L’office refuse ce compte : ${m}` : 'Nom, adresse ou mot de passe refusé.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell eyebrow="La direction" title="Accès réservé" width="narrow">
      {me ? (
        <div className="grid gap-4">
          <p className="font-serif text-[15px] italic text-paper-300">
            {me.verified ? `Ce bureau est celui de la direction. Le compte « ${me.name} » n’en fait pas partie.` : `Une lettre est partie vers ${me.email ?? 'votre adresse'} : suivez son lien, et le bureau s’ouvre.`}
          </p>
          <button type="button" className={cn(button, 'w-fit')} onClick={() => onlineWire()?.signOut()}>
            Changer de compte
          </button>
        </div>
      ) : (
        <form onSubmit={enter} className="grid max-w-[420px] gap-4">
          {opening && (
            <Field id="d-email" label="Adresse e-mail de la direction">
              <input id="d-email" type="email" className={inputClass} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          )}
          <Field id="d-name" label={opening ? 'Nom' : 'Nom ou adresse e-mail'}>
            <input id="d-name" className={inputClass} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="d-password" label="Mot de passe">
            <input id="d-password" type="password" className={inputClass} autoComplete={opening ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button type="submit" disabled={busy || !name.trim() || !password} className={cn('gz-ticket gz-ticket-brass w-fit', (busy || !name.trim() || !password) && 'is-off')}>
            {opening ? 'Créer le compte' : 'Ouvrir le bureau'}
          </button>
          <button type="button" className="micro-label w-fit py-1 text-iron-400 underline underline-offset-4 hover:text-paper-100" onClick={() => setOpening((o) => !o)}>
            {opening ? 'J’ai déjà un compte' : 'Première fois : créer le compte'}
          </button>
          <Refusal text={error} />
        </form>
      )}
    </PageShell>
  );
}

/** the letter's link, answered: the account's address is verified and the
 *  desk opens (before the line opens there is no account page to land on) */
export function DirectionVerify() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'working' | 'ok' | 'bad'>('working');
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const w = onlineWire();
    if (!w) return;
    w.verify(token).then(
      () => setState('ok'),
      () => setState('bad'),
    );
  }, [token]);
  if (state === 'ok') return <Direction />;
  return (
    <PageShell eyebrow="La direction" title={state === 'working' ? 'Un instant…' : 'Lien refusé'} width="narrow">
      {state === 'bad' && <p className="font-serif text-[15px] italic text-paper-300">Ce lien ne vaut plus : il a servi, ou il a plus d’une heure. Ouvrez le bureau et demandez une autre lettre.</p>}
    </PageShell>
  );
}

/* -------------------------------- the desk ---------------------------- */

export default function Direction() {
  const session = useMe();
  const [book, setBook] = useState<WaitBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const admin = session?.admin === true;

  const read = useCallback(async (ask?: () => Promise<WaitBook>) => {
    const w = onlineWire();
    if (!w) return;
    try {
      setBook(await (ask ?? (() => w.adminBook()))());
      setAt(Date.now());
      setError(null);
    } catch (e) {
      setError(`L’office n’a pas répondu : ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), REFRESH_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [admin, read]);

  const figures = useMemo(() => {
    if (!book) return null;
    const e = book.entrants;
    const confirmed = e.filter((x) => x.confirmedAt !== null);
    /* the week runs back from the moment the book was read */
    const week = e.filter((x) => x.createdAt > at - 7 * DAY_MS).length;
    const written = confirmed.filter((x) => x.letters > 0).length;
    const sources = new Map<string, number>();
    for (const x of confirmed) sources.set(x.source || 'direct', (sources.get(x.source || 'direct') ?? 0) + 1);
    const top = [...sources].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const langs = WAIT_LANGS.map((l) => [l, confirmed.filter((x) => x.lang === l).length] as const).filter(([, n]) => n > 0);
    return { confirmed: confirmed.length, pending: e.length - confirmed.length, week, written, top, langs };
  }, [book, at]);

  if (!session || !admin) return <Door me={session} />;

  return (
    <PageShell
      eyebrow="La direction"
      title="La liste d’attente"
      lede="Les adresses laissées sur l’avant-première, et les circulaires qu’on leur écrit."
      aside={
        <button type="button" className={button} onClick={() => void read()}>
          <RefreshCw aria-hidden /> {at ? `Lu à ${new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Lire'}
        </button>
      }
    >
      <Refusal text={error} />
      {!book || !figures ? (
        <p className="font-serif text-[14px] italic text-paper-300">…</p>
      ) : (
        <div className="grid gap-8">
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <Figure label="Confirmées" value={figures.confirmed.toLocaleString('fr-FR')} note={figures.langs.map(([l, n]) => `${l.toUpperCase()} ${n}`).join(' · ') || undefined} />
            <Figure label="Sans réponse" value={figures.pending.toLocaleString('fr-FR')} note="effacées après 7 jours" />
            <Figure label="Sur 7 jours" value={figures.week.toLocaleString('fr-FR')} note="nouvelles inscriptions" />
            <Figure label="Déjà écrites" value={figures.written.toLocaleString('fr-FR')} note="ont reçu une circulaire" />
          </div>

          <div className="grid gap-8 min-[1100px]:grid-cols-12 min-[1100px]:gap-x-7">
            <Panel title="Inscriptions, 30 jours" className="min-[1100px]:col-span-12">
              <Arrivals entrants={book.entrants} />
            </Panel>
            <Panel title="Pays" meta="confirmées" className="min-[1100px]:col-span-7">
              <Countries entrants={book.entrants} />
              <p className="mt-4 font-ui text-[12px] leading-relaxed text-iron-400">
                Déduit de l’adresse IP à l’inscription, qui n’est pas gardée.{' '}
                <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-paper-100">
                  IP Geolocation by DB-IP
                </a>
              </p>
            </Panel>
            <Panel title="Provenances" className="min-[1100px]:col-span-5">
              {figures.top.length ? (
                <ol className="grid gap-2">
                  {figures.top.map(([s, n]) => (
                    <li key={s} className="flex items-baseline justify-between gap-3 font-ui text-[13px]">
                      <span className="truncate text-paper-100">{s}</span>
                      <span className="tabular-nums text-paper-300">{n}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="font-serif text-[14px] italic text-paper-300">Rien encore.</p>
              )}
              <p className="mt-4 font-ui text-[12px] leading-relaxed text-iron-400">Ajoutez <code className="font-mono">?via=nom</code> aux liens que vous partagez pour savoir d’où viennent les inscrits.</p>
            </Panel>
          </div>

          <div className="grid gap-8 min-[1100px]:grid-cols-12 min-[1100px]:gap-x-7">
            <div className="min-[1100px]:col-span-7">
              <Composer
                book={book}
                onBook={(b) => {
                  setBook(b);
                  /* the first letters leave at once: the bar is read again when they have */
                  window.setTimeout(() => void read(), 3000);
                }}
              />
            </div>
            <Panel title="Circulaires" className="min-[1100px]:col-span-5">
              <Circulars circulars={book.circulars} onStop={(id) => void read(() => onlineWire()!.adminStop(id))} />
            </Panel>
          </div>

          <Book entrants={book.entrants} onStrike={(e) => void read(() => onlineWire()!.adminStrike(e.id))} />
        </div>
      )}
    </PageShell>
  );
}
