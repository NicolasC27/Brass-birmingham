import { readFileSync } from 'node:fs';
import { serve } from './index';

/* The server as a process: PORT, HOST and BLACKRAIL_DB from the
   environment, and the keys the house keeps in `.env.local` beside the
   app or at the repository's root (RESEND_API_KEY, FEEDBACK_TOKEN…) —
   read here so an ignored file holds every secret, the shell's own
   values winning. SQLite ships
   with Node but still announces itself as experimental on every start;
   that one line is not news. */

/* beside the app, and at the repository's root where the tools keep theirs */
for (const file of ['.env.local', '.env', '../.env.local', '../.env']) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const quiet = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && w.message.includes('SQLite')) return;
  for (const listener of quiet) listener(w);
  if (quiet.length === 0) console.warn(w.stack ?? w.message);
});

/* an error nobody caught must not close the house on every table at once:
   it is logged, and the process goes on */
process.on('uncaughtException', (e) => console.error('uncaught:', e));
process.on('unhandledRejection', (e) => console.error('unhandled:', e));

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const file = process.env.BLACKRAIL_DB ?? 'brassworks.db';

serve({ port, host, file }).then((table) => {
  console.log(`blackrail table server listening on ${host}:${table.port}, register in ${file}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      /* the register is already up to date: closing is only good manners */
      void table.close().then(() => process.exit(0));
    });
  }
});
