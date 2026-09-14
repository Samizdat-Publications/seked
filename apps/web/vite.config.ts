import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The workspace packages are TypeScript source, not builds, so Vite compiles
 * them with the app and the browser gets the same geometry the tests do.
 * `base: './'` keeps the static build working from any path.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
