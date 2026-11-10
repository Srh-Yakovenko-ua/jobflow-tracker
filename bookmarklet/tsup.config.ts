import { defineConfig } from 'tsup';

import { bundleBookmarklet } from './build/bundle.js';

export default defineConfig(async () => {
  const code = await bundleBookmarklet();
  return {
    entry: ['src/href.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    define: { BOOKMARKLET_CODE: JSON.stringify(code) },
  };
});
