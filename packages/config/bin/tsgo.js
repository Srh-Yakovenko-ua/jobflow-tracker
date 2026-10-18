#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('typescript-7/package.json');
const { bin } = require(manifestPath);
const compilerPath = path.join(path.dirname(manifestPath), bin.tsc);

const result = spawnSync(process.execPath, [compilerPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
