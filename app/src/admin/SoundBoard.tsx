import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Play, Square, MessageSquare } from 'lucide-react';
import { TOWN_BY_ID } from '@/game/data';
import { counterBell, cue, cueNames, houseBell, lifeNow, mugClink, onSaid, pingTap, playRecording, saidNow, sayNow, setMix, stampThud, stationBell, steamWhistle, tableAmbience, tableMusic, tuneNow, warmSounds } from '@/gl/sfx';
import { LIFE, TUNES } from '@/gl/playlist';
import { CAST, LINES } from '@/gl/voices';
import type { Line, Who } from '@/gl/voices';
import { BubbleFace } from '@/components/game/VoiceBubble';
import Button from '@/components/platform/Button';
import { cn } from '@/lib/utils';
import type { Era } from '@/game/types';
import SfxReadout from './SfxReadout';

/* ------------------------------------------------------------------ */
/* The sound board: every sound of the table at a click, through the   */
/* table's own machinery — a cue as a move plays it, an ambience as an */
/* era lays it, an event and a voice as the scheduler plays them (a    */
/* voice with its bubble), a tune through the era's playlist or alone. */
/* ------------------------------------------------------------------ */

const SYNTHS: [string, () => void][] = [
  ['Cloche du comptoir', counterBell],
  ['Tape (ping)', pingTap],
  ['Chopes', mugClink],
  ['Cloche de gare', stationBell],
  ['Sifflet', steamWhistle],
  ['Presse (tuile)', () => stampThud('tile')],
  ['Presse (lien)', () => stampThud('link')],
  ['Clochette de boutique', () => houseBell('birmingham')],
];

const ERA_NAME: Record<Era, string> = { canal: 'Canal', rail: 'Rail' };

