import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pin, PinOff, X } from 'lucide-react';
import { useGame } from '@/game/store';
import { INDUSTRIES, INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS } from '@/game/data';
import { tileKey } from '@/game/engine';
import type { GameState, Town } from '@/game/types';
import { useT } from '@/i18n';
import type { AnchorRegistry } from './boardView';
import { cn } from '@/lib/utils';
import { useLayer } from './useLayer';

/* ------------------------------------------------------------------ */
/* Town inspector — popover anchored to a town (idle clicks only,      */
/* never while a card action is being planned) plus the shared town    */
/* summary used by the hover tooltip. Esc / click-away closes it.      */
/* ------------------------------------------------------------------ */

/** tiny shape-coded player chip (design.md §8: colour + shape) */
export function ShapeChip({ color, size = 10 }: { color: string; size?: number }) {
  const c = PLAYER_COLORS[color];
  const hex = c?.hex ?? '#C9A45C';
  const shape = c?.shape ?? 'circle';
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden className="inline-block shrink-0">
      {shape === 'square' && <rect x={1} y={1} width={8} height={8} fill={hex} stroke="#100D0B" strokeWidth={0.8} />}
      {shape === 'diamond' && <path d="M5 0.6 L9.4 5 L5 9.4 L0.6 5 Z" fill={hex} stroke="#100D0B" strokeWidth={0.8} />}
      {shape === 'triangle' && <path d="M5 0.8 L9.2 8.8 L0.8 8.8 Z" fill={hex} stroke="#100D0B" strokeWidth={0.8} />}
      {shape === 'circle' && <circle cx={5} cy={5} r={4} fill={hex} stroke="#100D0B" strokeWidth={0.8} />}
    </svg>
  );
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** the town at a glance: one row per slot — the level as a stamped numeral,
 *  the works, its owner in their colour, what it still holds and whether
 *  it has paid; a free slot only whispers what it takes */
