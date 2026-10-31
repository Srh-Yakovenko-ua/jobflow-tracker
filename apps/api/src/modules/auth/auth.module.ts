import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessTokens } from './access-tokens.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { JwksController } from './jwks.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtKeysModule } from './jwt-keys.module.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { OAuthClient } from './oauth-client.js';
import { OAuthStates } from './oauth-state.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [JwtKeysModule],
  controllers: [AuthController, OAuthController, JwksController],
  providers: [
    AuthService,
    AuthRepository,
    OAuthService,
    OAuthClient,
    OAuthStates,
    PasswordHasher,
    SessionService,
    SessionRepository,
    AccessTokens,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
