import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // new versions activate on the next launch instead of reloading mid-game
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Card Table',
        short_name: 'Card Table',
        description: 'A rules-free virtual card table: play any card game with friends.',
        theme_color: '#0b2e23',
        background_color: '#0f3d2e',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
      },
    }),
  ],
  resolve: { alias: { '@vct/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  // host: true listens on all interfaces so phones on the same network can open the dev server
  server: { host: true, proxy: { '/api': 'http://localhost:3000', '/ws': { target: 'ws://localhost:3000', ws: true } } },
});
