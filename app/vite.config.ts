import fs from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    /* the preview carries only the words it prints: the game's, the rules'
       and the results' dictionaries are left out of its build (a missing key
       reads as the key, and none of these is ever asked for there) */
    ...(process.env.VITE_PRELAUNCH === '1'
      ? [
          {
            name: 'blackrail-lean-words',
            enforce: 'pre' as const,
            resolveId: (source: string, importer?: string) =>
              importer && /[\\/]src[\\/]i18n[\\/](en|fr|es|de)\.ts$/.test(importer) && /^\.\/(en|fr|es|de)\/(game|rules|results|board|setup|home|online|site)$/.test(source) ? '\0blackrail-lean-words' : null,
            load: (id: string) => (id === '\0blackrail-lean-words' ? 'export default {}' : null),
          },
          {
            /* and only the pictures it prints: the board's art, the cards and
               the tiles stay off the server until the line opens. The page
               itself is written out as index.html */
            name: 'blackrail-lean-public',
            generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: Buffer }) => void }) {
              const dir = path.resolve(__dirname, 'public');
              /* the stylesheet's paper and grain textures come too: its classes name them */
              const kept = /^(landing-.+\.webp|portrait-(boulton|wedgwood|arkwright|watt)\.webp|logo-blackrail\.svg|icon-192\.png|og-preview\.jpg|tex-[a-z]+\.webp|texture-[a-z-]+\.png|table-felt\.webp|market-brick\.png)$/;
              for (const name of fs.readdirSync(dir)) if (kept.test(name)) this.emitFile({ type: 'asset', fileName: name, source: fs.readFileSync(path.join(dir, name)) });
            },
            writeBundle(o: { dir?: string }) {
              const page = path.join(o.dir ?? 'dist', 'prelaunch.html');
              if (fs.existsSync(page)) fs.renameSync(page, path.join(o.dir ?? 'dist', 'index.html'));
            },
          },
        ]
      : []),
    inspectAttr(),
    react(),
    /* the address the cards a link shows point at: VITE_APP_URL, else the root */
    {
      name: 'blackrail-app-url',
      transformIndexHtml: (html) => html.replaceAll('__APP_URL__', (process.env.VITE_APP_URL ?? '').replace(/\/+$/, '')),
    },
  ],
  server: {
    port: 3000,
  },
  /* the preview before the line opens is its own page (prelaunch.html): built
     alone, it carries nothing of the game (npm run build:prelaunch) */
  build: process.env.VITE_PRELAUNCH === '1' ? { rollupOptions: { input: path.resolve(__dirname, 'prelaunch.html') } } : undefined,
  publicDir: process.env.VITE_PRELAUNCH === '1' ? false : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
