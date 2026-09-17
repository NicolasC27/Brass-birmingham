/* ------------------------------------------------------------------ */
/* In the desktop window the browser's own page zoom is not there:    */
/* this gives it back. Ctrl (or Cmd) with + / − / 0, on the row or    */
/* the pad, on any keyboard layout, and Ctrl with the wheel. The       */
/* factor is remembered for the next launch. Does nothing on the web.  */
/* ------------------------------------------------------------------ */

const KEY = 'brassworks.desktop.zoom.v1';
const STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function inDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function installDesktopZoom(): Promise<void> {
  if (!inDesktopShell()) return;
  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  const view = getCurrentWebview();
  let zoom = 1;
  try {
    const saved = Number(localStorage.getItem(KEY));
    if (STEPS.includes(saved)) zoom = saved;
  } catch {
    /* no storage: start at 1 */
  }
  const apply = (z: number) => {
    zoom = z;
    void view.setZoom(z);
    try {
      localStorage.setItem(KEY, String(z));
    } catch {
      /* not remembered, still applied */
    }
  };
  const step = (dir: 1 | -1) => {
    const i = STEPS.indexOf(zoom);
    const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? STEPS.indexOf(1) : i) + dir))];
    if (next !== zoom) apply(next);
  };
  if (zoom !== 1) void view.setZoom(zoom);

  window.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const plus = e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd';
      const minus = e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract';
      const reset = e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0';
      if (!plus && !minus && !reset) return;
      /* the window's zoom, not the map's: the board never hears these */
      e.preventDefault();
      e.stopPropagation();
      if (reset) apply(1);
      else step(plus ? 1 : -1);
    },
    { capture: true },
  );
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      e.stopPropagation();
      step(e.deltaY < 0 ? 1 : -1);
    },
    { capture: true, passive: false },
  );
}