/** a small square button of the board */
function Key({ onClick, children, active, title }: { onClick: () => void; children: React.ReactNode; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('inline-flex min-h-8 items-center gap-1.5 border px-2.5 py-1 font-ui text-[12px] transition-colors', active ? 'border-brass-300 bg-enamel-800 text-brass-300' : 'border-[var(--gz-line-control)] text-paper-100 hover:border-brass-300 hover:bg-enamel-800')}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="micro-label text-brass-300">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function SoundBoard() {
  /* the board speaks with every switch open, at the levels the settings
     open on; the table sets its own mix again when it is sat at */
  useEffect(() => {
    setMix({ on: true, ambience: true, music: true, voices: true, levels: { ambience: 0.5, gestures: 0.8, moments: 0.8, music: 0.5 } });
    return () => {
      tableAmbience(null);
      tableMusic(null);
    };
  }, []);
  /* the palette fetched at the first touch, so a gesture is not let go as stale */
  const warmed = useRef(false);
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    warmSounds();
  };
  const [amb, setAmb] = useState<Era | null>(null);
  const [list, setList] = useState<Era | null>(null);
  const [alone, setAlone] = useState<{ name: string; stop: () => void } | null>(null);
  const [preview, setPreview] = useState<Line | null>(null);
  const said = useSyncExternalStore(onSaid, saidNow, () => null);
  const shown = said ?? (preview ? { id: preview.id, name: CAST[preview.who].name, trade: CAST[preview.who].trade, text: preview.text } : null);

  const ambience = (era: Era) => {
    const next = amb === era ? null : era;
    setAmb(next);
    tableAmbience(next);
  };
  const playlist = (era: Era) => {
    const next = list === era ? null : era;
    setList(next);
    tableMusic(next);
  };
  const tune = async (name: string) => {
    alone?.stop();
    if (alone?.name === name) {
      setAlone(null);
      return;
    }
    const h = await playRecording(name, 'music');
    setAlone(h ? { name, stop: h.stop } : null);
  };
  useEffect(() => () => alone?.stop(), [alone]);

  const byWho = (Object.keys(CAST) as Who[]).map((who) => ({ who, lines: LINES.filter((l) => l.who === who) }));

  return (
    <div className="grid gap-8 min-[1100px]:grid-cols-12" onPointerDownCapture={warm}>
      <div className="flex flex-col gap-6 min-[1100px]:col-span-8">
        <Group title="Gestes et moments (cue)">
          {cueNames().map((n) => (
            <Key key={n} onClick={() => cue(n)}>
              {n}
            </Key>
          ))}
        </Group>
        <Group title="Synthétisés">
          {SYNTHS.map(([label, play]) => (
            <Key key={label} onClick={play}>
              {label}
            </Key>
          ))}
        </Group>
        <Group title="Ambiance de l’ère (boucle)">
          {(['canal', 'rail'] as const).map((era) => (
            <Key key={era} active={amb === era} onClick={() => ambience(era)}>
              {amb === era ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />} {ERA_NAME[era]}
            </Key>
          ))}
        </Group>
        {(['canal', 'rail'] as const).map((era) => (
          <Group key={era} title={`Vie du ${era === 'canal' ? 'canal' : 'rail'} (événements)`}>
            {LIFE[era].map((n) => (
              <Key key={n} onClick={() => lifeNow(n)}>
                {n.replace('life-', '')}
              </Key>
            ))}
          </Group>
        ))}
        <Group title="Airs">
          {(['canal', 'rail'] as const).map((era) =>
            TUNES[era].map((t) => (
              <Key key={t.name} active={alone?.name === t.name} onClick={() => void tune(t.name)}>
                {alone?.name === t.name ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />} {t.name}
              </Key>
            )),
          )}
        </Group>
        <Group title="Programme des airs (le vrai ordonnanceur)">
          {(['canal', 'rail'] as const).map((era) => (
            <Key key={era} active={list === era} onClick={() => playlist(era)}>
              {list === era ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />} {ERA_NAME[era]}
            </Key>
          ))}
          <Key onClick={() => tuneNow()} title="coupe la pause, ou passe à l’air suivant">
            Air suivant / fin de pause
          </Key>
        </Group>

        <div>
          <p className="micro-label text-brass-300">Les voix de la ville</p>
          <div className="mt-2 grid gap-5 min-[760px]:grid-cols-2">
            {byWho.map(({ who, lines }) => (
              <section key={who} className="border-t border-[var(--gz-ink-faint)] pt-2">
                <h3 className="font-fraunces text-[15px] font-medium text-paper-100">
                  {CAST[who].name}, <span className="italic text-paper-300">{CAST[who].trade}</span>
                </h3>
                <p className="data-text text-iron-400">chez soi : {TOWN_BY_ID[CAST[who].home]?.name ?? CAST[who].home}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {lines.map((l) => (
                    <li key={l.id} className="flex items-start gap-1.5">
                      <button type="button" aria-label={`Dire « ${l.text} »`} onClick={() => sayNow(l, CAST[who].home)} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--gz-line-control)] text-paper-100 hover:border-brass-300">
                        <Play className="h-3 w-3" />
                      </button>
                      <button type="button" aria-label={`Bulle de « ${l.text} »`} onClick={() => setPreview(l)} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--gz-line-control)] text-paper-300 hover:border-brass-300">
                        <MessageSquare className="h-3 w-3" />
                      </button>
                      <span className="font-serif text-[13.5px] leading-snug text-paper-100">
                        {l.text}
                        <span className="data-text ml-1.5 text-iron-400">
                          {l.mood}
                          {l.era ? ` · ${l.era}` : ''}
                          {l.about ? ` · ${l.about}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>

      <aside className="min-[1100px]:col-span-4">
        <div className="sticky top-24 flex flex-col gap-6">
          <div>
            <p className="micro-label text-brass-300">Bulle</p>
            <div className="mt-3 flex min-h-[96px] items-end justify-center border border-dashed border-[var(--gz-ink-faint)] p-4 pb-6">
              {shown ? <BubbleFace said={shown} /> : <p className="font-serif text-[13px] italic text-iron-400">Dire une ligne, ou cliquer sa bulle.</p>}
            </div>
            {preview && !said && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPreview(null)}>
                Effacer
              </Button>
            )}
          </div>
          <div>
            <p className="micro-label text-brass-300">L’ordonnanceur</p>
            <div className="mt-2">
              <SfxReadout heard={10} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
