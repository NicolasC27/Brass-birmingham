import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* What the sound scheduler holds, read twice a second from its dev    */
/* hooks (window.__sfx, sfx.ts): what sounds, what waits and when, and */
/* the last things heard.                                              */
/* ------------------------------------------------------------------ */

interface Hooks {
  ambience: () => string | null;
  life: () => string | null;
  music: () => string | null;
  voice: () => string | null;
  next: () => { life: string | number | null; voice: string | number | null; tune: string | number | null; hushedFor: number | null };
  heard: () => string[];
}

const hooks = (): Hooks | null => (window as unknown as { __sfx?: Hooks }).__sfx ?? null;

interface Reading {
  ambience: string | null;
  life: string | null;
  music: string | null;
  voice: string | null;
  next: ReturnType<Hooks['next']>;
  heard: string[];
}

const read = (): Reading | null => {
  const h = hooks();
  return h ? { ambience: h.ambience(), life: h.life(), music: h.music(), voice: h.voice(), next: h.next(), heard: h.heard() } : null;
};

/** a wait in seconds, or what sounds already */
const waitText = (v: string | number | null): string => (v === null ? '—' : typeof v === 'number' ? `dans ${v} s` : `joue : ${v}`);

export default function SfxReadout({ tone = 'site', heard = 6 }: { tone?: 'site' | 'table'; heard?: number }) {
  const [r, setR] = useState<Reading | null>(read);
  useEffect(() => {
    const id = window.setInterval(() => setR(read()), 500);
    return () => window.clearInterval(id);
  }, []);
  const label = tone === 'site' ? 'micro-label text-iron-400' : 'font-sans text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brass-400/80';
  const value = tone === 'site' ? 'data-text text-paper-100' : 'font-mono text-[11px] text-cream-100';
  if (!r) return <p className={value}>Crochets __sfx absents (build de production ?)</p>;
  const rows: [string, string][] = [
    ['Ambiance', r.ambience ?? '—'],
    ['Événement', waitText(r.next.life)],
    ['Voix', waitText(r.next.voice)],
    ['Air', waitText(r.next.tune)],
    ['Silence (moment)', r.next.hushedFor ? `${r.next.hushedFor} s` : '—'],
  ];
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className={label}>{k}</dt>
            <dd className={cn(value, 'truncate')}>{v}</dd>
          </div>
        ))}
      </dl>
      {heard > 0 && (
        <>
          <p className={cn(label, 'mt-2')}>Derniers sons</p>
          <ol className={cn(value, 'mt-0.5 flex flex-col-reverse')}>
            {r.heard.slice(-heard).map((h, i) => (
              <li key={`${i}-${h}`} className="truncate">
                {h}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
