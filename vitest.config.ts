import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'scripts/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    // apps/story, the scroll page, was retired on 20 October 2026 for the exhibit (docs/exhibit-2026-10.md); its tests
    // pinned the old script's beats and word counts, which the tightened script of 21 October no longer has
    exclude: ['apps/story/**', '**/node_modules/**'],
  },
});
