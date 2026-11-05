import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import PageShell, { Panel, Refusal, inputClass } from '@/components/site/PageShell';
import { courseKeyOf } from '@/components/game/lessonWords';
import { personaName } from '@/game/data';
import { trIn } from '@/i18n';
import { onlineWire } from '@/online/net';
import { TRAIL_FEW, VIEWS } from '@/online/guideTrail';
import type { GuideFunnel, LessonFunnel, TrailFilter, TrailSplit, View } from '@/online/guideTrail';
import { cn } from '@/lib/utils';
import { Backstage, Figure, button } from './Direction';

/* ------------------------------------------------------------------ */
/* /direction/partie-guidee — where real beginners pass, stop or leave  */
/* the guided game: each lesson in the guide's order, how it was        */
/* passed, how long it held them, where the guide was left or the table */
/* let go; how the games ended; the same by kind of screen and by deal. */
/* Summed up by the office from the trail the guided tables leave       */
/* (online/guideTrail.ts), which names no one: counts and medians, no   */
/* table's own story. The owner's language, as the rest of the desk.    */
/* Each course is read apart: the first lesson's short game, or the     */
/* second's full one.                                                   */
/* ------------------------------------------------------------------ */

/** the funnel is read again this often while the page is open */
const REFRESH_MS = 60_000;
const VIEW_NAMES: Record<View, string> = { desktop: 'Ordinateur', 'tablet-landscape': 'Tablette à l’horizontale', 'tablet-portrait': 'Tablette à la verticale', touch: 'Petit écran tactile' };

