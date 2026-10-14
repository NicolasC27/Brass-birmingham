import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Assets, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { AnimatePresence, motion } from 'framer-motion';
import { activeBoard, LINKS, MERCHANTS, MERCHANT_BY_ID, PLAYER_COLORS, TOWNS, TOWN_BY_ID } from '@/game/data';
import { merchantBarrelSlots, merchantBeerLeft, merchantDemand, merchantOpen, networkTowns, sellTargets, tileKey } from '@/game/engine';
import type { BuildTarget, LinkTarget, SellTarget } from '@/game/engine';
import type { PlanGhost } from '@/game/ghost';
import { BoardLostPlate } from '@/components/game/TitleCard';
import type { Era, GameState } from '@/game/types';
import { lastActionOf, projectQueued, useGame, verbsForCard } from '@/game/store';
import { WhyLink } from '@/components/game/RulesOverlay';
import { money, onLangChange, reasonText, tr, useT } from '@/i18n';
import { aidOn, getBoardOptions, mapUrls, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import { useReducedMotion } from '@/components/game/useReducedMotion';
import { WORLD_H, WORLD_W, farDetail, fitScale, placeAnchor, ribbonLabelScale, screenToWorld, subscribeFitReserve, worldToScreen, BLEED_X, BLEED_Y, GLIMPSE_MS } from '@/components/game/boardView';
import type { AnchorRegistry, MapAnchor, View } from '@/components/game/boardView';
import { RIBBON_FONT, TILE_HALF, displayPosFor, townChrome } from '@/components/game/townChrome';
import { routeFor } from '@/components/game/routePaths';
import Minimap from '@/components/game/Minimap';
import TownInspector from '@/components/game/TownInspector';
import VoiceBubble from '@/components/game/VoiceBubble';
import Anchored from '@/components/game/Anchored';
import VignetteLamp from '@/components/game/ambiance/VignetteLamp';
import { Camera } from './camera';
import { CASING, boardAssetTally, buildBoardScene, drawOwnerMedallion, holdBoardAssets, industryFaceUrl, loadBoardAssets, tileFaceUrl, wearSheets } from './paint';
import type { Prepared } from '@/game/store';
import type { GameAction } from '@/game/actions';
import { closeAudio, houseHover, pingTap, stampThud } from './sfx';
import { ROW_SCALE, rowLift, rowWidth } from './merchantRow';
import { EMPTY_PROVENANCE, provenance, slotAt as slotPos } from './provenance';
import { STAMP_IMPACT_S, STAMP_S, freshPieces, inkBloom, stampPose } from './stamp';
import { cn } from '@/lib/utils';
import type { StockStyle } from './paint';
import { buildAmbiance } from './ambiance';
import { flooredScale } from './floor';
import { isKey, typing } from '@/components/game/keybindings';
import { HOVERED, stateInk } from '@/components/game/stateInks';
import type { Ambiance } from './ambiance';

const TILE_R = TILE_HALF;
/** the files a map style lays on the table */
const sheetList = (u: ReturnType<typeof mapUrls>): string[] => [u.canal, u.rail, ...(u.etch ? [u.etch.canal, u.etch.rail] : [])];
/** the whole printed table, bleed included, in world units: the one area a
 *  veil or the night is laid over, so the filter never walks the sheet's
 *  children for its bounds each frame */
const TABLE_AREA = new Rectangle(-BLEED_X, -BLEED_Y, WORLD_W + 2 * BLEED_X, WORLD_H + 2 * BLEED_Y);
/** how long the table dims for another seat's move (its last half-second a
 *  fade): kept well under the pace the machines are played at, whatever
 *  that pace is (GLIMPSE_MS, the store's own clock for the glimpse) */
const GLIMPSE_VEIL_MS = Math.min(1400, GLIMPSE_MS);
const GLIMPSE_FADE_MS = 500;

/* a refusal, as a small ledger note: a rust seal, the word in small caps,
   the sentence in the book's hand; a notch points at the place refused */
function RefusalNote({ text, notch, wide }: { text: string; notch?: 'up' | 'down'; wide?: boolean }) {
  const reason = useGame((s) => s.shake?.reason);
  const verb = useGame((s) => s.verb);
  return (
    <div className={cn('relative flex items-start gap-2 rounded-md border border-brass-700/50 bg-coal-900/[.97] py-1.5 pl-2 pr-3 text-left shadow-e3', wide ? 'max-w-[440px]' : 'max-w-[300px]')} role="alert">
      <span aria-hidden className="tex-paper pointer-events-none absolute inset-0 rounded-md opacity-[0.06]" />
      <span aria-hidden className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-rust-500/90 to-transparent" />
      <span aria-hidden className="relative mt-[5px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-rust-500 shadow-[0_0_0_1px_rgba(0,0,0,.7),inset_0_1px_1px_rgba(255,255,255,.28),0_0_8px_rgba(196,74,42,.5)]">
        <span className="h-1.5 w-1.5 rounded-full bg-rust-700/80" />
      </span>
      <span className="relative flex min-w-0 flex-col leading-tight">
        <span className="font-sans text-[8px] font-bold uppercase tracking-[0.2em] text-rust-500 brightness-150">{tr('board.refusal.label')}</span>
        <span className="font-fell text-[13px] leading-snug text-cream-100">{text}</span>
      </span>
      {/* the rule behind the no, on the label's line so the bubble keeps its size */}
      {reason && <WhyLink reason={reason} verb={verb} className="absolute right-3 top-1 !text-[9px] tracking-wide" />}
      {notch && (
        <span
          aria-hidden
          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-brass-700/50 bg-coal-900"
          style={notch === 'up' ? { bottom: -6, borderRight: '1px solid', borderBottom: '1px solid' } : { top: -6, borderLeft: '1px solid', borderTop: '1px solid' }}
        />
      )}
    </div>
  );
}

function linkMidWorld(def: (typeof LINKS)[number], era: Era): [number, number] {
  /* most links have no explicit path — routeFor computes the winding route */
  return routeFor(def, era).mid;
}

/* ------------------------------------------------------------------ */
/* PixiBoard — full WebGL replacement for the SVG Board. Same props,   */
/* same store contracts, same HUD overlays (React on top); only the    */
/* map itself is a GPU sprite scene.                                   */
/* ------------------------------------------------------------------ */

interface Props {
  game: GameState;
  targets: BuildTarget[];
  linkTargetsList: LinkTarget[];
  sellTargetsList: SellTarget[];
  ghost: PlanGhost | null;
  onInvalid: (key: string, reason: string) => void;
  /** off for a read-only board (replay): no town tour, zoom or option keys */
  keyboard?: boolean;
  /** fly the camera here whenever `seq` changes (replay follows the action) */
  focus?: { at: [number, number]; seq: number } | null;
  /** the orders for my turn shown in colour over a sepia table */
  preview?: ({ kind: 'orders'; queued: Prepared[]; actor: number } | { kind: 'player'; seat: number; transient?: boolean; at?: number }) & { empires?: number[] } | null;
}

/** the moves a survey paints: the orders, numbered, or a seat's last move
 *  (every action of the game is in the log; the ledger says which was theirs last) */
function surveyMoves(preview: NonNullable<Props['preview']>, game: GameState): { action: GameAction; n: number | null }[] {
  if (preview.kind === 'orders') return preview.queued.map((q, i) => ({ action: q.action, n: i + 1 }));
  const last = lastActionOf(game, preview.seat);
  const action = last >= 0 ? game.actions[last] : undefined;
  return action ? [{ action, n: null }] : [];
}

/** world coords for anything a ledger entry can point at */
/** a polyline, point after point, into a graphics */
function trace(g: Graphics, pts: number[][]): void {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
}

function regionPos(key: string, era: Era): [number, number] | null {
  const town = TOWN_BY_ID[key];
  if (town) return [town.x, town.y];
  const merchant = MERCHANT_BY_ID[key];
  if (merchant) return [merchant.x, merchant.y];
  const link = LINKS.find((l) => l.id === key);
  if (link) return routeFor(link, era).mid;
  return null;
}

/** dashed stroke along a polyline (Pixi has no native dasharray); `offset`
 *  slides the pattern along the path, which is how the supply lines march */
function dashPath(g: Graphics, pts: number[][], dash: number, gap: number, offset = 0): void {
  const period = dash + gap;
  const pos = ((offset % period) + period) % period;
  let drawing = pos < dash;
  let remain = drawing ? dash - pos : period - pos;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    let t = 0;
    while (t < len) {
      const step = Math.min(remain, len - t);
      if (drawing) {
        g.moveTo(ax + ((bx - ax) / len) * t, ay + ((by - ay) / len) * t);
        g.lineTo(ax + ((bx - ax) / len) * (t + step), ay + ((by - ay) / len) * (t + step));
      }
      t += step;
      remain -= step;
      if (remain <= 0.0001) {
        drawing = !drawing;
        remain = drawing ? dash : gap;
      }
    }
  }
}

/* ------------- the planning marks: one grammar of state ------------- */
/* stateInks.ts: a candidate wears the state ink faint, the one picked the
   same ink pale and full, the one under the pointer a thin cream edge —
   the same for a place to build, a link to lay and a works to sell from */

/** a dark £-plaque centred at (cx, cy) */
function priceTag(cx: number, cy: number, w: number, h: number, label: string): [Graphics, Text] {
  const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, 3).fill(0x2c251d).stroke({ width: 1, color: 0xc9a45c });
  g.position.set(cx, cy);
  g.eventMode = 'none';
  const txt = new Text({ text: label, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fill: 0xc9a45c } });
  txt.anchor.set(0.5);
  txt.position.set(cx, cy);
  txt.eventMode = 'none';
  return [g, txt];
}

/** a slot in the state grammar: a soft halo outside, a firm ring on the
 *  tile's edge, and (for an empty place) a tint inside */
function slotMark(x: number, y: number, picked: boolean, tint: boolean): Graphics {
  const ink = stateInk(picked);
  const g = new Graphics()
    .roundRect(x - TILE_R - 5, y - TILE_R - 5, TILE_R * 2 + 10, TILE_R * 2 + 10, 13)
    .stroke({ width: 8, color: ink.color, alpha: ink.halo })
    .roundRect(x - TILE_R, y - TILE_R, TILE_R * 2, TILE_R * 2, 9);
  if (tint) g.fill({ color: ink.color, alpha: ink.fill });
  g.stroke({ width: ink.width, color: ink.color });
  g.eventMode = 'none';
  return g;
}

/** the cream edge of the slot under the pointer, just outside its ring */
function slotHoverEdge(x: number, y: number, picked: boolean): Graphics {
  const r = TILE_R + stateInk(picked).width / 2 + HOVERED.width / 2;
  const g = new Graphics().roundRect(x - r, y - r, r * 2, r * 2, 10).stroke({ width: HOVERED.width, color: HOVERED.color, alpha: HOVERED.alpha });
  g.eventMode = 'none';
  return g;
}

/** a link's core width in the state grammar (a route reads a notch wider than a ring) */
const linkCore = (picked: boolean): number => stateInk(picked).width + 1;

/** a link in the state grammar: a wide soft halo, the ink along the route */
function linkMark(pts: number[][], picked: boolean): Graphics {
  const ink = stateInk(picked);
  const g = new Graphics();
  trace(g, pts);
  g.stroke({ width: linkCore(picked) * 2 + 2, color: ink.color, alpha: ink.halo, cap: 'round', join: 'round' });
  trace(g, pts);
  g.stroke({ width: linkCore(picked), color: ink.color, cap: 'round', join: 'round' });
  g.eventMode = 'none';
  return g;
}

/** the link under the pointer: its ink again, edged in cream on both sides */
function linkHoverEdge(pts: number[][], picked: boolean): Graphics {
  const ink = stateInk(picked);
  const g = new Graphics();
  trace(g, pts);
  g.stroke({ width: linkCore(picked) + HOVERED.width * 2, color: HOVERED.color, alpha: HOVERED.alpha, cap: 'round', join: 'round' });
  trace(g, pts);
  g.stroke({ width: linkCore(picked), color: ink.color, cap: 'round', join: 'round' });
  g.eventMode = 'none';
  return g;
}

/** the flowing dashes of a link picked or under the pointer */
function linkDashes(pts: number[][]): Graphics {
  const d = new Graphics();
  dashPath(d, pts, 7, 6);
  d.stroke({ width: 2.4, color: 0xddbe7e, cap: 'round', join: 'round' });
  d.eventMode = 'none';
  return d;
}

/* ------------- the supply arrows: where a move's goods come from ------------- */
/* While a move is prepared, a straight arrow runs from each mine, works,
   brewery or barrel that gives it coal, iron or beer to the place the
   cubes are spent: a pale casing under a core in the colour of what it
   carries, so it reads on water, hills and towns alike, the count on a
   plaque at mid-way. The cubes bought at the exchange come in from its
   own tray, and those a new works sells go out to it. */

/** the core of an arrow: coal near-black, iron the orange of the
 *  exchange, beer amber */
const coreOf = (resource: string): number => (resource === 'coal' ? 0x171310 : resource === 'beer' ? 0xd9a441 : 0xe07020);
/** the edge of a plaque or a ring: coal's black would not read, so brass */
const edgeOf = (resource: string): number => (coreOf(resource) === 0x171310 ? 0xc9a45c : coreOf(resource));

