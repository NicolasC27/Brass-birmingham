import { INDUSTRIES, INDUSTRY_ICON, INDUSTRY_LABEL, PLAYER_COLORS } from '@/game/data';
import { tileKey } from '@/game/engine';
import type { BuildTarget, SellTarget } from '@/game/engine';
import type { GameState, IndustryType, Town } from '@/game/types';
import { DETAIL_FADE, INDUSTRY_COLOR, INDUSTRY_RING, RIBBON_FONT, RIBBON_H, SCHEMATIC_DETAIL_FADE, SCHEMATIC_SHOW, TILE, TILE_HALF, TILE_ART, ribbonWidth, townChrome } from './townChrome';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { ReactNode } from 'react';

const H = TILE_HALF;

/** alternating physical rotations so tiles look hand-placed */
const SLOT_ROT = [-2.2, 1.6, -1.4, 2.1];

/* ------------------------------------------------------------------ */
/* TownNode — map-v5 town anatomy (official Brass: Birmingham Steam    */
/* reference): ONE compact physical unit per town — slot tiles in a    */
/* tight grid (6px gap) sitting directly on top of the dark ribbon     */
/* bearing the town name in serif caps, with a small painted village   */
/* grounding the unit on the terrain. The whole cluster (tiles +       */
/* ribbon + village) is glued together: collision nudges and the ±1.5° */
/* organic rotation always apply to the unit as a whole.               */
/*                                                                     */
/* Interaction contract (unchanged from map-v3): slots stay the build  */
/* targets (same hover/click/pick-cycle handlers, ghost anchor at the  */
/* slot centre, valid-target pulse, invalid shake, sell picking, town  */
/* inspector on idle click). Slots are addressed by tileKey(town, si)  */
/* exactly as before; only their DISPLAY positions moved from the old  */
/* scattered sockets to the compact grid (townChrome.ts).              */
/*                                                                     */
/* Ribbons render in a FINAL pass above all towns (TownRibbons) so     */
/* every name stays legible; they carry the same cluster rotation and  */
/* nudge as their tiles, so each ribbon stays glued under its block.   */
/* Ribbons are pointer-events:none, so clicks still reach the tiles.   */
/* ------------------------------------------------------------------ */

/* --------------------------- shared defs --------------------------- */
/* Rendered once inside BoardSvg. Gradients/clips shared by every town */

export function TownDefs() {
  return (
    <defs>
      {/* soft dark radial grounding each town group on the foggy art */}
      <radialGradient id="bw-townfade" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#080605" stopOpacity="0.55" />
        <stop offset="62%" stopColor="#080605" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#080605" stopOpacity="0" />
      </radialGradient>
      {/* parchment ribbon face (Steam reference: light cream scroll) */}
      <linearGradient id="bw-ribbon" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F7EFDD" />
        <stop offset="52%" stopColor="#F4ECD8" />
        <stop offset="100%" stopColor="#DCC99E" />
      </linearGradient>
      {/* inner vignette over a tile painting (edge shade, clear centre) */}
      <radialGradient id="bw-tilevig" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stopColor="#000000" stopOpacity="0" />
        <stop offset="72%" stopColor="#000000" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.38" />
      </radialGradient>
      {/* subtle warm top-inner highlight over a tile painting */}
      <linearGradient id="bw-tiletop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFDCA6" stopOpacity="0.24" />
        <stop offset="100%" stopColor="#FFDCA6" stopOpacity="0" />
      </linearGradient>
      {/* carved dark-wood merchant sign board (v8 tavern sign) */}
      <linearGradient id="bw-signwood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5A4128" />
        <stop offset="55%" stopColor="#46331F" />
        <stop offset="100%" stopColor="#3A2A1A" />
      </linearGradient>
      {/* diagonal halves for dual-industry slots (objectBoundingBox) */}
      <clipPath id="bw-split-a" clipPathUnits="objectBoundingBox">
        <polygon points="0,0 1,0 0,1" />
      </clipPath>
      <clipPath id="bw-split-b" clipPathUnits="objectBoundingBox">
        <polygon points="1,0 1,1 0,1" />
      </clipPath>
    </defs>
  );
}

/* ----------------------------- ribbon ------------------------------ */

/** Steam-style parchment ribbon: light cream scroll with small side hats,
 *  charcoal engraved small caps. Shared by towns AND merchants so every
 *  name plate on the map uses the same type and style.
 *  v8: ONE fixed type size (RIBBON_FONT) everywhere — the bar widens to
 *  fit the name, the text NEVER stretches or shrinks (no textLength, no
 *  computed font size). Pass `w` to reuse a precomputed width, otherwise
 *  the bar is sized from the name itself. */
