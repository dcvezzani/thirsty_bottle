import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@vct/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['shared/test/**/*.test.ts', 'server/test/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['client/**', 'jsdom']],
    testTimeout: 20000,
  },
});
