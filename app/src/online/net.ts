import { loadIdentity } from './identity';
import { Wire } from './wire';

/* The table server this build talks to. Without VITE_ONLINE_URL the app
   stays entirely in the browser: tables live in localStorage and a second
   tab plays the guest. With it, the office, the room and the game all
   ride the same socket. */

export const ONLINE_URL: string = String(import.meta.env.VITE_ONLINE_URL ?? '').trim();

export const identity = loadIdentity();

let opened: Wire | null = null;

/** the shared wire, opened on first use — null when no server is configured */
export function onlineWire(): Wire | null {
  if (!ONLINE_URL) return null;
  if (!opened) opened = new Wire(ONLINE_URL, identity);
  return opened;
}

/* ------------------------- the table in play ----------------------- */

const ONLINE_KEY = 'brassworks.online.v1';

/** the table the game page is playing over the wire, if any */
export function tableInPlay(): string | null {
  try {
    return localStorage.getItem(ONLINE_KEY) || null;
  } catch {
    return null;
  }
}

/** the game page will play this table when it opens */
export function enterTable(code: string): void {
  try {
    localStorage.setItem(ONLINE_KEY, code);
  } catch {
    /* the game page will simply play locally */
  }
}

/** back to games played in this browser */
export function leaveTable(): void {
  try {
    localStorage.removeItem(ONLINE_KEY);
  } catch {
    /* non-fatal */
  }
}
