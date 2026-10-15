import { useEffect, useMemo, useState } from 'react';
import { Wrench, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { TOWNS, TOWN_BY_ID } from '@/game/data';
import { buildTargets } from '@/game/engine';
import type { BuildTarget } from '@/game/engine';
import { headlinesFor } from '@/game/gazette';
import { ledgerParts } from '@/game/ledgerText';
import type { Card, GameState } from '@/game/types';
import { lifeNow, sayNow, tuneNow } from '@/gl/sfx';
import { LIFE } from '@/gl/playlist';
import { CAST, LINES, pickVoice } from '@/gl/voices';
import type { Who } from '@/gl/voices';
import { layNotices, useGazetteDesk } from '@/components/game/noticeQueue';
import type { Incoming } from '@/components/game/noticeQueue';
import { typing } from '@/components/game/keybindings';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { PRESETS } from './scenario';
import SfxReadout from './SfxReadout';
import { stepText, useLaunch } from './useLaunch';

/* ------------------------------------------------------------------ */
/* The test drawer at the table (dev builds only: Game.tsx fetches it  */
/* under import.meta.env.DEV). F9 or the small spanner low on the left */
/* edge opens it, beside the players and above the hand. Everything it */
/* fires goes through the table's own machinery: a voice through the   */
/* scheduler's player (bubble and all), a notice into the open book, a */
/* scenario dealt at the office, the supply arrows from a build picked */
/* as a player would pick it.                                          */
/* ------------------------------------------------------------------ */

/** the drawer's key: none of the table's (its letters, digits, arrows),
 *  nor a browser's own */
const KEY = 'F9';

const BTN = 'rounded border border-brass-700/60 bg-coal-800/80 px-2 py-0.5 font-sans text-[11px] text-cream-100 hover:border-brass-400 hover:bg-coal-700 disabled:opacity-40';
const SELECT = 'min-w-0 flex-1 rounded border border-brass-700/60 bg-coal-950 px-1.5 py-0.5 font-sans text-[11px] text-cream-100';

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="border-t border-brass-700/40 py-1.5 first:border-t-0">
      <summary className="cursor-pointer select-none font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brass-400">{title}</summary>
      <div className="mt-1.5 flex flex-col gap-1.5">{children}</div>
    </details>
  );
}

/** the towns a voice may be heard in: those with a works first */
function townsOf(g: GameState): string[] {
  const built = new Set(Object.keys(g.tiles).map((k) => k.split(':')[0]));
  return TOWNS.filter((t) => !t.farm)
    .map((t) => t.id)
    .sort((a, b) => Number(built.has(b)) - Number(built.has(a)) || TOWN_BY_ID[a].name.localeCompare(TOWN_BY_ID[b].name));
}

function Voices({ game }: { game: GameState }) {
  const [who, setWho] = useState<Who>('ezra');
  const lines = LINES.filter((l) => l.who === who);
  const [lineId, setLineId] = useState(lines[0].id);
  const [town, setTown] = useState<string>('');
  const towns = useMemo(() => townsOf(game), [game]);
  const [said, setSaid] = useState<string | null>(null);
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  const say = () => {
    const at = town || CAST[line.who].home;
    sayNow(line, at);
    setSaid(`${line.id} @ ${at}`);
  };
  const random = () => {
    /* as the table picks: a line and its town from the game as it stands */
    const spoken = pickVoice(game, [], null, Math.random) ?? { line: LINES[Math.floor(Math.random() * LINES.length)], town: '' };
    const at = spoken.town || CAST[spoken.line.who].home;
    sayNow(spoken.line, at);
    setSaid(`${spoken.line.id} @ ${at}`);
  };
  return (
    <>
      <div className="flex gap-1">
        <select
          aria-label="Personnage"
          className={SELECT}
          value={who}
          onChange={(e) => {
            const w = e.target.value as Who;
            setWho(w);
            setLineId(LINES.find((l) => l.who === w)!.id);
          }}
        >
          {(Object.keys(CAST) as Who[]).map((w) => (
            <option key={w} value={w}>
              {CAST[w].name}
            </option>
          ))}
        </select>
        <select aria-label="Ville" className={SELECT} value={town} onChange={(e) => setTown(e.target.value)}>
          <option value="">chez soi ({TOWN_BY_ID[CAST[who].home]?.name ?? CAST[who].home})</option>
          {towns.map((id) => (
            <option key={id} value={id}>
              {TOWN_BY_ID[id].name}
            </option>
          ))}
        </select>
      </div>
      <select aria-label="Ligne" className={SELECT} value={line.id} onChange={(e) => setLineId(e.target.value)}>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>
            {l.text}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <button type="button" className={BTN} onClick={say}>
          Dire
        </button>
        <button type="button" className={BTN} onClick={random}>
          Au hasard (comme la table)
        </button>
      </div>
      {said && <p className="font-mono text-[10.5px] text-cream-100/70">{said}</p>}
    </>
  );
}

