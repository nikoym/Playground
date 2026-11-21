/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

// Strict CSP for production builds only (the dev server needs inline scripts).
// The app only ever talks to its own origin and api.github.com.
const CSP =
  "default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; manifest-src 'self'; worker-src 'self'";
const csp = (): Plugin => ({
  name: "csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(`<meta charset="UTF-8" />`, `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// GitHub Pages serves the app at /<repo-name>/. Override with BASE_PATH if needed.
const base = process.env.BASE_PATH ?? "/Playground/";

export default defineConfig({
  base,
  plugins: [
    react(),
    csp(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Idea Tracker",
        short_name: "Ideas",
        description: "Choose one project, finish it, then pick the next.",
        theme_color: "#4f46e5",
        background_color: "#0f1115",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"] },
});
