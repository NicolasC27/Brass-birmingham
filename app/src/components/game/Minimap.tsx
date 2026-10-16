import type React from 'react';
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2 } from 'lucide-react';
import { screenToWorld, WORLD_H, WORLD_W } from './boardView';
import type { View } from './boardView';
import { activeBoard, LINKS, MERCHANTS, MERCHANT_BY_ID, PLAYER_COLORS, TOWNS, TOWN_BY_ID } from '@/game/data';
import { merchantOpen } from '@/game/engine';
import { tileKey } from '@/game/engine';
import type { GameState } from '@/game/types';
import { MM_MAX_W, MM_MIN_W, MM_W_FOR, mapUrls, minimapWidth, setBoardOption, useBoardOptions } from './boardOptions';
import { useHudInsets } from './useHudInsets';
import { useT } from '@/i18n';
import { ShapeChip } from './TownInspector';

/* ------------------------------------------------------------------ */
/* Minimap — small engraved coal plate (bottom-right) showing the      */
/* whole map, the current viewport in brass, and click/drag to move.   */
/* Resizable (S/M/L) via the corner button or the settings panel;      */
/* empty towns are GREY dots; a held town wears its owner's shape.     */
/* ------------------------------------------------------------------ */


/** exported so HUD chips can dodge the minimap when it grows */
export const MM_H_FOR = {
  s: Math.round((MM_W_FOR.s * WORLD_H) / WORLD_W),
  m: Math.round((MM_W_FOR.m * WORLD_H) / WORLD_W),
  l: Math.round((MM_W_FOR.l * WORLD_H) / WORLD_W),
} as const;
const SIZE_ORDER = ['s', 'm', 'l'] as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function Minimap({
  view,
  container,
  onCenter,
  era,
  game, frameRef }: {
  view: View;
  container: { w: number; h: number };
  onCenter: (wx: number, wy: number) => void;
  era: 'canal' | 'rail';
  game: GameState;
  /** the viewport rectangle, moved every frame by the board's ticker between camera commits */
  frameRef?: React.Ref<HTMLDivElement>;
}) {
  const plate = useRef<HTMLDivElement>(null);
  const tracking = useRef(false);
  const boardOpts = useBoardOptions();
  const { minimapSize } = boardOpts;
  const maps = mapUrls(activeBoard().id);
  const insets = useHudInsets();
  const t = useT();
  const MM_W = minimapWidth(boardOpts);
  const resizing = useRef<{ x: number; w: number } | null>(null);
  const MM_H = Math.round((MM_W * WORLD_H) / WORLD_W);
  /* possession marks grow with the plate: 6 / 7 / 9 px, never under 6 */
  const DOT = MM_W < 260 ? 6 : MM_W < 420 ? 7 : 9;

  // visible world rect → minimap fractions
  const [x0, y0] = screenToWorld(0, 0, view, container.w, container.h);
  const [x1, y1] = screenToWorld(container.w, container.h, view, container.w, container.h);
  const fx0 = clamp01(x0 / WORLD_W);
  const fy0 = clamp01(y0 / WORLD_H);
  const fx1 = clamp01(x1 / WORLD_W);
  const fy1 = clamp01(y1 / WORLD_H);

  const jump = (e: ReactPointerEvent) => {
    const el = plate.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const wx = clamp01((e.clientX - r.left) / r.width) * WORLD_W;
    const wy = clamp01((e.clientY - r.top) / r.height) * WORLD_H;
    onCenter(wx, wy);
  };

  return (
    <div
      ref={plate}
      data-minimap
      role="presentation"
      /* sits just above the income track that runs along the bottom */
      className="fixed z-[62] cursor-crosshair touch-none overflow-hidden rounded border border-brass-700/80 bg-coal-900/85 shadow-e3"
      style={{ width: MM_W, height: MM_H, bottom: insets.bottom, right: insets.right }}
      onPointerDown={(e) => {
        e.stopPropagation();
        tracking.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => {
        if (!tracking.current) return;
        e.stopPropagation();
        jump(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        tracking.current = false;
      }}
      onPointerCancel={() => {
        tracking.current = false;
      }}
    >
      <img
        src={maps.canal}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-[1500ms] ease-in-out"
        style={{ opacity: era === 'canal' ? 0.9 : 0 }}
      />
      <img
        src={maps.rail}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-[1500ms] ease-in-out"
        style={{ opacity: era === 'rail' ? 0.9 : 0 }}
      />
      {/* soot wash so the viewport reads on the dark art */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-coal-950/15" />
      {/* built links: one plain stroke per link in its owner's vivid
          colour on a dark casing, so the shape of every network reads at
          a glance; the towns' shapes tell the owner without the colour */}
      <svg aria-hidden className="pointer-events-none absolute inset-0" width={MM_W} height={MM_H} viewBox={`0 0 ${MM_W} ${MM_H}`}>
        {LINKS.map((def) => {
          const built = game.links[def.id];
          if (!built) return null;
          const a = TOWN_BY_ID[def.a] ?? MERCHANT_BY_ID[def.a];
          const b = TOWN_BY_ID[def.b] ?? MERCHANT_BY_ID[def.b];
          if (!a || !b) return null;
          const color = PLAYER_COLORS[game.players[built.owner].color]?.vivid ?? '#C9A45C';
          const sw = MM_W < 260 ? 2 : MM_W < 420 ? 2.5 : 3.5;
          return (
            <g key={def.id}>
              <line x1={(a.x / WORLD_W) * MM_W} y1={(a.y / WORLD_H) * MM_H} x2={(b.x / WORLD_W) * MM_W} y2={(b.y / WORLD_H) * MM_H} stroke="#100D0B" strokeWidth={sw + 2} strokeOpacity={0.8} strokeLinecap="round" />
              <line x1={(a.x / WORLD_W) * MM_W} y1={(a.y / WORLD_H) * MM_H} x2={(b.x / WORLD_W) * MM_W} y2={(b.y / WORLD_H) * MM_H} stroke={color} strokeWidth={sw} strokeLinecap="round" />
            </g>
          );
        })}
        {/* merchants: the board's own symbol — two arrows, in and out of the market */}
        {MERCHANTS.map((m) => {
          const open = merchantOpen(game, m.id);
          const r = MM_W < 260 ? 5 : MM_W < 420 ? 6.5 : 8.5;
          const cx = (m.x / WORLD_W) * MM_W;
          const cy = (m.y / WORLD_H) * MM_H;
          const a = r * 0.62;
          return (
            <g key={m.id} opacity={open ? 1 : 0.35}>
              <circle cx={cx} cy={cy} r={r + 1} fill="#100D0B" opacity={0.85} />
              <circle cx={cx} cy={cy} r={r} fill="#F2E8CE" stroke="#8A6B33" strokeWidth={0.8} />
              <path
                d={`M${cx - a},${cy - a * 0.45} h${a * 1.3} m0,0 l-${a * 0.45},-${a * 0.45} m${a * 0.45},${a * 0.45} l-${a * 0.45},${a * 0.45} M${cx + a},${cy + a * 0.45} h-${a * 1.3} m0,0 l${a * 0.45},-${a * 0.45} m-${a * 0.45},${a * 0.45} l${a * 0.45},${a * 0.45}`}
                fill="none"
                stroke="#2A241C"
                strokeWidth={Math.max(1, r * 0.22)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
      {/* possession: one mark per town — the shape of its first built
          tile's owner, in their colour; a grey dot while the town is empty */}
      {TOWNS.map((t) => {
        let owner: string | null = null;
        for (let si = 0; si < t.slots.length; si++) {
          const tile = game.tiles[tileKey(t.id, si)];
          if (tile) {
            owner = game.players[tile.owner].color;
            break;
          }
        }
        const left = (t.x / WORLD_W) * MM_W;
        const top = (t.y / WORLD_H) * MM_H;
        return owner ? (
          <span
            key={t.id}
            aria-hidden
            className="pointer-events-none absolute flex"
            style={{ left: left - DOT / 2, top: top - DOT / 2, filter: `drop-shadow(0 0 3px ${PLAYER_COLORS[owner]?.vivid ?? '#C9A45C'})` }}
          >
            <ShapeChip color={owner} size={DOT} vivid />
          </span>
        ) : (
          <span
            key={t.id}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: left - (DOT - 2) / 2,
              top: top - (DOT - 2) / 2,
              width: DOT - 2,
              height: DOT - 2,
              background: 'rgba(200,200,205,.55)',
              boxShadow: '0 0 0 1px rgba(16,13,11,.7)',
            }}
          />
        );
      })}
      {/* viewport rectangle */}
      <div
        ref={frameRef}
        aria-hidden
        className="pointer-events-none absolute border border-brass-400"
        style={{
          left: fx0 * MM_W,
          top: fy0 * MM_H,
          width: Math.max(6, (fx1 - fx0) * MM_W),
          height: Math.max(6, (fy1 - fy0) * MM_H),
          boxShadow: '0 0 0 1px rgba(16,13,11,.7), 0 0 6px rgba(201,164,92,.45)',
          background: 'rgba(201,164,92,.08)',
        }}
      />
      {/* engraved corner ticks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded border border-brass-400/25" />
      {/* the top-left corner resizes the plate by hand; a click on it
          cycles the presets (S→M→L) — neither must trigger a map jump */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('board.minimap.resizeAria')}
        title={t('board.minimap.sizeTip')}
        className="absolute left-0 top-0 z-10 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-br-sm border-b border-r border-brass-700/70 bg-coal-900/90 text-brass-400 shadow-e2 hover:bg-coal-800"
        onPointerDown={(e) => {
          e.stopPropagation();
          resizing.current = { x: e.clientX, w: MM_W };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!resizing.current) return;
          e.stopPropagation();
          /* the corner is the top-left one: dragging it leftwards widens */
          const w = Math.round(resizing.current.w + (resizing.current.x - e.clientX));
          setBoardOption('minimapWidth', Math.min(MM_MAX_W, Math.max(MM_MIN_W, w)));
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          const start = resizing.current;
          resizing.current = null;
          /* a click, not a drag: the next preset */
          if (start && Math.abs(start.x - e.clientX) < 4) {
            setBoardOption('minimapWidth', 0);
            setBoardOption('minimapSize', SIZE_ORDER[(SIZE_ORDER.indexOf(minimapSize) + 1) % SIZE_ORDER.length]);
          }
        }}
        onPointerCancel={() => {
          resizing.current = null;
        }}
      >
        <Maximize2 className="h-3 w-3" />
      </div>
    </div>
  );
}