function Notices({ game }: { game: GameState }) {
  const t = useT();
  const publish = useGazetteDesk((s) => s.publish);
  const [note, setNote] = useState<string | null>(null);
  const me = Math.max(0, game.players.findIndex((p) => !p.isBot));
  const other = (me + 1) % game.players.length;
  const when = { round: game.round, era: game.era };
  const id = (k: string) => `dev-${k}-${Date.now()}`;
  const lay = (items: Incoming[]) => {
    layNotices(items);
    setNote(null);
  };
  const flip = (who: number) => {
    /* a real flip of the ledger when there is one, told as the book tells it */
    const e = [...game.ledger].reverse().find((x) => x.key === 'flip' && (x.player === who || who < 0));
    const industry = String(e?.vars?.industry ?? 'cotton');
    const head = e ? ledgerParts(e, t).head : t(`game.log.industry.${industry}`);
    const seat = e?.player ?? who;
    const why = t(`game.flip.why.${String(e?.vars?.why ?? 'merchant')}`, { merchant: String(e?.vars?.merchant ?? 'Shrewsbury') });
    lay([{ id: id('f'), kind: 'flip', rank: seat === me ? 2 : 1, owner: seat, industry, title: t('game.flip.title', { what: head }), detail: t('game.flip.detail', { name: game.players[seat].name, why, income: Number(e?.vars?.income ?? 3) }), ...when }]);
  };
  const town = TOWN_BY_ID[Object.keys(game.tiles)[0]?.split(':')[0] ?? 'birmingham']?.name ?? 'Birmingham';
  const gazette = () => {
    for (let r = game.round - 1; r >= 1; r--) {
      const lines = headlinesFor(game, r, game.era);
      if (lines.length) {
        publish({ id: id('g'), round: r, era: game.era, lines });
        setNote(null);
        return;
      }
    }
    setNote('pas encore de manche jouée dans cette ère');
  };
  const kinds: [string, () => void][] = [
    ['Votre tour', () => lay([{ id: id('t'), kind: 'turn', rank: 2, owner: me, title: t('game.notice.turn'), detail: t('game.notice.turnDetail', { n: 5 }), ...when }])],
    ['Dernière manche (canal)', () => lay([{ id: id('e'), kind: 'lastRound', rank: 2, title: t('game.notice.lastCanal'), detail: t('game.notice.lastCanalDetail'), ...when }])],
    ['Dernière manche (partie)', () => lay([{ id: id('e'), kind: 'lastRound', rank: 2, title: t('game.notice.lastGame'), detail: t('game.notice.lastGameDetail'), ...when }])],
    ['Gazette', gazette],
    ['Retournement (le vôtre)', () => flip(me)],
    ['Retournement (adverse)', () => flip(other)],
    ['Bière bue', () => lay([{ id: id('b'), kind: 'beer', rank: 2, owner: other, industry: 'brewery', title: t('game.notice.beerTaken', { name: game.players[other].name, town }), detail: t('game.log.industry.cotton'), ...when }])],
    ['Surconstruit', () => lay([{ id: id('o'), kind: 'overbuilt', rank: 2, owner: other, industry: 'coal', title: t('game.notice.overbuilt', { name: game.players[other].name }), detail: t('game.notice.overbuiltDetail', { industry: t('game.log.industry.coal'), level: 1, town }), ...when }])],
    ['Ville épinglée', () => lay([{ id: id('p'), kind: 'pin', rank: 1, owner: other, industry: 'iron', title: t('game.notice.pinned', { town }), detail: t('game.log.industry.iron'), ...when }])],
  ];
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {kinds.map(([label, fire]) => (
          <button key={label} type="button" className={BTN} onClick={fire}>
            {label}
          </button>
        ))}
      </div>
      {note && <p className="font-mono text-[10.5px] text-rust-400">{note}</p>}
    </>
  );
}

