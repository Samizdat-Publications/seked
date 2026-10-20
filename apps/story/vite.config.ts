import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = join(__dirname, '..', '..');
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };

/**
 * The stage's stills are committed renders, which `pnpm site` publishes at progress/ and alignments/ beside
 * story/. In development they are served from the repo at the same paths, so the page's `../progress/...`
 * resolves the same way in both.
 */
const stills = (): Plugin => ({
  name: 'seked-stills',
  configureServer(server) {
    const dirs: Record<string, string> = { '/progress/': join(root, 'docs', 'progress'), '/alignments/': join(root, 'apps', 'alignments') };
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
      const prefix = Object.keys(dirs).find((p) => path.startsWith(p));
      if (!prefix) return next();
      const dir = dirs[prefix]!;
      const file = normalize(join(dir, path.slice(prefix.length)));
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      createReadStream(file).pipe(res);
    });
  },
});

/**
 * `base: './'` keeps the static build working from any path, as the viewer's does. In development the viewer's
 * public/ is served too, so the page finds the bundled database (`pnpm bundle`) at ./seked.json; on the site
 * it reads the viewer's copy. The stills are served as the site lays them out (`stills` above).
 */
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [stills()],
  publicDir: command === 'serve' ? '../web/public' : false,
  build: { outDir: 'dist', emptyOutDir: true },
}));
