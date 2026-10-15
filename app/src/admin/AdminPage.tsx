import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { Dices, Rocket } from 'lucide-react';
import PageShell, { Panel, inputClass } from '@/components/site/PageShell';
import Button from '@/components/platform/Button';
import { PERSONAS } from '@/game/data';
import { homeSnapshot, subscribeHome } from '@/game/home';
import type { BotPersona } from '@/game/types';
import { ONLINE_URL } from '@/online/net';
import { useSession } from '@/online/session';
import { cn } from '@/lib/utils';
import { BENCH_PREFIX, forgetBenchGames } from './launch';
import { PRESETS, presetOf } from './scenario';
import SoundBoard from './SoundBoard';
import { keepChoice, readChoice, stepText, useLaunch } from './useLaunch';
import type { BenchChoice } from './useLaunch';

/* ------------------------------------------------------------------ */
/* /admin — the test bench, in dev builds only (App.tsx mounts the     */
/* route under import.meta.env.DEV, and this page is fetched lazily,   */
/* so nothing of it reaches a production bundle). One language, the   */
/* owner's: the words here are never shown to a player, and keeping   */
/* them out of the dictionaries keeps them out of every build.         */
/*                                                                     */
/* A scenario launcher (a real game at the office, played forward by   */
/* the machines), the sound board, and the way to the office's own     */
/* dev pages.                                                          */
/* ------------------------------------------------------------------ */

/** the office's own address, for its dev pages (the socket's, over http) */
const officeHttp = ONLINE_URL.replace(/^ws(s?):/, 'http$1:').replace(/\/+$/, '');

const OFFICE_PAGES: [string, string][] = [
  ['/letters', 'les lettres (vérification, mot de passe) que l’office aurait postées'],
  ['/flags', 'les signalements du guet'],
  ['/feedback', 'la boîte à idées et bugs'],
  ['/faults', 'les pannes remontées par les navigateurs'],
];

const HOOKS: [string, string][] = [
  ['window.__sfx', 'le son : playing(), next(), heard(), speak()…'],
  ['window.__brass', 'le magasin de la table (getState())'],
  ['window.__brassRail()', 'saute au rail sur une table à la maison (sans l’office)'],
  ['window.__board', 'coordonnées écran du plateau (fly, townScreen…)'],
  ['?theme=dark&arrived=1', 'thème sombre, arrivée en gare sautée'],
  ['/game/local/<code>?analyse', 'ouvre l’analyse d’une partie finie'],
];

