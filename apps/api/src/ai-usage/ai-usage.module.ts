import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AiUsageRepository } from './ai-usage.repository.js';
import { AiUsageService } from './ai-usage.service.js';

@Module({
  imports: [configModule, LoggerModule.forRoot(loggerParams()), PrismaModule],
  providers: [AiUsageRepository, AiUsageService],
})
export class AiUsageModule {}
