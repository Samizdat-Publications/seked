import { defineConfig } from 'vite';

/**
 * `base: './'` keeps the static build working from any path, as the viewer's does. In development the viewer's
 * public/ is served too, so the page finds the bundled database (`pnpm bundle`) at ./seked.json; on the site
 * it reads the viewer's copy.
 */
export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? '../web/public' : false,
  build: { outDir: 'dist', emptyOutDir: true },
}));
