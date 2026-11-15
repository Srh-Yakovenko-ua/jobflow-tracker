import { ConfigModule, type ConfigService } from '@nestjs/config';

import { type Env, ENV_FILE_PATH, validateEnv } from './env.js';

export type AppConfig = ConfigService<Env, true>;

export const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
  envFilePath: ENV_FILE_PATH,
});