export function RibbonShape({ cx, cy, w, h, name }: { cx: number; cy: number; w?: number; h: number; name: string }) {
  const barW = w ?? ribbonWidth(name);
  const l = cx - barW / 2;
  const r = cx + barW / 2;
  const t = cy - h / 2;
  const b = cy + h / 2;
  return (
    <g aria-hidden>
      {/* small side hats: darker parchment wings tucked behind the bar */}
      <polygon
        points={`${l + 3},${t + 4} ${l - 11},${t + 7} ${l - 6},${cy} ${l - 11},${b - 1} ${l + 3},${b + 3}`}
        fill="#C9B384"
        stroke="#8A6B33"
        strokeWidth={0.8}
      />
      <polygon
        points={`${r - 3},${t + 4} ${r + 11},${t + 7} ${r + 6},${cy} ${r + 11},${b - 1} ${r - 3},${b + 3}`}
        fill="#C9B384"
        stroke="#8A6B33"
        strokeWidth={0.8}
      />
      {/* main parchment bar */}
      <rect
        x={l}
        y={t}
        width={barW}
        height={h}
        rx={2.5}
        fill="url(#bw-ribbon)"
        stroke="#8A6B33"
        strokeOpacity={0.9}
        strokeWidth={1.1}
        style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.65))' }}
      />
      {/* top edge highlight + fold tuck shadows */}
      <line x1={l + 3} y1={t + 1.6} x2={r - 3} y2={t + 1.6} stroke="rgba(255,252,240,.75)" strokeWidth={0.9} />
      <polygon points={`${l + 1},${b - 7} ${l + 1},${b + 1} ${l + 7},${b + 1}`} fill="#A98F5E" opacity={0.55} />
      <polygon points={`${r - 1},${b - 7} ${r - 1},${b + 1} ${r - 7},${b + 1}`} fill="#A98F5E" opacity={0.55} />
      {/* engraved charcoal small caps (IM Fell English SC) at the ONE
          shared fixed size; pale underlay gives the carved relief */}
      <text
        x={cx}
        y={cy + 1.1}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'IM Fell English SC','Playfair Display',serif"
        fontSize={RIBBON_FONT}
        letterSpacing={1}
        fill="#FFFDF4"
        opacity={0.6}
      >
        {name}
      </text>
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'IM Fell English SC','Playfair Display',serif"
        fontSize={RIBBON_FONT}
        letterSpacing={1}
        fill="#2A241C"
      >
        {name}
      </text>
    </g>
  );
}

/* --------------------- tinted industry glyphs ---------------------- */
/* Inline versions of public/icon-*.svg (stroke widths ×1.6 so they    */
/* stay crisp at ~13px), tintable per industry colour. Used on the     */
/* slot tiles (v8 edge marking) and on the merchant tavern signs.      */

const GLYPH_PATHS: Record<IndustryType, ReactNode> = {
  coal: (
    <>
      <path d="M 8 32 L 12 22 L 22 18 L 30 24 L 26 34 L 14 36 Z" />
      <path d="M 12 22 L 18 27 L 26 34 M 22 18 L 18 27" strokeWidth={1.8} opacity={0.7} />
      <path d="M 26 20 L 34 14 L 42 18 L 40 28 L 30 30 Z" />
      <path d="M 34 14 L 33 22 L 40 28 M 33 22 L 26 20" strokeWidth={1.8} opacity={0.7} />
      <path d="M 18 38 L 24 33 L 33 36 L 30 43 L 21 43 Z" />
      <path d="M 24 33 L 25 39 L 30 43" strokeWidth={1.8} opacity={0.7} />
    </>
  ),
  iron: (
    <>
      <path d="M 10 30 L 14 22 H 34 L 38 30 Z" />
      <path d="M 12 36 L 15 30 H 33 L 36 36 Z" />
      <path d="M 17 22 L 20 15 H 28 L 31 22 Z" />
      <path d="M 16 26 h 16 M 17 33 h 14" strokeWidth={1.8} opacity={0.7} />
      <path d="M 38 12 l 3 -3 M 41 15 l 3 -1 M 36 9 l 1 -4" strokeWidth={2.6} />
      <path d="M 9 14 l -2 -3 M 12 11 l 0 -4" strokeWidth={2.6} opacity={0.7} />
    </>
  ),
  cotton: (
    <>
      <circle cx={30} cy={28} r={11} />
      <circle cx={30} cy={28} r={3} strokeWidth={2.2} />
      <path d="M 30 17 v 8 M 30 31 v 8 M 19 28 h 8 M 33 28 h 8 M 22.2 20.2 l 5.6 5.6 M 32.2 30.2 l 5.6 5.6 M 37.8 20.2 l -5.6 5.6 M 27.8 30.2 l -5.6 5.6" strokeWidth={1.9} />
      <path d="M 10 14 C 7 11 8 7 11 6 C 11 3 15 2 17 5 C 20 3 23 6 22 9 C 24 12 21 15 18 14 C 16 17 11 17 10 14 Z" strokeWidth={2.6} />
      <path d="M 15 15 C 16 19 18 21 21 23" strokeWidth={2.2} />
      <path d="M 13 8 q 2 2 1 5 M 18 7 q -1 3 1 5" strokeWidth={1.6} opacity={0.7} />
    </>
  ),
  manufacturer: (
    <>
      <path d="M 6 22 H 30 V 40 H 6 Z" />
      <path d="M 6 22 L 11 16 H 35 L 30 22" />
      <path d="M 30 22 L 35 16 V 34 L 30 40" />
      <path d="M 12 22 v 18 M 24 22 v 18 M 6 31 h 24" strokeWidth={1.8} opacity={0.7} />
      <circle cx={37} cy={12} r={5.4} strokeWidth={2.7} />
      <path d="M 37 4.6 v 2.4 M 37 17 v 2.4 M 29.6 12 h 2.4 M 42 12 h 2.4 M 31.8 6.8 l 1.7 1.7 M 40.5 15.5 l 1.7 1.7 M 42.2 6.8 l -1.7 1.7 M 33.5 15.5 l -1.7 1.7" strokeWidth={2.7} />
    </>
  ),
  pottery: (
    <>
      <path d="M 14 42 C 10 36 9 30 12 24 C 14 20 18 18 20 14 L 20 9 H 28 L 28 14 C 30 18 34 20 36 24 C 39 30 38 36 34 42 Z" />
      <path d="M 19 9 h 10" strokeWidth={3.8} />
      <path d="M 12 27 q 12 5 24 0" strokeWidth={1.9} opacity={0.7} />
      <path d="M 11 33 q 13 6 26 0" strokeWidth={1.9} opacity={0.7} />
      <path d="M 17 42 C 15 38 15 34 17 31 M 31 42 C 33 38 33 34 31 31" strokeWidth={1.8} opacity={0.55} />
      <path d="M 24 20 q -3 -3 0 -6 q 3 3 0 6 Z" strokeWidth={2.1} />
    </>
  ),
  brewery: (
    <>
      <path d="M 10 16 C 8 24 8 30 10 38 H 30 C 32 30 32 24 30 16 Z" />
      <path d="M 9 20 H 31 M 9 34 H 31" strokeWidth={2.6} />
      <path d="M 20 16 C 19 24 19 30 20 38 M 14 16.5 C 13 24 13 30 14 37.5 M 26 16.5 C 27 24 27 30 26 37.5" strokeWidth={1.8} opacity={0.7} />
      <path d="M 34 42 C 34 34 36 28 40 22 C 42 19 42 15 40 12" strokeWidth={2.2} />
      <path d="M 40 12 q -5 -1 -5 3 q 4 2 5 -3 Z M 40 18 q -5 -1 -5 3 q 4 2 5 -3 Z M 39 25 q 5 -1 5 3 q -4 2 -5 -3 Z" strokeWidth={2.2} />
    </>
  ),
};

