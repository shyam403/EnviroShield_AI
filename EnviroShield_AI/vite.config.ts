// @lovable.dev/vite-tanstack-config already includes:
// - TanStack devtools
// - tanstackStart
// - viteReact
// - tailwindcss
// - tsConfigPaths
// - nitro
// - VITE_* env injection
// - @ path alias
// - React/TanStack dedupe
// - error logger plugins
// - sandbox detection
//
// Do NOT add those plugins manually.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
    },

    server: {
      entry: "server",
    },
  },

  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        manifest: false,

        devOptions: {
          enabled: false,
        },

        workbox: {
          globPatterns: [
            "**/*.{js,css,html,png,svg,ico,webmanifest,woff2}",
          ],

          navigateFallback: "/",

          navigateFallbackDenylist: [
            /^\/~oauth/,
            /^\/api\//,
          ],

          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode === "navigate",

              handler: "NetworkFirst",

              options: {
                cacheName: "floodsafe-pages",
                networkTimeoutSeconds: 4,
              },
            },

            {
              urlPattern: ({ sameOrigin, url }) =>
                sameOrigin && /\/assets\//.test(url.pathname),

              handler: "CacheFirst",

              options: {
                cacheName: "floodsafe-assets",
              },
            },
          ],
        },
      }),
    ],
  },
});