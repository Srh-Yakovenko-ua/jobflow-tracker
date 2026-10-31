import { type FactoryProvider, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/app-config.js';
import { JwtKeys, loadJwtKeys } from './jwt-keys.js';

const jwtKeysProvider: FactoryProvider<Promise<JwtKeys>> = {
  provide: JwtKeys,
  useFactory: (config: AppConfig) =>
    loadJwtKeys({
      privateKeyPath: config.get('JWT_PRIVATE_KEY_PATH', { infer: true }),
      publicKeyPath: config.get('JWT_PUBLIC_KEY_PATH', { infer: true }),
    }),
  inject: [ConfigService],
};

@Module({
  providers: [jwtKeysProvider],
  exports: [JwtKeys],
})
export class JwtKeysModule {}
