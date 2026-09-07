import { serve } from './index';

/* The server as a process: PORT, HOST and BRASSWORKS_DB from the
   environment, nothing else. SQLite ships with Node but still announces
   itself as experimental on every start; that one line is not news. */

const quiet = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && w.message.includes('SQLite')) return;
  for (const listener of quiet) listener(w);
  if (quiet.length === 0) console.warn(w.stack ?? w.message);
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const file = process.env.BRASSWORKS_DB ?? 'brassworks.db';

serve({ port, host, file }).then((table) => {
  console.log(`brassworks table server listening on ${host}:${table.port}, register in ${file}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      /* the register is already up to date: closing is only good manners */
      void table.close().then(() => process.exit(0));
    });
  }
});
