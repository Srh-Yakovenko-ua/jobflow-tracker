import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';
import { MatchTriggerModule } from '../modules/match/index.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { AiRematchRepository } from './ai-rematch.repository.js';
import { AiRematchService } from './ai-rematch.service.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    PrismaModule,
    QueuesModule,
    MatchTriggerModule,
  ],
  providers: [AiRematchRepository, AiRematchService],
})
export class AiRematchModule {}
