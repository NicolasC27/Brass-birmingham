
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

/** a request to the office's front desk: its status (0 when nothing
 *  answered) and what it said */
export async function askOffice(path: string, body: Record<string, unknown>): Promise<{ status: number; said: Record<string, unknown> }> {
  if (!OFFICE_HTTP) return { status: 0, said: {} };
  try {
    const res = await fetch(`${OFFICE_HTTP}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const said = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, said };
  } catch {
    return { status: 0, said: {} };
  }
}

/** the same, when only the status matters */
export async function toOffice(path: string, body: Record<string, unknown>): Promise<number> {
  return (await askOffice(path, body)).status;
}

/** the founders' seats still free (null: the office did not say) */
export async function seatsLeft(): Promise<number | null> {
  if (!OFFICE_HTTP) return null;
  try {
    const said = (await (await fetch(`${OFFICE_HTTP}/waitlist/seats`)).json()) as { left?: unknown };
    return typeof said.left === 'number' ? said.left : null;
  } catch {
    return null;
  }
}

/** back up to the first ticket on the page, its field ready to be written in */
export function toTheTicket(): void {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  window.setTimeout(() => document.querySelector<HTMLInputElement>('input[type=email]')?.focus({ preventScroll: true }), still ? 0 : 450);
}
