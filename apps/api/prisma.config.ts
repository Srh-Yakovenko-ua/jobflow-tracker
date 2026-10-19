import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { defineConfig } from 'prisma/config';

const rootEnvFile = new URL('../../.env', import.meta.url);

const rootEnv = existsSync(rootEnvFile) ? parseEnv(readFileSync(rootEnvFile, 'utf8')) : {};

const url = process.env['DATABASE_URL'] ?? rootEnv['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: url === undefined ? {} : { url },
});
