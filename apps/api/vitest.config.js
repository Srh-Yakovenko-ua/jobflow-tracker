import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const BOUNDARY_KEYS = ['DATABASE_URL', 'REDIS_URL'];

const exampleEnv = parseEnv(readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'));

const testDatabaseUrl = new URL(exampleEnv.DATABASE_URL);
testDatabaseUrl.pathname = '/jobflow_test';

const boundaryEnv = Object.fromEntries(
  BOUNDARY_KEYS.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
);

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    env: { ...exampleEnv, ...boundaryEnv },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/generated/**', 'src/test/**'],
      thresholds: { 'src/modules/**/*.service.ts': { lines: 80 } },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          include: ['src/**/*.int.test.ts'],
          fileParallelism: false,
          env: { DATABASE_URL: boundaryEnv.DATABASE_URL ?? testDatabaseUrl.href },
          globalSetup: ['src/test/migrate.global-setup.ts'],
        },
      },
    ],
  },
});
