import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, PasswordHasher],
  exports: [AuthService],
})
export class AuthModule {}
