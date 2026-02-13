import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Kaffebar",
        short_name: "Kaffebar",
        description: "Coffee Bar Control Panel",
        theme_color: "#2d1f0f",
        background_color: "#1a1410",
        display: "fullscreen",
        orientation: "landscape",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/",
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/coffee\/entities(\/|$)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "coffee-entities",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 8, maxAgeSeconds: 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/coffee\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "coffee-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 32, maxAgeSeconds: 10 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
});
