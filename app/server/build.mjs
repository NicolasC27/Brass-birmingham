import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

/* One file to deploy: the server bundled with the very engine the client
   runs, so a table and its players can never drift apart. `ws` stays
   external — it is a real dependency, installed next to the bundle. */

const here = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(here, 'main.ts')],
  outfile: path.join(here, 'dist', 'brassworks-server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['ws'],
  alias: { '@': path.join(here, '..', 'src') },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
