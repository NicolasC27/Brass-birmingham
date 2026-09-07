import { Wire } from './wire';

/* The table server this build talks to. Without VITE_ONLINE_URL the app
   stays entirely in the browser: tables live in localStorage and a second
   tab plays the guest. With it, the office, the room and the game all
   ride the same socket. */

export const ONLINE_URL: string = String(import.meta.env.VITE_ONLINE_URL ?? '').trim();

let opened: Wire | null = null;

/** the shared wire, opened on first use — null when no server is configured */
export function onlineWire(): Wire | null {
  if (!ONLINE_URL) return null;
  if (!opened) opened = new Wire(ONLINE_URL);
  return opened;
}