/** a supply line from the exchange to the works being planned: the
 *  exchange is a panel of the page, not of the board, so the line is
 *  redrawn every frame from wherever its coal or iron tray stands on
 *  screen, with a sliding dash offset that marches toward the works */
interface March {
  g: Graphics;
  tray: 'coal' | 'iron';
  /** the works, in world coordinates */
  to: [number, number];
  color: number;
  /** the plaque (cubes and price), kept on the line a little way from the works */
  tag: Container;
  /** the plaque's distance from the works along the line */
  along: number;
  /** how far short of `to` the head stops: a card's half, or 0 on a route */
  stop?: number;
  /** the cubes go to the exchange, not away from it: the dashes and the
   *  arrow run the other way, and the line is the colour of a gain */
  selling?: boolean;
}

/** an arrowhead at (gx,gy) pointing away from (sx,sy), stopping `back` short */
function arrowHead(sx: number, sy: number, gx: number, gy: number, back: number): number[] {
  const dx = gx - sx;
  const dy = gy - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tipX = gx - ux * back;
  const tipY = gy - uy * back;
  const baseX = tipX - ux * 13;
  const baseY = tipY - uy * 13;
  return [tipX, tipY, baseX - uy * 7, baseY + ux * 7, baseX + uy * 7, baseY - ux * 7];
}

/** a supply line's geometry: it stops short of the tile (or, `stop` 0,
 *  of the route it feeds), on an arrowhead */
function supplyLine(sx: number, sy: number, gx: number, gy: number, stop = TILE_R): { end: [number, number]; head: number[] } {
  const len = Math.hypot(gx - sx, gy - sy) || 1;
  const back = stop + 13;
  return { end: [gx - ((gx - sx) / len) * back, gy - ((gy - sy) / len) * back], head: arrowHead(sx, sy, gx, gy, stop + 3) };
}

/* ------------------ the press (stamp.ts measures it) ------------------ */

/** when the sound of the strike is heard: the block meeting the paper */
const STAMP_IMPACT_MS = Math.round(STAMP_IMPACT_S * 1000);

/** a speck of ink squeezed out under the block: where it starts, the way
 *  it runs, how far and how big */
interface Speck {
  x: number;
  y: number;
  nx: number;
  ny: number;
  d: number;
  r: number;
}

/** a piece being struck: the card's box, or the link's drawing, and the
 *  ink it squeezes out */
interface Stamp {
  t0: number;
  box?: Container;
  link?: Graphics;
  ink: Graphics;
  specks: Speck[];
  /** a card's centre: the ink also rings its edge */
  rim?: [number, number];
}

/** the ink of one strike, on the FX layer */
function inkGfx(layer: Container): Graphics {
  const g = new Graphics();
  g.eventMode = 'none';
  layer.addChild(g);
  return g;
}

/** a handful of specks round a card's edge, each running outward */
function tileSpecks(x: number, y: number): Speck[] {
  const out: Speck[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    /* a point on the card's edge, side by side round it */
    const side = i % 4;
    const along = (Math.random() * 2 - 1) * (TILE_R - 6);
    const [px, py, nx, ny] = side === 0 ? [x + along, y - TILE_R, 0, -1] : side === 1 ? [x + TILE_R, y + along, 1, 0] : side === 2 ? [x + along, y + TILE_R, 0, 1] : [x - TILE_R, y + along, -1, 0];
    const skew = (Math.random() * 2 - 1) * 0.35;
    out.push({ x: px, y: py, nx: nx + ny * skew, ny: ny + nx * skew, d: 6 + Math.random() * 11, r: 1.8 + Math.random() * 1.8 });
  }
  return out;
}

/** specks along a new route, running off either side of it */
function routeSpecks(pts: number[][]): Speck[] {
  const out: Speck[] = [];
  if (pts.length < 2) return out;
  for (let k = 0; k < 9; k++) {
    const i = Math.min(pts.length - 2, Math.floor(((k + 0.5) / 9) * (pts.length - 1)));
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const side = k % 2 ? 1 : -1;
    const f = Math.random();
    out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, nx: (-(by - ay) / len) * side, ny: ((bx - ax) / len) * side, d: 5 + Math.random() * 8, r: 1.5 + Math.random() * 1.5 });
  }
  return out;
}