function Supply() {
  const game = useGame((s) => s.game);
  const planActor = useGame((s) => s.planActor());
  const buildPick = useGame((s) => s.buildPick);
  const options = useMemo(() => {
    const g = useGame.getState().planGame();
    if (!g || planActor < 0) return [];
    const out: { key: string; card: Card; t: BuildTarget }[] = [];
    const seen = new Set<string>();
    for (const card of g.players[planActor].hand)
      for (const t of buildTargets(g, planActor, card)) {
        const key = `${t.town}:${t.slot}:${t.industry}`;
        if (!t.valid || seen.has(key) || !(t.coalPlan.sources.length || t.ironPlan.sources.length)) continue;
        seen.add(key);
        out.push({ key, card, t });
      }
    return out.slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, planActor]);
  if (planActor < 0) return <p className="font-sans text-[11px] italic text-cream-100/60">Pas votre tour : rien à préparer.</p>;
  if (!options.length) return <p className="font-sans text-[11px] italic text-cream-100/60">Aucune construction qui tire du charbon ou du fer.</p>;
  const current = buildPick ? options.find((o) => o.t.town === buildPick.town && o.t.slot === buildPick.slot && o.t.industry === buildPick.industry)?.key ?? '' : '';
  const choose = (key: string) => {
    const st = useGame.getState();
    const o = options.find((x) => x.key === key);
    if (!o) {
      st.cancel();
      return;
    }
    /* picked as a player picks: the card, the verb, the slot */
    if (st.selectedCardId !== o.card.id) st.selectCard(o.card.id);
    st.setVerb('build');
    st.pickBuild(o.t);
  };
  return (
    <div className="flex gap-1">
      <select aria-label="Construction" className={SELECT} value={current} onChange={(e) => choose(e.target.value)}>
        <option value="">— aucune —</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {TOWN_BY_ID[o.t.town]?.name ?? o.t.town} · {o.t.industry} {o.t.level} · charbon {o.t.coalPlan.sources.length} · fer {o.t.ironPlan.sources.length}
          </option>
        ))}
      </select>
      <button type="button" className={BTN} onClick={() => useGame.getState().cancel()}>
        Effacer
      </button>
    </div>
  );
}

function Scenarios({ game }: { game: GameState }) {
  const { run, step, error, busy } = useLaunch();
  const owner = Math.max(0, game.players.findIndex((p) => !p.isBot));
  const personas = game.players.filter((_, i) => i !== owner).map((p) => p.persona);
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" disabled={busy} title={p.note} className={cn(BTN, 'text-left')} onClick={() => void run({ preset: p, seats: game.players.length, owner, personas })}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="font-mono text-[10.5px] text-cream-100/60">{step ? stepText(step) : `${game.players.length} joueurs, siège ${owner + 1}, graine au hasard`}</p>
      {error && <p className="font-mono text-[10.5px] text-rust-400">{error}</p>}
    </>
  );
}

export default function AdminDrawer() {
  const game = useGame((s) => s.game);
  const [open, setOpen] = useState(false);
  const [music, setMusic] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== KEY || typing(e)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!game) return null;
  const era = game.era;
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Tiroir d’essai (F9)"
          title="Tiroir d’essai (F9)"
          data-admin-toggle
          className="fixed bottom-24 left-0 z-[90] flex h-7 w-4 items-center justify-center rounded-r border border-l-0 border-brass-700/50 bg-coal-900/70 text-brass-400/70 opacity-50 hover:w-6 hover:opacity-100"
        >
          <Wrench className="h-3 w-3" />
        </button>
      )}
      {open && (
        <aside
          data-admin-drawer
          aria-label="Tiroir d’essai"
          className="fixed left-[92px] top-16 z-[90] flex max-h-[calc(100vh-300px)] w-[290px] flex-col rounded-lg border border-brass-700/60 bg-coal-900/95 shadow-e4 backdrop-blur-md"
        >
          <header className="flex items-center justify-between border-b border-brass-700/40 px-3 py-1.5">
            <span className="font-sans text-[10.5px] font-bold uppercase tracking-[0.18em] text-brass-400">Tiroir d’essai · F9</span>
            <button type="button" aria-label="Fermer le tiroir" onClick={() => setOpen(false)} className="rounded p-0.5 text-cream-100/60 hover:bg-coal-800 hover:text-cream-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto px-3 pb-2">
            <Section title="Voix" open>
              <Voices game={game} />
            </Section>
            <Section title="Vie de l’ère">
              <div className="flex flex-wrap gap-1">
                {[...LIFE[era], ...LIFE[era === 'canal' ? 'rail' : 'canal']].map((n) => (
                  <button key={n} type="button" className={cn(BTN, !(LIFE[era] as readonly string[]).includes(n) && 'opacity-60')} onClick={() => lifeNow(n)}>
                    {n.replace('life-', '')}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Musique">
              <div className="flex items-center gap-2">
                <button type="button" className={BTN} onClick={() => setMusic(tuneNow() ? null : 'aucun programme : musique coupée, ou pas d’ère en jeu')}>
                  Air suivant / fin de pause
                </button>
              </div>
              {music && <p className="font-mono text-[10.5px] text-rust-400">{music}</p>}
            </Section>
            <Section title="Avis">
              <Notices game={game} />
            </Section>
            <Section title="Scénarios (cette table)">
              <Scenarios game={game} />
            </Section>
            <Section title="Flèches d’approvisionnement">
              <Supply />
            </Section>
            <Section title="Ordonnanceur du son" open>
              <SfxReadout tone="table" heard={5} />
            </Section>
          </div>
        </aside>
      )}
    </>
  );
}
