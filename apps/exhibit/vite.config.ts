import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const walk = join(__dirname, '..', 'walk');
const flights = join(__dirname, 'flights');
const viewer = join(__dirname, '..', 'web', 'public');
const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };

/**
 * The exhibit reads the walkthrough's panoramas, stations and overlays where the site keeps them, at ../walk/.
 * In development the dev server serves apps/walk under /walk/ so the same relative path works; the build
 * carries none of them, so the panoramas are published once. The flights (apps/exhibit/flights/, rendered on
 * the laptop and gitignored) are served at /flights/ and copied in by `pnpm site`. The bundled database the
 * receipts read (`pnpm bundle`, apps/web/public/seked.json) is at ../viewer/ on the site, so it is served there too.
 */
const walkFiles = (): Plugin => ({
  name: 'seked-walk-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
      const [dir, prefix] = path.startsWith('/walk/') ? [walk, '/walk/'] : path.startsWith('/flights/') ? [flights, '/flights/']
        : path.startsWith('/viewer/') ? [viewer, '/viewer/'] : [null, ''];
      if (!dir) return next();
      const file = normalize(join(dir, path.slice(prefix.length)));
      // a file that is not there is a 404, not the index page, so the player knows to cut instead
      if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
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
