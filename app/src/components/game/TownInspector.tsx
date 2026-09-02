import { motion } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import { INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS } from '@/game/data';
import { tileKey } from '@/game/engine';
import type { GameState, Town } from '@/game/types';
import { useT } from '@/i18n';

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

/** rich town summary — slot industries, what's built, who owns what */
export function TownCardContent({ town, game }: { town: Town; game: GameState }) {
  const t = useT();
  return (
    <div>
      <div className="font-fell text-[15px] tracking-wide text-brass-400">{town.name}</div>
      <div className="my-1.5 h-px bg-brass-700/50" />
      <ul className="space-y-1.5">
        {town.slots.map((sp, si) => {
          const tile = game.tiles[tileKey(town.id, si)];
          return (
            <li key={si} className="flex items-center gap-1.5 font-sans text-[12px] leading-snug">
              {tile ? (
                <>
                  <ShapeChip color={game.players[tile.owner].color} />
                  <img src={INDUSTRY_ICON[tile.industry]} alt="" className="h-4 w-4 rounded-sm bg-cream-100/90 p-px" />
                  <span className="text-cream-100/90">
                    {INDUSTRY_LABEL[tile.industry]} L{tile.level}
                    {tile.flipped && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-copper-500 brightness-150">{t('board.tile.flipped')}</span>}
                  </span>
                  <span className="ml-auto pl-2 text-cream-100/60">{game.players[tile.owner].name}</span>
                </>
              ) : (
                <>
                  <span className="flex gap-0.5">
                    {sp.allows.map((ind) => (
                      <img key={ind} src={INDUSTRY_ICON[ind]} alt="" className="h-4 w-4 rounded-sm bg-cream-100/75 p-px opacity-80" />
                    ))}
                  </span>
                  <span className="text-cream-100/60">{sp.allows.map((a) => INDUSTRY_LABEL[a]).join(t('board.slot.or'))}</span>
                  <span className="ml-auto pl-2 text-[10px] uppercase tracking-wider text-brass-700 brightness-150">{t('board.slot.free')}</span>
                </>
              )}
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
  onZoomHere,
}: {
  town: Town;
  game: GameState;
  /** anchor position in board-frame pixels */
  x: number;
  y: number;
  frameW: number;
  frameH: number;
  onClose: () => void;
  onZoomHere: () => void;
}) {
  const t = useT();
  const W = 264;
  const EST_H = 240;
  const left = Math.min(Math.max(x, W / 2 + 8), Math.max(W / 2 + 8, frameW - W / 2 - 8));
  const below = y + 34 + EST_H <= frameH || y - 34 - EST_H < 0;
  return (
    <div
      className="absolute z-30"
      style={
        below
          ? { width: W, left, top: y + 34, transform: 'translateX(-50%)' }
          : { width: W, left, top: y - 30, transform: 'translate(-50%, -100%)' }
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.97 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="plate relative p-3 shadow-e4"
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
      <div className="mt-2.5 flex justify-end border-t border-brass-700/40 pt-2">
        <button
          type="button"
          onClick={onZoomHere}
          className="btn-ledger flex !min-h-[30px] items-center gap-1.5 !px-3 !py-1 text-[11px]"
        >
          <ZoomIn className="h-3.5 w-3.5" />
          {t('board.inspector.zoomHere')}
        </button>
      </div>
      </motion.div>
    </div>
  );
}
