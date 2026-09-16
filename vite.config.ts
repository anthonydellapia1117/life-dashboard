import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const SW_BUILD_ID_TOKEN = '__SW_BUILD_ID__';

// A fresh id every build, so a new deploy's service worker gets a new cache
// name (see public/sw.js) and its activate handler deletes the old one.
const buildId = Date.now().toString(36);

/**
 * public/sw.js is copied to dist/sw.js verbatim by Vite's publicDir copy -
 * public files are never run through esbuild/rollup, so a plain `define`
 * entry can't reach them. This plugin patches the same build id into the
 * copied file after the build writes it, so the cache-busting id still
 * traces back to one value (also exposed below via `define`, in case app
 * code ever wants it too).
 */
function swBuildIdPlugin(): Plugin {
  return {
    name: 'sw-build-id',
    async closeBundle() {
      const swPath = path.join(rootDir, 'dist', 'sw.js');
      let content: string;
      try {
        content = await readFile(swPath, 'utf8');
      } catch {
        return; // no dist/sw.js in this build - nothing to patch
      }
      if (!content.includes(SW_BUILD_ID_TOKEN)) return;
      await writeFile(swPath, content.split(SW_BUILD_ID_TOKEN).join(buildId), 'utf8');
    },
  };
}

// GitHub Pages serves this app from https://<user>.github.io/life-dashboard/,
// so every asset path (including the encrypted data fetch) must be relative to
// this base, in both dev and prod.
export default defineConfig({
  base: '/life-dashboard/',
  plugins: [react(), swBuildIdPlugin()],
  define: {
    __SW_BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    outDir: 'dist',
  },
});
