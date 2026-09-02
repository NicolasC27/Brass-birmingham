import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  INDUSTRY_LABEL,
  LINKS,
  MERCHANTS,
  MERCHANT_BY_ID,
  NODE_POS,
  PLAYER_COLORS,
  TOWNS,
  TOWN_BY_ID,
} from '@/game/data';
import { merchantBarrelSlots, merchantDemand, merchantOpen, tileKey } from '@/game/engine';
import type { BuildTarget, LinkTarget, SellTarget } from '@/game/engine';
import type { PlanGhost } from '@/game/ghost';
import type { GameState, LinkDef } from '@/game/types';
import { useGame } from '@/game/store';
import { useT } from '@/i18n';
import { useReducedMotion } from './useReducedMotion';
import { FAR_LOD_SCREEN, FIT_VIEW, SCHEMATIC_SCREEN, WORLD_H, WORLD_W, centeredOn, clampK, clampPan, fitScale, labelScale, ribbonLabelScale, worldToScreen, zoomAt } from './boardView';
import type { View } from './boardView';
import ZoomControls from './ZoomControls';
import Minimap from './Minimap';
import TownInspector, { ShapeChip, TownCardContent } from './TownInspector';
import TownNode, { IndustryGlyph, RibbonShape, TownBadges, TownDefs, TownRibbons } from './TownNode';
import { routeFor } from './routePaths';
import { DETAIL_FADE, INDUSTRY_COLOR, RIBBON_FONT, displayPosFor } from './townChrome';
import AtmosphereLayer from './ambiance/AtmosphereLayer';
import TownLamplight from './ambiance/TownLamplight';
import VignetteLamp from './ambiance/VignetteLamp';
import ChimneySmoke from './ambiance/ChimneySmoke';
import RiverSheen from './ambiance/RiverSheen';
import AmbientTraffic from './ambiance/AmbientTraffic';
import { cn } from '@/lib/utils';

/* ------------------------------ helpers ---------------------------- */

/** winding route geometry for a link (map-v5, see routePaths.ts) */
function linkPath(def: LinkDef): string {
  return routeFor(def).d;
}

function linkMid(def: LinkDef): [number, number] {
  return routeFor(def).mid;
}

const nodeName = (id: string): string => TOWN_BY_ID[id]?.name ?? MERCHANT_BY_ID[id]?.name ?? id;

/** towns in west→east reading order for the arrow-key camera tour */
const TOWN_TOUR = [...TOWNS].sort((a, b) => a.x - b.x || a.y - b.y);

/** world coords for anything a ledger entry can point at (town / merchant / link) */
function regionPos(key: string): [number, number] | null {
  const town = TOWN_BY_ID[key];
  if (town) return [town.x, town.y];
  const merchant = MERCHANT_BY_ID[key];
  if (merchant) return [merchant.x, merchant.y];
  const link = LINKS.find((l) => l.id === key);
  if (link) return linkMid(link);
  return null;
}

/** stagger order for the era-2 ceremony rail-etch reveal */
const RAIL_ONLY_ORDER = new Map(LINKS.filter((l) => !l.canal).map((l, i) => [l.id, i]));

/** shape glyph inside the owner medallion (colour + shape accessibility rule) */
function ShapeGlyph({ shape, x, y, color }: { shape: string; x: number; y: number; color: string }) {
  const common = { fill: color, stroke: '#100D0B', strokeWidth: 0.7 } as const;
  if (shape === 'square') return <rect x={x - 4} y={y - 4} width={8} height={8} {...common} />;
  if (shape === 'diamond') return <path d={`M${x},${y - 5.2} L${x + 5.2},${y} L${x},${y + 5.2} L${x - 5.2},${y} Z`} {...common} />;
  if (shape === 'triangle') return <path d={`M${x},${y - 4.8} L${x + 4.8},${y + 4} L${x - 4.8},${y + 4} Z`} {...common} />;
  return <circle cx={x} cy={y} r={4.4} {...common} />;
}

/** owner medallion seated on the middle of a built link (Steam reference):
 *  brass-rimmed disc, owner colour, shape glyph for accessibility. */
function OwnerMedallion({ shape, x, y, color }: { shape: string; x: number; y: number; color: string }) {
  return (
    <g className="pointer-events-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.65))' }}>
      <circle cx={x} cy={y} r={10} fill="#100D0B" stroke="#C9A45C" strokeWidth={1.6} />
      <circle cx={x} cy={y} r={7.6} fill={color} stroke="#F2EAD6" strokeOpacity={0.35} strokeWidth={0.8} />
      <ShapeGlyph shape={shape} x={x} y={y} color="#100D0B" />
    </g>
  );
}

/* --------------------------- static art ---------------------------- */

/** dark painted Midlands underlay — one misty painting per era, with a
 *  slow (~1.5s) crossfade when the rail era dawns (Steam reference).
 *  The opacity transition is only attached around an era change — a
 *  permanent transition would force the compositor to re-evaluate both
 *  giant layers on every pan/zoom frame. */
const WorldArt = memo(function WorldArt({ era }: { era: 'canal' | 'rail' }) {
  const [crossfading, setCrossfading] = useState(false);
  const [prevEra, setPrevEra] = useState(era);
  /* render-time adjustment (same pattern as Board's prevIdle): era flipped
     → attach the opacity transition for one crossfade window */
  if (prevEra !== era) {
    setPrevEra(era);
    setCrossfading(true);
  }
  useEffect(() => {
    if (!crossfading) return;
    const t = window.setTimeout(() => setCrossfading(false), 1700);
    return () => window.clearTimeout(t);
  }, [crossfading]);
  const layer = cn(
    'absolute inset-0 h-full w-full select-none object-cover',
    crossfading && 'transition-opacity duration-[1500ms] ease-in-out',
  );
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-[#141210]" />
      {/* the inactive painting leaves the compositor entirely — opacity:0
          alone would keep a 3200×1800 layer alive on every frame */}
      <img
        src="/map-era-canal.png"
        alt=""
        draggable={false}
        className={layer}
        style={{ opacity: era === 'canal' ? 1 : 0, visibility: !crossfading && era !== 'canal' ? 'hidden' : undefined }}
      />
      <img
        src="/map-era-rail.png"
        alt=""
        draggable={false}
        className={layer}
        style={{ opacity: era === 'rail' ? 1 : 0, visibility: !crossfading && era !== 'rail' ? 'hidden' : undefined }}
      />
      {/* unify with the soot palette */}
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.10]" />
    </>
  );
});

/* ------------------------- interactive SVG ------------------------- */

interface BoardSvgProps {
  game: GameState;
  targets: BuildTarget[];
  linkTargetsList: LinkTarget[];
  sellTargetsList: SellTarget[];
  ghost: PlanGhost | null;
  hoverKey: string | null;
  buildPick: BuildTarget | null;
  linkPick: LinkTarget | null;
  sellPicks: SellTarget[];
  shake: { key: string; reason: string; at: number } | null;
  isBuilding: boolean;
  isNetworking: boolean;
  isSelling: boolean;
  idle: boolean;
  hoverTown: string | null;
  hoverLink: string | null;
  reduced: boolean;
  /** era-2 ceremony is playing: rail-only routes etch themselves live */
  railReveal: boolean;
  setHover: (key: string | null) => void;
  pickBuild: (t: BuildTarget) => void;
  pickLink: (t: LinkTarget) => void;
  pickSell: (t: SellTarget) => void;
  onInvalid: (key: string, reason: string) => void;
  onTownHover: (id: string | null) => void;
  onTownClick: (id: string) => void;
  onTownZoom: (id: string) => void;
  onLinkHover: (id: string | null) => void;
}

