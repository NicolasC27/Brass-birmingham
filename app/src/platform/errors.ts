import { onlineWire } from '@/online/net';

/* The page's own faults, posted to the office: what broke and where, the
   build and the browser, never a game or anything of the player's. The
   same fault goes once per tab; no more than five leave in a minute; a
   fault raised with the line down waits in the wire's outbox. */

const PER_MINUTE = 5;
const sent = new Set<string>();
let stamps: number[] = [];

export function reportFault(message: string, stack = ''): void {
  const key = `${message}|${stack.split('\n')[1] ?? ''}`;
  if (sent.has(key)) return;
  const now = Date.now();
  stamps = stamps.filter((t) => now - t < 60_000);
  if (stamps.length >= PER_MINUTE) return;
  const wire = onlineWire();
  if (!wire) return;
  sent.add(key);
  stamps.push(now);
  wire.fault({
    message: message.slice(0, 500),
    stack: (stack.startsWith(message) ? stack.split('\n').slice(1) : stack.split('\n')).slice(0, 12).join('\n').slice(0, 2000),
    /* the path only: a query or a hash could carry a token */
    page: location.pathname.slice(0, 200),
    version: String(import.meta.env.VITE_VERSION ?? import.meta.env.MODE),
    agent: navigator.userAgent.slice(0, 200),
    at: now,
  });
}

const describe = (e: unknown): [string, string] =>
  e instanceof Error ? [`${e.name}: ${e.message}`, e.stack ?? ''] : [String(e), ''];

export function installFaultReports(): void {
  window.addEventListener('error', (ev) => {
    const [message, stack] = ev.error ? describe(ev.error) : [ev.message || 'error', `at ${ev.filename}:${ev.lineno}:${ev.colno}`];
    try {
      reportFault(message, stack);
    } catch {
      /* the report must never be a second fault */
    }
  });
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      reportFault(...describe(ev.reason));
    } catch {
      /* likewise */
    }
  });
}