/** small tinted line icon for an industry (48-unit viewBox artwork scaled to `size`) */
export function IndustryGlyph({ ind, color, size }: { ind: IndustryType; color: string; size: number }) {
  return (
    <g
      transform={`scale(${size / 48}) translate(${-24},${-24})`}
      fill="none"
      stroke={color}
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none"
    >
      {GLYPH_PATHS[ind]}
    </g>
  );
}

/* ------------------- v15: industry readability --------------------- */

/**
 * Always-visible industry identity ring + soft halo around a tile.
 * The crisp 2.5px ring follows the tile's rounded corners; a blurred,
 * wider halo of the same colour keeps the industry readable from far
 * away. Both dim via `--bw-ring` (Board.tsx) so the ring never fights
 * the close-up engraving. Coal rings in a warm light grey
 * (INDUSTRY_RING) — its near-black palette colour would vanish on the
 * dark map. Dual-industry slots ring in the FIRST industry's colour
 * with a short right-edge segment in the second (mirrors the v8
 * edge-stripe convention: left/first = primary, right = secondary).
 * Drawn BEFORE the tile body so the frame and owner border stay on top.
 */
function IndustryRing({ x, y, allows }: { x: number; y: number; allows: readonly IndustryType[] }) {
  const c1 = INDUSTRY_RING[allows[0]];
  return (
    <g className="pointer-events-none" aria-hidden>
      {/* diffuse halo for far-zoom visibility */}
      <rect
        x={x - H - 3.5}
        y={y - H - 3.5}
        width={TILE + 7}
        height={TILE + 7}
        rx={9}
        fill={c1}
        style={{ opacity: 'calc(0.35 * var(--bw-ring, 1))', filter: 'blur(3.5px)' }}
      />
      {/* crisp ring hugging the tile */}
      <rect
        x={x - H - 1.5}
        y={y - H - 1.5}
        width={TILE + 3}
        height={TILE + 3}
        rx={7}
        fill="none"
        stroke={c1}
        strokeWidth={2.5}
        style={{ opacity: 'calc(0.9 * var(--bw-ring, 1))' }}
      />
      {/* dual industry: right-edge segment in the second industry's colour */}
      {allows.length > 1 && (
        <path
          d={`M ${x + H + 1.5} ${y - H + 11} L ${x + H + 1.5} ${y + H - 11}`}
          fill="none"
          stroke={INDUSTRY_RING[allows[1]]}
          strokeWidth={3.4}
          strokeLinecap="round"
          style={{ opacity: 'calc(0.95 * var(--bw-ring, 1))' }}
        />
      )}
    </g>
  );
}

/**
 * Schematic-mode big glyph (Board.tsx flips `--bw-schematic` below
 * SCHEMATIC_SCREEN): a large parchment line icon (~64% of the tile,
 * v16: 31→40 with the 62px tile) on a dark disc tinted with the
 * industry colour and rimmed with the ring colour — high contrast on
 * the dark green map. One glyph per tile (FIRST industry; a dual
 * slot's second industry keeps its existing corner mini-chip,
 * rendered above this disc).
 */
function SchematicGlyph({ x, y, ind, ember }: { x: number; y: number; ind: IndustryType; ember?: boolean }) {
  const r = 23;
  return (
    <g className="pointer-events-none" style={SCHEMATIC_SHOW} aria-hidden>
      <circle cx={x} cy={y} r={r} fill="#15110D" opacity={0.94} />
      <circle cx={x} cy={y} r={r} fill={INDUSTRY_COLOR[ind]} opacity={ember ? 0.18 : 0.32} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={ember ? '#A6562B' : INDUSTRY_RING[ind]} strokeWidth={ember ? 2.2 : 1.6} opacity={0.9} />
      <g transform={`translate(${x},${y})`}>
        <IndustryGlyph ind={ind} color="#F5EBD2" size={40} />
      </g>
    </g>
  );
}

