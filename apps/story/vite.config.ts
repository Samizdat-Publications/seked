import { defineConfig } from 'vite';

/** `base: './'` keeps the static build working from any path, as the viewer's does. */
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
