import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { boot } from './boot.js';
import { buildOpenApiDocument } from './openapi/document.js';

await boot(async () => {
  const [, , target] = process.argv;
  if (target === undefined) {
    throw new Error('Usage: node dist/openapi.js <path to openapi.json>');
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
});
