import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Binoculars, DraftingCompass, Eye, EyeOff, Hammer, Landmark, Route, Scale, SkipForward, X } from 'lucide-react';
import { INDUSTRY_COLOR } from './townChrome';
import { INDUSTRY_ICON, TOWNS } from '@/game/data';
import { applyAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { cardLabel, describeAction, describeUnless, projectQueued, useGame } from '@/game/store';
import type { Unless } from '@/game/store';
import { townColor } from '@/game/townColors';
import type { Card, GameState } from '@/game/types';
import { PortraitMedallion } from './PlayerRail';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useHudInsets } from './useHudInsets';

/* The orders for my turn — the moves prepared while others play, on a
   sheet under the banner: number, verb, what and where, what it costs,
   the card it spends, and the condition that would cancel it. From here
   a move is dropped, a condition set, and the board asked to show them. */

const VERB_ICON: Record<GameAction['kind'], typeof Hammer> = { build: Hammer, network: Route, develop: DraftingCompass, sell: Scale, loan: Landmark, scout: Binoculars, pass: SkipForward, concede: X, 'begin-rail': SkipForward };

/** the card a move spends, in miniature */
function MiniCard({ card }: { card: Card }) {
  const industry = card.kind === 'industry' ? card.industry! : null;
  const stripe = industry ? INDUSTRY_COLOR[industry] : card.town ? townColor(card.town) : '#C9A45C';
  return (
    <span className="relative flex h-[38px] w-[28px] shrink-0 flex-col items-center justify-end overflow-hidden rounded-[3px] border border-[#2A241C]/60 bg-[linear-gradient(165deg,#F2E8CE,#E7D8B2_55%,#D9C491)] pb-0.5 shadow-[0_1px_2px_rgba(0,0,0,.4)]" title={cardLabel(card)}>
      <span aria-hidden className="absolute bottom-[3px] left-[2px] top-[3px] w-[2px] rounded-full" style={{ backgroundColor: stripe }} />
      {industry ? <img src={INDUSTRY_ICON[industry]} alt="" className="mb-0.5 h-3.5 w-3.5" /> : <span className="mb-0.5 font-fell text-[12px] font-bold text-[#2A241C]">{cardLabel(card).slice(0, 1)}</span>}
      <span className="w-full truncate px-0.5 text-center font-fell text-[6px] uppercase leading-none text-[#2A241C]">{cardLabel(card)}</span>
    </span>
  );
}

/** the condition, set in place under the move: the player by portrait,
 *  the deed by icon, the place by name or anywhere */