/**
 * Final-pass ribbon layer: every town's banner, counter-scaled so the
 * name stays readable from 75% to 300% zoom (v14: MIN_K 0.75). Each ribbon carries its
 * cluster's rotation so it stays flush under its own tile block.
 * pointer-events: none.
 */
export function TownRibbons({ towns }: { towns: Town[] }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      {towns.map((town) => {
        const c = townChrome(town);
        return (
          <g key={town.id} transform={`rotate(${c.rot} ${c.ax} ${c.ay})`}>
            <g
              style={{
                transform: 'scale(var(--bw-ls, 1))',
                transformOrigin: `${c.ribbonCx}px ${c.ribbonCy}px`,
                transformBox: 'view-box',
                /* smoothes the counter-scale steps: while the camera moves
                   --bw-ls only refreshes on throttled commits (~8/s) */
                transition: 'transform .16s ease-out',
              }}
            >
              <RibbonShape cx={c.ribbonCx} cy={c.ribbonCy} w={c.ribbonW} h={RIBBON_H} name={c.label} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------- resource cubes -------------------------- */
/* v10: a built works carries its goods like the physical game — coal  */
/* mines hold glossy black cubes, iron works rusty orange ones,        */
/* breweries painted barrels. Same iso-cube read as the market tray    */
/* (three shaded faces, light from upper-left), with a fine brass      */
/* liseré. Purely decorative: pointer-events none, tile size and hit   */
/* areas untouched. Flipped/exhausted works show nothing.              */

/** iso-cube face palette per goods type (matches MarketTray CUBE_FACES) */
const CUBE_PAINT = {
  coal: { top: '#4C463E', left: '#1C1714', right: '#0F0D0B', glint: '#8C857A' },
  iron: { top: '#E39A58', left: '#A65328', right: '#6E2F13', glint: '#F5C38D' },
} as const;

/** small iso 3D cube (three shaded faces + brass liseré), centred on (x, y) */
function ResourceCube({ x, y, s, kind }: { x: number; y: number; s: number; kind: keyof typeof CUBE_PAINT }) {
  const p = CUBE_PAINT[kind];
  const hw = s / 2; // half width
  const q = s / 4; // top-face slope
  const edge = { stroke: '#C9A45C', strokeOpacity: 0.5, strokeWidth: 0.55, strokeLinejoin: 'round' } as const;
  return (
    <g style={{ filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,.65))' }}>
      {/* left + right faces */}
      <polygon points={`${x - hw},${y - q} ${x},${y} ${x},${y + hw} ${x - hw},${y + q}`} fill={p.left} {...edge} />
      <polygon points={`${x},${y} ${x + hw},${y - q} ${x + hw},${y + q} ${x},${y + hw}`} fill={p.right} {...edge} />
      {/* lit top face */}
      <polygon points={`${x},${y - hw} ${x + hw},${y - q} ${x},${y} ${x - hw},${y - q}`} fill={p.top} {...edge} />
      {/* glossy glint on the top face */}
      <polygon points={`${x - hw * 0.42},${y - q * 1.35} ${x - hw * 0.05},${y - hw * 0.72} ${x + hw * 0.18},${y - q * 1.2} ${x - hw * 0.2},${y - q * 0.9}`} fill={p.glint} opacity={0.55} />
    </g>
  );
}

/**
 * Final-pass resource badges: goods cubes/barrels of unflipped works,
 * racked along the bottom of their tile (clear of the level pips and
 * the income/VP chips). Rendered AFTER TownRibbons so they stay
 * visible; the whole layer is pointer-events:none.
 */
export function TownBadges({ towns, game }: { towns: Town[]; game: GameState }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      {towns.map((town) => {
        const c = townChrome(town);
        return (
          <g key={town.id} transform={`rotate(${c.rot} ${c.ax} ${c.ay})`}>
            {town.slots.map((_, si) => {
              const tile = game.tiles[tileKey(town.id, si)];
              if (!tile || tile.flipped || tile.cubes <= 0) return null;
              const pos = c.slots[si];
              const n = tile.cubes;
              const beer = tile.industry === 'brewery';
              // tighter, smaller cubes when a high-level iron works is full
              // v13: 56px tiles — cubes 12→10, 9→8 (5+ piles), barrels 15→12
              // v16: 62px tiles — +1px each (cubes 11 / 9, barrels 13)
              const s = beer ? 13 : n >= 5 ? 9 : 11;
              const gap = 2;
              const step = s + gap;
              const x0 = pos.x - ((n - 1) * step) / 2;
              const cy = pos.y + 9; // free band between the etched mark and the bottom chips
              return (
                <g key={si}>
                  {Array.from({ length: n }, (_, i) =>
                    beer ? (
                      <image
                        key={i}
                        href="/beer-barrel.png"
                        x={x0 + i * step - s / 2}
                        y={cy - s / 2 - 1}
                        width={s}
                        height={s}
                        style={{ filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,.65))' }}
                      />
                    ) : (
                      <ResourceCube key={i} x={x0 + i * step} y={cy} s={s} kind={tile.industry === 'iron' ? 'iron' : 'coal'} />
                    ),
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------- built industry -------------------------- */
/* Owner tile laid ON TOP of the slot tile, fully covering the         */
/* painting: dark face, 2px owner border, level pips top edge,         */
/* income/VP chips on the bottom edge, ember face when flipped.        */

function BuiltTile({
  x,
  y,
  owner,
  industry,
  level,
  flipped,
  vp,
  incomeDelta,
  pulse,
  onClick,
}: {
  x: number;
  y: number;
  owner: string;
  industry: keyof typeof INDUSTRIES;
  level: number;
  flipped: boolean;
  vp: number;
  incomeDelta: number;
  pulse: boolean;
  onClick?: () => void;
}) {
  const color = PLAYER_COLORS[owner]?.hex ?? '#C9A45C';
  const t = useT();
  return (
    <g transform={`translate(${x - H},${y - H})`} onClick={onClick} className={cn(onClick && 'cursor-pointer')} role={onClick ? 'button' : undefined}>
      {/* v15: industry ring + halo behind the owner face — the dark face,
          owner border and pennant still draw on top, so the player
          identity is never masked */}
      <IndustryRing x={H} y={H} allows={[industry]} />
      {pulse && <rect x={-5} y={-5} width={TILE + 10} height={TILE + 10} rx={9} fill="none" stroke="#C9A45C" strokeWidth={2} className="bw-slotpulse" />}
      {/* dark card face with owner edge — fully hides the slot painting */}
      <rect
        width={TILE}
        height={TILE}
        rx={6}
        fill={flipped ? '#140F0B' : '#1B1611'}
        stroke={color}
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5)) drop-shadow(0 9px 18px rgba(0,0,0,.3))' }}
      />
      <line x1={5} y1={1.6} x2={TILE - 5} y2={1.6} stroke="rgba(242,234,214,.14)" strokeWidth={1} className="pointer-events-none" />
      {/* level pips along the top edge (v13: scaled ×0.8 with the 56px tile)
          v14: LOD — unreadable from afar, fades out at far zoom */}
      <g className="pointer-events-none" style={DETAIL_FADE}>
        {Array.from({ length: level }, (_, i) => (
          <circle key={i} cx={8 + i * 7} cy={6} r={2.1} fill={flipped ? '#A6562B' : '#8A6B33'} stroke="#100D0B" strokeWidth={0.5} />
        ))}
      </g>
      {flipped ? (
        <>
          {/* ember face: copper rim, the industry mark stays (you can still
              tell a flipped mill from a flipped mine), VP numeral below it */}
          <rect x={3} y={3} width={TILE - 6} height={TILE - 6} rx={4.5} fill="none" stroke="#A6562B" strokeWidth={1.5} opacity={0.95} />
          <g className="pointer-events-none" style={SCHEMATIC_DETAIL_FADE}>
            <image href={INDUSTRY_ICON[industry]} x={TILE / 2 - 9} y={9} width={18} height={18} style={{ filter: 'invert(.82) sepia(.35) saturate(1.4)' }} />
            <text
              x={TILE / 2}
              y={TILE - 17}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'Playfair Display',serif"
              fontWeight={900}
              fontSize={16}
              fill="#E8B26A"
              style={{ filter: 'drop-shadow(0 0 5px rgba(230,120,50,.45))' }}
            >
              {vp}
            </text>
            <text x={TILE / 2} y={TILE - 5} textAnchor="middle" fontFamily="'Archivo',sans-serif" fontWeight={600} fontSize={6.5} letterSpacing={1.6} fill="#A6562B">
              {t('board.tile.vp')}
            </text>
          </g>
          {/* far zoom: same big industry glyph as unflipped works, ember-rimmed */}
          <SchematicGlyph x={H} y={H} ind={industry} ember />
        </>
      ) : (
        /* v14: etched mark + income/VP chips are far-zoom LOD details —
           the dark owner face, border and pennant always stay.
           v15: below SCHEMATIC_SCREEN the engraving steps back to 0.25
           and a large parchment glyph on an industry-tinted disc names
           the works (flipped ember faces keep their big VP numeral). */
        <>
          <g className="pointer-events-none" style={SCHEMATIC_DETAIL_FADE}>
            {/* etched industry mark (v13: 22→18 with the 56px tile) */}
            <image href={INDUSTRY_ICON[industry]} x={TILE / 2 - 9} y={10} width={18} height={18} style={{ filter: 'invert(.82) sepia(.2)' }} className="pointer-events-none" />
            {/* income + VP chips riding the bottom edge (v13: 24×13 → 20×11,
                v16: 22×12 with the 62px tile) */}
            <rect x={5} y={TILE - 12} width={22} height={12} rx={3} fill="#C9A45C" stroke="#8A6B33" strokeWidth={0.8} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }} />
            <text x={16} y={TILE - 6} textAnchor="middle" dominantBaseline="central" fontFamily="'IBM Plex Mono',monospace" fontWeight={600} fontSize={8} fill="#241D14">
              +{incomeDelta}
            </text>
            <rect x={TILE - 27} y={TILE - 12} width={22} height={12} rx={3} fill="#F2EAD6" stroke="#8A6B33" strokeWidth={0.8} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }} />
            <text x={TILE - 16} y={TILE - 6} textAnchor="middle" dominantBaseline="central" fontFamily="'IBM Plex Mono',monospace" fontWeight={600} fontSize={7.5} fill="#241D14">
              {t('board.tile.vpChip', { vp })}
            </text>
          </g>
          <SchematicGlyph x={H} y={H} ind={industry} />
        </>
      )}
      {/* owner pennant */}
      <path d={`M${TILE},0 l-11,0 l0,11 z`} fill={color} opacity={0.95} className="pointer-events-none" />
    </g>
  );
}

/* ------------------------- empty slot tile ------------------------- */
/* Physical square tile: dark frame, brass-700 edge, painted industry  */
/* face (diagonal split when the slot takes two industries), slight    */
/* rotation, e2 shadow. Paintings keep full colour at rest (warm and   */
/* readable at gameplay zoom); hover adds the brass ring + brighten.   */

function SlotTile({
  x,
  y,
  allows,
  si,
  hovered,
  valid,
  picked,
  isBuilding,
}: {
  x: number;
  y: number;
  allows: IndustryType[];
  si: number;
  hovered: boolean;
  valid: boolean;
  picked: boolean;
  isBuilding: boolean;
}) {
  const rot = SLOT_ROT[si % SLOT_ROT.length];
  const dim = isBuilding && !valid;
  const lit = hovered || valid;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      {/* v15: industry ring + halo, behind the tile body so the brass
          frame stays crisp on top */}
      <IndustryRing x={x} y={y} allows={allows} />
      {/* tile body: dark frame + brass edge + real drop shadow */}
      <rect
        x={x - H}
        y={y - H}
        width={TILE}
        height={TILE}
        rx={6}
        fill="#12100C"
        stroke={valid ? '#C9A45C' : '#8A6B33'}
        strokeOpacity={valid ? 0.95 : 0.6}
        strokeWidth={valid ? 2 : 1}
        style={{
          filter: picked ? 'drop-shadow(0 6px 10px rgba(0,0,0,.6))' : 'drop-shadow(0 3px 5px rgba(0,0,0,.5)) drop-shadow(0 8px 16px rgba(0,0,0,.3))',
          transform: picked ? 'translateY(-2px)' : undefined,
        }}
      />
      {/* painted face(s), full-bleed with a 4px frame reveal — full colour at rest */}
      <g
        className="pointer-events-none"
        style={{
          filter: lit ? 'saturate(1.06) brightness(1.08)' : 'brightness(.92)',
          /* v15: in schematic mode (--bw-schematic, far zoom) the painting
             steps back to 0.25 so the big industry glyph reads clearly */
          opacity: dim ? 0.38 : 'calc(1 - 0.75 * var(--bw-schematic, 0))',
          transition: 'filter 160ms ease, opacity 200ms ease',
        }}
      >
        {allows.length === 1 ? (
          <image href={TILE_ART[allows[0]]} x={x - H + 4} y={y - H + 4} width={TILE - 8} height={TILE - 8} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <image href={TILE_ART[allows[0]]} x={x - H + 4} y={y - H + 4} width={TILE - 8} height={TILE - 8} preserveAspectRatio="xMidYMid slice" clipPath="url(#bw-split-a)" />
            <image href={TILE_ART[allows[1]]} x={x - H + 4} y={y - H + 4} width={TILE - 8} height={TILE - 8} preserveAspectRatio="xMidYMid slice" clipPath="url(#bw-split-b)" />
            <line x1={x - H + 4} y1={y + H - 4} x2={x + H - 4} y2={y - H + 4} stroke="#0C0A08" strokeWidth={2} />
          </>
        )}
        {/* subtle warm top-inner highlight + inner painted-edge vignette */}
        <rect x={x - H + 4} y={y - H + 4} width={TILE - 8} height={(TILE - 8) * 0.45} fill="url(#bw-tiletop)" />
        <rect x={x - H + 4} y={y - H + 4} width={TILE - 8} height={TILE - 8} fill="url(#bw-tilevig)" />
      </g>
      {/* v15 schematic mode: large parchment glyph of the FIRST industry
          over the faded painting — rendered UNDER the corner chips so a
          dual slot's second-industry mini-chip stays readable */}
      <SchematicGlyph x={x} y={y} ind={allows[0]} />
      {/* v8: industry edge marking — one colour stripe per accepted
          industry (left edge = first, right edge = second) + a tinted
          glyph chip in each lower corner, so dual-industry slots read at
          a glance. v13: stripes 4.5→3.6, chips r9.2→7.4 with the 56px tile.
          v16: chips r7.4→8.2 with the 62px tile. */}
      <g className="pointer-events-none" opacity={dim ? 0.45 : 1}>
        {allows.map((ind, i) => (
          <rect
            key={`stripe-${ind}`}
            x={allows.length === 1 || i === 0 ? x - H + 1.5 : x + H - 5.1}
            y={y - H + 6}
            width={3.6}
            height={TILE - 12}
            rx={1.8}
            fill={INDUSTRY_COLOR[ind]}
            stroke="rgba(242,234,214,.3)"
            strokeWidth={0.5}
          />
        ))}
        {allows.map((ind, i) => {
          const gx = allows.length === 1 ? x : i === 0 ? x - H + 10 : x + H - 10;
          return (
            <g key={`glyph-${ind}`} transform={`translate(${gx},${y + H - 10})`}>
              <circle r={8.2} fill="#F4ECD8" stroke={INDUSTRY_COLOR[ind]} strokeWidth={1.3} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))' }} />
              <IndustryGlyph ind={ind} color={INDUSTRY_COLOR[ind]} size={11.6} />
            </g>
          );
        })}
      </g>
      {/* frame lip over the painting: rounds the corners, adds relief */}
      <rect x={x - H + 1.5} y={y - H + 1.5} width={TILE - 3} height={TILE - 3} rx={5} fill="none" stroke="#0C0A08" strokeWidth={2.5} className="pointer-events-none" />
      <rect
        x={x - H}
        y={y - H}
        width={TILE}
        height={TILE}
        rx={6}
        fill="none"
        stroke={valid ? '#C9A45C' : '#8A6B33'}
        strokeOpacity={valid ? 0.95 : 0.6}
        strokeWidth={valid ? 2 : 1}
        className={cn('pointer-events-none', valid && 'bw-slotpulse')}
      />
      {/* hover: brass sheen + ring */}
      {hovered && (
        <g className="pointer-events-none">
          <rect x={x - H} y={y - H} width={TILE} height={TILE} rx={6} fill="#C9A45C" opacity={0.16} />
          <rect x={x - H - 2} y={y - H - 2} width={TILE + 4} height={TILE + 4} rx={7} fill="none" stroke="#DDBE7E" strokeWidth={1.6} opacity={0.9} />
        </g>
      )}
    </g>
  );
}

/* ---------------------------- town node ---------------------------- */

interface TownNodeProps {
  town: Town;
  game: GameState;
  targetByKey: Map<string, BuildTarget>;
  validsByKey: Map<string, BuildTarget[]>;
  sellByKey: Map<string, SellTarget>;
  hoverKey: string | null;
  buildPick: BuildTarget | null;
  sellPicks: SellTarget[];
  shaking: { key: string; reason: string; at: number } | null;
  isBuilding: boolean;
  isSelling: boolean;
  idle: boolean;
  flashing: boolean;
  setHover: (key: string | null) => void;
  pickBuild: (t: BuildTarget) => void;
  pickSell: (t: SellTarget) => void;
  onInvalid: (key: string, reason: string) => void;
  onTownHover: (id: string | null) => void;
  onTownClick: (id: string) => void;
  onTownZoom: (id: string) => void;
}

export default function TownNode(p: TownNodeProps) {
  const {
    town, game, targetByKey, validsByKey, sellByKey,
    hoverKey, buildPick, sellPicks, shaking,
    isBuilding, isSelling, idle, flashing,
    setHover, pickBuild, pickSell, onInvalid, onTownHover, onTownClick, onTownZoom,
  } = p;

  const t = useT();
  const c = townChrome(town);

  /* hit / hover / ledger-flash box = the padded cluster bbox (tiles + ribbon) */
  const boxX0 = c.minX;
  const boxX1 = c.maxX;
  const boxY0 = c.minY;
  const boxY1 = c.maxY;
  // deterministic variation: some villages mirror so towns don't clone-stamp
  const mirror = (town.x * 7 + town.y * 13) % 2 === 0;

  return (
    <g
      className={idle ? 'cursor-pointer' : undefined}
      onPointerEnter={() => {
        if (idle) onTownHover(town.id);
      }}
      onPointerLeave={() => {
        if (idle) onTownHover(null);
      }}
      onClick={(e) => {
        // idle browsing: any click on the town opens its inspector.
        // (double-click is reserved for zoom; planning clicks are handled
        // by tiles/links below and never reach here)
        if (!idle || e.detail >= 2) return;
        e.stopPropagation();
        onTownClick(town.id);
      }}
      onDoubleClick={(e) => {
        // idle browsing: double-click flies the camera onto the town
        // (stopPropagation keeps the frame's cursor-anchored dblclick out)
        if (!idle) return;
        e.stopPropagation();
        onTownZoom(town.id);
      }}
    >
      {/* whole cluster glued together: one tiny organic rotation */}
      <g transform={`rotate(${c.rot} ${c.ax} ${c.ay})`}>
        {/* soft dark radial grounding the group on the foggy art */}
        <ellipse
          cx={(boxX0 + boxX1) / 2}
          cy={(boxY0 + boxY1) / 2}
          rx={(boxX1 - boxX0) / 2}
          ry={(boxY1 - boxY0) / 2 + 6}
          fill="url(#bw-townfade)"
          className="pointer-events-none"
        />

        {/* painted village behind the slots + ribbon (gentle counter-scale) */}
        <g
          className="pointer-events-none"
          style={{
            transform: 'scale(var(--bw-lsv, 1))',
            transformOrigin: `${c.villageCx}px ${c.villageBottom}px`,
            transformBox: 'view-box',
            transition: 'transform .16s ease-out', // see TownRibbons
          }}
          opacity={town.farm ? 0.55 : 0.62}
        >
          <g transform={`translate(${c.villageCx},${c.villageBottom}) scale(${mirror ? -1 : 1},1)`}>
            <image href="/town-village.png" x={-c.villageH / 2} y={-c.villageH} width={c.villageH} height={c.villageH} />
          </g>
        </g>

        {/* generous hit area for hover / inspector (idle mode only) */}
        <rect
          x={boxX0}
          y={boxY0}
          width={boxX1 - boxX0}
          height={boxY1 - boxY0}
          fill="transparent"
          className={idle ? 'cursor-pointer' : undefined}
        />
        {/* v16b: no hover halo around the town (user finds it ugly) —
            the brass pulse is kept only for the ledger flash */}
        {flashing && (
          <rect
            x={boxX0 + 4}
            y={boxY0 + 4}
            width={boxX1 - boxX0 - 8}
            height={boxY1 - boxY0 - 8}
            rx={10}
            fill="none"
            stroke="#C9A45C"
            strokeWidth={3}
            className="bw-slotpulse pointer-events-none"
          />
        )}

        {/* brass rivet where links meet the town (authentic anchor) */}
        <circle cx={town.x} cy={town.y} r={6.5} fill="#191510" stroke="#8A6B33" strokeWidth={1.2} className="pointer-events-none" />
        <circle cx={town.x} cy={town.y} r={2.2} fill="#C9A45C" className="pointer-events-none" />

        {/* ------------------------- slot tiles ------------------------- */}
        {town.slots.map((sp, si) => {
          const pos = c.slots[si];
          const key = tileKey(town.id, si);
          const tile = game.tiles[key];
          const bt = targetByKey.get(key);
          const sell = sellByKey.get(key);
          const hovered = hoverKey === key;
          const slotShaking = shaking?.key === key;
          const picked = buildPick && tileKey(buildPick.town, buildPick.slot) === key;
          const sellPicked = sellPicks.some((x) => tileKey(x.town, x.slot) === key);

          if (tile) {
            const lv = INDUSTRIES[tile.industry][tile.level - 1];
            /* selling, or OVERBUILDING (same industry, higher level) while building */
            const interactive = isSelling || (isBuilding && !!bt);
            return (
              <g
                key={key}
                data-owner={tile.owner}
                className={slotShaking ? 'bw-shake' : undefined}
                onPointerEnter={() => interactive && setHover(key)}
                onPointerLeave={() => interactive && setHover(null)}
              >
                <BuiltTile
                  x={pos.x}
                  y={pos.y}
                  owner={game.players[tile.owner].color}
                  industry={tile.industry}
                  level={tile.level}
                  flipped={tile.flipped}
                  vp={lv.vp}
                  incomeDelta={lv.incomeDelta}
                  pulse={!!interactive && !!sell?.valid}
                  onClick={
                    interactive
                      ? () => {
                          if (isBuilding && bt) {
                            if (bt.valid) pickBuild(bt);
                            else onInvalid(key, bt.reason ?? '');
                            return;
                          }
                          if (sell?.valid) pickSell(sell);
                          else
                            onInvalid(
                              key,
                              sell?.reason ??
                                (lv.beerToSell > 0
                                  ? t('board.invalid.noMerchant')
                                  : t('board.invalid.flipsByEmptying')),
                            );
                        }
                      : undefined
                  }
                />
                {sellPicked && <circle cx={pos.x} cy={pos.y} r={H + 5} fill="none" stroke="#2E5540" strokeWidth={3} className="bw-slotpulse" />}
                <title>
                  {t('board.tile.builtTitle', {
                    industry: INDUSTRY_LABEL[tile.industry],
                    level: tile.level,
                    name: game.players[tile.owner].name,
                    flipped: tile.flipped ? t('board.tile.flippedSuffix') : '',
                    income: lv.incomeDelta,
                    vp: lv.vp,
                  })}
                </title>
              </g>
            );
          }

          /* empty slot — painted tile face */
          const valid = !!bt?.valid && isBuilding;
          return (
            <g
              key={key}
              className={cn(isBuilding && 'cursor-pointer', slotShaking && 'bw-shake')}
              onPointerEnter={() => isBuilding && setHover(key)}
              onPointerLeave={() => isBuilding && setHover(null)}
              onClick={(e) => {
                if (!isBuilding) return;
                e.stopPropagation();
                if (bt?.valid) {
                  // re-clicking a picked multi-industry tile cycles the industry
                  const valids = validsByKey.get(key) ?? [];
                  if (picked && valids.length > 1 && buildPick) {
                    const idx = valids.findIndex((v) => v.industry === buildPick.industry);
                    pickBuild(valids[(idx + 1) % valids.length]);
                  } else {
                    pickBuild(valids[0] ?? bt);
                  }
                } else {
                  onInvalid(key, bt?.reason ?? t('board.invalid.tileCard'));
                }
              }}
            >
              <SlotTile x={pos.x} y={pos.y} allows={sp.allows} si={si} hovered={hovered && !!bt?.valid} valid={valid} picked={!!picked} isBuilding={isBuilding} />
              {hovered && bt?.valid && (
                <g className="pointer-events-none">
                  <rect x={pos.x - 26} y={pos.y - H - 21} width={52} height={15} rx={3} fill="#2C251D" stroke="#C9A45C" strokeWidth={0.8} />
                  <text x={pos.x} y={pos.y - H - 10} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} fill="#C9A45C">
                    £{bt.total}
                  </text>
                </g>
              )}
              <title>
                {bt
                  ? t('board.slot.targetTitle', {
                      industry: INDUSTRY_LABEL[bt.industry],
                      level: bt.level,
                      total: bt.total,
                      status: bt.valid ? t('board.slot.valid') : (bt.reason ?? ''),
                    })
                  : sp.allows.map((a) => INDUSTRY_LABEL[a]).join(t('board.slot.or'))}
              </title>
            </g>
          );
        })}
      </g>
    </g>
  );
}