export function TownCardContent({ town, game }: { town: Town; game: GameState }) {
  const t = useT();
  const linksHere = Object.entries(game.links).filter(([id]) => id.split('--').includes(town.id));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 pr-5">
        <span className="font-fell text-[16px] tracking-wide text-brass-400">{town.name}</span>
        {linksHere.length > 0 && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-cream-100/55" title={t('board.inspector.linksTip')}>
            {linksHere.map(([id, l]) => (
              <ShapeChip key={id} color={game.players[l.owner].color} size={8} />
            ))}
            <span>{t('board.inspector.links', { n: linksHere.length })}</span>
          </span>
        )}
      </div>
      <div className="my-1.5 h-px bg-brass-700/50" />
      <ul className="space-y-1">
        {town.slots.map((sp, si) => {
          const tile = game.tiles[tileKey(town.id, si)];
          if (!tile) {
            return (
              <li key={si} className="flex items-center gap-2 rounded-sm px-1 py-1 font-sans text-[11.5px] text-cream-100/45">
                <span className="w-[26px] text-center font-fell text-[13px] text-cream-100/25">·</span>
                <span className="flex gap-0.5">
                  {sp.allows.map((ind) => (
                    <img key={ind} src={INDUSTRY_ICON[ind]} alt="" className="h-4 w-4 rounded-sm bg-cream-100/50 p-px opacity-70" />
                  ))}
                </span>
                <span className="truncate">{sp.allows.map((a) => INDUSTRY_LABEL[a]).join(t('board.slot.or'))}</span>
                <span className="ml-auto pl-2 font-mono text-[9px] uppercase tracking-wider text-brass-700 brightness-150">{t('board.slot.free')}</span>
              </li>
            );
          }
          const owner = game.players[tile.owner];
          const hex = PLAYER_COLORS[owner.color]?.hex ?? '#C9A45C';
          const lv = INDUSTRIES[tile.industry][tile.level - 1];
          const stock = tile.industry === 'brewery' ? 'beer' : tile.industry === 'iron' ? 'iron' : tile.industry === 'coal' ? 'coal' : null;
          return (
            <li key={si} className="flex items-center gap-2 rounded-sm border px-1 py-1" style={{ borderColor: `${hex}66`, background: `${hex}14` }}>
              {/* the level, stamped as on the tile */}
              <span className="flex h-[22px] w-[26px] items-center justify-center rounded-[3px] bg-ink-900/85 font-fell text-[13px] font-bold text-cream-100" aria-label={t('board.inspector.level', { level: tile.level })}>
                {ROMAN[tile.level] ?? tile.level}
              </span>
              <img src={INDUSTRY_ICON[tile.industry]} alt="" className="h-5 w-5 rounded-sm bg-cream-100/90 p-px" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-sans text-[12px] text-cream-100/90">{INDUSTRY_LABEL[tile.industry]}</span>
                <span className="flex items-center gap-1 font-fell text-[12px]" style={{ color: hex }}>
                  <ShapeChip color={owner.color} size={9} />
                  <span className="truncate">{owner.name}</span>
                </span>
              </span>
              <span className="ml-auto flex shrink-0 flex-col items-end gap-0.5 pl-2">
                {tile.flipped ? (
                  <span className="rounded-sm border border-brass-500/70 px-1 font-mono text-[9px] uppercase tracking-wider text-brass-400">{t('board.inspector.paid', { vp: lv.vp })}</span>
                ) : stock && tile.cubes > 0 ? (
                  <span className="font-mono text-[10px] text-cream-100/75">{t(`board.inspector.stock.${stock}`, { n: tile.cubes })}</span>
                ) : (
                  <span className="font-mono text-[10px] text-cream-100/45">{t('board.inspector.unsold')}</span>
                )}
                <span className="font-mono text-[9px] text-cream-100/40">{t('board.inspector.worth', { vp: lv.vp, income: lv.incomeDelta })}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function TownInspector({
  town,
  game,
  x,
  y,
  frameW,
  frameH,
  onClose,
  anchors,
}: {
  town: Town;
  game: GameState;
  /** anchor position in board-frame pixels */
  x: number;
  y: number;
  frameW: number;
  frameH: number;
  onClose: () => void;
  /** the card hangs from the town: the board's ticker moves it in the
   *  frame it moves the map, so the two stay glued */
  anchors: AnchorRegistry;
}) {
  const t = useT();
  const pinned = useGame((s) => s.pins[town.id] !== undefined);
  const note = useGame((s) => s.pins[town.id] ?? '');
  const pinTown = useGame((s) => s.pinTown);
  const setPinNote = useGame((s) => s.setPinNote);
  /* on the spike while it is open: Escape closes the card and nothing else */
  const sheet = useLayer(true, onClose);
  const W = 264;
  const EST_H = 240;
  /* where the card sits is decided once, when it opens: below or above the
     town, and how far it was nudged in from the frame's edge. After that
     it follows the town rigidly as the map pans, instead of sliding about
     to stay inside the frame. */
  const [{ below, dx }] = useState(() => {
    const left = Math.min(Math.max(x, W / 2 + 8), Math.max(W / 2 + 8, frameW - W / 2 - 8));
    return { below: y + 34 + EST_H <= frameH || y - 34 - EST_H < 0, dx: left - x };
  });
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    return anchors.register(el, { wx: town.x, wy: town.y, px: dx, py: below ? 34 : -30 });
  }, [anchors, town.x, town.y, dx, below]);
  return (
    <div
      ref={box}
      className={cn('absolute z-30', below ? '-translate-x-1/2' : '-translate-x-1/2 -translate-y-full')}
      style={{ width: W }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.97 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="plate relative p-3 shadow-e4"
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-label={t('board.inspector.ariaLabel', { name: town.name })}
      >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('board.inspector.close')}
        className="absolute right-1.5 top-1.5 rounded p-1 text-cream-100/50 hover:bg-coal-800 hover:text-cream-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <TownCardContent town={town} game={game} />
      {/* a word from the reader on this town — writing one pins the town,
          so the others' doings there are reported; the small pin alone
          watches a town without a word */}
      <div className="mt-2.5 flex items-start gap-2 border-t border-brass-700/40 pt-2">
        <textarea
          value={note}
          onChange={(e) => setPinNote(town.id, e.target.value.slice(0, 140))}
          placeholder={t('board.inspector.notePlaceholder')}
          aria-label={t('board.inspector.note')}
          rows={2}
          className="paper min-w-0 flex-1 resize-none rounded-sm px-2 py-1 font-serif text-[12px] leading-snug text-ink-900 placeholder:text-ink-900/55"
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={() => pinTown(town.id, !pinned)}
          aria-pressed={pinned}
          aria-label={t(pinned ? 'board.inspector.unpin' : 'board.inspector.pin')}
          title={t(pinned ? 'board.inspector.unpinTip' : 'board.inspector.pinTip')}
          className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors', pinned ? 'border-brass-400 bg-brass-500/20 text-brass-400' : 'border-brass-700/50 text-cream-100/50 hover:border-brass-400 hover:text-brass-400')}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>
      </motion.div>
    </div>
  );
}
