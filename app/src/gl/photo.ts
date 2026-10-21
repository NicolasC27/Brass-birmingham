import { Container, Filter, GlProgram, Rectangle, RenderTexture, Sprite, Texture, UPDATE_PRIORITY, defaultFilterVert } from 'pixi.js';
import type { Application } from 'pixi.js';
import { LINKS, MERCHANTS, TOWNS } from '@/game/data';
import { merchantOpen, tileKey } from '@/game/engine';
import type { GameState } from '@/game/types';
import { APRON_X, APRON_Y, BLEED_X, BLEED_Y, WORLD_H, WORLD_W, fitScale, holdFitReserve, setZoomCeiling } from '@/components/game/boardView';
import { townChrome } from '@/components/game/townChrome';
import { routeFor } from '@/components/game/routePaths';
import type { Camera } from './camera';
import type { BoardScene } from './paint';
import { printSize } from './photoPrint';
import type { PhotoLook } from './photoPrint';
import { getPhoto, subscribePhoto } from './photoState';
import type { PhotoState } from './photoState';

/* ------------------------------------------------------------------ */
/* The photo mode: the table without its HUD, a camera let off its     */
/* leash, the board printed in a look — an engraving in sepia, a        */
/* watercolour, a night — and a print pulled at twice the frame.        */
/* The board lends its stage, scene and camera once it is set up        */
/* (attachPhoto, from PixiBoard) and dresses itself from the store the  */
/* toolbar writes (photoState.ts, PhotoMode.tsx). The look is one       */
/* shader laid over the whole world, the same at the table and on the   */
/* print: its grain, its hatching and its margins are measured in      */
/* pixels of the frame, so a print pulled at twice the size carries    */
/* them at twice the size.                                              */
/* ------------------------------------------------------------------ */

/** how close the photographer may come: well past the table's own limit */
export const PHOTO_MAX_K = 5;

/** the whole printed table, apron and all, in world units: the look's
 *  filter reads this area, clipped to the frame, rather than walking the
 *  world's children for its bounds each frame */
const TABLE_AREA = new Rectangle(-BLEED_X - APRON_X, -BLEED_Y - APRON_Y, WORLD_W + 2 * (BLEED_X + APRON_X), WORLD_H + 2 * (BLEED_Y + APRON_Y));

/* ----------------------------- shaders ----------------------------- */

/* the frame in pixels of the frame (uFrame), how many print pixels make
   one of them (uUnit: 1 at the table), and a seed for the paper */
const PRELUDE = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec2 uFrame;
uniform float uUnit;
uniform float uSeed;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 tex(vec2 px) {
  vec2 uv = clamp(px * uInputSize.zw, uInputClamp.xy, uInputClamp.zw);
  return texture(uTexture, uv).rgb;
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}