const BoardSvg = memo(function BoardSvg(p: BoardSvgProps) {
  const {
    game, targets, linkTargetsList, sellTargetsList, ghost,
    hoverKey, buildPick, linkPick, sellPicks, shake,
    isBuilding, isNetworking, isSelling, idle,
    hoverTown, hoverLink, reduced, railReveal,
    setHover, pickBuild, pickLink, pickSell, onInvalid,
    onTownHover, onTownClick, onTownZoom, onLinkHover,
  } = p;

  const t = useT();

  const targetByKey = useMemo(() => {
    const m = new Map<string, BuildTarget>();
    for (const t of targets) {
      const k = tileKey(t.town, t.slot);
      const cur = m.get(k);
      if (!cur || (!cur.valid && t.valid)) m.set(k, t);
    }
    return m;
  }, [targets]);

  const validsByKey = useMemo(() => {
    const m = new Map<string, BuildTarget[]>();
    for (const t of targets) {
      if (!t.valid) continue;
      const k = tileKey(t.town, t.slot);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [targets]);

  const sellByKey = useMemo(() => {
    const m = new Map<string, SellTarget>();
    for (const t of sellTargetsList) {
      const k = tileKey(t.town, t.slot);
      if (!m.has(k) || t.valid) m.set(k, t);
    }
    return m;
  }, [sellTargetsList]);

  return (
    <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className="absolute inset-0 h-full w-full" role="group" aria-label={t('board.svgAria')}>
      <TownDefs />
      {/* ------- link layer: etched possibilities + built waterways/tracks ------- */}
      {LINKS.map((def) => {
        const built = game.links[def.id];
        const d = linkPath(def);
        const isRail = built?.era === 'rail';
        const ownerColor = built ? PLAYER_COLORS[game.players[built.owner].color]?.hex ?? '#C9A45C' : undefined;
        const ownerShape = built ? PLAYER_COLORS[game.players[built.owner].color]?.shape ?? 'circle' : 'circle';
        const adjacent = hoverTown !== null && (def.a === hoverTown || def.b === hoverTown);
        const linkHovered = hoverLink === def.id;
        const [mx, my] = linkMid(def);
        /* unbuilt visibility (v9):
           - CANAL ERA: buildable routes read as WATER — a continuous
             blue-grey ribbon (#4A7A8C, ~55–60%) over a faint dark halo,
             with a slow-breathing light sheen; nothing rail-like remains
           - rail-only routes stay INVISIBLE in the canal era; they etch
             themselves during the era-2 ceremony
           - RAIL ERA: unbuilt traces become railway surveys — dark
             ballast with sleeper dashes and a faint steel centre
           - canal-only routes fade to a faint water trace once their
             era passes */
        let furrowOpacity = 0;
        if (!built) {
          if (def.canal) {
            furrowOpacity = game.era === 'canal' ? 0.55 : def.rail ? 0.5 : 0.16;
          } else if (game.era === 'rail' || railReveal) {
            furrowOpacity = 0.55;
          }
        }
        const revealing = !built && !def.canal && game.era !== 'rail' && railReveal && !reduced;
        const revealDelay = 0.5 + (RAIL_ONLY_ORDER.get(def.id) ?? 0) * 0.09;
        /* era-appropriate trace: water in the canal era, iron in the rail era */
        const railStyle = game.era === 'rail' ? def.rail : !def.canal;
        return (
          <g key={def.id}>
            {!built && furrowOpacity > 0 && (
              <>
                {revealing && (
                  /* the burin draws the route live during the ceremony */
                  <path
                    d={d}
                    pathLength={1}
                    fill="none"
                    stroke="#DDBE7E"
                    strokeWidth={3}
                    strokeLinecap="round"
                    className="bw-etchdraw"
                    style={{ animationDelay: `${revealDelay}s` }}
                  />
                )}
                <g className={revealing ? 'bw-etchin' : undefined} style={revealing ? { animationDelay: `${revealDelay + 1.15}s` } : undefined}>
                  {railStyle ? (
                    <>
                      {/* railway survey: dark ballast bed */}
                      <path d={d} fill="none" stroke="#241D16" strokeWidth={11} strokeOpacity={furrowOpacity} strokeLinecap="round" />
                      {/* sleeper dashes */}
                      <path d={d} fill="none" stroke="#6B5138" strokeWidth={7} strokeDasharray="2.2 7" strokeOpacity={furrowOpacity * 0.85} />
                      {/* faint twin-steel centre line */}
                      <path d={d} fill="none" stroke="#8E969E" strokeWidth={3.2} strokeOpacity={furrowOpacity * 0.6} />
                    </>
                  ) : (
                    <>
                      {/* canal survey (v9): a CONTINUOUS ribbon of still water —
                          soft dark halo lifts it off the terrain, solid blue-grey
                          water line, fine light sheen breathing slowly on top */}
                      <path d={d} fill="none" stroke="#0E0C09" strokeWidth={8} strokeOpacity={furrowOpacity * 0.55} strokeLinecap="round" />
                      {/* v13: +10% (3.5→3.85) — the ×1.25 world would drop the unbuilt trace under ~2.5px screen at fit on 1080p */}
                      <path d={d} fill="none" stroke="#4A7A8C" strokeWidth={3.85} strokeOpacity={Math.min(0.6, furrowOpacity)} strokeLinecap="round" />
                      <path d={d} fill="none" stroke="#8FB8C4" strokeWidth={1.2} strokeOpacity={0.5} strokeLinecap="round" className="bw-watersheen" />
                    </>
                  )}
                </g>
              </>
            )}
            {built && ownerColor && (
              <g data-owner={built.owner}>
                {/* owner glow */}
                <path d={d} fill="none" stroke={ownerColor} strokeWidth={22} strokeOpacity={0.3} strokeLinecap="round" />
                {isRail ? (
                  <>
                    {/* steam-era track: dark ballast, visible sleepers, twin bright steel rails */}
                    <path d={d} fill="none" stroke="#0E0B09" strokeWidth={16} strokeLinecap="round" />
                    {/* the ballast IS the owner colour; sleepers and a slim steel pair sit on it */}
                    <path d={d} fill="none" stroke={ownerColor} strokeWidth={13} />
                    <path d={d} fill="none" stroke="#2A2018" strokeWidth={9} strokeDasharray="2.4 8" strokeOpacity={0.55} />
                    <path d={d} fill="none" stroke="#D7DDE2" strokeWidth={4.6} strokeOpacity={0.95} />
                    <path d={d} fill="none" stroke={ownerColor} strokeWidth={1.6} />
                    <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={4.6} strokeDasharray="1.2 15.8" strokeDashoffset={-2} strokeOpacity={0.4} />
                  </>
                ) : (
                  <>
                    {/* wide waterway: earthen banks, deep green water, animated light */}
                    <path d={d} fill="none" stroke="#14100B" strokeWidth={20} strokeOpacity={0.95} strokeLinecap="round" />
                    <path d={d} fill="none" stroke="#8A6B33" strokeWidth={18} strokeOpacity={0.22} />
                    {/* the waterway IS the owner colour; a slim dark channel + sheen keep it reading as water */}
                    <path d={d} fill="none" stroke={ownerColor} strokeWidth={15} strokeLinecap="round" />
                    <path d={d} fill="none" stroke="#0F1F1A" strokeWidth={5} strokeOpacity={0.55} />
                    <path d={d} fill="none" stroke="#2E5A50" strokeWidth={3.2} strokeOpacity={0.7} />
                    <path d={d} fill="none" stroke="#DFF5E6" strokeWidth={1.4} strokeOpacity={0.6} className="bw-waterflow" />
                  </>
                )}
                {/* owner medallion seated mid-route (brass rim + colour + shape) */}
                <OwnerMedallion shape={ownerShape} x={mx} y={my} color={ownerColor} />
              </g>
            )}
            {adjacent && (
              <path d={d} fill="none" stroke="#C9A45C" strokeWidth={8} strokeOpacity={0.45} className="bw-slotpulse pointer-events-none" />
            )}
            {linkHovered && !adjacent && (
              <path d={d} fill="none" stroke="#DDBE7E" strokeWidth={3.4} strokeOpacity={0.85} className="pointer-events-none" />
            )}
          </g>
        );
      })}

      {/* ------- link hit areas (always present: hover info + network planning) ------- */}
      {LINKS.map((def) => {
        const eraOk = game.era === 'canal' ? def.canal : def.rail;
        const built = !!game.links[def.id];
        const lt = isNetworking ? linkTargetsList.find((x) => x.link.id === def.id) : undefined;
        const clickable = isNetworking && !!lt && eraOk && !built;
        const d = linkPath(def);
        const [mx, my] = linkMid(def);
        const picked = linkPick?.link.id === def.id;
        const hovered = hoverKey === def.id;
        return (
          <g key={`hit-${def.id}`}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={24}
              className={cn(clickable && 'cursor-pointer', idle && 'cursor-help')}
              onPointerEnter={() => {
                if (clickable) setHover(def.id);
                else if (idle) onLinkHover(def.id);
              }}
              onPointerLeave={() => {
                if (clickable) setHover(null);
                else if (idle) onLinkHover(null);
              }}
              onClick={(e) => {
                if (!clickable || !lt) return;
                e.stopPropagation();
                if (lt.valid) pickLink(lt);
                else onInvalid(def.id, lt.reason ?? t('board.invalid.cannotBuild'));
              }}
            />
            {clickable && lt?.valid && (
              <path d={d} fill="none" stroke="#C9A45C" strokeWidth={picked ? 5 : 3} strokeOpacity={picked ? 0.95 : 0.55} className={picked ? '' : 'bw-slotpulse'} />
            )}
            {clickable && (hovered || picked) && lt?.valid && (
              <g className="pointer-events-none">
                <path d={d} fill="none" stroke="#DDBE7E" strokeWidth={2.4} className="bw-dashflow" />
                <rect x={mx - 24} y={my - 26} width={48} height={17} rx={3} fill="#2C251D" stroke="#C9A45C" strokeWidth={1} />
                <text x={mx} y={my - 14} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={10} fill="#C9A45C">
                  £{lt.total}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* ------- merchant ports (v8: hanging victorian tavern signs) -------
          A wrought-iron bracket with scroll curls carries a carved dark-wood
          board on two brass rings. On the board: parchment name ribbon
          (identical fixed-size chrome to the town ribbons), a brass market
          balance, the demand glyphs, and the bonus in BIG explicit brass
          lettering. Below the board: the beer sale slots (painted barrels;
          a dashed ghost marks each emptied slot). Anchors unchanged. */}
      {MERCHANTS.map((m) => {
        const beer = game.merchantBeer[m.id] ?? 0;
        const open = merchantOpen(game, m.id);
        const tiles = game.merchantTiles[m.id] ?? [];
        const demand = merchantDemand(game, m.id);
        const barrels = merchantBarrelSlots(game, m.id);
        const claimed = game.merchantBonusTaken[m.id];
        /* v13: the whole sign (bracket + board + barrels, NOT the name
           ribbon) renders ×0.8 — 116→~93px board — to keep proportion
           with the 56px town tiles in the airier 3200×1800 world */
        const SIGN_SCALE = 0.8;
        const W = 116; // sign board width in plaque-local units (renders ~93px)
        const TOP = -44; // board top (plaque-local)
        const BOT = 32; // board bottom
        const ARM_Y = -58; // iron bracket arm
        const ribbonY = -34; // name ribbon centre (overlaps board top edge)
        const bonusFont = m.bonusLabel.length <= 3 ? 19 : m.bonusLabel.length <= 5 ? 15 : 11.5;
        const barrelX = (i: number) => (barrels - 1) * -16 + i * 32;
        return (
          <g key={m.id}>
          <g transform={`translate(${m.x},${m.y}) scale(${SIGN_SCALE})`} opacity={open ? 1 : 0.45}>
            {/* wrought-iron bracket: arm, scroll curls, finial */}
            <g fill="none" stroke="#191410" strokeLinecap="round">
              <path d={`M ${-W / 2 + 4} ${ARM_Y} H ${W / 2 - 4}`} strokeWidth={4} />
              <path d={`M ${-W / 2 + 4} ${ARM_Y} c -7 0 -9 -7 -3 -10`} strokeWidth={3} />
              <path d={`M ${W / 2 - 4} ${ARM_Y} c 7 0 9 -7 3 -10`} strokeWidth={3} />
            </g>
            <circle cx={0} cy={ARM_Y} r={3.4} fill="#C9A45C" stroke="#191410" strokeWidth={1} />
            {/* hangers + brass rings */}
            {[-36, 36].map((hx) => (
              <g key={`hang${hx}`}>
                <line x1={hx} y1={ARM_Y} x2={hx} y2={TOP} stroke="#191410" strokeWidth={2.4} />
                <circle cx={hx} cy={(ARM_Y + TOP) / 2} r={3.4} fill="none" stroke="#C9A45C" strokeWidth={1.6} />
                <circle cx={hx} cy={TOP} r={2.6} fill="none" stroke="#C9A45C" strokeWidth={1.4} />
              </g>
            ))}
            {/* carved wooden board: dark wood gradient, thin brass trim */}
            <rect
              x={-W / 2}
              y={TOP}
              width={W}
              height={BOT - TOP}
              rx={7}
              fill="url(#bw-signwood)"
              stroke="#C9A45C"
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 5px 8px rgba(0,0,0,.65))' }}
            />
            <rect x={-W / 2 + 3} y={TOP + 3} width={W - 6} height={BOT - TOP - 6} rx={5} fill="none" stroke="#8A6B33" strokeWidth={0.8} opacity={0.75} />
            {/* plank seams + corner rosettes */}
            <line x1={-W / 2 + 8} y1={TOP + 26} x2={W / 2 - 8} y2={TOP + 26} stroke="rgba(0,0,0,.28)" strokeWidth={0.9} />
            <line x1={-W / 2 + 8} y1={BOT - 8} x2={W / 2 - 8} y2={BOT - 8} stroke="rgba(0,0,0,.28)" strokeWidth={0.9} />
            {[
              [-W / 2 + 7, TOP + 7],
              [W / 2 - 7, TOP + 7],
              [-W / 2 + 7, BOT - 7],
              [W / 2 - 7, BOT - 7],
            ].map(([rx, ry], i) => (
              <circle key={`ros${i}`} cx={rx} cy={ry} r={1.6} fill="#C9A45C" opacity={0.85} />
            ))}
            {/* brass merchant's balance (market symbol) */}
            <g transform={`translate(${-33},${-6}) scale(0.62) translate(-24,-24)`} fill="none" stroke="#DDBE7E" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
              <path d="M 24 8 V 34 M 18 38 H 30 M 24 34 v 4" />
              <path d="M 10 14 H 38" strokeWidth={3.2} />
              <path d="M 10 14 L 6 24 M 10 14 L 14 24 M 38 14 L 34 24 M 38 14 L 42 24" strokeWidth={2.2} />
              <path d="M 4 24 Q 10 30 16 24 Z" />
              <path d="M 32 24 Q 38 30 44 24 Z" />
            </g>
            {/* bonus in BIG explicit brass lettering (engraved underlay) */}
            <g aria-hidden opacity={claimed ? 0.45 : 1}>
              <text
                x={15}
                y={-4.6}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Playfair Display',serif"
                fontWeight={900}
                fontSize={bonusFont}
                fill="#100D0B"
                opacity={0.7}
              >
                {m.bonusLabel}
              </text>
              <text
                x={15}
                y={-6}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Playfair Display',serif"
                fontWeight={900}
                fontSize={bonusFont}
                fill="#E8C87A"
              >
                {m.bonusLabel}
              </text>
            </g>
            {claimed && (
              <g className="pointer-events-none">
                <line x1={-14} y1={-6} x2={44} y2={-6} stroke="#C9A45C" strokeWidth={1.6} opacity={0.8} />
                <text x={15} y={11} textAnchor="middle" fontFamily="'Archivo',sans-serif" fontWeight={700} fontSize={8.5} letterSpacing={1.5} fill="#C9A45C">
                  {t('board.merchant.claimed')}
                </text>
              </g>
            )}
            {/* demand mix: tinted industry glyph chips along the board base */}
            {/* one chip per dealt merchant tile: blank = empty ring, ALL = three-trade chip */}
            {(open ? tiles : Array.from({ length: m.slots }, () => 'blank' as const)).map((tile, i) => {
              const n = open ? tiles.length : m.slots;
              const gx = (i - (n - 1) / 2) * 21;
              if (tile === 'blank')
                return (
                  <g key={`dem-${i}`} transform={`translate(${gx},${BOT - 14})`} className="pointer-events-none">
                    <circle r={8.6} fill="rgba(14,11,8,.45)" stroke="#8A6B33" strokeWidth={1.2} strokeDasharray="2.5 2.5" opacity={0.8} />
                  </g>
                );
              if (tile === 'all')
                return (
                  <g key={`dem-${i}`} transform={`translate(${gx},${BOT - 14})`} className="pointer-events-none">
                    <circle r={8.6} fill="#F4ECD8" stroke="#C9A45C" strokeWidth={1.4} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }} />
                    <text y={0.5} textAnchor="middle" dominantBaseline="central" fontFamily="'Archivo',sans-serif" fontWeight={800} fontSize={6.5} fill="#2A241C">
                      ALL
                    </text>
                  </g>
                );
              return (
                <g key={`dem-${i}`} transform={`translate(${gx},${BOT - 14})`} className="pointer-events-none">
                  <circle r={8.6} fill="#F4ECD8" stroke={INDUSTRY_COLOR[tile]} strokeWidth={1.4} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }} />
                  <IndustryGlyph ind={tile} color={INDUSTRY_COLOR[tile]} size={12} />
                </g>
              );
            })}
            {/* beer sale slots below the board: painted barrels, ghosts when drunk */}
            {Array.from({ length: barrels }, (_, i) => (
              <g key={`beer${i}`} transform={`translate(${barrelX(i)},50)`} className="pointer-events-none">
                {i < beer ? (
                  <image href="/beer-barrel.png" x={-14} y={-13} width={28} height={28} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))' }} />
                ) : (
                  <circle r={10.5} fill="rgba(14,11,8,.55)" stroke="#8A6B33" strokeWidth={1.2} strokeDasharray="3 3.5" opacity={0.7} />
                )}
              </g>
            ))}
            <title>
              {t('board.merchant.title', {
                name: m.name,
                demands: open ? demand.map((x) => INDUSTRY_LABEL[x]).join(', ') || '—' : t('board.merchant.closed'),
                beer,
                bonus: m.bonusLabel,
                claimed: claimed ? t('board.merchant.claimedSuffix') : '',
              })}
            </title>
          </g>
          {/* parchment name ribbon — identical chrome to the town ribbons
              (world coords + label counter-scale, like TownRibbons).
              v14: fades out at far zoom — the sign board, barrels and
              bonus lettering stay; only the small name plate is LOD'd. */}
          <g
            className="pointer-events-none"
            aria-hidden
            style={{
              transform: 'scale(var(--bw-ls, 1))',
              transformOrigin: `${m.x}px ${m.y + ribbonY}px`,
              transformBox: 'view-box',
              ...DETAIL_FADE,
              // keep DETAIL_FADE's opacity transition, add the counter-scale one
              transition: 'opacity 200ms ease, transform .16s ease-out',
            }}
          >
            <RibbonShape cx={m.x} cy={m.y + ribbonY} h={18} name={m.name.toUpperCase()} />
          </g>
          </g>
        );
      })}

      {/* ------- towns: painted slot tiles + village + ribbon (map-v4) ------- */}
      {TOWNS.map((town) => (
        <TownNode
          key={town.id}
          town={town}
          game={game}
          targetByKey={targetByKey}
          validsByKey={validsByKey}
          sellByKey={sellByKey}
          hoverKey={hoverKey}
          buildPick={buildPick}
          sellPicks={sellPicks}
          shaking={shake}
          isBuilding={isBuilding}
          isSelling={isSelling}
          idle={idle}
          flashing={hoverKey === town.id}
          setHover={setHover}
          pickBuild={pickBuild}
          pickSell={pickSell}
          onInvalid={onInvalid}
          onTownHover={onTownHover}
          onTownClick={onTownClick}
          onTownZoom={onTownZoom}
        />
      ))}

      {/* ------- town name ribbons (final pass: above every tile, below FX) ------- */}
      <TownRibbons towns={TOWNS} />

      {/* ------- resource cubes/barrels on built works (final pass: above ribbons, below FX) ------- */}
      <TownBadges towns={TOWNS} game={game} />

      {/* ------- placement FX: spark ring + link trace ------- */}
      <FxLayer game={game} reduced={reduced} />

      {/* ------- ghost supply lines (re-anchored to display tiles) ------- */}
      {ghost && (
        <g className="pointer-events-none">
          {ghost.tileSources.map((src, i) => {
            const [sx, sy] = displayPosFor(src.x, src.y);
            const [gx, gy] = displayPosFor(ghost.at[0], ghost.at[1]);
            return (
              <g key={i}>
                <line x1={sx} y1={sy} x2={gx} y2={gy} stroke={src.resource === 'coal' ? '#171310' : '#8A6B33'} strokeWidth={2.6} className="bw-dashflow" />
                <rect x={(sx + gx) / 2 - 14} y={(sy + gy) / 2 - 9} width={28} height={16} rx={3} fill="#171310" stroke="#8A6B33" strokeWidth={0.8} />
                <text x={(sx + gx) / 2} y={(sy + gy) / 2 + 3.5} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} fill="#F2EAD6">
                  ×{src.amount}
                </text>
              </g>
            );
          })}
          {ghost.market.map((m, i) => {
            const [gx, gy] = displayPosFor(ghost.at[0], ghost.at[1]);
            return (
              <g key={`m${i}`}>
                <line x1={WORLD_W - 52} y1={m.resource === 'coal' ? WORLD_H * 0.29 : WORLD_H * 0.71} x2={gx} y2={gy} stroke={m.resource === 'coal' ? '#171310' : '#8A6B33'} strokeWidth={2.2} strokeDasharray="3 7" className="bw-dashflow" opacity={0.8} />
                <rect x={gx + 14} y={gy - 30 - i * 20} width={52} height={17} rx={3} fill="#2C251D" stroke="#C9A45C" strokeWidth={1} />
                <text x={gx + 40} y={gy - 18 - i * 20} textAnchor="middle" fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} fill="#C9A45C">
                  {t('board.ghost.mkt', { cost: m.cost })}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
});

/* ------------------------------ board ------------------------------ */

export default function Board({
  game,
  targets,
  linkTargetsList,
  sellTargetsList,
  ghost,
  onInvalid,
}: {
  game: GameState;
  targets: BuildTarget[];
  linkTargetsList: LinkTarget[];
  sellTargetsList: SellTarget[];
  ghost: PlanGhost | null;
  onInvalid: (key: string, reason: string) => void;
}) {
  const verb = useGame((s) => s.verb);
  const pickBuild = useGame((s) => s.pickBuild);
  const pickLink = useGame((s) => s.pickLink);
  const pickSell = useGame((s) => s.pickSell);
  const setHover = useGame((s) => s.setHover);
  const hoverKey = useGame((s) => s.hoverKey);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const shake = useGame((s) => s.shake);
  const selectedCardId = useGame((s) => s.selectedCardId);
  const ceremony = useGame((s) => s.ceremony);
  const reduced = useReducedMotion();
  const t = useT();

  /* --------------------------- view state -------------------------- */
  const frame = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const [view, setViewState] = useState<View>(FIT_VIEW);
  const viewRef = useRef(view);
  /* wheel ticks accumulate into `zoomTarget` (cursor-anchored) and each one
     re-arms a short CSS transition that chases it — continuous, GPU-smooth */
  const zoomTarget = useRef<View | null>(null);
  const glideVelocity = useRef<{ vx: number; vy: number } | null>(null);
  const inertia = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; mx: number; my: number; v: View } | null>(null);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean; vx: number; vy: number; lx: number; ly: number; lt: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);
  /** last direct camera manipulation (wheel/drag/pinch/dblclick) — bot-follow yields to it */
  const lastManual = useRef(0);

  const [hoverTown, setHoverTown] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);

  /* PERF: the camera never re-renders React per frame. Two motion paths:
     - ZOOM / camera flights (glideView): a CSS transition animates the
       world layer — the compositor rescales a GPU texture, so the giant
       SVG is NOT re-rasterized at every intermediate scale (that re-raster
       was the zoom jank; measured ~2× the frame budget). One crisp
       re-raster happens at settle, when React state commits.
     - PAN (drag / flick glide): translate-only writes never re-raster, so
       they go straight to the DOM every frame (applyView).
     Motion mode CSS: `bw-panning` / `bw-zooming` are pure markers (LOD
     thresholds stay frozen while moving). Nothing is hidden or paused
     during gestures: ambiance animations run on the compositor
     (will-change promotions) or tick at a few Hz (stepped SVG water), so
     the board stays fully alive mid-gesture without re-raster storms. */
  const motionMode = useRef<'pan' | 'zoom' | null>(null);
  const setMotion = useCallback((mode: 'pan' | 'zoom' | null) => {
    if (motionMode.current === mode) return;
    motionMode.current = mode;
    const el = worldEl.current;
    if (!el) return;
    el.classList.toggle('bw-panning', mode === 'pan');
    el.classList.toggle('bw-zooming', mode === 'zoom');
  }, []);

  const settleTimer = useRef<number | null>(null);

  /** write the camera transform; with animateMs the compositor interpolates */
  const writeTransform = useCallback((v: View, animateMs: number | null) => {
    const el = worldEl.current;
    if (!el) return;
    const { w, h } = sizeRef.current;
    const sc = fitScale(w, h) * v.k;
    el.style.transition = animateMs ? `transform ${animateMs}ms cubic-bezier(.22,.61,.21,1)` : 'none';
    el.style.transform = `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${sc})`;
  }, []);

  /** instant camera write (drag / pinch / flick-glide frames) */
  const applyView = useCallback(
    (v: View) => {
      viewRef.current = v;
      writeTransform(v, null);
    },
    [writeTransform],
  );

  const lastCommit = useRef(0);
  /** throttled React sync so the minimap / tooltips roughly track a gesture */
  const tickCommit = useCallback(() => {
    const now = performance.now();
    if (now - lastCommit.current > 120) {
      lastCommit.current = now;
      setViewState(viewRef.current);
    }
  }, []);

  /** full sync: DOM transform (idempotent) + React state, motion mode off */
  const setView = useCallback(
    (v: View) => {
      applyView(v);
      setMotion(null);
      setViewState(v);
    },
    [applyView, setMotion],
  );

  const clearSettle = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  /** crisp re-raster commit once a compositor glide has landed */
  const scheduleSettle = useCallback(
    (v: View, ms: number) => {
      clearSettle();
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = null;
        zoomTarget.current = null;
        setView(v);
      }, ms + 70);
    },
    [clearSettle, setView],
  );

  /** zoom / camera flight without per-frame re-raster: CSS-transition the
     layer transform, commit React state once at the end */
  const glideView = useCallback(
    (v: View, ms = 180) => {
      setMotion('zoom');
      viewRef.current = v;
      writeTransform(v, ms);
      scheduleSettle(v, ms);
    },
    [setMotion, writeTransform, scheduleSettle],
  );

  /** adopt the on-screen (possibly mid-transition) camera as the new truth —
      used when a manual gesture interrupts a compositor glide */
  const syncFromDOM = useCallback(() => {
    const el = worldEl.current;
    if (!el) return;
    const css = getComputedStyle(el).transform;
    if (!css || css === 'none') return;
    const m = new DOMMatrixReadOnly(css);
    if (!m.is2D || m.a === 0) return;
    const { w, h } = sizeRef.current;
    const f = fitScale(w, h);
    if (f === 0) return;
    // M = T(-W/2,-H/2) · T(x,y) · S(s)  →  x = e + W/2, y = f + H/2, k = a/fit
    viewRef.current = clampPan({ k: m.a / f, x: m.e + WORLD_W / 2, y: m.f + WORLD_H / 2 }, w, h);
    writeTransform(viewRef.current, null); // pin the visual position
  }, [writeTransform]);

  const stopInertia = useCallback(() => {
    if (inertia.current !== null) {
      cancelAnimationFrame(inertia.current);
      inertia.current = null;
    }
    zoomTarget.current = null;
    glideVelocity.current = null;
  }, []);

  /** pan momentum after a flick: translate-only frames (no re-raster),
   *  exponential friction, self-terminates at rest */
  const startInertia = useCallback(() => {
    if (inertia.current !== null) return;
    setMotion('pan');
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = glideVelocity.current;
      if (!g) {
        inertia.current = null;
        return;
      }
      const friction = Math.exp(-dt / 0.16);
      g.vx *= friction;
      g.vy *= friction;
      const { w, h } = sizeRef.current;
      if (Math.hypot(g.vx, g.vy) < 12) {
        glideVelocity.current = null;
        inertia.current = null;
        setView(clampPan(viewRef.current, w, h));
        return;
      }
      const v = viewRef.current;
      applyView(clampPan({ ...v, x: v.x + g.vx * dt, y: v.y + g.vy * dt }, w, h));
      tickCommit();
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  }, [setMotion, applyView, tickCommit, setView]);

  /** smooth ~250ms camera flight (instant under prefers-reduced-motion) */
  const animateTo = useCallback(
    (target: View) => {
      stopInertia();
      clearSettle();
      zoomTarget.current = null;
      const { w, h } = sizeRef.current;
      const t = clampPan(target, w, h);
      if (reduced || w === 0) {
        setView(t);
        return;
      }
      glideView(t, 250);
    },
    [stopInertia, clearSettle, reduced, setView, glideView],
  );

  useEffect(
    () => () => {
      stopInertia();
      clearSettle();
    },
    [stopInertia, clearSettle],
  );

  /* ------------------------- container size ------------------------ */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------ zoom entry points ---------------------- */
  const zoomStep = useCallback(
    (factor: number) => {
      const { w, h } = sizeRef.current;
      animateTo(zoomAt(viewRef.current, w / 2, h / 2, factor, w, h));
    },
    [animateTo],
  );
  const zoomIn = useCallback(() => zoomStep(1.35), [zoomStep]);
  const zoomOut = useCallback(() => zoomStep(1 / 1.35), [zoomStep]);
  const zoomFit = useCallback(() => animateTo(FIT_VIEW), [animateTo]);

  /* wheel zoom anchored to the cursor (native listener: must be non-passive).
     Each tick extends the CSS-transition chase of zoomTarget — the GPU
     rescales a texture, no SVG re-raster per frame (the old zoom jank). */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastManual.current = Date.now();
      stopInertia();
      const r = el.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
      const base = zoomTarget.current ?? viewRef.current;
      zoomTarget.current = zoomAt(base, e.clientX - r.left, e.clientY - r.top, factor, w, h);
      glideView(zoomTarget.current, 160);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stopInertia, glideView]);

  /* keyboard: + / − zoom, 0 fits the whole map, ←/→ tour the towns */
  const tourIdx = useRef(-1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === '0') zoomFit();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        tourIdx.current = (tourIdx.current + dir + TOWN_TOUR.length) % TOWN_TOUR.length;
        const town = TOWN_TOUR[tourIdx.current];
        const { w, h } = sizeRef.current;
        animateTo(centeredOn(town.x, town.y, Math.max(viewRef.current.k, 1.5), w, h));
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, zoomFit, animateTo]);

  /* ------------------------- drag pan + pinch ---------------------- */
  const onPointerDown = (e: ReactPointerEvent) => {
    stopInertia();
    clearSettle();
    syncFromDOM(); // adopt the visual position if a glide was in flight
    lastManual.current = Date.now();
    suppressClick.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      const r = frame.current!.getBoundingClientRect();
      pinch.current = {
        d: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        mx: (p1.x + p2.x) / 2 - r.left,
        my: (p1.y + p2.y) / 2 - r.top,
        v: viewRef.current,
      };
      drag.current = null;
      setDragging(false);
    } else if (pointers.current.size === 1) {
      drag.current = {
        sx: e.clientX, sy: e.clientY, x: viewRef.current.x, y: viewRef.current.y, moved: false,
        vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(),
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      setMotion('zoom'); // pinch changes the scale → same raster constraints as zoom
      const [p1, p2] = [...pointers.current.values()];
      const r = frame.current!.getBoundingClientRect();
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const mx = (p1.x + p2.x) / 2 - r.left;
      const my = (p1.y + p2.y) / 2 - r.top;
      const { w, h } = sizeRef.current;
      const v0 = pinch.current.v;
      const k2 = clampK((v0.k * d) / Math.max(1, pinch.current.d));
      const rr = k2 / v0.k;
      applyView(
        clampPan(
          { k: k2, x: mx - w / 2 - (pinch.current.mx - w / 2 - v0.x) * rr, y: my - h / 2 - (pinch.current.my - h / 2 - v0.y) * rr },
          w,
          h,
        ),
      );
      tickCommit();
      return;
    }

    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      drag.current.moved = true;
      suppressClick.current = true;
      if (!dragging) setDragging(true);
    }
    if (drag.current.moved) {
      setMotion('pan');
      /* smoothed pointer velocity (px/s) for the release glide */
      const now = performance.now();
      const dt = (now - drag.current.lt) / 1000;
      if (dt > 0.008) {
        drag.current.vx = drag.current.vx * 0.65 + ((e.clientX - drag.current.lx) / dt) * 0.35;
        drag.current.vy = drag.current.vy * 0.65 + ((e.clientY - drag.current.ly) / dt) * 0.35;
        drag.current.lx = e.clientX;
        drag.current.ly = e.clientY;
        drag.current.lt = now;
      }
      const { w, h } = sizeRef.current;
      applyView(clampPan({ ...viewRef.current, x: drag.current.x + dx, y: drag.current.y + dy }, w, h));
      tickCommit();
    }
  };

  const endPointer = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current && pointers.current.size < 2) {
      pinch.current = null;
      setViewState(viewRef.current); // sync committed state after the two-finger zoom
      // resume a one-finger drag from the remaining pointer
      const rest = [...pointers.current.values()][0];
      if (rest) {
        drag.current = {
          sx: rest.x, sy: rest.y, x: viewRef.current.x, y: viewRef.current.y, moved: true,
          vx: 0, vy: 0, lx: rest.x, ly: rest.y, lt: performance.now(),
        };
        return;
      }
    }
    if (pointers.current.size === 0) {
      /* flick: hand the last drag velocity to the inertia loop, unless the
         pointer was held still before release (>120ms → treat as a stop) */
      const d = drag.current;
      if (d?.moved && performance.now() - d.lt < 120 && Math.hypot(d.vx, d.vy) > 40) {
        glideVelocity.current = { vx: d.vx, vy: d.vy };
        startInertia(); // commits + exits motion mode at rest
      } else {
        setView(viewRef.current); // commit the gesture, motion mode off
      }
      drag.current = null;
      setDragging(false);
    }
  };

  /* double-click steps in (Shift+double-click steps out), cursor-anchored */
  const onDoubleClick = (e: ReactMouseEvent) => {
    lastManual.current = Date.now();
    const r = frame.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    animateTo(zoomAt(viewRef.current, e.clientX - r.left, e.clientY - r.top, e.shiftKey ? 1 / 1.6 : 1.6, w, h));
  };

  /* click-away closes the town inspector */
  const onFrameClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (inspect) setInspect(null);
  };

  /* ---------------------------- modes ------------------------------ */
  const isBuilding = verb === 'build' && !!selectedCardId;
  const isNetworking = verb === 'network' && !!selectedCardId;
  const isSelling = verb === 'sell' && !!selectedCardId;
  const idle = !selectedCardId;

  /* planning mode cancels board browsing affordances (render-time adjustment) */
  const [prevIdle, setPrevIdle] = useState(idle);
  if (prevIdle !== idle) {
    setPrevIdle(idle);
    if (!idle) {
      setHoverTown(null);
      setHoverLink(null);
      setInspect(null);
    }
  }

  /* Esc closes the inspector */
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const onTownClick = useCallback((id: string) => setInspect(id), []);
  const onTownHover = useCallback((id: string | null) => setHoverTown(id), []);
  const onLinkHover = useCallback((id: string | null) => setHoverLink(id), []);
  /* double-click on a town flies the camera to it (simple click keeps the inspector) */
  const onTownZoom = useCallback(
    (id: string) => {
      const town = TOWN_BY_ID[id];
      if (town) zoomHere(town.x, town.y, Math.max(viewRef.current.k, 1.8));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const zoomHere = useCallback(
    (wx: number, wy: number, k = 1.8) => {
      const { w, h } = sizeRef.current;
      animateTo(centeredOn(wx, wy, k, w, h));
    },
    [animateTo],
  );

  const minimapCenter = useCallback(
    (wx: number, wy: number) => {
      stopInertia();
      clearSettle();
      const { w, h } = sizeRef.current;
      setView(centeredOn(wx, wy, viewRef.current.k, w, h));
    },
    [stopInertia, clearSettle, setView],
  );

  /* --------------------- camera: fly-to & bot follow ---------------- */
  const flyTo = useGame((s) => s.flyTo);
  const followBots = useGame((s) => s.followBots);
  const spotlight = useGame((s) => s.spotlight);

  /* Ledger click (or any flyToRegion caller): glide the camera to the
     town / merchant / link, keeping the current zoom if it is deeper */
  useEffect(() => {
    if (!flyTo) return;
    const pos = regionPos(flyTo.key);
    if (pos) zoomHere(pos[0], pos[1], Math.max(viewRef.current.k, 1.5));
  }, [flyTo, zoomHere]);

  /* follow-the-bots camera: when a bot's action lands on the map, glide
     there — unless the user grabbed the camera in the last few seconds */
  useEffect(() => {
    if (!followBots || !game.ledger.length) return;
    const e = game.ledger[game.ledger.length - 1];
    if (!e?.region || e.player === undefined || !game.players[e.player]?.isBot) return;
    if (Date.now() - lastManual.current < 4000) return;
    const pos = regionPos(e.region);
    if (pos) zoomHere(pos[0], pos[1], Math.max(viewRef.current.k, 1.4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.ledgerSeq, followBots, zoomHere]);

  /* --------------------------- derived ----------------------------- */
  /* live ref — at rest it equals the committed state; mid-gesture it is
     the latest frame, so a stray re-render (throttled commit, store
     update) can never snap the camera back to a stale transform */
  const live = viewRef.current;
  const s = fitScale(size.w, size.h) * live.k;
  /* While the camera is moving the LOD thresholds stay frozen at their
     at-rest values — re-evaluated only once the view settles, so
     `--bw-detail` / `--bw-schematic` never flip mid-gesture (style-recalc
     storm + visual popping). Continuous vars (`--bw-ls`, `--bw-ring`)
     refresh on the throttled commits; the ribbon transition smooths them. */
  const inMotion = motionMode.current !== null;
  const settledS = useRef(s);
  if (!inMotion) settledS.current = s;
  const lodS = inMotion ? settledS.current : s;
  const worldStyle = {
    left: '50%',
    top: '50%',
    width: WORLD_W,
    height: WORLD_H,
    transform: `translate(-50%, -50%) translate(${live.x}px, ${live.y}px) scale(${s})`,
    willChange: 'transform',
    // v11: ribbon counter-scale + screen floor — plaque text never drops
    // below 13px on screen, at any zoom or container fit. Tiles, cubes
    // and industry chips keep their world size; only plaques grow.
    // v14: floor capped at RIBBON_MAX_SCALE so deep zoom-out can no
    // longer blow plaques over the whole map.
    '--bw-ls': ribbonLabelScale(view.k, fitScale(size.w, size.h), RIBBON_FONT),
    '--bw-lsv': 1 + (labelScale(view.k) - 1) * 0.35,
    // v14 far-zoom LOD: single threshold evaluation — below
    // FAR_LOD_SCREEN the fine details (income/VP chips, level pips,
    // etched marks, merchant ribbons) fade out via `var(--bw-detail)`.
    // Frozen while the camera moves (lodS), re-evaluated at rest.
    '--bw-detail': lodS < FAR_LOD_SCREEN ? 0 : 1,
    // v15 industry readability: single threshold evaluation — below
    // SCHEMATIC_SCREEN (a 56px tile renders under ~50 screen px) tiles
    // switch to schematic mode: painting steps back, a large parchment
    // industry glyph on a tinted disc takes over (TownNode.tsx).
    '--bw-schematic': lodS < SCHEMATIC_SCREEN ? 1 : 0,
    // v15: per-industry ring/halo intensity — full at low zoom where it
    // carries the readability, attenuated past s > 1.1 so the thin ring
    // never fights the close-up engraving detail.
    '--bw-ring': s <= 1.1 ? 1 : Math.max(0.6, 1 - (s - 1.1) * 0.8),
  } as CSSProperties;

  const inspectTown = idle && inspect ? TOWN_BY_ID[inspect] : undefined;
  const inspectPos = inspectTown ? worldToScreen(inspectTown.x, inspectTown.y, view, size.w, size.h) : null;
  const hoverTownDef = idle && hoverTown && !inspect ? TOWN_BY_ID[hoverTown] : undefined;
  const hoverTownPos = hoverTownDef ? worldToScreen(hoverTownDef.x, hoverTownDef.y, view, size.w, size.h) : null;
  const hoverLinkDef = idle && hoverLink ? LINKS.find((l) => l.id === hoverLink) : undefined;
  const hoverLinkPos = hoverLinkDef ? worldToScreen(...linkMid(hoverLinkDef), view, size.w, size.h) : null;
  const hoverLinkBuilt = hoverLinkDef ? game.links[hoverLinkDef.id] : undefined;

  return (
    <div
      ref={frame}
      className="relative h-full w-full select-none overflow-hidden rounded-md"
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onClick={onFrameClick}
      onDoubleClick={onDoubleClick}
      aria-label={t('board.ariaLabel')}
      role="application"
    >
      <style>{`
        .bw-dashflow { stroke-dasharray: 7 6; animation: bw-dash 1.1s linear infinite; }
        @keyframes bw-dash { to { stroke-dashoffset: -26; } }
        /* stepped variants: dashoffset/opacity advance a few times per
           second instead of every frame — invisible on slow water effects,
           and the SVG stops repainting 60×/s (measured: the dominant
           idle/pan cost came from ~30 always-on watersheen paths) */
        .bw-waterflow { stroke-dasharray: 9 15; animation: bw-water 7s steps(49) infinite; }
        @keyframes bw-water { to { stroke-dashoffset: -48; } }
        .bw-watersheen { animation: bw-sheen 6.5s steps(13) infinite; }
        @keyframes bw-sheen { 0%,100% { opacity: .22 } 50% { opacity: .58 } }
        .bw-etchdraw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: bw-etchdraw 1.5s ease-in-out both; }
        @keyframes bw-etchdraw { 0% { stroke-dashoffset: 1; opacity: .65; } 78% { stroke-dashoffset: 0; opacity: .65; } 100% { stroke-dashoffset: 0; opacity: 0; } }
        .bw-etchin { opacity: 0; animation: bw-etchin .5s ease-out both; }
        @keyframes bw-etchin { to { opacity: 1; } }
        .bw-slotpulse { animation: bw-pulse 1.4s ease-in-out infinite; }
        @keyframes bw-pulse { 0%,100% { opacity: .9 } 50% { opacity: .25 } }
        .bw-shake { animation: bw-shake .32s ease; }
        @keyframes bw-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2.5px)} 75%{transform:translateX(2.5px)} }
        /* player spotlight (PlayerRail click): every owned tile/link not
           belonging to the spotlighted seat dims back so one network reads
           at a glance; the seat's own pieces keep full contrast */
        [data-owner] { transition: opacity .35s ease; }
        .bw-spot-0 [data-owner]:not([data-owner="0"]),
        .bw-spot-1 [data-owner]:not([data-owner="1"]),
        .bw-spot-2 [data-owner]:not([data-owner="2"]),
        .bw-spot-3 [data-owner]:not([data-owner="3"]) { opacity: .3; }
        /* camera motion modes: bw-panning / bw-zooming are pure markers
           (LOD thresholds stay frozen while moving). Nothing is hidden or
           paused any more: the ambiance animations run on the compositor
           (will-change promotions) or tick at a few Hz (stepped SVG
           water), so a gesture no longer makes anything vanish. */
        @media (prefers-reduced-motion: reduce) {
          .bw-dashflow, .bw-slotpulse, .bw-shake, .bw-waterflow, .bw-watersheen, .bw-etchdraw, .bw-etchin { animation: none !important; }
        }
      `}</style>

      {/* world surface: 3200×1800 (16:9), centred + scaled */}
      <div ref={worldEl} className={cn('absolute', spotlight !== null && `bw-spot-${spotlight}`)} style={worldStyle}>
        <WorldArt era={game.era} />
        {/* ambiance layers — fully alive during pan AND zoom */}
        <div aria-hidden className="bw-ambiance pointer-events-none absolute inset-0">
          <AtmosphereLayer era={game.era} reduced={reduced} />
          {/* animated light on the painted rivers (world coords, screen blend) */}
          <RiverSheen reduced={reduced} />
          {/* lantern halos over towns & merchants (world coords — pans/zooms with the map) */}
          <TownLamplight game={game} reduced={reduced} />
        </div>
        <BoardSvg
          game={game}
          targets={targets}
          linkTargetsList={linkTargetsList}
          sellTargetsList={sellTargetsList}
          ghost={ghost}
          hoverKey={hoverKey}
          buildPick={buildPick}
          linkPick={linkPick}
          sellPicks={sellPicks}
          shake={shake}
          isBuilding={isBuilding}
          isNetworking={isNetworking}
          isSelling={isSelling}
          idle={idle}
          hoverTown={hoverTown}
          hoverLink={hoverLink}
          reduced={reduced}
          railReveal={ceremony === 'canal-end'}
          setHover={setHover}
          pickBuild={pickBuild}
          pickLink={pickLink}
          pickSell={pickSell}
          onInvalid={onInvalid}
          onTownHover={onTownHover}
          onTownClick={onTownClick}
          onTownZoom={onTownZoom}
          onLinkHover={onLinkHover}
        />
        {/* ambiance: smoking chimneys over built works (anchored to the display tiles, era-scaled) + ambient boats/trains (pointer-events: none) */}
        <div aria-hidden className="bw-ambiance pointer-events-none absolute inset-0">
          <ChimneySmoke tiles={game.tiles} era={game.era} reduced={reduced} />
          <AmbientTraffic links={game.links} reduced={reduced} />
        </div>
      </div>

      {/* fixed lighting: darkened corners + warm lamp halo */}
      <VignetteLamp era={game.era} />

      {/* board-edge inner shadow for relief */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-md shadow-[inset_0_0_60px_rgba(0,0,0,.35)]" />

      {/* beta ribbon: merchant tiles/availability + market sizes remain simplified */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 overflow-hidden rounded-sm">
        <span className="beta-ribbon !static !transform-none block !px-2 !py-1" title={t('board.beta.title')}>
          {t('board.beta.label')}
        </span>
      </div>

      {/* town hover tooltip (idle browsing) — flips below near the top edge */}
      {hoverTownDef && hoverTownPos && (
        <div
          className="pointer-events-none absolute z-30 w-[248px] rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 shadow-e3"
          style={
            hoverTownPos[1] > 210
              ? { left: hoverTownPos[0], top: hoverTownPos[1] - 34, transform: 'translate(-50%, -100%)' }
              : { left: hoverTownPos[0], top: hoverTownPos[1] + 44, transform: 'translate(-50%, 0)' }
          }
          role="tooltip"
        >
          <TownCardContent town={hoverTownDef} game={game} />
          <div className="mt-1.5 border-t border-brass-700/40 pt-1 font-sans text-[10px] uppercase tracking-wider text-cream-100/45">
            {t('board.hover.townHint')}
          </div>
        </div>
      )}

      {/* link hover tooltip (idle browsing) */}
      {hoverLinkDef && hoverLinkPos && (
        <div
          className="pointer-events-none absolute z-30 w-[220px] rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 shadow-e3"
          style={
            hoverLinkPos[1] > 150
              ? { left: hoverLinkPos[0], top: hoverLinkPos[1] - 16, transform: 'translate(-50%, -100%)' }
              : { left: hoverLinkPos[0], top: hoverLinkPos[1] + 20, transform: 'translate(-50%, 0)' }
          }
          role="tooltip"
        >
          <div className="font-fell text-[14px] tracking-wide text-brass-400">
            {hoverLinkBuilt
              ? hoverLinkBuilt.era === 'rail'
                ? t('board.link.railLine')
                : t('board.link.canalLine')
              : hoverLinkDef.canal && hoverLinkDef.rail
                ? t('board.link.canalOrRail')
                : hoverLinkDef.canal
                  ? t('board.link.canalLink')
                  : t('board.link.railLink')}
          </div>
          <div className="my-1.5 h-px bg-brass-700/50" />
          <div className="font-sans text-[12px] leading-relaxed text-cream-100/90">
            {nodeName(hoverLinkDef.a)} ↔ {nodeName(hoverLinkDef.b)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-sans text-[11.5px] text-cream-100/65">
            {hoverLinkBuilt ? (
              <>
                <ShapeChip color={game.players[hoverLinkBuilt.owner].color} />
                {t('board.link.builtBy', {
                  name: game.players[hoverLinkBuilt.owner].name,
                  era: t(`board.era.${hoverLinkBuilt.era}`),
                })}
              </>
            ) : (
              t('board.link.unbuilt')
            )}
          </div>
        </div>
      )}

      {/* town inspector popover */}
      <AnimatePresence>
        {inspectTown && inspectPos && (
          <TownInspector
            key={inspectTown.id}
            town={inspectTown}
            game={game}
            x={inspectPos[0]}
            y={inspectPos[1]}
            frameW={size.w}
            frameH={size.h}
            onClose={() => setInspect(null)}
            onZoomHere={() => zoomHere(inspectTown.x, inspectTown.y)}
          />
        )}
      </AnimatePresence>

      {/* zoom toolbar */}
      <ZoomControls k={view.k} onZoomIn={zoomIn} onZoomOut={zoomOut} />

      {/* minimap */}
      <Minimap view={view} container={size} onCenter={minimapCenter} era={game.era} game={game} />

      {/* invalid-target reason toast */}
      <AnimatePresence>
        {shake && (
          <motion.div
            key={shake.at}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-md border border-rust-500 bg-coal-900/95 px-3 py-1.5 font-sans text-xs text-cream-100 shadow-e3"
            role="alert"
          >
            {shake.reason}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- FX -------------------------------- */

function FxLayer({ game, reduced }: { game: GameState; reduced: boolean }) {
  const [fx, setFx] = useState<{ seq: number; kind: string; at: [number, number]; linkId?: string } | null>(null);

  useEffect(() => {
    if (!game.lastFx || game.fxSeq === fx?.seq) return;
    setFx({ seq: game.fxSeq, kind: game.lastFx.kind, at: game.lastFx.at, linkId: game.lastFx.linkId });
    const t = window.setTimeout(() => setFx(null), reduced ? 250 : 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fxSeq]);

  if (!fx || reduced) return null;

  if (fx.kind === 'link' && fx.linkId) {
    const def = LINKS.find((d) => d.id === fx.linkId)!;
    const d = linkPath(def);
    const [mx, my] = linkMid(def);
    return (
      <g className="pointer-events-none">
        <motion.path
          d={d}
          fill="none"
          stroke="#DDBE7E"
          strokeWidth={4}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        <motion.image
          href={game.era === 'canal' ? '/icon-canal.svg' : '/icon-rail.svg'}
          width={26}
          height={26}
          initial={{ x: NODE_POS[def.a][0] - 13, y: NODE_POS[def.a][1] - 13, opacity: 0 }}
          animate={{ x: [NODE_POS[def.a][0] - 13, mx - 13, NODE_POS[def.b][0] - 13], y: [NODE_POS[def.a][1] - 13, my - 13, NODE_POS[def.b][1] - 13], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.25 }}
        />
      </g>
    );
  }

  // build / sell / develop — brass spark ring (re-anchored to display tile)
  const at = displayPosFor(fx.at[0], fx.at[1]);
  const sparks = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  return (
    <g className="pointer-events-none">
      <motion.circle
        cx={at[0]}
        cy={at[1]}
        fill="none"
        stroke="#C9A45C"
        strokeWidth={2.5}
        initial={{ r: 6, opacity: 0.9 }}
        animate={{ r: 46, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {sparks.map((a, i) => (
        <motion.circle
          key={i}
          cx={at[0]}
          cy={at[1]}
          r={2.6}
          fill="#DDBE7E"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: 0 }}
          transition={{ duration: 0.45, delay: i * 0.03, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
}
