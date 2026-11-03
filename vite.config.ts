import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// `vite build` makes the library bundle; `vite example` serves the demo story.
export default defineConfig({
  build: {
    lib: { entry: resolve(import.meta.dirname, 'src/index.ts'), formats: ['es'], fileName: 'index' },
    rolldownOptions: {
      // d3 is a peer; the atlases load by dynamic import, so keep them out of the bundle.
      external: [/^d3/, 'topojson-client', /^us-atlas/, /^world-atlas/],
    },
    sourcemap: true,
  },
  test: { globals: true, environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