/* 1 in the middle of the sheet, falling toward its edges */
float plate(vec2 uv, float bite) {
  vec2 e = uv * (1.0 - uv);
  return pow(clamp(16.0 * e.x * e.y, 0.0, 1.0), bite);
}
`;

/* an engraving pulled in sepia ink on laid paper, faintly hand-tinted like
   the county maps of the 1830s: the shade cut in two systems of lines,
   the second only where the shade deepens */
const SEPIA = /* glsl */ `${PRELUDE}
void main() {
  vec2 pos = vTextureCoord * uInputSize.xy;
  vec2 p = pos / uUnit;
  vec2 uv = p / uFrame;
  vec3 c = tex(pos);
  float l = luma(c);
  /* the burin's crispness: the shade pushed away from its neighbours */
  float r1 = 1.1 * uUnit;
  float r2 = 3.2 * uUnit;
  float n1 = 0.25 * (luma(tex(pos + vec2(r1, 0.0))) + luma(tex(pos - vec2(r1, 0.0))) + luma(tex(pos + vec2(0.0, r1))) + luma(tex(pos - vec2(0.0, r1))));
  float n2 = 0.25 * (luma(tex(pos + vec2(r2, r2))) + luma(tex(pos - vec2(r2, r2))) + luma(tex(pos + vec2(r2, -r2))) + luma(tex(pos - vec2(r2, -r2))));
  l = clamp(l + (l - n1) * 1.1 + (l - n2) * 0.6, 0.0, 1.0);
  /* an engraving is mostly paper: the shade lifted toward it */
  l = smoothstep(0.02, 0.98, pow(l, 0.7));
  /* the lines: a hand's slight waver, their width the depth of the shade */
  float wob = (vnoise(p * 0.045 + uSeed) - 0.5) * 1.6;
  float s = 3.4;
  float aa = 1.6 / s;
  float t1 = abs(fract((dot(p, vec2(0.866, 0.5)) + wob) / s) - 0.5) * 2.0;
  float t2 = abs(fract((dot(p, vec2(0.574, -0.819)) - wob) / s) - 0.5) * 2.0;
  float w1 = clamp((0.86 - l) * 1.0, 0.0, 0.9);
  float w2 = clamp((0.5 - l) * 1.5, 0.0, 0.85);
  float ink = max(1.0 - smoothstep(w1 - aa, w1 + aa, t1), 1.0 - smoothstep(w2 - aa, w2 + aa, t2));
  float tone = l * (1.0 - ink * 0.55) + (1.0 - ink) * 0.04;
  tone = mix(l, tone, 0.66);
  /* the ink's ramp: bistre in the cuts, a warm mid, cream paper */
  vec3 bistre = vec3(0.14, 0.095, 0.06);
  vec3 mid = vec3(0.52, 0.405, 0.29);
  vec3 paper = vec3(0.95, 0.91, 0.8);
  vec3 col = tone < 0.5 ? mix(bistre, mid, tone * 2.0) : mix(mid, paper, tone * 2.0 - 1.0);
  /* a wash of the colours laid by hand over the print */
  vec3 chroma = c - vec3(luma(c));
  col += chroma * 0.16 * smoothstep(0.1, 0.6, tone);
  /* laid paper: its tooth, its chain lines, and the foxing of years */
  float tooth = fbm(p * 0.42 + uSeed) * 0.7 + vnoise(p * 1.35) * 0.3;
  col *= 0.95 + 0.075 * tooth;
  col *= 1.0 - 0.018 * smoothstep(0.7, 1.0, abs(fract(p.x / 26.0) - 0.5) * 2.0);
  float fox = smoothstep(0.64, 0.82, fbm(p * 0.0045 + uSeed * 3.0));
  col = mix(col, col * vec3(0.93, 0.85, 0.72), fox * 0.45);
  /* the plate's edge: the ink browns as the sheet's rim darkens */
  float v = plate(uv, 0.2);
  col = mix(col * vec3(0.8, 0.7, 0.56), col, v);
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* a watercolour on cold-pressed paper, line and wash: the washes
   softened and let run a little, the pigment pooled at their edges and
   settled in the paper's tooth, all of it lighter; over them the pen's
   line, drawn from the board's own edges, so a name still reads; and the
   colour stopping short of the sheet */
const AQUARELLE = /* glsl */ `${PRELUDE}
void main() {
  vec2 pos = vTextureCoord * uInputSize.xy;
  vec2 p = pos / uUnit;
  vec2 uv = p / uFrame;
  /* the water carries the pigment off its line, a few pixels either way */
  vec2 run = vec2(fbm(p * 0.02 + uSeed), fbm(p * 0.02 + uSeed + 17.3)) - 0.5;
  vec2 q = pos + run * 5.0 * uUnit;
  vec3 acc = tex(q);
  for (int i = 1; i < 14; i++) {
    float a = float(i) * 2.39996;
    float rr = sqrt(float(i) / 13.0) * 2.4 * uUnit;
    acc += tex(q + vec2(cos(a), sin(a)) * rr);
  }
  vec3 soft = acc / 14.0;
  float lc = luma(soft);
  /* where one wash meets another the pigment gathers */
  float e = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    e += abs(luma(tex(q + vec2(cos(a), sin(a)) * 4.0 * uUnit)) - lc);
  }
  e /= 6.0;
  /* clear, brighter washes */
  vec3 col = mix(vec3(lc), soft, 1.45);
  col = floor(col * 8.0 + 0.5) / 8.0 * 0.2 + col * 0.8;
  col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * 0.76;
  col *= 1.0 - smoothstep(0.02, 0.16, e) * 0.24;
  /* blooms where the paper stayed wet longer, and the tooth the pigment settles in */
  float bloom = fbm(p * 0.005 + uSeed * 2.0);
  col = 1.0 - (1.0 - col) * (0.82 + bloom * 0.36);
  float tooth = vnoise(p * 0.5) * 0.55 + vnoise(p * 1.3) * 0.45;
  col *= 1.0 - (tooth - 0.5) * 0.12 * (1.0 - luma(col) * 0.5);
  /* the pen: the board's own edges, in a sepia ink, a little broken */
  float d = 1.0 * uUnit;
  float gx = luma(tex(pos + vec2(d, 0.0))) - luma(tex(pos - vec2(d, 0.0)));
  float gy = luma(tex(pos + vec2(0.0, d))) - luma(tex(pos - vec2(0.0, d)));
  float pen = smoothstep(0.07, 0.3, length(vec2(gx, gy))) * (0.7 + 0.3 * vnoise(p * 0.3));
  col = mix(col, col * vec3(0.3, 0.26, 0.24), pen * 0.62);
  vec3 paper = vec3(0.985, 0.972, 0.94) * (0.975 + 0.035 * tooth);
  col *= vec3(0.99, 0.985, 0.965);
  /* the washes stop short of the sheet's edge, raggedly, with a darker lip */
  float edge = min(min(uv.x, 1.0 - uv.x) * uFrame.x, min(uv.y, 1.0 - uv.y) * uFrame.y);
  float rag = fbm(p * 0.018 + uSeed) * 34.0 + vnoise(p * 0.16) * 7.0;
  float m = smoothstep(rag + 4.0, rag + 18.0, edge);
  float lip = smoothstep(0.0, 0.35, m) * (1.0 - smoothstep(0.35, 1.0, m));
  col *= 1.0 - lip * 0.16;
  col = mix(paper, col, m);
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* the same country by moonlight: a deep blue night, the colours sunk but
   not lost, the fires already on the map left warm (the lamps of the
   towns are laid over it, unfiltered: nightLamps) */
const NUIT = /* glsl */ `${PRELUDE}
void main() {
  vec2 pos = vTextureCoord * uInputSize.xy;
  vec2 p = pos / uUnit;
  vec2 uv = p / uFrame;
  vec3 c = tex(pos);
  float l = luma(c);
  vec3 moon = vec3(0.035, 0.055, 0.11) + vec3(0.30, 0.40, 0.62) * pow(l, 1.35);
  vec3 kept = c * vec3(0.26, 0.32, 0.5);
  vec3 col = mix(moon, kept + moon * 0.55, 0.38);
  /* a pale sheen where the painting is brightest, as moonlight on water */
  col += vec3(0.10, 0.13, 0.19) * smoothstep(0.72, 0.95, l);
  /* what already burns on the map keeps its fire */
  float warm = smoothstep(0.5, 0.8, l) * smoothstep(0.12, 0.35, c.r - c.b);
  col = mix(col, c * vec3(1.0, 0.78, 0.5), warm * 0.85);
  /* the moon stands high on the left; the dark closes in from the edges,
     with a fine grain, as a night plate */
  col *= mix(0.86, 1.12, smoothstep(1.3, 0.0, length((uv - vec2(0.18, 0.08)) * vec2(1.0, 0.7))));
  float v = plate(uv, 0.32);
  col *= mix(0.32, 1.0, v);
  col += (hash(floor(p) + uSeed) - 0.5) * 0.022;
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const FRAGMENTS: Record<Exclude<PhotoLook, 'none'>, string> = { sepia: SEPIA, aquarelle: AQUARELLE, nuit: NUIT };

interface LookUniforms {
  uFrame: Float32Array;
  uUnit: number;
  uSeed: number;
}

function lookFilter(look: Exclude<PhotoLook, 'none'>): Filter {
  return new Filter({
    /* high precision throughout: the paper's noise is hashed from print
       pixels, and the vertex stage already reads the frame's sizes so */
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: FRAGMENTS[look], name: `photo-${look}`, preferredFragmentPrecision: 'highp' }),
    resources: {
      photoUniforms: {
        uFrame: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
        uUnit: { value: 1, type: 'f32' },
        uSeed: { value: 0.37, type: 'f32' },
      },
    },
  });
}

