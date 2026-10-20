import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { defineConfig, type Plugin } from 'vite';
import { pageSources, stillFile, stillSource } from './src/stills';

const root = join(__dirname, '..', '..');
/** Wide enough for the stage on a large screen; the committed PNGs stay the record. */
const WIDTH = 1600;

const shrink = (src: string) =>
  sharp(stillSource(root, src)).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();

/**
 * The stage's stills and the replies' pictures are committed renders, up to 2.3 MB each as PNG. The build writes each as a JPEG
 * `WIDTH` wide into dist/stills/, so the page carries its own and pulls a fraction of that a beat; the dev
 * server makes the same file on request.
 */
const stills = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'seked-stills',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      const cache = new Map<string, Promise<Buffer>>();
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
        const src = pageSources().find((s) => `/${stillFile(s)}` === path);
        if (!src) return next();
        if (!cache.has(path)) cache.set(path, shrink(src));
        cache.get(path)!.then((buf) => {
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(buf);
        }, next);
      });
    },
    async closeBundle() {
      const dir = join(__dirname, outDir, 'stills');
      mkdirSync(dir, { recursive: true });
      const srcs = pageSources();
      for (const src of srcs) writeFileSync(join(__dirname, outDir, stillFile(src)), await shrink(src));
      console.log(`stills: ${srcs.length} written to ${join(outDir, 'stills')}`);
    },
  };
};

/**
 * `base: './'` keeps the static build working from any path, as the viewer's does. In development the viewer's
 * public/ is served too, so the page finds the bundled database (`pnpm bundle`) at ./seked.json; on the site
 * it reads the viewer's copy. The stills are the page's own (`stills` above).
 */
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [stills()],
  publicDir: command === 'serve' ? '../web/public' : false,
  build: { outDir: 'dist', emptyOutDir: true },
}));
