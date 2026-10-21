import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';
import { AuthModule } from '../modules/auth/index.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeedRepository } from './seed.repository.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [configModule, LoggerModule.forRoot(loggerParams()), PrismaModule, AuthModule],
  providers: [SeedRepository, SeedService],
})
export class SeedModule {}