function UnlessRow({ game, players, value, onChange, onClose }: { game: GameState; players: number[]; value: Unless | null; onChange: (u: Unless | null) => void; onClose: () => void }) {
  const t = useT();
  const [player, setPlayer] = useState<number>(value?.player ?? players[0] ?? 0);
  const [kind, setKind] = useState<Unless['kind']>(value?.kind ?? 'build');
  const [town, setTown] = useState<string>(value?.town ?? '');
  const KINDS: { kind: Unless['kind']; icon: typeof Hammer }[] = [
    { kind: 'build', icon: Hammer },
    { kind: 'sell', icon: Scale },
    { kind: 'network', icon: Route },
  ];
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-sm border border-ink-900/25 bg-[#EFE4C6] px-2 py-1.5" role="group" aria-label={t('game.topbar.unlessTitle')}>
      <span className="font-fell text-[11px] uppercase tracking-[0.1em] text-ink-900/70">{t('game.topbar.unlessLead')}</span>
      <span className="flex items-center gap-1">
        {players.map((idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPlayer(idx)}
            aria-pressed={player === idx}
            title={game.players[idx].name}
            aria-label={game.players[idx].name}
            className={cn('rounded-full p-[2px] transition-transform', player === idx ? 'scale-110 ring-2 ring-rust-500' : 'opacity-60 hover:opacity-100')}
          >
            <PortraitMedallion p={game.players[idx]} index={idx} active={false} size={22} />
          </button>
        ))}
      </span>
      <span className="flex items-center gap-1">
        {KINDS.map(({ kind: k, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            title={t(`game.topbar.unlessKind.${k}`)}
            aria-label={t(`game.topbar.unlessKind.${k}`)}
            className={cn('flex h-6 items-center gap-1 rounded-sm border px-1.5 font-sans text-[10.5px]', kind === k ? 'border-rust-500 bg-rust-500/15 text-ink-900' : 'border-ink-900/30 text-ink-900/60 hover:text-ink-900')}
          >
            <Icon className="h-3 w-3" />
            {t(`game.topbar.unlessKind.${k}`)}
          </button>
        ))}
      </span>
      <select value={town} onChange={(e) => setTown(e.target.value)} aria-label={t('game.topbar.unlessWhere')} className="h-6 rounded-sm border border-ink-900/30 bg-[#F7EFD9] px-1 font-sans text-[10.5px] text-ink-900">
        <option value="">{t('game.topbar.unlessAnywhere')}</option>
        {TOWNS.filter((x) => !x.farm).map((x) => (
          <option key={x.id} value={x.id}>{x.name}</option>
        ))}
      </select>
      <span className="ml-auto flex items-center gap-1">
        {value && (
          <button type="button" onClick={() => { onChange(null); onClose(); }} className="rounded-sm border border-ink-900/30 px-1.5 py-px font-sans text-[10.5px] text-ink-900/70 hover:text-ink-900">
            {t('game.topbar.unlessNone')}
          </button>
        )}
        <button type="button" onClick={() => { onChange({ player, kind, town: town || undefined }); onClose(); }} className="rounded-sm border border-[#8A6B33] bg-[#C9A45C] px-2 py-px font-sans text-[10.5px] font-bold text-[#2A241C] hover:brightness-110">
          {t('game.topbar.unlessOk')}
        </button>
      </span>
    </div>
  );
}

