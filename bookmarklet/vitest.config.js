import { defineConfig } from 'vitest/config';

import { bundleBookmarklet } from './build/bundle.ts';
import { SHARED_DEFINE } from './build/shared-data.ts';

export default defineConfig(async () => ({
  define: { ...SHARED_DEFINE, BOOKMARKLET_CODE: JSON.stringify(await bundleBookmarklet()) },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
}));
