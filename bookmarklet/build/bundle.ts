import { build } from 'esbuild';

import { SHARED_DEFINE } from './shared-data.js';

export async function bundleBookmarklet(): Promise<string> {
  const result = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    define: SHARED_DEFINE,
  });
  const [bundle] = result.outputFiles;
  if (!bundle) {
    throw new Error('esbuild produced no bookmarklet bundle');
  }
  return bundle.text.trim();
}
