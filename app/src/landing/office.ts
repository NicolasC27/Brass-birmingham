
/* ------------------------------------------------------------------ */
/* The preview speaks to the office over plain HTTP, not the socket:   */
/* a visitor leaving an address opens no line and no account. The      */
/* office's address is the socket's, read as http.                     */
/* ------------------------------------------------------------------ */

/* read from the build's own setting, not from the wire's module: the page
   that only leaves an address has no reason to carry the socket */
export const OFFICE_HTTP = String(import.meta.env.VITE_ONLINE_URL ?? '').trim().replace(/^ws(s?):/, 'http$1:').replace(/\/+$/, '');

/** before the line opens, the preview is the whole site but the direction's way in */
export const PRELAUNCH = String(import.meta.env.VITE_PRELAUNCH ?? '') === '1';

/** where the preview's front page stands */
export const PREVIEW = PRELAUNCH ? '/' : '/avant-premiere';

/** a request to the office's front desk: its status, 0 when nothing answered */
export async function toOffice(path: string, body: Record<string, unknown>): Promise<number> {
  if (!OFFICE_HTTP) return 0;
  try {
    const res = await fetch(`${OFFICE_HTTP}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.status;
  } catch {
    return 0;
  }
}

/** back up to the first ticket on the page, its field ready to be written in */
export function toTheTicket(): void {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  window.setTimeout(() => document.querySelector<HTMLInputElement>('input[type=email]')?.focus({ preventScroll: true }), still ? 0 : 450);
}