const uniformsOf = (f: Filter): LookUniforms => (f.resources.photoUniforms as { uniforms: LookUniforms }).uniforms;

/* ------------------------------ lamps ------------------------------ */

/** a lamp's glow: white-hot at its heart, amber, then nothing */
function lampTexture(size = 128): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.18, 'rgba(255,196,118,0.62)');
  g.addColorStop(0.5, 'rgba(236,128,48,0.2)');
  g.addColorStop(1, 'rgba(200,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** the towns' lights by night: a glow over each town, a brighter one over
 *  each works built, the merchants' lanterns, and a lamp every so often
 *  along the lines laid */
function layLamps(layer: Container, tex: Texture, game: GameState): void {
  for (const c of layer.removeChildren()) c.destroy();
  const lamp = (x: number, y: number, r: number, alpha: number) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = r * 2;
    s.alpha = alpha;
    s.blendMode = 'add';
    layer.addChild(s);
  };
  for (const town of TOWNS) {
    const chrome = townChrome(town);
    let built = 0;
    town.slots.forEach((_, si) => {
      const tile = game.tiles[tileKey(town.id, si)];
      if (!tile) return;
      built++;
      const at = chrome.slots[si];
      lamp(at.x, at.y, tile.flipped ? 104 : 92, tile.flipped ? 0.42 : 0.32);
    });
    lamp(chrome.ax, chrome.ay, 170 + built * 30, 0.2 + Math.min(4, built) * 0.035);
  }
  for (const m of MERCHANTS) if (merchantOpen(game, m.id)) lamp(m.x, m.y, 110, 0.26);
  for (const def of LINKS) {
    const built = game.links[def.id];
    if (!built) continue;
    const pts = routeFor(def, built.era ?? game.era).pts;
    let run = 60;
    for (let i = 1; i < pts.length; i++) {
      run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (run < 150) continue;
      run = 0;
      lamp(pts[i][0], pts[i][1], 26, 0.42);
    }
  }
}

