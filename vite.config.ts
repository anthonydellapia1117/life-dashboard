import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app from https://<user>.github.io/life-dashboard/,
// so every asset path (including the encrypted data fetch) must be relative to
// this base, in both dev and prod.
export default defineConfig({
  base: '/life-dashboard/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
