import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { inspectAttr } from 'plugin-inspect-react-code'

/* the build's name, which the faults and the guided game's trail carry:
   VITE_VERSION when the deploy gives one, else the day and the commit it
   is built from — a funnel read before and after a lesson changed */
function buildName(): string {
  if (process.env.VITE_VERSION) return process.env.VITE_VERSION
  try {
    return execSync("git log -1 --format=%cd.%h --date=format:%Y%m%d", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev"
  } catch {
    return "dev"
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_VERSION": JSON.stringify(buildName()),
  },
  /* relative for the desktop shell; the preview is served from a domain's
     root and opened on deep links (/avant-premiere/confirmer/…), so its
     files are addressed from the root */
  base: process.env.VITE_PRELAUNCH === '1' || process.env.VITE_ALPHA === '1' ? '/' : './',
  plugins: [
    /* the preview is the landing and a two-round taste of the game: the
       game's words and pictures come with it, fetched only when played.
       The page is written out as index.html, beside what the search
       engines read first */
    ...(process.env.VITE_PRELAUNCH === '1' || process.env.VITE_ALPHA === '1'
      ? [
          {
            name: 'blackrail-preview-page',
            generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: Buffer }) => void }) {
              const app = (process.env.VITE_APP_URL ?? '').replace(/\/+$/, '');
              if (!app) return;
              this.emitFile({ type: 'asset', fileName: 'robots.txt', source: Buffer.from(`User-agent: *\nAllow: /\nDisallow: /direction\nDisallow: /demo\nDisallow: /avant-premiere/\n\nSitemap: ${app}/sitemap.xml\n`) });
              const urls = ['/', '/legal'].map((u) => `  <url><loc>${app}${u}</loc></url>`).join('\n');
              this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`) });
            },
            writeBundle(o: { dir?: string }) {
              const page = path.join(o.dir ?? 'dist', 'prelaunch.html');
              if (fs.existsSync(page)) fs.renameSync(page, path.join(o.dir ?? 'dist', 'index.html'));
            },
          },
        ]
      : []),
    /* the inspector's source paths stay on the developer's pages: the
       preview is public, and says nothing of how the code is laid out */
    ...(process.env.VITE_PRELAUNCH === '1' || process.env.VITE_ALPHA === '1' ? [] : [inspectAttr()]),
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
