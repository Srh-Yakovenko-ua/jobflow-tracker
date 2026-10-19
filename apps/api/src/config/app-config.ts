import { fileURLToPath } from 'node:url';

import { ConfigModule, type ConfigService } from '@nestjs/config';

import { type Env, validateEnv } from './env.js';

export type AppConfig = ConfigService<Env, true>;

export const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
  envFilePath: fileURLToPath(new URL('../../../../.env', import.meta.url)),
});