const n = (x: number) => x.toLocaleString('fr-FR');
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)} %` : '—');
const date = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;
/** a time on a lesson, in words a desk reads at a glance */
function span(s: number | null): string {
  if (s === null) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
/** a lesson's title as the guided game gives it — its id alone for one no longer in the guide */
function titleOf(id: string): string {
  const key = `game.guide.steps.${courseKeyOf(id)}.title`;
  const title = trIn('fr', key, { bot: personaName('wedgwood') });
  return title === key ? id : title;
}

/* ------------------------------- the funnel ----------------------------- */

const head = 'micro-label whitespace-nowrap px-1.5 py-2 text-right font-normal text-iron-400';
const cell = 'whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums text-paper-300';

/** a count that means nothing at zero reads as a dash */
const count = (x: number) => (x ? n(x) : <span className="text-iron-400">·</span>);

function Lessons({ f }: { f: GuideFunnel }) {
  const top = Math.max(1, f.tables);
  const lost = Math.max(1, ...f.lessons.map((l) => l.left + l.stopped));
  const said = (l: LessonFunnel) =>
    `${titleOf(l.id)} (${l.id}) — vue à ${n(l.shown)} ${l.shown > 1 ? 'tables' : 'table'} sur ${n(f.tables)} (${pct(l.shown, f.tables)}) ; faite ${l.deed}, Suivant ${l.next}, passée ${l.skip} ; plus tard ${l.later} fois ; déjà faite ${l.already} ; détour ${l.detour} ; quittée ${l.left}, perdue ${l.stopped}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-ui text-[13px]">
        <caption className="sr-only">Chaque leçon de la partie guidée : combien de tables l’ont vue, comment elle a été passée, où le guide a été quitté</caption>
        <thead>
          <tr className="border-b border-[var(--gz-ink-soft)]">
            <th scope="col" className={cn(head, 'text-left')}>
              Leçon
            </th>
            <th scope="col" className={cn(head, 'min-w-[170px] text-left')}>
              Vue
            </th>
            <th scope="col" className={head} title="Passée en faisant ce qu’elle demande">
              Faite
            </th>
            <th scope="col" className={head} title="Passée par Suivant : une page lue, une leçon déjà faite, un emprunt qui peut attendre">
              Suivant
            </th>
            <th scope="col" className={head} title="Passée sans être faite">
              Passée
            </th>
            <th scope="col" className={head} title="Mise de côté jusqu’à la manche suivante (chaque fois)">
              Plus tard
            </th>
            <th scope="col" className={head} title="Montrée comme déjà faite">
              Déjà
            </th>
            <th scope="col" className={head} title="Tables envoyées d’abord à l’emprunt">
              Détour
            </th>
            <th scope="col" className={cn(head, 'text-left')} title="Guide quitté sur cette leçon, ou table restée sur elle sans nouvelles depuis avant-hier">
              Quittée · perdue
            </th>
            <th scope="col" className={head} title="La leçon la plus loin atteinte à la fin de la partie">
              Fin
            </th>
            <th scope="col" className={head} title="Médiane, de la leçon montrée à la leçon passée">
              Actions
            </th>
            <th scope="col" className={head} title="Médiane, de la leçon montrée à la leçon passée">
              Durée
            </th>
          </tr>
        </thead>
        <tbody>
          {f.lessons.map((l, i) => (
            <tr key={l.id} className="border-b border-[var(--gz-ink-faint)] hover:bg-enamel-800" title={said(l)}>
              <th scope="row" className="whitespace-nowrap px-1.5 py-1.5 text-left font-normal">
                <span className="mr-2 inline-block w-5 text-right font-mono text-[11px] text-iron-400">{i + 1}</span>
                <span className="text-paper-100">{titleOf(l.id)}</span>
              </th>
              <td className="px-1.5 py-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 flex-1 bg-[var(--gz-ink-faint)]">
                    <span className="block h-full rounded-r-[3px] bg-brass-300" style={{ width: `${(l.shown / top) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-paper-300">{n(l.shown)}</span>
                  <span className="w-11 text-right tabular-nums text-iron-400">{pct(l.shown, f.tables)}</span>
                </span>
              </td>
              <td className={cell}>{count(l.deed)}</td>
              <td className={cell}>{count(l.next)}</td>
              <td className={cell}>{count(l.skip)}</td>
              <td className={cell}>{count(l.later)}</td>
              <td className={cell}>{count(l.already)}</td>
              <td className={cell}>{count(l.detour)}</td>
              <td className="px-1.5 py-1.5">
                {l.left + l.stopped ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-10 bg-[var(--gz-ink-faint)]">
                      <span className="block h-full rounded-r-[3px] bg-rust-400" style={{ width: `${((l.left + l.stopped) / lost) * 100}%` }} />
                    </span>
                    <span className="tabular-nums text-paper-300">
                      {l.left} · {l.stopped}
                    </span>
                  </span>
                ) : (
                  <span className="text-iron-400">·</span>
                )}
              </td>
              <td className={cell}>{count(l.closing)}</td>
              <td className={cell}>{l.actions === null ? '—' : n(l.actions)}</td>
              <td className={cell}>{span(l.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- the splits ----------------------------- */

function Splits({ rows, label, name }: { rows: TrailSplit[]; label: string; name: (key: string) => string }) {
  if (!rows.length) return <p className="font-serif text-[14px] italic text-paper-300">Rien encore.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-ui text-[13px]">
        <thead>
          <tr className="border-b border-[var(--gz-ink-soft)]">
            {[label, 'Tables', 'Au bout', 'Quitté', 'Perdues', 'Gagnées', 'Écart moyen', 'Leçons passées'].map((h, i) => (
              <th key={h} scope="col" className={cn(head, i === 0 && 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-[var(--gz-ink-faint)]">
              <th scope="row" className="whitespace-nowrap px-1.5 py-1.5 text-left font-normal text-paper-100">
                {name(r.key)}
              </th>
              <td className={cell}>{n(r.tables)}</td>
              <td className={cell} title={`${r.played} menées au bout, ${r.abandoned} abandonnées`}>
                {n(r.played)}
                <span className="ml-2 inline-block w-11 text-iron-400">{pct(r.played, r.tables)}</span>
              </td>
              <td className={cell}>{count(r.left)}</td>
              <td className={cell}>{count(r.stopped)}</td>
              <td className={cell} title={r.ties ? `${r.ties} à égalité` : undefined}>
                {r.played ? n(r.wins) : ''}
                <span className="ml-2 inline-block w-11 text-iron-400">{pct(r.wins, r.played)}</span>
              </td>
              <td className={cell}>{r.gap === null ? '—' : `${signed(r.gap)} PV`}</td>
              <td className={cell}>{r.passed === null ? '—' : n(r.passed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- the page ------------------------------ */

export default function DirectionGuide() {
  return (
    <Backstage>
      <Funnel />
    </Backstage>
  );
}

function Funnel() {
  const [filter, setFilter] = useState<TrailFilter>({});
  const [funnel, setFunnel] = useState<GuideFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  /* the last reading asked: an answer to an older one, for another
     filter, comes too late to be shown */
  const asked = useRef(0);

  const read = useCallback(async () => {
    const w = onlineWire();
    if (!w) return;
    const n = ++asked.current;
    try {
      const f = await w.adminGuide(filter);
      if (n !== asked.current) return;
      setFunnel(f);
      setAt(Date.now());
      setError(null);
    } catch (e) {
      if (n !== asked.current) return;
      setError(`L’office n’a pas répondu : ${(e as Error).message}`);
    }
  }, [filter]);

  useEffect(() => {
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), REFRESH_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [read]);

  const f = funnel;

  return (
    <PageShell
      eyebrow="La direction"
      title="La partie guidée"
      lede={`Où les débutants passent, s’arrêtent ou quittent le guide. Aucune trace n’y est individuelle : les tables guidées laissent leurs événements sous un numéro tiré au hasard, sans compte ni code, gardés ${f?.days ?? 180} jours.`}
      aside={
        <div className="flex flex-wrap gap-3">
          <Link to="/direction" className={button}>
            <ArrowLeft aria-hidden /> Liste d’attente
          </Link>
          <button type="button" className={button} onClick={() => void read()}>
            <RefreshCw aria-hidden /> {at ? `Lu à ${new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Lire'}
          </button>
        </div>
      }
    >
      <Refusal text={error} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* a course, then the deals of that course: another course deals from another list */}
        <select className={cn(inputClass, 'w-auto')} value={filter.course ?? ''} onChange={(e) => setFilter((x) => ({ ...(e.target.value === 'full' ? { course: 'full' as const } : {}), ...(x.view ? { view: x.view } : {}) }))} aria-label="Leçon">
          <option value="">Leçon 1 : la partie courte</option>
          <option value="full">Leçon 2 : la partie complète</option>
        </select>
        <select className={cn(inputClass, 'w-auto')} value={filter.view ?? ''} onChange={(e) => setFilter((x) => ({ ...x, view: (e.target.value || undefined) as View | undefined }))} aria-label="Écran">
          <option value="">Tous les écrans</option>
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {VIEW_NAMES[v]}
            </option>
          ))}
        </select>
        <select className={cn(inputClass, 'w-auto')} value={filter.seed ?? ''} onChange={(e) => setFilter((x) => ({ ...x, seed: e.target.value === '' ? undefined : Number(e.target.value) }))} aria-label="Donne">
          <option value="">Toutes les donnes</option>
          {(f?.seeds ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              Donne {s.key}
            </option>
          ))}
        </select>
        {f && f.from !== null && f.to !== null && (
          <span className="font-ui text-[12px] text-iron-400">
            {n(f.events)} événements, du {date(f.from)} au {date(f.to)}
          </span>
        )}
      </div>
      {!f ? (
        <p className="font-serif text-[14px] italic text-paper-300">…</p>
      ) : (
        <div className="grid gap-8">
          {f.thin ? (
            <Panel title="Leçon par leçon" meta={`${n(f.tables)} ${f.tables > 1 ? 'tables' : 'table'} pour ce filtre`}>
              <p className="font-serif text-[14px] italic text-paper-300">
                Moins de {TRAIL_FEW} tables : l’office ne dit pas ce qu’elles ont fait, pour qu’aucune ne s’y lise seule. Élargissez le filtre.
              </p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
                <Figure label="Tables guidées" value={n(f.tables)} note={f.playOn ? `${n(f.playOn)} ${f.playOn > 1 ? 'ont' : 'a'} laissé jouer la machine` : undefined} />
                <Figure label="Menées au bout" value={pct(f.played, f.tables)} note={`${n(f.played)} sur ${n(f.tables)}${f.abandoned ? ` · ${n(f.abandoned)} abandonnées` : ''}`} />
                <Figure label="Guide quitté" value={n(f.left)} note={`${n(f.stopped)} ${f.stopped > 1 ? 'tables perdues' : 'table perdue'} en route`} />
                <Figure label="Gagnées" value={pct(f.wins, f.played)} note={f.gap === null ? 'aucune partie au bout' : `écart moyen ${signed(f.gap)} PV`} />
              </div>

              <Panel title="Leçon par leçon" meta="dans l’ordre du guide">
                <Lessons f={f} />
                <p className="mt-4 font-ui text-[12px] leading-relaxed text-iron-400">
                  Une leçon est vue quand elle est à l’écran, ou passée guide replié. « Perdue » : une table sans nouvelles depuis avant-hier (l’office ne garde que le jour de chaque événement), ni menée au bout ni quittée, sur la dernière leçon montrée — y compris celle dont le lecteur a décoché « Participer » en route, ou qu’il a reprise depuis le début : elle se tait sans quitter le guide. Les durées vont de la leçon montrée à la leçon passée, en actions jouées et en temps. Un écran ou une donne lus seuls ne se montrent qu’à partir de {TRAIL_FEW} tables.
                </p>
              </Panel>
            </>
          )}

          <div className="grid gap-8">
            <Panel title="Par écran" meta="toutes les donnes">
              <Splits rows={f.views} label="Écran" name={(k) => VIEW_NAMES[k as View] ?? k} />
            </Panel>
            <Panel title="Par donne" meta="tous les écrans">
              <Splits rows={f.seeds} label="Donne" name={(k) => `Donne ${k}`} />
            </Panel>
          </div>
        </div>
      )}
    </PageShell>
  );
}
