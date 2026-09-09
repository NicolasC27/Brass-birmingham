import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { AnimatePresence, motion } from 'framer-motion';
import { INDUSTRY_LABEL, LINKS, MERCHANTS, MERCHANT_BY_ID, PLAYER_COLORS, TOWNS, TOWN_BY_ID } from '@/game/data';
import { merchantBarrelSlots, merchantDemand, merchantOpen, networkTowns, sellTargets, tileKey } from '@/game/engine';
import type { BuildTarget, LinkTarget, SellTarget } from '@/game/engine';
import type { PlanGhost } from '@/game/ghost';
import type { GameState } from '@/game/types';
import { useGame, verbsForCard } from '@/game/store';
import { onLangChange, reasonText, tr, useT } from '@/i18n';
import { MAP_URL, aidOn, getBoardOptions, setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import { useReducedMotion } from '@/components/game/useReducedMotion';
import { FAR_LOD_SCREEN, WORLD_H, WORLD_W, fitScale, ribbonLabelScale, worldToScreen, BLEED_X, BLEED_Y } from '@/components/game/boardView';
import type { View } from '@/components/game/boardView';
import { RIBBON_FONT, TILE_HALF, displayPosFor, townChrome } from '@/components/game/townChrome';
import { routeFor } from '@/components/game/routePaths';
import Minimap from '@/components/game/Minimap';
import TownInspector, { TownCardContent } from '@/components/game/TownInspector';
import VignetteLamp from '@/components/game/ambiance/VignetteLamp';
import { Camera } from './camera';
import { buildBoardScene, loadBoardAssets } from './paint';
import type { StockStyle } from './paint';
import { buildAmbiance } from './ambiance';
import { isKey } from '@/components/game/keybindings';
import type { Ambiance } from './ambiance';

const TILE_R = TILE_HALF;

function linkMidWorld(def: (typeof LINKS)[number]): [number, number] {
  /* most links have no explicit path — routeFor computes the winding route */
  return routeFor(def).mid;
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
}

/** world coords for anything a ledger entry can point at */
function regionPos(key: string): [number, number] | null {
  const town = TOWN_BY_ID[key];
  if (town) return [town.x, town.y];
  const merchant = MERCHANT_BY_ID[key];
  if (merchant) return [merchant.x, merchant.y];
  const link = LINKS.find((l) => l.id === key);
  if (link) return routeFor(link).mid;
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

/** a supply line that marches: redrawn by the ticker with a sliding dash offset */
interface March {
  g: Graphics;
  pts: number[][];
  dash: number;
  gap: number;
  width: number;
  color: number;
}

export default function PixiBoard({ game, targets, linkTargetsList, sellTargetsList, ghost, onInvalid, keyboard = true, focus = null }: Props) {
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
  /* board display options — shared store (also driven from the settings
     panel in Game.tsx); C hides unbuilt link traces, F fullscreen */
  const opts = useBoardOptions();
  const { hideUnbuilt, bigChips, greyFreeMerchants: greyFreeMerch, stockStyle, mapStyle, traffic, tileArt, slotArt, colorBlind, sealTiles, sealLinks, cardGrain, chipStyle } = opts;
  /* fullscreen is a keyboard-only affair now (F) — no HUD button */
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };
  const fsRef = useRef(toggleFullscreen);
  fsRef.current = toggleFullscreen;

  /* imperative handles shared between the boot effect and prop effects */
  const sceneRef = useRef<ReturnType<typeof buildBoardScene> | null>(null);
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
  const overlayRef = useRef<Container | null>(null);
  const pulsesRef = useRef<{ g: Graphics; base: number }[]>([]);
  const marchRef = useRef<March[]>([]);
  const propsRef = useRef({ targets, linkTargetsList, sellTargetsList, onInvalid });
  propsRef.current = { targets, linkTargetsList, sellTargetsList, onInvalid };
  const hoverRef = useRef({ setHoverTown, setHoverLink, setInspect, setHoverMerchant });
  hoverRef.current = { setHoverTown, setHoverLink, setInspect, setHoverMerchant };
  const suppressClick = useRef(false);
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
      const { Assets } = await import('pixi.js');
      const [canal, rail] = await Promise.all([Assets.load(MAP_URL[mapStyle].canal), Assets.load(MAP_URL[mapStyle].rail)]);
      if (cancelled) return;
      for (const [sp, tex] of [[scene.bgCanal, canal], [scene.bgRail, rail]] as const) {
        sp.texture = tex;
        sp.width = WORLD_W + 2 * BLEED_X;
        sp.height = WORLD_H + 2 * BLEED_Y;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapStyle]);

  /* planning mode cancels browsing affordances (mirrors the SVG Board) */
  const selectedCardId = useGame((s) => s.selectedCardId);
  const code = useGame((s) => s.code);
  const verb = useGame((s) => s.verb);
  const hoverKey = useGame((s) => s.hoverKey);
  const buildPick = useGame((s) => s.buildPick);
  const linkPick = useGame((s) => s.linkPick);
  const secondLinkPick = useGame((s) => s.secondLinkPick);
  const sellPick = useGame((s) => s.sellPick);
  const idle = !selectedCardId;
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

    const boot = async () => {
      const a = new Application();
      await a.init({
        background: '#141210',
        resizeTo: el,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      });
      if (destroyed) {
        a.destroy(true);
        return;
      }
      app = a;
      el.appendChild(a.canvas);

      await loadBoardAssets();
      if (destroyed) return;

      const { Assets, Sprite, Texture } = await import('pixi.js');
      const bootOpts = getBoardOptions();
      /* both paintings carry a bleed of countryside around the play area */
      const bgUrls = MAP_URL[bootOpts.mapStyle];
      const [canalTex, railTex] = await Promise.all([Assets.load(bgUrls.canal), Assets.load(bgUrls.rail)]);
      if (destroyed) return;
      const bgCanal = new Sprite(canalTex);
      bgCanal.width = WORLD_W + 2 * BLEED_X;
      bgCanal.height = WORLD_H + 2 * BLEED_Y;
      bgCanal.position.set(-BLEED_X, -BLEED_Y);
      const bgRail = new Sprite(railTex);
      bgRail.width = WORLD_W + 2 * BLEED_X;
      bgRail.height = WORLD_H + 2 * BLEED_Y;
      bgRail.position.set(-BLEED_X, -BLEED_Y);

      const scene = buildBoardScene(bgCanal, bgRail);
      sceneRef.current = scene;
      scene.setHideUnbuilt(bootOpts.hideUnbuilt);
      scene.setBigChips(bootOpts.bigChips);
      scene.setGreyFreeMerchants(bootOpts.greyFreeMerchants);
      scene.setStockStyle(bootOpts.stockStyle);
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
      /* mist + halos under the towns, smoke + traffic above */
      scene.world.addChildAt(ambiance.layer, 3);

      const cam = new Camera(() => ({ w: a.screen.width, h: a.screen.height }));
      cameraRef.current = cam;
      cam.onCommit = (v) => setView(v);

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
            return worldToScreen(...linkMidWorld(def), cam.view, a.screen.width, a.screen.height);
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
        };
      }

      /* --------------------- ticker: the only per-frame work ---------- */
      const overlay = scene.overlay;
      overlayRef.current = overlay;
      /* FX rings live above the overlay in their own layer, so overlay
         rebuilds (planning highlights, price tags, pulses) never detach
         an in-flight ring */
      const fxLayer = new Container();
      scene.world.addChild(fxLayer);
      let clock = 0;
      let railAlphaTarget = 0;
      let lastFxSeq = -1;
      const fxRings: { g: Graphics; t0: number }[] = [];
      const fxVehicles: { s: Sprite; pts: [number, number][]; t0: number }[] = [];
      a.ticker.add((t) => {
        clock += t.deltaMS / 1000;
        cam.tick(t.deltaMS);
        const { w, h } = { w: a.screen.width, h: a.screen.height };
        const s = fitScale(w, h) * cam.view.k;
        scene.world.scale.set(s);
        scene.world.position.set(w / 2 + cam.view.x - (WORLD_W / 2) * s, h / 2 + cam.view.y - (WORLD_H / 2) * s);
        /* ribbon counter-scale + zoom-driven slot alphas, combined with the
           spotlight dimming — all plain alpha writes, no re-raster */
        const ls = ribbonLabelScale(cam.view.k, fitScale(w, h), RIBBON_FONT);
        for (const r of scene.ribbons) r.scale.set(ls);
        const detail = s < FAR_LOD_SCREEN ? 0 : 1;
        const ringI = s <= 1.1 ? 1 : Math.max(0.6, 1 - (s - 1.1) * 0.8);
        for (const tv of scene.towns.values()) {
          for (const sl of tv.slots) {
            sl.ring.alpha = ringI * sl.spotAlpha;
            sl.frame.alpha = sl.spotAlpha;
            /* the painted art face stays full colour at every zoom */
            sl.art.alpha = sl.artBase * sl.spotAlpha;
            sl.art2.alpha = sl.art.alpha;
            sl.extras.alpha = detail * sl.spotAlpha;
            /* etched mark + income/VP chips fade at far zoom */
            sl.detailC.alpha = detail * sl.spotAlpha;
            sl.badges.alpha = sl.spotAlpha;
            sl.deco.alpha = sl.spotAlpha;
          }
        }
        /* pulses (planning highlights, hover rings) */
        const osc = 0.55 + 0.35 * Math.sin(clock * 4.5);
        for (const p of pulsesRef.current) p.g.alpha = p.base * osc;
        /* supply lines march toward the works being planned */
        for (const m of marchRef.current) {
          m.g.clear();
          dashPath(m.g, m.pts, m.dash, m.gap, -clock * 36);
          m.g.stroke({ width: m.width, color: m.color });
        }
        /* era crossfade */
        scene.bgRail.alpha += (railAlphaTarget - scene.bgRail.alpha) * Math.min(1, t.deltaMS / 700);
        /* spark-ring FX for the last confirmed action + a vehicle sailing
           the whole route when a link is built (boat on canals, train on
           rail, tinted with the owner's colour) */
        const g0 = gameRef.current;
        if (g0.fxSeq !== lastFxSeq && g0.lastFx) {
          lastFxSeq = g0.fxSeq;
          const at = displayPosFor(g0.lastFx.at[0], g0.lastFx.at[1]);
          const ring = new Graphics();
          fxLayer.addChild(ring);
          fxRings.push({ g: ring, t0: clock });
          ring.eventMode = 'none';
          ring.position.set(at[0], at[1]);
          if (g0.lastFx.kind === 'link' && g0.lastFx.linkId && !reduced) {
            const def = LINKS.find((l) => l.id === g0.lastFx!.linkId);
            if (def) {
              const built = g0.links[def.id];
              const isRail = built?.era === 'rail';
              const s = new Sprite(Texture.from(isRail ? '/icon-rail.svg' : '/boat-fx.png'));
              s.anchor.set(0.5);
              const ownerHex = PLAYER_COLORS[g0.players[g0.lastFx.player]?.color]?.hex ?? '#C9A45C';
              if (isRail) {
                s.width = s.height = 26;
                s.tint = 0xf2ead6;
              } else {
                /* the grand narrowboat sails the new canal — big ceremony
                   moment, owner-tinted (the tint shows on the lit cabin
                   and roses; the hull stays dark and elegant) */
                s.width = 130;
                s.height = 130 * (167 / 507);
                s.tint = parseInt(ownerHex.replace('#', ''), 16);
              }
              s.eventMode = 'none';
              fxLayer.addChild(s);
              fxVehicles.push({ s, pts: routeFor(def).pts, t0: clock });
            }
          }
        }
        /* vehicles sailing a freshly built route (~1.8s end to end) */
        for (let i = fxVehicles.length - 1; i >= 0; i--) {
          const fx = fxVehicles[i];
          const age = (clock - fx.t0) / 1.8;
          if (age >= 1) {
            fxLayer.removeChild(fx.s);
            fx.s.destroy();
            fxVehicles.splice(i, 1);
            continue;
          }
          /* parametric position + heading along the route */
          const pts = fx.pts;
          let total = 0;
          for (let j = 1; j < pts.length; j++) total += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
          let d = age * total;
          for (let j = 1; j < pts.length; j++) {
            const seg = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
            if (d <= seg || j === pts.length - 1) {
              const p = seg === 0 ? 0 : d / seg;
              const x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * p;
              const y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * p;
              fx.s.position.set(x, y);
              fx.s.rotation = Math.atan2(pts[j][1] - pts[j - 1][1], pts[j][0] - pts[j - 1][0]);
              break;
            }
            d -= seg;
          }
          fx.s.alpha = age < 0.15 ? age / 0.15 : age > 0.8 ? (1 - age) / 0.2 : 1;
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
      });

      /* --------------------- game state → scene ----------------------- */
      scene.redraw(gameRef.current);
      let lastGame: GameState | null = gameRef.current;
      let lastSpot: number | null = null;
      let lastFlyAt = 0;
      let lastLedgerSeq = -1;
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
        if (s.flyTo && s.flyTo.at !== lastFlyAt) {
          lastFlyAt = s.flyTo.at;
          const pos = regionPos(s.flyTo.key);
          if (pos) cam.flyTo(pos[0], pos[1], Math.max(cam.target.k, 1.5));
        }
        /* follow the others: glide to wherever a bot, or another player
           at an online table, just played */
        if (s.followBots && s.game && s.game.ledgerSeq !== lastLedgerSeq) {
          lastLedgerSeq = s.game.ledgerSeq;
          const e = s.game.ledger[s.game.ledger.length - 1];
          const other = e?.player !== undefined && (s.game.players[e.player]?.isBot || (s.seat !== null && e.player !== s.seat));
          if (e?.region && other && Date.now() - cam.lastManual > 4000) {
            const pos = regionPos(e.region);
            if (pos) cam.flyTo(pos[0], pos[1], Math.max(cam.target.k, 1.4));
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
      /* merchant plates (paint.ts): 1.15-scaled cards centred on the node, southern ones lifted 34 units */
      const merchantAt = (wx: number, wy: number) => {
        for (const m of MERCHANTS) {
          const w = (16 + m.slots * 40 + (m.slots - 1) * 12 + 18 + 40 + 16) * 1.15;
          const h = 88 * 1.15;
          const cy = m.y - (m.y > 1500 ? 34 : 0);
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
           hover tracks the visible curve exactly */
        const pts = routeFor(def).pts.map((p) => [...p] as [number, number]);
        trimEnd(pts, true);
        trimEnd(pts, false);
        linkHitPts.set(def.id, pts);
      }

      const linkAt = (wx: number, wy: number): (typeof LINKS)[number] | null => {
        let best: { def: (typeof LINKS)[number]; d: number } | null = null;
        for (const def of LINKS) {
          const pts = linkHitPts.get(def.id)!;
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

      const onHoverMove = (e: PointerEvent) => {
        if (e.buttons !== 0) return; // camera drag owns the pointer
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        const m = modes();
        const slot = slotAt(wx, wy);
        if (m.isBuilding || m.isSelling) {
          const key = slot ? tileKey(slot.town.id, slot.si) : null;
          if (st().hoverKey !== key) st().setHover(key);
          el.style.cursor = slot ? 'pointer' : 'grab';
          return;
        }
        if (m.isNetworking) {
          const def = linkAt(wx, wy);
          const ok = def && linkClickable(def);
          const id = ok ? def.id : null;
          if (st().hoverKey !== id) st().setHover(id);
          el.style.cursor = ok ? 'pointer' : 'grab';
          return;
        }
        /* idle browsing: merchant plates, then towns, then links */
        const merch = merchantAt(wx, wy);
        hoverRef.current.setHoverMerchant(merch?.id ?? null);
        if (merch) {
          hoverRef.current.setHoverTown(null);
          hoverRef.current.setHoverLink(null);
          el.style.cursor = 'help';
          return;
        }
        const town = townAt(wx, wy);
        hoverRef.current.setHoverTown(town?.id ?? null);
        if (town) {
          hoverRef.current.setHoverLink(null);
          el.style.cursor = 'pointer';
        } else {
          const def = linkAt(wx, wy);
          hoverRef.current.setHoverLink(def?.id ?? null);
          el.style.cursor = def ? 'help' : 'grab';
        }
      };
      el.addEventListener('pointermove', onHoverMove);
      cleanups.push(() => el.removeEventListener('pointermove', onHoverMove));

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
          if (t.valid) st().pickLink(t);
          else p.onInvalid(def.id, t.reason ?? tr('board.invalid.cannotBuild'));
          return;
        }
        if (m.idle) {
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

      const onDown = (e: PointerEvent) => {
        if (fromOverlay(e)) return; // let overlay buttons receive their click
        cam.pointerDown(e);
        suppressClick.current = false;
        el.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (cam.pointerMove(e)) suppressClick.current = true;
      };
      const onUp = (e: PointerEvent) => {
        cam.pointerUp();
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

      /* keyboard: + / − / 0, ←/→ town tour */
      let tourIdx = -1;
      const TOUR = [...TOWNS].sort((ta, tb) => ta.x - tb.x || ta.y - tb.y);
      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === '+' || e.key === '=') cam.zoomStep(1.35);
        else if (e.key === '-' || e.key === '_') cam.zoomStep(1 / 1.35);
        else if (isKey(e, 'fit')) cam.fit();
        else if (isKey(e, 'links')) setBoardOption('hideUnbuilt', !getBoardOptions().hideUnbuilt);
        else if (isKey(e, 'fullscreen')) fsRef.current();
        else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          tourIdx = (tourIdx + (e.key === 'ArrowRight' ? 1 : -1) + TOUR.length) % TOUR.length;
          const town = TOUR[tourIdx];
          cam.flyTo(town.x, town.y, Math.max(cam.target.k, 1.5));
        } else return;
        e.preventDefault();
      };
      if (keyboardRef.current) {
        window.addEventListener('keydown', onKey);
        cleanups.push(() => window.removeEventListener('keydown', onKey));
      }

      /* container size for React overlays */
      const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
      ro.observe(el);
      setSize({ w: el.clientWidth, h: el.clientHeight });
      cleanups.push(() => ro.disconnect());
    };

    void boot();

    return () => {
      destroyed = true;
      for (const fn of cleanups) fn();
      if (app) app.destroy(true, { children: true, texture: false });
      sceneRef.current = null;
      cameraRef.current = null;
      overlayRef.current = null;
    };
  }, [reduced]);

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
    const trace = (g: Graphics, pts: number[][]) => {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    };
    /* dark £-plaque centred at (cx, cy) — same chrome as the SVG tags */
    const priceTag = (cx: number, cy: number, w: number, h: number, label: string) => {
      const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, 3).fill(0x2c251d).stroke({ width: 1, color: 0xc9a45c });
      g.position.set(cx, cy);
      g.eventMode = 'none';
      const txt = new Text({ text: label, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fill: 0xc9a45c } });
      txt.anchor.set(0.5);
      txt.position.set(cx, cy);
      txt.eventMode = 'none';
      overlay.addChild(g, txt);
    };

    if (verb === 'build' && selectedCardId) {
      const seen = new Set<string>();
      for (const t of targets) {
        const key = tileKey(t.town, t.slot);
        if (!t.valid || seen.has(key)) continue;
        seen.add(key);
        const town = TOWN_BY_ID[t.town];
        const c = townChrome(town);
        const pos = c.slots[t.slot];
        const picked = buildPick && tileKey(buildPick.town, buildPick.slot) === key;
        const g = new Graphics()
          .roundRect(pos.x - TILE_R, pos.y - TILE_R, TILE_R * 2, TILE_R * 2, 9)
          .stroke({ width: picked ? 4 : 2.5, color: 0xc9a45c });
        g.eventMode = 'none';
        if (picked) {
          overlay.addChild(g);
        } else pulse(g, 0.8);
      }
      /* price tag above the hovered valid slot (Board: TownNode £-plaque);
         the beginner aid itemises it: tile + market coal + market iron */
      if (hoverKey) {
        const t = targets.filter((x) => tileKey(x.town, x.slot) === hoverKey).find((x) => x.valid);
        if (t) {
          const pos = townChrome(TOWN_BY_ID[t.town]).slots[t.slot];
          const coal = t.coalPlan.totalCost;
          const iron = t.ironPlan.totalCost;
          const label =
            aidOn(game.assist, useGame.getState().code !== null) && coal + iron > 0
              ? `£${t.total} = ${t.cost}${coal ? ` + ${coal} ${tr('board.aid.coal')}` : ''}${iron ? ` + ${iron} ${tr('board.aid.iron')}` : ''}`
              : `£${t.total}`;
          priceTag(pos.x, pos.y - TILE_R - 13.5, Math.max(52, label.length * 6.2 + 12), 15, label);
        }
      }
    }

    if (verb === 'network' && selectedCardId) {
      for (const t of linkTargetsList) {
        if (!t.valid) continue;
        const def = t.link;
        const pts = routeFor(def).pts;
        const g = new Graphics();
        trace(g, pts);
        const picked = linkPick?.link.id === def.id || secondLinkPick?.link.id === def.id;
        g.stroke({ width: picked ? 5 : 3, color: 0xc9a45c, cap: 'round', join: 'round' });
        g.eventMode = 'none';
        if (picked) overlay.addChild(g);
        else pulse(g, 0.55);
        /* hovered / picked valid link: flowing dashes + £-plaque at mid-route */
        if (hoverKey === def.id || picked) {
          const d = new Graphics();
          dashPath(d, pts, 7, 6);
          d.stroke({ width: 2.4, color: 0xddbe7e, cap: 'round', join: 'round' });
          d.eventMode = 'none';
          pulse(d, 0.95); // alpha-pulsed stand-in for the SVG dash-flow
          const [mx, my] = linkMidWorld(def);
          priceTag(mx, my - 17.5, 48, 17, `£${t.total}`);
        }
      }
    }

    if (verb === 'sell' && selectedCardId) {
      for (const t of sellTargetsList) {
        if (!t.valid) continue;
        const c = townChrome(TOWN_BY_ID[t.town]);
        const pos = c.slots[t.slot];
        const picked = sellPick && tileKey(sellPick.town, sellPick.slot) === tileKey(t.town, t.slot);
        const g = new Graphics().circle(pos.x, pos.y, TILE_R + 5).stroke({ width: 3, color: 0x2e5540 });
        g.eventMode = 'none';
        if (picked) overlay.addChild(g);
        else pulse(g, 0.8);
      }
    }

    /* ghost supply lines — where the coal and iron of the planned works
       would come from. Each line is a pale casing under a resource-coloured
       core so it reads on water, hills and towns alike; an arrow lands on
       the works, and the market lines march from a cube at the edge of
       the world with the resource's own colour (coal near-black, iron the
       orange of the exchange). */
    if (ghost) {
      const [gx, gy] = displayPosFor(ghost.at[0], ghost.at[1]);
      const CASING = 0xf2ead6;
      const coreOf = (resource: string) => (resource === 'coal' ? 0x171310 : 0xe07020);
      /* the line ends short of the tile, on an arrowhead */
      const arrow = (sx: number, sy: number, color: number) => {
        const dx = gx - sx;
        const dy = gy - sy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const tipX = gx - ux * (TILE_R + 3);
        const tipY = gy - uy * (TILE_R + 3);
        const baseX = tipX - ux * 13;
        const baseY = tipY - uy * 13;
        const head = new Graphics()
          .poly([tipX, tipY, baseX - uy * 7, baseY + ux * 7, baseX + uy * 7, baseY - ux * 7])
          .fill(color)
          .stroke({ width: 2, color: CASING, join: 'round' });
        head.eventMode = 'none';
        overlay.addChild(head);
        return [tipX - ux * 10, tipY - uy * 10] as [number, number];
      };
      for (const src of ghost.tileSources) {
        const [sx, sy] = displayPosFor(src.x, src.y);
        const end = arrow(sx, sy, coreOf(src.resource));
        const casing = new Graphics().moveTo(sx, sy).lineTo(end[0], end[1]).stroke({ width: 7, color: CASING, alpha: 0.85, cap: 'round' });
        const core = new Graphics().moveTo(sx, sy).lineTo(end[0], end[1]).stroke({ width: 3, color: coreOf(src.resource), cap: 'round' });
        casing.eventMode = 'none';
        core.eventMode = 'none';
        overlay.addChild(casing, core);
        const tag = new Graphics().roundRect(-14, -9, 28, 16, 3).fill(0x171310).stroke({ width: 0.8, color: 0x8a6b33 });
        tag.position.set((sx + gx) / 2, (sy + gy) / 2);
        const txt = new Text({ text: `×${src.amount}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fill: 0xf2ead6 } });
        txt.anchor.set(0.5);
        txt.position.set((sx + gx) / 2, (sy + gy) / 2);
        tag.eventMode = 'none';
        txt.eventMode = 'none';
        overlay.addChild(tag, txt);
      }
      /* market supply: from the coal/iron trays at the right edge of the
         world, marching dashes on a pale casing, a cube where they start,
         a £-plaque per resource by the works (Board ghost.market) */
      ghost.market.forEach((m, i) => {
        const sx = WORLD_W - 52;
        const sy = m.resource === 'coal' ? WORLD_H * 0.29 : WORLD_H * 0.71;
        const color = coreOf(m.resource);
        const end = arrow(sx, sy, color);
        const casing = new Graphics().moveTo(sx, sy).lineTo(end[0], end[1]).stroke({ width: 7, color: CASING, alpha: 0.85, cap: 'round' });
        casing.eventMode = 'none';
        overlay.addChild(casing);
        const core = new Graphics();
        core.eventMode = 'none';
        overlay.addChild(core);
        marchRef.current.push({ g: core, pts: [[sx, sy], end], dash: 9, gap: 7, width: 3, color });
        /* the cube the line leaves from: the resource, as on the exchange */
        const cube = new Graphics().roundRect(sx - 9, sy - 9, 18, 18, 3).fill(color).stroke({ width: 2, color: CASING });
        cube.eventMode = 'none';
        overlay.addChild(cube);
        const n = new Text({ text: `×${m.amount}`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fill: m.resource === 'coal' ? 0xf2ead6 : 0x171310 } });
        n.anchor.set(0.5);
        n.position.set(sx, sy);
        n.eventMode = 'none';
        overlay.addChild(n);
        priceTag(gx + 40, gy - 21.5 - i * 20, 52, 17, tr('board.ghost.mkt', { cost: m.cost }));
      });
    }

    /* ledger flash: hoverKey naming a town or link outside planning pulses
       the cluster frame / the route (Board: TownNode flashing rect) */
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
          trace(g, routeFor(def).pts);
          g.stroke({ width: 8, color: 0xc9a45c, cap: 'round', join: 'round' });
          g.eventMode = 'none';
          pulse(g, 0.45);
        }
      }
    }

    /* idle browsing: hovering a town pulses its adjacent routes in brass;
       a hovered unbuilt link gets a bright brass trace (Board: adjacent /
       linkHovered paths) */
    if (idle && hoverTown) {
      for (const def of LINKS) {
        if (def.a !== hoverTown && def.b !== hoverTown) continue;
        const pts = routeFor(def).pts;
        const g = new Graphics();
        trace(g, pts);
        g.stroke({ width: 8, color: 0xc9a45c, cap: 'round', join: 'round' });
        g.eventMode = 'none';
        pulse(g, 0.45);
      }
    }
    if (idle && hoverLink) {
      const def = LINKS.find((l) => l.id === hoverLink);
      const adjacent = def && hoverTown !== null && (def.a === hoverTown || def.b === hoverTown);
      if (def && !adjacent) {
        const g = new Graphics();
        trace(g, routeFor(def).pts);
        g.stroke({ width: 3.4, color: 0xddbe7e, alpha: 0.85, cap: 'round', join: 'round' });
        g.eventMode = 'none';
        overlay.addChild(g);
      }
    }
  }, [verb, selectedCardId, targets, linkTargetsList, sellTargetsList, ghost, hoverKey, hoverTown, hoverLink, buildPick, linkPick, secondLinkPick, sellPick, idle, game.ledgerSeq]);

  /* pointer affordances on the WebGL hit areas (SVG: cursor-pointer/help).
     Anything left at 'inherit' falls back to the frame's grab/grabbing. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const isBuilding = verb === 'build' && !!selectedCardId;
    const isNetworking = verb === 'network' && !!selectedCardId;
    const isSelling = verb === 'sell' && !!selectedCardId;
    const slotCursor = isBuilding || isSelling || !selectedCardId ? 'pointer' : 'inherit';
    for (const town of TOWNS) {
      for (const sl of scene.towns.get(town.id)!.slots) sl.hit.cursor = slotCursor;
    }
    for (const def of LINKS) {
      const eraOk = game.era === 'canal' ? def.canal : def.rail;
      const clickable = isNetworking && eraOk && !game.links[def.id];
      scene.linkHit.get(def.id)!.cursor = clickable ? 'pointer' : !selectedCardId ? 'help' : 'inherit';
    }
  }, [verb, selectedCardId, game, size]);

  /* Esc closes the inspector */
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

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
  const calloutPos = (() => {
    if (!shake || calloutAt !== shake.at) return null;
    const [townId, slotStr] = shake.key.split(':');
    const town = TOWN_BY_ID[townId];
    let at: [number, number] | null = null;
    if (town && slotStr !== undefined) {
      const sl = townChrome(town).slots[Number(slotStr)];
      if (sl) at = [sl.x, sl.y - TILE_HALF];
    }
    if (!at) at = regionPos(shake.key);
    if (!at) return null;
    const [sx, sy] = worldToScreen(at[0], at[1], view, size.w, size.h);
    /* keep the sentence on screen: flip below when there is no room above */
    const up = sy > 70;
    return { x: Math.max(120, Math.min(size.w - 120, sx)), y: up ? sy - 10 : sy + 2 * TILE_HALF + 10, up };
  })();
  const inspectTown = idle && inspect ? TOWN_BY_ID[inspect] : undefined;
  const inspectPos = inspectTown ? worldToScreen(inspectTown.x, inspectTown.y, view, size.w, size.h) : null;
  const hoverTownDef = idle && hoverTown && !inspect ? TOWN_BY_ID[hoverTown] : undefined;
  const hoverTownPos = hoverTownDef ? worldToScreen(hoverTownDef.x, hoverTownDef.y, view, size.w, size.h) : null;
  const hoverLinkDef = idle && hoverLink ? LINKS.find((l) => l.id === hoverLink) : undefined;
  /* merchant hover: the plate's tooltip, and only the goods YOU could sell there stay lit */
  const hoverMerchantDef = idle && hoverMerchant ? MERCHANT_BY_ID[hoverMerchant] : undefined;
  const hoverMerchantPos = hoverMerchantDef ? worldToScreen(hoverMerchantDef.x, hoverMerchantDef.y - (hoverMerchantDef.y > 1500 ? 34 : 0), view, size.w, size.h) : null;
  const viewerIdx = (() => {
    const cur = game.players[game.current];
    if (!cur.isBot) return game.current;
    const humans = game.players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0);
    return humans.length === 1 ? humans[0] : -1;
  })();
  const sellableHere = hoverMerchantDef && viewerIdx >= 0 ? sellTargets(game, viewerIdx).filter((s) => s.merchant === hoverMerchantDef.id) : [];
  const netPeek = useGame((s) => s.netPeek);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    /* what stays lit, by priority: the beginner aid's playable slots while
       planning, a hovered player's network, the tiles a hovered merchant
       would buy — otherwise everything */
    const aid = aidOn(game.assist, code !== null);
    if (aid && selectedCardId && verb === 'build') {
      scene.setHighlight([...new Set(targets.filter((t) => t.valid).map((t) => tileKey(t.town, t.slot)))]);
    } else if (aid && selectedCardId && verb === 'sell') {
      scene.setHighlight([...new Set(sellTargetsList.filter((t) => t.valid).map((t) => tileKey(t.town, t.slot)))]);
    } else if (netPeek !== null) {
      const towns = networkTowns(game, netPeek);
      scene.setHighlight(TOWNS.filter((t) => towns.has(t.id)).flatMap((t) => t.slots.map((_, si) => tileKey(t.id, si))));
    } else if (hoverMerchantDef && merchantOpen(game, hoverMerchantDef.id) && viewerIdx >= 0) {
      const keys = [...new Set(sellableHere.map((s) => tileKey(s.town, s.slot)))];
      scene.setHighlight(keys);
    } else scene.setHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverMerchant, game.ledgerSeq, idle, netPeek, opts.beginnerAid, game.assist, code, selectedCardId, verb, targets, sellTargetsList]);
  const hoverLinkPos = hoverLinkDef ? worldToScreen(...linkMidWorld(hoverLinkDef), view, size.w, size.h) : null;
  const hoverLinkBuilt = hoverLinkDef ? game.links[hoverLinkDef.id] : undefined;

  return (
    <div
      ref={host}
      className="relative h-full w-full cursor-grab touch-none select-none overflow-hidden rounded-md active:cursor-grabbing"
      aria-label={t('board.ariaLabelWebgl')}
      role="application"
    >
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

      {/* town hover tooltip (idle browsing) */}
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
              <div>
                {t('board.merchant.buys')}{' '}
                <span className="text-cream-100">{merchantDemand(game, hoverMerchantDef.id).map((x) => INDUSTRY_LABEL[x]).join(', ') || t('board.merchant.buysNothing')}</span>
              </div>
              <div>
                {t('board.merchant.barrels', { left: game.merchantBeer[hoverMerchantDef.id] ?? 0, total: merchantBarrelSlots(game, hoverMerchantDef.id) })}
                {' · '}
                {t('board.merchant.bonusIs', { bonus: hoverMerchantDef.bonusLabel })}
              </div>
              <div className={sellableHere.length ? 'text-bottle-600 brightness-150' : 'text-cream-100/55'}>
                {viewerIdx < 0 ? t('board.merchant.noViewer') : sellableHere.length ? t('board.merchant.youCanSell', { n: new Set(sellableHere.map((s) => tileKey(s.town, s.slot))).size }) : t('board.merchant.nothingToSell')}
              </div>
            </div>
          ) : (
            <div className="font-sans text-[12px] text-cream-100/65">{t('board.merchant.closed')}</div>
          )}
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
            onZoomHere={() => cameraRef.current?.flyTo(inspectTown.x, inspectTown.y, 1.8)}
          />
        )}
      </AnimatePresence>

      {/* the settings gear lives in the bottom-right chip row (pages/Game.tsx);
          zoom lives on the wheel / + / − / 0 keys */}

      <Minimap view={view} container={size} onCenter={(wx, wy) => cameraRef.current?.centerOn(wx, wy)} era={game.era} game={game} />

      {/* why the slot or link is refused — one sentence, right next to it */}
      <AnimatePresence>
        {shake && calloutPos && (
          <motion.div
            key={shake.at}
            initial={{ opacity: 0, y: calloutPos.up ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute z-30 max-w-[240px] rounded-md border border-rust-500/80 bg-coal-900/95 px-2.5 py-1.5 text-center font-sans text-[11.5px] leading-snug text-cream-100 shadow-e3"
            style={{ left: calloutPos.x, top: calloutPos.y, transform: calloutPos.up ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
            role="alert"
          >
            {reasonText(shake.reason)}
            <span
              aria-hidden
              className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-rust-500/80 bg-coal-900/95"
              style={calloutPos.up ? { bottom: -5, borderRight: '1px solid', borderBottom: '1px solid' } : { top: -5, borderLeft: '1px solid', borderTop: '1px solid' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