/* ------------------------------- rig ------------------------------- */

export interface PhotoRig {
  app: Application;
  scene: BoardScene;
  cam: Camera;
  /** the state the board paints (a game read again paints its own) */
  game: () => GameState;
}

interface Rigged extends PhotoRig {
  lamps: Container;
  lampTex: Texture;
  filters: Map<PhotoLook, Filter>;
  lampGame: GameState | null;
  /** the state the board was last dressed for */
  shown: PhotoState;
}

let rig: Rigged | null = null;

/** the board lends itself to the photo mode; returns the way to take it back */
export function attachPhoto(r: PhotoRig): () => void {
  const lamps = new Container();
  lamps.eventMode = 'none';
  lamps.visible = false;
  r.app.stage.addChild(lamps);
  const lampTex = lampTexture();
  const me: Rigged = { ...r, lamps, lampTex, filters: new Map(), lampGame: null, shown: { ...getPhoto(), on: false } };
  rig = me;
  /* after the board's own tick: the lamps ride the world where it now stands */
  const follow = () => {
    if (!me.shown.on) return;
    const { world } = me.scene;
    lamps.position.copyFrom(world.position);
    lamps.scale.copyFrom(world.scale);
    if (lamps.visible) {
      const g = me.game();
      if (g !== me.lampGame) {
        me.lampGame = g;
        layLamps(lamps, lampTex, g);
      }
    }
    const f = me.filters.get(me.shown.look);
    if (f && world.filters?.[0] === f) {
      const u = uniformsOf(f);
      u.uFrame[0] = me.app.screen.width;
      u.uFrame[1] = me.app.screen.height;
    }
  };
  r.app.ticker.add(follow, undefined, UPDATE_PRIORITY.LOW);
  const unsub = subscribePhoto(() => dress(me));
  dress(me);
  return () => {
    unsub();
    r.app.ticker?.remove(follow);
    if (rig !== me) return;
    rig = null;
    /* the table keeps its own limits once the board has gone */
    if (me.shown.on) {
      setZoomCeiling(null);
      holdFitReserve(null);
    }
    for (const f of me.filters.values()) f.destroy();
    lampTex.destroy(true);
  };
}