export default function PreparedPanel() {
  const t = useT();
  const game = useGame((s) => s.game);
  const seat = useGame((s) => s.seat);
  const queued = useGame((s) => s.queued);
  const preparing = useGame((s) => s.preparing);
  const previewQueue = useGame((s) => s.previewQueue);
  const setPreviewQueue = useGame((s) => s.setPreviewQueue);
  const setPreparing = useGame((s) => s.setPreparing);
  const dropQueued = useGame((s) => s.dropQueued);
  const setUnless = useGame((s) => s.setUnless);
  const myTurn = useGame((s) => s.myTurn());
  const insets = useHudInsets();
  const [editing, setEditing] = useState<number | null>(null);
  /* the sheet stands where the banner does: right of the rail */
  const [left, setLeft] = useState(360);
  useEffect(() => {
    const place = () => setLeft((document.querySelector('[data-player-rail]')?.getBoundingClientRect().right ?? 340) + 14);
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);
  const me = game ? (seat ?? game.players.findIndex((p) => !p.isBot)) : -1;
  /* each move costed on the table it will find: the one the previous moves leave */
  const rows = useMemo(() => {
    if (!game || me < 0) return [];
    return queued.map((q, i) => {
      const before = projectQueued(game, me, queued.slice(0, i));
      const r = applyAction(before, me, q.action);
      const cost = r.state ? before.players[me].money - r.state.players[me].money : null;
      const a = q.action;
      const cardId = 'card' in a ? a.card : undefined;
      const card = cardId ? game.players[me].hand.find((c) => c.id === cardId) : undefined;
      return { q, i, cost, card, holds: !!r.state, why: r.error };
    });
  }, [game, me, queued]);
  if (!game || me < 0 || (!queued.length && !preparing)) return null;
  const others = game.players.map((_, idx) => idx).filter((idx) => idx !== me);
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={t('game.prepared.title')}
      className={cn('paper pointer-events-auto fixed z-[66] w-[400px] rounded-[3px] px-3 pb-2 pt-2 shadow-e3', previewQueue && 'ring-2 ring-brass-400')}
      style={{ top: insets.top + 88, left }}
    >
      <div className="flex items-baseline justify-between border-b border-ink-900/35 pb-0.5">
        <p className="font-display text-[11px] font-black uppercase tracking-[0.14em] text-ink-900">{t('game.prepared.title')}</p>
        <p className="font-fell text-[9.5px] italic text-ink-900/60">{t('game.prepared.note')}</p>
      </div>
      <ol className="mt-1.5 flex flex-col gap-1">
        {rows.map(({ q, i, cost, card, holds, why }) => {
          const Icon = VERB_ICON[q.action.kind] ?? Hammer;
          return (
            <li key={i} className={cn('rounded-sm border px-1.5 py-1', holds ? 'border-ink-900/25 bg-ink-900/5' : 'border-rust-500/60 bg-rust-500/10')}>
              <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#8A6B33] bg-[#C9A45C] font-fell text-[11px] font-bold text-[#2A241C] shadow-[0_1px_2px_rgba(0,0,0,.4)]">{i + 1}</span>
              <Icon className="h-3.5 w-3.5 shrink-0 text-ink-900/70" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-fell text-[12.5px] text-ink-900">{describeAction(q.action)}</span>
                <span className="flex flex-wrap items-center gap-1.5 font-sans text-[10px] text-ink-900/65">
                  {cost !== null && <span className="font-mono">{t('game.prepared.cost', { n: cost })}</span>}
                  {!holds && <span className="text-rust-500 brightness-75">{t('game.prepared.wontHold', { why: why ?? '' })}</span>}
                  <button
                    type="button"
                    onClick={() => setEditing((o) => (o === i ? null : i))}
                    aria-expanded={editing === i}
                    className={cn('rounded-sm border px-1.5 py-px font-sans text-[10px]', q.unless ? 'border-rust-500 bg-rust-500/15 font-semibold text-rust-500 brightness-75' : 'border-ink-900/35 text-ink-900/70 hover:border-ink-900')}
                  >
                    {q.unless ? describeUnless(q.unless, game) : t('game.topbar.unlessAdd')}
                  </button>
                </span>
              </span>
              {card && <MiniCard card={card} />}
              <button type="button" onClick={() => dropQueued(i)} aria-label={t('game.topbar.queueDrop')} title={t('game.topbar.queueDrop')} className="rounded-sm p-0.5 text-ink-900/45 hover:bg-ink-900/10 hover:text-rust-500">
                <X className="h-3.5 w-3.5" />
              </button>
              </div>
              {editing === i && <UnlessRow game={game} players={others} value={q.unless ?? null} onChange={(u) => setUnless(i, u)} onClose={() => setEditing(null)} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-sans text-[10px] text-ink-900/60">
          {preparing ? t('game.prepared.preparingHint') : previewQueue ? t('game.prepared.legend') : ''}
        </span>
        <span className="flex items-center gap-1.5">
          {queued.length > 0 && (
            <button type="button" onClick={() => setPreviewQueue(!previewQueue)} aria-pressed={previewQueue} className={cn('btn-ledger flex !min-h-[28px] items-center gap-1.5 !px-2.5 !py-0.5 text-[11px]', previewQueue && '!border-brass-400 !text-brass-400')}>
              {previewQueue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {t(previewQueue ? 'game.prepared.visualising' : 'game.prepared.visualise')}
            </button>
          )}
          {!myTurn && !preparing && queued.length < 2 && game.phase === 'action' && (
            <button type="button" onClick={() => setPreparing(true)} className="btn-strike !min-h-[28px] !px-3 !py-0.5 text-[11px]">
              {t('game.hand.prepare')}
            </button>
          )}
        </span>
      </div>
    </motion.section>
  );
}
