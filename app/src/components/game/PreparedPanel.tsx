import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Binoculars, DraftingCompass, Eye, EyeOff, Hammer, Landmark, Route, Scale, SkipForward, X } from 'lucide-react';
import { INDUSTRY_COLOR } from './townChrome';
import { INDUSTRY_ICON, TOWNS } from '@/game/data';
import { applyAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { cardLabel, describeAction, describeUnless, projectQueued, useGame } from '@/game/store';
import type { Unless } from '@/game/store';
import { townColor } from '@/game/townColors';
import type { Card } from '@/game/types';
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
    <span className="relative flex h-[46px] w-[34px] shrink-0 flex-col items-center justify-end overflow-hidden rounded-[3px] border border-[#2A241C]/60 bg-[linear-gradient(165deg,#F2E8CE,#E7D8B2_55%,#D9C491)] pb-0.5 shadow-[0_1px_2px_rgba(0,0,0,.4)]" title={cardLabel(card)}>
      <span aria-hidden className="absolute bottom-[3px] left-[2px] top-[3px] w-[2px] rounded-full" style={{ backgroundColor: stripe }} />
      {industry ? <img src={INDUSTRY_ICON[industry]} alt="" className="mb-1 h-4 w-4" /> : <span className="mb-1 font-fell text-[13px] font-bold text-[#2A241C]">{cardLabel(card).slice(0, 1)}</span>}
      <span className="w-full truncate px-1 text-center font-fell text-[6.5px] uppercase leading-none text-[#2A241C]">{cardLabel(card)}</span>
    </span>
  );
}

/** the small form behind "unless…": that player, that deed, there or anywhere */
function UnlessEditor({ at, players, value, onChange, onClose }: { at: { x: number; y: number }; players: { idx: number; name: string }[]; value: Unless | null; onChange: (u: Unless | null) => void; onClose: () => void }) {
  const t = useT();
  const [player, setPlayer] = useState<number>(value?.player ?? players[0]?.idx ?? 0);
  const [kind, setKind] = useState<Unless['kind']>(value?.kind ?? 'build');
  const [town, setTown] = useState<string>(value?.town ?? '');
  const sel = 'rounded-sm border border-brass-700/60 bg-coal-950 px-1 py-0.5 font-sans text-[11px] text-cream-100';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-label={t('game.topbar.unlessTitle')} className="plaque fixed z-[90] flex w-[300px] flex-col gap-1.5 rounded-md p-2 text-left shadow-e4" style={{ left: Math.min(at.x, window.innerWidth - 316), top: at.y }} onClick={(e) => e.stopPropagation()}>
      <p className="engraved-brass font-fell text-[11px] uppercase tracking-[0.12em]">{t('game.topbar.unlessTitle')}</p>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessWho')}
        <select value={player} onChange={(e) => setPlayer(Number(e.target.value))} className={sel}>
          {players.map((p) => (
            <option key={p.idx} value={p.idx}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessDoes')}
        <select value={kind} onChange={(e) => setKind(e.target.value as Unless['kind'])} className={sel}>
          {(['build', 'sell', 'network'] as const).map((k) => (
            <option key={k} value={k}>{t(`game.topbar.unlessKind.${k}`)}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 font-sans text-[11px] text-cream-100/70">
        {t('game.topbar.unlessWhere')}
        <select value={town} onChange={(e) => setTown(e.target.value)} className={sel}>
          <option value="">{t('game.topbar.unlessAnywhere')}</option>
          {TOWNS.filter((x) => !x.farm).map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </label>
      <div className="mt-1 flex justify-end gap-1.5">
        {value && (
          <button type="button" onClick={() => { onChange(null); onClose(); }} className="btn-ledger !min-h-[26px] !px-2 !py-0.5 text-[11px]">
            {t('game.topbar.unlessNone')}
          </button>
        )}
        <button type="button" onClick={() => { onChange({ player, kind, town: town || undefined }); onClose(); }} className="btn-strike !min-h-[26px] !px-3 !py-0.5 text-[11px]">
          {t('game.topbar.unlessOk')}
        </button>
      </div>
    </div>,
    document.body,
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
  const [editing, setEditing] = useState<{ index: number; x: number; y: number } | null>(null);
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
  const others = game.players.map((x, idx) => ({ idx, name: x.name })).filter((x) => x.idx !== me);
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={t('game.prepared.title')}
      className={cn('paper pointer-events-auto fixed left-1/2 z-[66] w-[min(560px,80vw)] -translate-x-1/2 rounded-[3px] px-4 pb-3 pt-2.5 shadow-e3', previewQueue && 'ring-2 ring-brass-400')}
      style={{ top: insets.top + 92 }}
    >
      <div className="flex items-baseline justify-between border-b border-ink-900/35 pb-1">
        <p className="font-display text-[13px] font-black uppercase tracking-[0.14em] text-ink-900">{t('game.prepared.title')}</p>
        <p className="font-fell text-[10.5px] italic text-ink-900/60">{t('game.prepared.note')}</p>
      </div>
      <ol className="mt-2 flex flex-col gap-1.5">
        {rows.map(({ q, i, cost, card, holds, why }) => {
          const Icon = VERB_ICON[q.action.kind] ?? Hammer;
          return (
            <li key={i} className={cn('flex items-center gap-2.5 rounded-sm border px-2 py-1.5', holds ? 'border-ink-900/25 bg-ink-900/5' : 'border-rust-500/60 bg-rust-500/10')}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#8A6B33] bg-[#C9A45C] font-fell text-[13px] font-bold text-[#2A241C] shadow-[0_1px_2px_rgba(0,0,0,.4)]">{i + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-ink-900/70" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-fell text-[14px] text-ink-900">{describeAction(q.action)}</span>
                <span className="flex flex-wrap items-center gap-1.5 font-sans text-[10.5px] text-ink-900/65">
                  {cost !== null && <span className="font-mono">{t('game.prepared.cost', { n: cost })}</span>}
                  {!holds && <span className="text-rust-500 brightness-75">{t('game.prepared.wontHold', { why: why ?? '' })}</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setEditing((o) => (o?.index === i ? null : { index: i, x: r.left, y: r.bottom + 6 }));
                    }}
                    aria-expanded={editing?.index === i}
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
              {editing?.index === i && <UnlessEditor at={editing} players={others} value={q.unless ?? null} onChange={(u) => setUnless(i, u)} onClose={() => setEditing(null)} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-sans text-[10.5px] text-ink-900/60">
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
      <AnimatePresence>{null}</AnimatePresence>
    </motion.section>
  );
}