/** a row of choices, one of them held */
function Pick<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn('min-h-8 border px-3 font-ui text-[12px] transition-colors', o.id === value ? 'border-brass-300 bg-enamel-800 text-brass-300' : 'border-[var(--gz-line-control)] text-paper-100 hover:border-brass-300')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Launcher() {
  const [c, setC] = useState<BenchChoice>(readChoice);
  const { run, step, error, last, busy } = useLaunch();
  const set = (patch: Partial<BenchChoice>) =>
    setC((was) => {
      const next = { ...was, ...patch };
      next.owner = Math.min(next.owner, next.seats - 1);
      keepChoice(next);
      return next;
    });
  const bots = c.seats - 1;
  const launch = () => {
    const preset = presetOf(c.preset);
    if (!preset) return;
    const seed = c.seed.trim() === '' ? undefined : Math.abs(Math.floor(Number(c.seed)));
    void run({ preset, seats: c.seats, owner: c.owner, personas: c.personas.slice(0, bots), seed: Number.isFinite(seed) ? seed : undefined });
  };
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="micro-label text-brass-300">Moment</p>
        <div className="mt-2 grid gap-1.5 min-[760px]:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={c.preset === p.id}
              onClick={() => set({ preset: p.id })}
              className={cn('border px-3 py-2 text-left transition-colors', c.preset === p.id ? 'border-brass-300 bg-enamel-800' : 'border-[var(--gz-line-control)] hover:border-brass-300')}
            >
              <span className={cn('block font-fraunces text-[14.5px] font-medium', c.preset === p.id ? 'text-brass-300' : 'text-paper-100')}>{p.label}</span>
              <span className="block font-ui text-[11.5px] leading-snug text-iron-400">{p.note}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 min-[760px]:grid-cols-3">
        <div>
          <p className="micro-label text-brass-300">Joueurs</p>
          <div className="mt-2">
            <Pick label="Joueurs" value={c.seats} onChange={(seats) => set({ seats })} options={[2, 3, 4].map((n) => ({ id: n, label: String(n) }))} />
          </div>
        </div>
        <div>
          <p className="micro-label text-brass-300">Votre siège</p>
          <div className="mt-2">
            <Pick label="Votre siège" value={c.owner} onChange={(owner) => set({ owner })} options={Array.from({ length: c.seats }, (_, i) => ({ id: i, label: `${i + 1}` }))} />
          </div>
        </div>
        <div>
          <label htmlFor="bench-seed" className="micro-label block text-brass-300">
            Graine
          </label>
          <div className="mt-2 flex gap-1.5">
            <input id="bench-seed" inputMode="numeric" value={c.seed} onChange={(e) => set({ seed: e.target.value.replace(/[^0-9]/g, '') })} placeholder="au hasard" className={cn(inputClass, 'h-8 py-1')} />
            <Button variant="icon" aria-label="Graine au hasard" title="Graine au hasard" onClick={() => set({ seed: String(Math.floor(Math.random() * 1e9)) })}>
              <Dices />
            </Button>
          </div>
        </div>
      </div>
      <div>
        <p className="micro-label text-brass-300">Machines</p>
        <div className="mt-2 grid gap-2 min-[760px]:grid-cols-3">
          {Array.from({ length: bots }, (_, b) => {
            const seat = b < c.owner ? b : b + 1;
            return (
              <label key={b} className="flex items-center gap-2">
                <span className="data-text w-14 shrink-0 text-iron-400">siège {seat + 1}</span>
                <select
                  value={c.personas[b]}
                  onChange={(e) => {
                    const personas = [...c.personas];
                    personas[b] = e.target.value as BotPersona;
                    set({ personas });
                  }}
                  className={cn(inputClass, 'h-8 py-1')}
                >
                  {PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" icon={<Rocket />} onClick={launch} disabled={busy}>
          Lancer
        </Button>
        {step && (
          <div className="flex min-w-[240px] flex-1 items-center gap-3" role="status">
            <div className="h-1.5 flex-1 bg-enamel-800">
              <div className="h-full bg-brass-300 transition-[width] duration-150" style={{ width: `${Math.round((step.stage === 'play' ? step.share * 0.8 : 0.8 + step.share * 0.2) * 100)}%` }} />
            </div>
            <span className="data-text text-paper-300">{stepText(step)}</span>
          </div>
        )}
        {!step && last && (
          <p className="data-text text-iron-400">
            dernière : <Link to={`/game/local/${last.code}`} className="text-brass-300 underline">{last.code}</Link> · {last.moves} coups · graine {last.seed} · {last.ms} ms
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="border border-rust-400/50 bg-rust-600/10 px-3 py-2 font-ui text-[13px] text-rust-400">
          {error}
        </p>
      )}
    </div>
  );
}

function BenchGames() {
  const games = useSyncExternalStore(subscribeHome, homeSnapshot).filter((t) => t.name.startsWith(`${BENCH_PREFIX} · `));
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="font-serif text-[14px] text-paper-100">
        {games.length} partie{games.length > 1 ? 's' : ''} d’essai au registre <span className="text-iron-400">(200 au plus par compte)</span>
      </p>
      <ul className="mt-2 flex max-h-44 flex-col overflow-y-auto">
        {games.slice(0, 12).map((g) => (
          <li key={g.code} className="flex items-baseline justify-between gap-2 border-b border-[var(--gz-ink-faint)] py-1">
            <Link to={`/game/local/${g.code}`} className="data-text text-brass-300 hover:underline">
              {g.code}
            </Link>
            <span className="truncate font-ui text-[12px] text-paper-300">{g.name.slice(BENCH_PREFIX.length + 3)}</span>
          </li>
        ))}
      </ul>
      <Button
        variant="danger-ghost"
        size="sm"
        className="mt-3"
        disabled={busy || !games.length}
        onClick={() => {
          setBusy(true);
          void forgetBenchGames().finally(() => setBusy(false));
        }}
      >
        Ranger les parties d’essai
      </Button>
    </div>
  );
}

export default function AdminPage() {
  const me = useSession();
  return (
    <PageShell
      eyebrow="Atelier — build de développement seulement"
      title="Banc d’essai"
      lede="Atteindre n’importe quel moment d’une partie en quelques secondes, écouter chaque son de la table, ouvrir les pages de l’office."
      aside={<p className="data-text text-iron-400">{me ? `${me.name}${me.guest ? ' (invité)' : ''}` : 'pas encore de compte'} · office {officeHttp || 'absent'}</p>}
    >
      <div className="grid gap-6 min-[1100px]:grid-cols-12">
        <Panel title="Scénarios" meta="une vraie partie à l’office, jouée par les machines" className="min-[1100px]:col-span-8">
          <Launcher />
        </Panel>
        <div className="flex flex-col gap-6 min-[1100px]:col-span-4">
          <Panel title="Pages de l’office">
            <ul className="flex flex-col gap-1.5">
              {OFFICE_PAGES.map(([path, what]) => (
                <li key={path}>
                  <a href={`${officeHttp}${path}`} target="_blank" rel="noreferrer" className="data-text text-brass-300 hover:underline">
                    {path}
                  </a>{' '}
                  <span className="font-ui text-[12px] text-paper-300">{what}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-ui text-[11.5px] leading-snug text-iron-400">L’office les sert à cette machine seulement, lancé avec DEV_LETTERS=1.</p>
          </Panel>
          <Panel title="Crochets">
            <ul className="flex flex-col gap-1.5">
              {HOOKS.map(([hook, what]) => (
                <li key={hook}>
                  <code className="data-text text-paper-100">{hook}</code> <span className="font-ui text-[12px] text-paper-300">{what}</span>
                </li>
              ))}
              <li>
                <span className="data-text text-paper-100">F9</span> <span className="font-ui text-[12px] text-paper-300">à la table : le tiroir d’essai (sons, voix, avis, scénarios)</span>
              </li>
            </ul>
          </Panel>
          <Panel title="Parties d’essai">
            <BenchGames />
          </Panel>
        </div>
        <Panel title="Table de mixage" meta="chaque son, par la machinerie de la table" className="overflow-visible min-[1100px]:col-span-12">
          <SoundBoard />
        </Panel>
      </div>
    </PageShell>
  );
}
