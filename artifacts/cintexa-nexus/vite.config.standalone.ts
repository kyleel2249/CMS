// Standalone build config — produces a static bundle for Firebase, Cloudflare,
// or local serving. No PORT or BASE_PATH env vars required.
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist-standalone'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
          ],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  define: {
    // Allow runtime API URL override via VITE_API_BASE_URL env var at build time
    '__API_BASE__': JSON.stringify(process.env.VITE_API_BASE_URL ?? '/api'),
  },
});
