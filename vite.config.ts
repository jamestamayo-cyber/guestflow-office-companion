// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
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
          globPatterns: ["**/*.{html,js,css,svg,png,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                url.hostname.endsWith(".supabase.co") &&
                url.pathname.startsWith("/rest/v1/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "guestflow-supabase-get",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
                plugins: [
                  {
                    cacheKeyWillBeUsed: async ({ request }) => {
                      const url = new URL(request.url);
                      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
                      const payload = token?.split(".")[1];
                      let userId = "anonymous";
                      if (payload) {
                        try {
                          userId = String(JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub ?? "anonymous");
                        } catch {
                          userId = "invalid-token";
                        }
                      }
                      url.searchParams.set("__guestflow_cache_user", userId);
                      return new Request(url, request);
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