export default function PixiBoard({ game, targets, linkTargetsList, sellTargetsList, ghost, onInvalid, keyboard = true, focus = null, preview = null }: Props) {
  /* the scene paints THIS game — the store's for the live table, a replayed
     state for the reviewer — read through a ref by the ticker */
  const gameRef = useRef(game);
  gameRef.current = game;
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const t = useT();

  /* React-side overlay state (committed by the camera at ~8Hz + settle) */
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverTown, setHoverTown] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [hoverMerchant, setHoverMerchant] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  /* the HUD hung from the map (inspector, chooser, callout) and the
     minimap's frame are moved by the ticker, in the frame the map moves */
  const anchorMap = useRef(new Map<HTMLElement, MapAnchor>());
  const mmFrameRef = useRef<HTMLDivElement>(null);
  /* board display options — shared store (also driven from the settings
     panel in Game.tsx); C hides unbuilt link traces, F fullscreen */
  const opts = useBoardOptions();
  const { hideUnbuilt, bigChips, greyFreeMerchants: greyFreeMerch, stockStyle, mapStyle, railPainting, traffic, tileArt, slotArt, colorBlind, sealTiles, sealLinks, cardGrain, chipStyle, sound } = opts;
  /* the house's own sound while the pointer rests on it: its recording in
     a loop, or a bell over the door (board option) — hushed at once when
     the sound is turned off under the pointer */
  useEffect(() => {
    houseHover(hoverMerchant && sound ? hoverMerchant : null);
    return () => houseHover(null);
  }, [hoverMerchant, sound]);
  /* the table's sounds go quiet with it: the tab is no longer a sounding one */
  useEffect(() => () => closeAudio(), []);
  /* fullscreen is a keyboard-only affair now (F) — no HUD button */
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };
  const fsRef = useRef(toggleFullscreen);
  fsRef.current = toggleFullscreen;

  /* imperative handles shared between the boot effect and prop effects */
  const sceneRef = useRef<ReturnType<typeof buildBoardScene> | null>(null);
  /* the GPU may take the table's context back (a driver reset, the tab
     starved of memory): the board says so, and is set again from scratch
     once the context is handed back — the game lives in the store and at
     the office, so nothing is lost with it */
  const [glLost, setGlLost] = useState(false);
  const [glEpoch, setGlEpoch] = useState(0);
  /* counts the scenes set up: the effects that dress a scene (the veil, the
     night of a game read again) run again on a fresh one */
  const [sceneSeq, setSceneSeq] = useState(0);
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;
  /* a replayed state: repaint the scene whenever the prop changes */
  useEffect(() => {
    sceneRef.current?.redraw(game);
  }, [game]);
  useEffect(() => {
    if (focus) cameraRef.current?.flyTo(focus.at[0], focus.at[1], Math.max(cameraRef.current.target.k, 1.4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);
  const ambianceRef = useRef<Ambiance | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  /* the final register lowered to look at the board: the whole country is
     shown, not the last site the camera flew to */
  const overOpen = useGame((s) => s.gameOverOpen);
  const finished = useGame((s) => s.game?.phase === 'game-over');
  const wasOverOpen = useRef(overOpen);
  useEffect(() => {
    if (wasOverOpen.current && !overOpen && finished) cameraRef.current?.fit();
    wasOverOpen.current = overOpen;
  }, [overOpen, finished]);
  const anchors = useMemo<AnchorRegistry>(
    () => ({
      register: (el, at) => {
        anchorMap.current.set(el, at);
        const cam = cameraRef.current;
        const box = host.current;
        if (cam && box) placeAnchor(el, at, cam.view, box.clientWidth, box.clientHeight);
        return () => {
          anchorMap.current.delete(el);
        };
      },
    }),
    [],
  );
  const overlayRef = useRef<Container | null>(null);
  const fxLayerRef = useRef<Container | null>(null);
  const pulsesRef = useRef<{ g: Graphics; base: number }[]>([]);
  /* the hover layer's own pulses: a hover redraws them without touching the overlay's */
  const hoverPulsesRef = useRef<{ g: Graphics; base: number }[]>([]);
  const marchRef = useRef<March[]>([]);
  const propsRef = useRef({ targets, linkTargetsList, sellTargetsList, onInvalid });
  propsRef.current = { targets, linkTargetsList, sellTargetsList, onInvalid };
  const hoverRef = useRef({ setHoverTown, setHoverLink, setInspect, setHoverMerchant });
  hoverRef.current = { setHoverTown, setHoverLink, setInspect, setHoverMerchant };
  const suppressClick = useRef(false);
  /* where the pointer sits on the map, for a reading shown to the table */
  const pointerAt = useRef<{ wx: number; wy: number } | null>(null);
  /* a game being read again: the land goes dark under the tiles */
  const reading = useGame((s) => s.review !== null);
  useEffect(() => {
    sceneRef.current?.setHideUnbuilt(hideUnbuilt);
  }, [hideUnbuilt]);
  useEffect(() => {
    sceneRef.current?.setBigChips(bigChips);
  }, [bigChips]);
  useEffect(() => {
    sceneRef.current?.setGreyFreeMerchants(greyFreeMerch);
  }, [greyFreeMerch]);
  useEffect(() => {
    sceneRef.current?.setStockStyle(stockStyle);
  }, [stockStyle]);
  useEffect(() => {
    void sceneRef.current?.setTileArt(tileArt);
  }, [tileArt]);
  useEffect(() => {
    ambianceRef.current?.setTraffic(traffic);
  }, [traffic]);
  useEffect(() => {
    sceneRef.current?.setTileLook({ slotArt, colorBlind, sealTiles, sealLinks, cardGrain, chipStyle });
  }, [slotArt, colorBlind, sealTiles, sealLinks, cardGrain, chipStyle]);
  /* map painting switch: swap both era textures under the live scene */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    void (async () => {
      const { Assets, Texture } = await import('pixi.js');
      const urls = mapUrls(mapStyle, railPainting, activeBoard().id);
      const [canal, rail, etchCanal, etchRail] = await Promise.all([
        Assets.load(urls.canal),
        Assets.load(urls.rail),
        urls.etch ? Assets.load(urls.etch.canal) : Texture.EMPTY,
        urls.etch ? Assets.load(urls.etch.rail) : Texture.EMPTY,
      ]);
      if (cancelled) return;
      scene.setVillages(mapStyle === 'engraved' || mapStyle === 'inked' ? 'engraved' : 'painted', mapStyle === 'relief' ? activeBoard().id : null);
      for (const [sp, tex] of [[scene.bgCanal, canal], [scene.bgRail, rail], [scene.etchCanal, etchCanal], [scene.etchRail, etchRail]] as const) {
        sp.texture = tex;
        sp.width = WORLD_W + 2 * BLEED_X;
        sp.height = WORLD_H + 2 * BLEED_Y;
      }
      /* the sheets they replace go back to the loader */
      wearSheets(sheetList(urls));
    })();
    return () => {
      cancelled = true;
    };
  }, [mapStyle, railPainting]);

  /* the orders shown: the table turns sepia but for the overlay (where the
     orders and the tiles still to flip are painted) and the FX */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    /* the reader may keep the land lit while a game is read: no ink, no night */
    const lit = reading && opts.reviewLit;
    /* a glimpse of another seat's move only lowers the lamp: the owners'
       colours are what it shows, and a drained table would take them away.
       The survey a reader opens — their orders, a seat's empire — drains
       the land to a night-blue ink, so the orders are the only warmth */
    const glimpse = preview?.kind === 'player' && !!preview.transient;
    const veil = preview && !lit ? new ColorMatrixFilter() : null;
    if (veil) {
      if (glimpse) veil.brightness(0.6, false);
      else {
        veil.desaturate();
        veil.tint(0x7f9cc8, true);
        veil.brightness(0.66, true);
        veil.contrast(0.12, true);
      }
    }
    /* one pass over the whole land, the overlay and the FX left in colour */
    scene.land.filters = veil ? [veil] : null;
    scene.land.filterArea = veil ? TABLE_AREA : undefined;
    /* reading a game again: the ground goes to night and the ambiance
       steps back, so the tiles, the links and the merchants are the only
       thing left to read on it */
    const night = !veil && reading && !lit ? new ColorMatrixFilter() : null;
    if (night) {
      night.desaturate();
      night.brightness(0.35, true);
    }
    scene.ground.filters = night ? [night] : null;
    scene.ground.filterArea = night ? TABLE_AREA : undefined;
    const ambiance = ambianceRef.current?.layer;
    if (ambiance) ambiance.alpha = night ? 0.25 : 1;
    /* the camera on the orders: close on them when they sit together, the
       whole table when they are spread out */
    if (preview) {
      const pts: [number, number][] = [];
      for (const a of surveyMoves(preview, game).map((m) => m.action)) {
        if (a.kind === 'build') {
          const sp = TOWN_BY_ID[a.town]?.slots[a.slot];
          if (sp) pts.push(displayPosFor(sp.x, sp.y));
        } else if (a.kind === 'network') {
          for (const id of [a.link, a.second].filter(Boolean) as string[]) {
            const def = LINKS.find((l) => l.id === id);
            if (def) pts.push(routeFor(def, game.era).mid);
          }
        } else if (a.kind === 'sell') {
          for (const s of a.sales) {
            const sp = TOWN_BY_ID[s.town]?.slots[s.slot];
            if (sp) pts.push(displayPosFor(sp.x, sp.y));
          }
        }
      }
      if (pts.length) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (w < 1000 && h < 600) cameraRef.current?.flyTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, w < 400 && h < 300 ? 2 : 1.5);
        else cameraRef.current?.fit();
      } else cameraRef.current?.fit();
    }
    /* a glimpse fades out over its last half-second: the filter's blend and
       the overlay's alpha both go to nothing, then the land is let go */
    let raf = 0;
    if (preview?.kind === 'player' && preview.transient && veil) {
      const born = preview.at ?? Date.now();
      const tick = () => {
        const left = GLIMPSE_VEIL_MS - (Date.now() - born);
        const a = Math.max(0, Math.min(1, left / GLIMPSE_FADE_MS));
        veil.alpha = a;
        scene.overlay.alpha = a;
        if (left > 0) raf = requestAnimationFrame(tick);
        else scene.land.filters = null;
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      scene.overlay.alpha = 1;
      scene.land.filters = null;
      scene.ground.filters = null;
      if (ambiance) ambiance.alpha = 1;
      veil?.destroy();
      night?.destroy();
    };
  }, [preview, reading, opts.reviewLit, sceneSeq]);

  /* planning mode cancels browsing affordances (mirrors the SVG Board) */
  const selectedCardId = useGame((s) => s.selectedCardId);
  const code = useGame((s) => s.code);
  const verb = useGame((s) => s.verb);
  const hoverKey = useGame((s) => s.hoverKey);
  const pings = useGame((s) => s.pings);
  const pins = useGame((s) => s.pins);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const sellPicks = useGame((s) => s.sellPicks);
  const buildCoal = useGame((s) => s.buildCoal);
  const buildIron = useGame((s) => s.buildIron);
  const linkCoal = useGame((s) => s.linkCoal);
  const linkBeer = useGame((s) => s.linkBeer);
  const sellBeer = useGame((s) => s.sellBeer);
  const developPick = useGame((s) => s.developPick);
  const developIron = useGame((s) => s.developIron);
  const planActor = useGame((s) => s.planActor());
  const preparing = useGame((s) => s.preparing);
  const queued = useGame((s) => s.queued);
  const idle = !selectedCardId;
  /* where the goods of the move being prepared come from, read on the
     table the plan is made on (with moves already prepared, the one they
     leave) and only at the live table: a game read again has no plan */
  const supply = useMemo(() => {
    if (!keyboard || reading || !selectedCardId || !verb) return EMPTY_PROVENANCE;
    const planGame = preparing && queued.length && planActor >= 0 ? projectQueued(game, planActor, queued) : game;
    return provenance(
      planGame,
      planActor,
      { verb, buildPick, buildCoal, buildIron, linkPick, secondLinkPick, linkCoal, linkBeer, sellPicks, sellBeer, developPick, developIron, hoverKey },
      { targets, links: linkTargetsList, sales: sellTargetsList },
    );
  }, [keyboard, reading, selectedCardId, verb, preparing, queued, planActor, game, buildPick, buildCoal, buildIron, linkPick, secondLinkPick, linkCoal, linkBeer, sellPicks, sellBeer, developPick, developIron, hoverKey, targets, linkTargetsList, sellTargetsList]);
  const [prevIdle, setPrevIdle] = useState(idle);
  if (prevIdle !== idle) {
    setPrevIdle(idle);
    if (!idle) {
      setHoverTown(null);
      setHoverLink(null);
      setInspect(null);
    }
  }


  /* ------------------------------ boot ------------------------------ */
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let destroyed = false;
    let app: Application | null = null;
    const cleanups: (() => void)[] = [];
    /* the table's textures stay inked while this board is up */
    const letGo = holdBoardAssets();

    const boot = async () => {
      const a = new Application();
      await a.init({
        background: '#141210',
        resizeTo: el,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      });
      /* the pointer is read by the page, not by the stage: every move would
         otherwise walk the whole display tree and restyle the canvas cursor */
      a.renderer.events.features.move = false;
      a.renderer.events.features.globalMove = false;
      a.renderer.events.features.click = false;
      a.renderer.events.features.wheel = false;
      a.stage.eventMode = 'none';
      if (destroyed) {
        a.destroy(true);
        return;
      }
      app = a;
      el.appendChild(a.canvas);
      const canvas = a.canvas;
      const onLost = (e: Event) => {
        if (destroyed) return; // the stage taken down gives its context back itself
        e.preventDefault(); // asks the browser for the context back
        a.ticker.stop();
        setGlLost(true);
      };
      const onRestored = () => {
        if (destroyed) return;
        setGlLost(false);
        setGlEpoch((n) => n + 1);
      };
      canvas.addEventListener('webglcontextlost', onLost);
      canvas.addEventListener('webglcontextrestored', onRestored);
      cleanups.push(() => {
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
      });
      /* the canvas follows the screen's density: a browser zoom, or the
         window carried to another screen, would leave it blurred or
         oversampled — the media query is set again for each new density */
      let dppx: MediaQueryList | null = null;
      const onDensity = () => {
        a.renderer.resize(a.screen.width, a.screen.height, Math.min(2, window.devicePixelRatio || 1));
        watchDensity();
      };
      const watchDensity = () => {
        dppx?.removeEventListener('change', onDensity);
        dppx = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        dppx.addEventListener('change', onDensity);
      };
      watchDensity();
      cleanups.push(() => dppx?.removeEventListener('change', onDensity));

      await loadBoardAssets();
      if (destroyed) return;

      const { Assets, Sprite, Texture } = await import('pixi.js');
      const bootOpts = getBoardOptions();
      /* both paintings carry a bleed of countryside around the play area */
      const bgUrls = mapUrls(bootOpts.mapStyle, bootOpts.railPainting, activeBoard().id);
      const [canalTex, railTex, etchCanalTex, etchRailTex] = await Promise.all([
        Assets.load(bgUrls.canal),
        Assets.load(bgUrls.rail),
        bgUrls.etch ? Assets.load(bgUrls.etch.canal) : Texture.EMPTY,
        bgUrls.etch ? Assets.load(bgUrls.etch.rail) : Texture.EMPTY,
      ]);
      if (destroyed) return;
      const sheet = (tex: typeof canalTex) => {
        const s = new Sprite(tex);
        s.width = WORLD_W + 2 * BLEED_X;
        s.height = WORLD_H + 2 * BLEED_Y;
        s.position.set(-BLEED_X, -BLEED_Y);
        return s;
      };
      const bgCanal = sheet(canalTex);
      const bgRail = sheet(railTex);
      const etchCanal = sheet(etchCanalTex);
      const etchRail = sheet(etchRailTex);
      etchCanal.eventMode = 'none';
      etchRail.eventMode = 'none';
      wearSheets(sheetList(bgUrls));

      const scene = buildBoardScene(bgCanal, bgRail, etchCanal, etchRail);
      sceneRef.current = scene;
      scene.setHideUnbuilt(bootOpts.hideUnbuilt);
      scene.setBigChips(bootOpts.bigChips);
      scene.setGreyFreeMerchants(bootOpts.greyFreeMerchants);
      scene.setStockStyle(bootOpts.stockStyle);
      scene.setVillages(bootOpts.mapStyle === 'engraved' || bootOpts.mapStyle === 'inked' ? 'engraved' : 'painted', bootOpts.mapStyle === 'relief' ? activeBoard().id : null);
      if (Object.keys(bootOpts.tileArt).length) void scene.setTileArt(bootOpts.tileArt);
      scene.setTileLook({ slotArt: bootOpts.slotArt, colorBlind: bootOpts.colorBlind, sealTiles: bootOpts.sealTiles, sealLinks: bootOpts.sealLinks, cardGrain: bootOpts.cardGrain, chipStyle: bootOpts.chipStyle });
      a.stage.addChild(scene.world);
      /* language switch repaints the WebGL scene (Pixi Text labels) */
      cleanups.push(
        onLangChange(() => scene.redraw(gameRef.current)),
      );

      const ambiance = buildAmbiance(reduced);
      ambiance.setTraffic(bootOpts.traffic);
      ambianceRef.current = ambiance;
      /* mist + halos under the towns, smoke + traffic above: right over the
         links, whatever sheets lie under them */
      scene.land.addChildAt(ambiance.layer, scene.land.getChildIndex(scene.linksLayer) + 1);

      const cam = new Camera(() => ({ w: a.screen.width, h: a.screen.height }));
      cameraRef.current = cam;
      cam.onCommit = (v) => setView(v);
      setView({ ...cam.view });

      /* dev-only test hook: lets Playwright probes resolve screen coords of
         board elements and assert store state (never shipped in prod) */
      if (import.meta.env.DEV) {
        (window as unknown as { __board?: unknown }).__board = {
          townScreen: (id: string) => {
            const t = TOWN_BY_ID[id];
            return t ? worldToScreen(t.x, t.y, cam.view, a.screen.width, a.screen.height) : null;
          },
          slotScreen: (id: string, si: number) => {
            const t = TOWN_BY_ID[id];
            if (!t) return null;
            const c = townChrome(t);
            const p = c.slots[si];
            return p ? worldToScreen(p.x, p.y, cam.view, a.screen.width, a.screen.height) : null;
          },
          linkMidScreen: (id: string) => {
            const def = LINKS.find((l) => l.id === id);
            if (!def) return null;
            return worldToScreen(...linkMidWorld(def, gameRef.current?.era ?? 'canal'), cam.view, a.screen.width, a.screen.height);
          },
          fly: (id: string) => {
            const t = TOWN_BY_ID[id];
            if (t) cam.flyTo(t.x, t.y, 1.8);
          },
          fit: () => cam.fit(),
          linksFor: (townId: string) => LINKS.filter((l) => l.a === townId || l.b === townId).map((l) => l.id),
          store: () => useGame.getState(),
          /* probe helper: replace the whole game state (visual tests) */
          setGame: (g: GameState) => useGame.setState({ game: g }),
          /* probe helper: switch the stock-badge layout (A-B tests) */
          setStockStyle: (s: string) => sceneRef.current?.setStockStyle(s as StockStyle),
          verbs: () => verbsForCard({ game: useGame.getState().game, selectedCardId: useGame.getState().selectedCardId }),
          netTargets: () => propsRef.current.linkTargetsList.map((t) => ({ id: t.link.id, valid: t.valid, reason: t.reason ?? null })),
          hitTest: (x: number, y: number) => {
            try {
              const t = a.renderer.events.rootBoundary.hitTest(x, y);
              return t ? `${t.constructor.name} eventMode=${t.eventMode} parent=${t.parent?.constructor.name}` : 'null';
            } catch (e) {
              return `ERR ${(e as Error).message.slice(0, 80)}`;
            }
          },
          dbg: () => ({ ...dbg, rootTarget: a.renderer.events.rootBoundary.rootTarget?.constructor?.name ?? 'null' }),
          /* probe helpers: the textures the press holds, and a lost context */
          tally: () => boardAssetTally(),
          loseGl: () => {
            const lose = (a.renderer as unknown as { gl?: WebGLRenderingContext }).gl?.getExtension('WEBGL_lose_context');
            lose?.loseContext();
            /* a lost context hands out no extension: the restorer is kept from before */
            return { restore: () => lose?.restoreContext() };
          },
        };
      }

      /* --------------------- ticker: the only per-frame work ---------- */
      const overlay = scene.overlay;
      overlayRef.current = overlay;
      /* FX rings live above the overlay in their own layer, so overlay
         rebuilds (planning highlights, price tags, pulses) never detach
         an in-flight ring */
      const fxLayer = new Container();
      fxLayerRef.current = fxLayer;
      scene.world.addChild(fxLayer);
      /* the pointer of whoever is showing their reading to the table: a ring
         in their colour, hung on the map itself so it rides with the camera */
      const ghost = new Graphics();
      ghost.circle(0, 0, 30).stroke({ width: 7, color: 0xffffff, alpha: 0.95 });
      ghost.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.95 });
      ghost.visible = false;
      fxLayer.addChild(ghost);
      let clock = 0;
      let railAlphaTarget = 0;
      let lastFxSeq = -1;
      const fxRings: { g: Graphics; t0: number }[] = [];
      /* the pieces being struck, and the table the press last looked at */
      const stamps: Stamp[] = [];
      let stampSeen: GameState | null = gameRef.current;
      /* the arrow keys pan the map while held: so many pixels a second */
      const pressed = new Set<string>();
      let wasMoving = true;
      const arrows = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
      const onKeyDown = (ev: KeyboardEvent) => {
        if (!arrows.has(ev.key) || typing(ev) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        /* a game being read: the arrows step the moves, and the map stays put */
        if (!keyboardRef.current) return;
        ev.preventDefault();
        pressed.add(ev.key);
      };
      const onKeyUp = (ev: KeyboardEvent) => pressed.delete(ev.key);
      const onBlur = () => pressed.clear();
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      cleanups.push(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      });
      a.ticker.add((t) => {
        clock += t.deltaMS / 1000;
        if (pressed.size) {
          const step = (900 * t.deltaMS) / 1000;
          cam.nudge((pressed.has('ArrowLeft') ? step : 0) - (pressed.has('ArrowRight') ? step : 0), (pressed.has('ArrowUp') ? step : 0) - (pressed.has('ArrowDown') ? step : 0));
        }
        cam.tick(t.deltaMS);
        const { w, h } = { w: a.screen.width, h: a.screen.height };
        /* whatever hangs from the map and the minimap's frame ride it every
           frame the camera moves — and only then: a style written every
           frame costs the page a layout each time */
        const moving = cam.isMoving() || pressed.size > 0 || wasMoving;
        wasMoving = cam.isMoving();
        if (moving) for (const [el, at] of anchorMap.current) placeAnchor(el, at, cam.view, w, h);
        /* the minimap's frame follows the camera every frame too */
        const frame = mmFrameRef.current;
        if (moving && frame && frame.parentElement) {
          const mw = frame.parentElement.clientWidth;
          const mh = frame.parentElement.clientHeight;
          const [x0, y0] = screenToWorld(0, 0, cam.view, w, h);
          const [x1, y1] = screenToWorld(w, h, cam.view, w, h);
          const c = (v: number) => Math.min(1, Math.max(0, v));
          const fx0 = c(x0 / WORLD_W);
          const fy0 = c(y0 / WORLD_H);
          const fx1 = c(x1 / WORLD_W);
          const fy1 = c(y1 / WORLD_H);
          frame.style.left = `${fx0 * mw}px`;
          frame.style.top = `${fy0 * mh}px`;
          frame.style.width = `${Math.max(6, (fx1 - fx0) * mw)}px`;
          frame.style.height = `${Math.max(6, (fy1 - fy0) * mh)}px`;
        }
        const s = fitScale(w, h) * cam.view.k;
        scene.world.scale.set(s);
        scene.world.position.set(w / 2 + cam.view.x - (WORLD_W / 2) * s, h / 2 + cam.view.y - (WORLD_H / 2) * s);
        /* ribbon counter-scale + zoom-driven slot alphas, combined with the
           spotlight dimming — all plain alpha writes, no re-raster */
        const ls = ribbonLabelScale(cam.view.k, fitScale(w, h), RIBBON_FONT);
        for (const r of scene.ribbons) r.scale.set(ls);
        const detail = farDetail(cam.view.k);
        for (const tv of scene.towns.values()) {
          for (const sl of tv.slots) {
            sl.frame.alpha = sl.spotAlpha;
            /* the painted art face stays full colour at every zoom */
            sl.art.alpha = sl.artBase * sl.spotAlpha;
            sl.art2.alpha = sl.art.alpha;
            /* the owner's rim and the badges say whose and how much: read
               at every zoom; only the income/VP band fades at far zoom */
            sl.rim.alpha = sl.spotAlpha;
            sl.detail.alpha = detail * sl.spotAlpha;
            sl.badges.alpha = sl.spotAlpha;
            sl.deco.alpha = sl.spotAlpha;
            /* level, stock, score and seal keep a floor on screen, the way
               the name ribbons do (floor.ts), scaled about their own pin */
            for (const f of sl.floored) {
              f.c.scale.set(flooredScale(s, f));
              if (f.fine) f.fine.alpha = detail;
            }
          }
        }
        /* pulses (planning highlights, hover rings) */
        const osc = 0.55 + 0.35 * Math.sin(clock * 4.5);
        for (const p of pulsesRef.current) p.g.alpha = p.base * osc;
        for (const p of hoverPulsesRef.current) p.g.alpha = p.base * osc;
        /* supply lines from the exchange march toward the works being
           planned — from the tray's own place on screen (the drawer's coal
           or iron row, or the folded pill), turned into world coordinates;
           with motion reduced the dashes stand still */
        if (marchRef.current.length) {
          const host = el.getBoundingClientRect();
          for (const m of marchRef.current) {
            const tray = document.querySelector(`[data-market-tray="${m.tray}"]`) ?? document.querySelector('[data-market-pill]');
            const r = tray?.getBoundingClientRect();
            const sx = r && r.width > 0 ? (r.left - 6 - host.left - scene.world.position.x) / scene.world.scale.x : WORLD_W - 52;
            const sy = r && r.width > 0 ? (r.top + r.height / 2 - host.top - scene.world.position.y) / scene.world.scale.y : (m.tray === 'coal' ? WORLD_H * 0.29 : WORLD_H * 0.71);
            /* selling: the works is the source and the exchange the target,
               so the dashes march the other way and the head sits on the tray */
            const [ax, ay] = m.selling ? m.to : [sx, sy];
            const [bx, by] = m.selling ? [sx, sy] : m.to;
            const { end, head } = m.selling ? { end: [bx, by] as [number, number], head: arrowHead(ax, ay, bx, by, 14) } : supplyLine(ax, ay, bx, by, m.stop);
            m.g.clear();
            m.g.moveTo(ax, ay).lineTo(end[0], end[1]).stroke({ width: 7, color: CASING, alpha: 0.85, cap: 'round' });
            dashPath(m.g, [[ax, ay], end], 9, 7, reduced ? 0 : -clock * 36);
            m.g.stroke({ width: 3, color: m.color, cap: 'round' });
            m.g.poly(head).fill(m.color).stroke({ width: 2, color: CASING, join: 'round' });
            /* the plaque rides the line, a little way from the works */
            const tx = m.selling ? ax : end[0];
            const ty = m.selling ? ay : end[1];
            const dx = (m.selling ? bx : ax) - tx;
            const dy = (m.selling ? by : ay) - ty;
            const len = Math.hypot(dx, dy) || 1;
            m.tag.position.set(tx + (dx / len) * m.along, ty + (dy / len) * m.along);
          }
        }
        /* the press: whatever was laid on the table since the last frame
           (a tile, a link — yours or a machine's) is struck like a block */
        const seen = gameRef.current;
        if (seen !== stampSeen) {
          const fresh = freshPieces(stampSeen, seen);
          stampSeen = seen;
          const struck = fresh.tiles.length + fresh.links.length;
          if (struck && getBoardOptions().sound) {
            const kind = fresh.tiles.length ? 'tile' : 'link';
            if (reduced) stampThud(kind);
            else window.setTimeout(() => stampThud(kind), STAMP_IMPACT_MS);
          }
          if (struck && !reduced) {
            for (const key of fresh.tiles) {
              const [townId, si] = key.split(':');
              const sv = scene.towns.get(townId)?.slots[Number(si)];
              const pos = slotPos(key);
              if (!sv || !pos) continue;
              stamps.push({ t0: clock, box: sv.box, ink: inkGfx(fxLayer), specks: tileSpecks(pos[0], pos[1]), rim: pos });
            }
            fresh.links.forEach((id, i) => {
              const def = LINKS.find((l) => l.id === id);
              const g = scene.linkGfx.get(id);
              if (!def || !g) return;
              /* the second rail of a double comes down a beat after the first */
              stamps.push({ t0: clock + i * 0.06, link: g, ink: inkGfx(fxLayer), specks: routeSpecks(routeFor(def, seen.era).pts) });
            });
          }
        }
        for (let i = stamps.length - 1; i >= 0; i--) {
          const st = stamps[i];
          const age = clock - st.t0;
          if (age < 0) continue;
          const pose = stampPose(age);
          if (st.box) st.box.scale.set(pose.scale);
          if (st.box) st.box.alpha = pose.alpha;
          if (st.link) st.link.alpha = pose.alpha;
          const { spread, wet } = inkBloom(age);
          st.ink.clear();
          if (wet > 0) {
            for (const sp of st.specks) st.ink.circle(sp.x + sp.nx * sp.d * spread, sp.y + sp.ny * sp.d * spread, sp.r * (0.55 + 0.45 * wet));
            st.ink.fill({ color: 0x1d1712, alpha: 0.72 * wet });
            if (st.rim) {
              const r = TILE_R + 1 + spread * 7;
              st.ink.roundRect(st.rim[0] - r, st.rim[1] - r, r * 2, r * 2, 10).stroke({ width: 1 + 3.5 * wet, color: 0x1d1712, alpha: 0.4 * wet });
            }
          }
          if (age >= STAMP_S) {
            if (st.box) {
              st.box.scale.set(1);
              st.box.alpha = 1;
            }
            /* the link's own alpha is the spotlight's again */
            if (st.link) scene.setSpotlight(useGame.getState().netPeek ?? useGame.getState().spotlight);
            fxLayer.removeChild(st.ink);
            st.ink.destroy();
            stamps.splice(i, 1);
          }
        }
        /* era crossfade */
        scene.bgRail.alpha += (railAlphaTarget - scene.bgRail.alpha) * Math.min(1, t.deltaMS / 700);
        scene.etchRail.alpha = scene.bgRail.alpha;
        scene.etchCanal.alpha = 1 - scene.bgRail.alpha;
        /* spark-ring FX for the last confirmed action (a link just laid
           sends its first vehicle off at the traffic's own pace: ambiance.ts) */
        const g0 = gameRef.current;
        if (g0.fxSeq !== lastFxSeq && g0.lastFx) {
          lastFxSeq = g0.fxSeq;
          /* a tile or a link laid is the press's to mark (stamp.ts): the
             brass ring is for the moves that lay nothing down */
          if (g0.lastFx.kind !== 'build' && g0.lastFx.kind !== 'link') {
            const at = displayPosFor(g0.lastFx.at[0], g0.lastFx.at[1]);
            const ring = new Graphics();
            fxLayer.addChild(ring);
            fxRings.push({ g: ring, t0: clock });
            ring.eventMode = 'none';
            ring.position.set(at[0], at[1]);
          }
        }
        for (let i = fxRings.length - 1; i >= 0; i--) {
          const fx = fxRings[i];
          const age = clock - fx.t0;
          if (age > 0.55 || reduced) {
            fxLayer.removeChild(fx.g);
            fx.g.destroy();
            fxRings.splice(i, 1);
          } else {
            fx.g.clear();
            fx.g.circle(0, 0, 6 + age * 85).stroke({ width: 2.5, color: 0xc9a45c, alpha: 0.9 * (1 - age / 0.55) });
          }
        }
        ambiance.tick(clock, gameRef.current);
        railAlphaTarget = gameRef.current.era === 'rail' ? 1 : 0;
        /* a reading shown to the table: where this camera sits on the map and
           where the pointer is, a few times a second and no oftener */
        if (useGame.getState().sharing) {
          const box = el.getBoundingClientRect();
          const [cx, cy] = screenToWorld(box.width / 2, box.height / 2, cam.view, box.width, box.height);
          useGame.getState().showLook({ wx: cx, wy: cy, k: cam.view.k }, pointerAt.current);
        }
      });

      /* --------------------- game state → scene ----------------------- */
      scene.redraw(gameRef.current);
      let lastGame: GameState | null = gameRef.current;
      let lastSpot: number | null = null;
      let lastFlyAt = 0;
      let lastLook = { wx: NaN, wy: NaN, k: NaN };
      let lastLedgerSeq = -1;
      let lastGlimpseAt = -1;
      const unsub = useGame.subscribe((s) => {
        /* the live table repaints from the store; a replayed board is
           repainted by the prop effect below instead */
        if (s.game && s.game !== lastGame && s.game === gameRef.current) {
          lastGame = s.game;
          scene.redraw(s.game);
        }
        /* a hovered rail chip borrows the spotlight for its network */
        const spot = s.netPeek ?? s.spotlight;
        if (spot !== lastSpot) {
          lastSpot = spot;
          scene.setSpotlight(spot);
        }
        /* following a reading shown at this table: the camera goes where the
           reader in charge is looking, and their pointer shows on the map */
        const led = s.following ? s.shown : null;
        const look = led?.look;
        if (look && (look.wx !== lastLook.wx || look.wy !== lastLook.wy || look.k !== lastLook.k)) {
          lastLook = look;
          cam.flyTo(look.wx, look.wy, look.k);
        }
        const cursor = led?.cursor ?? null;
        if (cursor) {
          const hex = PLAYER_COLORS[s.game?.players[led!.from]?.color ?? '']?.hex ?? '#F5EBD7';
          ghost.visible = true;
          ghost.tint = Number(`0x${hex.replace('#', '')}`);
          ghost.position.set(cursor.wx, cursor.wy);
        } else ghost.visible = false;
        if (s.flyTo && s.flyTo.at !== lastFlyAt) {
          lastFlyAt = s.flyTo.at;
          const pos = regionPos(s.flyTo.key, s.game?.era ?? 'canal');
          if (pos) cam.flyTo(pos[0], pos[1], Math.max(cam.target.k, 1.5));
        }
        /* follow the others: glide to wherever a bot, or another player
           at an online table, just played — the move itself, not the payday
           or the scoring the engine may log after it */
        if (s.followBots && s.game && s.game.ledgerSeq !== lastLedgerSeq) {
          lastLedgerSeq = s.game.ledgerSeq;
          const at = s.game.actions.length - 1;
          const e = [...s.game.ledger].reverse().find((x) => x.at === at && x.player !== undefined && !!x.region && x.verb !== 'system' && x.verb !== 'score');
          const other = e?.player !== undefined && (s.game.players[e.player]?.isBot || (s.seat !== null && e.player !== s.seat));
          /* a guided table holds the machine while its reasons are read: the
             look at the board waits for that reading, not for this instant */
          if (e && other && !s.botHold && at !== lastGlimpseAt && Date.now() - cam.lastManual > 4000) {
            lastGlimpseAt = at;
            /* shown the survey's way for a moment: the table dims, the move
               stands in colour, the camera comes to it (see the preview effect) */
            const seat = e.player as number;
            queueMicrotask(() => useGame.getState().setGlimpse({ seat, at: Date.now() }));
          }
        } else if (s.game) {
          lastLedgerSeq = s.game.ledgerSeq;
        }
      });
      cleanups.push(unsub);

      /* ------------------------- interactions ------------------------- */
      /* DOM-based geometric hit testing (the SVG Board's proven pattern).
         Pixi's own event system proved unreliable in this setup (hits
         tested fine but pointerover/tap never dispatched to children), so
         slots/links/towns are resolved in world coordinates from plain
         DOM pointer events — which the camera already uses flawlessly. */
      const st = () => useGame.getState();
      const modes = () => {
        const s = st();
        return {
          isBuilding: s.verb === 'build' && !!s.selectedCardId,
          isNetworking: s.verb === 'network' && !!s.selectedCardId,
          isSelling: s.verb === 'sell' && !!s.selectedCardId,
          idle: !s.selectedCardId,
        };
      };

      const toWorld = (clientX: number, clientY: number): [number, number] => {
        const r = el.getBoundingClientRect();
        const w = a.screen.width;
        const h = a.screen.height;
        const s = fitScale(w, h) * cam.view.k;
        if (s === 0) return [0, 0];
        return [WORLD_W / 2 + (clientX - r.left - w / 2 - cam.view.x) / s, WORLD_H / 2 + (clientY - r.top - h / 2 - cam.view.y) / s];
      };

      const slotAt = (wx: number, wy: number): { town: (typeof TOWNS)[number]; si: number } | null => {
        for (const town of TOWNS) {
          const c = townChrome(town);
          for (let si = 0; si < town.slots.length; si++) {
            const p = c.slots[si];
            if (Math.abs(wx - p.x) <= TILE_R + 2 && Math.abs(wy - p.y) <= TILE_R + 2) return { town, si };
          }
        }
        return null;
      };

      const townAt = (wx: number, wy: number): (typeof TOWNS)[number] | null => {
        for (const town of TOWNS) {
          const c = townChrome(town);
          if (wx >= c.minX - 8 && wx <= c.maxX + 8 && wy >= c.minY - 8 && wy <= c.maxY + 8) return town;
        }
        return null;
      };
      /* merchant rows (paint.ts): tiles, a gap and the medallion, 1.45-scaled and centred on the node, southern ones lifted 34 units */
      const merchantAt = (wx: number, wy: number) => {
        for (const m of MERCHANTS) {
          const w = rowWidth(m.slots) * ROW_SCALE + 16;
          const h = (46 + 22 + 12) * ROW_SCALE;
          const cy = m.y - rowLift(m);
          if (Math.abs(wx - m.x) <= w / 2 && Math.abs(wy - cy) <= h / 2) return m;
        }
        return null;
      };

      const distToSeg = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      };

      /* link hit polylines, TRIMMED 45px short of the node anchors: routes
         end at the town/merchant centre, and a 14px tolerance there would
         put the link's "?" cursor inside the town cluster — the town must
         keep its own pointer hover */
      const linkHitPts = new Map<string, [number, number][]>();
      const trimEnd = (pts: [number, number][], fromStart: boolean): void => {
        let left = 45;
        let i = fromStart ? 0 : pts.length - 1;
        const step = fromStart ? 1 : -1;
        while (left > 0) {
          const j = i + step;
          const len = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
          if (len > left) {
            const t = left / len;
            pts[i] = [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t];
            return;
          }
          left -= len;
          pts.splice(i, 1);
          if (fromStart) i = 0;
          else i = pts.length - 1;
          if (pts.length < 2) return;
        }
      };
      for (const def of LINKS) {
        /* the same dense route sampling used for drawing (routeFor) —
           hover tracks the visible curve exactly, in either era */
        for (const era of ['canal', 'rail'] as const) {
          const pts = routeFor(def, era).pts.map((p) => [...p] as [number, number]);
          trimEnd(pts, true);
          trimEnd(pts, false);
          linkHitPts.set(`${era}:${def.id}`, pts);
        }
      }

      const linkAt = (wx: number, wy: number): (typeof LINKS)[number] | null => {
        let best: { def: (typeof LINKS)[number]; d: number } | null = null;
        for (const def of LINKS) {
          const pts = linkHitPts.get(`${gameRef.current?.era ?? 'canal'}:${def.id}`)!;
          let d = Infinity;
          for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSeg(wx, wy, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
          if (d < 14 && (!best || d < best.d)) best = { def, d };
        }
        return best?.def ?? null;
      };

      /** SVG Board gating: a link is only tappable when era-ok, unbuilt and targeted */
      const linkClickable = (def: (typeof LINKS)[number]): boolean => {
        const g = st().game;
        if (!g) return false;
        const eraOk = g.era === 'canal' ? def.canal : def.rail;
        return eraOk && !g.links[def.id] && propsRef.current.linkTargetsList.some((x) => x.link.id === def.id);
      };

      /* the cursor is a style of the canvas: set only when it changes */
      let cursorNow = '';
      const setCursor = (c: string) => {
        if (c === cursorNow) return;
        cursorNow = c;
        el.style.cursor = c;
      };
      const onHoverMove = (e: PointerEvent) => {
        if (e.buttons !== 0) return; // camera drag owns the pointer
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        const m = modes();
        const slot = slotAt(wx, wy);
        if (m.isBuilding || m.isSelling) {
          const key = slot ? tileKey(slot.town.id, slot.si) : null;
          if (st().hoverKey !== key) st().setHover(key);
          setCursor(slot ? 'pointer' : 'grab');
          return;
        }
        if (m.isNetworking) {
          const def = linkAt(wx, wy);
          const ok = def && linkClickable(def);
          const id = ok ? def.id : null;
          if (st().hoverKey !== id) st().setHover(id);
          setCursor(ok ? 'pointer' : 'grab');
          return;
        }
        /* picking a condition's place: a crosshair over towns and slots */
        if (st().unlessPick !== null) {
          const on = !!slotAt(wx, wy) || !!townAt(wx, wy);
          setCursor(on ? 'crosshair' : 'grab');
          return;
        }
        /* idle browsing: merchant plates, then towns, then links */
        const merch = merchantAt(wx, wy);
        hoverRef.current.setHoverMerchant(merch?.id ?? null);
        if (merch) {
          hoverRef.current.setHoverTown(null);
          hoverRef.current.setHoverLink(null);
          setCursor('help');
          return;
        }
        const town = townAt(wx, wy);
        hoverRef.current.setHoverTown(town?.id ?? null);
        if (town) {
          hoverRef.current.setHoverLink(null);
          setCursor('pointer');
        } else {
          /* a built link is done with hovering; a route hidden with C is
             not there to be hovered either */
          const def = linkAt(wx, wy);
          const shown = def && !gameRef.current?.links[def.id] && !getBoardOptions().hideUnbuilt;
          hoverRef.current.setHoverLink(shown ? def.id : null);
          setCursor(shown ? 'help' : 'grab');
        }
      };
      /* one look per frame, whatever the mouse's rate */
      let hoverEvt: PointerEvent | null = null;
      let hoverRaf = 0;
      const onHoverQueued = (e: PointerEvent) => {
        hoverEvt = e;
        if (hoverRaf) return;
        hoverRaf = requestAnimationFrame(() => {
          hoverRaf = 0;
          if (hoverEvt) onHoverMove(hoverEvt);
        });
      };
      el.addEventListener('pointermove', onHoverQueued);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onHoverQueued);
        if (hoverRaf) cancelAnimationFrame(hoverRaf);
      });
      /* right-click: "look here" — a town, a house or a route pointed at
         for everyone at the table (board option: telegrams) */
      const onMark = (e: MouseEvent) => {
        e.preventDefault();
        if (!getBoardOptions().telegrams) return;
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        const key = merchantAt(wx, wy)?.id ?? townAt(wx, wy)?.id ?? linkAt(wx, wy)?.id ?? null;
        if (key) st().sendPing(key);
      };
      el.addEventListener('contextmenu', onMark);
      cleanups.push(() => el.removeEventListener('contextmenu', onMark));

      /* overlay UI (zoom/option buttons, inspector…) must NOT start a board
         pan or be read as a board click — the pointer capture would swallow
         the button's own click event */
      const fromOverlay = (e: Event) => {
        const t = e.target as HTMLElement | null;
        return !!(t && t.closest('button, a, input, [role="button"]'));
      };

      const onClick = (e: MouseEvent) => {
        if (suppressClick.current || fromOverlay(e)) return;
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        const m = modes();
        const p = propsRef.current;
        const slot = slotAt(wx, wy);
        if (m.isBuilding && slot) {
          const key = tileKey(slot.town.id, slot.si);
          const cands = p.targets.filter((x) => tileKey(x.town, x.slot) === key);
          const valids = cands.filter((x) => x.valid);
          const cur = st().buildPick;
          if (valids.length) {
            /* re-tap a picked multi-industry tile cycles the industry */
            if (cur && tileKey(cur.town, cur.slot) === key && valids.length > 1) {
              const idx = valids.findIndex((v) => v.industry === cur.industry);
              st().pickBuild(valids[(idx + 1) % valids.length]);
            } else st().pickBuild(valids[0]);
          } else p.onInvalid(key, cands[0]?.reason ?? tr('board.invalid.tileCard'));
          return;
        }
        if (m.isBuilding && st().buildPick) {
          /* a click on the open map lets the picked slot go, like Escape
             would — the card and the action stay chosen */
          st().pickBuild(null);
          return;
        }
        if (m.isSelling && slot) {
          const key = tileKey(slot.town.id, slot.si);
          const t = p.sellTargetsList.find((x) => tileKey(x.town, x.slot) === key);
          if (t?.valid) st().pickSell(t);
          else p.onInvalid(key, t?.reason ?? tr('board.invalid.noMerchant'));
          return;
        }
        if (m.isNetworking) {
          const def = linkAt(wx, wy);
          if (!def) return;
          /* built or wrong-era links are simply not interactive (SVG parity);
             era-ok unbuilt links report the engine's reason when invalid */
          if (!linkClickable(def)) return;
          const t = p.linkTargetsList.find((x) => x.link.id === def.id)!;
          /* the list already reads a link as the double's second once a
             first is picked (store.currentLinks), reason and all */
          if (t.valid) st().pickLink(t);
          else p.onInvalid(def.id, t.reason ?? tr('board.invalid.cannotBuild'));
          return;
        }
        if (m.idle) {
          /* a condition's place: the slot or the town under the click */
          if (st().unlessPick !== null) {
            const slot = slotAt(wx, wy);
            const town = slot?.town ?? townAt(wx, wy);
            if (town) st().applyUnlessPick(town.id, slot ? slot.si : null);
            return;
          }
          const town = townAt(wx, wy);
          hoverRef.current.setInspect(town?.id ?? null); // click-away closes
        }
      };
      el.addEventListener('click', onClick);
      cleanups.push(() => el.removeEventListener('click', onClick));

      const dbg = { over: 0, tap: 0, slotOver: 0, lastGlobal: null as [number, number] | null };

      /* camera DOM events */
      const onWheel = (e: WheelEvent) => cam.wheel(e, el.getBoundingClientRect());
      el.addEventListener('wheel', onWheel, { passive: false });
      cleanups.push(() => el.removeEventListener('wheel', onWheel));

      /* the fingers on the glass, by pointer id: one drags, two pinch */
      const fingers = new Map<number, { x: number; y: number }>();
      const pair = (): [{ x: number; y: number }, { x: number; y: number }] | null => {
        if (fingers.size !== 2) return null;
        const [a, b] = fingers.values();
        return [a, b];
      };
      const local = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const onDown = (e: PointerEvent) => {
        if (fromOverlay(e)) return; // let overlay buttons receive their click
        if (e.pointerType === 'touch') fingers.set(e.pointerId, local(e));
        const two = pair();
        if (two) {
          cam.pinchStart(two[0], two[1]);
          suppressClick.current = true;
        } else {
          cam.pointerDown(e);
          suppressClick.current = false;
        }
        el.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, local(e));
        /* a reading shown to the table carries the pointer with it */
        const r = el.getBoundingClientRect();
        const [wx, wy] = screenToWorld(e.clientX - r.left, e.clientY - r.top, cam.view, r.width, r.height);
        pointerAt.current = { wx, wy };
        const two = pair();
        if (two && cam.pinching()) {
          cam.pinchMove(two[0], two[1]);
          suppressClick.current = true;
        } else if (cam.pointerMove(e)) suppressClick.current = true;
      };
      const onUp = (e: PointerEvent) => {
        fingers.delete(e.pointerId);
        if (cam.pinching()) {
          cam.pinchEnd();
          /* one finger stays: it drags on from where it is, without a click */
          const [rest] = fingers.values();
          if (rest) {
            const r = el.getBoundingClientRect();
            cam.pointerDown({ clientX: rest.x + r.left, clientY: rest.y + r.top } as PointerEvent);
          }
        } else cam.pointerUp();
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      cleanups.push(() => {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      });

      const onDbl = (e: MouseEvent) => {
        if (fromOverlay(e)) return;
        const r = el.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        /* over a town → fly to it; elsewhere → cursor-anchored step zoom */
        const { w, h } = { w: a.screen.width, h: a.screen.height };
        const s = fitScale(w, h) * cam.view.k;
        const wx = WORLD_W / 2 + (sx - w / 2 - cam.view.x) / s;
        const wy = WORLD_H / 2 + (sy - h / 2 - cam.view.y) / s;
        let best: { id: string; d: number } | null = null;
        for (const town of TOWNS) {
          const c = townChrome(town);
          const d = Math.hypot(c.ax - wx, c.ay - wy);
          if (d < 90 && (!best || d < best.d)) best = { id: town.id, d };
        }
        if (best && !e.shiftKey) cam.flyTo(TOWN_BY_ID[best.id].x, TOWN_BY_ID[best.id].y, 1.8);
        else cam.dblclick(sx, sy, e.shiftKey);
      };
      el.addEventListener('dblclick', onDbl);
      cleanups.push(() => el.removeEventListener('dblclick', onDbl));

      /* keyboard: + / − / 0 (the arrows pan the map, see the ticker). The
         listener is always there and asks the prop at each key, so a table
         that leaves a reading gets its keys back */
      const onKey = (e: KeyboardEvent) => {
        if (!keyboardRef.current || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === '+' || e.key === '=') cam.zoomStep(1.35);
        else if (e.key === '-' || e.key === '_') cam.zoomStep(1 / 1.35);
        else if (isKey(e, 'fit')) cam.fit();
        else if (isKey(e, 'links')) setBoardOption('hideUnbuilt', !getBoardOptions().hideUnbuilt);
        else if (isKey(e, 'fullscreen')) fsRef.current();
        else return;
        e.preventDefault();
      };
      window.addEventListener('keydown', onKey);
      cleanups.push(() => window.removeEventListener('keydown', onKey));

      /* container size for React overlays — and the canvas itself: Pixi's
         resizeTo only listens to the window, not to the lane the guide
         takes or gives back at the right edge */
      const ro = new ResizeObserver(() => {
        a.resize();
        /* a wider frame narrows the room to pan: the camera is held back
           at once, or the table's black would show past the bleed */
        cam.reclamp(true);
        setSize({ w: el.clientWidth, h: el.clientHeight });
      });
      ro.observe(el);
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setSceneSeq((n) => n + 1);
      cleanups.push(() => ro.disconnect());
      /* the hand comes or goes: the frame follows the room it leaves */
      cleanups.push(subscribeFitReserve(() => cam.reclamp()));
    };

    void boot();

    return () => {
      destroyed = true;
      for (const fn of cleanups) fn();
      if (app) app.destroy(true, { children: true, texture: false });
      /* the textures are let go after the stage that showed them */
      letGo();
      sceneRef.current = null;
      cameraRef.current = null;
      overlayRef.current = null;
      ambianceRef.current = null;
    };
  }, [reduced, glEpoch]);

  /* ------------------- planning highlights + ghost ------------------- */
  useEffect(() => {
    const overlay = overlayRef.current;
    const scene = sceneRef.current;
    if (!overlay || !scene) return;
    for (const c of overlay.removeChildren()) c.destroy({ children: true });
    pulsesRef.current = [];
    marchRef.current = [];

    const pulse = (g: Graphics, base = 1) => {
      overlay.addChild(g);
      pulsesRef.current.push({ g, base });
    };
    const tag = (cx: number, cy: number, w: number, h: number, label: string) => overlay.addChild(...priceTag(cx, cy, w, h, label));

    if (verb === 'build' && selectedCardId) {
      const seen = new Set<string>();
      for (const t of targets) {
        const key = tileKey(t.town, t.slot);
        if (!t.valid || seen.has(key)) continue;
        seen.add(key);
        const pos = townChrome(TOWN_BY_ID[t.town]).slots[t.slot];
        const picked = !!buildPick && tileKey(buildPick.town, buildPick.slot) === key;
        /* a place you may build on wears the state ink; the one picked, pale and full */
        const g = slotMark(pos.x, pos.y, picked, true);
        if (picked) overlay.addChild(g);
        else pulse(g, 0.8);
      }
    }

    if (verb === 'network' && selectedCardId) {
      for (const t of linkTargetsList) {
        if (!t.valid) continue;
        const def = t.link;
        const pts = routeFor(def, game.era).pts;
        const picked = linkPick?.link.id === def.id || secondLinkPick?.link.id === def.id;
        const g = linkMark(pts, picked);
        if (picked) overlay.addChild(g);
        else pulse(g, 0.55);
        /* the picked link: flowing dashes and its £-plaque at mid-route (a
           hovered one gets the same on the hover layer) */
        if (picked) {
          const d = linkDashes(pts);
          pulse(d, 0.95);
          const [mx, my] = linkMidWorld(def, game.era);
          tag(mx, my - 17.5, 48, 17, money(t.total));
        }
      }
    }

    if (verb === 'sell' && selectedCardId) {
      for (const t of sellTargetsList) {
        if (!t.valid) continue;
        const pos = townChrome(TOWN_BY_ID[t.town]).slots[t.slot];
        const picked = sellPicks.some((x) => tileKey(x.town, x.slot) === tileKey(t.town, t.slot));
        /* the works to sell from, in the same grammar as a place to build:
           its halo and ring only, its face left clear to read */
        const g = slotMark(pos.x, pos.y, picked, false);
        if (picked) overlay.addChild(g);
        else pulse(g, 0.9);
      }
    }

    /* supply arrows — where the coal, iron and beer of the move come
       from (provenance.ts): a straight arrow from each source to the
       place the cubes are spent, its count at mid-way */
    for (const th of supply.threads) {
      const [sx, sy] = th.from;
      const [gx, gy] = th.to;
      /* a link being laid is fed at its middle: the head lands on the route */
      const { end, head } = supplyLine(sx, sy, gx, gy, th.onTile ? TILE_R : 0);
      const line = new Graphics();
      line.moveTo(sx, sy).lineTo(end[0], end[1]).stroke({ width: 7, color: CASING, alpha: 0.85, cap: 'round' });
      line.moveTo(sx, sy).lineTo(end[0], end[1]).stroke({ width: 3, color: coreOf(th.resource), cap: 'round' });
      line.poly(head).fill(coreOf(th.resource)).stroke({ width: 2, color: CASING, join: 'round' });
      line.eventMode = 'none';
      overlay.addChild(line);
      const tag = new Graphics().roundRect(-14, -9, 28, 16, 3).fill(0x171310).stroke({ width: 0.8, color: 0x8a6b33 });
      tag.position.set((sx + gx) / 2, (sy + gy) / 2);
      const txt = new Text({ text: `×${th.amount}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fill: 0xf2ead6 } });
      txt.anchor.set(0.5);
      txt.position.set((sx + gx) / 2, (sy + gy) / 2);
      tag.eventMode = 'none';
      txt.eventMode = 'none';
      overlay.addChild(tag, txt);
    }
    /* a development draws its iron from works with nowhere to run to: each
       is ringed and numbered with its draw, and a dashed thread ties them
       when there are two */
    if (supply.draws.length > 1) {
      const thread = new Graphics();
      const pts = supply.draws.map((d) => d.at);
      dashPath(thread, pts, 10, 8);
      thread.stroke({ width: 5, color: CASING, alpha: 0.8, cap: 'round' });
      dashPath(thread, pts, 10, 8);
      thread.stroke({ width: 2, color: 0xe07020, cap: 'round' });
      thread.eventMode = 'none';
      overlay.addChild(thread);
    }
    supply.draws.forEach((d, order) => {
      const [sx, sy] = d.at;
      const ring = new Graphics().roundRect(sx - TILE_R - 4, sy - TILE_R - 4, TILE_R * 2 + 8, TILE_R * 2 + 8, 9).stroke({ width: 3, color: edgeOf(d.resource) });
      ring.eventMode = 'none';
      pulse(ring, 0.95);
      const tag = new Graphics().roundRect(-16, -9, 32, 18, 3).fill(0x171310).stroke({ width: 1, color: edgeOf(d.resource) });
      tag.position.set(sx, sy - TILE_R - 14);
      const txt = new Text({ text: `−${d.amount}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: '600', fill: 0xf2ead6 } });
      txt.anchor.set(0.5);
      txt.position.set(sx, sy - TILE_R - 14);
      const n = new Graphics().circle(sx - TILE_R - 2, sy - TILE_R - 2, 9).fill(0xe07020).stroke({ width: 1.5, color: CASING });
      const nt = new Text({ text: String(order + 1), style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: '700', fill: 0x171310 } });
      nt.anchor.set(0.5);
      nt.position.set(sx - TILE_R - 2, sy - TILE_R - 2);
      for (const c of [tag, txt, n, nt]) c.eventMode = 'none';
      overlay.addChild(tag, txt, n, nt);
    });
    /* market supply: a line from the exchange's own tray, drawn by the
       ticker (see March), and a £-plaque per resource by the works */
    supply.market.forEach((m, i) => {
      const g = new Graphics();
      g.eventMode = 'none';
      overlay.addChild(g);
      /* the plaque rides the line, clear of the tile: how many cubes, at what price */
      const tag = new Container();
      const label = new Text({ text: tr('board.ghost.mkt', { n: m.amount, cost: m.cost }), style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: '600', fill: 0xf2ead6 } });
      label.anchor.set(0.5);
      const w = label.width + 18;
      tag.addChild(new Graphics().roundRect(-w / 2, -11, w, 22, 4).fill({ color: 0x171310, alpha: 0.94 }).stroke({ width: 1.4, color: edgeOf(m.resource) }), label);
      tag.eventMode = 'none';
      overlay.addChild(tag);
      marchRef.current.push({ g, tray: m.resource, to: m.to, color: coreOf(m.resource), tag, along: 78 + i * 30, stop: m.onTile ? TILE_R : 0 });
    });
    /* what the works would sell to the exchange the moment it is built:
       the same line the other way round, in the green of a gain */
    const sale = ghost?.sale;
    const saleAt = supply.threads[0]?.to ?? supply.market[0]?.to ?? (ghost && !ghost.noTarget ? displayPosFor(ghost.at[0], ghost.at[1]) : null);
    if (sale && saleAt && verb === 'build') {
      const g = new Graphics();
      g.eventMode = 'none';
      overlay.addChild(g);
      const tag = new Container();
      const label = new Text({ text: tr('board.ghost.sale', { n: sale.amount, gain: sale.gain }), style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: '600', fill: 0xd6f0dd } });
      label.anchor.set(0.5);
      const w = label.width + 18;
      tag.addChild(new Graphics().roundRect(-w / 2, -11, w, 22, 4).fill({ color: 0x0f1a12, alpha: 0.94 }).stroke({ width: 1.4, color: 0x5fa37a }), label);
      tag.eventMode = 'none';
      overlay.addChild(tag);
      marchRef.current.push({ g, tray: sale.resource === 'coal' ? 'coal' : 'iron', to: saleAt, color: 0x5fa37a, selling: true, tag, along: 78 + supply.market.length * 30 });
    }

    /* the reader's pinned towns: a brass pin at the cluster's top-right corner */
    for (const townId of Object.keys(pins)) {
      const town = TOWN_BY_ID[townId];
      if (!town) continue;
      const c = townChrome(town);
      const px = c.maxX - 6;
      const py = c.minY + 2;
      const g = new Graphics();
      g.moveTo(px, py + 22).lineTo(px, py + 8).stroke({ width: 2, color: 0x2a2118 });
      g.moveTo(px - 1, py + 22).lineTo(px - 1, py + 8).stroke({ width: 1, color: 0xc9a45c, alpha: 0.7 });
      g.circle(px, py + 6, 6).fill(0xc9a45c).stroke({ width: 1.2, color: 0x2a2118 });
      g.circle(px - 1.5, py + 4.5, 2).fill({ color: 0xfff1c8, alpha: 0.8 });
      g.eventMode = 'none';
      overlay.addChild(g);
    }

    /* "look here": every seat's last mark pulses in its colour, a medallion
       with the seat's shape at the centre, whatever the reader is doing */
    for (const mark of pings) {
      const at = regionPos(mark.key, game.era);
      const p = game.players[mark.from];
      if (!at || !p) continue;
      const col = parseInt((PLAYER_COLORS[p.color]?.hex ?? '#C9A45C').slice(1), 16);
      const shape = PLAYER_COLORS[p.color]?.shape ?? 'circle';
      const ring = new Graphics();
      ring.circle(at[0], at[1], 78).stroke({ width: 4, color: col, alpha: 0.9 });
      ring.circle(at[0], at[1], 96).stroke({ width: 2, color: col, alpha: 0.45 });
      ring.eventMode = 'none';
      pulse(ring, 1);
      const disc = new Graphics();
      disc.circle(at[0], at[1] - 92, 13).fill(0x2a2118).stroke({ width: 2, color: 0xc9a45c });
      drawOwnerMedallion(disc, at[0], at[1] - 92, col, shape);
      disc.eventMode = 'none';
      overlay.addChild(disc);
    }

    /* the orders for my turn, in colour on the sepia table: every tile still
       to flip keeps its face, each prepared move is painted where it lands
       with its number on a brass disc */
    let alive = true;
    if (preview) {
      const TILE = TILE_HALF * 2;
      /* the surveyor's grid, faint, every 200 units */
      const grid = new Graphics();
      for (let gx = 0; gx <= WORLD_W; gx += 200) grid.moveTo(gx, 0).lineTo(gx, WORLD_H);
      for (let gy = 0; gy <= WORLD_H; gy += 200) grid.moveTo(0, gy).lineTo(WORLD_W, gy);
      grid.stroke({ width: 1, color: 0xbcd0ea, alpha: 0.07 });
      grid.eventMode = 'none';
      overlay.addChild(grid);
      /* a warm glow under each order, pulsing */
      const glow = (x: number, y: number, r: number) => {
        const g = new Graphics();
        g.circle(x, y, r + 26).fill({ color: 0xe8b25a, alpha: 0.1 });
        g.circle(x, y, r + 12).fill({ color: 0xe8b25a, alpha: 0.16 });
        g.circle(x, y, r + 4).stroke({ width: 3, color: 0xffd98a, alpha: 0.85 });
        g.eventMode = 'none';
        pulse(g, 1);
      };
      const face = (url: string, x: number, y: number, col: number) => {
        const m = new Graphics().roundRect(x - TILE_HALF, y - TILE_HALF, TILE, TILE, 6).fill(0xffffff);
        const s = new Sprite(Texture.EMPTY);
        s.position.set(x - TILE_HALF, y - TILE_HALF);
        s.width = TILE;
        s.height = TILE;
        s.mask = m;
        s.eventMode = 'none';
        m.eventMode = 'none';
        overlay.addChild(m, s);
        const rim = new Graphics().roundRect(x - TILE_HALF + 1.25, y - TILE_HALF + 1.25, TILE - 2.5, TILE - 2.5, 5.5).stroke({ width: 2.5, color: col });
        rim.eventMode = 'none';
        overlay.addChild(rim);
        void Assets.load<Texture>(url).then((tex) => {
          if (!alive) return;
          s.texture = tex;
          s.width = TILE;
          s.height = TILE;
        });
      };
      const badge = (x: number, y: number, n: number) => {
        const g = new Graphics();
        g.circle(x + 1, y + 1.5, 12).fill({ color: 0x000000, alpha: 0.45 });
        g.circle(x, y, 12).fill(0xc9a45c).stroke({ width: 1.6, color: 0x2a2118 });
        g.eventMode = 'none';
        overlay.addChild(g);
        const tx = new Text({ text: String(n), style: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: '900', fill: 0x2a2118 } });
        tx.anchor.set(0.5);
        tx.position.set(x, y - 0.5);
        tx.eventMode = 'none';
        overlay.addChild(tx);
      };
      const colorOf = (owner: number) => parseInt((PLAYER_COLORS[game.players[owner]?.color ?? '']?.hex ?? '#C9A45C').slice(1), 16);
      for (const [key, tile] of Object.entries(game.tiles)) {
        if (tile.flipped) continue;
        const [townId, si] = key.split(':');
        const sp = TOWN_BY_ID[townId]?.slots[Number(si)];
        if (!sp) continue;
        const [x, y] = displayPosFor(sp.x, sp.y);
        face(tileFaceUrl(tile.industry, opts.tileArt, game.players[tile.owner]?.color ?? 'brass'), x, y, colorOf(tile.owner));
      }
      /* the still-to-flip tiles keep their face but a shade quieter than the orders */
      for (const c of overlay.children) if (c instanceof Sprite) c.alpha = 0.82;
      const who = preview.kind === 'player' ? preview.seat : preview.actor;
      const mine = colorOf(who);
      const myColor = game.players[who]?.color ?? 'brass';
      /* the seat's empire first: its links in its colour, a glow on each of
         its works still to flip */
      {
        for (const [id, l] of Object.entries(game.links)) {
          if (l.owner !== who) continue;
          const def = LINKS.find((x) => x.id === id);
          if (!def) continue;
          const pts = routeFor(def, l.era).pts;
          const g = new Graphics();
          trace(g, pts);
          g.stroke({ width: 10, color: 0x0c0a08, alpha: 0.5, cap: 'round', join: 'round' });
          trace(g, pts);
          g.stroke({ width: 5, color: mine, cap: 'round', join: 'round' });
          g.eventMode = 'none';
          overlay.addChild(g);
        }
        for (const [key, tile] of Object.entries(game.tiles)) {
          if (tile.owner !== who || tile.flipped) continue;
          const [townId, si] = key.split(':');
          const sp = TOWN_BY_ID[townId]?.slots[Number(si)];
          if (sp) {
            const [x, y] = displayPosFor(sp.x, sp.y);
            glow(x, y, TILE_HALF);
          }
        }
        /* the other seats the reader asked to see: their links, thinner, in their colour */
        for (const seat of preview.empires ?? []) {
          if (seat === who) continue;
          for (const [id, l] of Object.entries(game.links)) {
            if (l.owner !== seat) continue;
            const def = LINKS.find((x) => x.id === id);
            if (!def) continue;
            const pts = routeFor(def, l.era).pts;
            const g = new Graphics();
            trace(g, pts);
            g.stroke({ width: 8, color: 0x0c0a08, alpha: 0.45, cap: 'round', join: 'round' });
            trace(g, pts);
            g.stroke({ width: 3.5, color: colorOf(seat), cap: 'round', join: 'round' });
            g.eventMode = 'none';
            overlay.addChild(g);
          }
        }
      }
      /* then the moves: the orders numbered, or the seat's last move under its shape */
      const marks = surveyMoves(preview, game);
      const shape = PLAYER_COLORS[game.players[who]?.color ?? '']?.shape ?? 'circle';
      const mark = (x: number, y: number, n: number | null) => {
        if (n !== null) badge(x, y, n);
        else {
          const d = new Graphics();
          d.circle(x + 1, y + 1.5, 12).fill({ color: 0x000000, alpha: 0.45 });
          d.circle(x, y, 12).fill(0x2a2118).stroke({ width: 1.6, color: 0xc9a45c });
          drawOwnerMedallion(d, x, y, mine, shape);
          d.eventMode = 'none';
          overlay.addChild(d);
        }
      };
      marks.forEach(({ action: a, n }) => {
        if (a.kind === 'build') {
          const sp = TOWN_BY_ID[a.town]?.slots[a.slot];
          if (!sp) return;
          const [x, y] = displayPosFor(sp.x, sp.y);
          glow(x, y, TILE_HALF);
          face(tileFaceUrl(a.industry, opts.tileArt, myColor), x, y, mine);
          mark(x + TILE_HALF - 4, y - TILE_HALF + 4, n);
        } else if (a.kind === 'network') {
          for (const id of [a.link, a.second].filter(Boolean) as string[]) {
            const def = LINKS.find((l) => l.id === id);
            if (!def) continue;
            const pts = routeFor(def, game.era).pts;
            const g = new Graphics();
            trace(g, pts);
            g.stroke({ width: 12, color: 0x0c0a08, alpha: 0.55, cap: 'round', join: 'round' });
            trace(g, pts);
            g.stroke({ width: 6, color: mine, cap: 'round', join: 'round' });
            g.eventMode = 'none';
            overlay.addChild(g);
            const [mx, my] = routeFor(def, game.era).mid;
            glow(mx, my, 6);
            mark(mx, my, n);
          }
        } else if (a.kind === 'sell') {
          for (const s of a.sales) {
            const sp = TOWN_BY_ID[s.town]?.slots[s.slot];
            if (!sp) continue;
            const [x, y] = displayPosFor(sp.x, sp.y);
            glow(x, y, TILE_HALF);
            mark(x + TILE_HALF - 4, y - TILE_HALF + 4, n);
          }
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [verb, selectedCardId, targets, linkTargetsList, sellTargetsList, ghost, supply, hideUnbuilt, buildPick, linkPick, secondLinkPick, sellPick, sellPicks, idle, game.ledgerSeq, pings, pins, preview, opts.tileArt, sceneSeq]);

  /* everything the pointer alone decides lives on its own layer, so a
     hover never rebuilds the overlay: the cream edge and the £-plaque of
     the place, link or works under the pointer while a move is planned;
     while browsing, the route under the pointer in brass (not when the
     pointer is on a town at its end: the town owns that hover), and the
     town or route a ledger line points at */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const layer = scene.hoverLayer;
    for (const c of layer.removeChildren()) c.destroy();
    hoverPulsesRef.current = [];
    const pulse = (g: Graphics, base = 1) => {
      layer.addChild(g);
      hoverPulsesRef.current.push({ g, base });
    };

    if (!idle && hoverKey && verb === 'build') {
      const t = targets.find((x) => x.valid && tileKey(x.town, x.slot) === hoverKey);
      if (t) {
        const pos = townChrome(TOWN_BY_ID[t.town]).slots[t.slot];
        const picked = !!buildPick && tileKey(buildPick.town, buildPick.slot) === hoverKey;
        layer.addChild(slotHoverEdge(pos.x, pos.y, picked));
        /* the price above it; the beginner aid itemises it: tile + market coal + market iron */
        const coal = t.coalPlan.totalCost;
        const iron = t.ironPlan.totalCost;
        const label =
          aidOn(game.assist, code !== null) && coal + iron > 0
            ? `${money(t.total)} = ${t.cost}${coal ? ` + ${coal} ${tr('board.aid.coal')}` : ''}${iron ? ` + ${iron} ${tr('board.aid.iron')}` : ''}`
            : money(t.total);
        layer.addChild(...priceTag(pos.x, pos.y - TILE_R - 13.5, Math.max(52, label.length * 6.2 + 12), 15, label));
      }
    }

    if (!idle && hoverKey && verb === 'network') {
      const t = linkTargetsList.find((x) => x.valid && x.link.id === hoverKey);
      if (t) {
        const pts = routeFor(t.link, game.era).pts;
        const picked = linkPick?.link.id === hoverKey || secondLinkPick?.link.id === hoverKey;
        layer.addChild(linkHoverEdge(pts, picked));
        /* a picked link carries its dashes and price on the overlay already */
        if (!picked) {
          pulse(linkDashes(pts), 0.95);
          const [mx, my] = linkMidWorld(t.link, game.era);
          layer.addChild(...priceTag(mx, my - 17.5, 48, 17, money(t.total)));
        }
      }
    }

    if (!idle && hoverKey && verb === 'sell') {
      const t = sellTargetsList.find((x) => x.valid && tileKey(x.town, x.slot) === hoverKey);
      if (t) {
        const pos = townChrome(TOWN_BY_ID[t.town]).slots[t.slot];
        const picked = sellPicks.some((x) => tileKey(x.town, x.slot) === hoverKey);
        layer.addChild(slotHoverEdge(pos.x, pos.y, picked));
      }
    }

    /* ledger flash: a ledger line naming a town or a link pulses the
       cluster's frame or the route */
    if (idle && hoverKey) {
      const town = TOWN_BY_ID[hoverKey];
      if (town) {
        const c = townChrome(town);
        const g = new Graphics()
          .roundRect(c.minX + 4, c.minY + 4, c.maxX - c.minX - 8, c.maxY - c.minY - 8, 10)
          .stroke({ width: 3, color: 0xc9a45c });
        g.eventMode = 'none';
        pulse(g, 0.9);
      } else {
        const def = LINKS.find((l) => l.id === hoverKey);
        if (def) {
          const g = new Graphics();
          trace(g, routeFor(def, game.era).pts);
          g.stroke({ width: 8, color: 0xc9a45c, cap: 'round', join: 'round' });
          g.eventMode = 'none';
          pulse(g, 0.45);
        }
      }
      return;
    }

    if (!(idle && hoverLink)) return;
    const def = LINKS.find((l) => l.id === hoverLink);
    const adjacent = def && hoverTown !== null && (def.a === hoverTown || def.b === hoverTown);
    const hidden = def && (hideUnbuilt || !!game.links[def.id]);
    if (!def || adjacent || hidden) return;
    const pts = routeFor(def, game.era).pts;
    const g = new Graphics();
    trace(g, pts);
    g.stroke({ width: 10, color: 0xddbe7e, alpha: 0.22, cap: 'round', join: 'round' });
    trace(g, pts);
    g.stroke({ width: 3.6, color: 0xddbe7e, alpha: 0.92, cap: 'round', join: 'round' });
    g.eventMode = 'none';
    layer.addChild(g);
  }, [idle, verb, hoverKey, hoverLink, hoverTown, hideUnbuilt, targets, linkTargetsList, sellTargetsList, buildPick, linkPick, secondLinkPick, sellPicks, code, game.assist, game.era, game.links, sceneSeq]);
  /* a tap when a mark lands (board option: sounds) */
  const lastPing = pings.length ? pings[pings.length - 1].id : 0;
  useEffect(() => {
    if (lastPing && getBoardOptions().sound) pingTap();
  }, [lastPing]);

  /* ------------------------- overlay positions ------------------------ */
  const shake = useGame((s) => s.shake);
  /* the refusal callout sits next to the rejected slot or link and fades
     by itself; a new refusal restarts it */
  const [calloutAt, setCalloutAt] = useState<number | null>(null);
  useEffect(() => {
    if (!shake) return;
    setCalloutAt(shake.at);
    const tm = window.setTimeout(() => setCalloutAt(null), 2800);
    return () => window.clearTimeout(tm);
  }, [shake]);
  /* the dual slot picked to build on, if any: its two industries and where
     on screen to hang the choice */
  const chooser = (() => {
    if (!idle && verb === 'build' && selectedCardId && buildPick) {
      const town = TOWN_BY_ID[buildPick.town];
      const allows = town?.slots[buildPick.slot]?.allows ?? [];
      if (allows.length < 2) return null;
      const key = tileKey(buildPick.town, buildPick.slot);
      const pos = townChrome(town).slots[buildPick.slot];
      return {
        key,
        wx: pos.x,
        wy: pos.y + TILE_R,
        options: allows.map((industry) => ({ industry, target: targets.find((tg) => tileKey(tg.town, tg.slot) === key && tg.industry === industry), picked: buildPick.industry === industry })),
      };
    }
    return null;
  })();
  const calloutPos = (() => {
    if (!shake || calloutAt !== shake.at) return null;
    const [townId, slotStr] = shake.key.split(':');
    const town = TOWN_BY_ID[townId];
    let at: [number, number] | null = null;
    if (town && slotStr !== undefined) {
      const sl = townChrome(town).slots[Number(slotStr)];
      if (sl) at = [sl.x, sl.y - TILE_HALF];
    }
    if (!at) at = regionPos(shake.key, gameRef.current?.era ?? 'canal');
    if (!at) return null;
    const sy = worldToScreen(at[0], at[1], view, size.w, size.h)[1];
    /* keep the sentence on screen: flip below when there is no room above */
    const up = sy > 70;
    return { wx: at[0], wy: at[1], py: up ? -10 : 2 * TILE_HALF + 10, up };
  })();
  const inspectTown = idle && inspect ? TOWN_BY_ID[inspect] : undefined;
  const inspectPos = inspectTown ? worldToScreen(inspectTown.x, inspectTown.y, view, size.w, size.h) : null;
  const hoverLinkDef = idle && hoverLink ? LINKS.find((l) => l.id === hoverLink && !hideUnbuilt && !game.links[l.id]) : undefined;
  const hoverLinkPos = hoverLinkDef ? worldToScreen(...linkMidWorld(hoverLinkDef, game.era), view, size.w, size.h) : null;
  const hoverLinkBuilt = hoverLinkDef ? game.links[hoverLinkDef.id] : undefined;
  /* merchant hover: the plate's tooltip says what the house buys, its
     barrels and its bonus — what anyone at the table can read on it. Which
     of the reader's works could sell there is theirs to work out: only the
     beginner aid counts them and lights them (aidOn) */
  const hoverMerchantDef = idle && hoverMerchant ? MERCHANT_BY_ID[hoverMerchant] : undefined;
  const hoverMerchantPos = hoverMerchantDef ? worldToScreen(hoverMerchantDef.x, hoverMerchantDef.y - rowLift(hoverMerchantDef), view, size.w, size.h) : null;
  const viewerIdx = (() => {
    const cur = game.players[game.current];
    if (!cur.isBot) return game.current;
    const humans = game.players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0);
    return humans.length === 1 ? humans[0] : -1;
  })();
  const aidHere = aidOn(game.assist, code !== null);
  const sellableHere = aidHere && hoverMerchantDef && viewerIdx >= 0 ? sellTargets(game, viewerIdx).filter((s) => s.merchant === hoverMerchantDef.id) : [];
  const netPeek = useGame((s) => s.netPeek);
  const lens = useGame((s) => s.lens);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    /* what stays lit, by priority: the beginner aid's playable slots while
       planning, a hovered player's network, and with the aid the tiles a
       hovered merchant would buy — otherwise everything. Without the aid a
       plan dims nothing: its candidates wear their own marks */
    const aid = aidOn(game.assist, code !== null);
    if (lens?.slots?.length) {
      /* the guide's lesson names the places it is about: they alone stay lit */
      scene.setHighlight(lens.slots);
    } else if (aid && selectedCardId && verb === 'build') {
      scene.setHighlight([...new Set(targets.filter((t) => t.valid).map((t) => tileKey(t.town, t.slot)))]);
    } else if (aid && selectedCardId && verb === 'sell') {
      /* the aid lights the works that can be sold and dims the rest */
      scene.setHighlight([...new Set(sellTargetsList.filter((t) => t.valid).map((t) => tileKey(t.town, t.slot)))]);
    } else if (netPeek !== null) {
      const towns = networkTowns(game, netPeek);
      scene.setHighlight(TOWNS.filter((t) => towns.has(t.id)).flatMap((t) => t.slots.map((_, si) => tileKey(t.id, si))));
    } else if (aid && hoverMerchantDef && merchantOpen(game, hoverMerchantDef.id) && viewerIdx >= 0) {
      const keys = [...new Set(sellableHere.map((s) => tileKey(s.town, s.slot)))];
      scene.setHighlight(keys);
    } else scene.setHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverMerchant, game.ledgerSeq, idle, netPeek, opts.beginnerAid, game.assist, code, selectedCardId, verb, targets, sellTargetsList, lens]);

  return (
    <div
      ref={host}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden rounded-md active:cursor-grabbing"
      aria-label={t('board.ariaLabelWebgl')}
      role="application"
    >
      {/* fixed lighting: darkened corners + warm lamp halo */}
      <VignetteLamp era={game.era} />

      {/* the context taken back: the title card's plate says the board is
          being set again, and offers the page if the browser never hands
          the context back */}
      {glLost && <BoardLostPlate game={game} />}

      {/* board-edge inner shadow for relief */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-md shadow-[inset_0_0_60px_rgba(0,0,0,.35)]" />


      {/* town hover tooltip (idle browsing) */}

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
            {hoverLinkBuilt ? (hoverLinkBuilt.era === 'rail' ? t('board.link.railLine') : t('board.link.canalLine')) : hoverLinkDef.canal && hoverLinkDef.rail ? t('board.link.canalOrRail') : hoverLinkDef.canal ? t('board.link.canalLink') : t('board.link.railLink')}
          </div>
          <div className="my-1.5 h-px bg-brass-700/50" />
          <div className="font-sans text-[12px] leading-relaxed text-cream-100/90">
            {(TOWN_BY_ID[hoverLinkDef.a]?.name ?? MERCHANT_BY_ID[hoverLinkDef.a]?.name) ?? hoverLinkDef.a} ↔{' '}
            {(TOWN_BY_ID[hoverLinkDef.b]?.name ?? MERCHANT_BY_ID[hoverLinkDef.b]?.name) ?? hoverLinkDef.b}
          </div>
          <div className="mt-1 font-sans text-[11.5px] text-cream-100/65">
            {hoverLinkBuilt ? t('board.link.builtBy', { name: game.players[hoverLinkBuilt.owner].name, era: t(`board.era.${hoverLinkBuilt.era}`) }) : t('board.link.unbuilt')}
          </div>
        </div>
      )}

      {/* merchant hover tooltip (idle browsing) */}
      {hoverMerchantDef && hoverMerchantPos && (
        <div
          className="pointer-events-none absolute z-30 w-[240px] rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 shadow-e3"
          style={
            hoverMerchantPos[1] > 220
              ? { left: hoverMerchantPos[0], top: hoverMerchantPos[1] - 64, transform: 'translate(-50%, -100%)' }
              : { left: hoverMerchantPos[0], top: hoverMerchantPos[1] + 64, transform: 'translate(-50%, 0)' }
          }
          role="tooltip"
        >
          <div className="font-fell text-[14px] tracking-wide text-brass-400">{hoverMerchantDef.name}</div>
          <div className="my-1.5 h-px bg-brass-700/50" />
          {merchantOpen(game, hoverMerchantDef.id) ? (
            <div className="space-y-1 font-sans text-[12px] leading-relaxed text-cream-100/90">
              {/* the goods named inside the sentence, in the log's words: lower
                  case where the language writes its nouns so */}
              <div>
                {t('board.merchant.buys')}{' '}
                <span className="text-cream-100">{merchantDemand(game, hoverMerchantDef.id).map((x) => t(`game.log.industry.${x}`)).join(', ') || t('board.merchant.buysNothing')}</span>
              </div>
              <div>
                {t('board.merchant.barrels', { left: merchantBeerLeft(game, hoverMerchantDef.id), total: merchantBarrelSlots(game, hoverMerchantDef.id) })}
                {' · '}
                {t('board.merchant.bonusIs', { bonus: hoverMerchantDef.bonusLabel })}
              </div>
              {aidHere && viewerIdx >= 0 && (
                <div className={sellableHere.length ? 'text-bottle-600 brightness-150' : 'text-cream-100/55'}>
                  {sellableHere.length ? t('board.merchant.youCanSell', { n: new Set(sellableHere.map((s) => tileKey(s.town, s.slot))).size }) : t('board.merchant.nothingToSell')}
                </div>
              )}
            </div>
          ) : (
            <div className="font-sans text-[12px] text-cream-100/65">{t('board.merchant.closed')}</div>
          )}
        </div>
      )}

      {/* a word from the townsfolk, over the town where it is said */}
      {!preview && !reading && <VoiceBubble anchors={anchors} />}

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
            anchors={anchors}
          />
        )}
      </AnimatePresence>

      {/* the settings gear lives in the bottom-right chip row (pages/Game.tsx);
          zoom lives on the wheel / + / − / 0 keys */}

      {!preview && !reading && <Minimap view={view} container={size} onCenter={(wx, wy) => cameraRef.current?.centerOn(wx, wy)} era={game.era} game={game} frameRef={mmFrameRef} />}

      {/* a slot that takes either of two industries, picked to build on: the
          two faces side by side, the one to be built ringed; the other is a
          click away, or says why it cannot be (Board chooser) */}
      <AnimatePresence>
        {chooser && (
          <Anchored key={chooser.key} anchors={anchors} at={{ wx: chooser.wx, wy: chooser.wy, py: 12 }} className="z-30 -translate-x-1/2" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="plaque flex flex-col items-center gap-1.5 rounded-lg px-2.5 py-2"
            role="group"
            aria-label={t('board.chooser.which')}
          >
            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brass-400">{t('board.chooser.which')}</span>
            <span className="flex items-stretch gap-2">
              {chooser.options.map((o) => (
                <button
                  key={o.industry}
                  type="button"
                  onClick={() => (o.target?.valid ? useGame.getState().pickBuild(o.target) : onInvalid(chooser.key, o.target?.reason ?? tr('board.invalid.tileCard')))}
                  title={o.target?.valid ? undefined : reasonText(o.target?.reason ?? tr('board.chooser.unavailable'))}
                  aria-pressed={o.picked}
                  className={cn('flex w-[76px] flex-col items-center gap-1 rounded-md border p-1 transition-all', o.picked ? 'scale-105 border-brass-400 bg-brass-500/15 shadow-[0_0_14px_rgba(221,190,126,.45)]' : o.target?.valid ? 'border-brass-700/50 hover:border-brass-400' : 'border-brass-700/30 opacity-45 grayscale')}
                >
                  <span className="h-14 w-14 overflow-hidden rounded-[5px] bg-[#12100C]">
                    <img src={industryFaceUrl(o.industry, opts.tileArt)} alt="" className="h-full w-full object-contain p-0.5" />
                  </span>
                  <span className="font-sans text-[9.5px] font-semibold leading-tight text-cream-100/90">{tr(`game.log.industry.${o.industry}`)}</span>
                  {!o.target?.valid && <span className="max-w-[72px] font-sans text-[8.5px] leading-tight text-rust-500 brightness-150">{reasonText(o.target?.reason ?? tr('board.chooser.unavailable'))}</span>}
                </button>
              ))}
            </span>
          </motion.div>
          </Anchored>
        )}
      </AnimatePresence>

      {/* a refusal with no place on the map (the table said no): a line at the top */}
      <AnimatePresence>
        {shake && !shake.key && calloutAt === shake.at && (
          <motion.div key={`banner-${shake.at}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2">
            <RefusalNote text={reasonText(shake.reason)} wide />
          </motion.div>
        )}
      </AnimatePresence>
      {/* why the slot or link is refused — one sentence, right next to it */}
      <AnimatePresence>
        {shake && calloutPos && (
          <Anchored key={shake.at} anchors={anchors} at={{ wx: calloutPos.wx, wy: calloutPos.wy, py: calloutPos.py, clampX: 120 }} className={cn('pointer-events-none z-30', calloutPos.up ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2')}>
          <motion.div initial={{ opacity: 0, y: calloutPos.up ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <RefusalNote text={reasonText(shake.reason)} notch={calloutPos.up ? 'up' : 'down'} />
          </motion.div>
          </Anchored>
        )}
      </AnimatePresence>
    </div>
  );
}
