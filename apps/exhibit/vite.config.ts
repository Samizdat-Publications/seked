import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const walk = join(__dirname, '..', 'walk');
const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };

/**
 * The exhibit reads the walkthrough's panoramas, stations and overlays where the site keeps them, at ../walk/.
 * In development the dev server serves apps/walk under /walk/ so the same relative path works; the build
 * carries none of them, so the panoramas are published once.
 */
const walkFiles = (): Plugin => ({
  name: 'seked-walk-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
      if (!path.startsWith('/walk/')) return next();
      const file = normalize(join(walk, path.slice('/walk/'.length)));
      if (!file.startsWith(walk + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      createReadStream(file).pipe(res);
    });
  },
});

/** `base: './'` keeps the static build working from any path; the site puts it at /exhibit/, beside /walk/. */
export default defineConfig({
  base: './',
  plugins: [walkFiles()],
  publicDir: false,
  build: { outDir: 'dist', emptyOutDir: true },
});
