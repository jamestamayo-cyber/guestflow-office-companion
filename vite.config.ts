// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function offlineShellPlugin(): Plugin {
  let clientBuild = false;
  return {
    name: "guestflow-offline-shell",
    apply: "build",
    configResolved(config) {
      clientBuild = !config.build.ssr;
    },
    closeBundle() {
      if (!clientBuild) return;
      const publicDir = resolve(".output/public");
      const serverDir = resolve(".output/server");
      if (!existsSync(publicDir) || !existsSync(serverDir)) return;

      const serverManifest = readdirSync(serverDir).find(
        (file) => file.startsWith("_tanstack-start-manifest_") && file.endsWith(".mjs"),
      );
      if (!serverManifest) return;
      const source = readFileSync(resolve(serverDir, serverManifest), "utf8");
      const clientEntry = /src:\s*"([^"]+\.js)"/.exec(source)?.[1];
      if (!clientEntry || !existsSync(resolve(publicDir, `.${clientEntry}`))) return;

      const assetsDir = resolve(publicDir, "assets");
      const stylesheet = existsSync(assetsDir)
        ? readdirSync(assetsDir).find((file) => /^styles-.*\.css$/.test(file))
        : undefined;
      const stylesheetLink = stylesheet
        ? `<link rel="stylesheet" href="/assets/${stylesheet}">`
        : "";
      writeFileSync(
        resolve(publicDir, "index.html"),
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#166534"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg" type="image/svg+xml">${stylesheetLink}<title>GuestFlow Office Companion</title></head><body><div id="root"></div><script type="module" async src="${clientEntry}"></script></body></html>`,
      );
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        outDir: ".output/public",
        integration: { closeBundleOrder: "post" },
        registerType: "autoUpdate",
        injectRegister: null,
        includeAssets: ["favicon.svg", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "GuestFlow Office Companion",
          short_name: "GuestFlow",
          description: "Office visitor management and visitor logbook.",
          theme_color: "#166534",
          background_color: "#f8fafc",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /\.[a-z0-9]+$/i],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "guestflow-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
      offlineShellPlugin(),
    ],
  },
  tanstackStart: {
    client: { entry: "client" },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
