import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Binoculars, DraftingCompass, Eye, EyeOff, Hammer, Landmark, MapPin, Route, Scale, SkipForward, X } from 'lucide-react';
import { INDUSTRY_COLOR } from './townChrome';
import { INDUSTRY_ICON, MERCHANT_BY_ID, TOWNS } from '@/game/data';
import { applyAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { cardLabel, describeAction, describeUnless, lastActionOf, projectQueued, suggestUnless, useGame } from '@/game/store';
import type { Unless } from '@/game/store';
import { townColor } from '@/game/townColors';
import type { Card, GameState } from '@/game/types';
import type { ReactNode } from 'react';
import { PortraitMedallion } from './PlayerRail';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useHudInsets } from './useHudInsets';
import { keyLabel, useKeybindings } from './keybindings';

/* The orders for my turn — the moves prepared while others play, on a
   sheet under the banner: number, verb, what and where, what it costs,
   the card it spends, and the condition that would cancel it. From here
   a move is dropped, a condition set, and the board asked to show them. */

const VERB_ICON: Record<GameAction['kind'], typeof Hammer> = { build: Hammer, network: Route, develop: DraftingCompass, sell: Scale, loan: Landmark, scout: Binoculars, pass: SkipForward, concede: X, resign: X, 'begin-rail': SkipForward };

/** the card a move spends, in miniature */
function MiniCard({ card }: { card: Card }) {
  const industry = card.kind === 'industry' ? card.industry! : null;
  const stripe = industry ? INDUSTRY_COLOR[industry] : card.town ? townColor(card.town) : '#C9A45C';
  return (
    <span className="relative flex h-[42px] w-[30px] shrink-0 flex-col items-center justify-end overflow-hidden rounded-[3px] border border-[#2A241C]/70 bg-[linear-gradient(165deg,#F2E8CE,#E7D8B2_55%,#D9C491)] pb-0.5 shadow-[0_2px_3px_rgba(0,0,0,.45),inset_0_0_0_1px_rgba(138,107,51,.35)] -rotate-3" title={cardLabel(card)}>
      <span aria-hidden className="absolute bottom-[3px] left-[2px] top-[3px] w-[2px] rounded-full" style={{ backgroundColor: stripe }} />
      {industry ? <img src={INDUSTRY_ICON[industry]} alt="" className="mb-0.5 h-3.5 w-3.5" /> : <span className="mb-0.5 font-fell text-[12px] font-bold text-[#2A241C]">{cardLabel(card).slice(0, 1)}</span>}
      <span className="w-full truncate px-0.5 text-center font-fell text-[6px] uppercase leading-none text-[#2A241C]">{cardLabel(card)}</span>
    </span>
  );
}

/** a blank in the clause: a brass-framed token that opens its choices */
function Blank({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn('inline-flex h-6 items-center gap-1 rounded-sm border-b-2 border-[#8A6B33] bg-[#f7efd9] px-1.5 font-fell text-[12px] text-ink-900 shadow-[inset_0_-1px_0_rgba(138,107,51,.35)] hover:bg-[#fbf5e6]', open && 'bg-[#fbf5e6] ring-1 ring-[#8A6B33]')}
      >
        {label}
        <span aria-hidden className="text-[8px] text-ink-900/50">▾</span>
      </button>
      {open && <span className="absolute left-0 top-full z-10 mt-1 flex min-w-[150px] flex-col gap-0.5 rounded-sm border border-ink-900/40 bg-[#f7efd9] p-1 shadow-e3">{children}</span>}
    </span>
  );
}

/** the clause, written under the move as a sentence with three blanks —
 *  who, what deed, where — each a brass token opening its choices; the
 *  natural clauses for this move offered ready-made above it */
