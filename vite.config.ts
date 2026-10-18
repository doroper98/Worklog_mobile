import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': the new worker waits until the app asks for it, so an
      // open page is never claimed mid-session and its lazy chunks keep
      // resolving. The app registers via virtual:pwa-register (useAppUpdate).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: false, // use public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The bundled draw.io viewer is ~4 MB, over workbox's 2 MiB default —
        // without this it is dropped from the precache and every flow diagram
        // has to fetch it again, which defeats offline reading.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'github-api',
              expiration: { maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'github-raw',
              expiration: { maxEntries: 100 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
