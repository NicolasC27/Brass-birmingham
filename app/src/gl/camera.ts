import { WORLD_H, WORLD_W, centeredOn, clampK, clampPan, fitScale, kToCentre, zoomAt } from '@/components/game/boardView';
import type { View } from '@/components/game/boardView';

/* ------------------------------------------------------------------ */
/* Camera — inertial pan/zoom for the WebGL board.                     */
/* The DOM version needed CSS-transition tricks because writing a new  */
/* scale per frame forced re-rasterization; here a frame is just a     */
/* matrix multiply, so a plain chase loop (view lerps toward target    */
/* every tick) is both the simplest and the smoothest approach.        */
/* ------------------------------------------------------------------ */

const clampView = (v: View, w: number, h: number) => clampPan({ ...v, k: clampK(v.k) }, w, h);

export class Camera {
  view: View = { k: 1, x: 0, y: 0 };
  target: View = { k: 1, x: 0, y: 0 };
  /** timestamp of the last direct user manipulation (bot-follow yields) */
  lastManual = 0;
  /** throttled React sync (minimap, tooltips, overlays) */
  onCommit: ((v: View) => void) | null = null;

  private vel = { x: 0, y: 0 };
  private gliding = false;
  /** a flight: from one view to another over a fixed time, eased both ends
   *  (the scale runs in log space so the zoom feels even) — for the fly-to
   *  and the fit; the wheel and the hand keep the chase */
  private fly: { from: View; to: View; t0: number; ms: number } | null = null;
  private drag: { sx: number; sy: number; lx: number; ly: number; lt: number; moved: boolean } | null = null;
  private lastCommit = 0;
  private readonly getSize: () => { w: number; h: number };

  constructor(getSize: () => { w: number; h: number }) {
    this.getSize = getSize;
  }