/** the camera freed (a closer zoom, the hand's strip given back to the
 *  frame) or put back on its leash — the picture holding still as the
 *  fit changes under it */
function leash(me: Rigged, free: boolean): void {
  const { cam, app } = me;
  setZoomCeiling(free ? PHOTO_MAX_K : null);
  const { width: w, height: h } = app.screen;
  const before = fitScale(w, h);
  holdFitReserve(free ? 0 : null);
  const after = fitScale(w, h);
  if (before > 0 && after > 0) {
    cam.view = { ...cam.view, k: (cam.view.k * before) / after };
    cam.target = { ...cam.view };
  }
  cam.reclamp();
}

/** the board dressed for the store's state, from the one it was last in */
function dress(me: Rigged): void {
  const now = getPhoto();
  const was = me.shown;
  me.shown = { ...now };
  if (was.on !== now.on) leash(me, now.on);
  const { scene } = me;
  const on = now.on;
  /* the plan in hand and the hover stay off the photograph */
  scene.overlay.visible = !on;
  scene.hoverLayer.visible = !on;
  const labels = !on || now.labels;
  const ribbons = scene.ribbons[0]?.parent;
  if (ribbons) ribbons.visible = labels;
  for (const tv of scene.towns.values()) {
    for (const sl of tv.slots) {
      sl.badges.visible = labels;
      sl.detail.visible = labels;
    }
  }
  const look = on ? now.look : 'none';
  const mine = new Set<unknown>(me.filters.values());
  if (look === 'none') {
    if (scene.world.filters?.some((f) => mine.has(f))) {
      scene.world.filters = null;
      scene.world.filterArea = undefined;
    }
  } else {
    let f = me.filters.get(look);
    if (!f) {
      f = lookFilter(look);
      me.filters.set(look, f);
    }
    const u = uniformsOf(f);
    u.uFrame[0] = me.app.screen.width;
    u.uFrame[1] = me.app.screen.height;
    u.uUnit = 1;
    scene.world.filters = [f];
    scene.world.filterArea = TABLE_AREA;
  }
  me.lamps.visible = look === 'nuit';
  if (look === 'nuit') {
    me.lampGame = null;
    me.lamps.position.copyFrom(scene.world.position);
    me.lamps.scale.copyFrom(scene.world.scale);
  }
}

export interface Print {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** print pixels to a pixel of the frame */
  scale: number;
}

/** the board as it stands, pulled at print size in the chosen look: the
 *  world is set at the print's scale for one render into a texture of its
 *  own, then put back where the table had it, before the next frame */
export function pullPrint(): Print | null {
  if (!rig) return null;
  const { app, scene, lamps } = rig;
  const w = app.screen.width;
  const h = app.screen.height;
  const { width, height, scale } = printSize(w, h);
  if (!width || !height) return null;
  const world = scene.world;
  const at = { x: world.position.x, y: world.position.y, s: world.scale.x };
  const f = rig.filters.get(rig.shown.look);
  const u = f && world.filters?.[0] === f ? uniformsOf(f) : null;
  const rt = RenderTexture.create({ width, height, resolution: 1, antialias: true });
  try {
    world.scale.set(at.s * scale);
    world.position.set(at.x * scale, at.y * scale);
    lamps.scale.copyFrom(world.scale);
    lamps.position.copyFrom(world.position);
    if (u) {
      u.uFrame[0] = w;
      u.uFrame[1] = h;
      u.uUnit = scale;
    }
    app.renderer.render({ container: app.stage, target: rt, clear: true, clearColor: '#141210' });
    const canvas = app.renderer.extract.canvas({ target: rt }) as HTMLCanvasElement;
    return { canvas, width, height, scale };
  } finally {
    world.scale.set(at.s);
    world.position.set(at.x, at.y);
    lamps.scale.copyFrom(world.scale);
    lamps.position.copyFrom(world.position);
    if (u) u.uUnit = 1;
    /* the texture is let go once the next frames have bound others in its place */
    window.setTimeout(() => rt.destroy(true), 250);
  }
}

/** the camera back on the whole country, for a photograph of it all */
export function photoFit(): void {
  rig?.cam.fit();
}

/** the board is there to be photographed */
export const photoReady = (): boolean => rig !== null;
