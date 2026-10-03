import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