  /** call every ticker frame */
  tick(deltaMS: number): void {
    const { w, h } = this.getSize();
    if (w === 0) return;
    /* the chase: ~90 ms for a pan, weighty but snappy; ~170 ms while the
       scale is moving, so a wheel notch swells rather than steps (the
       anchor under the pointer holds: k, x and y share the one factor) */
    if (this.fly) {
      const t = Math.min(1, (performance.now() - this.fly.t0) / this.fly.ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const { from, to } = this.fly;
      this.view = { k: Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e), x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      this.target = { ...to };
      if (t >= 1) {
        this.fly = null;
        this.view = { ...to };
      }
      this.commitTick();
      return;
    }
    const zooming = Math.abs(this.target.k - this.view.k) > 0.003;
    const f = 1 - Math.exp(-deltaMS / (zooming ? 170 : 90));
    if (this.gliding) {
      this.target.x += this.vel.x * (deltaMS / 1000);
      this.target.y += this.vel.y * (deltaMS / 1000);
      const fr = Math.exp(-deltaMS / 160);
      this.vel.x *= fr;
      this.vel.y *= fr;
      if (Math.hypot(this.vel.x, this.vel.y) < 12) this.gliding = false;
      this.target = clampView(this.target, w, h);
    }
    this.view.k += (this.target.k - this.view.k) * f;
    this.view.x += (this.target.x - this.view.x) * f;
    this.view.y += (this.target.y - this.view.y) * f;
    this.commitTick();
  }

  /** the throttled word to the page, and a last one when the camera settles */
  private commitTick(): void {
    const now = performance.now();
    if (this.isMoving()) {
      if (now - this.lastCommit > 120) {
        this.lastCommit = now;
        this.onCommit?.({ ...this.view });
      }
    } else if (this.lastCommit !== -1) {
      this.lastCommit = -1;
      this.onCommit?.({ ...this.view }); // final settle commit
    }
  }

  /** the hand takes the camera: whatever flight was on is over, from here */
  private interrupt(): void {
    if (!this.fly) return;
    this.fly = null;
    this.target = { ...this.view };
  }

  /** a flight to a view, so many milliseconds long */
  private glide(to: View, ms: number): void {
    this.gliding = false;
    this.fly = { from: { ...this.view }, to, t0: performance.now(), ms };
    this.target = { ...to };
  }

  isMoving(): boolean {
    return (
      this.fly !== null ||
      Math.abs(this.target.k - this.view.k) > 0.0008 ||
      Math.abs(this.target.x - this.view.x) + Math.abs(this.target.y - this.view.y) > 0.5 ||
      this.gliding ||
      this.drag !== null
    );
  }

  /* ---------------------------- inputs ----------------------------- */

  wheel(e: WheelEvent, rect: DOMRect): void {
    e.preventDefault();
    this.lastManual = Date.now();
    this.gliding = false;
    this.interrupt();
    const { w, h } = this.getSize();
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0017));
    this.target = zoomAt(this.target, e.clientX - rect.left, e.clientY - rect.top, factor, w, h);
  }

  pointerDown(e: PointerEvent): void {
    this.lastManual = Date.now();
    this.gliding = false;
    this.interrupt();
    this.drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false };
  }

  /** returns true once the gesture counts as a drag (suppresses clicks) */
  pointerMove(e: PointerEvent): boolean {
    if (!this.drag) return false;
    const { w, h } = this.getSize();
    const stepX = e.clientX - this.drag.lx;
    const stepY = e.clientY - this.drag.ly;
    this.view = clampView({ k: this.view.k, x: this.view.x + stepX, y: this.view.y + stepY }, w, h);
    this.target = { ...this.view };
    const now = performance.now();
    const dt = (now - this.drag.lt) / 1000;
    if (dt > 0.008) {
      this.vel.x = this.vel.x * 0.65 + (stepX / dt) * 0.35;
      this.vel.y = this.vel.y * 0.65 + (stepY / dt) * 0.35;
      this.drag.lt = now;
    }
    this.drag.moved = this.drag.moved || Math.abs(e.clientX - this.drag.sx) + Math.abs(e.clientY - this.drag.sy) > 4;
    this.drag.lx = e.clientX;
    this.drag.ly = e.clientY;
    return this.drag.moved;
  }

  pointerUp(): void {
    if (this.drag?.moved && performance.now() - this.drag.lt < 120 && Math.hypot(this.vel.x, this.vel.y) > 40) {
      this.gliding = true;
    }
    this.drag = null;
  }

  /** screen-px point → zoom in/out around it */
  dblclick(sx: number, sy: number, out: boolean): void {
    this.lastManual = Date.now();
    this.interrupt();
    const { w, h } = this.getSize();
    this.target = zoomAt(this.target, sx, sy, out ? 1 / 1.6 : 1.6, w, h);
  }

  /* --------------------------- commands ---------------------------- */

  zoomStep(factor: number): void {
    this.interrupt();
    const { w, h } = this.getSize();
    this.target = zoomAt(this.target, w / 2, h / 2, factor, w, h);
  }

  fit(): void {
    this.glide({ k: 1, x: 0, y: 0 }, 600);
  }

  /** back to k=1 keeping the current world centre on screen */
  hundred(): void {
    const { w, h } = this.getSize();
    const s = fitScale(w, h) * this.view.k;
    if (s === 0) return;
    const cx = WORLD_W / 2 - this.view.x / s;
    const cy = WORLD_H / 2 - this.view.y / s;
    this.glide(centeredOn(cx, cy, 1, w, h), 500);
  }

  flyTo(wx: number, wy: number, k = 1.6): void {
    const { w, h } = this.getSize();
    /* a point near the edge cannot sit in the middle at a wide view: come closer */
    const to = centeredOn(wx, wy, Math.max(this.target.k, k, kToCentre(wx, wy, w, h)), w, h);
    /* a long way takes a little longer, never more than a second */
    const s = fitScale(w, h) * this.view.k;
    const dist = Math.hypot((to.x - this.view.x) / Math.max(s, 0.001), (to.y - this.view.y) / Math.max(s, 0.001));
    this.glide(to, Math.min(1000, 450 + dist * 0.12));
  }

  /** the map pushed by so many screen pixels (the arrow keys) */
  nudge(dx: number, dy: number): void {
    if (!dx && !dy) return;
    this.lastManual = Date.now();
    this.gliding = false;
    this.interrupt();
    const { w, h } = this.getSize();
    this.target = clampPan({ k: this.target.k, x: this.target.x + dx, y: this.target.y + dy }, w, h);
  }

  /** instant jump (minimap drag) */
  centerOn(wx: number, wy: number): void {
    const { w, h } = this.getSize();
    this.gliding = false;
    this.fly = null;
    this.target = centeredOn(wx, wy, this.view.k, w, h);
    this.view = { ...this.target };
  }
}