function UnlessRow({ game, action, players, value, picking, onPick, onClear, onChange, onClose }: { game: GameState; action: GameAction; players: number[]; value: Unless | null; picking: boolean; onPick: () => void; onClear: () => void; onChange: (u: Unless | null) => void; onClose: () => void }) {
  const t = useT();
  const [player, setPlayer] = useState<Unless['player']>(value?.player ?? 'any');
  const [kind, setKind] = useState<Unless['kind']>(value?.kind ?? 'build');
  const [town, setTown] = useState<string>(value?.town ?? '');
  const [blank, setBlank] = useState<'who' | 'what' | 'where' | null>(null);
  const industry = value?.industry;
  /* a place picked on the map lands in the store: the row follows */
  const picked = value?.town ?? '';
  useEffect(() => {
    setTown(picked);
  }, [picked]);
  /* while the clause is open, a click on a town or a slot fills the place */
  useEffect(() => {
    if (!picking) onPick();
    /* the row gone, the map is a map again — whatever the pick was at */
    return () => onClear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const KINDS: { kind: Unless['kind']; icon: typeof Hammer }[] = [
    { kind: 'build', icon: Hammer },
    { kind: 'sell', icon: Scale },
    { kind: 'network', icon: Route },
  ];
  /* a ready-made clause on a merchant or a very link keeps it until a town is named */
  const draft: Unless = { player, kind, town: town || undefined, industry: kind === 'build' ? industry : undefined, merchant: !town && kind === 'sell' ? value?.merchant : undefined, link: !town && kind === 'network' ? value?.link : undefined };
  const item = 'flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left font-sans text-[11px] text-ink-900 hover:bg-ink-900/10';
  const suggestions = suggestUnless(action);
  return (
    <div className="mt-1.5 rounded-[2px] border border-ink-900/40 bg-[linear-gradient(180deg,#f7efd9,#ecdfbd)] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.5)]" role="group" aria-label={t('game.topbar.unlessTitle')}>
      {suggestions.length > 0 && (
        <p className="mb-1.5 flex flex-wrap items-center gap-1 font-sans text-[10px] text-ink-900/60">
          <span className="font-fell uppercase tracking-[0.1em]">{t('game.topbar.unlessSuggest')}</span>
          {suggestions.map((sg) => (
            <button key={sg.key} type="button" onClick={() => { onChange(sg.unless); onClose(); }} className="rounded-full border border-rust-500/60 px-2 py-px font-fell text-[10.5px] text-rust-500 brightness-75 hover:bg-rust-500/10">
              {t(`game.topbar.unlessSuggestions.${sg.key}`)}
            </button>
          ))}
        </p>
      )}
      <p className="mb-1 flex items-center gap-1 font-sans text-[10px] italic text-ink-900/55">
        <MapPin className="h-3 w-3" />
        {t('game.topbar.unlessTapMap')}
      </p>
      <p className="flex flex-wrap items-center gap-1.5 font-fell text-[12px] text-ink-900">
        <span className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-rust-500 brightness-75">{t('game.topbar.unlessClause')}</span>
        <Blank label={player === 'any' ? t('game.topbar.unlessAnyone') : (game.players[player]?.name ?? '')} open={blank === 'who'} onToggle={() => setBlank((b) => (b === 'who' ? null : 'who'))}>
          <button type="button" className={item} onClick={() => { setPlayer('any'); setBlank(null); }}>{t('game.topbar.unlessAnyone')}</button>
          {players.map((idx) => (
            <button key={idx} type="button" className={item} onClick={() => { setPlayer(idx); setBlank(null); }}>
              <PortraitMedallion p={game.players[idx]} index={idx} active={false} size={18} />
              {game.players[idx].name}
            </button>
          ))}
        </Blank>
        <Blank label={kind === 'build' && industry ? t('game.topbar.unlessBuilds', { works: t(`game.log.industry.${industry}`) }) : t(`game.topbar.unlessKind.${kind}`)} open={blank === 'what'} onToggle={() => setBlank((b) => (b === 'what' ? null : 'what'))}>
          {KINDS.map(({ kind: k, icon: Icon }) => (
            <button key={k} type="button" className={item} onClick={() => { setKind(k); setBlank(null); }}>
              <Icon className="h-3 w-3" />
              {t(`game.topbar.unlessKind.${k}`)}
            </button>
          ))}
        </Blank>
        <Blank label={town ? t('game.topbar.unlessAt', { town: TOWNS.find((x) => x.id === town)?.name ?? town }).trim() : draft.merchant ? t('game.topbar.unlessTo', { merchant: MERCHANT_BY_ID[draft.merchant]?.name ?? draft.merchant }).trim() : t('game.topbar.unlessAnywhere')} open={blank === 'where'} onToggle={() => setBlank((b) => (b === 'where' ? null : 'where'))}>
          <button type="button" className={item} onClick={() => { setTown(''); setBlank(null); }}>{t('game.topbar.unlessAnywhere')}</button>
          <span className="my-0.5 h-px bg-ink-900/20" />
          <span className="flex max-h-[160px] flex-col overflow-y-auto">
            {TOWNS.filter((x) => !x.farm).map((x) => (
              <button key={x.id} type="button" className={item} onClick={() => { setTown(x.id); setBlank(null); }}>{x.name}</button>
            ))}
          </span>
        </Blank>
        <span className="ml-auto flex items-center gap-1">
          {value && (
            <button type="button" onClick={() => { onChange(null); onClose(); }} className="rounded-sm border border-ink-900/30 px-1.5 py-px font-sans text-[10px] text-ink-900/70 hover:text-ink-900">
              {t('game.topbar.unlessNone')}
            </button>
          )}
          <button type="button" onClick={() => { onChange(draft); onClose(); }} className="wax-seal font-sans text-[10px] font-bold uppercase tracking-wider hover:brightness-110">
            {t('game.topbar.unlessOk')}
          </button>
        </span>
      </p>
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
  const keys = useKeybindings();
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const unlessPick = useGame((s) => s.unlessPick);
  const surveySeat = useGame((s) => s.surveySeat);
  const setSurveySeat = useGame((s) => s.setSurveySeat);
  const cycleSurveySeat = useGame((s) => s.cycleSurveySeat);
  const surveyEmpires = useGame((s) => s.surveyEmpires);
  const toggleSurveyEmpire = useGame((s) => s.toggleSurveyEmpire);
  const beginUnlessPick = useGame((s) => s.beginUnlessPick);
  /* the sheet unfolds under the pointer, while a move is prepared, a
     condition edited or a place picked; otherwise a strip says the orders */
  const unfolded = open || preparing || editing !== null || unlessPick !== null;
  /* the sheet lies bottom-left, above the income track and clear of the
     hand, and grows upward when it unfolds: the map's heart stays free */
  const insets = useHudInsets();
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
  /* another seat's last move: its own ribbon */
  if (game && surveySeat !== null) {
    const p = game.players[surveySeat];
    const last = lastActionOf(game, surveySeat);
    const action = last >= 0 ? game.actions[last] : undefined;
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[66] flex justify-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} role="status" aria-label={t('game.prepared.lastMoveOf', { name: p?.name ?? '' })} className="plaque pointer-events-auto flex max-w-[96vw] items-center gap-3 whitespace-nowrap rounded-md px-4 py-1.5">
          {p && <PortraitMedallion p={p} index={surveySeat} active={false} size={24} />}
          <span className="engraved-brass font-fell text-[12px] uppercase tracking-[0.18em]">{t('game.prepared.lastMoveOf', { name: p?.name ?? '' })}</span>
          <span aria-hidden className="h-4 w-px bg-brass-700/60" />
          <span className="font-fell text-[13px] text-cream-100/90">{action ? describeAction(action) : t('game.prepared.noMoveYet')}</span>
          <span aria-hidden className="h-4 w-px bg-brass-700/60" />
          <span aria-hidden className="h-4 w-px bg-brass-700/60" />
          <span className="flex items-center gap-1" role="group" aria-label={t('game.prepared.othersLinks')}>
            <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-cream-100/55">{t('game.prepared.othersLinks')}</span>
            {game.players.map((pl, idx) => idx === surveySeat ? null : (
              <button key={idx} type="button" aria-pressed={surveyEmpires.includes(idx)} title={pl.name} onClick={() => toggleSurveyEmpire(idx)} className={cn('rounded-full transition-opacity', surveyEmpires.includes(idx) ? 'opacity-100 ring-2 ring-brass-400' : 'opacity-40 hover:opacity-80')}>
                <PortraitMedallion p={pl} index={idx} active={false} size={20} />
              </button>
            ))}
          </span>
          <button type="button" onClick={cycleSurveySeat} className="btn-ledger shrink-0 !min-h-[24px] !px-2 !py-0.5 text-[10.5px]">
            {t('game.prepared.nextPlayer')} <kbd className="ml-1 font-mono text-[9px] opacity-60">{keyLabel(keys.lastMove)}</kbd>
          </button>
          <button type="button" onClick={() => setSurveySeat(null)} className="btn-ledger shrink-0 !min-h-[24px] !px-2 !py-0.5 text-[10.5px]">
            {t('game.prepared.visualising')}
          </button>
        </motion.div>
      </div>
    );
  }
  if (!game || me < 0 || (!queued.length && !preparing && !previewQueue)) return null;
  const others = game.players.map((_, idx) => idx).filter((idx) => idx !== me);
  /* the orders on the board: one dark ribbon across the top says them, nothing else */
  if (previewQueue) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[66] flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        role="status"
        aria-label={t('game.prepared.title')}
        className="plaque pointer-events-auto flex max-w-[96vw] items-center gap-3 whitespace-nowrap rounded-md px-4 py-1.5"
      >
        <span className="engraved-brass font-fell text-[12px] uppercase tracking-[0.18em]">{t(rows.length ? 'game.prepared.survey' : 'game.prepared.surveyEmpire')}</span>
        <span aria-hidden className="h-4 w-px bg-brass-700/60" />
        {!rows.length && (
          <span className="font-fell text-[12.5px] text-cream-100/90">
            {t('game.prepared.surveyCounts', { tiles: Object.values(game.tiles).filter((x) => x.owner === me).length, links: Object.values(game.links).filter((l) => l.owner === me).length, pending: Object.values(game.tiles).filter((x) => x.owner === me && !x.flipped).length })}
          </span>
        )}
        {rows.map(({ q, i, holds }) => (
          <span key={i} className="flex shrink-0 items-center gap-1.5 font-fell text-[12.5px] text-cream-100/90">
            <span className={cn('brass-roundel h-5 w-5 shrink-0 text-[11px] font-bold', !holds && 'opacity-50')}>{i + 1}</span>
            <span>{describeAction(q.action)}</span>
            {q.unless && <span className="wax-seal font-fell text-[10px]">{describeUnless(q.unless, game)}</span>}
          </span>
        ))}
        <span aria-hidden className="h-4 w-px bg-brass-700/60" />
        <span className="flex items-center gap-1" role="group" aria-label={t('game.prepared.othersLinks')}>
          <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-cream-100/55">{t('game.prepared.othersLinks')}</span>
          {game.players.map((pl, idx) => idx === me ? null : (
            <button key={idx} type="button" aria-pressed={surveyEmpires.includes(idx)} title={pl.name} onClick={() => toggleSurveyEmpire(idx)} className={cn('rounded-full transition-opacity', surveyEmpires.includes(idx) ? 'opacity-100 ring-2 ring-brass-400' : 'opacity-40 hover:opacity-80')}>
              <PortraitMedallion p={pl} index={idx} active={false} size={20} />
            </button>
          ))}
        </span>
        <span className="hidden font-sans text-[10px] text-cream-100/55 2xl:inline">{t('game.prepared.legend')}</span>
        <button type="button" onClick={() => setPreviewQueue(false)} className="btn-ledger shrink-0 !min-h-[24px] !px-2 !py-0.5 text-[10.5px]">
          {t('game.prepared.visualising')}
        </button>
      </motion.div>
      </div>
    );
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={t('game.prepared.title')}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      className={cn('dispatch pointer-events-auto fixed z-[66]', unfolded ? 'w-[400px] px-4 pb-2.5 pt-2.5' : 'w-auto max-w-[520px] px-3 py-1')}
      style={{ bottom: insets.bottom + 10, left: insets.left }}
    >
      {!unfolded && (
        <div className="flex items-center gap-2">
          <span className="font-display text-[9px] font-black uppercase tracking-[0.16em] text-ink-900/70">{t('game.prepared.short')}</span>
          {rows.map(({ q, i, holds }) => (
            <span key={i} className="flex items-center gap-1 font-fell text-[12px] text-ink-900" title={describeAction(q.action)}>
              <span className={cn('brass-roundel h-4 w-4 text-[9px] font-bold', !holds && 'opacity-50')}>{i + 1}</span>
              <span className="max-w-[150px] truncate">{describeAction(q.action)}</span>
              {q.unless && <span className="wax-seal h-3.5 w-3.5 !p-0" aria-label={describeUnless(q.unless, game)} title={describeUnless(q.unless, game)} />}
            </span>
          ))}
          {!myTurn && queued.length < 2 && game.phase === 'action' && (
            <button type="button" onClick={() => setPreparing(true)} className="brass-roundel h-4 w-4 text-[11px] font-bold leading-none" title={t('game.hand.prepare')} aria-label={t('game.hand.prepare')}>+</button>
          )}
        </div>
      )}
      {unfolded && (<>
      <div className="relative border-b border-ink-900/50 pb-1 pr-16 text-center">
        <p className="whitespace-nowrap font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-900">
          <span aria-hidden className="mr-2 text-[8px] text-ink-900/50">◆</span>
          {t('game.prepared.title')}
          <span aria-hidden className="ml-2 text-[8px] text-ink-900/50">◆</span>
        </p>
        <p className="font-fell text-[9.5px] italic text-ink-900/60">{t('game.prepared.note')}</p>
        {rows.length > 0 && rows.every((r) => r.holds) && <span className="ink-stamp absolute right-0 top-0 font-sans text-[9px]">{t('game.prepared.stampReady')}</span>}
      </div>
      <ol className="mt-1.5 flex flex-col gap-1">
        {rows.map(({ q, i, cost, card, holds, why }) => {
          const Icon = VERB_ICON[q.action.kind] ?? Hammer;
          return (
            <li key={i} className={cn('relative rounded-[2px] border-b border-dashed border-ink-900/30 px-1 py-1.5 last:border-b-0', !holds && 'bg-rust-500/10')}>
              {!holds && <span className="ink-stamp absolute right-8 top-1 font-sans text-[8px]">{t('game.prepared.stampVoid')}</span>}
              <div className="flex items-center gap-2">
              <span className="brass-roundel h-6 w-6 shrink-0 font-fell text-[12px] font-bold">{i + 1}</span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-900/50 text-ink-900/75">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-fell text-[13px] text-ink-900">{describeAction(q.action)}</span>
                <span className="flex flex-wrap items-center gap-1.5 font-sans text-[10px] text-ink-900/65">
                  {cost !== null && <span className="rounded-sm border border-ink-900/30 px-1 font-mono text-[9.5px]">{t('game.prepared.cost', { n: cost })}</span>}
                  {!holds && <span className="text-rust-500 brightness-75">{t('game.prepared.wontHold', { why: why ?? '' })}</span>}
                  <button
                    type="button"
                    onClick={() => setEditing((o) => (o === i ? null : i))}
                    aria-expanded={editing === i}
                    className={cn(q.unless ? 'wax-seal font-fell text-[10px] tracking-wide' : 'rounded-sm border border-dashed border-ink-900/40 px-1.5 py-px font-sans text-[10px] text-ink-900/70 hover:border-ink-900 hover:text-ink-900')}
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
              {editing === i && <UnlessRow game={game} action={q.action} players={others} value={q.unless ?? null} picking={unlessPick === i} onPick={() => beginUnlessPick(unlessPick === i ? null : i)} onClear={() => beginUnlessPick(null)} onChange={(u) => setUnless(i, u)} onClose={() => { setEditing(null); beginUnlessPick(null); }} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-sans text-[10px] text-ink-900/60">
          {preparing ? t('game.prepared.preparingHint') : ''}
        </span>
        <span className="flex items-center gap-1.5">
          {queued.length > 0 && (
            <button type="button" onClick={() => setPreviewQueue(!previewQueue)} aria-pressed={previewQueue} title={`${t('game.prepared.visualise')} (${keyLabel(keys.survey)})`} className={cn('flex h-7 items-center gap-1.5 rounded-sm border border-[#8A6B33] bg-[linear-gradient(180deg,#e8c47a,#b58d3c)] px-2.5 font-sans text-[10.5px] font-bold uppercase tracking-wider text-[#2A241C] shadow-[inset_0_1px_0_rgba(255,244,214,.6),0_1px_2px_rgba(0,0,0,.45)] hover:brightness-110', previewQueue && 'ring-2 ring-rust-500/70')}>
              {previewQueue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {t(previewQueue ? 'game.prepared.visualising' : 'game.prepared.visualise')}
              <kbd className="ml-0.5 rounded-sm border border-[#2A241C]/40 px-1 font-mono text-[9px] normal-case tracking-normal opacity-70">{keyLabel(keys.survey)}</kbd>
            </button>
          )}
          {!myTurn && !preparing && queued.length < 2 && game.phase === 'action' && (
            <button type="button" onClick={() => setPreparing(true)} className="flex h-7 items-center gap-1.5 rounded-sm border border-ink-900/60 bg-ink-900 px-2.5 font-sans text-[10.5px] font-bold uppercase tracking-wider text-cream-100 shadow-[0_1px_2px_rgba(0,0,0,.45)] hover:bg-coal-800">
              {t('game.hand.prepare')}
            </button>
          )}
        </span>
      </div>
      </>)}
    </motion.section>
  );
}
