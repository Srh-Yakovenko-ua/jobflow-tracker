import { type FactoryProvider, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/app-config.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccessTokens } from './access-tokens.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { JwksController } from './jwks.controller.js';
import { JwtKeys, loadJwtKeys } from './jwt-keys.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

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
  controllers: [AuthController, JwksController],
  providers: [
    AuthService,
    AuthRepository,
    PasswordHasher,
    SessionService,
    SessionRepository,
    AccessTokens,
    AccessTokenGuard,
    jwtKeysProvider,
  ],
  exports: [AuthService],
})
export class AuthModule {}
